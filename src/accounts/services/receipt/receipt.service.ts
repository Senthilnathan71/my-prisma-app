import { Injectable, Logger, BadRequestException, NotFoundException, InternalServerErrorException } from '@nestjs/common';
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
  VoucherMatchingPayload,
} from '../../dto/receipt.dto';
import { Prisma, PrismaClient } from '@prisma/client';
import { SearchListDto } from 'src/masters/DTO/search-list.dto';
import { filterDto } from 'src/masters/DTO/search-vessel.dto';
import { isNumber } from 'class-validator';
import { VoucherService } from 'src/operation/services/voucher/voucher.service';
import moment from 'moment';
import { Decimal } from '@prisma/client/runtime/library';
import { toNumber } from 'src/common/helper';

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
    private readonly voucherService: VoucherService
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
          VoucherHeaderSid: txn.voucherHeaderSid,
          VoucherDetailSid: txn.voucherDetailSid,
          VoucherNumber: txn.voucherNumber,
          VoucherDate: typeof txn.voucherDate === 'string' ? txn.voucherDate : txn.voucherDate.toISOString(),
          VoucherTypeMasterSid : txn.voucherTypeMasterSid,
          COAMasterSid : txn.coaMasterSid!,
          VoucherType: txn.voucherTypeCode,
          LedgerMasterSid: txn.ledgerMasterSid!,
          CustomerName: customerOutstanding.customerName || '',
          OriginalCurrencyAmount: txn.originalCurrencyAmount,
          OriginalLocalAmount: txn.originalLocalAmount,
          MatchedAmount: txn.matchedLocalAmount,
          MatchedCurrencyAmount: txn.matchedCurrencyAmount,
          OutstandingLocalAmount: txn.outstandingCurrencyAmount * txn.exchangeRate,
          OutstandingCurrencyAmount: txn.outstandingCurrencyAmount,
          CurrencyCode: txn.currencyCode,
          ExchangeRate: txn.exchangeRate,
          DrCr: txn.drCr,
          ChargeDescription: txn.chargeDescription,
        }));

        // Filter out fully paid if requested
        if (!searchDto.IncludeFullyPaid) {
          return invoices.filter((inv) => Math.abs(inv.OutstandingLocalAmount) > 0);  // No tolerance
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
      subledgerMaster : {
        SubledgerType : 'Customer'
      },
      Status: 'A',
    };

    // Build dynamic where clause based on search criteria
    if (searchDto.InvoiceNumber) {
      whereConditions.VoucherHeader = {
        VoucherNumber: { contains: searchDto.InvoiceNumber, mode: 'insensitive' },
      };
    }

    const transactions = await this._db.voucherTransaction.findMany({
      where: whereConditions,
      include: {
        VoucherHeader: true,
        subledgerMaster: true,
        voucherTypeMaster : {
          select : { DocumentTypeCode : true }
        },
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
      if (!searchDto.IncludeFullyPaid && Math.abs(outstandingAmount) <= 0) {
        continue;
      }

      results.push({
        VoucherTransactionSid: txn.VoucherTransactionSid,
        VoucherHeaderSid: txn.VoucherHeaderSid,
        VoucherDetailSid : txn.VoucherDetailSid,
        VoucherNumber: txn.VoucherHeader.VoucherNumber,
        VoucherDate: txn.VoucherDate.toISOString(),
        VoucherTypeMasterSid : txn.VoucherTypeMasterSid,
        VoucherType: txn.voucherTypeMaster?.DocumentTypeCode,
        LedgerMasterSid: txn.LedgerMasterSid || null,
        COAMasterSid: txn.COAMasterSid || null,
        CustomerName: txn.subledgerMaster?.SubledgerName || '',
        OriginalCurrencyAmount: Number(txn.Amount),
        OriginalLocalAmount: Number(txn.LocalAmount),
        MatchedAmount: matchedAmount,
        MatchedCurrencyAmount: 0, // Would need to sum currency amounts
        OutstandingLocalAmount: outstandingAmount,
        OutstandingCurrencyAmount: Number(txn.Amount) - matchedAmount,
        CurrencyCode: txn.CurrencyCode || 'INR',
        DrCr: txn.DrCr,
      });
    }

    return results.filter(r => (r.OutstandingLocalAmount > 0 || r.OutstandingCurrencyAmount > 0));
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
          this.RECEIPT_VOUCHER_TYPE,
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
    voucherTypeSid: number,
    date: Date,
    prisma: any,
  ): Promise<string> {
    const yearSuffix = date.getFullYear().toString().slice(-2);
    const monthPrefix = (date.getMonth() + 1).toString().padStart(2, '0');

    const lastReceipt = await prisma.voucherHeader.findFirst({
      where: {
        CompanyMasterSid: companySid,
        BranchMasterSid: branchSid,
        VoucherType: voucherTypeSid,
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
  async getReceiptById(voucherHeaderSid: number,companyMasterSid : number,branchMasterSid : number) {
    const receipt = await this._db.voucherHeader.findUnique({
      where: { 
        VoucherHeaderSid: voucherHeaderSid,
        CompanyMasterSid : companyMasterSid,
        BranchMasterSid : branchMasterSid,
        Status : 'A'
      },
      include: {
        VoucherDetail: {
          where : {
            Status : 'A'
          }
        },
        SourceMatchingDetail : true
      },
    });

    if (!receipt) {
      throw new NotFoundException(`Receipt ${voucherHeaderSid} not found`);
    }

    const {SourceMatchingDetail,VoucherDetail ,...VoucherHeader} = receipt;
    const formattedMatchingDetail = await Promise.all(SourceMatchingDetail.map(async (detail) => {
      const transactionDetail = await this._db.voucherTransaction.findUnique({
        where: { VoucherTransactionSid: detail.VoucherTransactionSid },
        select: {
          VoucherNumber: true,
          VoucherDate: true,
          VoucherTypeMasterSid: true,
          voucherTypeMaster: { select: { DocumentTypeName: true } },
          LedgerMasterSid: true,
          COAMasterSid: true,
          Amount: true,
          LocalAmount: true,
          voucherMatchings: { where: { Status: 'A' } },
        }
      });

      if (!transactionDetail) {
        throw new NotFoundException(`Transaction not found`);
      }

      const matchedAmount = transactionDetail.voucherMatchings.reduce((sum, m) => sum + Number(m.Amount), 0);
      const outstandingAmount = Number(transactionDetail.Amount) - matchedAmount;

      return {
        VoucherMatchingHeaderSid: detail.VoucherMatchingHeaderSid,
        VoucherMatchingSid: detail.MatchingDetailSid,
        VoucherTransactionSid: detail.VoucherTransactionSid,
        VoucherDetailSid: detail.VoucherDetailSid,
        VoucherHeaderSid: detail.VoucherHeaderSid,
        LedgerMasterSid: transactionDetail?.LedgerMasterSid,
        COAMasterSid: transactionDetail?.COAMasterSid,
        VoucherNumber: transactionDetail?.VoucherNumber,
        VoucherTypeMasterSid: transactionDetail?.VoucherTypeMasterSid,
        VoucherType: transactionDetail?.voucherTypeMaster?.DocumentTypeName,
        VoucherDate: transactionDetail?.VoucherDate,
        DrCr: detail.DrCr,
        CurrencyCode : detail.CurrencyCode,
        ExchangeRate: detail.ExchangeRate || 1,
        OriginalCurrencyAmount: transactionDetail?.Amount,
        OriginalLocalAmount: transactionDetail?.LocalAmount,
        OutstandingCurrencyAmount: outstandingAmount,
        OutstandingLocalAmount: outstandingAmount * Number(detail.ExchangeRate),
        MatchingCurrency : detail.MatchingCurrency,
        MatchingExRate : detail.MatchingExRate,
        MatchingAmount: detail.MatchingAmount,
        MatchingLocalAmount: detail.MatchingLocalAmount,
        MatchingTDSAmount : detail.MatchingTDSAmount
      };
    }));

    return {
      ...VoucherHeader,
      VoucherDetail : VoucherDetail,
      voucherMatchings : formattedMatchingDetail
    };
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

  async createNewReceipt(payload: any) {
    try {
      return await this._db.$transaction(async (prisma) => {

        // 1. Get VoucherType for 'Receipt'
        const voucherType = await prisma.voucherTypeMaster.findFirst({
          where: {
            DocumentTypeName: 'Receipt'
          },
        });
        if (!voucherType) {
          throw new BadRequestException('Receipt Voucher Type not found');
        }

        // 2. Generate voucher number
        const voucherNumber = await this.generateReceiptNumber(
          payload.CompanyMasterSid,
          payload.BranchMasterSid,
          voucherType.VoucherTypeMasterSid,
          new Date(payload.VoucherDate),
          prisma,
        );


        // 3. Get current year
        const currentYear = await prisma.yearMaster.findFirst({
          where: {
            CompanyMasterSid: payload.CompanyMasterSid,
            YearMasterSid: payload.YearMasterSid,
            status: 'A'
          },
        });

        if(!currentYear) {
          throw new Error('Financial year not found');
        }

        const voucherDate = new Date(payload.VoucherDate);
        const startDate = new Date(currentYear.StartDate);
        const endDate = new Date(currentYear.EndDate);

        if (voucherDate < startDate || voucherDate > endDate) {
          throw new BadRequestException(
            `Voucher date must be within financial year ${startDate.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]}`,
          );
        }

        // 4. Create VoucherHeader for Receipt
        const voucherHeader = await prisma.voucherHeader.create({
          data: {
            CreatedBy: payload.CreatedBy,
            Status: 'A',
            CompanyMasterSid: payload.CompanyMasterSid,
            BranchMasterSid: payload.BranchMasterSid,
            VoucherNumber: voucherNumber,
            CashOrBank : payload.CashOrBank,
            MultiBranch : payload.MultiBranch,
            VoucherDate: new Date(payload.VoucherDate), // ensure Date type
            VoucherType: voucherType.VoucherTypeMasterSid,
            PostDate: new Date(payload.VoucherDate), // usually same as VoucherDate
            Narration: payload.Narration || "",
            PartyMasterSid: payload.PartyMasterSid,
            PartyName: payload.PartyName || "",
            PartyAddress: payload.PartyAddress || "",
            CustomerBranchSid: payload.CustomerBranchSid ?? null,
            PlaceOfSupply: payload.PlaceOfSupply || "",
            State: payload.State || "",
            COAMasterSid: payload.COAMasterSid,
            BankCOA: payload.BankCOA ?? null,
            BankPartyName: payload.BankPartyName || "",
            GST_VAT: payload.GST_VAT || "",
            InvoiceType: payload.InvoiceType || "",
            ReversalVoucher: payload.ReversalVoucher ?? null,
            TaxNumber: payload.TaxNumber ?? null,
            GSTType: payload.GSTType || "",
            Remarks: payload.Remarks || "",
            DepartmentMasterSid: payload.DepartmentMasterSid ?? null,
            HouseNumber: payload.HouseNumber || "",
            MasterNumber: payload.MasterNumber || "",
            HouseJobSid: payload.HouseJobSid ?? null,
            MasterJobSid: payload.MasterJobSid ?? null,
            CurrencyMasterSid: payload.CurrencyMasterSid ?? null,
            CurrencyCode: payload.CurrencyCode || "",
            ExchangeRate: payload.ExchangeRate ?? 1,
            Amount: payload.Amount ?? 0,
            LocalAmount: payload.LocalAmount ?? 0,
            NetAmount: payload.NetAmount ?? 0,
            DocumentNumber: payload.DocumentNumber || "",
            DocumentDate: payload.DocumentDate ? new Date(payload.DocumentDate) : null,
            SetoffStatus: payload.SetoffStatus || "",
            TaxType: payload.TaxType || "",
            InstrumentMode: payload.InstrumentMode || "",
            InstrumentNumber: payload.InstrumentNumber || "",
            InstrumentDate: payload.InstrumentDate ? new Date(payload.InstrumentDate) : null,
            ClearanceDate: payload.ClearanceDate ? new Date(payload.ClearanceDate) : null,
            CreditNoteReason: payload.CreditNoteReason || "",
            VoucherTypeMasterSid: voucherType.VoucherTypeMasterSid,
            PostStatus: "U",
          }
        });

        // 5. Prepare VoucherDetail payload array
        const detailItems = payload.detailItems || [];
        const allDetailPayload = detailItems.map((item, index) => ({
          CreatedBy: payload.CreatedBy,
          Status: 'A',
          CompanyMasterSid: payload.CompanyMasterSid,
          BranchMasterSid: payload.BranchMasterSid,
          VoucherHeaderSid: voucherHeader.VoucherHeaderSid,
          Sno: index + 1,
          ChargeMasterSid: item.ChargeMasterSid ?? null,
          ChargeDescription: item.ChargeDescription || null,
          LedgerMasterSid: item.LedgerMasterSid ?? null,
          COAMasterSid: item.COAMasterSid ?? null,
          HSSACMasterSid: item.HSSACMasterSid ?? null,
          DepartmentMasterSid: item.DepartmentMasterSid ?? null,
          HouseJobSid: item.HouseJobSid ?? null,
          MasterJobSid: item.MasterJobSid ?? null,
          CostRevenue: item.CostRevenue || "",
          CurrencyMasterSid: item.CurrencyMasterSid ?? payload.CurrencyMasterSid ?? null,
          CurrencyCode: item.CurrencyCode || payload.CurrencyCode || "",
          ExchangeRate: item.ExchangeRate ?? payload.ExchangeRate ?? 1,
          Rate: item.Rate ?? 0,
          NumberOfUnit: item.NumberOfUnit ?? 0,
          Narration: item.Narration || "",
          DrCr: item.DrCr || "",
          TaxableAmount: item.TaxableAmount ?? 0,
          TaxPercentage1: item.TaxPercentage1 ?? 0,
          TaxAmount1: item.TaxAmount1 ?? 0,
          TaxPercentage2: item.TaxPercentage2 ?? 0,
          TaxAmount2: item.TaxAmount2 ?? 0,
          Amount:  item.Amount ?? 0,
          LocalAmount: item.LocalAmount ?? 0,
          InvoiceType: item.InvoiceType || "",
          CostCenter: item.CostCenter ?? null,
          ProfitCenter: item.ProfitCenter ?? null,
          Remarks: item.Remarks || "",
          ChargeUOMSid: item.ChargeUOMSid ?? null,
          YearMasterSid: currentYear?.YearMasterSid ?? null,
          PartyAmount: item.PartyAmount ?? 0,
        }));

        // 6. Create VoucherDetail for Receipt
        const createdDetails = await prisma.voucherDetail.createManyAndReturn({
          data: allDetailPayload,
        });


        const allMatchings = payload.voucherMatching || [];
        const matchingDetails = allMatchings.map((matching, index) => {
          return {
            Sno: index + 1,
            VoucherHeaderSid: matching.VoucherHeaderSid, // VoucherHeaderSid(invoice)
            VoucherDetailSid: matching.VoucherDetailSid,  // VoucherDetailSid(invoice)
            VoucherTransactionSid: matching.VoucherTransactionSid, // VoucherTransactionSid(invoice)
            VoucherType: String(matching.VoucherType).toUpperCase().substring(0, 4), // VoucherType(invoice)
            CurrencyCode: matching.CurrencyCode, // CurrencyCode(invoice)
            ExchangeRate: matching.ExchangeRate, // ExchangeRate(invoice)
            DrCr: String(matching.DrCr).toUpperCase().charAt(0),                 // DrCr(invoice)
            Amount: matching.Amount,             // Amount(invoice)
            LocalAmount: matching.LocalAmount,   // LocalAmount(invoice)
            MatchingCurrency : matching.MatchingCurrency,
            MatchingExRate : matching.MatchingExRate,
            MatchingAmount: matching.MatchingAmount,  // MatchingAmount(user input/receipt)
            MatchingLocalAmount: matching.MatchingLocalAmount,       // MatchingLocalAmount(user input / receipt)
            MatchingTDSAmount : matching.MatchingTDSAmount,
            SourceVoucherHeaderSid: voucherHeader.VoucherHeaderSid, // SourceVoucherHeaderSid(receipt)
          }
        });

        const finalMatchingDetails = await prisma.matchingDetail.createManyAndReturn({
          data: matchingDetails
        });



        // // 7. Prepare VoucherTransaction payload array
        // const voucherTransactionsPayload = createdDetails.map((item, index) => ({
        //   CreatedBy: item.CreatedBy,
        //   Status: 'A',
        //   CompanyMasterSid: item.CompanyMasterSid,
        //   BranchMasterSid: item.BranchMasterSid,
        //   VoucherHeaderSid: voucherHeader.VoucherHeaderSid,
        //   VoucherDetailSid: item.VoucherDetailSid,
        //   VoucherNumber: voucherHeader.VoucherNumber,
        //   VoucherType: voucherHeader.VoucherType,
        //   VoucherDate: voucherHeader.VoucherDate,
        //   PostDate: voucherHeader.PostDate,
        //   GST_VAT: payload.GST_VAT || "",
        //   Sno: item.Sno,
        //   ChargeDescription: item.ChargeDescription || "",
        //   LedgerMasterSid: item.LedgerMasterSid ?? null,
        //   COAMasterSid: item.COAMasterSid ?? null,
        //   DepartmentMasterSid: item.DepartmentMasterSid ?? null,
        //   HouseJobSid: item.HouseJobSid ?? null,
        //   MasterJobSid: item.MasterJobSid ?? null,
        //   CostRevenue: item.CostRevenue || "",
        //   CurrencyCode: item.CurrencyCode || "",
        //   ExchangeRate: item.ExchangeRate ?? 1,
        //   Rate: item.Rate ?? 0,
        //   NumberOfUnit: item.NumberOfUnit ?? 0,
        //   Narration: item.Narration || "",
        //   DrCr: String(item.DrCr).charAt(0) || "",
        //   TaxableAmount: item.TaxableAmount ?? 0,
        //   Amount: item.Amount ?? 0,
        //   LocalAmount: item.LocalAmount ?? 0,
        //   CostCenter: item.CostCenter ?? null,
        //   ProfitCenter: item.ProfitCenter ?? null,
        //   TransType: detailItems[index]?.TransType || "",
        //   VoucherTypeMasterSid: voucherType.VoucherTypeMasterSid,
        //   YearMasterSid: item.YearMasterSid ?? null,
        //   IsAutoGenerated: 'N',
        // }));

        // // 8. Bulk create VoucherTransaction records
        // const allTransactions = await prisma.voucherTransaction.createManyAndReturn({
        //   data: voucherTransactionsPayload,
        // });

        // const allCompleteDetails : any[] = [];
        // for (const voucherTransaction of allTransactions) {
        //   const completeDetail = await prisma.voucherDetail.update({
        //     where :{
        //       VoucherDetailSid : voucherTransaction.VoucherDetailSid
        //     },
        //     data : {
        //       VoucherTransactionSid : voucherTransaction.VoucherTransactionSid
        //     }
        //   })
        //   allCompleteDetails.push(completeDetail);
        // }

        // // Getting VoucherDetail records with VoucherTransactionSid
        // const voucherDetails = await prisma.voucherDetail.findMany({
        //   where: { 
        //     VoucherHeaderSid: voucherHeader.VoucherHeaderSid , 
        //     Status : 'A' 
        //   },
        //   orderBy: { Sno: 'asc' }
        // });

        // // 9. Create VoucherMatching records
        // const partyDetail = allCompleteDetails.find(vd => vd.LedgerMasterSid === payload.PartyMasterSid);
        // if(!partyDetail){
        //   throw new BadRequestException('Party Voucher Detail not found');
        // }
        // const billMatchingCurrencyAmount = (payload.voucherMatching  || []).reduce((sum, matching) => {
        //   return sum + Number(matching.Amount);
        // },0);

        // const billMatchingLocalAmount = (payload.voucherMatching  || []).reduce((sum, matching) => {
        //   return sum + Number(matching.LocalAmount);
        // },0);



        // const matchingRecords = await this.voucherService.createVoucherMatching({
        //   CompanyMasterSid : payload.CompanyMasterSid,
        //   BranchMasterSid : payload.BranchMasterSid,
        //   VoucherHeaderSid : voucherHeader.VoucherHeaderSid,
        //   voucherTypeInName : voucherType.DocumentTypeName,
        //   VoucherTypeMasterSid : voucherType.VoucherTypeMasterSid,
        //   PostDate : voucherHeader.PostDate,
        //   Narration : `${voucherHeader.VoucherNumber} ${voucherHeader.VoucherDate.toISOString().split('T')[0]} ${voucherHeader.CurrencyCode} ${voucherHeader.Amount}`,
        //   createdBy : payload.CreatedBy,
        //   partyVoucherDetail : partyDetail,
        //   voucherMatching : payload.voucherMatching,
        //   BillMatchingCurrencyAmount : billMatchingCurrencyAmount,
        //   BillMatchingLocalAmount : billMatchingLocalAmount,
        // },prisma);

        return {
          voucherHeader,
          createdDetails,
          finalMatchingDetails
        };
      });
    } catch (error) {
      throw error;
    }
  }

  async postReceipt(
    payload: {
      voucherHeaderSid: number,
      companyMasterSid: number,
      branchMasterSid: number,
      yearMasterSid: number,
      localCurrencyMasterSid: number,
      localCurrencyCode: string,
      postedBy: string,
      taxDetails: {
        CountryMasterSid: number,
        countryName: string,
        TaxCategory: 'Inter' | 'Intra',
        EffectiveFrom: Date,
        TaxType: 'Input' | 'Output',
      }
    }
  ) {
    try {
      return await this._db.$transaction(async (tx) => {
        const voucher = await tx.voucherHeader.findUnique({
          where: {
            VoucherHeaderSid: payload.voucherHeaderSid,
            CompanyMasterSid: payload.companyMasterSid,
            BranchMasterSid: payload.branchMasterSid,
            Status: 'A'
          },
          include: {
            VoucherDetail: {
              where: { Status: 'A' },
              orderBy: { Sno: 'asc' },
            },
            SourceMatchingDetail: true,
            voucherTypeMaster: true
          }
        })

        if (!voucher) throw new BadRequestException('Voucher not found.');
        if (voucher.PostStatus === 'P') throw new BadRequestException('Voucher is already posted.');
        if (!voucher.VoucherDetail || voucher.VoucherDetail.length === 0) throw new BadRequestException('No detail lines are found.');
        if (!voucher.voucherTypeMaster) throw new BadRequestException('Voucher type is not found.');


        const { voucherTypeMaster, SourceMatchingDetail, VoucherDetail, ...VoucherHeader } = voucher;

        // Validate year
        const yearMaster = await tx.yearMaster.findUnique({
          where: {
            CompanyMasterSid: payload.companyMasterSid,
            YearMasterSid: payload.yearMasterSid,
            status: 'A'
          },
          select: {
            StartDate: true,
            EndDate: true
          }
        });
        if (!yearMaster) throw new BadRequestException("Year master not found.");

        const voucherDate = new Date(voucher.VoucherDate);
        const startDate = new Date(yearMaster.StartDate);
        const endDate = new Date(yearMaster.EndDate);
        if (voucherDate < startDate || voucherDate > endDate) throw new Error('Voucher date is outside of current financial year.');

        // Prepare VoucherTransaction payload array
        const voucherTransactionsPayload = VoucherDetail.map((item, index) => ({
          CreatedBy: item.CreatedBy,
          Status: 'A',
          CompanyMasterSid: item.CompanyMasterSid,
          BranchMasterSid: item.BranchMasterSid,
          VoucherHeaderSid: voucher.VoucherHeaderSid,
          VoucherDetailSid: item.VoucherDetailSid,
          VoucherNumber: voucher.VoucherNumber,
          VoucherType: voucher.VoucherType,
          VoucherDate: voucher.VoucherDate,
          PostDate: voucher.PostDate!,
          GST_VAT: voucher.GST_VAT || "",
          Sno: item.Sno,
          ChargeDescription: item.ChargeDescription || "",
          LedgerMasterSid: item.LedgerMasterSid ?? null,
          COAMasterSid: item.COAMasterSid ?? null,
          DepartmentMasterSid: item.DepartmentMasterSid ?? null,
          HouseJobSid: item.HouseJobSid ?? null,
          MasterJobSid: item.MasterJobSid ?? null,
          CostRevenue: item.CostRevenue || "",
          CurrencyCode: item.CurrencyCode || "",
          ExchangeRate: item.ExchangeRate ?? 1,
          Rate: item.Rate ?? 0,
          NumberOfUnit: item.NumberOfUnit ?? 0,
          Narration: item.Narration || "",
          DrCr: String(item.DrCr).charAt(0) || "",
          TaxableAmount: item.TaxableAmount ?? 0,
          Amount: item.Amount ?? 0,
          LocalAmount: item.LocalAmount ?? 0,
          CostCenter: item.CostCenter ?? null,
          ProfitCenter: item.ProfitCenter ?? null,
          TransType: "",
          VoucherTypeMasterSid: voucherTypeMaster.VoucherTypeMasterSid,
          YearMasterSid: item.YearMasterSid ?? null,
          IsAutoGenerated: 'N',
        }));

        // Bulk create VoucherTransaction records
        const allTransactions = await tx.voucherTransaction.createManyAndReturn({
          data: voucherTransactionsPayload,
        });


        const allCompleteDetails: any[] = [];
        for (const voucherTransaction of allTransactions) {
          const completeDetail = await tx.voucherDetail.update({
            where: {
              VoucherDetailSid: voucherTransaction.VoucherDetailSid
            },
            data: {
              VoucherTransactionSid: voucherTransaction.VoucherTransactionSid
            },
            include : { 
              subledgerMaster : {select : {SubledgerType : true}},
            }
          })
          allCompleteDetails.push(completeDetail);
        }

        const partyDetail = allCompleteDetails.find(vd => vd.subledgerMaster?.SubledgerType === 'Customer');
        if (!partyDetail) {
          throw new BadRequestException('Party Voucher Detail not found');
        }
        const billMatchingCurrencyAmount = (SourceMatchingDetail || []).reduce((sum, matching) => {
          return sum + Number(matching.MatchingAmount);
        }, 0);

        const billMatchingLocalAmount = (SourceMatchingDetail || []).reduce((sum, matching) => {
          return sum + Number(matching.MatchingLocalAmount);
        }, 0);

        await tx.matchingDetail.deleteMany({
          where: {
            AND: [
              { MatchingAmount: { equals: 0 } },
              { MatchingLocalAmount: { equals: 0 } },
            ]
          }
        })

        const allValidMatchings = await Promise.all(
          (SourceMatchingDetail || [])
            .filter(matching =>
              toNumber(matching.Amount) > 0 ||
              toNumber(matching.LocalAmount) > 0
            )
            .map(async (matching) => {
              // taking invoice information from each matching detail
              const transaction = await tx.voucherTransaction.findUnique({
                where: {
                  VoucherTransactionSid: matching.VoucherTransactionSid
                },
                select: {
                  COAMasterSid: true,
                  LedgerMasterSid: true,
                  VoucherTypeMasterSid: true,
                  CurrencyCode: true,
                  ExchangeRate: true,
                  DrCr: true,
                }
              });
              return {
                VoucherHeaderSid: matching.VoucherHeaderSid,
                VoucherDetailSid: matching.VoucherDetailSid,
                VoucherTransactionSid: matching.VoucherTransactionSid,
                VoucherType: transaction?.VoucherTypeMasterSid || 0,
                COAMasterSid: transaction?.COAMasterSid || null,
                LedgerMasterSid: transaction?.LedgerMasterSid || null,
                CurrencyCode: matching?.CurrencyCode || null,
                ExchangeRate: matching?.ExchangeRate || null,
                DrCr: transaction?.DrCr || null,
                Amount: matching.MatchingAmount,
                LocalAmount: matching.MatchingLocalAmount,
              }
            })
          );
        let newVoucherMatchings: any;
        if (billMatchingCurrencyAmount > 0 || billMatchingLocalAmount > 0) {
          newVoucherMatchings = await this.voucherService.createVoucherMatching({
            CompanyMasterSid: payload.companyMasterSid,
            BranchMasterSid: payload.branchMasterSid,
            VoucherHeaderSid: payload.voucherHeaderSid,
            voucherTypeInName: voucher?.voucherTypeMaster.DocumentTypeName,
            VoucherTypeMasterSid: voucher?.voucherTypeMaster.VoucherTypeMasterSid,
            PostDate: voucher.PostDate!,
            Narration: `${voucher.VoucherNumber} ${voucher.VoucherDate.toISOString().split('T')[0]} ${voucher.CurrencyCode} ${voucher.Amount}`,
            createdBy: payload.postedBy,
            voucherMatching: allValidMatchings,
            partyVoucherDetail: partyDetail,
            BillMatchingCurrencyAmount: billMatchingCurrencyAmount,
            BillMatchingLocalAmount: billMatchingLocalAmount,
          }, tx);
        }

        const updatedVoucher = await tx.voucherHeader.update({
          where: {
            VoucherHeaderSid: voucher.VoucherHeaderSid
          },
          data: {
            Amount: partyDetail.Amount,
            LocalAmount: partyDetail.LocalAmount,
            PostStatus : 'P',
            PostDate: voucher.PostDate,
            UpdatedBy: payload.postedBy
          }
        })

        return {
          ...updatedVoucher,
          voucherDetail: allCompleteDetails,
          voucherMatchings: newVoucherMatchings
        }

      })
    } catch (error) {
      throw error;
    }
  }

  /**
   * Search Receipt with filters and pagination
   */
  async searchReceipts(params: any): Promise<any> {
    try {
      const {
        activeCompanyId,
        activeBranchId,
        search = '',
        page = 1,
        pageSize = 10,
        sortColumn = 'VoucherNumber',
        sortDirection = 'desc'
      } = params;

      const skip = (page - 1) * pageSize;
      const take = Number(pageSize);

      const isSearchTextANumber = !isNaN(Number(search)) && search.trim() !== '';

      let normalizedCashBank = "";
      if(String(search).trim() === 'cash' || String(search).trim() === 'Cash'){
        normalizedCashBank = "C";
      } else if(String(search).trim() === 'bank' || String(search).trim() === 'Bank'){
        normalizedCashBank = "D";
      }

      const where: Prisma.VoucherHeaderWhereInput = {
        CompanyMasterSid: activeCompanyId,
        BranchMasterSid: activeBranchId,
        voucherTypeMaster: {
          DocumentTypeName: 'Receipt'
        },
        Status: 'A'
      };

      // Add search filter
      if (search) {
        where.OR = [
          { VoucherNumber: { contains: search, mode: 'insensitive' } },
          // { CashOrBank: { contains: normalizedCashBank, mode: 'insensitive' } },
          { PartyName: { contains: search, mode: 'insensitive' } },
          { CurrencyCode: { contains: search, mode: 'insensitive' } },
          { PostStatus: { contains: search, mode: 'insensitive' } },
          ...(!isNaN(new Date(search).getTime())
          ? [{ VoucherDate: new Date(search) }]
          : []),
          ...(isSearchTextANumber ? [{ LocalAmount: search }] : []),
        ];
      }

      const [items, totalCount] = await Promise.all([
        this._db.voucherHeader.findMany({
          where,
          include : {
            VoucherDetail : {
              orderBy : {Sno : 'asc'},
              take : 1,
              select : {
                LocalAmount : true,
              }
            }
          },
          orderBy : {
            VoucherHeaderSid : 'desc'
          },
          skip,
          take
        }),
        this._db.voucherHeader.count({ where })
      ]);


      return {
        items,
        totalCount,
        page: Number(page),
        pageSize: Number(pageSize)
      };
    } catch (error) {
      this.logger.error(`Error searching receipts: ${error.message}`);
      throw new InternalServerErrorException('Failed to search receipts');
    }
  }

  /**
 * Generate voucherma voucher number
 */
  private async generateVoucherMatchingHeaderNo(
    companySid: number,
    branchSid: number,
    prisma: any
  ): Promise<string> {
    const date = moment().format('YYYYMMDD');
    const count = await this._db.voucherMatchingHeader.count({
      where: {
        CompanyMasterSid: companySid,
        BranchMasterSid: branchSid,
        VoucherMatchingNo: { contains: `${date}` },
      },
      orderBy: { VoucherMatchingNo: 'desc' },
    });


    return `VMH-${date}-${(count + 1).toString().padStart(3, '0')}`;
  }

  
    /**
     * Helper: Converts Prisma Decimal to number
     */
    private toNumber(value: any): number {
      if (value === null || value === undefined) {
        return 0;
      }
      if (typeof value === 'number') {
        return value;
      }
      if (value instanceof Decimal) {
        return value.toNumber();
      }
      return parseFloat(value.toString()) || 0;
    }
  

}
