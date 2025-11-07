import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { DatabaseService } from 'src/database/database.service';
import { OutstandingService } from '../outstanding/outstanding.service';
import {
  CreateReceiptDto,
  ReceiptResponseDto,
  SearchOutstandingDto,
  OutstandingInvoiceDto,
  VoucherMatchingDto,
  InterBranchJVDto,
  ReceiptFilterDto,
  UpdateReceiptDto,
  ReverseReceiptDto,
  MatchedInvoiceDto,
} from '../../dto/receipt.dto';
import { Prisma } from '@prisma/client';

/**
 * Receipt Voucher Service
 * Handles receipt creation with:
 * - Invoice matching (reuses OutstandingService)
 * - Advance receipts
 * - Multi-currency support
 * - TDS deduction
 * - Automatic inter-branch JV creation
 */
@Injectable()
export class ReceiptService {
  private readonly logger = new Logger(ReceiptService.name);
  private readonly RECEIPT_VOUCHER_TYPE = 2; // Receipt voucher type
  private readonly JOURNAL_VOUCHER_TYPE = 4; // Journal voucher type

  constructor(
    private readonly _db: DatabaseService,
    private readonly outstandingService: OutstandingService, // REUSE existing service
  ) {}

  /**
   * Search outstanding invoices using existing OutstandingService
   * REUSES the existing service as per user requirement
   */
  async searchOutstandingInvoices(searchDto: SearchOutstandingDto): Promise<OutstandingInvoiceDto[]> {
    this.logger.log(`Searching outstanding invoices with criteria: ${JSON.stringify(searchDto)}`);

    try {
      // If searching by customer (most common case)
      if (searchDto.LedgerMasterSid) {
        const customerOutstanding = await this.outstandingService.getCustomerOutstanding(
          searchDto.CompanyMasterSid,
          searchDto.LedgerMasterSid,
        );

        // Convert to OutstandingInvoiceDto format
        const invoices: OutstandingInvoiceDto[] = customerOutstanding.transactions.map((txn) => ({
          VoucherTransactionSid: txn.voucherTransactionSid,
          VoucherHeaderSid: 0, // Will be populated from join
          VoucherNumber: txn.voucherNumber,
          VoucherDate: typeof txn.voucherDate === 'string' ? txn.voucherDate : txn.voucherDate.toISOString(),
          VoucherType: txn.voucherType,
          LedgerMasterSid: customerOutstanding.ledgerMasterSid,
          CustomerName: customerOutstanding.customerName || '',
          OriginalAmount: txn.originalLocalAmount,
          OriginalCurrencyAmount: txn.originalCurrencyAmount,
          MatchedAmount: txn.matchedLocalAmount,
          MatchedCurrencyAmount: txn.matchedCurrencyAmount,
          OutstandingAmount: txn.outstandingLocalAmount,
          OutstandingCurrencyAmount: txn.outstandingCurrencyAmount,
          CurrencyCode: txn.currencyCode,
          DrCr: txn.drCr,
          ChargeDescription: txn.chargeDescription,
        }));

        // Filter out fully paid if requested
        if (!searchDto.IncludeFullyPaid) {
          return invoices.filter((inv) => Math.abs(inv.OutstandingAmount) > 0);  // No tolerance
        }

        return invoices;
      }

      // Advanced search by invoice number, house number, etc.
      return await this.advancedSearchOutstanding(searchDto);
    } catch (error) {
      this.logger.error(`Failed to search outstanding invoices: ${error.message}`, error.stack);
      throw new BadRequestException(`Failed to search outstanding invoices: ${error.message}`);
    }
  }

