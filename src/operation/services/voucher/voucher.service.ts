import { BadRequestException, Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { VoucherMatchingPayload } from 'src/accounts/dto/receipt.dto';
import { PostVoucherResponseDto, TaxSummaryDto, VoucherDetailDto } from 'src/accounts/dto/voucher-posting.dto';
import { checkIfExJvApplicable, checkIfMatchingApplicable, getPartyDrCr, TaxVoucherType } from 'src/common/config/voucher-type.config';
import { DatabaseService } from 'src/database/database.service';
import * as moment from 'moment-timezone';
import { CreateVoucherPayload } from 'src/accounts/dto/voucher.dto';

interface InvoiceHeaderDTO {
    currencyMasterSid?: number;
    currencyCode?: string;
    exchangeRate?: number;
    billingPartyName?: string;
    billingPartyAddress?: string;
    gstType?: string; // GST Type: B2B, B2CS, B2CL, EXWP, EXWOP
    GST_VAT?: string;
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
    DepartmentMasterSid?: number;
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
    DrCr: string;
    DepartmentMasterSid?: number;
}

@Injectable()
export class VoucherService {
    private readonly logger = new Logger(VoucherService.name);

    constructor(
        private readonly _db: DatabaseService
    ) {}

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
    // async createVoucherFromBookingRates(payload: VoucherGenerationDTO): Promise<any> {
    //     try {
    //         return await this._db.$transaction(async (tx) => {
    //             // 1. Fetch VoucherTypeMaster configuration by DocumentTypeName, Company and Branch
    //             const voucherTypeMaster = await tx.voucherTypeMaster.findFirst({
    //                 where: {
    //                     DocumentTypeName: payload.voucherType,
    //                     CompanyMasterSid: payload.companyMasterSid,
    //                     BranchMasterSid: payload.branchMasterSid,
    //                     status: 'A'
    //                 },
    //                 select: {
    //                     VoucherTypeMasterSid: true,
    //                     DocumentTypeName: true,
    //                     DocumentTypeCode: true,
    //                     COAGroup: true,
    //                     COALedger: true,
    //                     COASubgroup: true,
    //                     Subledger: true,
    //                     DocumentFlag: true,
    //                     CompanyFlag: true,
    //                     BranchFlag: true,
    //                     YearFlag: true,
    //                     MonthFlag: true,
    //                     DocumentSeparator: true,
    //                     DocumentSLNoLength: true,
    //                     DocumentStartingNo: true,
    //                     DocumentValue: true,
    //                     CompanyValue: true,
    //                     BranchValue: true,
    //                     ResetValue: true
    //                 }
    //             });

    //             if (!voucherTypeMaster) {
    //                 throw new BadRequestException(
    //                     `Voucher type "${payload.voucherType}" is not configured for this company and branch. ` +
    //                     `Please configure "${payload.voucherType}" in VoucherTypeMaster with CompanyMasterSid: ${payload.companyMasterSid} and BranchMasterSid: ${payload.branchMasterSid}.`
    //                 );
    //             }

    //             // 2. Fetch selected booking rates
    //             const bookingRates = await tx.bookingRates.findMany({
    //                 where: {
    //                     BookingRatesSid: { in: payload.selectedRateIds },
    //                     BookingHeaderSid: payload.bookingHeaderSid,
    //                     Status: 'A'
    //                 }
    //             });

    //             if (!bookingRates || bookingRates.length === 0) {
    //                 throw new BadRequestException('No booking rates found for voucher generation');
    //             }

    //             // 3. Validate that none of the rates already have vouchers
    //             const ratesWithVouchers = bookingRates.filter(rate => {
    //                 if (payload.voucherType === 'Invoice') {
    //                     return rate.RevenueVoucherHeaderSid !== null;
    //                 } else {
    //                     return rate.CostVoucherHeaderSid !== null;
    //                 }
    //             });

    //             if (ratesWithVouchers.length > 0) {
    //                 throw new BadRequestException('Some selected rates already have vouchers generated');
    //             }

    //             // 4. Validate billing party
    //             if (!payload.billingPartySid) {
    //                 throw new BadRequestException('Billing party is required for voucher generation');
    //             }

    //             this.logger.log(`Validating billing party with ID: ${payload.billingPartySid}`);

    //             // 5. Get billing party details and validate existence
    //             const billingParty = await tx.customerMaster.findUnique({
    //                 where: { CustomerMasterSid: payload.billingPartySid },
    //                 select: {
    //                     CustomerMasterSid: true,
    //                     CustomerName: true,
    //                     CustomerAddress1: true
    //                 }
    //             });

    //             if (!billingParty) {
    //                 this.logger.error(`Billing party with ID ${payload.billingPartySid} not found in CustomerMaster table`);
    //                 throw new BadRequestException(
    //                     `Billing party with ID ${payload.billingPartySid} not found in customer master. ` +
    //                     `Please ensure the billing party exists in CustomerMaster table. ` +
    //                     `Voucher Type: ${payload.voucherType}`
    //                 );
    //             }

    //             this.logger.log(`Billing party found: ${billingParty.CustomerName} (ID: ${billingParty.CustomerMasterSid})`);

    //             // 6. Find or create Subledger for the billing party
    //             // PartyMasterSid in VoucherHeader references SubledgerMaster, not CustomerMaster
    //             let subledger = await tx.subledgerMaster.findFirst({
    //                 where: {
    //                     SubledgerMappingSid: payload.billingPartySid,
    //                     SubledgerType: 'Customer',
    //                     Status: 'A'
    //                 },
    //                 select: {
    //                     SubledgerMasterSid: true,
    //                     SubledgerName: true
    //                 }
    //             });

    //             if (!subledger) {
    //                 this.logger.log(`Subledger not found for billing party ${payload.billingPartySid}, creating new subledger`);

    //                 // Get subledger COA from VoucherTypeMaster configuration
    //                 const subledgerCOA = voucherTypeMaster.Subledger || voucherTypeMaster.COALedger;

    //                 if (!subledgerCOA) {
    //                     throw new BadRequestException('Subledger COA not configured in VoucherTypeMaster. Please configure Subledger field.');
    //                 }

    //                 // Create new subledger for this billing party
    //                 subledger = await tx.subledgerMaster.create({
    //                     data: {
    //                         SubledgerName: billingParty.CustomerName,
    //                         SubledgerType: 'Customer',
    //                         SubledgerMappingSid: payload.billingPartySid,
    //                         COAMasterSid: subledgerCOA,
    //                         Status: 'A',
    //                         CreatedBy: payload.createdBy || 'System'
    //                     },
    //                     select: {
    //                         SubledgerMasterSid: true,
    //                         SubledgerName: true
    //                     }
    //                 });

    //                 this.logger.log(`Created new subledger: ${subledger.SubledgerName} (ID: ${subledger.SubledgerMasterSid})`);
    //             } else {
    //                 this.logger.log(`Found existing subledger: ${subledger.SubledgerName} (ID: ${subledger.SubledgerMasterSid})`);
    //             }

    //             // 7. Generate voucher number using VoucherTypeMaster configuration
    //             const voucherNumber = await this.generateVoucherNumberFromConfig(
    //                 voucherTypeMaster,
    //                 payload.companyMasterSid,
    //                 payload.branchMasterSid,
    //                 tx
    //             );

    //             const customerBranch = payload.customerBranchSid ? await tx.customerBranch.findUnique({
    //                 where: { CustomerBranchSid: payload.customerBranchSid },
    //                 select: {
    //                     Address: true
    //                 }
    //             }) : null;

    //             // 8. Calculate totals
    //             let subtotal = 0;
    //             const voucherDetails: VoucherDetailDTO[] = [];

    //             // Create a map of charge tax groups for quick lookup
    //             const chargeTaxGroupMap = new Map<number, ChargeTaxGroupDTO>();
    //             if (payload.chargeTaxGroups && payload.chargeTaxGroups.length > 0) {
    //                 payload.chargeTaxGroups.forEach(ctg => {
    //                     chargeTaxGroupMap.set(ctg.RateSid, ctg);
    //                 });
    //                 this.logger.log(`Using ${payload.chargeTaxGroups.length} manually selected tax groups from frontend`);
    //             }

    //             // Enrich booking rates with charge master and currency details for voucher creation
    //             const enrichedRates = await Promise.all(bookingRates.map(async (rate) => {
    //                 const isRevenue = payload.voucherType === 'Invoice';
    //                 const currencyMasterSid = isRevenue ? rate.RevenueCurrencyMasterSid : rate.CostCurrencyMasterSid;

    //                 // Fetch currency code
    //                 let currencyCode = 'USD';
    //                 if (currencyMasterSid) {
    //                     const currency = await tx.currencyMaster.findUnique({
    //                         where: { CurrencyMasterSid: currencyMasterSid },
    //                         select: { currencyCode: true }
    //                     });
    //                     currencyCode = currency?.currencyCode || 'USD';
    //                 }

    //                 // Fetch HSN/SAC Master ID by looking up HSN code in HSSACMaster table
    //                 let hsnSACMasterSid: number | undefined = undefined;

    //                 if (rate.ChargeMasterSid) {
    //                     // Step 1: Get HSN Code from chargeMaster's chargeTaxMaster relationship
    //                     const chargeMaster = await tx.chargeMaster.findUnique({
    //                         where: { ChargeMasterSid: rate.ChargeMasterSid },
    //                         select: {
    //                             chargeTaxMaster: {
    //                                 take: 1,
    //                                 select: {
    //                                     ChargeTaxMasterSid: true,
    //                                     HSNCode: true
    //                                 }
    //                             }
    //                         }
    //                     });

    //                     if (chargeMaster?.chargeTaxMaster && chargeMaster.chargeTaxMaster.length > 0) {
    //                         const hsnCode = chargeMaster.chargeTaxMaster[0].HSNCode;

    //                         if (hsnCode) {
    //                             // Step 2: Find the HSSACMasterSid from HSSACMaster table using the HSN Code
    //                             const hssacMaster = await tx.hSSACMaster.findFirst({
    //                                 where: { HSSACCode: hsnCode },
    //                                 select: { HSSACMasterSid: true }
    //                             });

    //                             if (hssacMaster) {
    //                                 hsnSACMasterSid = hssacMaster.HSSACMasterSid;
    //                                 this.logger.log(`HSN/SAC for charge ${rate.ChargeMasterSid}: HSNCode = ${hsnCode}, HSSACMasterSid = ${hsnSACMasterSid}`);
    //                             } else {
    //                                 this.logger.warn(`No HSSACMaster found for HSNCode: ${hsnCode} (ChargeMasterSid: ${rate.ChargeMasterSid})`);
    //                             }
    //                         } else {
    //                             this.logger.warn(`No HSNCode found in chargeTaxMaster for ChargeMasterSid ${rate.ChargeMasterSid}`);
    //                         }
    //                     } else {
    //                         this.logger.warn(`No chargeTaxMaster found for ChargeMasterSid ${rate.ChargeMasterSid}`);
    //                     }
    //                 }

    //                 const amount = Number(isRevenue ? (rate.RevenueAmount || 0) : (rate.CostAmount || 0));
    //                 const localAmount = Number(isRevenue ? (rate.RevenueLocalAmount || 0) : (rate.CostLocalAmount || 0));
    //                 const exchangeRate = Number(isRevenue ? (rate.RevenueExchangeRate || 1) : (rate.CostExchangeRate || 1));
    //                 const perUnit = Number(isRevenue ? (rate.RevenueRate || 0) : (rate.CostRate || 0));

    //                 // Calculate tax using manually selected tax group if available
    //                 let taxPercentage1 = 0;
    //                 let taxPercentage2 = 0;
    //                 let taxPercentageIGST = 0;
    //                 let taxAmount1 = 0;
    //                 let taxAmount2 = 0;
    //                 let taxAmountIGST = 0;

    //                 const manualTaxGroup = chargeTaxGroupMap.get(rate.BookingRatesSid);
    //                 if (manualTaxGroup) {
    //                     const taxRate = Number(manualTaxGroup.taxRate);
    //                     const isGSTType = manualTaxGroup.taxType === 'GST' || manualTaxGroup.taxType === 'Input' || manualTaxGroup.taxType === 'Output';
    //                     const isInterState = manualTaxGroup.isInterState || false;

    //                     this.logger.log(`Using manual tax for charge ${rate.BookingRatesSid}: ${manualTaxGroup.taxName} (${taxRate}%, ${manualTaxGroup.taxType}, InterState: ${isInterState})`);

    //                     if (isGSTType) {
    //                         if (isInterState) {
    //                             // Inter-state: IGST - store in Tax1 field (no separate IGST columns in DB)
    //                             taxPercentage1 = taxRate;
    //                             taxAmount1 = (amount * taxPercentage1) / 100;
    //                             taxPercentageIGST = taxRate; // For frontend display
    //                             taxAmountIGST = taxAmount1;  // For frontend display
    //                             this.logger.log(`Applying IGST ${taxRate}% = ${taxAmount1} (stored in Tax1 field)`);
    //                         } else {
    //                             // Intra-state: CGST + SGST (split evenly)
    //                             taxPercentage1 = taxRate / 2; // CGST
    //                             taxPercentage2 = taxRate / 2; // SGST
    //                             taxAmount1 = (amount * taxPercentage1) / 100;
    //                             taxAmount2 = (amount * taxPercentage2) / 100;
    //                             this.logger.log(`Applying CGST ${taxPercentage1}% = ${taxAmount1}, SGST ${taxPercentage2}% = ${taxAmount2}`);
    //                         }
    //                     } else if (manualTaxGroup.taxType === 'VAT') {
    //                         // For VAT: single tax
    //                         taxPercentage1 = taxRate;
    //                         taxAmount1 = (amount * taxPercentage1) / 100;
    //                     }
    //                 }

    //                 return {
    //                     ChargeMasterSid: rate.ChargeMasterSid,
    //                     ChargeDescription: rate.ChargeDescription || '',
    //                     NumberOfUnit: Number(rate.NoOfUnit || 1),
    //                     Rate: perUnit,
    //                     Amount: amount,
    //                     LocalAmount: localAmount,
    //                     CurrencyCode: currencyCode,
    //                     CurrencyMasterSid: currencyMasterSid ?? 0,
    //                     ExchangeRate: exchangeRate,
    //                     DrCr: isRevenue ? 'C' : 'D', // Revenue=Cr, Cost=Dr
    //                     HSSACMasterSid: hsnSACMasterSid,
    //                     ChargeUOMSid: (isRevenue ? rate.RevenueChargeUomSid : rate.CostChargeUomSid) ?? undefined,
    //                     TaxableAmount: amount,
    //                     TaxPercentage1: taxPercentage1,
    //                     TaxAmount1: taxAmount1,
    //                     TaxPercentage2: taxPercentage2,
    //                     TaxAmount2: taxAmount2,
    //                     TaxPercentageIGST: taxPercentageIGST,
    //                     TaxAmountIGST: taxAmountIGST,
    //                     DepartmentMasterSid: payload.DepartmentMasterSid,
    //                 };
    //             }));

    //             enrichedRates.forEach(detail => {
    //                 subtotal += detail.LocalAmount;
    //                 voucherDetails.push(detail);
    //             });

    //             // 9. Create VoucherHeader using VoucherTypeMaster configuration
    //             const partyName = (billingParty?.CustomerName || '').substring(0, 100);
    //             const partyAddress = (customerBranch?.Address || billingParty?.CustomerAddress1 || '').substring(0, 250);
    //             const narration = `Voucher generated from booking ${payload.bookingHeaderSid}`.substring(0, 250);
    //             const createdBy = (payload.createdBy || 'System').substring(0, 50);

    //             // Validate COA from VoucherTypeMaster
    //             if (!voucherTypeMaster.COALedger) {
    //                 throw new BadRequestException(`COA Ledger not configured in VoucherTypeMaster for ${voucherTypeMaster.DocumentTypeName}. Please configure COA in VoucherTypeMaster.`);
    //             }

    //             // Verify COA exists
    //             const coaMaster = await tx.cOAMaster.findUnique({
    //                 where: { COAMasterSid: voucherTypeMaster.COALedger },
    //                 select: { COAMasterSid: true }
    //             });

    //             if (!coaMaster) {
    //                 throw new BadRequestException(`COA with ID ${voucherTypeMaster.COALedger} not found. Please verify VoucherTypeMaster configuration.`);
    //             }

    //             this.logger.log(`Creating voucher header with PartyMasterSid (SubledgerMasterSid): ${subledger.SubledgerMasterSid} for Customer: ${payload.billingPartySid}, VoucherNumber: ${voucherNumber}`);

    //             // Get currency and exchange rate from invoice header or use defaults
    //             let currencyMasterSid: number | undefined;
    //             let exchangeRate = 1;

    //             if (payload.invoiceHeader) {
    //                 currencyMasterSid = payload.invoiceHeader.currencyMasterSid;
    //                 exchangeRate = payload.invoiceHeader.exchangeRate || 1;
    //                 this.logger.log(`Using invoice header currency: ${payload.invoiceHeader.currencyCode} (SID: ${currencyMasterSid}), Exchange Rate: ${exchangeRate}`);
    //             }

    //             const voucherHeader = await tx.voucherHeader.create({
    //                 data: {
    //                     VoucherNumber: voucherNumber,
    //                     VoucherDate: new Date(),
    //                     PostDate: new Date(),
    //                     VoucherType: voucherTypeMaster.VoucherTypeMasterSid,
    //                     Narration: narration,
    //                     COAMasterSid: voucherTypeMaster.COALedger,
    //                     CompanyMasterSid: payload.companyMasterSid,
    //                     BranchMasterSid: payload.branchMasterSid,
    //                     VoucherTypeMasterSid: voucherTypeMaster.VoucherTypeMasterSid,
    //                     PartyMasterSid: subledger.SubledgerMasterSid, // Must use SubledgerMasterSid per DB schema constraint
    //                     PartyName: partyName,
    //                     PartyAddress: partyAddress,
    //                     GST_VAT: payload?.invoiceHeader?.GST_VAT,
    //                     CustomerBranchSid: payload.customerBranchSid,
    //                     InvoiceType: 'REG',
    //                     CurrencyMasterSid: currencyMasterSid,
    //                     ExchangeRate: exchangeRate,
    //                     GSTType: payload.invoiceHeader?.gstType || null, // GST Type for Indian companies
    //                     Status: 'A',
    //                     CreatedBy: createdBy
    //                 }
    //             });

    //             // 10. Create VoucherDetails
    //             let sno = 1;
    //             for (const detail of voucherDetails) {
    //                 await tx.voucherDetail.create({
    //                     data: {
    //                         VoucherHeaderSid: voucherHeader.VoucherHeaderSid,
    //                         Sno: sno++,
    //                         CompanyMasterSid: payload.companyMasterSid,
    //                         BranchMasterSid: payload.branchMasterSid,
    //                         ChargeMasterSid: detail.ChargeMasterSid,
    //                         ChargeDescription: detail.ChargeDescription,
    //                         NumberOfUnit: detail.NumberOfUnit,
    //                         Rate: detail.Rate,
    //                         Amount: detail.Amount,
    //                         TaxableAmount: detail.TaxableAmount || 0,
    //                         TaxPercentage1: detail.TaxPercentage1,
    //                         TaxAmount1: detail.TaxAmount1,
    //                         TaxPercentage2: detail.TaxPercentage2,
    //                         TaxAmount2: detail.TaxAmount2,
    //                         LocalAmount: detail.LocalAmount,
    //                         CurrencyCode: detail.CurrencyCode,
    //                         CurrencyMasterSid: detail.CurrencyMasterSid,
    //                         ExchangeRate: detail.ExchangeRate,
    //                         DrCr: detail.DrCr,
    //                         HSSACMasterSid: detail.HSSACMasterSid,
    //                         COAMasterSid : detail.COAMasterSid,
    //                         YearMasterSid : payload.yearMasterSid,
    //                         ChargeUOMSid: detail.ChargeUOMSid,
    //                         CreatedBy: payload.createdBy || 'System',
    //                         DepartmentMasterSid: detail.DepartmentMasterSid,
    //                     }
    //                 });
    //             }

    //             // 10.5. Create TDS record for Vendor Invoice
    //             if (payload.voucherType === 'Vendor Invoice') {
    //                 try {
    //                     const tdsConfig = await this.getVendorTDSMapping(payload.billingPartySid, tx);

    //                     if (tdsConfig) {
    //                         // Calculate total taxable amount
    //                         const totalTaxableAmount = voucherDetails.reduce((sum, detail) => {
    //                             return sum + Number(detail.TaxableAmount || detail.Amount || 0);
    //                         }, 0);

    //                         // Calculate TDS amount
    //                         const tdsAmount = (totalTaxableAmount * Number(tdsConfig.tdsRate)) / 100;

    //                         this.logger.log(`Creating TDS record: Taxable=${totalTaxableAmount}, Rate=${tdsConfig.tdsRate}%, Amount=${tdsAmount}`);

    //                         // Create VoucherTDS record
    //                         await tx.voucherTDS.create({
    //                             data: {
    //                                 VoucherHeaderSid: voucherHeader.VoucherHeaderSid,
    //                                 VoucherDetailSid: voucherHeader.VoucherHeaderSid, // Will be updated to first detail if needed
    //                                 CompanyMasterSid: payload.companyMasterSid,
    //                                 BranchMasterSid: payload.branchMasterSid,
    //                                 TDSSetRateSid: tdsConfig.tdsSetRateSid,
    //                                 ITSectionCode: tdsConfig.itSectionCode,
    //                                 TDSRate: tdsConfig.tdsRate,
    //                                 TaxableAmount: totalTaxableAmount,
    //                                 TDSAmount: tdsAmount,
    //                                 Reason: '', // Optional field for zero TDS reason
    //                                 CreatedBy: payload.createdBy || 'System',
    //                                 Status: 'A'
    //                             }
    //                         });

    //                         this.logger.log('TDS record created successfully');
    //                     } else {
    //                         this.logger.warn(`No TDS configuration found for vendor ${payload.billingPartySid}`);
    //                     }
    //                 } catch (tdsError) {
    //                     this.logger.error(`Error creating TDS record: ${tdsError.message}`);
    //                     // Don't fail the entire transaction, just log the error
    //                 }
    //             }

    //             // 11. Update BookingRates with voucher reference
    //             const isRevenue = payload.voucherType === 'Invoice';
    //             const voucherHeaderField = isRevenue ? 'RevenueVoucherHeaderSid' : 'CostVoucherHeaderSid';
    //             const voucherTypeField = isRevenue ? 'RevenueVoucherTypeMasterSid' : 'CostVoucherTypeMasterSid';

    //             await tx.bookingRates.updateMany({
    //                 where: {
    //                     BookingRatesSid: { in: payload.selectedRateIds }
    //                 },
    //                 data: {
    //                     [voucherHeaderField]: voucherHeader.VoucherHeaderSid,
    //                     [voucherTypeField]: voucherTypeMaster.VoucherTypeMasterSid,
    //                     UpdatedOn: new Date()
    //                 }
    //             });

    //             // 12. Fetch complete voucher with all relations for frontend display
    //             const completeVoucher = await tx.voucherHeader.findUnique({
    //                 where: { VoucherHeaderSid: voucherHeader.VoucherHeaderSid },
    //                 include: {
    //                     VoucherDetail: {
    //                         where: { Status: 'A' },
    //                         include: {
    //                             chargeMaster: {
    //                                 include: {
    //                                     chargeTaxMaster: {
    //                                         select: {
    //                                             ChargeTaxMasterSid: true,
    //                                             HSNCode: true,
    //                                             description: true,
    //                                             TaxGroup: true,
    //                                             TaxRate: true
    //                                         }
    //                                     }
    //                                 }
    //                             },
    //                             currencyMaster: true,
    //                             hSSACMaster: true
    //                         }
    //                     },
    //                     currencyMaster: true,
    //                     subledgerMaster: true,
    //                     customerBranch: true
    //                 }
    //             });

    //             if (!completeVoucher) {
    //                 throw new InternalServerErrorException('Failed to fetch created voucher');
    //             }

    //             return {
    //                 voucherHeader: completeVoucher,
    //                 voucherDetails: completeVoucher.VoucherDetail,
    //                 updatedRatesCount: payload.selectedRateIds.length
    //             };
    //         });
    //     } catch (error) {
    //         this.logger.error(`Error creating voucher from booking rates: ${error.message}`);
    //         if (error instanceof BadRequestException) {
    //             throw error;
    //         }
    //         throw new InternalServerErrorException('Failed to create voucher from booking rates');
    //     }
    // }

    async createVoucher(payload:CreateVoucherPayload){
        try {
            const result = await this._db.$transaction(async (prisma) => {
                const voucherTypeMaster = await prisma.voucherTypeMaster.findFirst({
                    where: {
                        DocumentTypeName: payload.VoucherTypeName
                    },
                    select : {
                        VoucherTypeMasterSid : true,
                        DocumentTypeName : true,
                        DocumentTypeCode : true,
                    }
                });

                if(!voucherTypeMaster){
                    throw new BadRequestException('Voucher Type not found');
                }

                const generatedVoucherNumber = await this.generateVoucherNumber(
                    voucherTypeMaster.VoucherTypeMasterSid,
                    payload.CompanyMasterSid,
                    payload.BranchMasterSid
                );

                const createdVoucherHeader = await prisma.voucherHeader.create({
                    data : {
                        CreatedBy : payload.CreatedBy,
                        Status : 'A',
                        CompanyMasterSid : payload.CompanyMasterSid,
                        BranchMasterSid : payload.BranchMasterSid,
                        VoucherNumber : generatedVoucherNumber,
                        VoucherType : voucherTypeMaster.VoucherTypeMasterSid,
                        VoucherDate : payload.VoucherDate ? new Date(payload.VoucherDate) : new Date(),
                        PostDate : payload.PostDate ? new Date(payload.PostDate) : new Date(),
                        Narration : payload.Narration ?? "",
                        PartyMasterSid : payload.PartyMasterSid,
                        PartyName : payload.PartyName ?? "",
                        PartyAddress : payload.PartyAddress ?? "",
                        CustomerBranchSid : payload.CustomerBranchSid ?? null,
                        PlaceOfSupply : payload.PlaceOfSupply ?? "",
                        State : payload.State ?? "",
                        COAMasterSid : payload.COAMasterSid,
                        BankCOA : payload.BankCOA ?? null,
                        BankPartyName : payload.BankPartyName ?? "",
                        GST_VAT : payload.GST_VAT ?? "",
                        InvoiceType : payload.InvoiceType ?? "",
                        ReversalVoucher : payload.ReversalVoucher ?? null,
                        TaxNumber : payload.TaxNumber ?? null,
                        GSTType : payload.GSTType ?? "",
                        Remarks : payload.Remarks ?? "",
                        DepartmentMasterSid : payload.DepartmentMasterSid ?? null,
                        HouseNumber : payload.HouseNumber ?? "",
                        MasterNumber : payload.MasterNumber ?? "",
                        HouseJobSid : payload.HouseJobSid ?? null,
                        MasterJobSid : payload.MasterJobSid ?? null,
                        CurrencyMasterSid : payload.CurrencyMasterSid ?? null,
                        CurrencyCode : payload.CurrencyCode ?? "",
                        ExchangeRate : payload.ExchangeRate ?? 1,
                        Amount : payload.Amount ?? 0,
                        LocalAmount : payload.LocalAmount ?? 0,
                        NetAmount : payload.NetAmount ?? 0,
                        DocumentNumber : payload.DocumentNumber ?? "",
                        DocumentDate : payload.DocumentDate ? new Date(payload.DocumentDate) : null,
                        SetoffStatus : payload.SetoffStatus ?? "",
                        TaxType : payload.TaxType ?? "",
                        InstrumentMode : payload.InstrumentMode ?? "",
                        InstrumentNumber : payload.InstrumentNumber ?? "",
                        InstrumentDate : payload.InstrumentDate ? new Date(payload.InstrumentDate) : null,
                        ClearanceDate : payload.ClearanceDate ? new Date(payload.ClearanceDate) : null,
                        CreditNoteReason : payload.CreditNoteReason ?? "",
                        VoucherTypeMasterSid : voucherTypeMaster.VoucherTypeMasterSid,
                        PostStatus : payload.PostStatus ?? "U",
                        CashOrBank : payload.CashOrBank ?? "",
                        MultiBranch : payload.MultiBranch ?? "",
                        BookingHeaderSid : payload.BookingHeaderSid ?? null,
                    }
                });

                const allVoucherDetails = (payload.VoucherDetail || []).map((detail,index) => {
                    return {
                        CreatedBy : payload.CreatedBy,
                        Status : 'A',
                        CompanyMasterSid : payload.CompanyMasterSid,
                        BranchMasterSid : payload.BranchMasterSid,
                        VoucherHeaderSid : createdVoucherHeader.VoucherHeaderSid,
                        Sno : index + 1 ||  detail.Sno,
                        ChargeMasterSid : detail.ChargeMasterSid ?? null,
                        ChargeDescription : detail.ChargeDescription ?? "",
                        LedgerMasterSid : detail.LedgerMasterSid ?? null,
                        COAMasterSid : detail.COAMasterSid,
                        HSSACMasterSid : detail.HSSACMasterSid ?? null,
                        DepartmentMasterSid : detail.DepartmentMasterSid ?? null,
                        HouseJobSid : detail.HouseJobSid ?? null,
                        MasterJobSid : detail.MasterJobSid ?? null,
                        CostRevenue : detail.CostRevenue ?? "",
                        CurrencyMasterSid : detail.CurrencyMasterSid ?? payload.CurrencyMasterSid ?? null,
                        CurrencyCode : detail.CurrencyCode ?? payload.CurrencyCode ?? "",
                        ExchangeRate : detail.ExchangeRate ?? payload.ExchangeRate ?? 1,
                        Rate : detail.Rate ?? 0,
                        NumberOfUnit : detail.NumberOfUnit ?? 1,
                        Narration : detail.Narration ?? "",
                        DrCr : detail.DrCr ?? "",
                        TaxableAmount : detail.TaxableAmount ?? 0,
                        TaxPercentage1 : detail.TaxPercentage1 ?? 0,
                        TaxAmount1 : detail.TaxAmount1 ?? 0,
                        TaxPercentage2 : detail.TaxPercentage2 ?? 0,
                        TaxAmount2 : detail.TaxAmount2 ?? 0,
                        Amount : detail.Amount ?? 0,
                        LocalAmount : detail.LocalAmount ?? 0,
                        InvoiceType : detail.InvoiceType ?? "",
                        CostCenter : detail.CostCenter ?? null,
                        ProfitCenter : detail.ProfitCenter ?? null,
                        Remarks : detail.Remarks ?? "",
                        ChargeUOMSid : detail.ChargeUOMSid ?? null,
                        YearMasterSid : payload.YearMasterSid ?? null,
                        PartyAmount : detail.PartyAmount ?? 0,
                        VoucherTransactionSid : detail.VoucherTransactionSid ?? null,
                        IsAutoGenerated : detail.IsAutoGenerated ?? "N"
                    }
                });

                const createdVoucherDetails = await prisma.voucherDetail.createMany({
                    data : allVoucherDetails
                });

                if(payload.selectedRateIds.length > 0){
                    if(payload.screenName === 'Booking'){
                        if(payload.VoucherTypeName === 'Invoice'){
                            await prisma.bookingRates.updateMany({
                                where: {
                                    BookingRatesSid: { in: payload.selectedRateIds }
                                },
                                data: {
                                    RevenueVoucherHeaderSid : createdVoucherHeader.VoucherHeaderSid,
                                    RevenueVoucherTypeMasterSid : voucherTypeMaster.VoucherTypeMasterSid
                                }
                            })
                        } else {
                            await prisma.bookingRates.updateMany({
                                where: {
                                    BookingRatesSid: { in: payload.selectedRateIds }
                                },
                                data: {
                                    CostVoucherHeaderSid : createdVoucherHeader.VoucherHeaderSid,
                                    CostVoucherTypeMasterSid : voucherTypeMaster.VoucherTypeMasterSid
                                }
                            })
                        }
                    } else {
                        if(payload.VoucherTypeName === 'Invoice'){
                            await prisma.costRevenueCharges.updateMany({
                                where: {
                                    CostRevenueChargesSid: { in: payload.selectedRateIds }
                                },
                                data: {
                                    RevenueVoucherHeaderSid : createdVoucherHeader.VoucherHeaderSid,
                                    RevenueVoucherTypeMasterSid : voucherTypeMaster.VoucherTypeMasterSid
                                }
                            })
                        } else {
                            await prisma.costRevenueCharges.updateMany({
                                where: {
                                    CostRevenueChargesSid: { in: payload.selectedRateIds }
                                },
                                data: {
                                    CostVoucherHeaderSid : createdVoucherHeader.VoucherHeaderSid,
                                    CostVoucherTypeMasterSid : voucherTypeMaster.VoucherTypeMasterSid
                                }
                            })
                        }
                    }
                }

                return {
                    ...createdVoucherHeader,
                    voucherDetails : createdVoucherDetails
                }
            });
            return result;
        } catch (error) {
            throw error;
        }
    }

    // async createVoucherFromJobs(payload: any): Promise<any> {
    //     try {
    //         return await this._db.$transaction(async (tx) => {
    //             // 1. Fetch VoucherTypeMaster configuration by DocumentTypeName, Company and Branch
    //             const voucherTypeMaster = await tx.voucherTypeMaster.findFirst({
    //                 where: {
    //                     DocumentTypeName: payload.voucherType,
    //                     CompanyMasterSid: payload.companyMasterSid,
    //                     BranchMasterSid: payload.branchMasterSid,
    //                     status: 'A'
    //                 },
    //                 select: {
    //                     VoucherTypeMasterSid: true,
    //                     DocumentTypeName: true,
    //                     DocumentTypeCode: true,
    //                     COAGroup: true,
    //                     COALedger: true,
    //                     COASubgroup: true,
    //                     Subledger: true,
    //                     DocumentFlag: true,
    //                     CompanyFlag: true,
    //                     BranchFlag: true,
    //                     YearFlag: true,
    //                     MonthFlag: true,
    //                     DocumentSeparator: true,
    //                     DocumentSLNoLength: true,
    //                     DocumentStartingNo: true,
    //                     DocumentValue: true,
    //                     CompanyValue: true,
    //                     BranchValue: true,
    //                     ResetValue: true
    //                 }
    //             });

    //             if(!voucherTypeMaster){
    //                 throw new BadRequestException(
    //                     `Voucher type "${payload.voucherType}" is not configured for this company and branch. ` +
    //                     `Please configure "${payload.voucherType}" in VoucherTypeMaster with CompanyMasterSid: ${payload.companyMasterSid} and BranchMasterSid: ${payload.branchMasterSid}.`
    //                 );
    //             }

    //             // 2. Fetch selected cost revneue charges
    //             if(payload.menuMasterSid === -1){
    //                 // Possiblilty for HouseJob
    //                 const menuConfig = await tx.menuConfig.findFirst({
    //                     where : {
    //                         ModelName : payload.modelName
    //                     }
    //                 })
    //                 if(!menuConfig || !menuConfig.MenuMasterSid){
    //                     throw new BadRequestException("Menu Master SID is required");
    //                 }
    //                 payload.menuMasterSid = menuConfig.MenuMasterSid;
    //             }
    //             const costRevenueCharges = await tx.costRevenueCharges.findMany({
    //                 where: {
    //                     MenuMasterSid: payload.menuMasterSid,
    //                     TransactionSid : payload.jobSid,
    //                     CostRevenueChargesSid: { in: payload.selectedRateIds },
    //                     status: 'A'
    //                 }
    //             });
    //             if (!costRevenueCharges || costRevenueCharges.length === 0) {
    //                 throw new BadRequestException('No cost revenue charges found for voucher generation');
    //             }

    //             // 3. Validate that none of the rates already have vouchers
    //             const ratesWithVouchers = costRevenueCharges.filter(rate => {
    //                 if (payload.voucherType === 'Invoice') {
    //                     return rate.RevenueVoucherHeaderSid !== null;
    //                 } else {
    //                     return rate.CostVoucherHeaderSid !== null;
    //                 }
    //             });

    //             if (ratesWithVouchers.length > 0) {
    //                 throw new BadRequestException('Some selected rates already have vouchers generated');
    //             }

    //             // 4. Validate billing party
    //             if (!payload.billingPartySid) {
    //                 throw new BadRequestException('Billing party is required for voucher generation');
    //             }

    //             this.logger.log(`Validating billing party with ID: ${payload.billingPartySid}`);

    //             // 5. Get billing party details and validate existence
    //             const billingParty = await tx.customerMaster.findUnique({
    //                 where: { CustomerMasterSid: payload.billingPartySid },
    //                 select: {
    //                     CustomerMasterSid: true,
    //                     CustomerName: true,
    //                     CustomerAddress1: true
    //                 }
    //             });

    //             if (!billingParty) {
    //                 this.logger.error(`Billing party with ID ${payload.billingPartySid} not found in CustomerMaster table`);
    //                 throw new BadRequestException(
    //                     `Billing party with ID ${payload.billingPartySid} not found in customer master. ` +
    //                     `Please ensure the billing party exists in CustomerMaster table. ` +
    //                     `Voucher Type: ${payload.voucherType}`
    //                 );
    //             }

    //             this.logger.log(`Billing party found: ${billingParty.CustomerName} (ID: ${billingParty.CustomerMasterSid})`);

    //             // 6. Find or create Subledger for the billing party
    //             // PartyMasterSid in VoucherHeader references SubledgerMaster, not CustomerMaster
    //             let subledger = await tx.subledgerMaster.findFirst({
    //                 where: {
    //                     SubledgerMappingSid: payload.billingPartySid,
    //                     SubledgerType: 'Customer',
    //                     Status: 'A'
    //                 },
    //                 select: {
    //                     SubledgerMasterSid: true,
    //                     SubledgerName: true
    //                 }
    //             });
    //             if (!subledger) {
    //                 this.logger.log(`Subledger not found for billing party ${payload.billingPartySid}, creating new subledger`);

    //                 // Get subledger COA from VoucherTypeMaster configuration
    //                 const subledgerCOA = voucherTypeMaster.Subledger || voucherTypeMaster.COALedger;

    //                 if (!subledgerCOA) {
    //                     throw new BadRequestException('Subledger COA not configured in VoucherTypeMaster. Please configure Subledger field.');
    //                 }

    //                 // Create new subledger for this billing party
    //                 subledger = await tx.subledgerMaster.create({
    //                     data: {
    //                         SubledgerName: billingParty.CustomerName,
    //                         SubledgerType: 'Customer',
    //                         SubledgerMappingSid: payload.billingPartySid,
    //                         COAMasterSid: subledgerCOA,
    //                         Status: 'A',
    //                         CreatedBy: payload.createdBy || 'System'
    //                     },
    //                     select: {
    //                         SubledgerMasterSid: true,
    //                         SubledgerName: true
    //                     }
    //                 });

    //                 this.logger.log(`Created new subledger: ${subledger.SubledgerName} (ID: ${subledger.SubledgerMasterSid})`);
    //             } else {
    //                 this.logger.log(`Found existing subledger: ${subledger.SubledgerName} (ID: ${subledger.SubledgerMasterSid})`);
    //             }

    //             // 7. Generate voucher number using VoucherTypeMaster configuration
    //             const voucherNumber = await this.generateVoucherNumberFromConfig(
    //                 voucherTypeMaster,
    //                 payload.companyMasterSid,
    //                 payload.branchMasterSid,
    //                 tx
    //             );

    //             const customerBranch = payload.customerBranchSid ? await tx.customerBranch.findUnique({
    //                 where: { CustomerBranchSid: payload.customerBranchSid },
    //                 select: {
    //                     Address: true
    //                 }
    //             }) : null;

    //             // 8. Calculate totals
    //             let subtotal = 0;
    //             const voucherDetails: VoucherDetailDTO[] = [];

    //             // Create a map of charge tax groups for quick lookup
    //             const chargeTaxGroupMap = new Map<number, ChargeTaxGroupDTO>();
    //             if (payload.chargeTaxGroups && payload.chargeTaxGroups.length > 0) {
    //                 payload.chargeTaxGroups.forEach(ctg => {
    //                     chargeTaxGroupMap.set(ctg.RateSid, ctg);
    //                 });
    //                 this.logger.log(`Using ${payload.chargeTaxGroups.length} manually selected tax groups from frontend`);
    //             }

    //             // Enrich cost revenue charges with charge master and currency details for voucher creation
    //             const enrichedRates = await Promise.all(costRevenueCharges.map(async (rate) => {
    //                 const isRevenue = payload.voucherType === 'Invoice';
    //                 const currencyMasterSid = isRevenue ? rate.RevenueCurrencyMasterSid : rate.CostCurrencyMasterSid;

    //                 // Fetch currency code
    //                 let currencyCode = 'USD';
    //                 if (currencyMasterSid) {
    //                     const currency = await tx.currencyMaster.findUnique({
    //                         where: { CurrencyMasterSid: currencyMasterSid },
    //                         select: { currencyCode: true }
    //                     });
    //                     currencyCode = currency?.currencyCode || 'USD';
    //                 }

    //                 // Fetch HSN/SAC Master ID by looking up HSN code in HSSACMaster table
    //                 let hsnSACMasterSid: number | undefined = undefined;

    //                 if (rate.ChargeMasterSid) {
    //                     // Step 1: Get HSN Code from chargeMaster's chargeTaxMaster relationship
    //                     const chargeMaster = await tx.chargeMaster.findUnique({
    //                         where: { ChargeMasterSid: rate.ChargeMasterSid },
    //                         select: {
    //                             chargeTaxMaster: {
    //                                 take: 1,
    //                                 select: {
    //                                     ChargeTaxMasterSid: true,
    //                                     HSNCode: true
    //                                 }
    //                             }
    //                         }
    //                     });

    //                     if (chargeMaster?.chargeTaxMaster && chargeMaster.chargeTaxMaster.length > 0) {
    //                         const hsnCode = chargeMaster.chargeTaxMaster[0].HSNCode;

    //                         if (hsnCode) {
    //                             // Step 2: Find the HSSACMasterSid from HSSACMaster table using the HSN Code
    //                             const hssacMaster = await tx.hSSACMaster.findFirst({
    //                                 where: { HSSACCode: hsnCode },
    //                                 select: { HSSACMasterSid: true }
    //                             });

    //                             if (hssacMaster) {
    //                                 hsnSACMasterSid = hssacMaster.HSSACMasterSid;
    //                                 this.logger.log(`HSN/SAC for charge ${rate.ChargeMasterSid}: HSNCode = ${hsnCode}, HSSACMasterSid = ${hsnSACMasterSid}`);
    //                             } else {
    //                                 this.logger.warn(`No HSSACMaster found for HSNCode: ${hsnCode} (ChargeMasterSid: ${rate.ChargeMasterSid})`);
    //                             }
    //                         } else {
    //                             this.logger.warn(`No HSNCode found in chargeTaxMaster for ChargeMasterSid ${rate.ChargeMasterSid}`);
    //                         }
    //                     } else {
    //                         this.logger.warn(`No chargeTaxMaster found for ChargeMasterSid ${rate.ChargeMasterSid}`);
    //                     }
    //                 }

    //                 const amount = Number(isRevenue ? (rate.RevenueAmount || 0) : (rate.CostAmount || 0));
    //                 const localAmount = Number(isRevenue ? (rate.RevenueLocalAmount || 0) : (rate.CostLocalAmount || 0));
    //                 const exchangeRate = Number(isRevenue ? (rate.RevenueExchangeRate || 1) : (rate.CostExchangeRate || 1));
    //                 const perUnit = Number(isRevenue ? (rate.RevenueRate || 0) : (rate.CostRate || 0));
                    
    //                 // Calculate tax using manually selected tax group if available
    //                 let taxPercentage1 = 0;
    //                 let taxPercentage2 = 0;
    //                 let taxPercentageIGST = 0;
    //                 let taxAmount1 = 0;
    //                 let taxAmount2 = 0;
    //                 let taxAmountIGST = 0;

    //                 const manualTaxGroup = chargeTaxGroupMap.get(rate.CostRevenueChargesSid);
    //                 if (manualTaxGroup) {
    //                     const taxRate = Number(manualTaxGroup.taxRate);
    //                     const isGSTType = manualTaxGroup.taxType === 'GST' || manualTaxGroup.taxType === 'Input' || manualTaxGroup.taxType === 'Output';
    //                     const isInterState = manualTaxGroup.isInterState || false;

    //                     this.logger.log(`Using manual tax for charge ${rate.CostRevenueChargesSid}: ${manualTaxGroup.taxName} (${taxRate}%, ${manualTaxGroup.taxType}, InterState: ${isInterState})`);

    //                     if (isGSTType) {
    //                         if (isInterState) {
    //                             // Inter-state: IGST - store in Tax1 field (no separate IGST columns in DB)
    //                             taxPercentage1 = taxRate;
    //                             taxAmount1 = (amount * taxPercentage1) / 100;
    //                             taxPercentageIGST = taxRate; // For frontend display
    //                             taxAmountIGST = taxAmount1;  // For frontend display
    //                             this.logger.log(`Applying IGST ${taxRate}% = ${taxAmount1} (stored in Tax1 field)`);
    //                         } else {
    //                             // Intra-state: CGST + SGST (split evenly)
    //                             taxPercentage1 = taxRate / 2; // CGST
    //                             taxPercentage2 = taxRate / 2; // SGST
    //                             taxAmount1 = (amount * taxPercentage1) / 100;
    //                             taxAmount2 = (amount * taxPercentage2) / 100;
    //                             this.logger.log(`Applying CGST ${taxPercentage1}% = ${taxAmount1}, SGST ${taxPercentage2}% = ${taxAmount2}`);
    //                         }
    //                     } else if (manualTaxGroup.taxType === 'VAT') {
    //                         // For VAT: single tax
    //                         taxPercentage1 = taxRate;
    //                         taxAmount1 = (amount * taxPercentage1) / 100;
    //                     }
    //                 }

    //                 return {
    //                     ChargeMasterSid: rate.ChargeMasterSid!,
    //                     ChargeDescription: rate.ChargeDescription || '',
    //                     NumberOfUnit: Number(rate.CostNumberOfUnit || 1),
    //                     Rate: perUnit,
    //                     Amount: amount,
    //                     LocalAmount: localAmount,
    //                     CurrencyCode: currencyCode,
    //                     CurrencyMasterSid: currencyMasterSid ?? 0,
    //                     ExchangeRate: exchangeRate,
    //                     DrCr: isRevenue ? 'C' : 'D', // Revenue=Cr, Cost=Dr
    //                     HSSACMasterSid: hsnSACMasterSid,
    //                     ChargeUOMSid: (isRevenue ? rate.RevenueChargeUomSid : rate.CostChargeUomSid) ?? undefined,
    //                     TaxableAmount: amount,
    //                     TaxPercentage1: taxPercentage1,
    //                     TaxAmount1: taxAmount1,
    //                     TaxPercentage2: taxPercentage2,
    //                     TaxAmount2: taxAmount2,
    //                     TaxPercentageIGST: taxPercentageIGST,
    //                     TaxAmountIGST: taxAmountIGST,
    //                     DepartmentMasterSid: payload.DepartmentMasterSid,
    //                 };
    //             }));

    //             enrichedRates.forEach(detail => {
    //                 subtotal += detail.LocalAmount;
    //                 voucherDetails.push(detail);
    //             });

    //             // 9. Create VoucherHeader using VoucherTypeMaster configuration
    //             const partyName = (billingParty?.CustomerName || '').substring(0, 100);
    //             const partyAddress = (customerBranch?.Address || billingParty?.CustomerAddress1 || '').substring(0, 250);
    //             const narration = `Voucher generated from cost revenue charges`.substring(0, 250);
    //             const createdBy = (payload.createdBy || 'System').substring(0, 50);

    //             // Validate COA from VoucherTypeMaster
    //             if (!voucherTypeMaster.COALedger) {
    //                 throw new BadRequestException(`COA Ledger not configured in VoucherTypeMaster for ${voucherTypeMaster.DocumentTypeName}. Please configure COA in VoucherTypeMaster.`);
    //             }

    //             // Verify COA exists
    //             const coaMaster = await tx.cOAMaster.findUnique({
    //                 where: { COAMasterSid: voucherTypeMaster.COALedger },
    //                 select: { COAMasterSid: true }
    //             });

    //             if (!coaMaster) {
    //                 throw new BadRequestException(`COA with ID ${voucherTypeMaster.COALedger} not found. Please verify VoucherTypeMaster configuration.`);
    //             }

    //             this.logger.log(`Creating voucher header with PartyMasterSid (SubledgerMasterSid): ${subledger.SubledgerMasterSid} for Customer: ${payload.billingPartySid}, VoucherNumber: ${voucherNumber}`);

    //             // Get currency and exchange rate from invoice header or use defaults
    //             let currencyMasterSid: number | undefined;
    //             let exchangeRate = 1;

    //             if (payload.invoiceHeader) {
    //                 currencyMasterSid = payload.invoiceHeader.currencyMasterSid;
    //                 exchangeRate = payload.invoiceHeader.exchangeRate || 1;
    //                 this.logger.log(`Using invoice header currency: ${payload.invoiceHeader.currencyCode} (SID: ${currencyMasterSid}), Exchange Rate: ${exchangeRate}`);
    //             }

    //             const voucherHeader = await tx.voucherHeader.create({
    //                 data: {
    //                     VoucherNumber: voucherNumber,
    //                     VoucherDate: new Date(),
    //                     PostDate: new Date(),
    //                     VoucherType: voucherTypeMaster.VoucherTypeMasterSid,
    //                     Narration: narration,
    //                     COAMasterSid: voucherTypeMaster.COALedger,
    //                     CompanyMasterSid: payload.companyMasterSid,
    //                     BranchMasterSid: payload.branchMasterSid,
    //                     VoucherTypeMasterSid: voucherTypeMaster.VoucherTypeMasterSid,
    //                     PartyMasterSid: subledger.SubledgerMasterSid, // Must use SubledgerMasterSid per DB schema constraint
    //                     MasterJobSid : payload.masterJobSid || null,
    //                     HouseJobSid : payload.houseJobSid || null,
    //                     HouseNumber : payload.houseNumber || null,
    //                     MasterNumber : payload.masterNumber || null,
    //                     PartyName: partyName,
    //                     GST_VAT: payload?.invoiceHeader?.GST_VAT,
    //                     PartyAddress: partyAddress,
    //                     CustomerBranchSid: payload.customerBranchSid,
    //                     InvoiceType: 'REG',
    //                     CurrencyMasterSid: currencyMasterSid,
    //                     ExchangeRate: exchangeRate,
    //                     GSTType: payload.invoiceHeader?.gstType || null, // GST Type for Indian companies
    //                     Status: 'A',
    //                     CreatedBy: createdBy
    //                 }
    //             });

    //             // 10. Create VoucherDetails
    //             let sno = 1;
    //             for (const detail of voucherDetails) {
    //                 await tx.voucherDetail.create({
    //                     data: {
    //                         VoucherHeaderSid: voucherHeader.VoucherHeaderSid,
    //                         Sno: sno++,
    //                         CompanyMasterSid: payload.companyMasterSid,
    //                         BranchMasterSid: payload.branchMasterSid,
    //                         ChargeMasterSid: detail.ChargeMasterSid,
    //                         ChargeDescription: detail.ChargeDescription,
    //                         NumberOfUnit: detail.NumberOfUnit,
    //                         Rate: detail.Rate,
    //                         Amount: detail.Amount,
    //                         TaxableAmount: detail.TaxableAmount || 0,
    //                         TaxPercentage1: detail.TaxPercentage1,
    //                         TaxAmount1: detail.TaxAmount1,
    //                         TaxPercentage2: detail.TaxPercentage2,
    //                         TaxAmount2: detail.TaxAmount2,
    //                         LocalAmount: detail.LocalAmount,
    //                         CurrencyCode: detail.CurrencyCode,
    //                         CurrencyMasterSid: detail.CurrencyMasterSid,
    //                         ExchangeRate: detail.ExchangeRate,
    //                         DrCr: detail.DrCr!,
    //                         HSSACMasterSid: detail.HSSACMasterSid,
    //                         COAMasterSid : detail.COAMasterSid,
    //                         ChargeUOMSid: detail.ChargeUOMSid,
    //                         YearMasterSid : payload.yearMasterSid,
    //                         DepartmentMasterSid: detail.DepartmentMasterSid,
    //                         CreatedBy: payload.createdBy || 'System'
    //                     }
    //                 });
    //             }

    //             // 10.5. Create TDS record for Vendor Invoice
    //             if (payload.voucherType === 'Vendor Invoice') {
    //                 try {
    //                     const tdsConfig = await this.getVendorTDSMapping(payload.billingPartySid, tx);

    //                     if (tdsConfig) {
    //                         // Calculate total taxable amount
    //                         const totalTaxableAmount = voucherDetails.reduce((sum, detail) => {
    //                             return sum + Number(detail.TaxableAmount || detail.Amount || 0);
    //                         },0);

    //                         // Calculate TDS amount
    //                         const tdsAmount = (totalTaxableAmount * Number(tdsConfig.tdsRate)) / 100;

    //                         this.logger.log(`Creating TDS record: Taxable=${totalTaxableAmount}, Rate=${tdsConfig.tdsRate}%, Amount=${tdsAmount}`);

    //                         // Create VoucherTDS record
    //                         await tx.voucherTDS.create({
    //                             data: {
    //                                 VoucherHeaderSid: voucherHeader.VoucherHeaderSid,
    //                                 VoucherDetailSid: voucherHeader.VoucherHeaderSid, // Will be updated to first detail if needed
    //                                 CompanyMasterSid: payload.companyMasterSid,
    //                                 BranchMasterSid: payload.branchMasterSid,
    //                                 TDSSetRateSid: tdsConfig.tdsSetRateSid,
    //                                 ITSectionCode: tdsConfig.itSectionCode,
    //                                 TDSRate: tdsConfig.tdsRate,
    //                                 TaxableAmount: totalTaxableAmount,
    //                                 TDSAmount: tdsAmount,
    //                                 Reason: '', // Optional field for zero TDS reason
    //                                 CreatedBy: payload.createdBy || 'System',
    //                                 Status: 'A'
    //                             }
    //                         });

    //                         this.logger.log('TDS record created successfully');
    //                     } else {
    //                         this.logger.warn(`No TDS configuration found for vendor ${payload.billingPartySid}`);
    //                     }
    //                 } catch (tdsError) {
    //                     this.logger.error(`Error creating TDS record: ${tdsError.message}`);
    //                     // Don't fail the entire transaction, just log the error
    //                 }
    //             }

    //             // 11. Update BookingRates with voucher reference
    //             const isRevenue = payload.voucherType === 'Invoice';
    //             const voucherHeaderField = isRevenue ? 'RevenueVoucherHeaderSid' : 'CostVoucherHeaderSid';
    //             const voucherTypeField = isRevenue ? 'RevenueVoucherTypeMasterSid' : 'CostVoucherTypeMasterSid';

    //             await tx.costRevenueCharges.updateMany({
    //                 where: {
    //                     CostRevenueChargesSid: { in: payload.selectedRateIds }
    //                 },
    //                 data: {
    //                     [voucherHeaderField]: voucherHeader.VoucherHeaderSid,
    //                     [voucherTypeField]: voucherTypeMaster.VoucherTypeMasterSid,
    //                     updatedOn: new Date()
    //                 }
    //             });

    //             // 12. Fetch complete voucher with all relations for frontend display
    //             const completeVoucher = await tx.voucherHeader.findUnique({
    //                 where: { VoucherHeaderSid: voucherHeader.VoucherHeaderSid },
    //                 include: {
    //                     VoucherDetail: {
    //                         where: { Status: 'A' },
    //                         include: {
    //                             chargeMaster: {
    //                                 include: {
    //                                     chargeTaxMaster: {
    //                                         select: {
    //                                             ChargeTaxMasterSid: true,
    //                                             HSNCode: true,
    //                                             description: true,
    //                                             TaxGroup: true,
    //                                             TaxRate: true
    //                                         }
    //                                     }
    //                                 }
    //                             },
    //                             currencyMaster: true,
    //                             hSSACMaster: true
    //                         }
    //                     },
    //                     currencyMaster: true,
    //                     subledgerMaster: true,
    //                     customerBranch: true
    //                 }
    //             });

    //             if (!completeVoucher) {
    //                 throw new InternalServerErrorException('Failed to fetch created voucher');
    //             }

    //             return {
    //                 voucherHeader: completeVoucher,
    //                 voucherDetails: completeVoucher.VoucherDetail,
    //                 updatedRatesCount: payload.selectedRateIds.length
    //             };
    //         });
    //     } catch (error) {
    //         this.logger.error(`Error creating voucher from booking rates: ${error.message}`);
    //         if (error instanceof BadRequestException) {
    //             throw error;
    //         }
    //         throw new InternalServerErrorException('Failed to create voucher from booking rates');
    //     }
    // }
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

    /**
     * Posts a voucher by creating tax entries, party entries, and transactions
     */
    async postVoucherByVoucherSid(
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
    ): Promise<PostVoucherResponseDto> {
        try {
            const result = await this._db.$transaction(async (tx) => {

                const { voucherHeaderSid, companyMasterSid, branchMasterSid, postedBy, taxDetails } = payload;

                const voucher = await tx.voucherHeader.findUnique({
                    where: {
                        VoucherHeaderSid: voucherHeaderSid,
                        CompanyMasterSid: companyMasterSid,
                        BranchMasterSid: branchMasterSid,
                        Status: 'A'
                    },
                    include: {
                        VoucherDetail: {
                            where: { Status: 'A' },
                            orderBy: { Sno: 'asc' },
                        },
                        voucherTypeMaster: true
                    }
                });

                if (!voucher) throw new BadRequestException('Voucher not found.');
                if (voucher.PostStatus === 'P') throw new BadRequestException('Voucher is already posted.');
                if (!voucher.VoucherDetail || voucher.VoucherDetail.length === 0) throw new BadRequestException('No detail lines are found.');
                if (!voucher.voucherTypeMaster) throw new BadRequestException('Voucher type is not found.');

                const voucherType  = voucher.voucherTypeMaster?.DocumentTypeName;


                // Validate year
                const yearMaster = await tx.yearMaster.findUnique({
                    where: {
                        CompanyMasterSid: voucher.CompanyMasterSid,
                        YearMasterSid: payload.yearMasterSid,
                        status: 'A'
                    },
                    select: { StartDate: true, EndDate: true }
                });
                if (!yearMaster) throw new BadRequestException("Year master not found.");

                const voucherDate = new Date(voucher.VoucherDate);
                const startDate = new Date(yearMaster.StartDate);
                const endDate = new Date(yearMaster.EndDate);
                if (voucherDate < startDate || voucherDate > endDate) throw new Error('Voucher date is outside of current financial year.');

                const now = new Date();
                const chargeLineItems = voucher.VoucherDetail;
                const transactionSids: number[] = [];
                const autoGeneratedDetailSids = new Set<number>();
                const allMatchingIds = new Set<number>();
                const fullUpdatedDetail: any[] = [];

                if (!checkIfExJvApplicable(voucherType)) {
                    // --- TAX SUMMARIZATION & AUTO DETAIL CREATION ---
                    const hasAnyTax = chargeLineItems.some(detail => detail.TaxPercentage1 || detail.TaxPercentage2);
                    let createdTaxRows: VoucherDetailDto[] = [];

                    if (hasAnyTax) {
                        const taxSummaries = await this.summarizeTaxes(
                            chargeLineItems,
                            getPartyDrCr(voucherType)!,
                            taxDetails,
                            voucher.CompanyMasterSid,
                            tx
                        );

                        let currentSno = chargeLineItems.length + 1;
                        for (const taxSummary of taxSummaries) {
                            const taxDetail = await tx.voucherDetail.create({
                                data: {
                                    CompanyMasterSid: voucher.CompanyMasterSid,
                                    BranchMasterSid: voucher.BranchMasterSid,
                                    VoucherHeaderSid: voucherHeaderSid,
                                    Sno: new Decimal(currentSno++),
                                    ChargeDescription: `${taxSummary.taxType} @ ${taxSummary.taxPercentage}% - ${taxSummary.hsSacCode}`,
                                    COAMasterSid: taxSummary.coaMasterSid,
                                    LedgerMasterSid: taxSummary.ledgerMasterSid,
                                    HSSACMasterSid: taxSummary.hsSacMasterSid,
                                    DepartmentMasterSid : voucher.DepartmentMasterSid,
                                    HouseJobSid : voucher.HouseJobSid,
                                    MasterJobSid : voucher.MasterJobSid,
                                    CostRevenue : voucher.voucherTypeMaster.DocumentTypeName === "Invoice" ||  voucher.voucherTypeMaster.DocumentTypeName === "Credit Note" ? "Revenue" : "Cost",
                                    CurrencyMasterSid: voucher.CurrencyMasterSid!,
                                    CurrencyCode: voucher.CurrencyCode!,
                                    ExchangeRate: new Decimal(1),
                                    Rate: new Decimal(taxSummary.taxAmount),
                                    NumberOfUnit: new Decimal(1),
                                    Narration: voucher.Narration,
                                    DrCr: taxSummary.DrCr!,
                                    TaxableAmount: new Decimal(taxSummary.taxableAmount),
                                    Amount: new Decimal(taxSummary.taxAmount),
                                    LocalAmount: new Decimal(taxSummary.taxAmount),
                                    PartyAmount: new Decimal(0),
                                    YearMasterSid : payload.yearMasterSid,
                                    IsAutoGenerated : 'Y',
                                    Status: 'A',
                                    CreatedBy: postedBy,
                                    CreatedOn: now,
                                }
                            });
                            createdTaxRows.push(taxDetail as any);
                            autoGeneratedDetailSids.add(taxDetail.VoucherDetailSid);
                        }
                    }

                    // --- PARTY ROW CREATION ---
                    const allDetails = [...chargeLineItems, ...createdTaxRows];

                    let totalDebit = 0;
                    let totalCredit = 0;
                    for (const line of allDetails) {
                        const amount = this.toNumber(line.Amount);
                        if (this.normalizeDrCr(line.DrCr!) === 'D') totalDebit += amount;
                        else if (this.normalizeDrCr(line.DrCr!) === 'C') totalCredit += amount;
                        else throw new Error("DrCr not found for a line item");
                    }

                    let totalLocalCredit = 0;
                    let totalLocalDebit = 0;
                    for (const line of allDetails) {
                        const amount = this.toNumber(line.LocalAmount);
                        if (this.normalizeDrCr(line.DrCr!) === 'D') totalLocalDebit += amount;
                        else if (this.normalizeDrCr(line.DrCr!) === 'C') totalLocalCredit += amount;
                        else throw new Error("DrCr not found for a line item");
                    }

                    const totalAmount = Math.abs(totalCredit - totalDebit);
                    const totalLocalAmount = Math.abs(totalLocalCredit - totalLocalDebit);
                    const partyDrCr = getPartyDrCr(voucher.voucherTypeMaster.DocumentTypeName);
                    const partyDetail = await tx.voucherDetail.create({
                        data: {
                            CompanyMasterSid: voucher.CompanyMasterSid,
                            BranchMasterSid: voucher.BranchMasterSid,
                            VoucherHeaderSid: voucherHeaderSid,
                            Sno: new Decimal(allDetails.length + 1),
                            ChargeDescription: voucher.PartyName || "Party",
                            DepartmentMasterSid : voucher.DepartmentMasterSid,
                            LedgerMasterSid: voucher.PartyMasterSid,
                            COAMasterSid: voucher.COAMasterSid,
                            HouseJobSid : voucher.HouseJobSid,
                            MasterJobSid : voucher.MasterJobSid,
                            CostRevenue : voucher.voucherTypeMaster.DocumentTypeName === "Invoice" ||  voucher.voucherTypeMaster.DocumentTypeName === "Credit Note" ? "Revenue" : "Cost",
                            CurrencyMasterSid: voucher.CurrencyMasterSid!,
                            CurrencyCode: voucher.CurrencyCode!,
                            ExchangeRate: voucher.ExchangeRate || new Decimal(1),
                            Rate: new Decimal(totalAmount),
                            NumberOfUnit: new Decimal(1),
                            Narration: voucher.Narration || 'Party Entry',
                            DrCr: partyDrCr!,
                            TaxableAmount: new Decimal(0),
                            Amount: new Decimal(totalAmount),
                            LocalAmount: new Decimal(totalLocalAmount),
                            PartyAmount: new Decimal(totalLocalAmount / Number(voucher.ExchangeRate || 1)),
                            IsAutoGenerated : 'Y',
                            Status: 'A',
                            YearMasterSid : payload.yearMasterSid,
                            CreatedBy: postedBy,
                            CreatedOn: now,
                        }
                    });
                    autoGeneratedDetailSids.add(partyDetail.VoucherDetailSid);

                    // --- CREATE TRANSACTIONS FOR ALL DETAILS (including party) ---
                    const allDetailsWithParty = [...allDetails, partyDetail];
                    for (const detail of allDetailsWithParty) {
                        const documentType = voucher.voucherTypeMaster.DocumentTypeName;
                        const costRevenue = documentType === "Invoice" || documentType === "CreditNote" ? "Revenue" : "Cost";
                        const transaction = await tx.voucherTransaction.create({
                            data: {
                                CompanyMasterSid: voucher.CompanyMasterSid,
                                BranchMasterSid: voucher.BranchMasterSid,
                                VoucherHeaderSid: voucherHeaderSid,
                                VoucherDetailSid: detail.VoucherDetailSid,
                                VoucherNumber: voucher.VoucherNumber,
                                VoucherType: voucher.VoucherType,
                                VoucherDate: voucher.VoucherDate,
                                PostDate: now,
                                GST_VAT: voucher.GST_VAT || '',
                                Sno: detail.Sno,
                                ChargeMasterSid : detail.ChargeMasterSid || null,
                                ChargeDescription: detail.ChargeDescription || '',
                                LedgerMasterSid: detail.LedgerMasterSid!,
                                COAMasterSid: detail.COAMasterSid!,
                                DepartmentMasterSid: detail.DepartmentMasterSid || voucher.DepartmentMasterSid || null,
                                HouseJobSid: detail.HouseJobSid || voucher.HouseJobSid || null,
                                MasterJobSid: detail.MasterJobSid || voucher.MasterJobSid || null,
                                CostRevenue: detail.CostRevenue || costRevenue,
                                CurrencyCode: detail.CurrencyCode,
                                ExchangeRate: detail.ExchangeRate || new Decimal(1),
                                Rate: detail.Rate || new Decimal(0),
                                NumberOfUnit: detail.NumberOfUnit || new Decimal(1),
                                Narration: detail.Narration,
                                DrCr: String(detail.DrCr).charAt(0) || '',
                                TaxableAmount: detail.TaxableAmount,
                                Amount: detail.Amount || new Decimal(0),
                                LocalAmount: detail.LocalAmount || new Decimal(0),
                                CostCenter: detail.CostCenter,
                                ProfitCenter: detail.ProfitCenter,
                                TransType: detail.DrCr === 'D' ? 'DR' : 'CR',
                                VoucherTypeMasterSid: voucher.VoucherTypeMasterSid,
                                YearMasterSid: detail.YearMasterSid,
                                IsAutoGenerated: autoGeneratedDetailSids.has(detail.VoucherDetailSid) ? 'Y' : 'N',
                                Status: 'A',
                                CreatedBy: postedBy,
                                CreatedOn: now,
                            }
                        });

                        transactionSids.push(transaction.VoucherTransactionSid);

                        // Link VoucherDetail to VoucherTransaction and fetch subledger type
                        const completeDetail = await tx.voucherDetail.update({
                            where: { VoucherDetailSid: detail.VoucherDetailSid },
                            data: { VoucherTransactionSid: transaction.VoucherTransactionSid },
                            include: { subledgerMaster: { select: { SubledgerType: true } } }
                        });
                        fullUpdatedDetail.push(completeDetail);
                    }

                    // --- MATCHING LOGIC (only when applicable) ---
                    if (checkIfMatchingApplicable(voucherType)) {
                        // party line from recorded transactions (Customer subledger)
                        const partyDtlInRecTrans = fullUpdatedDetail.find(d => d.subledgerMaster?.SubledgerType === 'Customer');

                        if (!partyDtlInRecTrans) {
                            throw new BadRequestException('Party Voucher Detail not found in recorded transactions');
                        }

                        const billMatchingCurrencyAmount = chargeLineItems.reduce((sum, detail) => sum + Number(detail.Amount), 0);
                        const billMatchingLocalAmount = chargeLineItems.reduce((sum, detail) => sum + Number(detail.LocalAmount), 0);

                        // Reversal voucher is mandatory.
                        if (!voucher.ReversalVoucher) {
                            throw new BadRequestException('Reversal Voucher is not supported');
                        }

                        const partyDetailInInv = await tx.voucherHeader.findFirst({
                            where: { VoucherHeaderSid: voucher.ReversalVoucher! },
                            include: {
                                VoucherDetail: {
                                    where: { Status: 'A' },
                                    include: { subledgerMaster: { select: { SubledgerType: true } } }
                                }
                            }
                        });

                        const partyDtlInInvTrans = (partyDetailInInv?.VoucherDetail || [])
                            .find(vd => vd.subledgerMaster?.SubledgerType === 'Customer');

                        if (!partyDtlInInvTrans) {
                            throw new BadRequestException('Party Voucher Detail not found in reversal/invoice voucher');
                        }

                        // Adjust amounts for matching
                        partyDtlInInvTrans.Amount = new Decimal(billMatchingCurrencyAmount);
                        partyDtlInInvTrans.LocalAmount = new Decimal(billMatchingLocalAmount);

                        const matchingRecords = await this.createVoucherMatching({
                            CompanyMasterSid: payload.companyMasterSid,
                            BranchMasterSid: payload.branchMasterSid,
                            VoucherHeaderSid: voucherHeaderSid,
                            voucherTypeInName: voucher?.voucherTypeMaster.DocumentTypeName,
                            VoucherTypeMasterSid: voucher?.voucherTypeMaster.VoucherTypeMasterSid,
                            PostDate: voucher.PostDate!,
                            Narration: `${voucher.VoucherNumber} ${voucher.VoucherDate.toISOString().split('T')[0]} ${voucher.CurrencyCode} ${voucher.Amount}`,
                            createdBy: payload.postedBy,
                            partyVoucherDetail: partyDtlInRecTrans,
                            voucherMatching: [partyDtlInInvTrans],
                            BillMatchingCurrencyAmount: billMatchingCurrencyAmount,
                            BillMatchingLocalAmount: billMatchingLocalAmount,
                        }, tx);

                        (matchingRecords.voucherMatchingDetails || []).forEach(mr => allMatchingIds.add(mr.VoucherMatchingSid));
                    }

                } else {
                    // --- For voucher types that CAN have exchange rate JV (Receipt/Payment) ---
                    let sumOfCurrencyDebits = 0;
                    let sumOfCurrencyCredits = 0;
                    chargeLineItems.forEach(detail => {
                        if (detail.DrCr === 'D') sumOfCurrencyDebits += this.toNumber(detail.Amount);
                        else sumOfCurrencyCredits += this.toNumber(detail.Amount);
                    });
                    if (sumOfCurrencyCredits - sumOfCurrencyDebits !== 0) {
                        throw new BadRequestException('Sum of currency debits and credits should be zero.');
                    }

                    let sumOfLocalDebits = 0;
                    let sumOfLocalCredits = 0;
                    chargeLineItems.forEach(detail => {
                        if (detail.DrCr === 'D') sumOfLocalDebits += this.toNumber(detail.LocalAmount);
                        else sumOfLocalCredits += this.toNumber(detail.LocalAmount);
                    });

                    let allDetails = [...chargeLineItems];
                    const exchangeRateMismatch = sumOfLocalCredits - sumOfLocalDebits;
                    if (exchangeRateMismatch) {
                        const exchangeRateDetail = await tx.voucherDetail.create({
                            data: {
                                CompanyMasterSid: payload.companyMasterSid,
                                BranchMasterSid: payload.branchMasterSid,
                                VoucherHeaderSid: voucherHeaderSid,
                                Sno: chargeLineItems.length + 1,
                                ChargeDescription: 'Exchange Rate',
                                COAMasterSid: await this.getExchangeRateMismatchLedger(payload.companyMasterSid),
                                DepartmentMasterSid: voucher.DepartmentMasterSid,
                                HouseJobSid: voucher.HouseJobSid,
                                MasterJobSid: voucher.MasterJobSid,
                                CurrencyMasterSid: payload.localCurrencyMasterSid,
                                CurrencyCode: payload.localCurrencyCode,
                                ExchangeRate: 1,
                                Rate: exchangeRateMismatch,
                                NumberOfUnit: 1,
                                Narration: 'Exchange Rate',
                                DrCr: exchangeRateMismatch > 0 ? 'C' : 'D',
                                Amount: Math.abs(exchangeRateMismatch),
                                LocalAmount: Math.abs(exchangeRateMismatch),
                                TaxableAmount: 0,
                                YearMasterSid : payload.yearMasterSid,
                                CreatedBy: payload.postedBy,
                                Status: 'A',
                            }
                        });
                        allDetails = [...allDetails, exchangeRateDetail];
                    }

                    for (const detail of allDetails) {
                        const transaction = await tx.voucherTransaction.create({
                            data: {
                                CompanyMasterSid: voucher.CompanyMasterSid,
                                BranchMasterSid: voucher.BranchMasterSid,
                                VoucherHeaderSid: voucherHeaderSid,
                                VoucherDetailSid: detail.VoucherDetailSid,
                                VoucherNumber: voucher.VoucherNumber,
                                VoucherType: voucher.VoucherType,
                                VoucherDate: voucher.VoucherDate,
                                PostDate: now,
                                GST_VAT: voucher.GST_VAT || '',
                                Sno: detail.Sno,
                                ChargeDescription: detail.ChargeDescription || '',
                                LedgerMasterSid: detail.LedgerMasterSid!,
                                COAMasterSid: detail.COAMasterSid!,
                                DepartmentMasterSid: detail.DepartmentMasterSid || voucher.DepartmentMasterSid || null,
                                HouseJobSid: detail.HouseJobSid || voucher.HouseJobSid || null,
                                MasterJobSid: detail.MasterJobSid || voucher.MasterJobSid || null,
                                CostRevenue: detail.CostRevenue || '',
                                CurrencyCode: detail.CurrencyCode,
                                ExchangeRate: detail.ExchangeRate || new Decimal(1),
                                Rate: detail.Rate || new Decimal(0),
                                NumberOfUnit: detail.NumberOfUnit || new Decimal(1),
                                Narration: detail.Narration,
                                DrCr: String(detail.DrCr).charAt(0) || '',
                                TaxableAmount: detail.TaxableAmount,
                                Amount: detail.Amount || new Decimal(0),
                                LocalAmount: detail.LocalAmount || new Decimal(0),
                                CostCenter: detail.CostCenter,
                                ProfitCenter: detail.ProfitCenter,
                                TransType: detail.DrCr === 'D' ? 'DR' : 'CR',
                                VoucherTypeMasterSid: voucher.VoucherTypeMasterSid,
                                YearMasterSid: payload.yearMasterSid || null,
                                IsAutoGenerated: autoGeneratedDetailSids.has(detail.VoucherDetailSid) ? 'Y' : 'N',
                                Status: 'A',
                                CreatedBy: postedBy,
                                CreatedOn: now,
                            }
                        });

                        transactionSids.push(transaction.VoucherTransactionSid);

                        const completeDetail = await tx.voucherDetail.update({
                            where: { VoucherDetailSid: detail.VoucherDetailSid },
                            data: { VoucherTransactionSid: transaction.VoucherTransactionSid },
                            include : {
                                subledgerMaster : {select : {SubledgerType : true}}
                            }
                        });

                        fullUpdatedDetail.push(completeDetail);
                    }
                    if (checkIfMatchingApplicable(voucherType)) {

                        // party line from recorded transactions (Customer subledger)
                        const partyDtlInRecTrans = fullUpdatedDetail.find(d => d.subledgerMaster?.SubledgerType === 'Customer');

                        if (!partyDtlInRecTrans) {
                            throw new BadRequestException('Party Voucher Detail not found in recorded transactions');
                        }

                        const billMatchingCurrencyAmount = chargeLineItems.reduce((sum, detail) => sum + Number(detail.Amount), 0);
                        const billMatchingLocalAmount = chargeLineItems.reduce((sum, detail) => sum + Number(detail.LocalAmount), 0);

                        // Reversal voucher is mandatory.
                        if (!voucher.ReversalVoucher) {
                            throw new BadRequestException('Reversal Voucher is not supported');
                        }

                        const partyDetailInInv = await tx.voucherHeader.findFirst({
                            where: { VoucherHeaderSid: voucher.ReversalVoucher! },
                            include: {
                                VoucherDetail: {
                                    where: { Status: 'A' },
                                    include: { subledgerMaster: { select: { SubledgerType: true } } }
                                }
                            }
                        });

                        const partyDtlInInvTrans = (partyDetailInInv?.VoucherDetail || [])
                            .find(vd => vd.subledgerMaster?.SubledgerType === 'Customer');

                        if (!partyDtlInInvTrans) {
                            throw new BadRequestException('Party Voucher Detail not found in reversal/invoice voucher');
                        }

                        // Adjust amounts for matching
                        partyDtlInInvTrans.Amount = new Decimal(billMatchingCurrencyAmount);
                        partyDtlInInvTrans.LocalAmount = new Decimal(billMatchingLocalAmount);

                        const matchings = await this.createVoucherMatching({
                            CompanyMasterSid: payload.companyMasterSid,
                            BranchMasterSid: payload.branchMasterSid,
                            VoucherHeaderSid: voucherHeaderSid,
                            voucherTypeInName: voucher?.voucherTypeMaster.DocumentTypeName,
                            VoucherTypeMasterSid: voucher?.voucherTypeMaster.VoucherTypeMasterSid,
                            PostDate: voucher.PostDate!,
                            Narration: `${voucher.VoucherNumber} ${voucher.VoucherDate.toISOString().split('T')[0]} ${voucher.CurrencyCode} ${voucher.Amount}`,
                            createdBy: payload.postedBy,
                            partyVoucherDetail: partyDtlInRecTrans,
                            voucherMatching: [partyDtlInInvTrans],
                            BillMatchingCurrencyAmount: billMatchingCurrencyAmount,
                            BillMatchingLocalAmount: billMatchingLocalAmount,
                        }, tx);

                        (matchings.voucherMatchingDetails || []).forEach(mr => allMatchingIds.add(mr.VoucherMatchingSid));
                    }
                }

                const partyDetail = fullUpdatedDetail.find(
                    d => d.subledgerMaster?.SubledgerType === 'Customer' ||
                        d.LedgerMasterSid === voucher.PartyMasterSid
                );
                // --- Mark header as posted ---
                await tx.voucherHeader.update({
                    where: { VoucherHeaderSid: voucherHeaderSid },
                    data: {
                        Amount: partyDetail.Amount,
                        LocalAmount: partyDetail.LocalAmount, 
                        PostStatus: 'P',
                        PostDate: now,
                        UpdatedOn: now,
                        UpdatedBy: postedBy
                    }
                });

                this.logger.log(`Successfully posted voucher ${voucherHeaderSid}: ${transactionSids.length} transactions created`);

                return {
                    success: true,
                    voucherHeaderSid: voucherHeaderSid,
                    transactionCount: transactionSids.length,
                    transactionSids: transactionSids,
                    matchingSids: Array.from(allMatchingIds),
                    postedAt: now,
                    errors: [],
                    message: 'Voucher posted successfully'
                };
            });

            return result;
        } catch (error) {
            throw error;
        }
    }

    /**
     * Summarizes taxes by grouping detail lines by HS/SAC code and tax type
     * Fetches subledger information for each tax from SubledgerMaster table
     * @param details - Array of voucher detail lines
     * @param taxDetails - Tax configuration details (country, category, type, etc.)
     * @param companyMasterSid - Company ID
     * @param tx - Prisma transaction object
     * @returns Array of tax summaries grouped by HS/SAC code and tax type
     */
    async summarizeTaxes(
        details: VoucherDetailDto[],
        PartyDrCr : 'D' | 'C',
        taxDetails: {
            CountryMasterSid: number,
            countryName: string,
            TaxCategory: 'Inter' | 'Intra',
            EffectiveFrom: Date,
            TaxType: 'Input' | 'Output',
        },
        companyMasterSid: number,
        tx?: any
    ): Promise<TaxSummaryDto[]> {
        try {
            this.logger.log('Summarizing taxes by HS/SAC code');

            const db = tx || this._db;

            // Group details by HS/SAC code and tax type
            const taxGroups = new Map<string, TaxSummaryDto>();

            for (const detail of details) {
                // Skip if no tax
                if (!detail.TaxPercentage1 && !detail.TaxPercentage2) {
                    continue;
                }

                const hsSacMasterSid = detail.HSSACMasterSid;
                if (!hsSacMasterSid) {
                    continue;
                }

                // Step 1: Fetch HS/SAC master
                const hsSacMaster = await db.hSSACMaster.findUnique({
                    where: { HSSACMasterSid: hsSacMasterSid },
                    include: {
                        taxGroup: {
                            select: {
                                TaxGroupSid: true,
                                TaxGroup: true,
                            }
                        }
                    }
                });

                if (!hsSacMaster) {
                    this.logger.warn(`HS/SAC Master not found for SID: ${hsSacMasterSid}`);
                    continue;
                }

                // Step 2: Validate if taxGroup exists
                if (!hsSacMaster.taxGroup) {
                    this.logger.warn(`Tax Group not found for HS/SAC: ${hsSacMaster.HSSACCode}`);
                    continue;
                }

                // Step 3: Fetch tax masters separately with proper filtering
                const taxMasters = await db.taxMaster.findMany({
                    where: {
                        TaxGroupSid: hsSacMaster.taxGroup.TaxGroupSid,
                        Status: 'A',
                        TaxType: taxDetails.TaxType,
                        CountryMasterSid: taxDetails.CountryMasterSid,
                        TaxCategory: taxDetails.TaxCategory,
                        EffectiveFrom: {
                            lte: taxDetails.EffectiveFrom
                        }
                    }
                });

                // Step 4: Validate if taxMasters exist
                if (!taxMasters || taxMasters.length === 0) {
                    this.logger.warn(
                        `No active tax masters found for HS/SAC: ${hsSacMaster.HSSACCode}, ` +
                        `TaxGroup: ${hsSacMaster.taxGroup.TaxGroup}, ` +
                        `Country: ${taxDetails.countryName}, Category: ${taxDetails.TaxCategory}`
                    );
                    continue;
                }

                const hsSacCode = hsSacMaster.HSSACCode;

                // Determine applicable taxes based on country and category using TaxCode
                let taxesToApply: Array<{
                    taxCode: string;
                    taxMasterSid: number;
                    taxPercentage: number;
                    taxAmount: number;
                }> = [];

                if (taxDetails.countryName.toLowerCase() === "india") {
                    if (taxDetails.TaxCategory === "Inter") {
                        // Intra-state: CGST + SGST
                        const cgstTax = taxMasters.find(t => t.TaxCode === 'CGST');
                        const sgstTax = taxMasters.find(t => t.TaxCode === 'SGST');

                        if (cgstTax && detail.TaxPercentage1 && detail.TaxAmount1) {
                            taxesToApply.push({
                                taxCode: 'CGST',
                                taxMasterSid: cgstTax.TaxMasterSid,
                                taxPercentage: this.toNumber(detail.TaxPercentage1),
                                taxAmount: this.toNumber(detail.TaxAmount1)
                            });
                        }

                        if (sgstTax && detail.TaxPercentage2 && detail.TaxAmount2) {
                            taxesToApply.push({
                                taxCode: 'SGST',
                                taxMasterSid: sgstTax.TaxMasterSid,
                                taxPercentage: this.toNumber(detail.TaxPercentage2),
                                taxAmount: this.toNumber(detail.TaxAmount2)
                            });
                        }
                    } else if (taxDetails.TaxCategory === "Intra") {
                        // Inter-state: IGST
                        const igstTax = taxMasters.find(t => t.TaxCode === 'IGST');

                        if (igstTax && detail.TaxPercentage1 && detail.TaxAmount1) {
                            taxesToApply.push({
                                taxCode: 'IGST',
                                taxMasterSid: igstTax.TaxMasterSid,
                                taxPercentage: this.toNumber(detail.TaxPercentage1),
                                taxAmount: this.toNumber(detail.TaxAmount1)
                            });
                        }
                    }
                } else if (taxDetails.countryName.toLowerCase() === "united arab emirates") {
                    if (taxDetails.TaxCategory === "Inter") {
                        // UAE: VAT
                        const vatTax = taxMasters.find(t => t.TaxCode === 'VAT');

                        if (vatTax && detail.TaxPercentage1 && detail.TaxAmount1) {
                            taxesToApply.push({
                                taxCode: 'VAT',
                                taxMasterSid: vatTax.TaxMasterSid,
                                taxPercentage: this.toNumber(detail.TaxPercentage1),
                                taxAmount: this.toNumber(detail.TaxAmount1)
                            });
                        }
                    }
                }

                // Process each applicable tax
                const taxableAmount = this.toNumber(detail.TaxableAmount);

                for (const tax of taxesToApply) {
                    // Key combines HS/SAC code, tax code, and tax percentage to group same taxes together
                    const key = `${hsSacMasterSid}_${tax.taxCode}_${tax.taxPercentage}`;

                    if (!taxGroups.has(key)) {
                        // Fetch Subledger information using TaxMasterSid
                        const subledgerMapping = await db.subledgerMaster.findFirst({
                            where: {
                                SubledgerMappingSid : tax.taxMasterSid,
                                CompanyMasterSid :companyMasterSid,
                                SubledgerType : "Tax",
                                Status: 'A'
                            },
                            select: {
                                SubledgerMasterSid: true,
                                DrCOAMasterSid: true,
                                CrCOAMasterSid: true
                            }
                        });

                        if (!subledgerMapping) {
                            throw new BadRequestException(
                                `Subledger mapping not found for Tax: ${tax.taxCode} `
                            )
                        }

                        let finalLedger = PartyDrCr === 'D' ? subledgerMapping.CrCOAMasterSid : subledgerMapping.DrCOAMasterSid;

                        if(!finalLedger){
                            throw new BadRequestException(
                                `Please configure the ${PartyDrCr === 'D' ? 'Creditor' : 'Debitor'} ledger for ${tax.taxCode} in subledger master.`
                            )
                        }

                        taxGroups.set(key, {
                            hsSacMasterSid: hsSacMasterSid,
                            hsSacCode: hsSacCode,
                            taxType: tax.taxCode,
                            taxPercentage: tax.taxPercentage,
                            taxableAmount: 0,
                            taxAmount: 0,
                            coaMasterSid:finalLedger,
                            ledgerMasterSid: subledgerMapping.SubledgerMasterSid,
                            taxMasterSid: tax.taxMasterSid,
                            DrCr: detail.DrCr!
                        });
                    }

                    const group = taxGroups.get(key);
                    if (group) {
                        group.taxableAmount += taxableAmount;
                        group.taxAmount += tax.taxAmount;
                    }
                }
            }

            const result = Array.from(taxGroups.values());
            this.logger.log(`Summarized ${result.length} tax entries : ${JSON.stringify(result)}`);
            return result;

        } catch (error) {
            this.logger.error(`Error summarizing taxes: ${error.message}`, error.stack);
            throw error;
        }
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
     * Gets or creates a COA account for a specific tax type
     * @param companyMasterSid - Company ID
     * @param taxType - Type of tax (CGST, SGST, IGST, VAT)
     * @param taxPercentage - Tax percentage
     * @returns COA Master Sid for the tax account
     */
    private async getTaxCOAAccount(
        companyMasterSid: number,
        taxType: string,
        taxPercentage: number,
    ): Promise<{ LedgerMasterSid: number, COAMasterSid: number }> {
        try {
            // Try to find existing tax COA by searching for account with tax type in name
            const taxLedger = await this._db.subledgerMaster.findFirst({
                where: {
                    CompanyMasterSid: companyMasterSid,
                    SubledgerName: taxType,
                    SubledgerType: 'Tax',
                    Status: 'A',
                },
            });

            if (!taxLedger || !taxLedger.SubledgerMasterSid) {
                throw new BadRequestException(
                    `No ledger has been mapped mapped for ${taxType}. Please configure tax accounts in Chart of Accounts.`,
                );
            }

            return {
                LedgerMasterSid: taxLedger.SubledgerMasterSid,
                COAMasterSid: taxLedger.DrCOAMasterSid!
            }
        } catch (error) {
            this.logger.error(`Error getting tax COA account: ${error.message}`, error.stack);
            throw error;
        }
    }

    async getExchangeRateMismatchLedger(companyMasterSid:number){
        try {
            const companyData = await this._db.companyMaster.findUnique({
                where : {
                    CompanyMasterSid : companyMasterSid,
                    status : 'A'
                },
                select : {
                    CompanyMasterSid : true,
                    companyName : true,
                    config : true
                }
            })

            if(!companyData){
                throw new BadRequestException('Company not found');
            }

            if(!companyData.config){
                throw new BadRequestException('Company config not found');
            }

            return companyData.config['exchangeRateMismatchLedger'] || null;
        } catch (error) {
            throw error;
        }
    }

    /**
 * Helper: Normalizes DrCr values to 'D' or 'C'
 */
    private normalizeDrCr(drCr: string): string {
        if (!drCr) return 'D';
        const normalized = drCr.toUpperCase().trim();
        if (normalized.startsWith('D')) return 'D';
        if (normalized.startsWith('C')) return 'C';
        return drCr;
    }

  async softDeleteVoucherDetail(VoucherDetailSid: number) {
    try {
        const result = await this._db.voucherDetail.update({
            where: { 
                VoucherDetailSid: VoucherDetailSid,
                Status: 'A' 
            },
            data: {
                Status: 'D',
            }
        });

        if (!result) {
            throw new BadRequestException(`Voucher detail with ID ${VoucherDetailSid} not found or already deleted`);
        }

        this.logger.log(`Soft deleted voucher detail with ID: ${VoucherDetailSid}`);
        return result;
    } catch (error) {
        throw error;
    }
}

    async createVoucherMatching(payload: VoucherMatchingPayload,prisma: any){
        try {
            const newNumber = await this.generateVoucherMatchingHeaderNo(
                payload.CompanyMasterSid,
                payload.BranchMasterSid,
                prisma
            );

            const createdVoucherHeader = await prisma.voucherMatchingHeader.create({
                data : {
                    CreatedBy : payload.createdBy,
                    Status : 'A',
                    CompanyMasterSid : payload.CompanyMasterSid,
                    BranchMasterSid : payload.BranchMasterSid,
                    VoucherHeaderSid : payload.VoucherHeaderSid,
                    VoucherMatchingNo : newNumber,
                    VoucherMatchingDate : payload.PostDate,
                    Narration : payload.Narration,
                    Remarks : ""
                }
            })

            const allMatchingDetails : any[] = [];
            const partyDetail = payload.partyVoucherDetail;
            const partyMatchingDetail = await prisma.voucherMatching.create({
                data : {
                    CreatedBy : payload.createdBy,
                    Status : 'A',
                    CompanyMasterSid : payload.CompanyMasterSid,
                    BranchMasterSid : payload.BranchMasterSid,
                    VoucherMatchingHeaderSid : createdVoucherHeader.VoucherMatchingHeaderSid,
                    VoucherHeaderSid : payload.VoucherHeaderSid,
                    VoucherDetailSid : partyDetail.VoucherDetailSid,
                    VoucherTransactionSid : partyDetail.VoucherTransactionSid!,
                    MatchingTransactionSid : partyDetail.VoucherTransactionSid, // receiptId,
                    VoucherMatchingDate : payload.PostDate,
                    VoucherType : payload.VoucherTypeMasterSid,
                    Sno : partyDetail.Sno,
                    COAMasterSid : partyDetail.COAMasterSid,
                    LedgerMasterSid : partyDetail.LedgerMasterSid!,
                    CurrencyCode : partyDetail.CurrencyCode,
                    ExchangeRate : partyDetail.ExchangeRate,
                    DrCr : partyDetail.DrCr! || getPartyDrCr(payload.voucherTypeInName)!,
                    Amount : payload.BillMatchingCurrencyAmount,
                    LocalAmount : payload.BillMatchingLocalAmount,
                    MatchingType : 'Source'
                }
            })
            allMatchingDetails.push(partyMatchingDetail);

            const matchings = payload.voucherMatching;
            let index = 1;
            for (const matching of matchings) {
                const matchingDetail = await prisma.voucherMatching.create({
                    data: {
                        CreatedBy: payload.createdBy,
                        Status: 'A',
                        CompanyMasterSid: payload.CompanyMasterSid,
                        BranchMasterSid: payload.BranchMasterSid,
                        VoucherMatchingHeaderSid: createdVoucherHeader.VoucherMatchingHeaderSid,
                        VoucherHeaderSid: matching.VoucherHeaderSid,
                        VoucherDetailSid: matching.VoucherDetailSid,
                        VoucherTransactionSid: matching.VoucherTransactionSid,
                        MatchingTransactionSid: partyMatchingDetail.VoucherTransactionSid,
                        VoucherMatchingDate: payload.PostDate,
                        VoucherType: parseInt(matching.VoucherType) || parseInt(matching.VoucherTypeMasterSid) || 0,
                        Sno: index++,
                        COAMasterSid: matching.COAMasterSid,
                        LedgerMasterSid: matching.LedgerMasterSid,
                        CurrencyCode: matching.CurrencyCode,
                        ExchangeRate: matching.ExchangeRate,
                        DrCr: String(matching.DrCr).charAt(0),
                        Amount: matching.Amount,
                        LocalAmount: matching.LocalAmount,
                        MatchingType: 'Object'
                    }
                })
                allMatchingDetails.push(matchingDetail);
            }
            return {
                ...createdVoucherHeader,
                voucherMatchingDetails : allMatchingDetails
            }
        } catch (error) {
            throw error;
        }
    }


    /**
   * Generate voucherma voucher number
   */
    private async generateVoucherMatchingHeaderNo(
        companySid: number,
        branchSid: number,
        prisma : PrismaClient
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

}
