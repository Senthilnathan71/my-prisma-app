import { BadRequestException, Injectable, InternalServerErrorException, Logger, NotFoundException } from '@nestjs/common';
import { DatabaseService } from 'src/database/database.service';
import { Prisma } from '@prisma/client';
import { VoucherService } from '../voucher/voucher.service';
import { VoucherPeriodService } from 'src/masters/services/voucher-period/voucher-period.service';
import { PullVoucherDTO, VoucherHeaderDto } from 'src/accounts/dto/voucher.dto';
import { roundAmount, statusWhereClause, toNumber } from 'src/common/helper';
import { DOC_TYPE_CODE } from 'src/common/config/voucher-type.config';

@Injectable()
export class VendorCreditNoteService {
    private readonly logger = new Logger(VendorCreditNoteService.name);

    constructor(
        private readonly _db: DatabaseService,
        private readonly voucherService: VoucherService,
        private readonly voucherPeriodService: VoucherPeriodService,
    ) {}

    async createVendorCreditNote(payload: any): Promise<any> {
            try {
                // Validate period before creating vendor credit note (AP module)
                const periodValidation = await this.voucherPeriodService.validateVoucherPeriod({
                    voucherDate: payload.VoucherDate || new Date(),
                    module: 'AP',
                    CompanyMasterSid: payload.CompanyMasterSid,
                    BranchMasterSid: payload.BranchMasterSid
                });
                if (!periodValidation.allowed) {
                    throw new BadRequestException(periodValidation.message);
                }

                return await this._db.$transaction(async (tx) => {
                    // Validate vendor exists
                    if (!payload.PartyMasterSid) {
                        throw new BadRequestException('Vendor (PartyMasterSid) is required');
                    }

                    // Get VoucherTypeMaster for "Vendor Credit Note"
                    const voucherTypeMaster = await tx.voucherTypeMaster.findFirst({
                        where: {
                            DocumentTypeCode: DOC_TYPE_CODE.VENDOR_CREDIT_NOTE,
                            CompanyMasterSid: payload.CompanyMasterSid,
                            BranchMasterSid: payload.BranchMasterSid,
                            status: 'A'
                        }
                    });

                    if (!voucherTypeMaster) {
                        throw new BadRequestException(
                            'Vendor Credit Note voucher type not configured. Please configure "Vendor Credit Note" in VoucherTypeMaster for this company/branch.'
                        );
                    }

                    // Generate Voucher Number using config-based approach
                    const VoucherNumber = await this.voucherService.generateVoucherNumberFromConfig(
                        voucherTypeMaster,
                        payload.CompanyMasterSid,
                        payload.BranchMasterSid,
                        payload.YearMasterSid,
                        tx,
                        payload.VoucherDate ? new Date(payload.VoucherDate) : undefined
                    );
    
                    // Get currency master ID
                    let currencyMasterSid = payload.CurrencyMasterSid;
                    if (!currencyMasterSid && payload.CurrencyCode) {
                        const currency = await tx.currencyMaster.findFirst({
                            where: { currencyCode: payload.CurrencyCode }
                        });
                        currencyMasterSid = currency?.CurrencyMasterSid;
                    }
    
                    // Create VoucherHeader
                    const voucherHeader = await tx.voucherHeader.create({
                        data: {
                            VoucherNumber: VoucherNumber,
                            VoucherDate: payload.VoucherDate ? new Date(payload.VoucherDate) : new Date(),
                            PostDate: null,
                            VoucherType: voucherTypeMaster.VoucherTypeMasterSid,
                            Narration: payload.Narration || '',
                            COAMasterSid: payload.COAMasterSid,
                            CompanyMasterSid: payload.CompanyMasterSid,
                            BranchMasterSid: payload.BranchMasterSid,
                            VoucherTypeMasterSid: voucherTypeMaster.VoucherTypeMasterSid,
                            PartyMasterSid: payload.PartyMasterSid, // Vendor SubledgerMasterSid
                            PartyName: payload.PartyName || '',
                            PartyAddress: payload.PartyAddress || '',
                            CustomerBranchSid: payload.CustomerBranchSid,
                            PostStatus: payload.PostStatus,
                            PlaceOfSupply: payload.PlaceOfSupply,
                            GST_VAT: payload.GSTNo || payload.GST_VAT,
                            InvoiceType: payload.InvoiceType || 'B2B',
                            GSTType: payload.GSTType,
                            CurrencyMasterSid: currencyMasterSid,
                            CurrencyCode: payload.CurrencyCode,
                            ExchangeRate: payload.ExchangeRate || 1,
                            DocumentNumber: payload.BillNo || payload.DocumentNumber,
                            DocumentDate: payload.BillDate ? new Date(payload.BillDate) : null,
                            Amount: payload.BillAmt || payload.Amount,
                            BookingHeaderSid : payload.BookingHeaderSid || null,
                            MasterJobSid: payload.MasterJobSid,
                            HouseJobSid: payload.HouseJobSid,
                            MasterNumber: payload.MBLNo,
                            HouseNumber: payload.HBLNo,
                            Remarks: payload.Remarks,
                            Status: payload.status || 'A',
                            CreatedBy: payload.CreatedBy || 'System',
                            ReversalVoucher: payload.ReversalVoucher || null,
                            CreditNoteReason : payload.CreditNoteReason || null,
                            CashOrBank : payload.CashOrBank || null,
                            Salesman : payload.Salesman || null,
                            DepartmentMasterSid : payload.DepartmentMasterSid || null
                        }
                    });
    
                    // Create VoucherDetails
                    let totalTaxableAmount = 0;
                    const finalDetails : any[] = [];
                    if (payload.VoucherDetail && Array.isArray(payload.VoucherDetail)) {
                        let sno = 1;
                        for (const detail of payload.VoucherDetail) {
                            const newDetail = await tx.voucherDetail.create({
                                data: {
                                    VoucherHeaderSid: voucherHeader.VoucherHeaderSid,
                                    Sno: sno++,
                                    CompanyMasterSid: payload.CompanyMasterSid,
                                    BranchMasterSid: payload.BranchMasterSid,
                                    ChargeMasterSid: detail.ChargeMasterSid,
                                    ChargeDescription: detail.ChargeDescription || '',
                                    HSSACMasterSid: detail.HSSACMasterSid,
                                    ChargeUOMSid: detail.ChargeUOMSid,
                                    NumberOfUnit: detail.NumberOfUnit || 1,
                                    Rate: detail.Rate || 0,
                                    Amount: detail.Amount || 0,
                                    TaxableAmount: detail.TaxableAmount || detail.Amount || 0,
                                    TaxPercentage1: detail.TaxPercentage1 || 0, // CGST or VAT
                                    TaxAmount1: detail.TaxAmount1 || 0,
                                    TaxPercentage2: detail.TaxPercentage2 || 0, // SGST
                                    TaxAmount2: detail.TaxAmount2 || 0,
                                    LocalAmount: detail.LocalAmount || 0,
                                    CurrencyCode: detail.CurrencyCode || payload.CurrencyCode,
                                    CurrencyMasterSid: detail.CurrencyMasterSid || currencyMasterSid,
                                    ExchangeRate: detail.ExchangeRate || payload.ExchangeRate || 1,
                                    DrCr: detail.DrCr || 'D', // Vendor CreditNote = Debit (payable)
                                    LedgerMasterSid: detail.LedgerMasterSid,
                                    COAMasterSid: detail.COAMasterSid,
                                    PartyAmount : detail.PartyAmount,
                                    MasterJobSid: detail.MasterJobSid || payload.MasterJobSid,
                                    HouseJobSid: detail.HouseJobSid || payload.HouseJobSid,
                                    DepartmentMasterSid : detail.DepartmentMasterSid || payload.DepartmentMasterSid,
                                    YearMasterSid : detail.YearMasterSid || payload.YearMasterSid,
                                    CreatedBy: payload.CreatedBy || 'System',
                                    SourceDetailSid : detail.SourceDetailSid,
                                    Narration : detail.Narration,
                                    BookingRatesSid : detail.BookingRatesSid,
                                    CostRevenueChargesSid : detail.CostRevenueChargesSid,
                                    Status: 'A'
                                }
                            });
                            finalDetails.push(newDetail);
                            totalTaxableAmount += Number(detail.TaxableAmount || detail.Amount || 0);
                        }
                    }
    
                    // Create VoucherTDS if TDS data provided or fetch from vendor mapping
                    // if (payload.VoucherTDS || totalTaxableAmount > 0) {
                    //     try {
                    //         let tdsData = payload.VoucherTDS;
    
                    //         if (!tdsData) {
                    //             const tdsConfig = await this.voucherService.getVendorTDSMapping(payload.PartyMasterSid, tx);
                    //             if (tdsConfig) {
                    //                 const tdsAmount = this.voucherService.calculateTDSAmount(totalTaxableAmount, tdsConfig.tdsRate);
                    //                 tdsData = {
                    //                     TDSSetRateSid: tdsConfig.tdsSetRateSid,
                    //                     ITSectionCode: tdsConfig.itSectionCode || '',
                    //                     TDSRate: tdsConfig.tdsRate,
                    //                     TaxableAmount: totalTaxableAmount,
                    //                     TDSAmount: tdsAmount,
                    //                     Reason: ''
                    //                 };
                    //             }
                    //         }
    
                    //         if (tdsData) {
                    //             await tx.voucherTDS.create({
                    //                 data: {
                    //                     VoucherHeaderSid: voucherHeader.VoucherHeaderSid,
                    //                     VoucherDetailSid: voucherHeader.VoucherHeaderSid, // Can be updated to specific detail
                    //                     CompanyMasterSid: payload.CompanyMasterSid,
                    //                     BranchMasterSid: payload.BranchMasterSid,
                    //                     TDSSetRateSid: tdsData.TDSSetRateSid,
                    //                     ITSectionCode: tdsData.ITSectionCode || '',
                    //                     TDSRate: tdsData.TDSRate || 0,
                    //                     TaxableAmount: tdsData.TaxableAmount || totalTaxableAmount,
                    //                     TDSAmount: tdsData.TDSAmount || 0,
                    //                     Reason: tdsData.Reason || '',
                    //                     CreatedBy: payload.CreatedBy || 'System',
                    //                     Status: 'A'
                    //                 }
                    //             });
                    //         }
                    //     } catch (tdsError) {
                    //         this.logger.warn(`TDS creation error: ${tdsError.message}`);
                    //     }
                    // }
    
                    // Create VoucherOthers if provided
                    if (payload.VoucherOthers) {
                        await tx.voucherOthers.create({
                            data: {
                                VoucherHeaderSid: voucherHeader.VoucherHeaderSid,
                                ContainerNumber: payload.VoucherOthers.ContainerNumber || '',
                                VoucherNote: payload.VoucherOthers.VoucherNote || '',
                                Footer: payload.VoucherOthers.Footer || '',
                                IRNNumber: payload.VoucherOthers.IRNNumber,
                                IRNStatus: payload.VoucherOthers.IRNStatus,
                                IRNQRCode: payload.VoucherOthers.IRNQRCode,
                                CreatedBy: payload.CreatedBy || 'System',
                                Status: 'A'
                            }
                        });
                    }
    
                    // Fetch complete vendor creditnote with relations
                    if(voucherTypeMaster.IsAutoPosting === 'Y'){
                        const postResult = await this.voucherService.postVoucherByVoucherSid({
                            voucherHeaderSid : voucherHeader.VoucherHeaderSid,
                            companyMasterSid : voucherHeader.CompanyMasterSid,
                            branchMasterSid : voucherHeader.BranchMasterSid,
                            yearMasterSid : payload.YearMasterSid,
                            current_date : payload.current_date,
                            localCurrencyMasterSid : Number(payload?.PostingInfo?.LocalCurrencyMasterSid),
                            localCurrencyCode : String(payload?.PostingInfo?.LocalCurrencyCode),
                            postedBy : payload.CreatedBy,
                            taxDetails : payload?.PostingInfo?.TaxDetails,
                        }, tx );

                        if(postResult && payload.IsFullyReversed) {
                            const isBookingScreen = !!voucherHeader.BookingHeaderSid && !voucherHeader.HouseJobSid;
                            await this.voucherService.handleFullVoucherReversal({
                                VoucherHeaderSid : voucherHeader.VoucherHeaderSid,
                                VoucherDetails : finalDetails,
                                userEmail : payload.CreatedBy,
                                isBookingScreen
                            }, 'cost', tx );
                        }
                    }

    
                    return {
                        ...voucherHeader,
                        VoucherDetail : finalDetails
                    };
                },{timeout : 60000});
            } catch (error) {
                this.logger.error(`Error creating vendor creditNote: ${error.message}`);
                if (error instanceof BadRequestException) {
                    throw error;
                }
                throw new InternalServerErrorException('Failed to create vendor creditNote');
            }
        }

