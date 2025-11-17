import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { DatabaseService } from 'src/database/database.service';
import { OutstandingService } from '../outstanding/outstanding.service';
import {
  CreatePaymentDto,
  PaymentResponseDto,
  SearchVendorOutstandingDto,
  VendorOutstandingInvoiceDto,
  PaymentDetailDto,
  PaymentTDSDto,
  PaymentVoucherMatchingDto,
  InterBranchJVDto,
  ExchangeJVDto,
  PaymentFilterDto,
  UpdatePaymentDto,
  ReversePaymentDto,
  MatchedInvoiceDto,
  PaymentTDSResponseDto,
} from '../../dto/payment.dto';
import { Prisma } from '@prisma/client';

/**
 * Payment Voucher Service
 * Handles payment creation with:
 * - Vendor invoice matching (reuses OutstandingService)
 * - Advance payments to vendors
 * - Direct expense payments (no vendor)
 * - Multi-currency support
 * - TDS deduction with VoucherTDS table
 * - Automatic inter-branch JV creation
 * - Automatic exchange gain/loss JV creation
 */
@Injectable()
export class PaymentService {
  private readonly logger = new Logger(PaymentService.name);
  private readonly PAYMENT_VOUCHER_TYPE = 3; // Payment voucher type
  private readonly JOURNAL_VOUCHER_TYPE = 4; // Journal voucher type
  private readonly EXCHANGE_DIFF_TOLERANCE = 0.01; // Tolerance for exchange differences

  constructor(
    private readonly _db: DatabaseService,
    private readonly outstandingService: OutstandingService, // REUSE existing service
  ) {}

  /**
   * Search vendor outstanding invoices using existing OutstandingService
   * REUSES the existing service for vendor outstanding
   */
  async searchVendorOutstanding(searchDto: SearchVendorOutstandingDto): Promise<VendorOutstandingInvoiceDto[]> {
    this.logger.log(`Searching vendor outstanding with criteria: ${JSON.stringify(searchDto)}`);

    try {
      // If searching by vendor (most common case)
      if (searchDto.LedgerMasterSid) {
        // Use OutstandingService to get vendor outstanding
        // Vendor outstanding will have Credit (C) entries
        const vendorOutstanding = await this.outstandingService.getCustomerOutstanding(
          searchDto.CompanyMasterSid,
          searchDto.LedgerMasterSid,
        );

        // Convert to VendorOutstandingInvoiceDto format
        const invoices: VendorOutstandingInvoiceDto[] = vendorOutstanding.transactions.map((txn) => ({
          VoucherTransactionSid: txn.voucherTransactionSid,
          VoucherHeaderSid: 0,
          VoucherNumber: txn.voucherNumber,
          VoucherDate: typeof txn.voucherDate === 'string' ? txn.voucherDate : txn.voucherDate.toISOString(),
          VoucherType: Number(txn.voucherType),
          LedgerMasterSid: vendorOutstanding.ledgerMasterSid,
          VendorName: vendorOutstanding.customerName || '',
          BranchName: undefined,
          OriginalAmount: txn.originalLocalAmount,
          OriginalCurrencyAmount: txn.originalCurrencyAmount,
          MatchedAmount: txn.matchedLocalAmount,
          MatchedCurrencyAmount: txn.matchedCurrencyAmount,
          OutstandingAmount: txn.outstandingLocalAmount,
          OutstandingCurrencyAmount: txn.outstandingCurrencyAmount,
          CurrencyCode: txn.currencyCode,
          ExchangeRate: txn.exchangeRate,
          DrCr: txn.drCr,
          ChargeDescription: txn.chargeDescription,
        }));

        // Filter out fully paid if requested
        if (!searchDto.IncludeFullyPaid) {
          return invoices.filter((inv) => Math.abs(inv.OutstandingAmount) > 0.01);
        }

        return invoices;
      }

      // Advanced search by invoice number, house number, etc.
      return await this.advancedSearchVendorOutstanding(searchDto);
    } catch (error) {
      this.logger.error(`Failed to search vendor outstanding: ${error.message}`, error.stack);
      throw new BadRequestException(`Failed to search vendor outstanding: ${error.message}`);
    }
  }

