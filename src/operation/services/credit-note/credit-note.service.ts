import { BadRequestException, Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import moment from 'moment';
import { DatabaseService } from 'src/database/database.service';
import { filterDto } from 'src/masters/DTO/search-vessel.dto';

@Injectable()
export class CreditNoteService {
    constructor(
        private _db: DatabaseService,
        private logger: Logger,
    ) {}

    // Helper method to get CurrencyMasterSid by CurrencyCode
     private async getCurrencyMasterIdByCode(currencyCode: string, prisma: any): Promise<number | null> {
       if (!currencyCode) return null;
       
       try {
         const currency = await prisma.currencyMaster.findFirst({
           where: { 
             CurrencyCode: currencyCode,
             Status: 'A'
           },
           select: { CurrencyMasterSid: true }
         });
         
         return currency ? currency.CurrencyMasterSid : null;
       } catch (error) {
         this.logger.warn(`Failed to find currency for code: ${currencyCode}`, error);
         return null;
       }
     }
   
     /**
      * Resolve PartyName into a string suitable for DB:
      * - If payload.PartyName is numeric (branch id) => lookup customerBranch and return Address || BranchName || string(id)
      * - Else if payload.CustomerBranchSid is present => same lookup
      * - Else return the payload.PartyName converted to string (if present) or null
      */
     private async resolvePartyName(payload: any, prisma: any): Promise<string | null> {
       try {
         // If PartyName is present and numeric -> treat as branch id
         if (payload && payload.PartyName != null) {
           const p = payload.PartyName;
           // treat numeric-like strings also as numbers
           const asNum = (typeof p === 'number') ? p : (typeof p === 'string' && p.trim() !== '' && !isNaN(Number(p)) ? Number(p) : null);
           if (asNum != null) {
             const branch = await prisma.customerBranch.findUnique({
               where: { CustomerBranchSid: Number(asNum) } as any,
               select: { Address: true, BranchName: true }
             });
             if (branch) {
               return String(branch.Address || branch.BranchName || asNum);
             }
             // if branch not found, fallback to stringified numeric id
             return String(asNum);
           }
   
           // If PartyName is already a string (non-numeric) use it
           if (typeof p === 'string') {
             return p;
           }
   
           // For other object shapes, try to extract meaningful string fields
           if (typeof p === 'object' && p !== null) {
             if ('Address' in p && p.Address) return String(p.Address);
             if ('CustomerBranchName' in p && p.CustomerBranchName) return String(p.CustomerBranchName);
             if ('PartyName' in p && p.PartyName) return String(p.PartyName);
           }
         }
   
         // If PartyName not provided, check CustomerBranchSid
         if (payload && payload.CustomerBranchSid != null) {
           const cb = payload.CustomerBranchSid;
           const asNum = Number(cb);
           if (!isNaN(asNum)) {
             const branch = await prisma.customerBranch.findUnique({
               where: { CustomerBranchSid: asNum } as any,
               select: { Address: true, BranchName: true }
             });
             if (branch) return String(branch.Address || branch.BranchName || asNum);
             return String(asNum);
           }
         }
   
         return null;
       } catch (err) {
         this.logger.warn('resolvePartyName failed', err);
         // fallback: try to stringify whatever was provided
         if (payload && payload.PartyName != null) return String(payload.PartyName);
         if (payload && payload.CustomerBranchSid != null) return String(payload.CustomerBranchSid);
         return null;
       }
     }

    async allInvoices() {
    try {
      const result = await this._db.voucherHeader.findMany({
        where: { Status: 'A' },
      });
      return result;
    } catch (error) {
      this.logger.error('fetchInvoices error', error);
      throw new InternalServerErrorException("Something Went Wrong while fetching the data");
    }
  }
   
     async fetchCreditNotes() {
       try {
         const result = await this._db.voucherHeader.findMany({
           where: { Status: 'A' },
           include: {
             VoucherDetail: { where: { Status: 'A' } },
             VoucherOthers: { where: { Status: 'A' } },
             masterJob: true,
             houseJob: true,
             currencyMaster: true,
             subledgerMaster: true
           }
         });
         return result;
       } catch (error) {
         this.logger.error('fetchInvoices error', error);
         throw new InternalServerErrorException("Something Went Wrong while fetching the data");
       }
     }
   
     async findVoucherHeaderById(VoucherHeaderSid: number) {
       try {
         const voucherHeader = await this._db.voucherHeader.findUnique({
           where: { VoucherHeaderSid: VoucherHeaderSid, Status: 'A' } as any,
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
                 hSSACMaster: true,
               }
             },
             VoucherOthers: { where: { Status: 'A' } },
             masterJob: { where: { Status: 'A' } },
             houseJob: { where: { status: 'A' } },
             currencyMaster: true,
             subledgerMaster: true,
             customerBranch: true,
             departmentMaster: true
           }
         });
   
         if (!voucherHeader) {
           throw new BadRequestException('Voucher not found');
         }
   
         return voucherHeader;
       } catch (error) {
         this.logger.error('findVoucherHeaderById error', error);
         throw new InternalServerErrorException("Something Went Wrong while fetching the data");
       }
     }
   
     async createCreditNote(payload: any) {
       try {
         return await this._db.$transaction(async (prisma) => {
           // Generate Voucher Number
           const dateString = moment().format('YYYYMMDD');
           const count = await prisma.voucherHeader.count({
             where: { VoucherNumber: { contains: dateString } }
           });
           const VoucherNumber = `CN-${dateString}-${(count + 1).toString().padStart(3, '0')}`;
   
           // Normalize & validate PartyMasterSid
           const providedPartySid = (payload && payload.PartyMasterSid != null && payload.PartyMasterSid !== '')
             ? Number(payload.PartyMasterSid)
             : null;
           if (providedPartySid !== null && Number.isNaN(providedPartySid)) {
             throw new BadRequestException(`Invalid PartyMasterSid: not a number (${payload.PartyMasterSid})`);
           }
           if (providedPartySid !== null) {
             const partyExists = await prisma.subledgerMaster.findUnique({
               where: { SubledgerMasterSid: providedPartySid },
               select: { SubledgerMasterSid: true }
             });
             if (!partyExists) {
               throw new BadRequestException(`Invalid PartyMasterSid: Subledger ${providedPartySid} does not exist`);
             }
           }
   
           // Normalize VoucherTypeMasterSid
           const rawVoucherTypeMasterSid = (payload && payload.VoucherTypeMasterSid != null && payload.VoucherTypeMasterSid !== '')
             ? Number(payload.VoucherTypeMasterSid)
             : null;
           let validatedVoucherTypeMasterSid: number | null = null;
           if (rawVoucherTypeMasterSid !== null) {
             if (Number.isNaN(rawVoucherTypeMasterSid)) {
               this.logger.warn(`createInvoice: incoming VoucherTypeMasterSid not a number: ${payload.VoucherTypeMasterSid}`);
             } else {
               const vtExists = await prisma.voucherTypeMaster.findUnique({
                 where: { VoucherTypeMasterSid: rawVoucherTypeMasterSid },
                 select: { VoucherTypeMasterSid: true }
               });
               if (vtExists) {
                 validatedVoucherTypeMasterSid = rawVoucherTypeMasterSid;
               } else {
                 this.logger.warn(`createInvoice: incoming VoucherTypeMasterSid ${rawVoucherTypeMasterSid} does not exist. Omitting field to avoid FK error.`);
               }
             }
           }
   
           // Resolve PartyName (ensure string) - this handles numeric branch id passed in PartyName
           const resolvedPartyName = await this.resolvePartyName(payload, prisma);
   
           // Build voucherHeader payload
           const voucherHeaderPayload: any = {
             VoucherNumber: VoucherNumber,
             VoucherDate: payload.VoucherDate ? new Date(payload.VoucherDate) : new Date(),
             PostDate: payload.PostDate ? new Date(payload.PostDate) : new Date(),
             CreatedBy: payload.CreatedBy,
             Status: "A",
             CompanyMasterSid: payload.CompanyMasterSid,
             BranchMasterSid: payload.BranchMasterSid,
             VoucherType: payload.VoucherType,
             ...(validatedVoucherTypeMasterSid !== null ? { VoucherTypeMasterSid: validatedVoucherTypeMasterSid } : {}),
             PartyMasterSid: providedPartySid,
             PartyName: resolvedPartyName ?? (payload.PartyName !== undefined && payload.PartyName !== null ? String(payload.PartyName) : null),
             PartyAddress: payload.PartyAddress,
             CustomerBranchSid: payload.CustomerBranchSid || null,
             PlaceOfSupply: payload.PlaceOfSupply,
             State: payload.State,
             COAMasterSid: payload.COAMasterSid,
             GST_VAT: payload.GST_VAT,
             InvoiceType: payload.InvoiceType,
             TaxNumber: payload.TaxNumber,
             GSTType: payload.GSTType,
             CreditNoteReason: payload.CreditNoteReason,
             Remarks: payload.Remarks,
             DepartmentMasterSid: payload.DepartmentMasterSid,
             HouseNumber: payload.HouseNumber,
             MasterNumber: payload.MasterNumber,
             HouseJobSid: payload.HouseJobSid,
             MasterJobSid: payload.MasterJobSid,
             CurrencyMasterSid: payload.CurrencyMasterSid,
             CurrencyCode: payload.CurrencyCode,
             ExchangeRate: payload.ExchangeRate ? Number(payload.ExchangeRate) : null,
             Amount: payload.Amount ? Number(payload.Amount) : null,
             LocalAmount: payload.LocalAmount ? Number(payload.LocalAmount) : null,
             NetAmount: payload.NetAmount ? Number(payload.NetAmount) : null,
             DocumentNumber: payload.DocumentNumber || '',
             DocumentDate: payload.DocumentDate ? new Date(payload.DocumentDate) : null,
             Narration: payload.Narration,
           };
   
           this.logger.debug(`createInvoice - voucherHeaderPayload: ${JSON.stringify(voucherHeaderPayload)}`);
   
           // Create VoucherHeader
           const voucherHeader = await prisma.voucherHeader.create({
             data: voucherHeaderPayload as Prisma.VoucherHeaderUncheckedCreateInput
           });
   
           // Create VoucherDetail rows with proper CurrencyMasterSid mapping
           if (payload.VoucherDetail && Array.isArray(payload.VoucherDetail) && payload.VoucherDetail.length > 0) {
             const voucherDetailsPayload = await Promise.all(
               payload.VoucherDetail.map(async (detail: any, index: number) => {
                 
                 return {
                   VoucherHeaderSid: voucherHeader.VoucherHeaderSid,
                   CreatedBy: payload.CreatedBy,
                   Status: "A",
                   CompanyMasterSid: payload.CompanyMasterSid,
                   BranchMasterSid: payload.BranchMasterSid,
                   Sno: index + 1,
                   ChargeMasterSid: detail.ChargeMasterSid ? Number(detail.ChargeMasterSid) : null,
                   ChargeDescription: detail.ChargeDescription,
                   LedgerMasterSid: detail.LedgerMasterSid ? Number(detail.LedgerMasterSid) : null,
                   COAMasterSid: detail.COAMasterSid ? Number(detail.COAMasterSid) : null,
                   HSSACMasterSid: detail.HSSACMasterSid ? Number(detail.HSSACMasterSid) : null,
                   DepartmentMasterSid: detail.DepartmentMasterSid ? Number(detail.DepartmentMasterSid) : null,
                   HouseJobSid: detail.HouseJobSid ? Number(detail.HouseJobSid) : null,
                   MasterJobSid: detail.MasterJobSid ? Number(detail.MasterJobSid) : null,
                   CostRevenue: detail.CostRevenue,
                   ChargeUOMSid: detail.ChargeUOMSid ? Number(detail.ChargeUOMSid) : null,
                   CurrencyMasterSid: detail.CurrencyMasterSid,
                   CurrencyCode: detail.CurrencyCode,
                   ExchangeRate: detail.ExchangeRate ? Number(detail.ExchangeRate) : null,
                   Rate: detail.Rate ? Number(detail.Rate) : null,
                   NumberOfUnit: detail.NumberOfUnit ? Number(detail.NumberOfUnit) : null,
                   Narration: detail.Narration,
                   DrCr: detail.DrCr,
                   TaxableAmount: detail.TaxableAmount ? Number(detail.TaxableAmount) : null,
                   TaxPercentage1: detail.TaxPercentage1 ? Number(detail.TaxPercentage1) : null,
                   TaxAmount1: detail.TaxAmount1 ? Number(detail.TaxAmount1) : null,
                   TaxPercentage2: detail.TaxPercentage2 ? Number(detail.TaxPercentage2) : null,
                   TaxAmount2: detail.TaxAmount2 ? Number(detail.TaxAmount2) : null,
                   Amount: detail.Amount ? Number(detail.Amount) : null,
                   LocalAmount: detail.LocalAmount ? Number(detail.LocalAmount) : null,
                   PartyAmount: detail.PartyAmount ? Number(detail.PartyAmount) : null,
                   InvoiceType: detail.InvoiceType,
                   CostCenter: detail.CostCenter ? Number(detail.CostCenter) : null,
                   ProfitCenter: detail.ProfitCenter ? Number(detail.ProfitCenter) : null,
                   Remarks: detail.Remarks,
                   CreditNoteReason: detail.CreditNoteReason,
                 };
               })
             );
   
             await prisma.voucherDetail.createMany({
               data: voucherDetailsPayload
             });
           }
   
           // Create VoucherOthers if provided
           if (payload.VoucherOthers) {
             const voucherOthersPayload = {
               VoucherHeaderSid: voucherHeader.VoucherHeaderSid,
               CreatedBy: payload.CreatedBy,
               Status: "A",
               IRNStatus: payload.VoucherOthers.IRNStatus,
               IRNNumber: payload.VoucherOthers.IRNNumber,
               IRNQRCode: payload.VoucherOthers.IRNQRCode,
               VoucherReverseSid: payload.VoucherOthers.VoucherReverseSid ? Number(payload.VoucherOthers.VoucherReverseSid) : null,
               ContainerNumber: payload.VoucherOthers.ContainerNumber,
               VoucherNote: payload.VoucherOthers.VoucherNote,
               Footer: payload.VoucherOthers.Footer
             };
   
             await prisma.voucherOthers.create({
               data: voucherOthersPayload
             });
           }
   
           return voucherHeader;
         });
       } catch (error) {
         this.logger.error(`createInvoice Error: ${error?.message}`, error?.stack);
         if (error instanceof BadRequestException) {
           throw error;
         }
         throw new InternalServerErrorException('Something Went Wrong While Creating Invoice');
       }
     }
   
     async updateVoucherHeaderById(VoucherHeaderSid: number, payload: any) {
       try {
         return await this._db.$transaction(async (prisma) => {
           // Load existing voucher
           const existingVoucher = await prisma.voucherHeader.findUnique({
             where: { VoucherHeaderSid: VoucherHeaderSid } as any
           });
   
           if (!existingVoucher || existingVoucher.Status !== 'A') {
             throw new BadRequestException('Voucher not found');
           }
   
           // Validate PartyMasterSid
           if (payload.PartyMasterSid != null && payload.PartyMasterSid !== '') {
             const subledgerExists = await prisma.subledgerMaster.findUnique({
               where: { SubledgerMasterSid: Number(payload.PartyMasterSid) },
               select: { SubledgerMasterSid: true }
             });
   
             if (!subledgerExists) {
               throw new BadRequestException('Invalid PartyMasterSid: Subledger does not exist');
             }
           }
   
           // Resolve PartyName if a numeric branch id or customer branch provided
           const resolvedPartyNameForUpdate = payload.PartyName != null
             ? await this.resolvePartyName(payload, prisma)
             : null;
   
           // Prepare update payload
           const voucherHeaderPayload: any = {
             UpdatedBy: payload.UpdatedBy,
             UpdatedOn: new Date(),
             VoucherDate: payload.VoucherDate ? new Date(payload.VoucherDate) : existingVoucher.VoucherDate,
             PostDate: payload.PostDate ? new Date(payload.PostDate) : existingVoucher.PostDate,
             PartyMasterSid: payload.PartyMasterSid ? Number(payload.PartyMasterSid) : existingVoucher.PartyMasterSid,
             PartyName: payload.PartyName != null ? (resolvedPartyNameForUpdate ?? String(payload.PartyName)) : existingVoucher.PartyName,
             PartyAddress: payload.PartyAddress || existingVoucher.PartyAddress,
             CustomerBranchSid: payload.CustomerBranchSid || existingVoucher.CustomerBranchSid,
             PlaceOfSupply: payload.PlaceOfSupply || existingVoucher.PlaceOfSupply,
             State: payload.State || existingVoucher.State,
             GST_VAT: payload.GST_VAT || existingVoucher.GST_VAT,
             InvoiceType: payload.InvoiceType || existingVoucher.InvoiceType,
             TaxNumber: payload.TaxNumber || existingVoucher.TaxNumber,
             GSTType: payload.GSTType || existingVoucher.GSTType,
             Remarks: payload.Remarks || existingVoucher.Remarks,
             CreditNoteReason: payload.CreditNoteReason || existingVoucher.CreditNoteReason,
             HouseNumber: payload.HouseNumber || existingVoucher.HouseNumber,
             MasterNumber: payload.MasterNumber || existingVoucher.MasterNumber,
             HouseJobSid: payload.HouseJobSid || existingVoucher.HouseJobSid,
             MasterJobSid: payload.MasterJobSid || existingVoucher.MasterJobSid,
             CurrencyMasterSid: payload.CurrencyMasterSid || existingVoucher.CurrencyMasterSid,
             CurrencyCode: payload.CurrencyCode || existingVoucher.CurrencyCode,
             ExchangeRate: payload.ExchangeRate ? Number(payload.ExchangeRate) : existingVoucher.ExchangeRate,
             Amount: payload.Amount ? Number(payload.Amount) : existingVoucher.Amount,
             LocalAmount: payload.LocalAmount ? Number(payload.LocalAmount) : existingVoucher.LocalAmount,
             NetAmount: payload.NetAmount ? Number(payload.NetAmount) : existingVoucher.NetAmount,
             DocumentNumber: payload.DocumentNumber || existingVoucher.DocumentNumber,
             DocumentDate: payload.DocumentDate ? new Date(payload.DocumentDate) : existingVoucher.DocumentDate,
             Narration: payload.Narration || existingVoucher.Narration
           };
   
           const updatedVoucherHeader = await prisma.voucherHeader.update({
             where: { VoucherHeaderSid: VoucherHeaderSid } as any,
             data: voucherHeaderPayload
           });
   
           // Update VoucherDetail rows with proper CurrencyMasterSid mapping
           if (payload.VoucherDetail && Array.isArray(payload.VoucherDetail) && payload.VoucherDetail.length > 0) {
             await prisma.voucherDetail.updateMany({
               where: { VoucherHeaderSid: VoucherHeaderSid, Status: 'A' },
               data: { Status: 'D', UpdatedBy: payload.UpdatedBy, UpdatedOn: new Date() }
             });
   
             const voucherDetailsPayload = await Promise.all(
               payload.VoucherDetail.map(async (detail: any, index: number) => {
                 const currencyMasterSid = detail.CurrencyMasterSid 
                   ? Number(detail.CurrencyMasterSid)
                   : await this.getCurrencyMasterIdByCode(detail.CurrencyCode, prisma);
                 
                 return {
                   VoucherHeaderSid: VoucherHeaderSid,
                   CreatedBy: payload.UpdatedBy,
                   Status: "A",
                   CompanyMasterSid: existingVoucher.CompanyMasterSid,
                   BranchMasterSid: existingVoucher.BranchMasterSid,
                   Sno: index + 1,
                   ChargeMasterSid: detail.ChargeMasterSid ? Number(detail.ChargeMasterSid) : null,
                   ChargeDescription: detail.ChargeDescription,
                   LedgerMasterSid: detail.LedgerMasterSid ? Number(detail.LedgerMasterSid) : null,
                   COAMasterSid: detail.COAMasterSid ? Number(detail.COAMasterSid) : null,
                   HSSACMasterSid: detail.HSSACMasterSid ? Number(detail.HSSACMasterSid) : null,
                   DepartmentMasterSid: detail.DepartmentMasterSid ? Number(detail.DepartmentMasterSid) : null,
                   HouseJobSid: detail.HouseJobSid ? Number(detail.HouseJobSid) : null,
                   MasterJobSid: detail.MasterJobSid ? Number(detail.MasterJobSid) : null,
                   CostRevenue: detail.CostRevenue,
                   ChargeUOMSid: detail.ChargeUOMSid ? Number(detail.ChargeUOMSid) : null,
                   CurrencyMasterSid: currencyMasterSid,
                   CurrencyCode: detail.CurrencyCode,
                   ExchangeRate: detail.ExchangeRate ? Number(detail.ExchangeRate) : null,
                   Rate: detail.Rate ? Number(detail.Rate) : null,
                   NumberOfUnit: detail.NumberOfUnit ? Number(detail.NumberOfUnit) : null,
                   Narration: detail.Narration,
                   DrCr: detail.DrCr,
                   TaxableAmount: detail.TaxableAmount ? Number(detail.TaxableAmount) : null,
                   TaxPercentage1: detail.TaxPercentage1 ? Number(detail.TaxPercentage1) : null,
                   TaxAmount1: detail.TaxAmount1 ? Number(detail.TaxAmount1) : null,
                   TaxPercentage2: detail.TaxPercentage2 ? Number(detail.TaxPercentage2) : null,
                   TaxAmount2: detail.TaxAmount2 ? Number(detail.TaxAmount2) : null,
                   Amount: detail.Amount ? Number(detail.Amount) : null,
                   LocalAmount: detail.LocalAmount ? Number(detail.LocalAmount) : null,
                   PartyAmount: detail.PartyAmount ? Number(detail.PartyAmount) : null,
                   InvoiceType: detail.InvoiceType,
                   CostCenter: detail.CostCenter ? Number(detail.CostCenter) : null,
                   ProfitCenter: detail.ProfitCenter ? Number(detail.ProfitCenter) : null,
                   Remarks: detail.Remarks,
                   CreditNoteReason: detail.CreditNoteReason,
                 };
               })
             );
   
             await prisma.voucherDetail.createMany({
               data: voucherDetailsPayload
             });
           }
   
           // Update or create VoucherOthers
           if (payload.VoucherOthers) {
             const existingOthers = await prisma.voucherOthers.findFirst({
               where: { VoucherHeaderSid: VoucherHeaderSid, Status: 'A' }
             });
   
             if (existingOthers) {
               await prisma.voucherOthers.update({
                 where: { VoucherOthersSid: existingOthers.VoucherOthersSid },
                 data: {
                   UpdatedBy: payload.UpdatedBy,
                   UpdatedOn: new Date(),
                   IRNStatus: payload.VoucherOthers.IRNStatus, 
                   IRNNumber: payload.VoucherOthers.IRNNumber,
                   IRNQRCode: payload.VoucherOthers.IRNQRCode,
                   VoucherReverseSid: payload.VoucherOthers.VoucherReverseSid ? Number(payload.VoucherOthers.VoucherReverseSid) : null,
                   ContainerNumber: payload.VoucherOthers.ContainerNumber,
                   VoucherNote: payload.VoucherOthers.VoucherNote,
                   Footer: payload.VoucherOthers.Footer
                 }
               });
             } else {
               await prisma.voucherOthers.create({
                 data: {
                   VoucherHeaderSid: VoucherHeaderSid,
                   CreatedBy: payload.UpdatedBy,
                   Status: "A",
                   IRNStatus: payload.VoucherOthers.IRNStatus,
                   IRNNumber: payload.VoucherOthers.IRNNumber,
                   IRNQRCode: payload.VoucherOthers.IRNQRCode,
                   VoucherReverseSid: payload.VoucherOthers.VoucherReverseSid ? Number(payload.VoucherOthers.VoucherReverseSid) : null,
                   ContainerNumber: payload.VoucherOthers.ContainerNumber,
                   VoucherNote: payload.VoucherOthers.VoucherNote,
                   Footer: payload.VoucherOthers.Footer
                 }
               });
             }
           }
   
           return updatedVoucherHeader;
         });
       } catch (error) {
         this.logger.error(`updateVoucherHeaderById Error: ${error?.message}`, error?.stack);
         if (error instanceof BadRequestException) {
           throw error;
         }
         throw new InternalServerErrorException('Something Went Wrong While Updating Invoice');
       }
     }
   
     async deleteVoucherHeader(VoucherHeaderSid: number) {
       try {
         const result = await this._db.$transaction(async (prisma) => {
           const existing = await prisma.voucherHeader.findUnique({
             where: { VoucherHeaderSid: VoucherHeaderSid } as any
           });
   
           if (!existing || existing.Status !== 'A') {
             throw new BadRequestException('Voucher not found or already deleted');
           }
   
           const deletedVoucherHeader = await prisma.voucherHeader.update({
             where: { VoucherHeaderSid: VoucherHeaderSid } as any,
             data: { Status: 'D' }
           });
   
           const deletedVoucherDetails = await prisma.voucherDetail.updateMany({
             where: { VoucherHeaderSid: VoucherHeaderSid, Status: 'A' },
             data: { Status: 'D' }
           });
   
           const deletedVoucherOthers = await prisma.voucherOthers.updateMany({
             where: { VoucherHeaderSid: VoucherHeaderSid, Status: 'A' },
             data: { Status: 'D' }
           });
   
           return {
             deletedVoucherHeader,
             deletedVoucherDetails,
             deletedVoucherOthers
           };
         });
         return result;
       } catch (error) {
         this.logger.error(`deleteVoucherHeader Error: ${error?.message}`, error?.stack);
         throw error;
       }
     }
   
     async searchVoucherHeader(params: any): Promise<any> {
        try{
       const { 
        search = '', 
        page = 1, 
        pageSize = 10, 
        sortColumn = 'VoucherDate',
        sortDirection = 'desc',
        activeCompanyId, 
        activeBranchId 
    } = params;
       const skip = (page - 1) * pageSize;
       const take = Number(pageSize);
   
       const where: any = {
         CompanyMasterSid: activeCompanyId,
         BranchMasterSid: activeBranchId,
         voucherTypeMaster: {
                DocumentTypeName: 'Credit Note'
            },
         Status: 'A',
        }
         if(search) {
           where.OR =[
             { VoucherNumber: { contains: search, mode: 'insensitive' } },
             { PartyName: { contains: search, mode: 'insensitive' } },
             { DocumentNumber: { contains: search, mode: 'insensitive' } },
             { HouseNumber: { contains: search, mode: 'insensitive' } },
             { MasterNumber: { contains: search, mode: 'insensitive' } }
           ];
         };
   
       const [items, totalCount] = await Promise.all([
         this._db.voucherHeader.findMany({
           where,
           skip,
           take: pageSize,
           orderBy: { VoucherHeaderSid: 'desc' },
           include: {
             VoucherDetail: {
               where: { Status: 'A' },
             },
             VoucherTDS: {
                            where: { Status: 'A' }
                        },
                        subledgerMaster: true,
                        currencyMaster: true,
             masterJob: true,
             houseJob: true,
           }
         }),
         this._db.voucherHeader.count({ where }),
       ]);
       const enrichedItems = items.map(item => ({
                ...item,
                LocalAmount: item.VoucherDetail?.reduce((sum, d) => sum + Number(d.LocalAmount || 0), 0) || 0,
                TDSAmount: item.VoucherTDS?.[0]?.TDSAmount || 0,
                VendorName: item.PartyName,
                BillNo: item.DocumentNumber,
                BillDate: item.DocumentDate,
                MBLNo: item.MasterNumber,
                HBLNo: item.HouseNumber
            }));
   
       return {
                items: enrichedItems,
                totalCount,
                page: Number(page),
                pageSize: Number(pageSize)
            };
     } catch (error) {
            this.logger.error(`Error searching vendor invoices: ${error.message}`);
            throw new InternalServerErrorException('Failed to search vendor invoices');
        }
    }
}