        async fetchVendorCreditNotes(): Promise<any[]> {
        try {
            const vendorCreditNotes = await this._db.voucherHeader.findMany({
                where: {
                    voucherTypeMaster: {
                        DocumentTypeCode : DOC_TYPE_CODE.VENDOR_CREDIT_NOTE
                    },
                    Status: 'A'
                },
                include: {
                    VoucherDetail: true,
                    // VoucherTDS: true,
                    VoucherOthers: true,
                    subledgerMaster: true,
                    currencyMaster: true,
                    masterJob: true,
                    houseJob: true
                },
                orderBy: {
                    VoucherDate: 'desc'
                }
            });

            return vendorCreditNotes;
        } catch (error) {
            this.logger.error(`Error fetching vendor creditNotes: ${error.message}`);
            throw new InternalServerErrorException('Failed to fetch vendor creditNotes');
        }
    }

    async fetchVendorCreditNoteById(VoucherHeaderSid: number, tx?: Prisma.TransactionClient): Promise<any> {
            try {
                const db = tx || this._db;
    
                const vendorCreditNote = await db.voucherHeader.findUnique({
                    where: { VoucherHeaderSid },
                    include: {
                        VoucherDetail: {
                            where: { Status: 'A' },
                            include: {
                                chargeMaster: {
                                    include: {
                                        chargeTaxMaster: true
                                    }
                                },
                                hSSACMaster: true,
                                currencyMaster: true
                            },
                            orderBy : {
                                Sno : 'asc'
                            }
                        },
                        // VoucherTDS: {
                        //     where: { Status: 'A' },
                        //     include: {
                        //         TDSSetRate: {
                        //             include: {
                        //                 tdsSetHeader: true
                        //             }
                        //         }
                        //     }
                        // },
                        VoucherOthers: {
                            where: { Status: 'A' }
                        },
                        subledgerMaster: true,
                        customerBranch: true,
                        currencyMaster: true,
                        masterJob: true,
                        houseJob: true,
                        voucherTypeMaster: true,
                        
                    }
                }); 

                if (!vendorCreditNote) {
                    throw new NotFoundException(`Vendor CreditNote with ID ${VoucherHeaderSid} not found`);
                }

                if (vendorCreditNote.ReversalVoucher) {
                    // Checking if any other credit note is created against this vendor invoice
                    const reversalVoucher = await this._db.voucherHeader.findFirst({
                        where: { 
                            AND : [
                                { VoucherHeaderSid : vendorCreditNote.ReversalVoucher },
                                { voucherTypeMaster : { DocumentTypeCode : DOC_TYPE_CODE.VENDOR_INVOICE } },
                                { PostStatus : 'P' },
                            ]
                        },
                        select :{
                            VoucherHeaderSid: true,
                            VoucherNumber: true,
                            VoucherDetail : {
                                select : {
                                    VoucherDetailSid : true,
                                    Rate : true,
                                    CostRevenueChargesSid : true
                                }
                            }
                        }
                    })

                    // If no reversal voucher found, return original vendor credit note
                    if(!reversalVoucher) {
                        return vendorCreditNote;
                    }

                    return {
                        ...vendorCreditNote,
                        reversalVoucher
                    }
                }


    
                return vendorCreditNote;
            } catch (error) {
                throw error;
            }
        }