  /**
   * Advanced search for vendor outstanding by various criteria
   */
  private async advancedSearchVendorOutstanding(
    searchDto: SearchVendorOutstandingDto,
  ): Promise<VendorOutstandingInvoiceDto[]> {
    const whereConditions: Prisma.VoucherTransactionWhereInput = {
      CompanyMasterSid: searchDto.CompanyMasterSid,
      Status: 'A',
      DrCr: 'C', // Vendor invoices are Credit entries
      VoucherHeader: {
        ReversalVoucher: null,
      },
    };

    // Build dynamic where clause
    if (searchDto.InvoiceNumber) {
      whereConditions.VoucherHeader = {
        ReversalVoucher: null,
        VoucherNumber: { contains: searchDto.InvoiceNumber, mode: 'insensitive' },
      };
    }

    const transactions = await this._db.voucherTransaction.findMany({
      where: whereConditions,
      include: {
        VoucherHeader: true,
        subledgerMaster: true,
        voucherMatchings: {
          where: { Status: 'A' },
        },
      },
      orderBy: {
        VoucherDate: 'desc',
      },
      take: 100,
    });

    // Calculate outstanding for each transaction
    const results: VendorOutstandingInvoiceDto[] = [];

    for (const txn of transactions) {
      const matchedAmount = txn.voucherMatchings.reduce((sum, m) => sum + Number(m.Amount), 0);
      const outstandingAmount = Number(txn.Amount) - matchedAmount;

      // Skip fully paid if not requested
      if (!searchDto.IncludeFullyPaid && Math.abs(outstandingAmount) < 0.01) {
        continue;
      }

      results.push({
        VoucherTransactionSid: txn.VoucherTransactionSid,
        VoucherHeaderSid: txn.VoucherHeaderSid,
        VoucherNumber: txn.VoucherHeader.VoucherNumber,
        VoucherDate: txn.VoucherDate.toISOString(),
        VoucherType: txn.VoucherType,
        LedgerMasterSid: txn.LedgerMasterSid || 0,
        VendorName: txn.subledgerMaster?.SubledgerName || '',
        BranchName: undefined,
        OriginalAmount: Number(txn.Amount),
        OriginalCurrencyAmount: Number(txn.Amount),
        MatchedAmount: matchedAmount,
        MatchedCurrencyAmount: 0,
        OutstandingAmount: outstandingAmount,
        OutstandingCurrencyAmount: Number(txn.Amount) - matchedAmount,
        CurrencyCode: txn.CurrencyCode || 'INR',
        ExchangeRate: Number(txn.ExchangeRate || 1),
        DrCr: txn.DrCr,
      });
    }

    return results;
  }

  /**
   * Create payment voucher with all features
   */
  async createPayment(createDto: CreatePaymentDto): Promise<PaymentResponseDto> {
    this.logger.log(`Creating payment voucher`);

    try {
      return await this._db.$transaction(async (prisma) => {
        // 1. Generate voucher number
        const voucherNumber = await this.generatePaymentNumber(
          createDto.CompanyMasterSid,
          createDto.BranchMasterSid,
          new Date(createDto.VoucherDate),
          createDto.PaymentMode,
          prisma,
        );

        // 2. Validate fiscal year
        const currentYear = await prisma.yearMaster.findFirst({
          where: {
            CompanyMasterSid: createDto.CompanyMasterSid,
            CurrentYear: 'Y',
          },
        });

        if (!currentYear) {
          throw new BadRequestException('Current fiscal year not found');
        }

        const voucherDate = new Date(createDto.VoucherDate);
        const startDate = new Date(currentYear.StartDate);
        const endDate = new Date(currentYear.EndDate);

        if (voucherDate < startDate || voucherDate > endDate) {
          throw new BadRequestException(
            `Voucher date must be within fiscal year ${startDate.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]}`,
          );
        }

        // 3. Get vendor details (if vendor payment)
        let vendor: any = null;
        let vendorCOA: any = null;
        if (createDto.VendorLedgerMasterSid) {
          vendor = await prisma.subledgerMaster.findUnique({
            where: { SubledgerMasterSid: createDto.VendorLedgerMasterSid },
          });

          if (!vendor) {
            throw new NotFoundException(`Vendor ${createDto.VendorLedgerMasterSid} not found`);
          }

          vendorCOA = await this.getVendorCOA(createDto.CompanyMasterSid, prisma);
        }

        // 4. Create VoucherHeader
        const voucherHeader = await prisma.voucherHeader.create({
          data: {
            CompanyMasterSid: createDto.CompanyMasterSid,
            BranchMasterSid: createDto.BranchMasterSid,
            VoucherNumber: voucherNumber,
            VoucherDate: voucherDate,
            PostDate: voucherDate,
            VoucherType: this.PAYMENT_VOUCHER_TYPE,
            PartyMasterSid: createDto.VendorLedgerMasterSid || 0,
            PartyName: createDto.PaidTo,
            COAMasterSid: vendorCOA?.COAMasterSid || 0,
            VoucherTypeMasterSid: 1, // Payment voucher type master
            Narration: createDto.Narration || `Payment voucher`,
            SetoffStatus: 'Posted',
            InstrumentMode: createDto.InstrumentMode || null,
            InstrumentNumber: createDto.InstrumentNumber || null,
            InstrumentDate: createDto.InstrumentDate ? new Date(createDto.InstrumentDate) : null,
            Status: 'A',
            CreatedBy: createDto.CreatedBy || 'system',
            UpdatedBy: createDto.CreatedBy || 'system',
          },
        });

        // 5. Calculate total amounts
        const totalDetailAmount = createDto.Details.reduce((sum, d) => sum + d.LocalAmount, 0);
        const totalTDSAmount = createDto.TDSDetails?.reduce((sum, t) => sum + t.TDSAmount, 0) || 0;
        const totalPaymentAmount = totalDetailAmount + totalTDSAmount;

        // 6. Create VoucherDetail and VoucherTransaction for Detail tab entries
        let sno = 1;

        // Process Detail tab entries (expenses, ledger allocations)
        for (const detail of createDto.Details) {
          await this.createDetailEntry(
            voucherHeader.VoucherHeaderSid,
            createDto.CompanyMasterSid,
            detail,
            sno++,
            voucherDate,
            voucherNumber,
            createDto.CreatedBy || 'system',
            prisma,
          );
        }

        // 7. Create TDS entries if applicable
        const tdsResponses: PaymentTDSResponseDto[] = [];
        if (createDto.TDSDetails && createDto.TDSDetails.length > 0) {
          for (const tds of createDto.TDSDetails) {
            const tdsResponse = await this.createTDSEntry(
              voucherHeader.VoucherHeaderSid,
              createDto.CompanyMasterSid,
              createDto.BranchMasterSid,
              tds,
              sno++,
              voucherDate,
              voucherNumber,
              createDto.VendorLedgerMasterSid,
              createDto.CreatedBy || 'system',
              prisma,
            );
            tdsResponses.push(tdsResponse);
          }
        }

        // 8. Create Bank/Cash entry (Credit side)
        await this.createBankEntry(
          voucherHeader.VoucherHeaderSid,
          createDto.CompanyMasterSid,
          createDto.BranchMasterSid,
          createDto.BankLedgerMasterSid,
          createDto.CurrencyMasterSid,
          createDto.ExchangeRate,
          totalPaymentAmount,
          sno++,
          voucherDate,
          voucherNumber,
          createDto.Narration || 'Payment',
          createDto.CreatedBy || 'system',
          prisma,
        );

        // 9. Create voucher matching records for invoice payments
        const matchedInvoices = await this.createVoucherMatchings(
          createDto,
          voucherHeader.VoucherHeaderSid,
          voucherDate,
          prisma,
        );

        // 10. Create inter-branch JVs if applicable
        const interBranchJVs: InterBranchJVDto[] = [];
        if (createDto.IsMultiBranch && createDto.InterBranch && createDto.InterBranch.length > 0) {
          for (const interBranch of createDto.InterBranch) {
            const jv = await this.createInterBranchJV(
              createDto.CompanyMasterSid,
              createDto.BranchMasterSid,
              interBranch.BranchMasterSid,
              interBranch.CurrencyAmount,
              voucherDate,
              `Inter-branch transfer for payment ${voucherNumber}`,
              createDto.CreatedBy || 'system',
              prisma,
            );
            interBranchJVs.push(jv);
          }
        }

        // 11. Check for exchange gain/loss and create JV if needed
        let exchangeJV: ExchangeJVDto | undefined;
        if (createDto.CurrencyMasterSid !== 1) {
          // Only for foreign currency
          exchangeJV = await this.createExchangeGainLossJV(
            voucherHeader.VoucherHeaderSid,
            createDto.CompanyMasterSid,
            createDto.BranchMasterSid,
            createDto.VendorLedgerMasterSid,
            voucherDate,
            voucherNumber,
            createDto.CreatedBy || 'system',
            prisma,
          );
        }

        // 12. Return response
        return {
          VoucherHeaderSid: voucherHeader.VoucherHeaderSid,
          VoucherNumber: voucherNumber,
          VoucherDate: createDto.VoucherDate,
          CompanyMasterSid: createDto.CompanyMasterSid,
          BranchMasterSid: createDto.BranchMasterSid,
          VendorLedgerMasterSid: createDto.VendorLedgerMasterSid,
          VendorName: vendor?.SubledgerName,
          TotalAmount: totalPaymentAmount,
          TDSAmount: totalTDSAmount,
          NetAmount: totalPaymentAmount - totalTDSAmount,
          PaymentMode: createDto.PaymentMode,
          MatchedInvoices: matchedInvoices,
          TDSDetails: tdsResponses,
          InterBranchJVs: interBranchJVs,
          ExchangeJV: exchangeJV,
          CreatedAt: voucherHeader.CreatedOn,
          Status: voucherHeader.Status,
        };
      });
    } catch (error) {
      this.logger.error(`Failed to create payment: ${error.message}`, error.stack);
      throw new BadRequestException(`Failed to create payment: ${error.message}`);
    }
  }

