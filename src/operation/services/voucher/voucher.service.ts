import { BadRequestException, Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { DatabaseService } from 'src/database/database.service';

interface InvoiceHeaderDTO {
    currencyMasterSid?: number;
    currencyCode?: string;
    exchangeRate?: number;
    billingPartyName?: string;
    billingPartyAddress?: string;
    gstType?: string; // GST Type: B2B, B2CS, B2CL, EXWP, EXWOP
}

interface ChargeTaxGroupDTO {
    RateSid: number;
    taxMasterSid: number;
    taxName: string;
    taxRate: number;
    taxType: string;
    isInterState?: boolean; // Whether this charge is inter-state (IGST) or intra-state (CGST+SGST)
}

interface VoucherGenerationDTO {
    bookingHeaderSid: number;
    companyMasterSid: number;
    branchMasterSid: number;
    voucherTypeMasterSid?: number; // Optional - will be found dynamically based on voucherType
    voucherType: 'Invoice' | 'Vendor Invoice';
    selectedRateIds: number[];
    billingPartySid: number;
    customerBranchSid?: number;
    createdBy?: string;
    invoiceHeader?: InvoiceHeaderDTO;
    chargeTaxGroups?: ChargeTaxGroupDTO[];
}

interface VoucherDetailDTO {
    ChargeMasterSid: number;
    ChargeDescription: string;
    NumberOfUnit: number;
    Rate: number;
    Amount: number;
    LocalAmount: number;
    CurrencyCode: string;
    CurrencyMasterSid: number;
    ExchangeRate: number;
    TaxPercentage1?: number;
    TaxAmount1?: number;
    TaxPercentage2?: number;
    TaxAmount2?: number;
    TaxableAmount?: number;
    HSSACMasterSid?: number;
    ChargeUOMSid?: number;
    DrCr?: string;
}

@Injectable()
export class VoucherService {
    private readonly logger = new Logger(VoucherService.name);

    constructor(private readonly _db: DatabaseService) {}

    /**
     * Generate voucher number based on voucher type and company
     */
    async generateVoucherNumber(
        voucherTypeMasterSid: number,
        companyMasterSid: number,
        branchMasterSid: number
    ): Promise<string> {
        try {
            // Get voucher type details
            const voucherType = await this._db.voucherTypeMaster.findUnique({
                where: { VoucherTypeMasterSid: voucherTypeMasterSid },
                select: {
                    DocumentTypeName: true
                }
            });

            if (!voucherType) {
                throw new BadRequestException('Voucher type not found');
            }

            // Get company details for prefix
            const company = await this._db.companyMaster.findUnique({
                where: { CompanyMasterSid: companyMasterSid },
                select: { companyCode: true }
            });

            // Get last voucher number for this type and company
            const lastVoucher = await this._db.voucherHeader.findFirst({
                where: {
                    CompanyMasterSid: companyMasterSid,
                    BranchMasterSid: branchMasterSid,
                    VoucherTypeMasterSid: voucherTypeMasterSid
                },
                orderBy: {
                    VoucherHeaderSid: 'desc'
                },
                select: {
                    VoucherNumber: true
                }
            });

            // Extract number from last voucher and increment
            let nextNumber = 1;
            if (lastVoucher?.VoucherNumber) {
                const match = lastVoucher.VoucherNumber.match(/(\d+)$/);
                if (match) {
                    nextNumber = parseInt(match[1]) + 1;
                }
            }

            // Generate new voucher number (max 20 chars as per schema)
            const year = new Date().getFullYear();
            const prefix = (voucherType.DocumentTypeName?.substring(0, 2).toUpperCase() || 'VC');
            const companyCode = (company?.companyCode || 'CO').substring(0, 3).toUpperCase();
            // Format: XX-XXX-YYYY-NNNNN (2-3-4-5 = 14-17 chars with dashes)
            const voucherNumber = `${prefix}-${companyCode}-${year}-${String(nextNumber).padStart(5, '0')}`;

            return voucherNumber;
        } catch (error) {
            this.logger.error(`Error generating voucher number: ${error.message}`);
            throw new InternalServerErrorException('Failed to generate voucher number');
        }
    }

    /**
     * Generate voucher number based on VoucherTypeMaster configuration
     */
    async generateVoucherNumberFromConfig(
        voucherTypeMaster: any,
        companyMasterSid: number,
        branchMasterSid: number,
        tx: any
    ): Promise<string> {
        try {
            const parts: string[] = [];
            const separator = voucherTypeMaster.DocumentSeparator || '-';
            const date = new Date();

            // Add document type code/value if DocumentFlag is 'Y'
            if (voucherTypeMaster.DocumentFlag === 'Y') {
                const docValue = voucherTypeMaster.DocumentValue || voucherTypeMaster.DocumentTypeCode || 'DOC';
                parts.push(docValue.substring(0, 5));
            }

            // Add company code if CompanyFlag is 'Y'
            if (voucherTypeMaster.CompanyFlag === 'Y') {
                const company = await tx.companyMaster.findUnique({
                    where: { CompanyMasterSid: companyMasterSid },
                    select: { companyCode: true }
                });
                const companyValue = voucherTypeMaster.CompanyValue || company?.companyCode || 'CO';
                parts.push(companyValue.substring(0, 3));
            }

            // Add branch code if BranchFlag is 'Y'
            if (voucherTypeMaster.BranchFlag === 'Y') {
                const branch = await tx.branchMaster.findUnique({
                    where: { BranchMasterSid: branchMasterSid },
                    select: { branchCode: true }
                });
                const branchValue = voucherTypeMaster.BranchValue || branch?.branchCode || 'BR';
                parts.push(branchValue.substring(0, 3));
            }

            // Add year if YearFlag is 'Y'
            if (voucherTypeMaster.YearFlag === 'Y') {
                parts.push(date.getFullYear().toString());
            }

            // Add month if MonthFlag is 'Y'
            if (voucherTypeMaster.MonthFlag === 'Y') {
                parts.push((date.getMonth() + 1).toString().padStart(2, '0'));
            }

            // Get last voucher number for this type
            const lastVoucher = await tx.voucherHeader.findFirst({
                where: {
                    CompanyMasterSid: companyMasterSid,
                    BranchMasterSid: branchMasterSid,
                    VoucherTypeMasterSid: voucherTypeMaster.VoucherTypeMasterSid
                },
                orderBy: {
                    VoucherHeaderSid: 'desc'
                },
                select: {
                    VoucherNumber: true
                }
            });

            // Extract and increment serial number
            let nextNumber = Number(voucherTypeMaster.DocumentStartingNo || 1);
            if (lastVoucher?.VoucherNumber) {
                const match = lastVoucher.VoucherNumber.match(/(\d+)$/);
                if (match) {
                    nextNumber = parseInt(match[1]) + 1;
                }
            }

            // Format serial number with specified length
            const slNoLength = Number(voucherTypeMaster.DocumentSLNoLength || 5);
            const serialNumber = String(nextNumber).padStart(slNoLength, '0');
            parts.push(serialNumber);

            // Join all parts with separator
            const voucherNumber = parts.join(separator);

            // Ensure it doesn't exceed 20 characters (database limit)
            if (voucherNumber.length > 20) {
                throw new BadRequestException(`Generated voucher number exceeds 20 characters: ${voucherNumber}. Please adjust VoucherTypeMaster configuration.`);
            }

            return voucherNumber;
        } catch (error) {
            this.logger.error(`Error generating voucher number from config: ${error.message}`);
            throw error;
        }
    }

    /**
     * Create voucher from booking rates
     */
    async createVoucherFromBookingRates(payload: VoucherGenerationDTO): Promise<any> {
        try {
            return await this._db.$transaction(async (tx) => {
                // 1. Fetch VoucherTypeMaster configuration by DocumentTypeName, Company and Branch
                const voucherTypeMaster = await tx.voucherTypeMaster.findFirst({
                    where: {
                        DocumentTypeName: payload.voucherType,
                        CompanyMasterSid: payload.companyMasterSid,
                        BranchMasterSid: payload.branchMasterSid,
                        status: 'A'
                    },
                    select: {
                        VoucherTypeMasterSid: true,
                        DocumentTypeName: true,
                        DocumentTypeCode: true,
                        COAGroup: true,
                        COALedger: true,
                        COASubgroup: true,
                        Subledger: true,
                        DocumentFlag: true,
                        CompanyFlag: true,
                        BranchFlag: true,
                        YearFlag: true,
                        MonthFlag: true,
                        DocumentSeparator: true,
                        DocumentSLNoLength: true,
                        DocumentStartingNo: true,
                        DocumentValue: true,
                        CompanyValue: true,
                        BranchValue: true,
                        ResetValue: true
                    }
                });

                if (!voucherTypeMaster) {
                    throw new BadRequestException(
                        `Voucher type "${payload.voucherType}" is not configured for this company and branch. ` +
                        `Please configure "${payload.voucherType}" in VoucherTypeMaster with CompanyMasterSid: ${payload.companyMasterSid} and BranchMasterSid: ${payload.branchMasterSid}.`
                    );
                }

                // 2. Fetch selected booking rates
                const bookingRates = await tx.bookingRates.findMany({
                    where: {
                        BookingRatesSid: { in: payload.selectedRateIds },
                        BookingHeaderSid: payload.bookingHeaderSid,
                        Status: 'A'
                    }
                });

                if (!bookingRates || bookingRates.length === 0) {
                    throw new BadRequestException('No booking rates found for voucher generation');
                }

                // 3. Validate that none of the rates already have vouchers
                const ratesWithVouchers = bookingRates.filter(rate => {
                    if (payload.voucherType === 'Invoice') {
                        return rate.RevenueVoucherHeaderSid !== null;
                    } else {
                        return rate.CostVoucherHeaderSid !== null;
                    }
                });

                if (ratesWithVouchers.length > 0) {
                    throw new BadRequestException('Some selected rates already have vouchers generated');
                }

                // 4. Validate billing party
                if (!payload.billingPartySid) {
                    throw new BadRequestException('Billing party is required for voucher generation');
                }

                this.logger.log(`Validating billing party with ID: ${payload.billingPartySid}`);

                // 5. Get billing party details and validate existence
                const billingParty = await tx.customerMaster.findUnique({
                    where: { CustomerMasterSid: payload.billingPartySid },
                    select: {
                        CustomerMasterSid: true,
                        CustomerName: true,
                        CustomerAddress1: true
                    }
                });

                if (!billingParty) {
                    this.logger.error(`Billing party with ID ${payload.billingPartySid} not found in CustomerMaster table`);
                    throw new BadRequestException(
                        `Billing party with ID ${payload.billingPartySid} not found in customer master. ` +
                        `Please ensure the billing party exists in CustomerMaster table. ` +
                        `Voucher Type: ${payload.voucherType}`
                    );
                }

                this.logger.log(`Billing party found: ${billingParty.CustomerName} (ID: ${billingParty.CustomerMasterSid})`);

                // 6. Find or create Subledger for the billing party
                // PartyMasterSid in VoucherHeader references SubledgerMaster, not CustomerMaster
                let subledger = await tx.subledgerMaster.findFirst({
                    where: {
                        SubledgerMappingSid: payload.billingPartySid,
                        SubledgerType: 'Customer',
                        Status: 'A'
                    },
                    select: {
                        SubledgerMasterSid: true,
                        SubledgerName: true
                    }
                });

                if (!subledger) {
                    this.logger.log(`Subledger not found for billing party ${payload.billingPartySid}, creating new subledger`);

                    // Get subledger COA from VoucherTypeMaster configuration
                    const subledgerCOA = voucherTypeMaster.Subledger || voucherTypeMaster.COALedger;

                    if (!subledgerCOA) {
                        throw new BadRequestException('Subledger COA not configured in VoucherTypeMaster. Please configure Subledger field.');
                    }

                    // Create new subledger for this billing party
                    subledger = await tx.subledgerMaster.create({
                        data: {
                            SubledgerName: billingParty.CustomerName,
                            SubledgerType: 'Customer',
                            SubledgerMappingSid: payload.billingPartySid,
                            COAMasterSid: subledgerCOA,
                            Status: 'A',
                            CreatedBy: payload.createdBy || 'System'
                        },
                        select: {
                            SubledgerMasterSid: true,
                            SubledgerName: true
                        }
                    });

                    this.logger.log(`Created new subledger: ${subledger.SubledgerName} (ID: ${subledger.SubledgerMasterSid})`);
                } else {
                    this.logger.log(`Found existing subledger: ${subledger.SubledgerName} (ID: ${subledger.SubledgerMasterSid})`);
                }

                // 7. Generate voucher number using VoucherTypeMaster configuration
                const voucherNumber = await this.generateVoucherNumberFromConfig(
                    voucherTypeMaster,
                    payload.companyMasterSid,
                    payload.branchMasterSid,
                    tx
                );

                const customerBranch = payload.customerBranchSid ? await tx.customerBranch.findUnique({
                    where: { CustomerBranchSid: payload.customerBranchSid },
                    select: {
                        Address: true
                    }
                }) : null;

                // 8. Calculate totals
                let subtotal = 0;
                const voucherDetails: VoucherDetailDTO[] = [];

                // Create a map of charge tax groups for quick lookup
                const chargeTaxGroupMap = new Map<number, ChargeTaxGroupDTO>();
                if (payload.chargeTaxGroups && payload.chargeTaxGroups.length > 0) {
                    payload.chargeTaxGroups.forEach(ctg => {
                        chargeTaxGroupMap.set(ctg.RateSid, ctg);
                    });
                    this.logger.log(`Using ${payload.chargeTaxGroups.length} manually selected tax groups from frontend`);
                }

                // Enrich booking rates with charge master and currency details for voucher creation
                const enrichedRates = await Promise.all(bookingRates.map(async (rate) => {
                    const isRevenue = payload.voucherType === 'Invoice';
                    const currencyMasterSid = isRevenue ? rate.RevenueCurrencyMasterSid : rate.CostCurrencyMasterSid;

                    // Fetch currency code
                    let currencyCode = 'USD';
                    if (currencyMasterSid) {
                        const currency = await tx.currencyMaster.findUnique({
                            where: { CurrencyMasterSid: currencyMasterSid },
                            select: { currencyCode: true }
                        });
                        currencyCode = currency?.currencyCode || 'USD';
                    }

                    // Fetch HSN/SAC Master ID by looking up HSN code in HSSACMaster table
                    let hsnSACMasterSid: number | undefined = undefined;

                    if (rate.ChargeMasterSid) {
                        // Step 1: Get HSN Code from chargeMaster's chargeTaxMaster relationship
                        const chargeMaster = await tx.chargeMaster.findUnique({
                            where: { ChargeMasterSid: rate.ChargeMasterSid },
                            select: {
                                chargeTaxMaster: {
                                    take: 1,
                                    select: {
                                        ChargeTaxMasterSid: true,
                                        HSNCode: true
                                    }
                                }
                            }
                        });

                        if (chargeMaster?.chargeTaxMaster && chargeMaster.chargeTaxMaster.length > 0) {
                            const hsnCode = chargeMaster.chargeTaxMaster[0].HSNCode;

                            if (hsnCode) {
                                // Step 2: Find the HSSACMasterSid from HSSACMaster table using the HSN Code
                                const hssacMaster = await tx.hSSACMaster.findFirst({
                                    where: { HSSACCode: hsnCode },
                                    select: { HSSACMasterSid: true }
                                });

                                if (hssacMaster) {
                                    hsnSACMasterSid = hssacMaster.HSSACMasterSid;
                                    this.logger.log(`HSN/SAC for charge ${rate.ChargeMasterSid}: HSNCode = ${hsnCode}, HSSACMasterSid = ${hsnSACMasterSid}`);
                                } else {
                                    this.logger.warn(`No HSSACMaster found for HSNCode: ${hsnCode} (ChargeMasterSid: ${rate.ChargeMasterSid})`);
                                }
                            } else {
                                this.logger.warn(`No HSNCode found in chargeTaxMaster for ChargeMasterSid ${rate.ChargeMasterSid}`);
                            }
                        } else {
                            this.logger.warn(`No chargeTaxMaster found for ChargeMasterSid ${rate.ChargeMasterSid}`);
                        }
                    }

                    const amount = Number(isRevenue ? (rate.RevenueAmount || 0) : (rate.CostAmount || 0));
                    const localAmount = Number(isRevenue ? (rate.RevenueLocalAmount || 0) : (rate.CostLocalAmount || 0));
                    const exchangeRate = Number(isRevenue ? (rate.RevenueExchangeRate || 1) : (rate.CostExchangeRate || 1));
                    const perUnit = Number(isRevenue ? (rate.RevenueRate || 0) : (rate.CostRate || 0));

                    // Calculate tax using manually selected tax group if available
                    let taxPercentage1 = 0;
                    let taxPercentage2 = 0;
                    let taxPercentageIGST = 0;
                    let taxAmount1 = 0;
                    let taxAmount2 = 0;
                    let taxAmountIGST = 0;

                    const manualTaxGroup = chargeTaxGroupMap.get(rate.BookingRatesSid);
                    if (manualTaxGroup) {
                        const taxRate = Number(manualTaxGroup.taxRate);
                        const isGSTType = manualTaxGroup.taxType === 'GST' || manualTaxGroup.taxType === 'Input' || manualTaxGroup.taxType === 'Output';
                        const isInterState = manualTaxGroup.isInterState || false;

                        this.logger.log(`Using manual tax for charge ${rate.BookingRatesSid}: ${manualTaxGroup.taxName} (${taxRate}%, ${manualTaxGroup.taxType}, InterState: ${isInterState})`);

                        if (isGSTType) {
                            if (isInterState) {
                                // Inter-state: IGST - store in Tax1 field (no separate IGST columns in DB)
                                taxPercentage1 = taxRate;
                                taxAmount1 = (amount * taxPercentage1) / 100;
                                taxPercentageIGST = taxRate; // For frontend display
                                taxAmountIGST = taxAmount1;  // For frontend display
                                this.logger.log(`Applying IGST ${taxRate}% = ${taxAmount1} (stored in Tax1 field)`);
                            } else {
                                // Intra-state: CGST + SGST (split evenly)
                                taxPercentage1 = taxRate / 2; // CGST
                                taxPercentage2 = taxRate / 2; // SGST
                                taxAmount1 = (amount * taxPercentage1) / 100;
                                taxAmount2 = (amount * taxPercentage2) / 100;
                                this.logger.log(`Applying CGST ${taxPercentage1}% = ${taxAmount1}, SGST ${taxPercentage2}% = ${taxAmount2}`);
                            }
                        } else if (manualTaxGroup.taxType === 'VAT') {
                            // For VAT: single tax
                            taxPercentage1 = taxRate;
                            taxAmount1 = (amount * taxPercentage1) / 100;
                        }
                    }

                    return {
                        ChargeMasterSid: rate.ChargeMasterSid,
                        ChargeDescription: rate.ChargeDescription || '',
                        NumberOfUnit: Number(rate.NoOfUnit || 1),
                        Rate: perUnit,
                        Amount: amount,
                        LocalAmount: localAmount,
                        CurrencyCode: currencyCode,
                        CurrencyMasterSid: currencyMasterSid ?? 0,
                        ExchangeRate: exchangeRate,
                        DrCr: isRevenue ? 'Cr' : 'Dr', // Revenue=Cr, Cost=Dr
                        HSSACMasterSid: hsnSACMasterSid,
                        ChargeUOMSid: (isRevenue ? rate.RevenueChargeUomSid : rate.CostChargeUomSid) ?? undefined,
                        TaxableAmount: amount,
                        TaxPercentage1: taxPercentage1,
                        TaxAmount1: taxAmount1,
                        TaxPercentage2: taxPercentage2,
                        TaxAmount2: taxAmount2,
                        TaxPercentageIGST: taxPercentageIGST,
                        TaxAmountIGST: taxAmountIGST
                    };
                }));

                enrichedRates.forEach(detail => {
                    subtotal += detail.LocalAmount;
                    voucherDetails.push(detail);
                });

                // 9. Create VoucherHeader using VoucherTypeMaster configuration
                const partyName = (billingParty?.CustomerName || '').substring(0, 100);
                const partyAddress = (customerBranch?.Address || billingParty?.CustomerAddress1 || '').substring(0, 250);
                const narration = `Voucher generated from booking ${payload.bookingHeaderSid}`.substring(0, 250);
                const createdBy = (payload.createdBy || 'System').substring(0, 50);

                // Validate COA from VoucherTypeMaster
                if (!voucherTypeMaster.COALedger) {
                    throw new BadRequestException(`COA Ledger not configured in VoucherTypeMaster for ${voucherTypeMaster.DocumentTypeName}. Please configure COA in VoucherTypeMaster.`);
                }

                // Verify COA exists
                const coaMaster = await tx.cOAMaster.findUnique({
                    where: { COAMasterSid: voucherTypeMaster.COALedger },
                    select: { COAMasterSid: true }
                });

                if (!coaMaster) {
                    throw new BadRequestException(`COA with ID ${voucherTypeMaster.COALedger} not found. Please verify VoucherTypeMaster configuration.`);
                }

                this.logger.log(`Creating voucher header with PartyMasterSid (SubledgerMasterSid): ${subledger.SubledgerMasterSid} for Customer: ${payload.billingPartySid}, VoucherNumber: ${voucherNumber}`);

                // Get currency and exchange rate from invoice header or use defaults
                let currencyMasterSid: number | undefined;
                let exchangeRate = 1;

                if (payload.invoiceHeader) {
                    currencyMasterSid = payload.invoiceHeader.currencyMasterSid;
                    exchangeRate = payload.invoiceHeader.exchangeRate || 1;
                    this.logger.log(`Using invoice header currency: ${payload.invoiceHeader.currencyCode} (SID: ${currencyMasterSid}), Exchange Rate: ${exchangeRate}`);
                }

                const voucherHeader = await tx.voucherHeader.create({
                    data: {
                        VoucherNumber: voucherNumber,
                        VoucherDate: new Date(),
                        PostDate: new Date(),
                        VoucherType: voucherTypeMaster.VoucherTypeMasterSid,
                        Narration: narration,
                        COAMasterSid: voucherTypeMaster.COALedger,
                        CompanyMasterSid: payload.companyMasterSid,
                        BranchMasterSid: payload.branchMasterSid,
                        VoucherTypeMasterSid: voucherTypeMaster.VoucherTypeMasterSid,
                        PartyMasterSid: subledger.SubledgerMasterSid, // Must use SubledgerMasterSid per DB schema constraint
                        PartyName: partyName,
                        PartyAddress: partyAddress,
                        CustomerBranchSid: payload.customerBranchSid,
                        InvoiceType: 'REG',
                        CurrencyMasterSid: currencyMasterSid,
                        ExchangeRate: exchangeRate,
                        GSTType: payload.invoiceHeader?.gstType || null, // GST Type for Indian companies
                        Status: 'A',
                        CreatedBy: createdBy
                    }
                });

                // 10. Create VoucherDetails
                let sno = 1;
                for (const detail of voucherDetails) {
                    await tx.voucherDetail.create({
                        data: {
                            VoucherHeaderSid: voucherHeader.VoucherHeaderSid,
                            Sno: sno++,
                            CompanyMasterSid: payload.companyMasterSid,
                            BranchMasterSid: payload.branchMasterSid,
                            ChargeMasterSid: detail.ChargeMasterSid,
                            ChargeDescription: detail.ChargeDescription,
                            NumberOfUnit: detail.NumberOfUnit,
                            Rate: detail.Rate,
                            Amount: detail.Amount,
                            TaxableAmount: detail.TaxableAmount || 0,
                            TaxPercentage1: detail.TaxPercentage1,
                            TaxAmount1: detail.TaxAmount1,
                            TaxPercentage2: detail.TaxPercentage2,
                            TaxAmount2: detail.TaxAmount2,
                            LocalAmount: detail.LocalAmount,
                            CurrencyCode: detail.CurrencyCode,
                            CurrencyMasterSid: detail.CurrencyMasterSid,
                            ExchangeRate: detail.ExchangeRate,
                            DrCr: detail.DrCr,
                            HSSACMasterSid: detail.HSSACMasterSid,
                            ChargeUOMSid: detail.ChargeUOMSid,
                            CreatedBy: payload.createdBy || 'System'
                        }
                    });
                }

                // 10.5. Create TDS record for Vendor Invoice
                if (payload.voucherType === 'Vendor Invoice') {
                    try {
                        const tdsConfig = await this.getVendorTDSMapping(payload.billingPartySid, tx);

                        if (tdsConfig) {
                            // Calculate total taxable amount
                            const totalTaxableAmount = voucherDetails.reduce((sum, detail) => {
                                return sum + Number(detail.TaxableAmount || detail.Amount || 0);
                            }, 0);

                            // Calculate TDS amount
                            const tdsAmount = (totalTaxableAmount * Number(tdsConfig.tdsRate)) / 100;

                            this.logger.log(`Creating TDS record: Taxable=${totalTaxableAmount}, Rate=${tdsConfig.tdsRate}%, Amount=${tdsAmount}`);

                            // Create VoucherTDS record
                            await tx.voucherTDS.create({
                                data: {
                                    VoucherHeaderSid: voucherHeader.VoucherHeaderSid,
                                    VoucherDetailSid: voucherHeader.VoucherHeaderSid, // Will be updated to first detail if needed
                                    CompanyMasterSid: payload.companyMasterSid,
                                    BranchMasterSid: payload.branchMasterSid,
                                    TDSSetRateSid: tdsConfig.tdsSetRateSid,
                                    ITSectionCode: tdsConfig.itSectionCode,
                                    TDSRate: tdsConfig.tdsRate,
                                    TaxableAmount: totalTaxableAmount,
                                    TDSAmount: tdsAmount,
                                    Reason: '', // Optional field for zero TDS reason
                                    CreatedBy: payload.createdBy || 'System',
                                    Status: 'A'
                                }
                            });

                            this.logger.log('TDS record created successfully');
                        } else {
                            this.logger.warn(`No TDS configuration found for vendor ${payload.billingPartySid}`);
                        }
                    } catch (tdsError) {
                        this.logger.error(`Error creating TDS record: ${tdsError.message}`);
                        // Don't fail the entire transaction, just log the error
                    }
                }

                // 11. Update BookingRates with voucher reference
                const isRevenue = payload.voucherType === 'Invoice';
                const voucherHeaderField = isRevenue ? 'RevenueVoucherHeaderSid' : 'CostVoucherHeaderSid';
                const voucherTypeField = isRevenue ? 'RevenueVoucherTypeMasterSid' : 'CostVoucherTypeMasterSid';

                await tx.bookingRates.updateMany({
                    where: {
                        BookingRatesSid: { in: payload.selectedRateIds }
                    },
                    data: {
                        [voucherHeaderField]: voucherHeader.VoucherHeaderSid,
                        [voucherTypeField]: voucherTypeMaster.VoucherTypeMasterSid,
                        UpdatedOn: new Date()
                    }
                });

                // 12. Fetch complete voucher with all relations for frontend display
                const completeVoucher = await tx.voucherHeader.findUnique({
                    where: { VoucherHeaderSid: voucherHeader.VoucherHeaderSid },
                    include: {
                        VoucherDetail: {
                            where: { Status: 'A' },
                            include: {
                                chargeMaster: {
                                    include: {
                                        chargeTaxMaster: {
                                            select: {
                                                ChargeTaxMasterSid: true,
                                                HSNCode: true,
                                                description: true,
                                                TaxGroup: true,
                                                TaxRate: true
                                            }
                                        }
                                    }
                                },
                                currencyMaster: true,
                                hSSACMaster: true
                            }
                        },
                        currencyMaster: true,
                        subledgerMaster: true,
                        customerBranch: true
                    }
                });

                if (!completeVoucher) {
                    throw new InternalServerErrorException('Failed to fetch created voucher');
                }

                return {
                    voucherHeader: completeVoucher,
                    voucherDetails: completeVoucher.VoucherDetail,
                    updatedRatesCount: payload.selectedRateIds.length
                };
            });
        } catch (error) {
            this.logger.error(`Error creating voucher from booking rates: ${error.message}`);
            if (error instanceof BadRequestException) {
                throw error;
            }
            throw new InternalServerErrorException('Failed to create voucher from booking rates');
        }
    }

    async createVoucherFromJobs(payload: any): Promise<any> {
        try {
            return await this._db.$transaction(async (tx) => {
                // 1. Fetch VoucherTypeMaster configuration by DocumentTypeName, Company and Branch
                const voucherTypeMaster = await tx.voucherTypeMaster.findFirst({
                    where: {
                        DocumentTypeName: payload.voucherType,
                        CompanyMasterSid: payload.companyMasterSid,
                        BranchMasterSid: payload.branchMasterSid,
                        status: 'A'
                    },
                    select: {
                        VoucherTypeMasterSid: true,
                        DocumentTypeName: true,
                        DocumentTypeCode: true,
                        COAGroup: true,
                        COALedger: true,
                        COASubgroup: true,
                        Subledger: true,
                        DocumentFlag: true,
                        CompanyFlag: true,
                        BranchFlag: true,
                        YearFlag: true,
                        MonthFlag: true,
                        DocumentSeparator: true,
                        DocumentSLNoLength: true,
                        DocumentStartingNo: true,
                        DocumentValue: true,
                        CompanyValue: true,
                        BranchValue: true,
                        ResetValue: true
                    }
                });

                if(!voucherTypeMaster){
                    throw new BadRequestException(
                        `Voucher type "${payload.voucherType}" is not configured for this company and branch. ` +
                        `Please configure "${payload.voucherType}" in VoucherTypeMaster with CompanyMasterSid: ${payload.companyMasterSid} and BranchMasterSid: ${payload.branchMasterSid}.`
                    );
                }

                // 2. Fetch selected cost revneue charges
                if(payload.menuMasterSid === -1){
                    // Possiblilty for HouseJob
                    const menuConfig = await tx.menuConfig.findFirst({
                        where : {
                            ModelName : payload.modelName
                        }
                    })
                    if(!menuConfig || !menuConfig.MenuMasterSid){
                        throw new BadRequestException("Menu Master SID is required");
                    }
                    payload.menuMasterSid = menuConfig.MenuMasterSid;
                }
                const costRevenueCharges = await tx.costRevenueCharges.findMany({
                    where: {
                        MenuMasterSid: payload.menuMasterSid,
                        CostRevenueChargesSid: { in: payload.selectedRateIds },
                        status: 'A'
                    }
                });
                if (!costRevenueCharges || costRevenueCharges.length === 0) {
                    throw new BadRequestException('No cost revenue charges found for voucher generation');
                }

                // 3. Validate that none of the rates already have vouchers
                const ratesWithVouchers = costRevenueCharges.filter(rate => {
                    if (payload.voucherType === 'Invoice') {
                        return rate.RevenueVoucherHeaderSid !== null;
                    } else {
                        return rate.CostVoucherHeaderSid !== null;
                    }
                });

                if (ratesWithVouchers.length > 0) {
                    throw new BadRequestException('Some selected rates already have vouchers generated');
                }

                // 4. Validate billing party
                if (!payload.billingPartySid) {
                    throw new BadRequestException('Billing party is required for voucher generation');
                }

                this.logger.log(`Validating billing party with ID: ${payload.billingPartySid}`);

                // 5. Get billing party details and validate existence
                const billingParty = await tx.customerMaster.findUnique({
                    where: { CustomerMasterSid: payload.billingPartySid },
                    select: {
                        CustomerMasterSid: true,
                        CustomerName: true,
                        CustomerAddress1: true
                    }
                });

                if (!billingParty) {
                    this.logger.error(`Billing party with ID ${payload.billingPartySid} not found in CustomerMaster table`);
                    throw new BadRequestException(
                        `Billing party with ID ${payload.billingPartySid} not found in customer master. ` +
                        `Please ensure the billing party exists in CustomerMaster table. ` +
                        `Voucher Type: ${payload.voucherType}`
                    );
                }

                this.logger.log(`Billing party found: ${billingParty.CustomerName} (ID: ${billingParty.CustomerMasterSid})`);

                // 6. Find or create Subledger for the billing party
                // PartyMasterSid in VoucherHeader references SubledgerMaster, not CustomerMaster
                let subledger = await tx.subledgerMaster.findFirst({
                    where: {
                        SubledgerMappingSid: payload.billingPartySid,
                        SubledgerType: 'Customer',
                        Status: 'A'
                    },
                    select: {
                        SubledgerMasterSid: true,
                        SubledgerName: true
                    }
                });
                if (!subledger) {
                    this.logger.log(`Subledger not found for billing party ${payload.billingPartySid}, creating new subledger`);

                    // Get subledger COA from VoucherTypeMaster configuration
                    const subledgerCOA = voucherTypeMaster.Subledger || voucherTypeMaster.COALedger;

                    if (!subledgerCOA) {
                        throw new BadRequestException('Subledger COA not configured in VoucherTypeMaster. Please configure Subledger field.');
                    }

                    // Create new subledger for this billing party
                    subledger = await tx.subledgerMaster.create({
                        data: {
                            SubledgerName: billingParty.CustomerName,
                            SubledgerType: 'Customer',
                            SubledgerMappingSid: payload.billingPartySid,
                            COAMasterSid: subledgerCOA,
                            Status: 'A',
                            CreatedBy: payload.createdBy || 'System'
                        },
                        select: {
                            SubledgerMasterSid: true,
                            SubledgerName: true
                        }
                    });

                    this.logger.log(`Created new subledger: ${subledger.SubledgerName} (ID: ${subledger.SubledgerMasterSid})`);
                } else {
                    this.logger.log(`Found existing subledger: ${subledger.SubledgerName} (ID: ${subledger.SubledgerMasterSid})`);
                }

                // 7. Generate voucher number using VoucherTypeMaster configuration
                const voucherNumber = await this.generateVoucherNumberFromConfig(
                    voucherTypeMaster,
                    payload.companyMasterSid,
                    payload.branchMasterSid,
                    tx
                );

                const customerBranch = payload.customerBranchSid ? await tx.customerBranch.findUnique({
                    where: { CustomerBranchSid: payload.customerBranchSid },
                    select: {
                        Address: true
                    }
                }) : null;

                // 8. Calculate totals
                let subtotal = 0;
                const voucherDetails: VoucherDetailDTO[] = [];

                // Create a map of charge tax groups for quick lookup
                const chargeTaxGroupMap = new Map<number, ChargeTaxGroupDTO>();
                if (payload.chargeTaxGroups && payload.chargeTaxGroups.length > 0) {
                    payload.chargeTaxGroups.forEach(ctg => {
                        chargeTaxGroupMap.set(ctg.RateSid, ctg);
                    });
                    this.logger.log(`Using ${payload.chargeTaxGroups.length} manually selected tax groups from frontend`);
                }

                // Enrich cost revenue charges with charge master and currency details for voucher creation
                const enrichedRates = await Promise.all(costRevenueCharges.map(async (rate) => {
                    const isRevenue = payload.voucherType === 'Invoice';
                    const currencyMasterSid = isRevenue ? rate.RevenueCurrencyMasterSid : rate.CostCurrencyMasterSid;

                    // Fetch currency code
                    let currencyCode = 'USD';
                    if (currencyMasterSid) {
                        const currency = await tx.currencyMaster.findUnique({
                            where: { CurrencyMasterSid: currencyMasterSid },
                            select: { currencyCode: true }
                        });
                        currencyCode = currency?.currencyCode || 'USD';
                    }

                    // Fetch HSN/SAC Master ID by looking up HSN code in HSSACMaster table
                    let hsnSACMasterSid: number | undefined = undefined;

                    if (rate.ChargeMasterSid) {
                        // Step 1: Get HSN Code from chargeMaster's chargeTaxMaster relationship
                        const chargeMaster = await tx.chargeMaster.findUnique({
                            where: { ChargeMasterSid: rate.ChargeMasterSid },
                            select: {
                                chargeTaxMaster: {
                                    take: 1,
                                    select: {
                                        ChargeTaxMasterSid: true,
                                        HSNCode: true
                                    }
                                }
                            }
                        });

                        if (chargeMaster?.chargeTaxMaster && chargeMaster.chargeTaxMaster.length > 0) {
                            const hsnCode = chargeMaster.chargeTaxMaster[0].HSNCode;

                            if (hsnCode) {
                                // Step 2: Find the HSSACMasterSid from HSSACMaster table using the HSN Code
                                const hssacMaster = await tx.hSSACMaster.findFirst({
                                    where: { HSSACCode: hsnCode },
                                    select: { HSSACMasterSid: true }
                                });

                                if (hssacMaster) {
                                    hsnSACMasterSid = hssacMaster.HSSACMasterSid;
                                    this.logger.log(`HSN/SAC for charge ${rate.ChargeMasterSid}: HSNCode = ${hsnCode}, HSSACMasterSid = ${hsnSACMasterSid}`);
                                } else {
                                    this.logger.warn(`No HSSACMaster found for HSNCode: ${hsnCode} (ChargeMasterSid: ${rate.ChargeMasterSid})`);
                                }
                            } else {
                                this.logger.warn(`No HSNCode found in chargeTaxMaster for ChargeMasterSid ${rate.ChargeMasterSid}`);
                            }
                        } else {
                            this.logger.warn(`No chargeTaxMaster found for ChargeMasterSid ${rate.ChargeMasterSid}`);
                        }
                    }

                    const amount = Number(isRevenue ? (rate.RevenueAmount || 0) : (rate.CostAmount || 0));
                    const localAmount = Number(isRevenue ? (rate.RevenueLocalAmount || 0) : (rate.CostLocalAmount || 0));
                    const exchangeRate = Number(isRevenue ? (rate.RevenueExchangeRate || 1) : (rate.CostExchangeRate || 1));
                    const perUnit = Number(isRevenue ? (rate.RevenueRate || 0) : (rate.CostRate || 0));
                    
                    // Calculate tax using manually selected tax group if available
                    let taxPercentage1 = 0;
                    let taxPercentage2 = 0;
                    let taxPercentageIGST = 0;
                    let taxAmount1 = 0;
                    let taxAmount2 = 0;
                    let taxAmountIGST = 0;

                    const manualTaxGroup = chargeTaxGroupMap.get(rate.CostRevenueChargesSid);
                    if (manualTaxGroup) {
                        const taxRate = Number(manualTaxGroup.taxRate);
                        const isGSTType = manualTaxGroup.taxType === 'GST' || manualTaxGroup.taxType === 'Input' || manualTaxGroup.taxType === 'Output';
                        const isInterState = manualTaxGroup.isInterState || false;

                        this.logger.log(`Using manual tax for charge ${rate.CostRevenueChargesSid}: ${manualTaxGroup.taxName} (${taxRate}%, ${manualTaxGroup.taxType}, InterState: ${isInterState})`);

                        if (isGSTType) {
                            if (isInterState) {
                                // Inter-state: IGST - store in Tax1 field (no separate IGST columns in DB)
                                taxPercentage1 = taxRate;
                                taxAmount1 = (amount * taxPercentage1) / 100;
                                taxPercentageIGST = taxRate; // For frontend display
                                taxAmountIGST = taxAmount1;  // For frontend display
                                this.logger.log(`Applying IGST ${taxRate}% = ${taxAmount1} (stored in Tax1 field)`);
                            } else {
                                // Intra-state: CGST + SGST (split evenly)
                                taxPercentage1 = taxRate / 2; // CGST
                                taxPercentage2 = taxRate / 2; // SGST
                                taxAmount1 = (amount * taxPercentage1) / 100;
                                taxAmount2 = (amount * taxPercentage2) / 100;
                                this.logger.log(`Applying CGST ${taxPercentage1}% = ${taxAmount1}, SGST ${taxPercentage2}% = ${taxAmount2}`);
                            }
                        } else if (manualTaxGroup.taxType === 'VAT') {
                            // For VAT: single tax
                            taxPercentage1 = taxRate;
                            taxAmount1 = (amount * taxPercentage1) / 100;
                        }
                    }

                    return {
                        ChargeMasterSid: rate.ChargeMasterSid!,
                        ChargeDescription: rate.ChargeDescription || '',
                        NumberOfUnit: Number(rate.CostNumberOfUnit || 1),
                        Rate: perUnit,
                        Amount: amount,
                        LocalAmount: localAmount,
                        CurrencyCode: currencyCode,
                        CurrencyMasterSid: currencyMasterSid ?? 0,
                        ExchangeRate: exchangeRate,
                        DrCr: isRevenue ? 'Cr' : 'Dr', // Revenue=Cr, Cost=Dr
                        HSSACMasterSid: hsnSACMasterSid,
                        ChargeUOMSid: (isRevenue ? rate.RevenueChargeUomSid : rate.CostChargeUomSid) ?? undefined,
                        TaxableAmount: amount,
                        TaxPercentage1: taxPercentage1,
                        TaxAmount1: taxAmount1,
                        TaxPercentage2: taxPercentage2,
                        TaxAmount2: taxAmount2,
                        TaxPercentageIGST: taxPercentageIGST,
                        TaxAmountIGST: taxAmountIGST
                    };
                }));

                enrichedRates.forEach(detail => {
                    subtotal += detail.LocalAmount;
                    voucherDetails.push(detail);
                });

                // 9. Create VoucherHeader using VoucherTypeMaster configuration
                const partyName = (billingParty?.CustomerName || '').substring(0, 100);
                const partyAddress = (customerBranch?.Address || billingParty?.CustomerAddress1 || '').substring(0, 250);
                const narration = `Voucher generated from cost revenue charges`.substring(0, 250);
                const createdBy = (payload.createdBy || 'System').substring(0, 50);

                // Validate COA from VoucherTypeMaster
                if (!voucherTypeMaster.COALedger) {
                    throw new BadRequestException(`COA Ledger not configured in VoucherTypeMaster for ${voucherTypeMaster.DocumentTypeName}. Please configure COA in VoucherTypeMaster.`);
                }

                // Verify COA exists
                const coaMaster = await tx.cOAMaster.findUnique({
                    where: { COAMasterSid: voucherTypeMaster.COALedger },
                    select: { COAMasterSid: true }
                });

                if (!coaMaster) {
                    throw new BadRequestException(`COA with ID ${voucherTypeMaster.COALedger} not found. Please verify VoucherTypeMaster configuration.`);
                }

                this.logger.log(`Creating voucher header with PartyMasterSid (SubledgerMasterSid): ${subledger.SubledgerMasterSid} for Customer: ${payload.billingPartySid}, VoucherNumber: ${voucherNumber}`);

                // Get currency and exchange rate from invoice header or use defaults
                let currencyMasterSid: number | undefined;
                let exchangeRate = 1;

                if (payload.invoiceHeader) {
                    currencyMasterSid = payload.invoiceHeader.currencyMasterSid;
                    exchangeRate = payload.invoiceHeader.exchangeRate || 1;
                    this.logger.log(`Using invoice header currency: ${payload.invoiceHeader.currencyCode} (SID: ${currencyMasterSid}), Exchange Rate: ${exchangeRate}`);
                }

                const voucherHeader = await tx.voucherHeader.create({
                    data: {
                        VoucherNumber: voucherNumber,
                        VoucherDate: new Date(),
                        PostDate: new Date(),
                        VoucherType: voucherTypeMaster.VoucherTypeMasterSid,
                        Narration: narration,
                        COAMasterSid: voucherTypeMaster.COALedger,
                        CompanyMasterSid: payload.companyMasterSid,
                        BranchMasterSid: payload.branchMasterSid,
                        VoucherTypeMasterSid: voucherTypeMaster.VoucherTypeMasterSid,
                        PartyMasterSid: subledger.SubledgerMasterSid, // Must use SubledgerMasterSid per DB schema constraint
                        MasterJobSid : payload.masterJobSid || null,
                        HouseJobSid : payload.houseJobSid || null,
                        HouseNumber : payload.houseNumber || null,
                        MasterNumber : payload.masterNumber || null,
                        PartyName: partyName,
                        PartyAddress: partyAddress,
                        CustomerBranchSid: payload.customerBranchSid,
                        InvoiceType: 'REG',
                        CurrencyMasterSid: currencyMasterSid,
                        ExchangeRate: exchangeRate,
                        GSTType: payload.invoiceHeader?.gstType || null, // GST Type for Indian companies
                        Status: 'A',
                        CreatedBy: createdBy
                    }
                });

                // 10. Create VoucherDetails
                let sno = 1;
                for (const detail of voucherDetails) {
                    await tx.voucherDetail.create({
                        data: {
                            VoucherHeaderSid: voucherHeader.VoucherHeaderSid,
                            Sno: sno++,
                            CompanyMasterSid: payload.companyMasterSid,
                            BranchMasterSid: payload.branchMasterSid,
                            ChargeMasterSid: detail.ChargeMasterSid,
                            ChargeDescription: detail.ChargeDescription,
                            NumberOfUnit: detail.NumberOfUnit,
                            Rate: detail.Rate,
                            Amount: detail.Amount,
                            TaxableAmount: detail.TaxableAmount || 0,
                            TaxPercentage1: detail.TaxPercentage1,
                            TaxAmount1: detail.TaxAmount1,
                            TaxPercentage2: detail.TaxPercentage2,
                            TaxAmount2: detail.TaxAmount2,
                            LocalAmount: detail.LocalAmount,
                            CurrencyCode: detail.CurrencyCode,
                            CurrencyMasterSid: detail.CurrencyMasterSid,
                            ExchangeRate: detail.ExchangeRate,
                            DrCr: detail.DrCr,
                            HSSACMasterSid: detail.HSSACMasterSid,
                            ChargeUOMSid: detail.ChargeUOMSid,
                            CreatedBy: payload.createdBy || 'System'
                        }
                    });
                }

                // 10.5. Create TDS record for Vendor Invoice
                if (payload.voucherType === 'Vendor Invoice') {
                    try {
                        const tdsConfig = await this.getVendorTDSMapping(payload.billingPartySid, tx);

                        if (tdsConfig) {
                            // Calculate total taxable amount
                            const totalTaxableAmount = voucherDetails.reduce((sum, detail) => {
                                return sum + Number(detail.TaxableAmount || detail.Amount || 0);
                            },0);

                            // Calculate TDS amount
                            const tdsAmount = (totalTaxableAmount * Number(tdsConfig.tdsRate)) / 100;

                            this.logger.log(`Creating TDS record: Taxable=${totalTaxableAmount}, Rate=${tdsConfig.tdsRate}%, Amount=${tdsAmount}`);

                            // Create VoucherTDS record
                            await tx.voucherTDS.create({
                                data: {
                                    VoucherHeaderSid: voucherHeader.VoucherHeaderSid,
                                    VoucherDetailSid: voucherHeader.VoucherHeaderSid, // Will be updated to first detail if needed
                                    CompanyMasterSid: payload.companyMasterSid,
                                    BranchMasterSid: payload.branchMasterSid,
                                    TDSSetRateSid: tdsConfig.tdsSetRateSid,
                                    ITSectionCode: tdsConfig.itSectionCode,
                                    TDSRate: tdsConfig.tdsRate,
                                    TaxableAmount: totalTaxableAmount,
                                    TDSAmount: tdsAmount,
                                    Reason: '', // Optional field for zero TDS reason
                                    CreatedBy: payload.createdBy || 'System',
                                    Status: 'A'
                                }
                            });

                            this.logger.log('TDS record created successfully');
                        } else {
                            this.logger.warn(`No TDS configuration found for vendor ${payload.billingPartySid}`);
                        }
                    } catch (tdsError) {
                        this.logger.error(`Error creating TDS record: ${tdsError.message}`);
                        // Don't fail the entire transaction, just log the error
                    }
                }

                // 11. Update BookingRates with voucher reference
                const isRevenue = payload.voucherType === 'Invoice';
                const voucherHeaderField = isRevenue ? 'RevenueVoucherHeaderSid' : 'CostVoucherHeaderSid';
                const voucherTypeField = isRevenue ? 'RevenueVoucherTypeMasterSid' : 'CostVoucherTypeMasterSid';

                await tx.costRevenueCharges.updateMany({
                    where: {
                        CostRevenueChargesSid: { in: payload.selectedRateIds }
                    },
                    data: {
                        [voucherHeaderField]: voucherHeader.VoucherHeaderSid,
                        [voucherTypeField]: voucherTypeMaster.VoucherTypeMasterSid,
                        updatedOn: new Date()
                    }
                });

                // 12. Fetch complete voucher with all relations for frontend display
                const completeVoucher = await tx.voucherHeader.findUnique({
                    where: { VoucherHeaderSid: voucherHeader.VoucherHeaderSid },
                    include: {
                        VoucherDetail: {
                            where: { Status: 'A' },
                            include: {
                                chargeMaster: {
                                    include: {
                                        chargeTaxMaster: {
                                            select: {
                                                ChargeTaxMasterSid: true,
                                                HSNCode: true,
                                                description: true,
                                                TaxGroup: true,
                                                TaxRate: true
                                            }
                                        }
                                    }
                                },
                                currencyMaster: true,
                                hSSACMaster: true
                            }
                        },
                        currencyMaster: true,
                        subledgerMaster: true,
                        customerBranch: true
                    }
                });

                if (!completeVoucher) {
                    throw new InternalServerErrorException('Failed to fetch created voucher');
                }

                return {
                    voucherHeader: completeVoucher,
                    voucherDetails: completeVoucher.VoucherDetail,
                    updatedRatesCount: payload.selectedRateIds.length
                };
            });
        } catch (error) {
            this.logger.error(`Error creating voucher from booking rates: ${error.message}`);
            if (error instanceof BadRequestException) {
                throw error;
            }
            throw new InternalServerErrorException('Failed to create voucher from booking rates');
        }
    }
    /**
     * Update booking rates with voucher ID
     */
    async updateBookingRatesWithVoucher(
        rateIds: number[],
        voucherHeaderSid: number,
        type: 'revenue' | 'cost'
    ): Promise<any> {
        try {
            const voucherField = type === 'revenue' ? 'RevenueVoucherHeaderSid' : 'CostVoucherHeaderSid';

            const result = await this._db.bookingRates.updateMany({
                where: {
                    BookingRatesSid: { in: rateIds }
                },
                data: {
                    [voucherField]: voucherHeaderSid,
                    UpdatedOn: new Date()
                }
            });

            return result;
        } catch (error) {
            this.logger.error(`Error updating booking rates with voucher: ${error.message}`);
            throw new InternalServerErrorException('Failed to update booking rates with voucher');
        }
    }

    /**
     * Get vendor TDS mapping configuration
     * Fetches TDS configuration from SupplierTdsMapping and TDSSetRate tables
     */
    async getVendorTDSMapping(vendorMasterSid: number, tx?: any): Promise<any> {
        try {
            const db = tx || this._db;

            // Fetch SupplierTdsMapping for the vendor
            const supplierMapping = await db.supplierTdsMapping.findFirst({
                where: {
                    CustomerMasterSid: vendorMasterSid,
                    Status: 'A',
                    // Check if current date is within effective dates
                    EffectiveFrom: { lte: new Date() },
                    EffectiveTo: { gte: new Date() }
                },
                include: {
                    tdsSetHeader: {
                        include: {
                            tdsSetRate: {
                                where: { status: 'A' },
                                orderBy: { EffectiveFrom: 'desc' },
                                take: 1
                            }
                        }
                    }
                }
            });

            if (!supplierMapping || !supplierMapping.tdsSetHeader?.tdsSetRate?.length) {
                this.logger.warn(`No active TDS mapping found for vendor ${vendorMasterSid}`);
                return null;
            }

            const tdsSetRate = supplierMapping.tdsSetHeader.tdsSetRate[0];

            return {
                tdsSetRateSid: tdsSetRate.TDSSetRateSid,
                tdsSetHeaderSid: supplierMapping.TDSSetHeaderSid,
                tdsSetName: supplierMapping.tdsSetHeader.TDSSetName,
                itSectionCode: tdsSetRate.ITSectionCode,
                tdsRate: Number(tdsSetRate.TDSRate),
                companyType: supplierMapping.CompanyType,
                certificateNo: supplierMapping.CertificateNo,
                certificatePercentage: supplierMapping.CertificatePercentage ? Number(supplierMapping.CertificatePercentage) : null,
                taxExempt: supplierMapping.TaxExempt === 'Y',
                effectiveFrom: supplierMapping.EffectiveFrom,
                effectiveTo: supplierMapping.EffectiveTo
            };
        } catch (error) {
            this.logger.error(`Error fetching vendor TDS mapping: ${error.message}`);
            return null;
        }
    }

    /**
     * Calculate TDS amount based on taxable amount and TDS rate
     */
    calculateTDSAmount(taxableAmount: number, tdsRate: number): number {
        return Math.round((taxableAmount * tdsRate) / 100 * 100) / 100; // Round to 2 decimal places
    }
}