        async updateVendorCreditNote(VoucherHeaderSid: number, payload: any): Promise<any> {
        try {
            return await this._db.$transaction(async (tx) => {
                // Check if vendor invoice exists
                const existing = await tx.voucherHeader.findUnique({
                    where: { VoucherHeaderSid }
                });

                if (!existing) {
                    throw new NotFoundException(`Vendor CreditNote with ID ${VoucherHeaderSid} not found`);
                }

                // Get currency master ID if needed
                let currencyMasterSid = payload.CurrencyMasterSid;
                if (!currencyMasterSid && payload.CurrencyCode) {
                    const currency = await tx.currencyMaster.findFirst({
                        where: { currencyCode: payload.CurrencyCode }
                    });
                    currencyMasterSid = currency?.CurrencyMasterSid;
                }

                // Update VoucherHeader
                await tx.voucherHeader.update({
                    where: { VoucherHeaderSid },
                    data: {
                        VoucherDate: payload.VoucherDate ? new Date(payload.VoucherDate) : undefined,
                        Narration: payload.Narration,
                        PartyMasterSid: payload.PartyMasterSid,
                        PartyName: payload.PartyName,
                        PartyAddress: payload.PartyAddress,
                        PlaceOfSupply: payload.PlaceOfSupply,
                        GST_VAT: payload.GSTNo || payload.GST_VAT,
                        InvoiceType: payload.InvoiceType,
                        CurrencyMasterSid: currencyMasterSid,
                        CurrencyCode: payload.CurrencyCode,
                        ExchangeRate: payload.ExchangeRate,
                        PostStatus: payload.PostStatus,
                        DocumentNumber: payload.BillNo || payload.DocumentNumber,
                        DocumentDate: payload.BillDate ? new Date(payload.BillDate) : undefined,
                        Amount: payload.BillAmt || payload.Amount,
                        MasterJobSid: payload.MasterJobSid,
                        HouseJobSid: payload.HouseJobSid,
                        MasterNumber: payload.MBLNo,
                        HouseNumber: payload.HBLNo,
                        Remarks: payload.Remarks,
                        Status: payload.status,
                        UpdatedBy: payload.UpdatedBy || 'System',
                        UpdatedOn: new Date(),
                        CreditNoteReason : payload.CreditNoteReason || null,
                    }
                });

                // Update VoucherDetails
                // Update VoucherDetails
if (payload.VoucherDetail && Array.isArray(payload.VoucherDetail)) {

    const incomingIds = payload.VoucherDetail
        .filter(d => d.VoucherDetailSid)
        .map(d => d.VoucherDetailSid);

    // Soft delete removed rows
    await tx.voucherDetail.updateMany({
        where: {
            VoucherHeaderSid,
            VoucherDetailSid: { notIn: incomingIds }
        },
        data: { Status: 'D' }
    });

    let sno = 1;

    for (const detail of payload.VoucherDetail) {
        if (detail.VoucherDetailSid) {
            // -------------------------------
            // UPDATE EXISTING ROW
            // -------------------------------
            await tx.voucherDetail.update({
                where: { VoucherDetailSid: detail.VoucherDetailSid },
                data: {
                    Sno: sno++,
                    ChargeMasterSid: detail.ChargeMasterSid,
                    ChargeDescription: detail.ChargeDescription || '',
                    HSSACMasterSid: detail.HSSACMasterSid,
                    ChargeUOMSid: detail.ChargeUOMSid,
                    NumberOfUnit: detail.NumberOfUnit || 1,
                    Rate: detail.Rate || 0,
                    Amount: detail.Amount || 0,
                    TaxableAmount: detail.TaxableAmount || detail.Amount || 0,
                    TaxPercentage1: detail.TaxPercentage1 || 0,
                    TaxAmount1: detail.TaxAmount1 || 0,
                    TaxPercentage2: detail.TaxPercentage2 || 0,
                    TaxAmount2: detail.TaxAmount2 || 0,
                    LocalAmount: detail.LocalAmount || 0,
                    CurrencyCode: detail.CurrencyCode || payload.CurrencyCode,
                    CurrencyMasterSid: detail.CurrencyMasterSid || currencyMasterSid,
                    ExchangeRate: detail.ExchangeRate || payload.ExchangeRate || 1,
                    DrCr: detail.DrCr || 'D',
                    LedgerMasterSid: detail.LedgerMasterSid,
                    COAMasterSid: detail.COAMasterSid,
                    PartyAmount : detail.PartyAmount,
                    MasterJobSid: detail.MasterJobSid || payload.MasterJobSid,
                    HouseJobSid: detail.HouseJobSid || payload.HouseJobSid,
                    SourceDetailSid : detail.SourceDetailSid || null,
                    UpdatedBy: payload.UpdatedBy || 'System',
                    Status: 'A'
                }
            });

        } else {
            // -------------------------------
            // CREATE NEW ROW
            // -------------------------------
            await tx.voucherDetail.create({
                data: {
                    VoucherHeaderSid,
                    Sno: sno++,
                    CompanyMasterSid: existing.CompanyMasterSid,
                    BranchMasterSid: existing.BranchMasterSid,
                    ChargeMasterSid: detail.ChargeMasterSid,
                    ChargeDescription: detail.ChargeDescription || '',
                    HSSACMasterSid: detail.HSSACMasterSid,
                    ChargeUOMSid: detail.ChargeUOMSid,
                    NumberOfUnit: detail.NumberOfUnit || 1,
                    Rate: detail.Rate || 0,
                    Amount: detail.Amount || 0,
                    TaxableAmount: detail.TaxableAmount || detail.Amount || 0,
                    TaxPercentage1: detail.TaxPercentage1 || 0,
                    TaxAmount1: detail.TaxAmount1 || 0,
                    TaxPercentage2: detail.TaxPercentage2 || 0,
                    TaxAmount2: detail.TaxAmount2 || 0,
                    LocalAmount: detail.LocalAmount || 0,
                    CurrencyCode: detail.CurrencyCode || payload.CurrencyCode,
                    CurrencyMasterSid: detail.CurrencyMasterSid || currencyMasterSid,
                    ExchangeRate: detail.ExchangeRate || payload.ExchangeRate || 1,
                    DrCr: detail.DrCr || 'D',
                    LedgerMasterSid: detail.LedgerMasterSid,
                    COAMasterSid: detail.COAMasterSid,
                    PartyAmount : detail.PartyAmount,
                    MasterJobSid: detail.MasterJobSid || payload.MasterJobSid,
                    HouseJobSid: detail.HouseJobSid || payload.HouseJobSid,
                    YearMasterSid : detail.YearMasterSid || payload.YearMasterSid,
                    SourceDetailSid : detail.SourceDetailSid || null,
                    CreatedBy: payload.UpdatedBy || 'System',
                    Status: 'A'
                }
            });
        }
    }
}


                // Update VoucherOthers
                if (payload.VoucherOthers) {
                    await tx.voucherOthers.updateMany({
                        where: { VoucherHeaderSid },
                        data: { Status: 'D' }
                    });

                    await tx.voucherOthers.create({
                        data: {
                            VoucherHeaderSid,
                            ContainerNumber: payload.VoucherOthers.ContainerNumber || '',
                            VoucherNote: payload.VoucherOthers.VoucherNote || '',
                            Footer: payload.VoucherOthers.Footer || '',
                            CreatedBy: payload.UpdatedBy || 'System',
                            Status: 'A'
                        }
                    });
                }

                // Fetch updated vendor invoice
                return await this.fetchVendorCreditNoteById(VoucherHeaderSid, tx);
            });
        } catch (error) {
            this.logger.error(`Error updating vendor creditNote: ${error.message}`);
            if (error instanceof NotFoundException || error instanceof BadRequestException) {
                throw error;
            }
            throw new InternalServerErrorException('Failed to update vendor creditNote');
        }
    }