  /**
   * Create detail entry (expense/ledger allocation)
   */
  private async createDetailEntry(
    voucherHeaderSid: number,
    companySid: number,
    detail: PaymentDetailDto,
    sno: number,
    voucherDate: Date,
    voucherNumber: string,
    createdBy: string,
    prisma: any,
  ) {
    const voucherDetail = await prisma.voucherDetail.create({
      data: {
        VoucherHeaderSid: voucherHeaderSid,
        CompanyMasterSid: companySid,
        BranchMasterSid: detail.BranchMasterSid,
        Sno: sno,
        COAMasterSid: 0, // Will be set via LedgerMasterSid
        LedgerMasterSid: detail.LedgerMasterSid,
        CurrencyMasterSid: detail.CurrencyMasterSid,
        CurrencyCode: 'INR', // TODO: Fetch from currency master
        ExchangeRate: detail.ExchangeRate,
        Rate: 1,
        TaxableAmount: detail.TaxableAmount,
        DrCr: detail.DrCr,
        Amount: detail.LocalAmount,
        LocalAmount: detail.LocalAmount,
        Narration: detail.Narration || '',
        Status: 'A',
        CreatedBy: createdBy,
        UpdatedBy: createdBy,
      },
    });

    await prisma.voucherTransaction.create({
      data: {
        VoucherHeaderSid: voucherHeaderSid,
        VoucherDetailSid: voucherDetail.VoucherDetailSid,
        CompanyMasterSid: companySid,
        BranchMasterSid: detail.BranchMasterSid,
        VoucherType: this.PAYMENT_VOUCHER_TYPE,
        VoucherDate: voucherDate,
        PostDate: voucherDate,
        VoucherNumber: voucherNumber,
        Sno: sno,
        COAMasterSid: 0,
        LedgerMasterSid: detail.LedgerMasterSid,
        CurrencyCode: 'INR',
        ExchangeRate: detail.ExchangeRate,
        DrCr: detail.DrCr,
        Amount: detail.LocalAmount,
        LocalAmount: detail.LocalAmount,
        GST_VAT: '',
        ChargeDescription: detail.Narration || 'Payment',
        DepartmentMasterSid: 1,
        HouseJobSid: detail.HouseJobSid || 1,
        MasterJobSid: detail.MasterJobSid || 1,
        CostRevenue: 'C', // Cost
        Rate: 1,
        NumberOfUnit: 1,
        TaxableAmount: detail.TaxableAmount,
        TransType: 'P', // Payment
        VoucherTypeMasterSid: 1,
        Narration: detail.Narration || '',
        Status: 'A',
        CreatedBy: createdBy,
        UpdatedBy: createdBy,
      },
    });
  }

