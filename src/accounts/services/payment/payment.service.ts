import { BadRequestException, Injectable, InternalServerErrorException, Logger, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { DatabaseService } from 'src/database/database.service';
import { OutstandingService } from '../outstanding/outstanding.service';
import { VoucherService } from 'src/accounts/services/voucher/voucher.service';
import { OutstandingInvoiceDto, SearchOutstandingDto } from 'src/accounts/dto/receipt.dto';
import { Prisma } from '@prisma/client';
import { roundAmount, statusWhereClause, toNumber } from 'src/common/helper';
import { CompanyConfigService } from 'src/masters/services/company/company-config.service';
import { DOC_TYPE_CODE } from 'src/common/config/voucher-type.config';
import { TdsCalculationService } from '../tds-calculation/tds-calculation.service';
import { InterBranchService } from '../inter-branch/inter-branch.service';
import { extractVoucherValidationMessage, DbTriggerValidationException } from 'src/common/db-validation-error.helper';

@Injectable()
export class PaymentService {
    private readonly logger = new Logger(PaymentService.name);

    constructor(
        private readonly _db: DatabaseService,
        private readonly outstandingService: OutstandingService, // REUSE existing service
        private readonly voucherService: VoucherService,
        private readonly companyConfigService : CompanyConfigService,
        private readonly tdsCalculation : TdsCalculationService,
        private readonly interBranchService: InterBranchService
    ) { }

    private ensureLocalDebitCreditBalance(
        rows: Array<{ DrCr?: string | null; LocalAmount?: number | string | Prisma.Decimal | null }>,
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
        this.logger.log(`Searching outstanding vendor invoices with criteria: ${JSON.stringify(searchDto)}`);

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
                    searchDto.VoucherDateTo,
                );

                // Convert to OutstandingInvoiceDto format
                invoices = customerOutstanding.transactions.map((txn) => ({
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
                    OutstandingLocalAmount: txn.outstandingLocalAmount,
                    OutstandingCurrencyAmount: txn.outstandingCurrencyAmount,
                    CurrencyCode: txn.currencyCode,
                    ExchangeRate: txn.exchangeRate,
                    DrCr: txn.drCr,
                    ChargeDescription: txn.chargeDescription,
                    Narration: txn.narration,
                    BranchMasterSid: txn.branchMasterSid,
                    BranchName: txn.branchName,
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

                // Sort by VoucherDate descending; VoucherTransactionSid tiebreaker makes it a deterministic
                // total order so the page window stays stable across paginated calls (equal dates must not
                // reorder, or rows skip/duplicate at page boundaries).
                result.sort((a, b) => new Date(b.VoucherDate).getTime() - new Date(a.VoucherDate).getTime() || b.VoucherTransactionSid - a.VoucherTransactionSid);

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
            // Item 6 — only OS dated on/before the voucher date (backdated payment/receipt).
            ...(searchDto.VoucherDateTo ? { VoucherDate: { lte: new Date(searchDto.VoucherDateTo) } } : {}),
        };

        // Build dynamic where clause based on search criteria
        if (searchDto.VendorInvoiceNumber) {
            whereConditions.VoucherHeader = {
                VoucherNumber: { contains: searchDto.VendorInvoiceNumber, mode: 'insensitive' },
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
            const originalCurrencyAmount = toNumber(txn.Amount);
        const originalLocalAmount = toNumber(txn.LocalAmount);

        // Sum matched amounts for this transaction
        let matchedCurrencyAmount = 0;
        let matchedLocalAmount = 0;

        if (txn.voucherMatchings && txn.voucherMatchings.length > 0) {
          matchedCurrencyAmount = txn.voucherMatchings.reduce(
            (sum, m) => sum + toNumber(m.Amount),
            0,
          );
          matchedLocalAmount = txn.voucherMatchings.reduce(
            (sum, m) => sum + toNumber(m.LocalAmount),
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
                Narration : txn.Narration || '',
            });
        }

        return results.filter(r => (r.OutstandingLocalAmount > 0 || r.OutstandingCurrencyAmount > 0));
    }


    /**
     * Get Payment by ID
     */
    async getPaymentById(voucherHeaderSid: number, companyMasterSid: number, branchMasterSid: number) {
        const payment = await this._db.voucherHeader.findUnique({
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
                    },
                    include: {
                        masterJob: {
                            select: {
                                MasterJobSid: true,
                                MasterJobNumber: true,
                                MBLNo: true,
                            }
                        },
                        houseJob: {
                            select: {
                                HouseJobSid: true,
                                HBLNo: true,
                            }
                        }
                    }
                },
                SourceMatchingDetail : {
                    where : { AllotmentBranchSid : null }, // source matches only; staged inter-branch matches load via getAllocations
                    orderBy : { Sno : 'asc' }
                },
                voucherMatchingHeader : {
                    select : {
                        VoucherMatchingHeaderSid : true,
                        VoucherMatchingNo : true
                    }
                },
                VoucherTDS : {
                    where : { Status : 'A' },
                    include : {
                        TDSSetRate : {
                            select : {
                                TDSSetRateSid : true,
                                TDSSetHeaderSid : true,
                                CompanyType : true,
                                ITSectionCode : true,
                                TDSRate : true,
                            }
                        }
                    }
                }
            },
        });

        if (!payment) {
            throw new UnauthorizedException('Access denied');
        }

        const { SourceMatchingDetail, VoucherDetail,voucherMatchingHeader, ...VoucherHeader } = payment;
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
                    BranchMasterSid: true,
                    BranchMaster: { select: { branchName: true } },
                    Amount: true,
                    LocalAmount: true,
                    Narration: true,
                    voucherMatchings: { where: { Status: 'A' } },
                    VoucherHeader : {
                        select : {
                            DocumentNumber : true,
                            DocumentDate : true
                        }
                    }
                }
            });

            if (!transactionDetail) {
                throw new NotFoundException(`Transaction not found`);
            }

            const matchedAmount = transactionDetail.voucherMatchings.reduce(
                (sum, m) => {
                    if (m.DrCr === 'D') {
                        return sum + Number(m.Amount);
                    }
                    return sum + Number(m.Amount);
                }
            , 0);
            const matchedLocalAmount = transactionDetail.voucherMatchings.reduce(
                (sum, m) => {
                    if (m.DrCr === 'D') {
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
                BillNo : transactionDetail?.VoucherHeader?.DocumentNumber,
                BillDate : transactionDetail?.VoucherHeader?.DocumentDate,
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
                PartyAmount : detail.PartyAmount,
                BranchName: detail.BranchName || (transactionDetail as any)?.BranchMaster?.branchName || '',
                Narration: transactionDetail?.Narration,
            };
        }));

        return {
            ...VoucherHeader,
            VoucherDetail : VoucherDetail,
            VoucherMatchingHeader : voucherMatchingHeader,
            voucherMatchings : formattedMatchingDetail
        };
    }

    /**
     * Guard for multiple creditor (Sy Cr) party rows on a payment.
     *  - Extra party rows are allowed ONLY on cash payments (CashOrBank = 'C'). On a cash payment the
     *    header party is bill-matched; every other creditor row posts as an on-account advance.
     *  - When a header party is set, exactly one row must be that party.
     *  - The same party must not appear on more than one row.
     */
    private async validatePaymentPartyRows(
        prisma: Prisma.TransactionClient,
        payload: any,
        details: any[],
    ): Promise<void> {
        const rows = details || [];
        if (!rows.length) return;

        const coaSids = [...new Set(rows.map((d) => Number(d.COAMasterSid)).filter(Boolean))];
        if (!coaSids.length) return;
        const coas = await prisma.cOAMaster.findMany({
            where: { COAMasterSid: { in: coaSids } },
            select: { COAMasterSid: true, LedgerType: true },
        });
        const typeByCoa = new Map(
            coas.map((c) => [Number(c.COAMasterSid), String(c.LedgerType || '').trim()]),
        );
        const partyRows = rows.filter((d) => typeByCoa.get(Number(d.COAMasterSid)) === 'Sy Cr');

        // A: extra party rows are cash-only
        if (payload.CashOrBank !== 'C' && partyRows.length > 1) {
            throw new BadRequestException('Multiple party rows are only allowed on cash payments.');
        }
        // B: exactly one party row must be the main (header) party
        if (payload.PartyMasterSid) {
            const headerMatches = partyRows.filter(
                (d) => Number(d.LedgerMasterSid) === Number(payload.PartyMasterSid),
            );
            if (headerMatches.length !== 1) {
                throw new BadRequestException('Exactly one detail row must be the main (header) party.');
            }
        }
        // C: no duplicate party across rows
        const ledgers = partyRows.map((d) => Number(d.LedgerMasterSid));
        if (new Set(ledgers).size !== ledgers.length) {
            throw new BadRequestException('The same party appears on more than one row.');
        }
    }

    async createNewPayment(payload: any) {
        try {
            return await this._db.$transaction(async (prisma) => {

                // 1. Get VoucherType for 'payment'
                const cashOrBankType = payload.CashOrBank === 'C' ? 'Cash' : 'Bank';
                let voucherType = await prisma.voucherTypeMaster.findFirst({
                    where: {
                        DocumentTypeCode : DOC_TYPE_CODE.PAYMENT,
                        CompanyMasterSid : payload.CompanyMasterSid,
                        BranchMasterSid : payload.BranchMasterSid,
                        Type: cashOrBankType,
                        status : 'A'
                    },
                });
                if (!voucherType) {
                    voucherType = await prisma.voucherTypeMaster.findFirst({
                        where: {
                            DocumentTypeCode : DOC_TYPE_CODE.PAYMENT,
                            CompanyMasterSid : payload.CompanyMasterSid,
                            BranchMasterSid : payload.BranchMasterSid,
                            Type: 'Others',
                            status : 'A'
                        },
                    });
                }
                if (!voucherType) {
                    throw new BadRequestException('Payment Voucher Type not found. Please configure VoucherTypeMaster for this company/branch.');
                }

                let paymentRequest: any = null;
                if (payload.PaymentRequestSid) {
                    paymentRequest = await prisma.paymentRequest.findUnique({
                        where: { PaymentRequestSid: Number(payload.PaymentRequestSid) },
                    });

                    if (!paymentRequest) {
                        throw new BadRequestException('Payment request not found');
                    }

                    if (paymentRequest.PaymentRequestStatus !== 'Approved') {
                        throw new BadRequestException('Payment request is not approved yet');
                    }

                    if (paymentRequest.VoucherSid) {
                        throw new BadRequestException('Payment voucher already created for this payment request');
                    }
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

                // 4. Create VoucherHeader for payment
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
                        // PR-converted payments settle operational charges / expenses.
                        // Party FK fields are intentionally null — party ledger, sub-ledger, and
                        // COA do not apply, and must not trigger outstanding or sub-ledger logic.
                        PartyMasterSid: payload.PaymentRequestSid ? null : payload.PartyMasterSid,
                        PartyName: payload.PaymentRequestSid ? "" : (payload.PartyName || ""),
                        PartyAddress: payload.PaymentRequestSid ? "" : (payload.PartyAddress || ""),
                        CustomerBranchSid: payload.PaymentRequestSid ? null : (payload.CustomerBranchSid ?? null),
                        PlaceOfSupply: payload.PlaceOfSupply || "",
                        State: payload.State || "",
                        COAMasterSid: payload.PaymentRequestSid ? null : payload.COAMasterSid,
                        BankCOA: payload.BankCOA ?? null,
                        BankPartyName: payload.PaymentRequestSid ? (paymentRequest?.PayableTo || payload.BankPartyName || "") : (payload.BankPartyName || ""),
                        GST_VAT: payload.PaymentRequestSid ? "" : (payload.GST_VAT || ""),
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
                        BookingHeaderSid: payload.BookingHeaderSid ?? null,
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
                        //TODO - need to remove
                        UpdatedOn : new Date()
                    }
                });

                // 5. Prepare VoucherDetail payload array
                // No filtering needed — the frontend sends the exact rows to persist,
                // including the party row for PR-converted payments.
                const detailItems = payload.detailItems || [];
                await this.validatePaymentPartyRows(prisma, payload, detailItems);
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
                    CostRevenue: item.DrCr === 'C' ? 'Revenue' : 'Cost',
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
                    CostRevenueChargesSid: item.CostRevenueChargesSid ?? null,
                    SourceDetailSid: item.SourceDetailSid ?? null,
                }));

                // 6. Create VoucherDetail for Payment
                const createdDetails = await prisma.voucherDetail.createManyAndReturn({
                    data: allDetailPayload,
                });

                // Stamp CostVoucherHeaderSid / CostVoucherTypeMasterSid on charge rows linked at creation
                const newCostChargeIds = detailItems
                    .filter((i: any) => i.CostRevenueChargesSid)
                    .map((i: any) => Number(i.CostRevenueChargesSid));
                if (newCostChargeIds.length > 0) {
                    await prisma.costRevenueCharges.updateMany({
                        where: { CostRevenueChargesSid: { in: newCostChargeIds } },
                        data: {
                            CostVoucherHeaderSid: voucherHeader.VoucherHeaderSid,
                            CostVoucherTypeMasterSid: voucherType.VoucherTypeMasterSid,
                            updatedOn: new Date(),
                            updatedBy: payload.CreatedBy,
                        },
                    });
                }
                const newBookingRateIds = detailItems
                    .filter((i: any) => i.BookingRatesSid)
                    .map((i: any) => Number(i.BookingRatesSid));
                if (newBookingRateIds.length > 0) {
                    await prisma.bookingRates.updateMany({
                        where: { BookingRatesSid: { in: newBookingRateIds } },
                        data: {
                            CostVoucherHeaderSid: voucherHeader.VoucherHeaderSid,
                            CostVoucherTypeMasterSid: voucherType.VoucherTypeMasterSid,
                            UpdatedOn: new Date(),
                            UpdatedBy: payload.CreatedBy,
                        },
                    });
                }

                // Build currency decimal map for rate rounding
                const rateItems = detailItems.filter((i: any) => i.CostRevenueChargesSid || i.BookingRatesSid);
                const rateCurrencyCodes = [...new Set(
                    rateItems.map((i: any) => (i.CurrencyCode || payload.CurrencyCode || '').trim())
                )].filter(Boolean) as string[];
                const rateCurrencyMasters = rateCurrencyCodes.length > 0
                    ? await prisma.currencyMaster.findMany({
                        where: { currencyCode: { in: rateCurrencyCodes } },
                        select: { currencyCode: true, amountDecimal: true },
                      })
                    : [];
                const rateCurrencyDecimalMap = new Map(rateCurrencyMasters.map(c => [c.currencyCode, c.amountDecimal]));

                // Sync cost amounts back to charge rows (PR-only, respects DisableRateUpdateBack)
                if (payload.PaymentRequestSid) {
                    const disableRateUpdateBack = await this.companyConfigService.getConfigurationValue(
                        payload.CompanyMasterSid, 'DisableRateUpdateBack', prisma
                    );
                    if (disableRateUpdateBack !== 'Y') {
                        for (const item of detailItems) {
                            const itemCurrencyCode = (item.CurrencyCode || payload.CurrencyCode || '').trim();
                            const itemDecimals = rateCurrencyDecimalMap.get(itemCurrencyCode) ?? 2;
                            const computedRate = toNumber(item.NumberOfUnit) !== 0
                                ? roundAmount(toNumber(item.Amount) / toNumber(item.NumberOfUnit), itemDecimals)
                                : roundAmount(toNumber(item.Amount), itemDecimals);
                            if (item.CostRevenueChargesSid) {
                                await prisma.costRevenueCharges.update({
                                    where: { CostRevenueChargesSid: Number(item.CostRevenueChargesSid) },
                                    data: {
                                        CostRate: computedRate,
                                        CostAmount: toNumber(item.Amount),
                                        CostLocalAmount: toNumber(item.LocalAmount),
                                        updatedOn: new Date(),
                                        updatedBy: payload.CreatedBy,
                                    },
                                });
                            }
                            if (item.BookingRatesSid) {
                                await prisma.bookingRates.update({
                                    where: { BookingRatesSid: Number(item.BookingRatesSid) },
                                    data: {
                                        CostRate: computedRate,
                                        CostAmount: toNumber(item.Amount),
                                        CostLocalAmount: toNumber(item.LocalAmount),
                                        UpdatedOn: new Date(),
                                        UpdatedBy: payload.CreatedBy,
                                    },
                                });
                            }
                        }
                    }
                }

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
                        MatchingAmount: matching.MatchingAmount,  // MatchingAmount(user input/payment)
                        MatchingLocalAmount: matching.MatchingLocalAmount,       // MatchingLocalAmount(user input / payment)
                        PartyAmount : matching.PartyAmount,
                        MatchingTDSAmount : matching.MatchingTDSAmount,
                        SourceVoucherHeaderSid: voucherHeader.VoucherHeaderSid, // SourceVoucherHeaderSid(payment)
                        CreatedBy: payload.createdBy,
                        CreatedOn: new Date()
                    }
                });

                const finalMatchingDetails = await prisma.matchingDetail.createManyAndReturn({
                    data: matchingDetails
                });

                // TDS deduction (VoucherDetailSid backfilled at post time).
                // Always persist when tdsDetail is present — even TDSAmount=0 rows are needed
                // so the backend's cumulative TaxableAmount aggregation stays accurate and
                // threshold triggers fire correctly on future payments.
                if (payload.tdsDetail) {
                    await this.tdsCalculation.createVoucherTDS({
                        CompanyMasterSid: payload.CompanyMasterSid,
                        BranchMasterSid: payload.BranchMasterSid,
                        VoucherHeaderSid: voucherHeader.VoucherHeaderSid,
                        VoucherDetailSid: null,
                        TDSSetRateSid: payload.tdsDetail.TDSSetRateSid,
                        ITSectionCode: payload.tdsDetail.ITSectionCode,
                        TDSRate: payload.tdsDetail.TDSRate,
                        TaxableAmount: payload.tdsDetail.TaxableAmount,
                        TDSAmount: payload.tdsDetail.TDSAmount,
                        TDSPartyAmount: payload.tdsDetail.TDSPartyAmount ?? null,
                        Reason: payload.tdsDetail.Reason ?? null,
                        CertificateNo: payload.tdsDetail.CertificateNo ?? null,
                        NotificationNo: payload.tdsDetail.NotificationNo ?? null,
                        CreatedBy: payload.CreatedBy,
                        Status: 'A',
                    }, prisma);
                }

                if (voucherType.IsAutoPosting === 'Y') {
                    if (payload.PaymentRequestSid) {
                        await prisma.paymentRequest.update({
                            where: { PaymentRequestSid: Number(payload.PaymentRequestSid) },
                            data: {
                                VoucherSid: voucherHeader.VoucherHeaderSid,
                                UpdatedBy: payload.CreatedBy,
                            },
                        });
                    }
                    const postResult = await this.executePostPayment({
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

                if (payload.PaymentRequestSid) {
                    await prisma.paymentRequest.update({
                        where: { PaymentRequestSid: Number(payload.PaymentRequestSid) },
                        data: {
                            VoucherSid: voucherHeader.VoucherHeaderSid,
                            UpdatedBy: payload.CreatedBy,
                        },
                    });
                }

                return {
                    voucherHeader,
                    createdDetails,
                    finalMatchingDetails,
                    isAutoPosted: false,
                };
            }, { timeout: 60000 });
        } catch (error) {
            const vmsg = extractVoucherValidationMessage(error);
            if (vmsg) {
                throw new DbTriggerValidationException(vmsg);
            }
            throw error;
        }
    }

    async updatePayment(VoucherHeaderSid: number, payload: any) {
        try {
            return await this._db.$transaction(async (prisma) => {
                let {
                    CompanyMasterSid,
                    BranchMasterSid,
                    YearMasterSid,
                    VoucherDate,
                    detailItems = [],
                    voucherMatching = [],
                } = payload;
                
                const updatedBy = payload.UpdatedBy ?? payload.updatedBy;

                if (!VoucherHeaderSid) {
                    throw new BadRequestException('VoucherHeaderSid is required for update');
                }

                // 1. Fetch existing header
                const existingHeader = await prisma.voucherHeader.findUnique({
                    where: { VoucherHeaderSid },
                });

                if (!existingHeader) {
                    throw new BadRequestException('Payment voucher not found');
                }

                if (existingHeader.PostStatus === 'P') {
                    throw new BadRequestException('Posted vouchers cannot be modified');
                }

                const paymentRequestSid = payload.PaymentRequestSid || existingHeader.ReversalVoucher;
                let paymentRequest: any = null;
                if (paymentRequestSid) {
                    paymentRequest = await prisma.paymentRequest.findUnique({
                        where: { PaymentRequestSid: Number(paymentRequestSid) },
                    });
                }
                const isPaymentRequestPayment = !!paymentRequest;
                detailItems = (detailItems || []).filter((item: any) => {
                    if (!isPaymentRequestPayment) return true;
                    const isPaymentRequestPartyRow =
                        payload.PartyMasterSid &&
                        item.LedgerMasterSid === payload.PartyMasterSid &&
                        !item.SourceDetailSid &&
                        !item.ChargeMasterSid &&
                        item.COAMasterSid !== payload.BankCOA;
                    return !isPaymentRequestPartyRow;
                });

                await this.validatePaymentPartyRows(prisma, payload, detailItems);

                // 2. Validate Voucher Type
                const cashOrBankType = payload.CashOrBank === 'C' ? 'Cash' : 'Bank';
                let voucherType = await prisma.voucherTypeMaster.findFirst({
                    where: {
                        DocumentTypeCode : DOC_TYPE_CODE.PAYMENT,
                        CompanyMasterSid : payload.CompanyMasterSid,
                        BranchMasterSid : payload.BranchMasterSid,
                        Type: cashOrBankType,
                        status : 'A'
                    },
                });
                if (!voucherType) {
                    voucherType = await prisma.voucherTypeMaster.findFirst({
                        where: {
                            DocumentTypeCode : DOC_TYPE_CODE.PAYMENT,
                            CompanyMasterSid : payload.CompanyMasterSid,
                            BranchMasterSid : payload.BranchMasterSid,
                            Type: 'Others',
                            status : 'A'
                        },
                    });
                }
                if (!voucherType) {
                    throw new BadRequestException('Payment Voucher Type not found');
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
                        UpdatedBy: updatedBy,
                        UpdatedOn: new Date(),
                        VoucherDate: voucherDateObj,
                        PostDate: null,
                        Narration: payload.Narration || "",
                        PartyMasterSid: isPaymentRequestPayment ? null : (payload.PartyMasterSid ?? existingHeader.PartyMasterSid),
                        PartyName: isPaymentRequestPayment ? "" : (payload.PartyName || ""),
                        PartyAddress: isPaymentRequestPayment ? "" : (payload.PartyAddress || ""),
                        CustomerBranchSid: isPaymentRequestPayment ? null : (payload.CustomerBranchSid ?? null),
                        PlaceOfSupply: payload.PlaceOfSupply || "",
                        State: payload.State || "",
                        COAMasterSid: isPaymentRequestPayment ? null : (payload.COAMasterSid ?? existingHeader.COAMasterSid),
                        BankCOA: payload.BankCOA ?? null,
                        BankPartyName: isPaymentRequestPayment ? (paymentRequest?.PayableTo || payload.BankPartyName || "") : (payload.BankPartyName || ""),
                        GST_VAT: payload.GST_VAT || "",
                        InvoiceType: payload.InvoiceType || "",
                        ReversalVoucher: isPaymentRequestPayment ? paymentRequestSid : (payload.ReversalVoucher ?? existingHeader.ReversalVoucher ?? null),
                        TaxNumber: payload.TaxNumber ?? null,
                        GSTType: payload.GSTType || "",
                        Remarks: payload.Remarks || "",
                        DepartmentMasterSid: payload.DepartmentMasterSid ?? null,
                        HouseNumber: payload.HouseNumber || "",
                        MasterNumber: payload.MasterNumber || "",
                        HouseJobSid: payload.HouseJobSid ?? null,
                        MasterJobSid: payload.MasterJobSid ?? null,
                        BookingHeaderSid: payload.BookingHeaderSid ?? null,
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
                        CostRevenueChargesSid: item.CostRevenueChargesSid ?? null,
                        YearMasterSid: currentYear?.YearMasterSid ?? null,
                        PartyAmount: item.PartyAmount ?? 0,
                        UpdatedBy: updatedBy,
                        UpdatedOn: new Date(),
                    };
                    if (!item.VoucherDetailSid) {
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
                        //     where: { VoucherHeaderSid },
                        //     orderBy: { Sno: 'desc' },
                        //     select: { Sno: true }
                        // });

                        return prisma.voucherDetail.create({
                            data: {
                                ...commonData,
                                CreatedBy: updatedBy,
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
                    throw new BadRequestException('Failed to determine saved payment detail rows during update');
                }

                await prisma.voucherDetail.updateMany({
                    where: {
                        VoucherHeaderSid,
                        ...(keptDetailSids.length > 0 ? { VoucherDetailSid: { notIn: keptDetailSids } } : {}),
                        Status: 'A',
                    },
                    data: {
                        Status: 'D',
                        UpdatedBy: updatedBy || 'System',
                        UpdatedOn: new Date(),
                    },
                });

                // Stamp CostVoucherHeaderSid / CostVoucherTypeMasterSid only for newly created detail rows
                const newlyCreatedItems = (detailItems || []).filter((i: any) => !i.VoucherDetailSid);
                const newCostChargeIds2 = newlyCreatedItems
                    .filter((i: any) => i.CostRevenueChargesSid)
                    .map((i: any) => Number(i.CostRevenueChargesSid));
                if (newCostChargeIds2.length > 0) {
                    await prisma.costRevenueCharges.updateMany({
                        where: { CostRevenueChargesSid: { in: newCostChargeIds2 } },
                        data: {
                            CostVoucherHeaderSid: VoucherHeaderSid,
                            CostVoucherTypeMasterSid: voucherType.VoucherTypeMasterSid,
                            updatedOn: new Date(),
                            updatedBy: updatedBy,
                        },
                    });
                }
                const newBookingRateIds2 = newlyCreatedItems
                    .filter((i: any) => i.BookingRatesSid)
                    .map((i: any) => Number(i.BookingRatesSid));
                if (newBookingRateIds2.length > 0) {
                    await prisma.bookingRates.updateMany({
                        where: { BookingRatesSid: { in: newBookingRateIds2 } },
                        data: {
                            CostVoucherHeaderSid: VoucherHeaderSid,
                            CostVoucherTypeMasterSid: voucherType.VoucherTypeMasterSid,
                            UpdatedOn: new Date(),
                            UpdatedBy: updatedBy,
                        },
                    });
                }

                // Sync cost amounts back to charge rows (only if changed, respects DisableRateUpdateBack)
                const costRevenueRateMap = new Map<number, { Rate: number; Amount: number; LocalAmount: number }>();
                const bookingRateMap = new Map<number, { Rate: number; Amount: number; LocalAmount: number }>();

                // Build currency decimal map for rate rounding
                const rateItems2 = detailItems.filter((i: any) => i.CostRevenueChargesSid || i.BookingRatesSid);
                const rateCurrencyCodes2 = [...new Set(
                    rateItems2.map((i: any) => (i.CurrencyCode || payload.CurrencyCode || '').trim())
                )].filter(Boolean) as string[];
                const rateCurrencyMasters2 = rateCurrencyCodes2.length > 0
                    ? await prisma.currencyMaster.findMany({
                        where: { currencyCode: { in: rateCurrencyCodes2 } },
                        select: { currencyCode: true, amountDecimal: true },
                      })
                    : [];
                const rateCurrencyDecimalMap2 = new Map(rateCurrencyMasters2.map(c => [c.currencyCode, c.amountDecimal]));

                for (const item of detailItems) {
                    const itemCurrencyCode2 = (item.CurrencyCode || payload.CurrencyCode || '').trim();
                    const itemDecimals2 = rateCurrencyDecimalMap2.get(itemCurrencyCode2) ?? 2;
                    const computedRate2 = toNumber(item.NumberOfUnit) !== 0
                        ? roundAmount(toNumber(item.Amount) / toNumber(item.NumberOfUnit), itemDecimals2)
                        : roundAmount(toNumber(item.Amount), itemDecimals2);
                    if (item.CostRevenueChargesSid) {
                        costRevenueRateMap.set(Number(item.CostRevenueChargesSid), {
                            Rate: computedRate2,
                            Amount: toNumber(item.Amount),
                            LocalAmount: toNumber(item.LocalAmount),
                        });
                    }
                    if (item.BookingRatesSid) {
                        bookingRateMap.set(Number(item.BookingRatesSid), {
                            Rate: computedRate2,
                            Amount: toNumber(item.Amount),
                            LocalAmount: toNumber(item.LocalAmount),
                        });
                    }
                }

                const disableRateUpdateBack = await this.companyConfigService.getConfigurationValue(
                    CompanyMasterSid, 'DisableRateUpdateBack', prisma
                );
                if (disableRateUpdateBack !== 'Y') {
                    if (costRevenueRateMap.size > 0) {
                        const existingCharges = await prisma.costRevenueCharges.findMany({
                            where: { CostRevenueChargesSid: { in: [...costRevenueRateMap.keys()] } },
                            select: { CostRevenueChargesSid: true, CostRate: true, CostAmount: true, CostLocalAmount: true },
                        });
                        for (const cur of existingCharges) {
                            const inc = costRevenueRateMap.get(cur.CostRevenueChargesSid)!;
                            const changed =
                                toNumber(cur.CostRate) !== inc.Rate ||
                                toNumber(cur.CostAmount) !== inc.Amount ||
                                toNumber(cur.CostLocalAmount) !== inc.LocalAmount;
                            if (changed) {
                                await prisma.costRevenueCharges.update({
                                    where: { CostRevenueChargesSid: cur.CostRevenueChargesSid },
                                    data: {
                                        CostRate: inc.Rate,
                                        CostAmount: inc.Amount,
                                        CostLocalAmount: inc.LocalAmount,
                                        updatedOn: new Date(),
                                        updatedBy: updatedBy,
                                    },
                                });
                            }
                        }
                    }

                    if (bookingRateMap.size > 0) {
                        const existingRates = await prisma.bookingRates.findMany({
                            where: { BookingRatesSid: { in: [...bookingRateMap.keys()] } },
                            select: { BookingRatesSid: true, CostRate: true, CostAmount: true, CostLocalAmount: true },
                        });
                        for (const cur of existingRates) {
                            const inc = bookingRateMap.get(cur.BookingRatesSid)!;
                            const changed =
                                toNumber(cur.CostRate) !== inc.Rate ||
                                toNumber(cur.CostAmount) !== inc.Amount ||
                                toNumber(cur.CostLocalAmount) !== inc.LocalAmount;
                            if (changed) {
                                await prisma.bookingRates.update({
                                    where: { BookingRatesSid: cur.BookingRatesSid },
                                    data: {
                                        CostRate: inc.Rate,
                                        CostAmount: inc.Amount,
                                        CostLocalAmount: inc.LocalAmount,
                                        UpdatedOn: new Date(),
                                        UpdatedBy: updatedBy,
                                    },
                                });
                            }
                        }
                    }
                }

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
                            data: {
                                ...commonMatchingData,
                                UpdatedBy: updatedBy,
                                UpdatedOn: new Date()
                            },
                        });
                    } else {
                        // Create new matching
                        return prisma.matchingDetail.create({
                            data: {
                                ...commonMatchingData,
                                CreatedBy: updatedBy,
                                CreatedOn: new Date()
                            },
                        });
                    }
                });

                const updatedCreatedMatchings = await Promise.all(matchingOperations);

                // TDS upsert / removal (VoucherDetailSid stays null until post).
                // Upsert whenever tdsDetail is present (including TDSAmount=0) so the
                // cumulative TaxableAmount base remains complete.  Only remove when
                // the frontend sends no tdsDetail (TDS mapping was cleared entirely).
                if (payload.tdsDetail) {
                    await this.tdsCalculation.upsertVoucherTDS(VoucherHeaderSid, {
                        CompanyMasterSid,
                        BranchMasterSid,
                        VoucherHeaderSid,
                        VoucherDetailSid: null,
                        TDSSetRateSid: payload.tdsDetail.TDSSetRateSid,
                        ITSectionCode: payload.tdsDetail.ITSectionCode,
                        TDSRate: payload.tdsDetail.TDSRate,
                        TaxableAmount: payload.tdsDetail.TaxableAmount,
                        TDSAmount: payload.tdsDetail.TDSAmount,
                        TDSPartyAmount: payload.tdsDetail.TDSPartyAmount ?? null,
                        Reason: payload.tdsDetail.Reason ?? null,
                        CertificateNo: payload.tdsDetail.CertificateNo ?? null,
                        NotificationNo: payload.tdsDetail.NotificationNo ?? null,
                        CreatedBy: updatedBy,
                        UpdatedBy: updatedBy,
                        Status: 'A',
                    }, prisma);
                } else {
                    await this.tdsCalculation.removeVoucherTDS(VoucherHeaderSid, prisma);
                }

                return {
                    voucherHeader: updatedHeader,
                    details: updatedCreatedDetails,
                    matchings: updatedCreatedMatchings,
                    message: 'Payment updated successfully',
                };
            },{timeout: 48000});
        } catch (error) {
            if (error instanceof BadRequestException) {
                throw error;
            }
            throw new BadRequestException(error.message || 'Failed to update receipt');
        }
    }

    private async executePostPayment(
        payload: {
            voucherHeaderSid: number,
            companyMasterSid: number,
            branchMasterSid: number,
            yearMasterSid: number,
            localCurrencyMasterSid: number,
            localCurrencyCode: string,
            current_date ?: Date | string,
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
        {
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
                            where: { AllotmentBranchSid: null }, // post source matches only; owning matches go through postInterBranch (avoids double-match)
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
                const validTransactions = voucher.SourceMatchingDetail.filter(d => toNumber(d.MatchingAmount) > 0 && toNumber(d.MatchingLocalAmount) > 0).map(d => d.VoucherTransactionSid);
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

                // Taking total party amount from matching
                const billMatchingPartyAmount = toNumber((SourceMatchingDetail || []).reduce((sum, matching) => {
                    if (matching.DrCr === 'C') {
                        return sum + Number(matching.PartyAmount);
                    }
                    return sum - Number(matching.PartyAmount);
                }, 0).toFixed(2));


                const billMatchingLocalAmount = toNumber((SourceMatchingDetail || []).reduce((sum, matching) => {
                    if(matching.DrCr === 'C'){
                        return sum + Number(matching.MatchingLocalAmount);
                    }
                    return sum - Number(matching.MatchingLocalAmount);
                }, 0).toFixed(2));

                // Proportional local amount for matched currency at payment's exchange rate
                const matchedLocalAmount = toNumber((billMatchingPartyAmount * toNumber(voucher.ExchangeRate || 1)).toFixed(2));

                const allDetails = [...VoucherDetail];

                let partyExchangeJvDetail : any = null;

                if(billMatchingPartyAmount > 0){
                    if(billMatchingLocalAmount !== matchedLocalAmount){
                        // Exchange gain or loss exists
                        const difference = Math.abs(billMatchingLocalAmount - matchedLocalAmount);
                        const isGain = billMatchingLocalAmount < matchedLocalAmount;
                        const exchangeJvNarrationType = isGain ? 'Loss' : 'Gain';
                        const partyNarrationType = isGain ? 'Gain' : 'Loss';
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
                                DrCr: isGain ? 'D' : 'C',
                                Narration: `Exchange ${exchangeJvNarrationType} adjustment for payment ${voucher.VoucherNumber}`,
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
                                DrCr : isGain ? 'C' : 'D',
                                Narration : `Exchange ${partyNarrationType} adjustment for party ${voucher.PartyName}`,
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

                // --- TAX SUMMARIZATION & AUTO DETAIL CREATION ---
                const isExportWithoutPayment = voucher.InvoiceType === 'BOS' || voucher.InvoiceType === 'EXE' || voucher.InvoiceType === 'OOS' || voucher.InvoiceType === 'REIMB';
                const isZeroRated = voucher.InvoiceType === 'NONGST';

                // Defensive fallback: PR payments (no party) created before the PlaceOfSupply
                // fix may have an empty PlaceOfSupply. Resolve it from the branch state so
                // CGST+SGST (India) / VAT (UAE) tax rows are still generated on posting.
                let effectivePlaceOfSupply = voucher.PlaceOfSupply?.trim() || '';
                let effectiveTaxCategory: 'Inter' | 'Intra' = payload.taxDetails.TaxCategory || 'Inter';
                if (!effectivePlaceOfSupply && !voucher.CustomerBranchSid) {
                    const branch = await tx.branchMaster.findUnique({
                        where: { BranchMasterSid: voucher.BranchMasterSid },
                        select: { stateMaster: { select: { stateName: true } } },
                    });
                    effectivePlaceOfSupply = branch?.stateMaster?.stateName || '';
                    if (effectivePlaceOfSupply && payload.taxDetails.countryCode === 'in') {
                        effectiveTaxCategory = 'Intra';
                    }
                }
                const hasPlaceOfSupply = !!effectivePlaceOfSupply;
                const effectiveTaxDetails = { ...payload.taxDetails, TaxCategory: effectiveTaxCategory };

                const taxSummaries = (isExportWithoutPayment || !hasPlaceOfSupply)
                    ? []
                    : await this.voucherService.summarizeTaxes(
                        VoucherDetail as any,
                        'PMT',
                        effectiveTaxDetails,
                        payload.companyMasterSid,
                        tx,
                        isZeroRated,
                        voucher.InvoiceType ?? ''
                    );

                let currentSno = allDetails.length + 1;
                for (const taxSummary of taxSummaries) {
                    const headerExchangeRate = toNumber(voucher.ExchangeRate || 1);
                    const finalTaxPartyAmount = roundAmount(taxSummary.taxAmount / headerExchangeRate, 2);

                    const taxDetail = await tx.voucherDetail.create({
                        data: {
                            CompanyMasterSid: voucher.CompanyMasterSid,
                            BranchMasterSid: voucher.BranchMasterSid,
                            VoucherHeaderSid: voucher.VoucherHeaderSid,
                            Sno: currentSno++,
                            ChargeDescription: `${taxSummary.taxName} - ${taxSummary.hsSacCode}`,
                            COAMasterSid: taxSummary.coaMasterSid,
                            LedgerMasterSid: taxSummary.ledgerMasterSid,
                            HSSACMasterSid: taxSummary.hsSacMasterSid,
                            DepartmentMasterSid: voucher.DepartmentMasterSid,
                            HouseJobSid: voucher.HouseJobSid,
                            MasterJobSid: voucher.MasterJobSid,
                            CostRevenue: 'Cost',
                            CurrencyMasterSid: payload.localCurrencyMasterSid,
                            CurrencyCode: payload.localCurrencyCode,
                            ExchangeRate: 1,
                            Rate: taxSummary.taxAmount,
                            NumberOfUnit: 1,
                            Narration: voucher.Narration,
                            DrCr: taxSummary.DrCr!,
                            TaxableAmount: taxSummary.taxableAmount,
                            Amount: taxSummary.taxAmount,
                            LocalAmount: taxSummary.taxAmount,
                            PartyAmount: finalTaxPartyAmount,
                            TaxPercentage1: 0,
                            TaxAmount1: 0,
                            TaxPercentage2: 0,
                            TaxAmount2: 0,
                            YearMasterSid: payload.yearMasterSid,
                            IsAutoGenerated: 'Y',
                            Status: 'A',
                            CreatedBy: payload.postedBy,
                        }
                    });
                    allDetails.push(taxDetail);
                }

                // ─── TDS Payable posting (inline) ───
                // Resolve VoucherTDS for this header. If found, materialise it as a
                // Cr VoucherDetail (TDS Payable COA) so it participates in the balance check
                // alongside the regular detail/tax rows.
                let tdsVoucherDetailForBackfill: { VoucherTDSSid: number; VoucherDetailSid: number } | null = null;
                const tdsRow = await tx.voucherTDS.findFirst({
                    where: { VoucherHeaderSid: voucher.VoucherHeaderSid, Status: 'A' },
                });
                if (tdsRow && toNumber(tdsRow.TDSAmount) > 0) {
                    const tdsCOA = await tx.cOAMaster.findFirst({
                        where: {
                            LedgerType: 'TDS Payable',
                            CompanyMasterSid: voucher.CompanyMasterSid,
                            Status: 'A',
                        },
                        select: { COAMasterSid: true },
                    });
                    if (!tdsCOA) {
                        throw new BadRequestException(
                            'No TDS Payable ledger configured. Please set up a COA with Ledger Type = TDS Payable.'
                        );
                    }
                    const tdsAmount = toNumber(tdsRow.TDSAmount);
                    const tdsPartyAmount = toNumber(tdsRow.TDSPartyAmount ?? tdsAmount);
                    const tdsVoucherDetail = await tx.voucherDetail.create({
                        data: {
                            CompanyMasterSid: voucher.CompanyMasterSid,
                            BranchMasterSid: voucher.BranchMasterSid,
                            VoucherHeaderSid: voucher.VoucherHeaderSid,
                            Sno: currentSno++,
                            ChargeDescription: `TDS Payable - ${tdsRow.ITSectionCode}`,
                            COAMasterSid: tdsCOA.COAMasterSid,
                            CostRevenue: 'Cost',
                            CurrencyMasterSid: payload.localCurrencyMasterSid,
                            CurrencyCode: payload.localCurrencyCode,
                            ExchangeRate: 1,
                            Rate: tdsAmount,
                            NumberOfUnit: 1,
                            Narration: `TDS Payable - ${tdsRow.ITSectionCode}`,
                            DrCr: 'C',
                            TaxableAmount: tdsAmount,
                            Amount: tdsAmount,
                            LocalAmount: tdsAmount,
                            PartyAmount: tdsPartyAmount,
                            TaxPercentage1: 0,
                            TaxAmount1: 0,
                            TaxPercentage2: 0,
                            TaxAmount2: 0,
                            YearMasterSid: payload.yearMasterSid,
                            IsAutoGenerated: 'Y',
                            Status: 'A',
                            CreatedBy: payload.postedBy,
                        }
                    });
                    allDetails.push(tdsVoucherDetail);
                    tdsVoucherDetailForBackfill = {
                        VoucherTDSSid: tdsRow.VoucherTDSSid,
                        VoucherDetailSid: tdsVoucherDetail.VoucherDetailSid,
                    };
                }
                // ─── end TDS block ───

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
                    IsAutoGenerated: item.IsAutoGenerated || 'N',
                }));

                // Bulk create VoucherTransaction records
                const allTransactions = await tx.voucherTransaction.createManyAndReturn({
                    data: voucherTransactionsPayload,
                });

                this.ensureLocalDebitCreditBalance(allTransactions, 'Payment posting validation failed');


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

                // Backfill VoucherTDS.VoucherDetailSid now that the TDS detail row exists
                if (tdsVoucherDetailForBackfill) {
                    await tx.voucherTDS.update({
                        where: { VoucherTDSSid: tdsVoucherDetailForBackfill.VoucherTDSSid },
                        data: {
                            VoucherDetailSid: tdsVoucherDetailForBackfill.VoucherDetailSid,
                            UpdatedBy: payload.postedBy,
                            UpdatedOn: new Date(),
                        },
                    });
                }

                // Bind matching to the MAIN (header) party row. With cash multi-party payments there
                // can be several Customer-type rows (advances), so picking "the first Customer" could
                // grab an advance row by mistake. Fall back to the old rule for single-party / PR flows
                // (PR payments have a null PartyMasterSid, so the guarded lookup is skipped there).
                const partyDetail =
                    (voucher.PartyMasterSid
                        ? allCompleteDetails.find(vd => Number(vd.LedgerMasterSid) === Number(voucher.PartyMasterSid))
                        : undefined)
                    ?? allCompleteDetails.find(vd => vd.subledgerMaster?.SubledgerType === 'Customer');

                await tx.matchingDetail.deleteMany({
                    where: {
                        SourceVoucherHeaderSid: voucher.VoucherHeaderSid,
                        MatchingAmount: { equals: 0 },
                        MatchingLocalAmount: { equals: 0 },
                    }
                })

                const filteredDetails = SourceMatchingDetail.filter(matching => toNumber(matching.MatchingAmount) > 0 || toNumber(matching.MatchingLocalAmount) > 0);

                // Validate: a matching that contains only Debit vouchers has nothing to pair against
                // (Dr-Dr pairing is invalid; at least one Credit invoice must be present).
                const filteredCrMatchings = filteredDetails.filter(m => m.DrCr === 'C');
                const filteredDrMatchings = filteredDetails.filter(m => m.DrCr === 'D');
                if (filteredDrMatchings.length > 0 && filteredCrMatchings.length === 0) {
                    throw new BadRequestException(
                        'Invalid matching: Debit-only matching is not allowed. ' +
                        'A Debit voucher in matching (e.g. a JV Debit) must be paired with at least one Credit invoice.'
                    );
                }

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
                        VoucherMatchingDate : voucher.VoucherDate ,
                        // Item 11 — matching rows take payload.PostDate as their date; use the payment date
                        // (voucher.VoucherDate), not today, so a backdated payment's matching is on the payment date.
                        PostDate: voucher.VoucherDate ,
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
                    //NOTE - if a payment is matched with another payment
                    // Scenerio 1. Payment in matching - 200 USD , Invoice in matching - 200 USD  // Here net will be 0
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
                                VoucherMatchingDate: voucher.VoucherDate,
                                // Item 11 — matching rows take payload.PostDate as their date; use the payment date, not today.
                                PostDate: voucher.VoucherDate,
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
                    return detail.DrCr === 'C' ? sum + toNumber(detail.PartyAmount) : sum - toNumber(detail.PartyAmount);
                }, 0);

                const finalLocalAmount = allCompleteDetails.reduce((sum, detail) => {
                    return detail.DrCr === 'C' ? sum + toNumber(detail.LocalAmount) : sum - toNumber(detail.LocalAmount);
                }, 0);


                // Inter-branch: create the source re-allocation JV + mirror JVs (same transaction) before marking posted.
                await this.interBranchService.postInterBranch({
                    source: voucher,
                    companyMasterSid: payload.companyMasterSid,
                    branchMasterSid: payload.branchMasterSid,
                    yearMasterSid: payload.yearMasterSid,
                    localCurrencyMasterSid: payload.localCurrencyMasterSid,
                    localCurrencyCode: payload.localCurrencyCode,
                    postedBy: payload.postedBy,
                    taxDetails: payload.taxDetails,
                }, tx);

                const updatedVoucher = await tx.voucherHeader.update({
                    where: {
                        VoucherHeaderSid: voucher.VoucherHeaderSid
                    },
                    data: {
                        Amount: finalPartyCurrency,
                        LocalAmount: finalLocalAmount,
                        PostStatus : 'P',
                        PostDate: now,
                        UpdatedBy: payload.postedBy,
                        UpdatedOn: new Date()
                    }
                })

                return {
                    ...updatedVoucher,
                    voucherDetail: allCompleteDetails,
                    voucherMatchings: newVoucherMatchings
                }
        }
    }

    async postPayment(
        payload: {
            voucherHeaderSid: number,
            companyMasterSid: number,
            branchMasterSid: number,
            yearMasterSid: number,
            localCurrencyMasterSid: number,
            localCurrencyCode: string,
            current_date ?: Date | string,
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
                return this.executePostPayment(payload, tx);
            }, { timeout: 60000 });
        } catch (error) {
            const vmsg = extractVoucherValidationMessage(error);
            if (vmsg) {
                throw new DbTriggerValidationException(vmsg);
            }
            throw error;
        }
    }

    /**
     * Search payment with filters and pagination
     */
    async searchPayments(params: any): Promise<any> {
        try {
            const {
                activeCompanyId,
                activeBranchId,
                search = '',
                page = 1,
                pageSize = 10,
                sortColumn = 'VoucherNumber',
                sortDirection = 'desc',
                dateFrom,
                DateFrom,
                dateTo,
                DateTo,
                dateField,
                DateField,
                PartyName,
                partyName,
                CurrencyCode,
                currencyCode,
                CashOrBank,
                cashOrBank,
                YearMasterSid,
                yearMasterSid
            } = params;

            const skip = (page - 1) * pageSize;
            const take = Number(pageSize);

            const isSearchTextANumber = !isNaN(Number(search)) && search.trim() !== '';

            let normalizedCashBank = "";
            const searchTrimmed = String(search).trim().toLowerCase();
            if (searchTrimmed === 'cash') {
                normalizedCashBank = "C";
            } else if (searchTrimmed === 'bank') {
                normalizedCashBank = "B";
            }

            let resolvedDateFrom = dateFrom ?? DateFrom;
            let resolvedDateTo = dateTo ?? DateTo;

            const resolvedYearSid = YearMasterSid ?? yearMasterSid;
            if (resolvedYearSid) {
                const year = await this._db.yearMaster.findUnique({
                    where: { YearMasterSid: Number(resolvedYearSid) },
                    select: { StartDate: true, EndDate: true },
                });
                if (year) {
                    resolvedDateFrom = year.StartDate.toISOString().split('T')[0];
                    resolvedDateTo = year.EndDate.toISOString().split('T')[0];
                }
            }
            const rawDateField = (dateField ?? DateField ?? '').toString();
            const allowedDateFields = ['VoucherDate', 'PostDate'];
            const selectedDateField = allowedDateFields.includes(rawDateField) ? rawDateField : 'VoucherDate';
            const parsedDateFrom = resolvedDateFrom ? new Date(resolvedDateFrom) : null;
            const parsedDateTo = resolvedDateTo ? new Date(resolvedDateTo) : null;
            const normalizedDateFrom = parsedDateFrom && !Number.isNaN(parsedDateFrom.getTime()) ? parsedDateFrom : null;
            const normalizedDateTo = parsedDateTo && !Number.isNaN(parsedDateTo.getTime()) ? parsedDateTo : null;
            const normalizedPartyName = (PartyName ?? partyName ?? '').toString().trim();
            const normalizedCurrencyCode = (CurrencyCode ?? currencyCode ?? '').toString().trim();
            const normalizedCashOrBank = (CashOrBank ?? cashOrBank ?? '').toString().trim();

            const where: Prisma.VoucherHeaderWhereInput = {
                CompanyMasterSid: activeCompanyId,
                BranchMasterSid: activeBranchId,
                voucherTypeMaster: {
                    DocumentTypeCode : DOC_TYPE_CODE.PAYMENT
                },
                Status: statusWhereClause,
                ...(normalizedPartyName && { PartyName: { contains: normalizedPartyName, mode: 'insensitive' } }),
                ...(normalizedCurrencyCode && { CurrencyCode: normalizedCurrencyCode }),
                ...(normalizedCashOrBank && { CashOrBank: normalizedCashOrBank }),
                ...((normalizedDateFrom || normalizedDateTo) && {
                    [selectedDateField]: {
                        ...(normalizedDateFrom && { gte: normalizedDateFrom }),
                        ...(normalizedDateTo && { lte: normalizedDateTo })
                    }
                })
            };

            // Add search filter
            if (search) {
                where.OR = [
                    { VoucherNumber: { contains: search, mode: 'insensitive' } },
                    { PartyName: { contains: search, mode: 'insensitive' } },
                    { CurrencyCode: { contains: search, mode: 'insensitive' } },
                    { PostStatus: { contains: search, mode: 'insensitive' } },
                    { InstrumentNumber: { contains: search, mode: 'insensitive' } },
                    // Only filter by CashOrBank when search term maps to a valid value
                    ...(normalizedCashBank ? [{ CashOrBank: { equals: normalizedCashBank } }] : []),
                    ...(!isNaN(new Date(search).getTime())
                        ? [{ VoucherDate: new Date(search) }]
                        : []),
                    ...(isSearchTextANumber ? [{ LocalAmount: search }] : []),
                ];
            }

            const [items, totalCount] = await Promise.all([
                this._db.voucherHeader.findMany({
                    where,
                    include: {
                        VoucherDetail: {
                            where: {
                                coaMaster: {
                                    OR: [
                                        { LedgerType: 'Bank' },
                                        { LedgerType: 'Cash' }
                                    ]
                                },
                                Status: 'A'
                            },
                            orderBy: { Sno: 'asc' },
                            take: 1,
                            select: {
                                PartyAmount: true,
                            }
                        }
                    },
                    orderBy: [
                        { VoucherDate: 'desc' },
                        { VoucherNumber: 'desc' }
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
            this.logger.error(`Error searching payments: ${error.message}`);
            throw new InternalServerErrorException('Failed to search payments');
        }
    }

    async deletePayment(VoucherHeaderSid: number) {
        try {
            const payment = await this._db.voucherHeader.update({
                where: {
                    VoucherHeaderSid: VoucherHeaderSid
                },
                data : {
                    Status : 'D'
                }
            })
            return payment;
        } catch (error) {
            throw error;
        }
    }

    async getConfigurationValue(companyMasterSid: number, configurationName: string) {
        try {
            const companyData = await this._db.companyMaster.findUnique({
                where: {
                    CompanyMasterSid: companyMasterSid,
                    status: 'A'
                },
                include: {
                    CompanyConfiguration: true
                }
            })

            if (!companyData) {
                throw new BadRequestException('Company not found');
            }

            if (!companyData.CompanyConfiguration || companyData.CompanyConfiguration.length === 0) {
                throw new BadRequestException(`Company config not found for configName : ${configurationName}`);
            }

            const allConfig = companyData.CompanyConfiguration;
            const ourConfig = allConfig.find(x => x.ConfigurationValue === configurationName);

            if (!ourConfig || !ourConfig.ConfigurationValue) {
                throw new BadRequestException('Configuration not found');
            }

            return ourConfig.ConfigurationValue;

        } catch (error) {
            throw error;
        }
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
  prisma ?: Prisma.TransactionClient
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
        return m.DrCr === 'C'
          ? sum + toNumber(m.Amount)
          : sum - toNumber(m.Amount);
      }, 0);

      const totalMatchingLocalAmount = vt.voucherMatchings.reduce((sum, m) => {
        return m.DrCr === 'C'
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
            VoucherNumber : vt.VoucherNumber
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
