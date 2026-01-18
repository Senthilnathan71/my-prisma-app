import { BadRequestException, Injectable, InternalServerErrorException, Logger, NotFoundException } from '@nestjs/common';
import { DatabaseService } from 'src/database/database.service';
import { Prisma } from '@prisma/client';
import { VoucherService } from '../voucher/voucher.service';

@Injectable()
export class VendorCreditNoteService {
    private readonly logger = new Logger(VendorCreditNoteService.name);

    constructor(
        private readonly _db: DatabaseService,
        private readonly voucherService: VoucherService,
    ) {}

    async createVendorCreditNote(payload: any): Promise<any> {
            try {
                return await this._db.$transaction(async (tx) => {
                    // Validate vendor exists
                    if (!payload.PartyMasterSid) {
                        throw new BadRequestException('Vendor (PartyMasterSid) is required');
                    }

                    // Get VoucherTypeMaster for "Vendor Credit Note"
                    const voucherTypeMaster = await tx.voucherTypeMaster.findFirst({
                        where: {
                            DocumentTypeName: 'Vendor Credit Note',
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
                        tx
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
                            PostDate: payload.PostDate ? new Date(payload.PostDate) : new Date(),
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
                            MasterJobSid: payload.MasterJobSid,
                            HouseJobSid: payload.HouseJobSid,
                            MasterNumber: payload.MBLNo,
                            HouseNumber: payload.HBLNo,
                            Remarks: payload.Remarks,
                            Status: payload.status || 'A',
                            CreatedBy: payload.CreatedBy || 'System',
                            ReversalVoucher: payload.ReversalVoucher || null,
                        }
                    });
    
                    // Create VoucherDetails
                    let totalTaxableAmount = 0;
                    if (payload.VoucherDetail && Array.isArray(payload.VoucherDetail)) {
                        let sno = 1;
                        for (const detail of payload.VoucherDetail) {
                            await tx.voucherDetail.create({
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
                                    MasterJobSid: detail.MasterJobSid || payload.MasterJobSid,
                                    HouseJobSid: detail.HouseJobSid || payload.HouseJobSid,
                                    YearMasterSid : detail.YearMasterSid || payload.YearMasterSid,
                                    CreatedBy: payload.CreatedBy || 'System',
                                    Status: 'A'
                                }
                            });
    
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
                    const completeVendorCreditNote = await this.fetchVendorCreditNoteById(voucherHeader.VoucherHeaderSid, tx);
    
                    return {
                        newVoucher: completeVendorCreditNote,
                        VoucherHeaderSid: voucherHeader.VoucherHeaderSid,
                        VoucherNumber: VoucherNumber
                    };
                });
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
                        DocumentTypeName: 'Vendor Credit Note'
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

    async fetchVendorCreditNoteById(VoucherHeaderSid: number, tx?: any): Promise<any> {
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
    
                return vendorCreditNote;
            } catch (error) {
                this.logger.error(`Error fetching vendor creditNote by ID: ${error.message}`);
                if (error instanceof NotFoundException) {
                    throw error;
                }
                throw new InternalServerErrorException('Failed to fetch vendor creditNote');
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
                        UpdatedOn: new Date()
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
                    MasterJobSid: detail.MasterJobSid || payload.MasterJobSid,
                    HouseJobSid: detail.HouseJobSid || payload.HouseJobSid,
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
                    MasterJobSid: detail.MasterJobSid || payload.MasterJobSid,
                    HouseJobSid: detail.HouseJobSid || payload.HouseJobSid,
                    YearMasterSid : detail.YearMasterSid || payload.YearMasterSid,
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
                    activeCompanyId, activeBranchId,
                    sortColumn = 'VoucherDate',
                    sortDirection = 'desc'
                } = params;
    
                const skip = (page - 1) * pageSize;
                const take = Number(pageSize);
    
                // const where: any = {
                //     voucherTypeMaster: {
                //         DocumentTypeName: 'Vendor Credit Note'
                //     },
                //     Status: 'A'
                // };
    const where: Prisma.VoucherHeaderWhereInput = {
      CompanyMasterSid: activeCompanyId,
      BranchMasterSid: activeBranchId,
      Status: 'A',
      voucherTypeMaster: {
      DocumentTypeName:  'Vendor Credit Note'
    },
}
                // Add search filter
                if (search) {
                    where.OR = [
                        { VoucherNumber: { contains: search, mode: 'insensitive' } },
                        { PartyName: { contains: search, mode: 'insensitive' } },
                        { DocumentNumber: { contains: search, mode: 'insensitive' } },
                        { MasterNumber: { contains: search, mode: 'insensitive' } },
                        { HouseNumber: { contains: search, mode: 'insensitive' } }
                    ];
                }
                
    
                const [items, totalCount] = await Promise.all([
                    this._db.voucherHeader.findMany({
                        where,
                        include: {
                            VoucherDetail: {
                                where: { Status: 'A' }
                            },
                            // VoucherTDS: {
                            //     where: { Status: 'A' }
                            // },
                            subledgerMaster: true,
                            currencyMaster: true
                        },
                        orderBy: { VoucherHeaderSid: 'desc' },
                        skip,
                        take
                    }),
                    this._db.voucherHeader.count({ where })
                ]);
    
                // Calculate local amount and TDS amount for each invoice
                const enrichedItems = items.map(item => ({
                    ...item,
                    LocalAmount: item.VoucherDetail?.reduce((sum, d) => sum + Number(d.LocalAmount || 0), 0) || 0,
                    // TDSAmount: item.VoucherTDS?.[0]?.TDSAmount || 0,
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
                this.logger.error(`Error searching vendor creditNotes: ${error.message}`);
                throw new InternalServerErrorException('Failed to search vendor creditNotes');
            }
        }

        async fetchVendorInvoices(CompanyMasterSid: number): Promise<any[]> {
        try {
            const vendorInvoices = await this._db.voucherHeader.findMany({
                where: {
                    voucherTypeMaster: {
                        DocumentTypeName: 'Vendor Invoice'
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

    async fetchVendorInvoiceById(VoucherHeaderSid: number, tx?: any): Promise<any> {
        try {
            const db = tx || this._db;

            const vendorInvoice = await db.voucherHeader.findUnique({
                where: { VoucherHeaderSid },
                include: {
                    // VoucherDetail: {
                    //     where: { Status: 'A' },
                    //     include: {
                    //         chargeMaster: {
                    //             include: {
                    //                 chargeTaxMaster: true
                    //             }
                    //         },
                    //         hSSACMaster: true,
                    //         currencyMaster: true
                    //     }
                    // },
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
                    VoucherTransaction: {
                where: {
                  OR: [
                    { IsAutoGenerated: 'N' },
                    { IsAutoGenerated: null }
                  ]
                },
                include : {
                  voucherDetail : true
                }
            }
                }
            }); 

            if (!vendorInvoice) {
                throw new NotFoundException(`Vendor Invoice with ID ${VoucherHeaderSid} not found`);
            }

            return vendorInvoice;
        } catch (error) {
            this.logger.error(`Error fetching vendor invoice by ID: ${error.message}`);
            if (error instanceof NotFoundException) {
                throw error;
            }
            throw new InternalServerErrorException('Failed to fetch vendor invoice');
        }
    }

}