  /**
   * Create TDS entry
   * Creates separate Dr entry for TDS Payable ledger
   */
  private async createTDSEntry(
    voucherHeaderSid: number,
    companySid: number,
    branchSid: number,
    tds: PaymentTDSDto,
    sno: number,
    voucherDate: Date,
    voucherNumber: string,
    vendorLedgerMasterSid: number | undefined,
    createdBy: string,
    prisma: any,
  ): Promise<PaymentTDSResponseDto> {
    // Get TDS Payable ledger
    const tdsLedger = await this.getTDSPayableLedger(companySid, tds.ITSectionCode, prisma);

    // Create VoucherDetail for TDS
    const voucherDetail = await prisma.voucherDetail.create({
      data: {
        VoucherHeaderSid: voucherHeaderSid,
        CompanyMasterSid: companySid,
        BranchMasterSid: branchSid,
        Sno: sno,
        COAMasterSid: tdsLedger.COAMasterSid,
        LedgerMasterSid: tdsLedger.SubledgerMasterSid,
        CurrencyMasterSid: 1,
        CurrencyCode: 'INR',
        ExchangeRate: 1,
        Rate: 1,
        TaxableAmount: tds.TaxableAmount,
        DrCr: 'D', // Debit TDS Payable
        Amount: tds.TDSAmount,
        LocalAmount: tds.TDSAmount,
        Narration: `TDS ${tds.ITSectionCode} @ ${tds.TDSPercentage}%`,
        Status: 'A',
        CreatedBy: createdBy,
        UpdatedBy: createdBy,
      },
    });

    // Create VoucherTransaction for TDS
    await prisma.voucherTransaction.create({
      data: {
        VoucherHeaderSid: voucherHeaderSid,
        VoucherDetailSid: voucherDetail.VoucherDetailSid,
        CompanyMasterSid: companySid,
        BranchMasterSid: branchSid,
        VoucherType: this.PAYMENT_VOUCHER_TYPE,
        VoucherDate: voucherDate,
        PostDate: voucherDate,
        VoucherNumber: voucherNumber,
        Sno: sno,
        COAMasterSid: tdsLedger.COAMasterSid,
        LedgerMasterSid: vendorLedgerMasterSid || tdsLedger.SubledgerMasterSid,
        CurrencyCode: 'INR',
        ExchangeRate: 1,
        DrCr: 'D',
        Amount: tds.TDSAmount,
        LocalAmount: tds.TDSAmount,
        GST_VAT: '',
        ChargeDescription: `TDS ${tds.ITSectionCode}`,
        DepartmentMasterSid: 1,
        HouseJobSid: 1,
        MasterJobSid: 1,
        CostRevenue: 'C',
        Rate: 1,
        NumberOfUnit: 1,
        TaxableAmount: tds.TaxableAmount,
        TransType: 'P',
        VoucherTypeMasterSid: 1,
        Narration: `TDS ${tds.ITSectionCode} @ ${tds.TDSPercentage}%`,
        Status: 'A',
        CreatedBy: createdBy,
        UpdatedBy: createdBy,
      },
    });

    // Create VoucherTDS record for reporting
    const voucherTDS = await prisma.voucherTDS.create({
      data: {
        VoucherHeaderSid: voucherHeaderSid,
        VoucherDetailSid: voucherDetail.VoucherDetailSid,
        TDSSetRateSid: tds.TDSSetRateSid,
        ITSectionCode: tds.ITSectionCode,
        TDSRate: tds.TDSPercentage,
        TaxableAmount: tds.TaxableAmount,
        TDSAmount: tds.TDSAmount,
        Reason: tds.Reason || null,
        Status: 'A',
        CreatedBy: createdBy,
        UpdatedBy: createdBy,
      },
    });

    return {
      VoucherTDSSid: voucherTDS.VoucherTDSSid,
      ITSectionCode: tds.ITSectionCode,
      TDSPercentage: tds.TDSPercentage,
      TaxableAmount: tds.TaxableAmount,
      TDSAmount: tds.TDSAmount,
      CertificateNumber: tds.CertificateNumber,
    };
  }

