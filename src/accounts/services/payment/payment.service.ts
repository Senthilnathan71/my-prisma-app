import { BadRequestException, Injectable, InternalServerErrorException, Logger, NotFoundException } from '@nestjs/common';
import { DatabaseService } from 'src/database/database.service';
import { OutstandingService } from '../outstanding/outstanding.service';
import { VoucherService } from 'src/operation/services/voucher/voucher.service';
import { OutstandingInvoiceDto, SearchOutstandingDto } from 'src/accounts/dto/receipt.dto';
import { Prisma } from '@prisma/client';
import { roundAmount, toNumber } from 'src/common/helper';

@Injectable()
export class PaymentService {
    private readonly logger = new Logger(PaymentService.name);

    constructor(
        private readonly _db: DatabaseService,
        private readonly outstandingService: OutstandingService, // REUSE existing service
        private readonly voucherService: VoucherService
    ) { }

    /**
     * Search outstanding invoices using existing OutstandingService
     * REUSES the existing service as per user requirement
     */
    async searchOutstandingInvoices(searchDto: SearchOutstandingDto): Promise<OutstandingInvoiceDto[]> {
        this.logger.log(`Searching outstanding vendor invoices with criteria: ${JSON.stringify(searchDto)}`);

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
                    VoucherTypeMasterSid: txn.voucherTypeMasterSid,
                    COAMasterSid: txn.coaMasterSid!,
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
            subledgerMaster: {
                SubledgerType: 'Customer'
            },
            Status: 'A',
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
                voucherTypeMaster: {
                    select: { DocumentTypeCode: true }
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
                VoucherDetailSid: txn.VoucherDetailSid,
                VoucherNumber: txn.VoucherHeader.VoucherNumber,
                VoucherDate: txn.VoucherDate.toISOString(),
                VoucherTypeMasterSid: txn.VoucherTypeMasterSid,
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
     * Get Payment by ID
     */
    async getPaymentById(voucherHeaderSid: number, companyMasterSid: number, branchMasterSid: number) {
        const payment = await this._db.voucherHeader.findUnique({
            where: {
                VoucherHeaderSid: voucherHeaderSid,
                CompanyMasterSid: companyMasterSid,
                BranchMasterSid: branchMasterSid,
                Status: 'A'
            },
            include: {
                VoucherDetail: {
                    where: {
                        Status: 'A'
                    }
                },
                SourceMatchingDetail: true,
                voucherMatchingHeader: {
                    select: {
                        VoucherMatchingHeaderSid: true,
                        VoucherMatchingNo: true
                    }
                }
            },
        });

        if (!payment) {
            throw new NotFoundException(`Payment ${voucherHeaderSid} not found`);
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
                    if (m.DrCr === 'D') {
                        return sum + Number(m.Amount);
                    }
                    return sum + Number(m.Amount);
                }, 0);
            const outstandingAmount = Number(transactionDetail.Amount) - matchedAmount;

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
                CurrencyCode: detail.CurrencyCode,
                ExchangeRate: detail.ExchangeRate || 1,
                OriginalCurrencyAmount: transactionDetail?.Amount,
                OriginalLocalAmount: transactionDetail?.LocalAmount,
                OutstandingCurrencyAmount: outstandingAmount,
                OutstandingLocalAmount: outstandingAmount * Number(detail.ExchangeRate),
                MatchingCurrency: detail.MatchingCurrency,
                MatchingExRate: detail.MatchingExRate,
                MatchingAmount: detail.MatchingAmount,
                MatchingLocalAmount: detail.MatchingLocalAmount,
                MatchingTDSAmount: detail.MatchingTDSAmount,
                PartyAmount : detail.PartyAmount
            };
        }));

        return {
            ...VoucherHeader,
            VoucherDetail: VoucherDetail,
            VoucherMatchingHeader : voucherMatchingHeader,
            voucherMatchings: formattedMatchingDetail
        };
    }

    async createNewPayment(payload: any) {
        try {
            return await this._db.$transaction(async (prisma) => {

                // 1. Get VoucherType for 'payment'
                const voucherType = await prisma.voucherTypeMaster.findFirst({
                    where: {
                        CompanyMasterSid : payload.CompanyMasterSid,
                        BranchMasterSid : payload.BranchMasterSid,
                        menuMaster : {
                            MenuName : 'Payment'
                        }
                    },
                });
                if (!voucherType) {
                    throw new BadRequestException('Payment Voucher Type not found');
                }

                // 2. Generate voucher number
                const voucherNumber = await this.generatePaymentNumber(
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

                if (!currentYear) {
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
                        CashOrBank: payload.CashOrBank,
                        MultiBranch: payload.MultiBranch,
                        VoucherDate: new Date(payload.VoucherDate), // ensure Date type
                        VoucherType: voucherType.VoucherTypeMasterSid,
                        PostDate: null, // usually same as VoucherDate
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

                // 6. Create VoucherDetail for payment
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
                        MatchingCurrency: matching.MatchingCurrency,
                        MatchingExRate: matching.MatchingExRate,
                        MatchingAmount: matching.MatchingAmount,  // MatchingAmount(user input/payment)
                        MatchingLocalAmount: matching.MatchingLocalAmount,       // MatchingLocalAmount(user input / payment)
                        PartyAmount : matching.PartyAmount,
                        MatchingTDSAmount: matching.MatchingTDSAmount,
                        SourceVoucherHeaderSid: voucherHeader.VoucherHeaderSid, // SourceVoucherHeaderSid(payment)
                    }
                });

                const finalMatchingDetails = await prisma.matchingDetail.createManyAndReturn({
                    data: matchingDetails
                });

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

    async updatePayment(VoucherHeaderSid: number, payload: any) {
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
                    throw new BadRequestException('Payment voucher not found');
                }

                if (existingHeader.PostStatus === 'P') {
                    throw new BadRequestException('Posted vouchers cannot be modified');
                }

                // 2. Validate Voucher Type
                const voucherType = await prisma.voucherTypeMaster.findFirst({
                    where: {
                        CompanyMasterSid : payload.CompanyMasterSid,
                        BranchMasterSid : payload.BranchMasterSid,
                        menuMaster : {
                            MenuName : 'Payment'
                        }
                    },
                });

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
                        PostDate: voucherDateObj,
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
                let detailIndex = 1;
                const detailOperations = (detailItems || []).map(async (item: any) => {
                    const commonData = {
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
                        Amount: item.Amount ?? 0,
                        LocalAmount: item.LocalAmount ?? 0,
                        InvoiceType: item.InvoiceType || "",
                        CostCenter: item.CostCenter ?? null,
                        ProfitCenter: item.ProfitCenter ?? null,
                        Remarks: item.Remarks || "",
                        ChargeUOMSid: item.ChargeUOMSid ?? null,
                        YearMasterSid: currentYear?.YearMasterSid ?? null,
                        PartyAmount: item.PartyAmount ?? 0,
                        UpdatedBy: updatedBy,
                        UpdatedOn: new Date(),
                    };

                    if (item.VoucherDetailSid) {
                        // Update existing detail
                        return prisma.voucherDetail.update({
                            where: { VoucherDetailSid: item.VoucherDetailSid },
                            data: commonData,
                        });
                    } else {
                        // Create new detail
                        const lastSno = await prisma.voucherDetail.findFirst({
                            where: { VoucherHeaderSid },
                            orderBy: { Sno: 'desc' },
                            select: { Sno: true }
                        });

                        return prisma.voucherDetail.create({
                            data: {
                                ...commonData,
                                CreatedBy: updatedBy,
                                Status: 'A',
                                CompanyMasterSid,
                                BranchMasterSid,
                                VoucherHeaderSid,
                                Sno: detailIndex++,
                            },
                        });
                    }
                });

                const updatedCreatedDetails = await Promise.all(detailOperations);

                // ========================================
                // 6. Handle MatchingDetail: Update if ID exists, Create if not
                // ========================================
                let matchingIndex = 1;
                const matchingOperations = voucherMatching.map(async (matching: any) => {
                    const commonMatchingData = {
                        Sno: matchingIndex++,
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
                    message: 'Payment updated successfully',
                };
            });
        } catch (error) {
            if (error instanceof BadRequestException) {
                throw error;
            }
            throw new BadRequestException(error.message || 'Failed to update receipt');
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
            postedBy: string,
            taxDetails: {
                CountryMasterSid: number,
                countryCode : string,
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
                        voucherTypeMaster: true,
                        subledgerMaster : { select : {SubledgerName : true}}
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

                const now = new Date();
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


                const allCompleteDetails: any[] = [];
                for (const voucherTransaction of allTransactions) {
                    const completeDetail = await tx.voucherDetail.update({
                        where: {
                            VoucherDetailSid: voucherTransaction.VoucherDetailSid
                        },
                        data: {
                            VoucherTransactionSid: voucherTransaction.VoucherTransactionSid
                        },
                        include: {
                            subledgerMaster: { select: { SubledgerType: true } },
                        }
                    })
                    allCompleteDetails.push(completeDetail);
                }

                // let sumOfCurrencyDebits = 0;
                // let sumOfCurrencyCredits = 0;
                // VoucherDetail.forEach(detail => {
                //     if (detail.DrCr === 'D') sumOfCurrencyDebits += toNumber(detail.Amount);
                //     else sumOfCurrencyCredits += toNumber(detail.Amount);
                // });
                // if (sumOfCurrencyCredits - sumOfCurrencyDebits !== 0) {
                //     throw new BadRequestException('Sum of currency debits and credits should be zero.');
                // }

                // let sumOfLocalDebits = 0;
                // let sumOfLocalCredits = 0;
                // VoucherDetail.forEach(detail => {
                //     if (detail.DrCr === 'D') sumOfLocalDebits += toNumber(detail.LocalAmount);
                //     else sumOfLocalCredits += toNumber(detail.LocalAmount);
                // });

                // let allDetails = [...VoucherDetail];
                // const currencyArr = VoucherDetail.map(detail => detail.CurrencyMasterSid).filter(Boolean);
                // const currencySet = new Set(currencyArr);
                // const exchangeRateMismatch = sumOfLocalDebits - sumOfLocalCredits;
                // const formattedExRateMismatch = roundAmount(Math.abs(exchangeRateMismatch), 2);

                // if (currencySet.size > 1 && formattedExRateMismatch > 0.01) {
                //     const exchangeRateDetail = await tx.voucherDetail.create({
                //         data: {
                //             CompanyMasterSid: payload.companyMasterSid,
                //             BranchMasterSid: payload.branchMasterSid,
                //             VoucherHeaderSid: payload.voucherHeaderSid,
                //             Sno: VoucherDetail.length + 1,
                //             ChargeDescription: 'Exchange Rate',
                //             COAMasterSid: await toNumber(this.getConfigurationValue(payload.companyMasterSid, 'ExchangeJVCOA')),
                //             DepartmentMasterSid: voucher.DepartmentMasterSid,
                //             HouseJobSid: voucher.HouseJobSid,
                //             MasterJobSid: voucher.MasterJobSid,
                //             CurrencyMasterSid: payload.localCurrencyMasterSid,
                //             CurrencyCode: payload.localCurrencyCode,
                //             ExchangeRate: 1,
                //             Rate: exchangeRateMismatch,
                //             NumberOfUnit: 1,
                //             Narration: 'Exchange Rate',
                //             DrCr: exchangeRateMismatch > 0 ? 'C' : 'D',
                //             Amount: Math.abs(formattedExRateMismatch),
                //             LocalAmount: Math.abs(formattedExRateMismatch),
                //             TaxableAmount: 0,
                //             YearMasterSid : payload.yearMasterSid,
                //             CreatedBy: payload.postedBy,
                //             Status: 'A',
                //         }
                //     });
                //     allDetails = [...allDetails, exchangeRateDetail];
                // }






                const partyDetail = allCompleteDetails.find(vd => vd.subledgerMaster?.SubledgerType === 'Customer');
                if (!partyDetail) {
                    throw new BadRequestException('Party Voucher Detail not found');
                }
                const billMatchingCurrencyAmount = toNumber((SourceMatchingDetail || []).reduce((sum, matching) => {
                    if(matching.DrCr === 'C'){
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

                await tx.matchingDetail.deleteMany({
                    where: {
                        SourceVoucherHeaderSid : payload.voucherHeaderSid,
                        AND: [
                            { MatchingAmount: { equals: 0 } },
                            { MatchingLocalAmount: { equals: 0 } },
                        ]
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
                        SubledgerName : voucher?.subledgerMaster?.SubledgerName || '',
                        PostDate: now,
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
                        Amount : partyDetail.Amount,
                        LocalAmount : partyDetail.LocalAmount,
                        PostStatus: 'P',
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
                sortDirection = 'desc'
            } = params;

            const skip = (page - 1) * pageSize;
            const take = Number(pageSize);

            const isSearchTextANumber = !isNaN(Number(search)) && search.trim() !== '';

            let normalizedCashBank = "";
            if (String(search).trim() === 'cash' || String(search).trim() === 'Cash') {
                normalizedCashBank = "C";
            } else if (String(search).trim() === 'bank' || String(search).trim() === 'Bank') {
                normalizedCashBank = "D";
            }

            const where: Prisma.VoucherHeaderWhereInput = {
                CompanyMasterSid: activeCompanyId,
                BranchMasterSid: activeBranchId,
                voucherTypeMaster: {
                    DocumentTypeName: 'Payment Voucher'
                },
                Status: 'A'
            };

            // Add search filter
            if (search) {
                where.OR = [
                    { VoucherNumber: { contains: search, mode: 'insensitive' } },
                    { CashOrBank: { contains: normalizedCashBank, mode: 'insensitive' } },
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
                    include: {
                        VoucherDetail: {
                            orderBy: { Sno: 'asc' },
                            take: 1,
                            select: {
                                LocalAmount: true,
                            }
                        }
                    },
                    orderBy: {
                        VoucherHeaderSid: 'desc'
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

    /**
 * Generate payment voucher number
 */
    private async generatePaymentNumber(
        companySid: number,
        branchSid: number,
        voucherTypeSid: number,
        date: Date,
        prisma: any,
    ): Promise<string> {
        const yearSuffix = date.getFullYear().toString().slice(-2);
        const monthPrefix = (date.getMonth() + 1).toString().padStart(2, '0');

        const lastpayment = await prisma.voucherHeader.findFirst({
            where: {
                CompanyMasterSid: companySid,
                BranchMasterSid: branchSid,
                VoucherTypeMasterSid: voucherTypeSid,
                VoucherNumber: { startsWith: `PV${yearSuffix}${monthPrefix}` },
            },
            orderBy: { VoucherNumber: 'desc' },
        });

        const nextNumber = lastpayment ? parseInt(lastpayment.VoucherNumber.slice(-4)) + 1 : 1;

        return `PV${yearSuffix}${monthPrefix}${nextNumber.toString().padStart(4, '0')}`;
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

}