  /**
   * Advanced search for outstanding invoices by various criteria
   */
  private async advancedSearchOutstanding(searchDto: SearchOutstandingDto): Promise<OutstandingInvoiceDto[]> {
    const whereConditions: Prisma.VoucherTransactionWhereInput = {
      CompanyMasterSid: searchDto.CompanyMasterSid,
      Status: 'A',
      VoucherHeader: {
        ReversalVoucher: null,
      },
    };

    // Build dynamic where clause based on search criteria
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
      take: 100, // Limit results
    });

    // Calculate outstanding for each transaction
    const results: OutstandingInvoiceDto[] = [];

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
        CustomerName: txn.subledgerMaster?.SubledgerName || '',
        OriginalAmount: Number(txn.Amount),
        OriginalCurrencyAmount: Number(txn.Amount),
        MatchedAmount: matchedAmount,
        MatchedCurrencyAmount: 0, // Would need to sum currency amounts
        OutstandingAmount: outstandingAmount,
        OutstandingCurrencyAmount: Number(txn.Amount) - matchedAmount,
        CurrencyCode: txn.CurrencyCode || 'INR',
        DrCr: txn.DrCr,
      });
    }

    return results;
  }

  /**
   * Create receipt voucher with all features
   */
  async createReceipt(createDto: CreateReceiptDto): Promise<ReceiptResponseDto> {
    this.logger.log(`Creating receipt for customer ${createDto.LedgerMasterSid}`);

    try {
      return await this._db.$transaction(async (prisma) => {
        // 1. Generate voucher number
        const voucherNumber = await this.generateReceiptNumber(
          createDto.CompanyMasterSid,
          createDto.BranchMasterSid,
          new Date(createDto.VoucherDate),
          prisma,
        );

        // 2. Get current year
        const currentYear = await prisma.yearMaster.findFirst({
          where: {
            CompanyMasterSid: createDto.CompanyMasterSid,
            CurrentYear: 'Y',
          },
        });

        if (!currentYear) {
          throw new BadRequestException('Current fiscal year not found');
        }

        // 3. Validate date is within fiscal year
        const voucherDate = new Date(createDto.VoucherDate);
        const startDate = new Date(currentYear.StartDate);
        const endDate = new Date(currentYear.EndDate);

        if (voucherDate < startDate || voucherDate > endDate) {
          throw new BadRequestException(
            `Voucher date must be within fiscal year ${startDate.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]}`,
          );
        }

        // 4. Get cash/bank account (Dr side)
        const cashBankAccount = await this.getCashBankAccount(createDto.PaymentMode, createDto.CompanyMasterSid, prisma);

        // 5. Get customer details for voucher header
        const customer = await prisma.subledgerMaster.findUnique({
          where: { SubledgerMasterSid: createDto.LedgerMasterSid },
        });

        // 5. Create VoucherHeader with all required fields
        const voucherHeader = await prisma.voucherHeader.create({
          data: {
            CompanyMasterSid: createDto.CompanyMasterSid,
            BranchMasterSid: createDto.BranchMasterSid,
            VoucherNumber: voucherNumber,
            VoucherDate: voucherDate,
            PostDate: voucherDate, // Required
            VoucherType: this.RECEIPT_VOUCHER_TYPE,
            PartyMasterSid: createDto.LedgerMasterSid, // Required
            PartyName: customer?.SubledgerName || 'Customer', // Required
            COAMasterSid: (await this.getCustomerCOA(createDto.CompanyMasterSid, prisma)).COAMasterSid, // Required
            VoucherTypeMasterSid: 1, // Required - Receipt voucher type master
            Narration: createDto.Narration || `Receipt from customer ${createDto.LedgerMasterSid}`,
            SetoffStatus: 'Posted',
            InstrumentMode: createDto.PaymentMode,
            InstrumentNumber: createDto.ChequeNumber || null,
            InstrumentDate: createDto.ChequeDate ? new Date(createDto.ChequeDate) : null,
            Status: 'A',
            CreatedBy: createDto.CreatedBy || 'system',
            UpdatedBy: createDto.CreatedBy || 'system',
          },
        });

        // 6. Calculate amounts
        const netReceiptAmount = createDto.TotalAmount - (createDto.TDSAmount || 0);
        const currencyAmount = createDto.CurrencyAmount || createDto.TotalAmount;
        const exchangeRate = createDto.ExchangeRate || 1;

        // 7. Create VoucherDetail and VoucherTransaction records
        const transactions: any[] = [];
        let sno = 1;

        // Dr: Cash/Bank Account (net receipt amount)
        const drDetail = await prisma.voucherDetail.create({
          data: {
            VoucherHeaderSid: voucherHeader.VoucherHeaderSid,
            CompanyMasterSid: createDto.CompanyMasterSid,
            BranchMasterSid: createDto.BranchMasterSid,
            Sno: sno++,
            COAMasterSid: cashBankAccount.COAMasterSid,
            CurrencyMasterSid: createDto.CurrencyMasterSid || 1, // Required - default to INR
            CurrencyCode: createDto.CurrencyMasterSid ? (await this.getCurrencyCode(createDto.CurrencyMasterSid, prisma)) : 'INR',
            ExchangeRate: exchangeRate,
            Rate: 1, // Required
            TaxableAmount: 0, // Required - no tax on cash/bank
            DrCr: 'D',
            Amount: netReceiptAmount,
            LocalAmount: netReceiptAmount,
            Narration: `Receipt via ${createDto.PaymentMode}`,
            Status: 'A',
            CreatedBy: createDto.CreatedBy || 'system',
            UpdatedBy: createDto.CreatedBy || 'system',
          },
        });

        const drTransaction = await prisma.voucherTransaction.create({
          data: {
            VoucherHeaderSid: voucherHeader.VoucherHeaderSid,
            VoucherDetailSid: drDetail.VoucherDetailSid,
            CompanyMasterSid: createDto.CompanyMasterSid,
            BranchMasterSid: createDto.BranchMasterSid,
            VoucherType: this.RECEIPT_VOUCHER_TYPE,
            VoucherDate: voucherDate,
            PostDate: voucherDate, // Required
            VoucherNumber: voucherNumber,
            Sno: drDetail.Sno,
            COAMasterSid: cashBankAccount.COAMasterSid,
            LedgerMasterSid: createDto.LedgerMasterSid, // Required - can't be null
            CurrencyCode: drDetail.CurrencyCode,
            ExchangeRate: exchangeRate,
            DrCr: 'D',
            Amount: netReceiptAmount,
            LocalAmount: netReceiptAmount, // Required
            // Required fields with defaults
            GST_VAT: '', // Required
            ChargeDescription: 'Receipt', // Required
            DepartmentMasterSid: 1, // Required - default department
            HouseJobSid: 1, // Required - default job
            MasterJobSid: 1, // Required - default job
            CostRevenue: 'R', // Required - Revenue
            Rate: 1, // Required
            NumberOfUnit: 1, // Required
            TaxableAmount: 0, // Required
            TransType: 'R', // Required - Receipt
            VoucherTypeMasterSid: 1, // Required
            Narration: drDetail.Narration,
            Status: 'A',
            CreatedBy: createDto.CreatedBy || 'system',
            UpdatedBy: createDto.CreatedBy || 'system',
          },
        });

        transactions.push(drTransaction);

        // Cr: Customer Account (total amount)
        const customerCOA = await this.getCustomerCOA(createDto.CompanyMasterSid, prisma);

        const crDetail = await prisma.voucherDetail.create({
          data: {
            VoucherHeaderSid: voucherHeader.VoucherHeaderSid,
            CompanyMasterSid: createDto.CompanyMasterSid,
            BranchMasterSid: createDto.BranchMasterSid,
            Sno: sno++,
            COAMasterSid: customerCOA.COAMasterSid,
            LedgerMasterSid: createDto.LedgerMasterSid,
            CurrencyMasterSid: createDto.CurrencyMasterSid || 1, // Required
            CurrencyCode: drDetail.CurrencyCode,
            ExchangeRate: exchangeRate,
            Rate: 1, // Required
            TaxableAmount: 0, // Required
            DrCr: 'C',
            Amount: createDto.TotalAmount,
            LocalAmount: createDto.TotalAmount,
            Narration: createDto.Narration || 'Receipt',
            Status: 'A',
            CreatedBy: createDto.CreatedBy || 'system',
            UpdatedBy: createDto.CreatedBy || 'system',
          },
        });

        const crTransaction = await prisma.voucherTransaction.create({
          data: {
            VoucherHeaderSid: voucherHeader.VoucherHeaderSid,
            VoucherDetailSid: crDetail.VoucherDetailSid,
            CompanyMasterSid: createDto.CompanyMasterSid,
            BranchMasterSid: createDto.BranchMasterSid,
            VoucherType: this.RECEIPT_VOUCHER_TYPE,
            VoucherDate: voucherDate,
            PostDate: voucherDate, // Required
            VoucherNumber: voucherNumber,
            Sno: crDetail.Sno,
            COAMasterSid: customerCOA.COAMasterSid,
            LedgerMasterSid: createDto.LedgerMasterSid,
            CurrencyCode: crDetail.CurrencyCode,
            ExchangeRate: exchangeRate,
            DrCr: 'C',
            Amount: createDto.TotalAmount,
            LocalAmount: createDto.TotalAmount, // Required
            // Required fields with defaults
            GST_VAT: '', // Required
            ChargeDescription: 'Receipt', // Required
            DepartmentMasterSid: 1, // Required - default department
            HouseJobSid: 1, // Required - default job
            MasterJobSid: 1, // Required - default job
            CostRevenue: 'R', // Required - Revenue
            Rate: 1, // Required
            NumberOfUnit: 1, // Required
            TaxableAmount: 0, // Required
            TransType: 'R', // Required - Receipt
            VoucherTypeMasterSid: 1, // Required
            Narration: crDetail.Narration,
            Status: 'A',
            CreatedBy: createDto.CreatedBy || 'system',
            UpdatedBy: createDto.CreatedBy || 'system',
          },
        });

        transactions.push(crTransaction);

        // 8. Handle TDS if applicable
        if (createDto.HasTDS && createDto.TDSAmount && createDto.TDSAmount > 0) {
          const tdsDetail = await prisma.voucherDetail.create({
            data: {
              VoucherHeaderSid: voucherHeader.VoucherHeaderSid,
              CompanyMasterSid: createDto.CompanyMasterSid,
              BranchMasterSid: createDto.BranchMasterSid,
              Sno: sno++,
              COAMasterSid: createDto.TDSLedgerMasterSid || customerCOA.COAMasterSid,
              CurrencyMasterSid: 1, // Required - INR
              CurrencyCode: 'INR',
              ExchangeRate: 1,
              Rate: 1, // Required
              TaxableAmount: 0, // Required
              DrCr: 'D',
              Amount: createDto.TDSAmount,
              LocalAmount: createDto.TDSAmount,
              Narration: `TDS deducted @ ${createDto.TDSPercentage || 0}%`,
              Status: 'A',
              CreatedBy: createDto.CreatedBy || 'system',
              UpdatedBy: createDto.CreatedBy || 'system',
            },
          });

          await prisma.voucherTransaction.create({
            data: {
              VoucherHeaderSid: voucherHeader.VoucherHeaderSid,
              VoucherDetailSid: tdsDetail.VoucherDetailSid,
              CompanyMasterSid: createDto.CompanyMasterSid,
              BranchMasterSid: createDto.BranchMasterSid,
              VoucherType: this.RECEIPT_VOUCHER_TYPE,
              VoucherDate: voucherDate,
              PostDate: voucherDate, // Required
              VoucherNumber: voucherNumber,
              Sno: tdsDetail.Sno,
              COAMasterSid: tdsDetail.COAMasterSid || customerCOA.COAMasterSid,
              LedgerMasterSid: createDto.LedgerMasterSid, // Required
              CurrencyCode: 'INR',
              ExchangeRate: 1,
              DrCr: 'D',
              Amount: createDto.TDSAmount,
              LocalAmount: createDto.TDSAmount, // Required
              // Required fields with defaults
              GST_VAT: '', // Required
              ChargeDescription: 'TDS', // Required
              DepartmentMasterSid: 1, // Required - default department
              HouseJobSid: 1, // Required - default job
              MasterJobSid: 1, // Required - default job
              CostRevenue: 'R', // Required - Revenue
              Rate: 1, // Required
              NumberOfUnit: 1, // Required
              TaxableAmount: 0, // Required
              TransType: 'R', // Required - Receipt
              VoucherTypeMasterSid: 1, // Required
              Narration: tdsDetail.Narration,
              Status: 'A',
              CreatedBy: createDto.CreatedBy || 'system',
              UpdatedBy: createDto.CreatedBy || 'system',
            },
          });
        }

        // 9. Create voucher matching records for invoice payments
        const matchedInvoices = await this.createVoucherMatchings(
          createDto,
          voucherHeader.VoucherHeaderSid,
          crTransaction.VoucherTransactionSid,
          prisma,
        );

        // 10. Create inter-branch JV if applicable
        let interBranchJV: InterBranchJVDto | undefined;
        if (createDto.IsInterBranch && createDto.ReceivingBranchMasterSid) {
          interBranchJV = await this.createInterBranchJV(
            createDto.CompanyMasterSid,
            createDto.BranchMasterSid, // Paying branch
            createDto.ReceivingBranchMasterSid, // Receiving branch
            netReceiptAmount,
            voucherDate,
            `Inter-branch transfer for receipt ${voucherNumber}`,
            createDto.CreatedBy || 'system',
            prisma,
          );
        }

        // 11. Return response
        return {
          VoucherHeaderSid: voucherHeader.VoucherHeaderSid,
          VoucherNumber: voucherNumber,
          VoucherDate: createDto.VoucherDate,
          CompanyMasterSid: createDto.CompanyMasterSid,
          BranchMasterSid: createDto.BranchMasterSid,
          LedgerMasterSid: createDto.LedgerMasterSid,
          CustomerName: customer?.SubledgerName || '',
          TotalAmount: createDto.TotalAmount,
          TDSAmount: createDto.TDSAmount,
          NetAmount: netReceiptAmount,
          MatchedInvoices: matchedInvoices,
          InterBranchJV: interBranchJV,
          CreatedAt: voucherHeader.CreatedOn,
          Status: voucherHeader.Status,
        };
      });
    } catch (error) {
      this.logger.error(`Failed to create receipt: ${error.message}`, error.stack);
      throw new BadRequestException(`Failed to create receipt: ${error.message}`);
    }
  }

  /**
   * Create voucher matching records for invoice payments
   */
  private async createVoucherMatchings(
    createDto: CreateReceiptDto,
    voucherHeaderSid: number,
    receiptTransactionSid: number,
    prisma: any,
  ): Promise<MatchedInvoiceDto[]> {
    const matchedInvoices: MatchedInvoiceDto[] = [];

    for (const detail of createDto.Details) {
      // Skip advance receipts
      if (detail.IsAdvance || !detail.VoucherTransactionSid) {
        continue;
      }

      // Get invoice transaction
      const invoiceTransaction = await prisma.voucherTransaction.findUnique({
        where: { VoucherTransactionSid: detail.VoucherTransactionSid },
        include: { VoucherHeader: true },
      });

      if (!invoiceTransaction) {
        throw new NotFoundException(`Invoice transaction ${detail.VoucherTransactionSid} not found`);
      }

      // Create matching record
      await prisma.voucherMatching.create({
        data: {
          CompanyMasterSid: createDto.CompanyMasterSid,
          BranchMasterSid: createDto.BranchMasterSid,
          VoucherMatchingHeaderSid: 1, // Would need to create header first
          VoucherHeaderSid: voucherHeaderSid,
          VoucherDetailSid: 1, // Would map to actual detail
          VoucherTransactionSid: receiptTransactionSid,
          VoucherMatchingDate: new Date(createDto.VoucherDate),
          VoucherType: this.RECEIPT_VOUCHER_TYPE,
          Sno: 1,
          COAMasterSid: invoiceTransaction.COAMasterSid,
          CurrencyCode: invoiceTransaction.CurrencyCode || 'INR',
          ExchangeRate: Number(invoiceTransaction.ExchangeRate || 1),
          DrCr: invoiceTransaction.DrCr,
          Amount: detail.Amount,
          LocalAmount: detail.Amount,
          MatchingType: 'Receipt',
          Status: 'A',
          CreatedBy: createDto.CreatedBy || 'system',
          UpdatedBy: createDto.CreatedBy || 'system',
        },
      });

      matchedInvoices.push({
        VoucherTransactionSid: detail.VoucherTransactionSid,
        InvoiceNumber: invoiceTransaction.VoucherHeader.VoucherNumber,
        InvoiceDate: invoiceTransaction.VoucherDate.toISOString(),
        OriginalAmount: Number(invoiceTransaction.Amount),
        PreviouslyMatched: 0, // Would need to calculate
        MatchedAmount: detail.Amount,
        OutstandingAmount: Number(invoiceTransaction.Amount) - detail.Amount,
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
    const payingBranchCOA = await this.getInterBranchCOA(companySid, 'Payable', prisma);
    const receivingBranchCOA = await this.getInterBranchCOA(companySid, 'Receivable', prisma);

    // Create JV Header
    const jvHeader = await prisma.voucherHeader.create({
      data: {
        CompanyMasterSid: companySid,
        BranchMasterSid: payingBranchSid,
        VoucherNumber: jvNumber,
        VoucherDate: date,
        VoucherType: this.JOURNAL_VOUCHER_TYPE,
        Narration: narration,
        SetoffStatus: 'Posted',
        Status: 'A',
        CreatedBy: createdBy,
        UpdatedBy: createdBy,
      },
    });

    // Dr: Receiving Branch (branch that got the money)
    await this.createJVEntry(
      jvHeader.VoucherHeaderSid,
      companySid,
      payingBranchSid,
      1,
      receivingBranchCOA.COAMasterSid,
      receivingBranchSid,
      'D',
      amount,
      `Transfer to ${receivingBranchSid}`,
      date,
      jvNumber,
      createdBy,
      prisma,
    );

    // Cr: Paying Branch (branch that recorded the receipt)
    await this.createJVEntry(
      jvHeader.VoucherHeaderSid,
      companySid,
      payingBranchSid,
      2,
      payingBranchCOA.COAMasterSid,
      payingBranchSid,
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
        CurrencyCode: 'INR',
        ExchangeRate: 1,
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
        VoucherNumber: voucherNumber,
        Sno: sno,
        COAMasterSid: coaSid,
        LedgerMasterSid: ledgerSid,
        CurrencyCode: 'INR',
        ExchangeRate: 1,
        DrCr: drCr,
        Amount: amount,
        Narration: narration,
        Status: 'A',
        CreatedBy: createdBy,
        UpdatedBy: createdBy,
      },
    });
  }

  /**
   * Generate receipt voucher number
   */
  private async generateReceiptNumber(
    companySid: number,
    branchSid: number,
    date: Date,
    prisma: any,
  ): Promise<string> {
    const yearSuffix = date.getFullYear().toString().slice(-2);
    const monthPrefix = (date.getMonth() + 1).toString().padStart(2, '0');

    const lastReceipt = await prisma.voucherHeader.findFirst({
      where: {
        CompanyMasterSid: companySid,
        BranchMasterSid: branchSid,
        VoucherType: this.RECEIPT_VOUCHER_TYPE,
        VoucherNumber: { startsWith: `RV${yearSuffix}${monthPrefix}` },
      },
      orderBy: { VoucherNumber: 'desc' },
    });

    const nextNumber = lastReceipt ? parseInt(lastReceipt.VoucherNumber.slice(-4)) + 1 : 1;

    return `RV${yearSuffix}${monthPrefix}${nextNumber.toString().padStart(4, '0')}`;
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
   * Get cash/bank account based on payment mode
   */
  private async getCashBankAccount(paymentMode: string, companySid: number, prisma: any) {
    const searchTerm = paymentMode.toLowerCase().includes('cash') ? 'Cash' : 'Bank';

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
   * Get customer receivable account
   */
  private async getCustomerCOA(companySid: number, prisma: any) {
    const account = await prisma.cOAMaster.findFirst({
      where: {
        CompanyMasterSid: companySid,
        LedgerName: { contains: 'Sundry Debtors', mode: 'insensitive' },
        Status: 'A',
      },
    });

    if (!account) {
      throw new BadRequestException('Customer receivable account not found in COA');
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
   * Get currency code from master
   */
  private async getCurrencyCode(currencyMasterSid: number, prisma: any): Promise<string> {
    const currency = await prisma.currencyMaster.findUnique({
      where: { CurrencyMasterSid: currencyMasterSid },
    });

    return currency?.CurrencyCode || 'INR';
  }

  /**
   * Get receipt by ID
   */
  async getReceiptById(voucherHeaderSid: number): Promise<any> {
    const receipt = await this._db.voucherHeader.findUnique({
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

    if (!receipt) {
      throw new NotFoundException(`Receipt ${voucherHeaderSid} not found`);
    }

    return receipt;
  }

  /**
   * Get receipts with filters
   */
  async getReceipts(filterDto: ReceiptFilterDto): Promise<any[]> {
    const where: Prisma.VoucherHeaderWhereInput = {
      VoucherType: this.RECEIPT_VOUCHER_TYPE,
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
        CompanyMaster:true,
        BranchMaster : true
      },
      orderBy: { VoucherDate: 'desc' },
      take: 100,
    });
  }
}