  /**
   * Create bank/cash entry (Credit side)
   */
  private async createBankEntry(
    voucherHeaderSid: number,
    companySid: number,
    branchSid: number,
    bankLedgerMasterSid: number,
    currencyMasterSid: number,
    exchangeRate: number,
    amount: number,
    sno: number,
    voucherDate: Date,
    voucherNumber: string,
    narration: string,
    createdBy: string,
    prisma: any,
  ) {
    const voucherDetail = await prisma.voucherDetail.create({
      data: {
        VoucherHeaderSid: voucherHeaderSid,
        CompanyMasterSid: companySid,
        BranchMasterSid: branchSid,
        Sno: sno,
        COAMasterSid: 0, // Will be set via LedgerMasterSid
        LedgerMasterSid: bankLedgerMasterSid,
        CurrencyMasterSid: currencyMasterSid,
        CurrencyCode: 'INR', // TODO: Fetch from currency master
        ExchangeRate: exchangeRate,
        Rate: 1,
        TaxableAmount: 0,
        DrCr: 'C', // Credit Bank
        Amount: amount,
        LocalAmount: amount,
        Narration: narration,
        Status: 'A',
        CreatedBy: createdBy,
        UpdatedBy: createdBy,
      },
    });

    await prisma.voucherTransaction.create({
      data: {
        VoucherHeaderSid: voucherHeaderSid,
        VoucherDetailSid: voucherDetail.VoucherDetailSid,
        CompanyMasterSid: companySid,
        BranchMasterSid: branchSid,
        VoucherType: this.PAYMENT_VOUCHER_TYPE,
        VoucherDate: voucherDate,
        PostDate: voucherDate,
        VoucherNumber: voucherNumber,
        Sno: sno,
        COAMasterSid: 0,
        LedgerMasterSid: bankLedgerMasterSid,
        CurrencyCode: 'INR',
        ExchangeRate: exchangeRate,
        DrCr: 'C',
        Amount: amount,
        LocalAmount: amount,
        GST_VAT: '',
        ChargeDescription: 'Payment',
        DepartmentMasterSid: 1,
        HouseJobSid: 1,
        MasterJobSid: 1,
        CostRevenue: 'C',
        Rate: 1,
        NumberOfUnit: 1,
        TaxableAmount: 0,
        TransType: 'P',
        VoucherTypeMasterSid: 1,
        Narration: narration,
        Status: 'A',
        CreatedBy: createdBy,
        UpdatedBy: createdBy,
      },
    });
  }

  /**
   * Create voucher matching records for invoice payments
   */
  private async createVoucherMatchings(
    createDto: CreatePaymentDto,
    voucherHeaderSid: number,
    voucherDate: Date,
    prisma: any,
  ): Promise<MatchedInvoiceDto[]> {
    const matchedInvoices: MatchedInvoiceDto[] = [];

    if (!createDto.VoucherMatchings || createDto.VoucherMatchings.length === 0) {
      return matchedInvoices;
    }

    for (const matching of createDto.VoucherMatchings) {
      // Get invoice transaction
      const invoiceTransaction = await prisma.voucherTransaction.findUnique({
        where: { VoucherTransactionSid: matching.VoucherTransactionSid },
        include: { VoucherHeader: true },
      });

      if (!invoiceTransaction) {
        throw new NotFoundException(`Invoice transaction ${matching.VoucherTransactionSid} not found`);
      }

      // Create matching record
      await prisma.voucherMatching.create({
        data: {
          CompanyMasterSid: createDto.CompanyMasterSid,
          BranchMasterSid: createDto.BranchMasterSid,
          VoucherMatchingHeaderSid: 1,
          VoucherHeaderSid: voucherHeaderSid,
          VoucherDetailSid: 1,
          VoucherTransactionSid: matching.VoucherTransactionSid,
          VoucherMatchingDate: voucherDate,
          VoucherType: this.PAYMENT_VOUCHER_TYPE,
          Sno: 1,
          COAMasterSid: invoiceTransaction.COAMasterSid,
          CurrencyCode: invoiceTransaction.CurrencyCode || 'INR',
          ExchangeRate: Number(invoiceTransaction.ExchangeRate || 1),
          DrCr: invoiceTransaction.DrCr,
          Amount: matching.LocalAmount,
          LocalAmount: matching.LocalAmount,
          MatchingType: 'Payment',
          Status: 'A',
          CreatedBy: createDto.CreatedBy || 'system',
          UpdatedBy: createDto.CreatedBy || 'system',
        },
      });

      matchedInvoices.push({
        VoucherTransactionSid: matching.VoucherTransactionSid,
        InvoiceNumber: invoiceTransaction.VoucherHeader.VoucherNumber,
        InvoiceDate: invoiceTransaction.VoucherDate.toISOString(),
        OriginalAmount: Number(invoiceTransaction.Amount),
        PreviouslyMatched: 0,
        MatchedAmount: matching.LocalAmount,
        TDSAmount: matching.TDSAmount,
        OutstandingAmount: Number(invoiceTransaction.Amount) - matching.LocalAmount,
      });
    }

    return matchedInvoices;
  }