    async deleteVendorCreditNote(VoucherHeaderSid: number): Promise<any> {
            try {
                return await this._db.$transaction(async (tx) => {
                    // Check if exists
                    const existing = await tx.voucherHeader.findUnique({
                        where: { VoucherHeaderSid }
                    });
    
                    if (!existing) {
                        throw new NotFoundException(`Vendor CreditNode with ID ${VoucherHeaderSid} not found`);
                    }
    
                    // Soft delete header
                    await tx.voucherHeader.update({
                        where: { VoucherHeaderSid },
                        data: {
                            Status: 'D',
                            UpdatedOn: new Date()
                        }
                    });
    
                    // Soft delete details
                    await tx.voucherDetail.updateMany({
                        where: { VoucherHeaderSid },
                        data: { Status: 'D' }
                    });
    
                    // Soft delete TDS
                    // await tx.voucherTDS.updateMany({
                    //     where: { VoucherHeaderSid },
                    //     data: { Status: 'D' }
                    // });
    
                    // Soft delete others
                    await tx.voucherOthers.updateMany({
                        where: { VoucherHeaderSid },
                        data: { Status: 'D' }
                    });
    
                    return { deleted: true, VoucherHeaderSid };
                });
            } catch (error) {
                this.logger.error(`Error deleting vendor CreditNote: ${error.message}`);
                if (error instanceof NotFoundException) {
                    throw error;
                }
                throw new InternalServerErrorException('Failed to delete vendor creditNote');
            }
        }
    async searchVendorCreditNotes(params: any): Promise<any> {
    try {
        const {
            search = '',
            page = 1,
            pageSize = 10,
            activeCompanyId,
            activeBranchId,
            sortColumn = 'VoucherDate',
            sortDirection = 'desc',
            dateFrom,
            DateFrom,
            dateTo,
            DateTo,
            dateField,
            DateField,
            PartyMasterSid,
            partyMasterSid,
            CustomerMasterSid,
            customerMasterSid,
            CurrencyCode,
            currencyCode
        } = params;

        const skip = (page - 1) * pageSize;
        const take = Number(pageSize);

        const resolvedDateFrom = dateFrom ?? DateFrom;
        const resolvedDateTo = dateTo ?? DateTo;
        const rawDateField = (dateField ?? DateField ?? '').toString();
        const dateFieldMap: Record<string, string> = {
            VoucherDate: 'VoucherDate',
            BillDate: 'DocumentDate'
        };
        const selectedDateField = dateFieldMap[rawDateField] ?? 'VoucherDate';
        const parsedDateFrom = resolvedDateFrom ? new Date(resolvedDateFrom) : null;
        const parsedDateTo = resolvedDateTo ? new Date(resolvedDateTo) : null;
        const normalizedDateFrom = parsedDateFrom && !Number.isNaN(parsedDateFrom.getTime()) ? parsedDateFrom : null;
        const normalizedDateTo = parsedDateTo && !Number.isNaN(parsedDateTo.getTime()) ? parsedDateTo : null;
        const normalizedPartySid = Number(
            PartyMasterSid ?? partyMasterSid ?? CustomerMasterSid ?? customerMasterSid ?? 0
        ) || null;
        const normalizedCurrencyCode = (CurrencyCode ?? currencyCode ?? '').toString().trim();

        const where: Prisma.VoucherHeaderWhereInput = {
            CompanyMasterSid: activeCompanyId,
            BranchMasterSid: activeBranchId,
            Status: statusWhereClause,
            voucherTypeMaster: {
                DocumentTypeCode: DOC_TYPE_CODE.VENDOR_CREDIT_NOTE
            },
            ...(normalizedPartySid && { PartyMasterSid: normalizedPartySid }),
            ...(normalizedCurrencyCode && { CurrencyCode: normalizedCurrencyCode }),
            ...((normalizedDateFrom || normalizedDateTo) && {
                [selectedDateField]: {
                    ...(normalizedDateFrom && { gte: normalizedDateFrom }),
                    ...(normalizedDateTo && { lte: normalizedDateTo })
                }
            })
        };

        if (search) {

            //  STEP 1: Find matching original vouchers
            const matchingOriginalVouchers =
                await this._db.voucherHeader.findMany({
                    where: {
                        VoucherNumber: {
                            contains: search,
                            mode: 'insensitive'
                        }
                    },
                    select: {
                        VoucherHeaderSid: true
                    }
                });

            const reversalIds = matchingOriginalVouchers.map(
                v => v.VoucherHeaderSid
            );

            //  STEP 2: Apply OR search including ReversalVoucher
            where.OR = [
                { VoucherNumber: { contains: search, mode: 'insensitive' } },
                { PartyName: { contains: search, mode: 'insensitive' } },
                { DocumentNumber: { contains: search, mode: 'insensitive' } },
                { MasterNumber: { contains: search, mode: 'insensitive' } },
                { HouseNumber: { contains: search, mode: 'insensitive' } },

                ...(reversalIds.length > 0
                    ? [{ ReversalVoucher: { in: reversalIds } }]
                    : [])
            ];
        }

        const [items, totalCount] = await Promise.all([
            this._db.voucherHeader.findMany({
                where,
                include: {
                    VoucherDetail: {
                        where: { Status: 'A' }
                    },
                    subledgerMaster: true,
                    currencyMaster: true
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

        //  Collect reversal IDs
        const reversalIds = items
            .filter(item => item.ReversalVoucher)
            .map(item => item.ReversalVoucher as number);

        let reversalMap = new Map<number, string>();

        if (reversalIds.length > 0) {
            const reversalVouchers =
                await this._db.voucherHeader.findMany({
                    where: {
                        VoucherHeaderSid: { in: reversalIds }
                    },
                    select: {
                        VoucherHeaderSid: true,
                        VoucherNumber: true
                    }
                });

            reversalMap = new Map(
                reversalVouchers.map(v => [
                    v.VoucherHeaderSid,
                    v.VoucherNumber
                ])
            );
        }

        const enrichedItems = items.map(item => ({
            ...item,
            LocalAmount:
                item.VoucherDetail?.reduce(
                    (sum, d) => sum + Number(d.LocalAmount || 0),
                    0
                ) || 0,

            VendorName: item.PartyName,
            BillNo: item.DocumentNumber,
            BillDate: item.DocumentDate,
            MBLNo: item.MasterNumber,
            HBLNo: item.HouseNumber,

            ReversalVoucherNumber: item.ReversalVoucher
                ? reversalMap.get(item.ReversalVoucher) || null
                : null
        }));

        return {
            items: enrichedItems,
            totalCount,
            page: Number(page),
            pageSize: Number(pageSize)
        };

    } catch (error) {
        this.logger.error(
            `Error searching vendor creditNotes: ${error.message}`
        );
        throw new InternalServerErrorException(
            'Failed to search vendor creditNotes'
        );
    }
}


        async fetchVendorInvoices(CompanyMasterSid: number): Promise<any[]> {
        try {
            const vendorInvoices = await this._db.voucherHeader.findMany({
                where: {
                    voucherTypeMaster: {
                        DocumentTypeCode : DOC_TYPE_CODE.VENDOR_INVOICE
                    },
                    Status: 'A',
                    PostStatus: 'P',
                    CompanyMasterSid: CompanyMasterSid,
                },               
            });

            return vendorInvoices;
        } catch (error) {
            this.logger.error(`Error fetching vendor invoices: ${error.message}`);
            throw new InternalServerErrorException('Failed to fetch vendor invoices');
        }
    }

    async fetchVendorInvoice(
        payload: PullVoucherDTO,
        tx?: Prisma.TransactionClient,
    ): Promise<any> {
        const prisma = tx || this._db;

        const { VoucherNumber, CompanyMasterSid, BranchMasterSid } =
            payload;

        const vendorInvoice = await prisma.voucherHeader.findFirst({
            where: {
                VoucherNumber: { contains: VoucherNumber, mode: 'insensitive' },
                CompanyMasterSid,
                BranchMasterSid,
                voucherTypeMaster: { DocumentTypeCode: DOC_TYPE_CODE.VENDOR_INVOICE },
                Status: 'A',
            },
            include: {
                VoucherDetail: {
                    where: { Status: 'A' },
                    include: {
                        currencyMaster: { select: { amountDecimal: true } },
                    },
                    orderBy: { Sno: 'asc' },
                },
                voucherTypeMaster: { select: { DocumentTypeName: true } },
                currencyMaster: {
                    select: { amountDecimal: true, currencyCode: true },
                },
            },
        });

        if (!vendorInvoice) {
            throw new NotFoundException(
                `Vendor Invoice with Voucher Number ${VoucherNumber} not found`,
            );
        }

        if (vendorInvoice.PostStatus !== 'P') {
            throw new BadRequestException(
                `Vendor Invoice with Voucher Number ${VoucherNumber} is not posted`,
            );
        }

        if (!vendorInvoice.VoucherDetail?.length) {
            throw new BadRequestException(
                `Vendor Invoice with Voucher Number ${VoucherNumber} has no details`,
            );
        }

        const headerCurrencyDecimals =
            vendorInvoice.currencyMaster?.amountDecimal ?? 2;

        /* ------------------------------------------------------------------ */
        /* Helpers                                                            */
        /* ------------------------------------------------------------------ */

        const toSafeNumber = (val: any): number => {
            const n = toNumber(val);
            return Math.abs(n) < 1e-8 ? 0 : n;
        };

        const roundFinal = (val: number, decimals: number): number =>
            roundAmount(val, decimals);


        /* ------------------------------------------------------------------ */
        /* Fetch Credit Notes                                                  */
        /* ------------------------------------------------------------------ */

        const vendorCreditNotes = await prisma.voucherHeader.findMany({
            where: {
                ReversalVoucher: vendorInvoice.VoucherHeaderSid,
                CompanyMasterSid: vendorInvoice.CompanyMasterSid,
                BranchMasterSid: vendorInvoice.BranchMasterSid,
                PostStatus: 'P',
                Status: 'A',
            },
            include: {
                VoucherDetail: { where: { Status: 'A' } , orderBy : { Sno : 'asc' } },
            },
        });

        const creditMap = new Map<number, any[]>();

        vendorCreditNotes.forEach((credit) => {
            credit.VoucherDetail.forEach((d) => {
                if (!d.SourceDetailSid) return;
                const arr = creditMap.get(d.SourceDetailSid) || [];
                creditMap.set(d.SourceDetailSid, [...arr, d]);
            });
        });

        /* ------------------------------------------------------------------ */
        /* Process Voucher Details                                             */
        /* ------------------------------------------------------------------ */

        const updatedDetails = (vendorInvoice.VoucherDetail || [])
            .filter(d => d.IsAutoGenerated === 'N')
            .map((detail) => {
            // const partyAmountRaw = calculatePartyAmountRaw(detail);

            let rate = toSafeNumber(detail.Rate);
            let amount = toSafeNumber(detail.Amount);
            let taxableAmount = toSafeNumber(detail.TaxableAmount);
            let localAmount = toSafeNumber(detail.LocalAmount);
            let tax1 = toSafeNumber(detail.TaxAmount1);
            let tax2 = toSafeNumber(detail.TaxAmount2);
            let partyAmount = toSafeNumber(detail.PartyAmount);

            if (creditMap.has(detail.VoucherDetailSid)) {
                const credits = creditMap.get(detail.VoucherDetailSid)!;

                rate -= credits.reduce((s, d) => s + toSafeNumber(d.Rate), 0);
                amount -= credits.reduce((s, d) => s + toSafeNumber(d.Amount), 0);
                taxableAmount -= credits.reduce(
                    (s, d) => s + toSafeNumber(d.TaxableAmount),
                    0,
                );
                localAmount -= credits.reduce(
                    (s, d) => s + toSafeNumber(d.LocalAmount),
                    0,
                );
                tax1 -= credits.reduce(
                    (s, d) => s + toSafeNumber(d.TaxAmount1),
                    0,
                );
                tax2 -= credits.reduce(
                    (s, d) => s + toSafeNumber(d.TaxAmount2),
                    0,
                );
                partyAmount -= credits.reduce(
                    (s, d) => s + toSafeNumber(d.PartyAmount),
                    0,
                );
            }

            return {
                ...detail,
                Rate: roundFinal(rate, 4),
                Amount: roundFinal(amount, 4),
                TaxableAmount: roundFinal(taxableAmount, 4),
                LocalAmount: roundFinal(localAmount, 4),
                TaxAmount1: roundFinal(tax1, 4),
                TaxAmount2: roundFinal(tax2, 4),
                PartyAmount: roundFinal(partyAmount, headerCurrencyDecimals),
            };
        });

        /* ------------------------------------------------------------------ */
        /* Totals                                                             */
        /* ------------------------------------------------------------------ */

        const partyDetail = (vendorInvoice.VoucherDetail || []).find(d => d.LedgerMasterSid === vendorInvoice.PartyMasterSid);

        if(!partyDetail){
            throw new BadRequestException('Party Voucher Detail not found for Vendor Invoice.');
        }

        if(!partyDetail.VoucherTransactionSid){
            throw new BadRequestException('Party Voucher Transaction Sid not found for Vendor Invoice.');
        }

        let outstanding = await this.voucherService.getOutstandingAmount(partyDetail.VoucherTransactionSid,prisma);
        const osAmount = roundFinal(outstanding.OutstandingAmount, headerCurrencyDecimals);
        const osLocalAmount = roundFinal(outstanding.OutstandingLocalAmount, 4);

        const { VoucherDetail , currencyMaster , voucherTypeMaster , ...header} = vendorInvoice;
        return {
            ...header,
            VoucherDetail: updatedDetails.filter(d => d.IsAutoGenerated === 'N'),
            totalOSAmount : osAmount,
            totalOSLocalAmount : osLocalAmount,
            hasOutstandingAmount: osAmount > 0 || osLocalAmount > 0,
        };
    }


}
