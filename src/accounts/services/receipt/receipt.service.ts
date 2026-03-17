import { Injectable, Logger, BadRequestException, NotFoundException, InternalServerErrorException } from '@nestjs/common';
import { DatabaseService } from 'src/database/database.service';
import { OutstandingService } from '../outstanding/outstanding.service';
import {
  SearchOutstandingDto,
  OutstandingInvoiceDto,
  ReceiptFilterDto,
} from '../../dto/receipt.dto';
import { Prisma, PrismaClient } from '@prisma/client';
import { VoucherService } from 'src/operation/services/voucher/voucher.service';
import moment from 'moment';
import { Decimal } from '@prisma/client/runtime/library';
import { roundAmount, statusWhereClause, toNumber } from 'src/common/helper';
import { CompanyConfigService } from 'src/masters/services/company/company-config.service';
import { DOC_TYPE_CODE } from 'src/common/config/voucher-type.config';

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
    private readonly voucherService: VoucherService,
    private companyConfigService : CompanyConfigService
  ) {}

  private ensureLocalDebitCreditBalance(
    rows: Array<{ DrCr?: string | null; LocalAmount?: number | string | Decimal | null }>,
    context: string,
  ) {
    let totalLocalDebits = 0;
    let totalLocalCredits = 0;

    (rows || []).forEach((row) => {
      const localAmount = toNumber(row?.LocalAmount ?? 0);
      if (String(row?.DrCr || '').toUpperCase() === 'D') {
        totalLocalDebits += localAmount;
      } else if (String(row?.DrCr || '').toUpperCase() === 'C') {
        totalLocalCredits += localAmount;
      }
    });

    const debitTotal = toNumber(totalLocalDebits.toFixed(2));
    const creditTotal = toNumber(totalLocalCredits.toFixed(2));

    if (debitTotal !== creditTotal) {
      throw new BadRequestException(
        `${context}: total local debit and credit must be equal. Debit: ${debitTotal}, Credit: ${creditTotal}`
      );
    }
  }

  /**
   * Search outstanding invoices using existing OutstandingService
   * REUSES the existing service as per user requirement
   */
  async searchOutstandingInvoices(searchDto: SearchOutstandingDto): Promise<OutstandingInvoiceDto[]> {
    this.logger.log(`Searching outstanding invoices with criteria: ${JSON.stringify(searchDto)}`);

    const skip = searchDto.Skip ?? 0;
    const take = searchDto.Take ?? 50;

    try {
      let invoices: OutstandingInvoiceDto[];

      // If searching by customer (most common case)
      if (searchDto.LedgerMasterSid) {
        const customerOutstanding = await this.outstandingService.getCustomerOutstanding(
          searchDto.CompanyMasterSid,
          searchDto.LedgerMasterSid,
          undefined,
          searchDto.BranchMasterSid,
          searchDto.LedgerType,
        );

        // Convert to OutstandingInvoiceDto format
        invoices = customerOutstanding.transactions.map((txn) => ({
          VoucherTransactionSid: txn.voucherTransactionSid,
          VoucherHeaderSid: txn.voucherHeaderSid,
          VoucherDetailSid: txn.voucherDetailSid,
          VoucherNumber: txn.voucherNumber,
          VoucherDate: typeof txn.voucherDate === 'string' ? txn.voucherDate : txn.voucherDate.toISOString(),
          VoucherTypeMasterSid: txn.voucherTypeMasterSid,
          COAMasterSid: txn.coaMasterSid!,
          VoucherType: txn.voucherTypeCode,
          LedgerMasterSid: txn.ledgerMasterSid!,
          CustomerName: customerOutstanding.customerName || '',
          OriginalCurrencyAmount: txn.originalCurrencyAmount,
          OriginalLocalAmount: txn.originalLocalAmount,
          MatchedAmount: txn.matchedLocalAmount,
          MatchedCurrencyAmount: txn.matchedCurrencyAmount,
          OutstandingLocalAmount: txn.outstandingLocalAmount,
          OutstandingCurrencyAmount: txn.outstandingCurrencyAmount,
          CurrencyCode: txn.currencyCode,
          ExchangeRate: txn.exchangeRate,
          DrCr: txn.drCr,
          ChargeDescription: txn.chargeDescription,
        }));
        let result = invoices;

        // Filter out fully paid if requested
        if (!searchDto.IncludeFullyPaid) {
          result = result.filter((inv) => Math.abs(inv.OutstandingCurrencyAmount) > 0 || Math.abs(inv.OutstandingLocalAmount) > 0);  // No tolerance
        }

        // Filter by DrCr if provided
        if (searchDto.DrCr) {
          result = result.filter((inv) => inv.DrCr === searchDto.DrCr);
        }

        // Sort by VoucherDate ascending
        result.sort((a, b) => new Date(b.VoucherDate).getTime() - new Date(a.VoucherDate).getTime());

        // Apply pagination
        if (searchDto.Skip !== undefined || searchDto.Take !== undefined) {
          const skip = searchDto.Skip || 0;
          const take = searchDto.Take || result.length;
          result = result.slice(skip, skip + take);
        }

        return result;
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
      ...(searchDto.BranchMasterSid ? { BranchMasterSid: searchDto.BranchMasterSid } : {}),
      subledgerMaster : {
        SubledgerType : 'Customer'
      },
      Status: 'A',
      ...(searchDto.LedgerType ? { coaMaster: { LedgerType: searchDto.LedgerType } } : {}),
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
      take: (searchDto.Skip ?? 0) + (searchDto.Take ?? 50) + 50, // Fetch enough to cover pagination + outstanding filtering
    });

    // Calculate outstanding for each transaction
    const results: OutstandingInvoiceDto[] = [];

    for (const txn of transactions) {
      const originalCurrencyAmount = this.toNumber(txn.Amount);
        const originalLocalAmount = this.toNumber(txn.LocalAmount);

        // Sum matched amounts for this transaction
        let matchedCurrencyAmount = 0;
        let matchedLocalAmount = 0;

        if (txn.voucherMatchings && txn.voucherMatchings.length > 0) {
          matchedCurrencyAmount = txn.voucherMatchings.reduce(
            (sum, m) => sum + this.toNumber(m.Amount),
            0,
          );
          matchedLocalAmount = txn.voucherMatchings.reduce(
            (sum, m) => sum + this.toNumber(m.LocalAmount),
            0,
          );
        }

        const outstandingCurrencyAmount = roundAmount(
          originalCurrencyAmount - matchedCurrencyAmount,
          2,
        );
        const outstandingLocalAmount = roundAmount(originalLocalAmount - matchedLocalAmount, 2);

      // Skip fully paid if not requested
      if (!searchDto.IncludeFullyPaid && outstandingCurrencyAmount <= 0) {
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
        MatchedAmount: matchedLocalAmount,
        MatchedCurrencyAmount: matchedCurrencyAmount, // Would need to sum currency amounts
        OutstandingLocalAmount: outstandingLocalAmount,
        OutstandingCurrencyAmount: outstandingCurrencyAmount,
        CurrencyCode: txn.CurrencyCode || 'INR',
        DrCr: txn.DrCr,
        ExchangeRate : txn.ExchangeRate || null,
        ChargeDescription : txn.ChargeDescription || '',
      });
    }

    return results.filter(r => (r.OutstandingLocalAmount > 0 || r.OutstandingCurrencyAmount > 0));
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
        Status : statusWhereClause
      },
      include: {
        VoucherDetail: {
          where : {
            Status : 'A'
          },
          orderBy : {
            Sno : 'asc'
          }
        },
        SourceMatchingDetail : {
          orderBy : { Sno : 'asc' }
        },
        voucherMatchingHeader : {
          select : {
            VoucherMatchingHeaderSid : true,
            VoucherMatchingNo : true
          }
        }
      },
    });

    if (!receipt) {
      throw new NotFoundException(`Receipt ${voucherHeaderSid} not found`);
    }

    const {SourceMatchingDetail,VoucherDetail,voucherMatchingHeader ,...VoucherHeader} = receipt;
    const formattedMatchingDetail = await Promise.all(SourceMatchingDetail.map(async (detail) => {
      const transactionDetail = await this._db.voucherTransaction.findUnique({
        where: { VoucherTransactionSid: detail.VoucherTransactionSid },
        select: {
          VoucherNumber: true,
          VoucherDate: true,
          VoucherTypeMasterSid: true,
          voucherTypeMaster: { select: { DocumentTypeCode: true } },
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

      const matchedAmount = transactionDetail.voucherMatchings.reduce(
        (sum, m) => {
          if(m.DrCr === 'C'){
            return sum + Number(m.Amount);
          }
          return sum + Number(m.Amount);
        }
      , 0);
      const matchedLocalAmount = transactionDetail.voucherMatchings.reduce(
        (sum, m) => {
          if(m.DrCr === 'C'){
            return sum + Number(m.LocalAmount);
          }
          return sum + Number(m.LocalAmount);
        }
      , 0);
      const outstandingAmount = Number(transactionDetail.Amount) - matchedAmount;
      const outstandingLocalAmount = Number(transactionDetail.LocalAmount) - matchedLocalAmount;
      

      return {
        VoucherMatchingHeaderSid: detail.VoucherMatchingHeaderSid,
        VoucherMatchingSid: detail.MatchingDetailSid,
        MatchingDetailSid : detail.MatchingDetailSid,
        VoucherTransactionSid: detail.VoucherTransactionSid,
        VoucherDetailSid: detail.VoucherDetailSid,
        VoucherHeaderSid: detail.VoucherHeaderSid,
        LedgerMasterSid: transactionDetail?.LedgerMasterSid,
        COAMasterSid: transactionDetail?.COAMasterSid,
        VoucherNumber: transactionDetail?.VoucherNumber,
        VoucherTypeMasterSid: transactionDetail?.VoucherTypeMasterSid,
        VoucherType: transactionDetail?.voucherTypeMaster?.DocumentTypeCode,
        VoucherDate: transactionDetail?.VoucherDate,
        DrCr: detail.DrCr,
        CurrencyCode : detail.CurrencyCode,
        ExchangeRate: detail.ExchangeRate || 1,
        OriginalCurrencyAmount: transactionDetail?.Amount,
        OriginalLocalAmount: transactionDetail?.LocalAmount,
        OutstandingCurrencyAmount: outstandingAmount,
        OutstandingLocalAmount: outstandingLocalAmount,
        MatchingCurrency : detail.MatchingCurrency,
        MatchingExRate : detail.MatchingExRate,
        MatchingAmount: detail.MatchingAmount,
        MatchingLocalAmount: detail.MatchingLocalAmount,
        MatchingTDSAmount : detail.MatchingTDSAmount,
        PartyAmount : detail.PartyAmount
      };
    }));

    return {
      ...VoucherHeader,
      VoucherDetail : VoucherDetail,
      VoucherMatchingHeader : voucherMatchingHeader,
      voucherMatchings : formattedMatchingDetail,
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
        const cashOrBankType = payload.CashOrBank === 'C' ? 'Cash' : 'Bank';
        let voucherType = await prisma.voucherTypeMaster.findFirst({
          where: {
            DocumentTypeCode : DOC_TYPE_CODE.RECEIPT,
            CompanyMasterSid: payload.CompanyMasterSid,
            BranchMasterSid: payload.BranchMasterSid,
            Type: cashOrBankType,
            status : 'A'
          },
        });
        if (!voucherType) {
          voucherType = await prisma.voucherTypeMaster.findFirst({
            where: {
              DocumentTypeCode : DOC_TYPE_CODE.RECEIPT,
              CompanyMasterSid: payload.CompanyMasterSid,
              BranchMasterSid: payload.BranchMasterSid,
              Type: 'Others',
              status : 'A'
            },
          });
        }
        if (!voucherType) {
          throw new BadRequestException('Receipt Voucher Type not found');
        }

        // 2. Generate voucher number using config-based approach
        const voucherNumber = await this.voucherService.generateVoucherNumberFromConfig(
          voucherType,
          payload.CompanyMasterSid,
          payload.BranchMasterSid,
          payload.YearMasterSid,
          prisma,
          payload.VoucherDate ? new Date(payload.VoucherDate) : undefined
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
            VoucherDate: payload.VoucherDate ? new Date(payload.VoucherDate) : new Date(), // ensure Date type
            VoucherType: voucherType.VoucherTypeMasterSid,
            PostDate: null,
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
          CostRevenue: item.DrCr === 'D' ? 'Cost' : 'Revenue',
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
          Amount: item.Amount ?? 0,
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
            PartyAmount : matching.PartyAmount,
            MatchingTDSAmount : matching.MatchingTDSAmount,
            SourceVoucherHeaderSid: voucherHeader.VoucherHeaderSid, // SourceVoucherHeaderSid(receipt)
          }
        });

        const finalMatchingDetails = await prisma.matchingDetail.createManyAndReturn({
          data: matchingDetails
        });

        // If the voucher type is configured for auto-posting, post within the same transaction
        if (voucherType.IsAutoPosting === 'Y') {
          const postResult = await this.executePostReceipt({
            voucherHeaderSid: voucherHeader.VoucherHeaderSid,
            companyMasterSid: payload.CompanyMasterSid,
            branchMasterSid: payload.BranchMasterSid,
            yearMasterSid: payload.YearMasterSid,
            localCurrencyMasterSid: payload.LocalCurrencyMasterSid,
            localCurrencyCode: payload.LocalCurrencyCode,
            current_date: payload.current_date,
            postedBy: payload.CreatedBy,
            taxDetails: payload.TaxDetails,
          }, prisma);
          return { voucherHeader: postResult, isAutoPosted: true };
        }

        return {
          voucherHeader,
          createdDetails,
          finalMatchingDetails,
          isAutoPosted: false,
        };
      }, { timeout: 60000 });
    } catch (error) {
      throw error;
    }
  }

  async updateReceipt(VoucherHeaderSid:number,payload: any) {
    try {
      return await this._db.$transaction(async (prisma) => {
        const {
          CompanyMasterSid,
          BranchMasterSid,
          YearMasterSid,
          updatedBy,
          VoucherDate,
          detailItems = [],
          voucherMatching = [],
        } = payload;

        if (!VoucherHeaderSid) {
          throw new BadRequestException('VoucherHeaderSid is required for update');
        }

        // 1. Fetch existing header
        const existingHeader = await prisma.voucherHeader.findUnique({
          where: { VoucherHeaderSid },
        });

        if (!existingHeader) {
          throw new BadRequestException('Receipt voucher not found');
        }

        if (existingHeader.PostStatus === 'P') {
          throw new BadRequestException('Posted vouchers cannot be modified');
        }

        // 2. Validate Voucher Type
        const cashOrBankType = payload.CashOrBank === 'C' ? 'Cash' : 'Bank';
        let voucherType = await prisma.voucherTypeMaster.findFirst({
          where: {
            DocumentTypeCode : DOC_TYPE_CODE.RECEIPT,
            CompanyMasterSid : payload.CompanyMasterSid,
            BranchMasterSid : payload.BranchMasterSid,
            Type: cashOrBankType,
            status : 'A'
          },
        });
        if (!voucherType) {
          voucherType = await prisma.voucherTypeMaster.findFirst({
            where: {
              DocumentTypeCode : DOC_TYPE_CODE.RECEIPT,
              CompanyMasterSid : payload.CompanyMasterSid,
              BranchMasterSid : payload.BranchMasterSid,
              Type: 'Others',
              status : 'A'
            },
          });
        }
        if (!voucherType) {
          throw new BadRequestException('Receipt Voucher Type not found');
        }

        // 3. Validate Financial Year
        const currentYear = await prisma.yearMaster.findFirst({
          where: {
            CompanyMasterSid,
            YearMasterSid,
            status: 'A',
          },
        });

        if (!currentYear) {
          throw new BadRequestException('Financial year not found');
        }

        const voucherDateObj = new Date(VoucherDate);
        const startDate = new Date(currentYear.StartDate);
        const endDate = new Date(currentYear.EndDate);

        if (voucherDateObj < startDate || voucherDateObj > endDate) {
          throw new BadRequestException(
            `Voucher date must be within financial year ${startDate.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]}`,
          );
        }

        // 4. Update VoucherHeader
        const updatedHeader = await prisma.voucherHeader.update({
          where: { VoucherHeaderSid },
          data: {
            UpdatedBy: payload.UpdatedBy,
            UpdatedOn: new Date(),
            VoucherDate: voucherDateObj,
            PostDate: null,
            Narration: payload.Narration || "",
            PartyMasterSid: payload.PartyMasterSid ?? existingHeader.PartyMasterSid,
            PartyName: payload.PartyName || "",
            PartyAddress: payload.PartyAddress || "",
            CustomerBranchSid: payload.CustomerBranchSid ?? null,
            PlaceOfSupply: payload.PlaceOfSupply || "",
            State: payload.State || "",
            COAMasterSid: payload.COAMasterSid ?? existingHeader.COAMasterSid,
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
            CashOrBank: payload.CashOrBank ?? existingHeader.CashOrBank,
            MultiBranch: payload.MultiBranch ?? existingHeader.MultiBranch,
          },
        });

        // ========================================
        // 5. Handle VoucherDetail: Update if ID exists, Create if not
        // ========================================
        const detailOperations = (detailItems || []).map(async (item: any,index : number) => {
          const commonData = {
            Sno : index + 1,
            ChargeMasterSid: item.ChargeMasterSid ?? null,
            ChargeDescription: item.ChargeDescription || null,
            LedgerMasterSid: item.LedgerMasterSid ?? null,
            COAMasterSid: item.COAMasterSid ?? null,
            HSSACMasterSid: item.HSSACMasterSid ?? null,
            DepartmentMasterSid: item.DepartmentMasterSid ?? null,
            HouseJobSid: item.HouseJobSid ?? null,
            MasterJobSid: item.MasterJobSid ?? null,
            CostRevenue: item.DrCr === 'D' ? 'Cost' : 'Revenue',
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
            Amount: item.Amount ?? 0,
            LocalAmount: item.LocalAmount ?? 0,
            InvoiceType: item.InvoiceType || "",
            CostCenter: item.CostCenter ?? null,
            ProfitCenter: item.ProfitCenter ?? null,
            Remarks: item.Remarks || "",
            ChargeUOMSid: item.ChargeUOMSid ?? null,
            YearMasterSid: currentYear?.YearMasterSid ?? null,
            PartyAmount: item.PartyAmount ?? 0,
            UpdatedBy: payload.UpdatedBy,
            UpdatedOn: new Date(),
          };
          if(!item.VoucherDetailSid){
            commonData['CreatedBy'] = payload.UpdatedBy;
          }

          if (item.VoucherDetailSid) {
            // Update existing detail
            return prisma.voucherDetail.update({
              where: { VoucherDetailSid: item.VoucherDetailSid },
              data: commonData,
            });
          } else {
            // Create new detail
            // const lastSno = await prisma.voucherDetail.findFirst({
            //   where: { VoucherHeaderSid },
            //   orderBy: { Sno: 'desc' },
            //   select: { Sno: true }
            // });

            return prisma.voucherDetail.create({
              data: {
                ...commonData,
                CreatedBy: payload.UpdatedBy,
                Status: 'A',
                CompanyMasterSid,
                BranchMasterSid,
                VoucherHeaderSid
              },
            });
          }
        });

        const updatedCreatedDetails = await Promise.all(detailOperations);

        const keptDetailSids = updatedCreatedDetails
          .map((detail: any) => Number(detail?.VoucherDetailSid))
          .filter((sid: number) => sid > 0);

        if ((detailItems || []).length > 0 && keptDetailSids.length === 0) {
          throw new BadRequestException('Failed to determine saved receipt detail rows during update');
        }

        await prisma.voucherDetail.updateMany({
          where: {
            VoucherHeaderSid,
            ...(keptDetailSids.length > 0 ? { VoucherDetailSid: { notIn: keptDetailSids } } : {}),
            Status: 'A',
          },
          data: {
            Status: 'D',
            UpdatedBy: payload.UpdatedBy || 'System',
            UpdatedOn: new Date(),
          },
        });

        // ========================================
        // 6. Handle MatchingDetail: Update if ID exists, Create if not
        // ========================================
        let matchingIndex = 1;
        const matchingOperations = voucherMatching.map(async (matching: any) => {
          const commonMatchingData = {
            Sno : matchingIndex++,
            VoucherHeaderSid: matching.VoucherHeaderSid,
            VoucherDetailSid: matching.VoucherDetailSid ?? null,
            VoucherTransactionSid: matching.VoucherTransactionSid ?? null,
            VoucherType: String(matching.VoucherType).toUpperCase().substring(0, 4),
            CurrencyCode: matching.CurrencyCode,
            ExchangeRate: matching.ExchangeRate,
            DrCr: String(matching.DrCr).toUpperCase().charAt(0),
            Amount: matching.Amount,
            LocalAmount: matching.LocalAmount,
            MatchingCurrency: matching.MatchingCurrency,
            MatchingExRate: matching.MatchingExRate,
            MatchingAmount: matching.MatchingAmount,
            MatchingLocalAmount: matching.MatchingLocalAmount,
            PartyAmount: matching.PartyAmount,
            MatchingTDSAmount: matching.MatchingTDSAmount,
            SourceVoucherHeaderSid: VoucherHeaderSid,
          };

          if (matching.MatchingDetailSid) {
            // Update existing matching
            return prisma.matchingDetail.update({
              where: { MatchingDetailSid: matching.MatchingDetailSid },
              data: commonMatchingData,
            });
          } else {
            // Create new matching
            return prisma.matchingDetail.create({
              data: {
                ...commonMatchingData,
              },
            });
          }
        });

        const updatedCreatedMatchings = await Promise.all(matchingOperations);

        return {
          voucherHeader: updatedHeader,
          details: updatedCreatedDetails,
          matchings: updatedCreatedMatchings,
          message: 'Receipt updated successfully',
        };
      },{timeout: 48000});
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(error.message || 'Failed to update receipt');
    }
  }

  /**
   * Executes the post-receipt logic within a provided transaction client.
   * Called by both postReceipt (own transaction) and createNewReceipt (same transaction, AutoPost).
   */
  private async executePostReceipt(
    payload: {
      voucherHeaderSid: number,
      companyMasterSid: number,
      branchMasterSid: number,
      yearMasterSid: number,
      localCurrencyMasterSid: number,
      localCurrencyCode: string,
      current_date?: Date | string,
      postedBy: string,
      taxDetails: {
        CountryMasterSid: number,
        countryCode: string,
        TaxCategory: 'Inter' | 'Intra',
        EffectiveFrom: Date,
        TaxType: 'Input' | 'Output',
      }
    },
    tx: Prisma.TransactionClient
  ) {
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
            subledgerMaster : {
              select : {SubledgerName : true}
            },
            SourceMatchingDetail: {
              orderBy: { Sno: 'asc' }
            },
            voucherTypeMaster: true
          }
        })
        
        if (!voucher) throw new BadRequestException('Voucher not found.');
        if (voucher.PostStatus === 'P') throw new BadRequestException('Voucher is already posted.');
        if (!voucher.VoucherDetail || voucher.VoucherDetail.length === 0) throw new BadRequestException('No detail lines are found.');
        if (!voucher.voucherTypeMaster) throw new BadRequestException('Voucher type is not found.');

        // Check if any transaction is already matched
        const validTransactions = voucher.SourceMatchingDetail.filter(d => toNumber(d.MatchingAmount) > 0 || toNumber(d.MatchingLocalAmount) > 0).map(d => d.VoucherTransactionSid);
        const { isValid, matchedTransactions } = await this.checkIfTransactionMatched(validTransactions, tx);

        if (!isValid) {
          throw new BadRequestException(`Already matched vouchers:\n${matchedTransactions.map(m => m.VoucherNumber).join('\n')}`);
        }
        
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
        
        const now = payload.current_date ? new Date(payload.current_date) : new Date();

        // Taking party amount from detail
        const allPartyDetails = VoucherDetail.filter(d => d.LedgerMasterSid === voucher.PartyMasterSid);
        const detailPartyAmount = toNumber((allPartyDetails || []).reduce((sum, detail) => {
          if(detail.DrCr === 'C'){
            return sum + Number(detail.PartyAmount);
            }
            return sum - Number(detail.PartyAmount);
          },
          0).toFixed(2));

        // Taking total party amount from matching
        const billMatchingPartyAmount = toNumber((SourceMatchingDetail || []).reduce((sum, matching) => {
          if(matching.DrCr === 'D'){
            return sum + Number(matching.PartyAmount);
          }
          return sum - Number(matching.PartyAmount);
        }, 0).toFixed(2));
        

        const billMatchingLocalAmount = toNumber((SourceMatchingDetail || []).reduce((sum, matching) => {
          if(matching.DrCr === 'D'){
            return sum + Number(matching.MatchingLocalAmount);
          }
          return sum - Number(matching.MatchingLocalAmount);
        }, 0).toFixed(2));

        // Proportional local amount for matched currency at receipt's exchange rate
        const matchedLocalAmount = toNumber((billMatchingPartyAmount * toNumber(voucher.ExchangeRate || 1)).toFixed(2));

        const allDetails = [...VoucherDetail];

        let partyExchangeJvDetail : any = null;

        if(billMatchingPartyAmount > 0){
          if(billMatchingLocalAmount !== matchedLocalAmount){
            // Exchange gain or loss exists
            const difference = Math.abs(billMatchingLocalAmount - matchedLocalAmount);
            const isGain = billMatchingLocalAmount < matchedLocalAmount;
            const coaMasterSid = toNumber(await this.companyConfigService.getConfigurationValue(payload.companyMasterSid, 'ExchangeJVCOA'));

            if(!coaMasterSid){
              throw new BadRequestException('Exchange gain/loss JV COA not configured in Company Config');
            }

            const exchangeGainOrLossDetail = await tx.voucherDetail.create({
              data: {
                CreatedBy: payload.postedBy,
                Status: 'A',
                CompanyMasterSid: payload.companyMasterSid,
                BranchMasterSid: payload.branchMasterSid,
                VoucherHeaderSid: voucher.VoucherHeaderSid,
                Sno: VoucherDetail.length + 1,
                ChargeMasterSid: null,
                ChargeDescription: '',
                LedgerMasterSid : null,
                COAMasterSid : coaMasterSid,
                HSSACMasterSid: null,
                DepartmentMasterSid: voucher.DepartmentMasterSid,
                HouseJobSid: voucher.HouseJobSid,
                MasterJobSid: voucher.MasterJobSid,
                CostRevenue: isGain ? 'Cost' : 'Revenue',
                CurrencyMasterSid: payload.localCurrencyMasterSid,
                CurrencyCode: payload.localCurrencyCode,
                NumberOfUnit: 1,
                ExchangeRate: 1,
                Rate: difference,
                Amount: difference,
                LocalAmount: difference,
                TaxableAmount: 0,
                DrCr: isGain ? 'C' : 'D',
                Narration: `Exchange ${isGain ? 'Gain' : 'Loss'} adjustment for receipt ${voucher.VoucherNumber}`,
                TaxPercentage1: 0,
                TaxAmount1: 0,
                TaxPercentage2: 0,
                TaxAmount2: 0,
                PartyAmount: 0,
                YearMasterSid: payload.yearMasterSid,
                IsAutoGenerated: 'Y',
              }
            });
            allDetails.push(exchangeGainOrLossDetail);

            partyExchangeJvDetail = await tx.voucherDetail.create({
              data : {
                CreatedBy: payload.postedBy,
                Status: 'A',
                CompanyMasterSid: payload.companyMasterSid,
                BranchMasterSid: payload.branchMasterSid,
                VoucherHeaderSid: voucher.VoucherHeaderSid,
                Sno: VoucherDetail.length + 2,
                ChargeMasterSid: null,
                ChargeDescription: "",
                LedgerMasterSid : voucher.PartyMasterSid,
                COAMasterSid : voucher.COAMasterSid!,
                DepartmentMasterSid: voucher.DepartmentMasterSid ?? null,
                HouseJobSid: voucher.HouseJobSid ?? null,
                MasterJobSid: voucher.MasterJobSid ?? null,
                CostRevenue: isGain ? 'Cost' : 'Revenue',
                CurrencyMasterSid : voucher.CurrencyMasterSid!,
                CurrencyCode : voucher.CurrencyCode!,
                NumberOfUnit : 1,
                ExchangeRate : voucher.ExchangeRate!,
                Rate : 0,
                Amount : 0,
                LocalAmount : difference,
                TaxableAmount : 0,
                DrCr : isGain ? 'D' : 'C',
                Narration : `Exchange ${isGain ? 'Gain' : 'Loss'} adjustment for party ${voucher.PartyName}`,
                TaxPercentage1 : 0,
                TaxAmount1 : 0,
                TaxPercentage2 : 0,
                TaxAmount2 : 0,
                PartyAmount : 0,
                YearMasterSid : payload.yearMasterSid,
                IsAutoGenerated : 'Y',
              }
            });
            allDetails.push(partyExchangeJvDetail);
          }
        }



        // Prepare VoucherTransaction payload array
        const voucherTransactionsPayload = allDetails.map((item, index) => ({
          CreatedBy: item.CreatedBy,
          Status: 'A',
          CompanyMasterSid: item.CompanyMasterSid,
          BranchMasterSid: item.BranchMasterSid,
          VoucherHeaderSid: voucher.VoucherHeaderSid,
          VoucherDetailSid: item.VoucherDetailSid,
          VoucherNumber: voucher.VoucherNumber,
          VoucherType: voucher.VoucherType,
          VoucherDate: voucher.VoucherDate ? new Date(voucher.VoucherDate) : now,
          PostDate: now,
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

        this.ensureLocalDebitCreditBalance(allTransactions, 'Receipt posting validation failed');

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

        await tx.matchingDetail.deleteMany({
          where: {
            SourceVoucherHeaderSid: voucher.VoucherHeaderSid,
            MatchingAmount: { equals: 0 },
            MatchingLocalAmount: { equals: 0 },
          }
        })

        const filteredDetails = SourceMatchingDetail.filter(matching => toNumber(matching.MatchingAmount) > 0 || toNumber(matching.MatchingLocalAmount) > 0);

        const allValidMatchings = await Promise.all(
          filteredDetails.map(async (matching) => {
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
                MatchingDetailSid : matching.MatchingDetailSid,
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
                PartyAmount : matching.PartyAmount,
                MatchingCurrency: matching.MatchingCurrency,
              }
            })
          );
        let newVoucherMatchings: any;
        if (billMatchingPartyAmount > 0 || billMatchingLocalAmount > 0) {

          // Adjust Party Detail Amount
          partyDetail.Amount = billMatchingPartyAmount;
          partyDetail.LocalAmount = matchedLocalAmount;
          const allSourceDetails = [partyDetail];
          const partyRowFromExJv = (allCompleteDetails || []).find(d => d.VoucherDetailSid === partyExchangeJvDetail?.VoucherDetailSid);
          if (partyRowFromExJv) {
            if (partyRowFromExJv.DrCr === partyDetail.DrCr) {
              // Same DrCr as party → stays on Source side
              allSourceDetails.push(partyRowFromExJv);
            } else {
              // Different DrCr → move to Object side
              allValidMatchings.push({
                MatchingDetailSid: 0,
                VoucherHeaderSid: voucher.VoucherHeaderSid,
                VoucherDetailSid: partyRowFromExJv.VoucherDetailSid,
                VoucherTransactionSid: partyRowFromExJv.VoucherTransactionSid,
                VoucherType: voucherTypeMaster.VoucherTypeMasterSid,
                COAMasterSid: partyRowFromExJv.COAMasterSid,
                LedgerMasterSid: partyRowFromExJv.LedgerMasterSid,
                CurrencyCode: partyRowFromExJv.CurrencyCode,
                ExchangeRate: partyRowFromExJv.ExchangeRate,
                DrCr: partyRowFromExJv.DrCr,
                Amount: partyRowFromExJv.Amount,
                LocalAmount: partyRowFromExJv.LocalAmount,
                PartyAmount: partyRowFromExJv.PartyAmount,
                MatchingCurrency: null,
              });
            }
          }

          newVoucherMatchings = await this.voucherService.createVoucherMatching({
            CompanyMasterSid: payload.companyMasterSid,
            BranchMasterSid: payload.branchMasterSid,
            VoucherHeaderSid: payload.voucherHeaderSid,
            SubledgerName : voucher?.subledgerMaster?.SubledgerName || '',
            VoucherTypeCode: voucher?.voucherTypeMaster.DocumentTypeCode,
            VoucherTypeMasterSid: voucher?.voucherTypeMaster.VoucherTypeMasterSid,
            VoucherMatchingDate : now ,
            PostDate: now ,
            YearMasterSid : payload.yearMasterSid,
            Narration: `${voucher.VoucherNumber} ${voucher.VoucherDate.toISOString().split('T')[0]} ${voucher.CurrencyCode} ${voucher.Amount}`,
            createdBy: payload.postedBy,
            voucherMatching: allValidMatchings,
            partyVoucherDetail: allSourceDetails,
            BillMatchingCurrencyAmount: billMatchingPartyAmount,
            BillMatchingLocalAmount: billMatchingLocalAmount,
            LocalCurrencyMasterSid: payload.localCurrencyMasterSid,
          }, tx);

          // Fix 5: Link MatchingDetail to new VoucherMatchingHeaderSid
          if (newVoucherMatchings?.VoucherMatchingHeaderSid) {
            const matchingDetailSids = filteredDetails.map(d => d.MatchingDetailSid);
            await tx.matchingDetail.updateMany({
              where: { MatchingDetailSid: { in: matchingDetailSids } },
              data: { VoucherMatchingHeaderSid: newVoucherMatchings.VoucherMatchingHeaderSid }
            });
          }
        } else if(billMatchingPartyAmount === 0) {
          //NOTE - if a receipt is matched with another receipt
          // Scenerio 1. Receipt in matching - 200 USD , Invoice in matching - 200 USD  // Here net will be 0
          // But still we need to create a matching record
          if (allValidMatchings.length > 0 ) {
            // Adjust Party Detail Amount
            if (billMatchingLocalAmount === 0) {
              partyDetail.Amount = billMatchingPartyAmount;
              partyDetail.LocalAmount = billMatchingLocalAmount;
              const allSourceDetails = [partyDetail];
              const partyRowFromExJv = (allCompleteDetails || []).find(d => d.VoucherDetailSid === partyExchangeJvDetail?.VoucherDetailSid);
              if (partyRowFromExJv) {
                if (partyRowFromExJv.DrCr === partyDetail.DrCr) {
                  allSourceDetails.push(partyRowFromExJv);
                } else {
                  allValidMatchings.push({
                    MatchingDetailSid: 0,
                    VoucherHeaderSid: voucher.VoucherHeaderSid,
                    VoucherDetailSid: partyRowFromExJv.VoucherDetailSid,
                    VoucherTransactionSid: partyRowFromExJv.VoucherTransactionSid,
                    VoucherType: voucherTypeMaster.VoucherTypeMasterSid,
                    COAMasterSid: partyRowFromExJv.COAMasterSid,
                    LedgerMasterSid: partyRowFromExJv.LedgerMasterSid,
                    CurrencyCode: partyRowFromExJv.CurrencyCode,
                    ExchangeRate: partyRowFromExJv.ExchangeRate,
                    DrCr: partyRowFromExJv.DrCr,
                    Amount: partyRowFromExJv.Amount,
                    LocalAmount: partyRowFromExJv.LocalAmount,
                    PartyAmount: partyRowFromExJv.PartyAmount,
                    MatchingCurrency: null,
                  });
                }
              }
              newVoucherMatchings = await this.voucherService.createVoucherMatching({
                CompanyMasterSid: payload.companyMasterSid,
                BranchMasterSid: payload.branchMasterSid,
                VoucherHeaderSid: payload.voucherHeaderSid,
                SubledgerName: voucher?.subledgerMaster?.SubledgerName || '',
                VoucherTypeCode: voucher?.voucherTypeMaster.DocumentTypeCode,
                VoucherTypeMasterSid: voucher?.voucherTypeMaster.VoucherTypeMasterSid,
                VoucherMatchingDate: now,
                PostDate: now,
                YearMasterSid: payload.yearMasterSid,
                Narration: `${voucher.VoucherNumber} ${voucher.VoucherDate.toISOString().split('T')[0]} ${voucher.CurrencyCode} ${voucher.Amount}`,
                createdBy: payload.postedBy,
                voucherMatching: allValidMatchings,
                partyVoucherDetail: allSourceDetails,
                BillMatchingCurrencyAmount: billMatchingPartyAmount,
                BillMatchingLocalAmount: billMatchingLocalAmount,
                LocalCurrencyMasterSid: payload.localCurrencyMasterSid,
              }, tx);

              // Fix 5: Link MatchingDetail to new VoucherMatchingHeaderSid
              if (newVoucherMatchings?.VoucherMatchingHeaderSid) {
                const matchingDetailSids = filteredDetails.map(d => d.MatchingDetailSid);
                await tx.matchingDetail.updateMany({
                  where: { MatchingDetailSid: { in: matchingDetailSids } },
                  data: { VoucherMatchingHeaderSid: newVoucherMatchings.VoucherMatchingHeaderSid }
                });
              }
            } else {
              throw new BadRequestException('Please make sure the net bill matching local amount is 0');
            }
          }
        }

        const finalPartyCurrency = allCompleteDetails.reduce((sum, detail) => {
          return detail.DrCr === 'D' ? sum + toNumber(detail.PartyAmount) : sum - toNumber(detail.PartyAmount);
        },0);

        const finalLocalAmount = allCompleteDetails.reduce((sum, detail) => {
          return detail.DrCr === 'D' ? sum + toNumber(detail.LocalAmount) : sum - toNumber(detail.LocalAmount);
        },0);

        
        const updatedVoucher = await tx.voucherHeader.update({
          where: {
            VoucherHeaderSid: voucher.VoucherHeaderSid
          },
          data: {
            Amount: finalPartyCurrency,
            LocalAmount: finalLocalAmount,
            PostStatus : 'P',
            PostDate: now,
            UpdatedBy: payload.postedBy
          }
        })

        return {
          ...updatedVoucher,
          voucherDetail: allCompleteDetails,
          voucherMatchings: newVoucherMatchings
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
      current_date?: Date | string,
      postedBy: string,
      taxDetails: {
        CountryMasterSid: number,
        countryCode: string,
        TaxCategory: 'Inter' | 'Intra',
        EffectiveFrom: Date,
        TaxType: 'Input' | 'Output',
      }
    }
  ) {
    try {
      return await this._db.$transaction(async (tx) => {
        return this.executePostReceipt(payload, tx);
      }, { timeout: 60000 });
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
          DocumentTypeCode : DOC_TYPE_CODE.RECEIPT
        },
        Status: statusWhereClause
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
              where : {
                coaMaster : {
                  OR : [
                    { LedgerType : 'Bank'},
                    { LedgerType : 'Cash'}
                  ]
                },
                Status : 'A'
              },
              orderBy : {Sno : 'asc'},
              take : 1,
              select : {
                PartyAmount : true,
              }
            }
          },
          orderBy : [
           { VoucherDate : 'desc'},
           { VoucherNumber : 'desc'}
          ],
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
  
  /**
   * Check if any voucher transaction is already fully matched.
   * Returns:
   *  - isValid = false → includes fully matched transactions
   *  - isValid = true → doesn't include any fully matched transactions
   *  - matchedTransactions → list of already matched VoucherTransactionSid
   */
  async checkIfTransactionMatched(
    transactions: number[],
    prisma?: Prisma.TransactionClient
  ): Promise<{ isValid: boolean; matchedTransactions: any[] }> {
    const txn = prisma || this._db;
    try {
      const allTransactions = await txn.voucherTransaction.findMany({
        where: {
          VoucherTransactionSid: { in: transactions },
          Status: 'A'
        },
        include: {
          voucherMatchings: true
        }
      });

      const matchedTransactions: any[] = [];

      for (const vt of allTransactions) {
        const totalMatchingCurrAmount = vt.voucherMatchings.reduce((sum, m) => {
          return m.DrCr === 'D'
            ? sum + toNumber(m.Amount)
            : sum - toNumber(m.Amount);
        }, 0);

        const totalMatchingLocalAmount = vt.voucherMatchings.reduce((sum, m) => {
          return m.DrCr === 'D'
            ? sum + toNumber(m.LocalAmount)
            : sum - toNumber(m.LocalAmount);
        }, 0);

        const remainingCurr =
          toNumber(vt.Amount) - totalMatchingCurrAmount;

        const remainingLocal =
          toNumber(vt.LocalAmount) - totalMatchingLocalAmount;

        /**
         * Already matched condition:
         * remainingCurr <= 0 AND remainingLocal <= 0
         */
        if (remainingCurr <= 0 && remainingLocal <= 0) {
          matchedTransactions.push({
            VoucherTransactionSid: vt.VoucherTransactionSid,
            VoucherNumber: vt.VoucherNumber
          });
        }
      }

      // If any transaction is already matched → return false
      if (matchedTransactions.length > 0) {
        return {
          isValid: false,
          matchedTransactions
        };
      }

      // Otherwise all have outstanding
      return {
        isValid: true,
        matchedTransactions
      };

    } catch (error) {
      throw error;
    }
  }

}