  /**
   * Create automatic inter-branch journal voucher
   */
  private async createInterBranchJV(
    companySid: number,
    payingBranchSid: number,
    receivingBranchSid: number,
    amount: number,
    date: Date,
    narration: string,
    createdBy: string,
    prisma: any,
  ): Promise<InterBranchJVDto> {
    this.logger.log(`Creating inter-branch JV: ${payingBranchSid} -> ${receivingBranchSid} for ${amount}`);

    // Generate JV number
    const jvNumber = await this.generateJVNumber(companySid, payingBranchSid, date, prisma);

    // Get inter-branch COA accounts
    const payingBranchCOA = await this.getInterBranchCOA(companySid, 'Receivable', prisma);
    const receivingBranchCOA = await this.getInterBranchCOA(companySid, 'Payable', prisma);

    // Create JV Header
    const jvHeader = await prisma.voucherHeader.create({
      data: {
        CompanyMasterSid: companySid,
        BranchMasterSid: payingBranchSid,
        VoucherNumber: jvNumber,
        VoucherDate: date,
        PostDate: date,
        VoucherType: this.JOURNAL_VOUCHER_TYPE,
        PartyMasterSid: 0,
        PartyName: 'Inter Branch',
        COAMasterSid: 0,
        VoucherTypeMasterSid: 1,
        Narration: narration,
        SetoffStatus: 'Posted',
        Status: 'A',
        CreatedBy: createdBy,
        UpdatedBy: createdBy,
      },
    });

    // Dr: Inter Branch Receivable (paying branch expecting money back)
    await this.createJVEntry(
      jvHeader.VoucherHeaderSid,
      companySid,
      payingBranchSid,
      1,
      payingBranchCOA.COAMasterSid,
      null,
      'D',
      amount,
      `Transfer to ${receivingBranchSid}`,
      date,
      jvNumber,
      createdBy,
      prisma,
    );

    // Cr: Inter Branch Payable (paying branch sent money)
    await this.createJVEntry(
      jvHeader.VoucherHeaderSid,
      companySid,
      payingBranchSid,
      2,
      receivingBranchCOA.COAMasterSid,
      null,
      'C',
      amount,
      `Transfer from ${payingBranchSid}`,
      date,
      jvNumber,
      createdBy,
      prisma,
    );

    return {
      JVHeaderSid: jvHeader.VoucherHeaderSid,
      JVNumber: jvNumber,
      PayingBranchSid: payingBranchSid,
      ReceivingBranchSid: receivingBranchSid,
      Amount: amount,
      CreatedAt: jvHeader.CreatedOn,
    };
  }

  /**
   * Create automatic exchange gain/loss JV
   * Called when Dr and Cr local amounts don't match due to currency conversion
   */
  private async createExchangeGainLossJV(
    voucherHeaderSid: number,
    companySid: number,
    branchSid: number,
    vendorLedgerMasterSid: number | undefined,
    date: Date,
    paymentVoucherNumber: string,
    createdBy: string,
    prisma: any,
  ): Promise<ExchangeJVDto | undefined> {
    // Calculate Dr and Cr totals from VoucherDetail
    const voucherDetails = await prisma.voucherDetail.findMany({
      where: {
        VoucherHeaderSid: voucherHeaderSid,
        Status: 'A',
      },
    });

    const totalDr = voucherDetails
      .filter((d: any) => d.DrCr === 'D')
      .reduce((sum: number, d: any) => sum + Number(d.LocalAmount), 0);

    const totalCr = voucherDetails
      .filter((d: any) => d.DrCr === 'C')
      .reduce((sum: number, d: any) => sum + Number(d.LocalAmount), 0);

    const difference = Math.abs(totalDr - totalCr);

    // If difference is within tolerance, no need for exchange JV
    if (difference < this.EXCHANGE_DIFF_TOLERANCE) {
      return undefined;
    }

    this.logger.log(`Creating exchange JV for difference: ${difference}, Dr: ${totalDr}, Cr: ${totalCr}`);

    const isGain = totalCr > totalDr; // If Cr > Dr, it's a gain

    // Generate exchange JV number
    const jvNumber = await this.generateExchangeJVNumber(companySid, branchSid, date, prisma);

    // Get exchange gain/loss account
    const exchangeAccount = await this.getExchangeGainLossAccount(companySid, prisma);

    // Create JV Header
    const jvHeader = await prisma.voucherHeader.create({
      data: {
        CompanyMasterSid: companySid,
        BranchMasterSid: branchSid,
        VoucherNumber: jvNumber,
        VoucherDate: date,
        PostDate: date,
        VoucherType: this.JOURNAL_VOUCHER_TYPE,
        PartyMasterSid: vendorLedgerMasterSid || 0,
        PartyName: 'Exchange Adjustment',
        COAMasterSid: exchangeAccount.COAMasterSid,
        VoucherTypeMasterSid: 1,
        Narration: `Exchange ${isGain ? 'Gain' : 'Loss'} adjustment for payment ${paymentVoucherNumber}`,
        SetoffStatus: 'Posted',
        Status: 'A',
        CreatedBy: createdBy,
        UpdatedBy: createdBy,
      },
    });

    if (isGain) {
      // Cr > Dr: Exchange Gain
      // Dr: Vendor Account
      // Cr: Exchange Gain Account
      const vendorCOA = await this.getVendorCOA(companySid, prisma);

      await this.createJVEntry(
        jvHeader.VoucherHeaderSid,
        companySid,
        branchSid,
        1,
        vendorCOA.COAMasterSid,
        vendorLedgerMasterSid || null,
        'D',
        difference,
        'Exchange Gain adjustment',
        date,
        jvNumber,
        createdBy,
        prisma,
      );

      await this.createJVEntry(
        jvHeader.VoucherHeaderSid,
        companySid,
        branchSid,
        2,
        exchangeAccount.COAMasterSid,
        null,
        'C',
        difference,
        'Exchange Gain',
        date,
        jvNumber,
        createdBy,
        prisma,
      );
    } else {
      // Dr > Cr: Exchange Loss
      // Dr: Exchange Loss Account
      // Cr: Vendor Account
      const vendorCOA = await this.getVendorCOA(companySid, prisma);

      await this.createJVEntry(
        jvHeader.VoucherHeaderSid,
        companySid,
        branchSid,
        1,
        exchangeAccount.COAMasterSid,
        null,
        'D',
        difference,
        'Exchange Loss',
        date,
        jvNumber,
        createdBy,
        prisma,
      );

      await this.createJVEntry(
        jvHeader.VoucherHeaderSid,
        companySid,
        branchSid,
        2,
        vendorCOA.COAMasterSid,
        vendorLedgerMasterSid || null,
        'C',
        difference,
        'Exchange Loss adjustment',
        date,
        jvNumber,
        createdBy,
        prisma,
      );
    }

    return {
      JVHeaderSid: jvHeader.VoucherHeaderSid,
      JVNumber: jvNumber,
      ExchangeDifference: difference,
      IsGain: isGain,
      CreatedAt: jvHeader.CreatedOn,
    };
  }

  /**
   * Helper: Create JV entry (detail + transaction)
   */
  private async createJVEntry(
    headerSid: number,
    companySid: number,
    branchSid: number,
    sno: number,
    coaSid: number,
    ledgerSid: number | null,
    drCr: string,
    amount: number,
    narration: string,
    date: Date,
    voucherNumber: string,
    createdBy: string,
    prisma: any,
  ) {
    const detail = await prisma.voucherDetail.create({
      data: {
        VoucherHeaderSid: headerSid,
        CompanyMasterSid: companySid,
        BranchMasterSid: branchSid,
        Sno: sno,
        COAMasterSid: coaSid,
        LedgerMasterSid: ledgerSid,
        CurrencyMasterSid: 1,
        CurrencyCode: 'INR',
        ExchangeRate: 1,
        Rate: 1,
        TaxableAmount: 0,
        DrCr: drCr,
        Amount: amount,
        LocalAmount: amount,
        Narration: narration,
        Status: 'A',
        CreatedBy: createdBy,
        UpdatedBy: createdBy,
      },
    });

    await prisma.voucherTransaction.create({
      data: {
        VoucherHeaderSid: headerSid,
        VoucherDetailSid: detail.VoucherDetailSid,
        CompanyMasterSid: companySid,
        BranchMasterSid: branchSid,
        VoucherType: this.JOURNAL_VOUCHER_TYPE,
        VoucherDate: date,
        PostDate: date,
        VoucherNumber: voucherNumber,
        Sno: sno,
        COAMasterSid: coaSid,
        LedgerMasterSid: ledgerSid,
        CurrencyCode: 'INR',
        ExchangeRate: 1,
        DrCr: drCr,
        Amount: amount,
        LocalAmount: amount,
        GST_VAT: '',
        ChargeDescription: narration,
        DepartmentMasterSid: 1,
        HouseJobSid: 1,
        MasterJobSid: 1,
        CostRevenue: 'C',
        Rate: 1,
        NumberOfUnit: 1,
        TaxableAmount: 0,
        TransType: 'J', // Journal
        VoucherTypeMasterSid: 1,
        Narration: narration,
        Status: 'A',
        CreatedBy: createdBy,
        UpdatedBy: createdBy,
      },
    });
  }

  /**
   * Generate payment voucher number
   */
  private async generatePaymentNumber(
    companySid: number,
    branchSid: number,
    date: Date,
    paymentMode: string,
    prisma: any,
  ): Promise<string> {
    const yearSuffix = date.getFullYear().toString().slice(-2);
    const monthPrefix = (date.getMonth() + 1).toString().padStart(2, '0');
    const prefix = paymentMode.toLowerCase().includes('cash') ? 'CP' : 'BP'; // CP = Cash Payment, BP = Bank Payment

    const lastPayment = await prisma.voucherHeader.findFirst({
      where: {
        CompanyMasterSid: companySid,
        BranchMasterSid: branchSid,
        VoucherType: this.PAYMENT_VOUCHER_TYPE,
        VoucherNumber: { startsWith: `${prefix}${yearSuffix}${monthPrefix}` },
      },
      orderBy: { VoucherNumber: 'desc' },
    });

    const nextNumber = lastPayment ? parseInt(lastPayment.VoucherNumber.slice(-4)) + 1 : 1;

    return `${prefix}${yearSuffix}${monthPrefix}${nextNumber.toString().padStart(4, '0')}`;
  }

  /**
   * Generate JV number
   */
  private async generateJVNumber(companySid: number, branchSid: number, date: Date, prisma: any): Promise<string> {
    const yearSuffix = date.getFullYear().toString().slice(-2);
    const monthPrefix = (date.getMonth() + 1).toString().padStart(2, '0');

    const lastJV = await prisma.voucherHeader.findFirst({
      where: {
        CompanyMasterSid: companySid,
        BranchMasterSid: branchSid,
        VoucherType: this.JOURNAL_VOUCHER_TYPE,
        VoucherNumber: { startsWith: `JV${yearSuffix}${monthPrefix}` },
      },
      orderBy: { VoucherNumber: 'desc' },
    });

    const nextNumber = lastJV ? parseInt(lastJV.VoucherNumber.slice(-4)) + 1 : 1;

    return `JV${yearSuffix}${monthPrefix}${nextNumber.toString().padStart(4, '0')}`;
  }

  /**
   * Generate Exchange JV number
   */
  private async generateExchangeJVNumber(
    companySid: number,
    branchSid: number,
    date: Date,
    prisma: any,
  ): Promise<string> {
    const yearSuffix = date.getFullYear().toString().slice(-2);
    const monthPrefix = (date.getMonth() + 1).toString().padStart(2, '0');

    const lastJV = await prisma.voucherHeader.findFirst({
      where: {
        CompanyMasterSid: companySid,
        BranchMasterSid: branchSid,
        VoucherType: this.JOURNAL_VOUCHER_TYPE,
        VoucherNumber: { startsWith: `EX${yearSuffix}${monthPrefix}` },
      },
      orderBy: { VoucherNumber: 'desc' },
    });

    const nextNumber = lastJV ? parseInt(lastJV.VoucherNumber.slice(-4)) + 1 : 1;

    return `EX${yearSuffix}${monthPrefix}${nextNumber.toString().padStart(4, '0')}`;
  }

  /**
   * Get vendor creditors account
   */
  private async getVendorCOA(companySid: number, prisma: any) {
    const account = await prisma.cOAMaster.findFirst({
      where: {
        CompanyMasterSid: companySid,
        LedgerName: { contains: 'Sundry Creditors', mode: 'insensitive' },
        Status: 'A',
      },
    });

    if (!account) {
      throw new BadRequestException('Vendor creditors account not found in COA');
    }

    return account;
  }

  /**
   * Get TDS Payable ledger by section code
   */
  private async getTDSPayableLedger(companySid: number, itSectionCode: string, prisma: any) {
    const account = await prisma.subledgerMaster.findFirst({
      where: {
        CompanyMasterSid: companySid,
        SubledgerName: { contains: `TDS ${itSectionCode}`, mode: 'insensitive' },
        Status: 'A',
      },
    });

    if (!account) {
      // Fallback to generic TDS Payable
      const genericTDS = await prisma.subledgerMaster.findFirst({
        where: {
          CompanyMasterSid: companySid,
          SubledgerName: { contains: 'TDS Payable', mode: 'insensitive' },
          Status: 'A',
        },
      });

      if (!genericTDS) {
        throw new BadRequestException('TDS Payable account not found in ledger master');
      }

      return genericTDS;
    }

    return account;
  }

  /**
   * Get inter-branch COA account
   */
  private async getInterBranchCOA(companySid: number, type: 'Payable' | 'Receivable', prisma: any) {
    const searchTerm = type === 'Payable' ? 'Inter Branch Payable' : 'Inter Branch Receivable';

    const account = await prisma.cOAMaster.findFirst({
      where: {
        CompanyMasterSid: companySid,
        LedgerName: { contains: searchTerm, mode: 'insensitive' },
        Status: 'A',
      },
    });

    if (!account) {
      throw new BadRequestException(`${searchTerm} account not found in COA`);
    }

    return account;
  }

  /**
   * Get exchange gain/loss account
   */
  private async getExchangeGainLossAccount(companySid: number, prisma: any) {
    const account = await prisma.cOAMaster.findFirst({
      where: {
        CompanyMasterSid: companySid,
        LedgerName: { contains: 'Exchange', mode: 'insensitive' },
        Status: 'A',
      },
    });

    if (!account) {
      throw new BadRequestException('Exchange Gain/Loss account not found in COA');
    }

    return account;
  }

  /**
   * Get payment by ID
   */
  async getPaymentById(voucherHeaderSid: number): Promise<any> {
    const payment = await this._db.voucherHeader.findUnique({
      where: { VoucherHeaderSid: voucherHeaderSid },
      include: {
        VoucherDetail: {
          include: { coaMaster: true, subledgerMaster: true },
        },
        VoucherTransaction: true,
        voucherMatchings: true,
        CompanyMaster: true,
        BranchMaster: true,
      },
    });

    if (!payment) {
      throw new NotFoundException(`Payment ${voucherHeaderSid} not found`);
    }

    return payment;
  }

  /**
   * Get payments with filters
   */
  async getPayments(filterDto: PaymentFilterDto): Promise<any[]> {
    const where: Prisma.VoucherHeaderWhereInput = {
      VoucherType: this.PAYMENT_VOUCHER_TYPE,
      Status: 'A',
    };

    if (filterDto.CompanyMasterSid) {
      where.CompanyMasterSid = filterDto.CompanyMasterSid;
    }

    if (filterDto.BranchMasterSid) {
      where.BranchMasterSid = filterDto.BranchMasterSid;
    }

    if (filterDto.VoucherNumber) {
      where.VoucherNumber = { contains: filterDto.VoucherNumber, mode: 'insensitive' };
    }

    if (filterDto.DateFrom || filterDto.DateTo) {
      where.VoucherDate = {};
      if (filterDto.DateFrom) {
        where.VoucherDate.gte = new Date(filterDto.DateFrom);
      }
      if (filterDto.DateTo) {
        where.VoucherDate.lte = new Date(filterDto.DateTo);
      }
    }

    return await this._db.voucherHeader.findMany({
      where,
      include: {
        VoucherDetail: true,
        VoucherTransaction: true,
        CompanyMaster: true,
        BranchMaster: true,
      },
      orderBy: { VoucherDate: 'desc' },
      take: filterDto.Limit || 100,
      skip: filterDto.Offset || 0,
    });
  }
}
