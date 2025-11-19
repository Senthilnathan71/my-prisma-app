import { BadRequestException, Injectable, InternalServerErrorException, Logger, NotFoundException } from '@nestjs/common';
import { DatabaseService } from 'src/database/database.service';
import { VoucherService } from '../voucher/voucher.service';

@Injectable()
export class VendorInvoiceService {
    private readonly logger = new Logger(VendorInvoiceService.name);

    constructor(
        private readonly _db: DatabaseService,
        private readonly voucherService: VoucherService
    ) {}

    /**
     * Create Vendor Invoice with TDS
     */
    async createVendorInvoice(payload: any): Promise<any> {
        try {
            return await this._db.$transaction(async (tx) => {
                // Validate vendor exists
                if (!payload.PartyMasterSid) {
                    throw new BadRequestException('Vendor (PartyMasterSid) is required');
                }

                // Get VoucherTypeMaster for "Vendor Invoice"
                const voucherTypeMaster = await tx.voucherTypeMaster.findFirst({
                    where: {
                        DocumentTypeName: 'Vendor Invoice',
                        CompanyMasterSid: payload.CompanyMasterSid,
                        BranchMasterSid: payload.BranchMasterSid,
                        status: 'A'
                    }
                });

                if (!voucherTypeMaster) {
                    throw new BadRequestException(
                        'Vendor Invoice voucher type not configured. Please configure "Vendor Invoice" in VoucherTypeMaster.'
                    );
                }

                // Generate voucher number
                const voucherNumber = await this.voucherService.generateVoucherNumberFromConfig(
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
                        VoucherNumber: voucherNumber,
                        VoucherDate: payload.VoucherDate ? new Date(payload.VoucherDate) : new Date(),
                        PostDate: payload.PostDate ? new Date(payload.PostDate) : new Date(),
                        VoucherType: voucherTypeMaster.VoucherTypeMasterSid,
                        Narration: payload.Narration || '',
                        COAMasterSid: voucherTypeMaster.COALedger ?? 1,
                        CompanyMasterSid: payload.CompanyMasterSid,
                        BranchMasterSid: payload.BranchMasterSid,
                        VoucherTypeMasterSid: voucherTypeMaster.VoucherTypeMasterSid,
                        PartyMasterSid: payload.PartyMasterSid, // Vendor SubledgerMasterSid
                        PartyName: payload.PartyName || '',
                        PartyAddress: payload.PartyAddress || '',
                        CustomerBranchSid: payload.CustomerBranchSid,
                        PlaceOfSupply: payload.PlaceOfSupply,
                        PostStatus: payload.PostStatus,
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
                        CreatedBy: payload.CreatedBy || 'System'
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
                                DrCr: detail.DrCr || 'D', // Vendor invoice = Debit (payable)
                                LedgerMasterSid: detail.LedgerMasterSid,
                                COAMasterSid: detail.COAMasterSid,
                                MasterJobSid: detail.MasterJobSid || payload.MasterJobSid,
                                HouseJobSid: detail.HouseJobSid || payload.HouseJobSid,
                                CreatedBy: payload.CreatedBy || 'System',
                                Status: 'A'
                            }
                        });

                        totalTaxableAmount += Number(detail.TaxableAmount || detail.Amount || 0);
                    }
                }

                // Create VoucherTDS if TDS data provided or fetch from vendor mapping
                if (payload.VoucherTDS || totalTaxableAmount > 0) {
                    try {
                        let tdsData = payload.VoucherTDS;

                        // If TDS data not provided in payload, fetch from vendor mapping
                        if (!tdsData) {
                            const tdsConfig = await this.voucherService.getVendorTDSMapping(payload.PartyMasterSid, tx);
                            if (tdsConfig) {
                                const tdsAmount = this.voucherService.calculateTDSAmount(totalTaxableAmount, tdsConfig.tdsRate);
                                tdsData = {
                                    TDSSetRateSid: tdsConfig.tdsSetRateSid,
                                    ITSectionCode: tdsConfig.itSectionCode || '',
                                    TDSRate: tdsConfig.tdsRate,
                                    TaxableAmount: totalTaxableAmount,
                                    TDSAmount: tdsAmount,
                                    Reason: ''
                                };
                            }
                        }

                        if (tdsData) {
                            await tx.voucherTDS.create({
                                data: {
                                    VoucherHeaderSid: voucherHeader.VoucherHeaderSid,
                                    VoucherDetailSid: voucherHeader.VoucherHeaderSid, // Can be updated to specific detail
                                    CompanyMasterSid: payload.CompanyMasterSid,
                                    BranchMasterSid: payload.BranchMasterSid,
                                    TDSSetRateSid: tdsData.TDSSetRateSid,
                                    ITSectionCode: tdsData.ITSectionCode || '',
                                    TDSRate: tdsData.TDSRate || 0,
                                    TaxableAmount: tdsData.TaxableAmount || totalTaxableAmount,
                                    TDSAmount: tdsData.TDSAmount || 0,
                                    Reason: tdsData.Reason || '',
                                    CreatedBy: payload.CreatedBy || 'System',
                                    Status: 'A'
                                }
                            });
                        }
                    } catch (tdsError) {
                        this.logger.warn(`TDS creation error: ${tdsError.message}`);
                        // Don't fail the transaction for TDS errors
                    }
                }

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

                // Fetch complete vendor invoice with relations
                const completeVendorInvoice = await this.fetchVendorInvoiceById(voucherHeader.VoucherHeaderSid, tx);

                return {
                    newVoucher: completeVendorInvoice,
                    VoucherHeaderSid: voucherHeader.VoucherHeaderSid,
                    VoucherNumber: voucherNumber
                };
            });
        } catch (error) {
            this.logger.error(`Error creating vendor invoice: ${error.message}`);
            if (error instanceof BadRequestException) {
                throw error;
            }
            throw new InternalServerErrorException('Failed to create vendor invoice');
        }
    }

    /**
     * Fetch all vendor invoices
     */
    async fetchVendorInvoices(): Promise<any[]> {
        try {
            const vendorInvoices = await this._db.voucherHeader.findMany({
                where: {
                    voucherTypeMaster: {
                        DocumentTypeName: 'Vendor Invoice'
                    },
                    Status: 'A'
                },
                include: {
                    VoucherDetail: true,
                    VoucherTDS: true,
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

            return vendorInvoices;
        } catch (error) {
            this.logger.error(`Error fetching vendor invoices: ${error.message}`);
            throw new InternalServerErrorException('Failed to fetch vendor invoices');
        }
    }

    /**
     * Fetch vendor invoice by ID
     */
    async fetchVendorInvoiceById(VoucherHeaderSid: number, tx?: any): Promise<any> {
        try {
            const db = tx || this._db;

            const vendorInvoice = await db.voucherHeader.findUnique({
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
                    VoucherTDS: {
                        where: { Status: 'A' },
                        include: {
                            TDSSetRate: {
                                include: {
                                    tdsSetHeader: true
                                }
                            }
                        }
                    },
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

    /**
     * Update vendor invoice
     */
    async updateVendorInvoice(VoucherHeaderSid: number, payload: any): Promise<any> {
        try {
            return await this._db.$transaction(async (tx) => {
                // Check if vendor invoice exists
                const existing = await tx.voucherHeader.findUnique({
                    where: { VoucherHeaderSid }
                });

                if (!existing) {
                    throw new NotFoundException(`Vendor Invoice with ID ${VoucherHeaderSid} not found`);
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
                if (payload.VoucherDetail && Array.isArray(payload.VoucherDetail)) {
                    const incomingIds = payload.VoucherDetail
        .filter(d => d.VoucherDetailSid)
        .map(d => d.VoucherDetailSid);
                    // Delete existing details
                    await tx.voucherDetail.updateMany({
                        where: { VoucherHeaderSid,
                            VoucherDetailSid: { notIn: incomingIds }
                         },
                        data: { Status: 'D' }
                    });

                    // Create new details
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
                    CreatedBy: payload.UpdatedBy || 'System',
                    Status: 'A'
                }
            });
        }
    }

                    // Update TDS
                    // await tx.voucherTDS.updateMany({
                    //     where: { VoucherHeaderSid },
                    //     data: { Status: 'D' }
                    // });

                    // if (payload.VoucherTDS && totalTaxableAmount > 0) {
                    //     await tx.voucherTDS.create({
                    //         data: {
                    //             VoucherHeaderSid: VoucherHeaderSid,
                    //             VoucherDetailSid: VoucherHeaderSid,
                    //             CompanyMasterSid: payload.CompanyMasterSid,
                    //             BranchMasterSid: payload.BranchMasterSid,
                    //             TDSSetRateSid: payload.VoucherTDS.TDSSetRateSid,
                    //             ITSectionCode: payload.VoucherTDS.ITSectionCode || '',
                    //             TDSRate: payload.VoucherTDS.TDSRate || 0,
                    //             TaxableAmount: totalTaxableAmount,
                    //             TDSAmount: payload.VoucherTDS.TDSAmount || 0,
                    //             Reason: payload.VoucherTDS.Reason || '',
                    //             CreatedBy: payload.UpdatedBy || 'System',
                    //             Status: 'A'
                    //         }
                    //     });
                    // }
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
                return await this.fetchVendorInvoiceById(VoucherHeaderSid, tx);
            });
        } catch (error) {
            this.logger.error(`Error updating vendor invoice: ${error.message}`);
            if (error instanceof NotFoundException || error instanceof BadRequestException) {
                throw error;
            }
            throw new InternalServerErrorException('Failed to update vendor invoice');
        }
    }

    /**
     * Delete vendor invoice (soft delete)
     */
    async deleteVendorInvoice(VoucherHeaderSid: number): Promise<any> {
        try {
            return await this._db.$transaction(async (tx) => {
                // Check if exists
                const existing = await tx.voucherHeader.findUnique({
                    where: { VoucherHeaderSid }
                });

                if (!existing) {
                    throw new NotFoundException(`Vendor Invoice with ID ${VoucherHeaderSid} not found`);
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
                await tx.voucherTDS.updateMany({
                    where: { VoucherHeaderSid },
                    data: { Status: 'D' }
                });

                // Soft delete others
                await tx.voucherOthers.updateMany({
                    where: { VoucherHeaderSid },
                    data: { Status: 'D' }
                });

                return { deleted: true, VoucherHeaderSid };
            });
        } catch (error) {
            this.logger.error(`Error deleting vendor invoice: ${error.message}`);
            if (error instanceof NotFoundException) {
                throw error;
            }
            throw new InternalServerErrorException('Failed to delete vendor invoice');
        }
    }

    /**
     * Search vendor invoices with filters and pagination
     */
    async searchVendorInvoices(params: any): Promise<any> {
        try {
            const {
                search = '',
                page = 1,
                pageSize = 10,
                sortColumn = 'VoucherDate',
                sortDirection = 'desc'
            } = params;

            const skip = (page - 1) * pageSize;
            const take = Number(pageSize);

            const where: any = {
                voucherTypeMaster: {
                    DocumentTypeName: 'Vendor Invoice'
                },
                Status: 'A'
            };

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
                        VoucherTDS: {
                            where: { Status: 'A' }
                        },
                        subledgerMaster: true,
                        currencyMaster: true
                    },
                    orderBy: {
                        [sortColumn]: sortDirection
                    },
                    skip,
                    take
                }),
                this._db.voucherHeader.count({ where })
            ]);

            // Calculate local amount and TDS amount for each invoice
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
 // vendor-invoice.service.ts - Add this method

async searchPendingCosts(searchCriteria: {
  searchType: string;
  searchValue: string;
  vendorSid?: number;
  companyMasterSid: number;
  branchMasterSid: number;
}): Promise<any> {
  try {
    const { searchType, searchValue, vendorSid, companyMasterSid, branchMasterSid } = searchCriteria;
    
    if (!searchValue?.trim()) {
      throw new BadRequestException('Search value is required');
    }
    

    // Step 1: Determine search target and build where clause
    let jobRecord: any = null;
    let transactionSid: number | null = null;
    let menuName = '';
    
    // Normalize search value
    const normalizedSearch = searchValue.trim().toUpperCase();

    switch (searchType.toLowerCase()) {
      case 'master job':
      case 'masterjob':
        jobRecord = await this._db.masterJob.findFirst({
          where: {
            MasterJobNumber: { contains: normalizedSearch, mode: 'insensitive' },
            CompanyMasterSid: companyMasterSid,
            BranchMasterSid: branchMasterSid,
            Status: 'A'
          }
        });
        
        if (jobRecord) {
          transactionSid = jobRecord.MasterJobSid;
          menuName = 'MasterJob';
        }
        break;

      case 'house job':
      case 'housejob':
        jobRecord = await this._db.houseJob.findFirst({
          where: {
            OR: [
              { BookingNo: { contains: normalizedSearch, mode: 'insensitive' } },
              { HBLNo: { contains: normalizedSearch, mode: 'insensitive' } }
            ],
            CompanyMasterSid: companyMasterSid,
            BranchMasterSid: branchMasterSid,
            status: 'A'
          }
        });
        
        if (jobRecord) {
          transactionSid = jobRecord.HouseJobSid;
          menuName = 'HouseJob';
        }
        break;

      case 'mbl no':
      case 'mblno':
        jobRecord = await this._db.masterJob.findFirst({
          where: {
            MBLNo: { contains: normalizedSearch, mode: 'insensitive' },
            CompanyMasterSid: companyMasterSid,
            BranchMasterSid: branchMasterSid,
            Status: 'A',
            
          }
        });
        
        if (jobRecord) {
          transactionSid = jobRecord.MasterJobSid;
          menuName = 'MasterJob';
        }
        break;

      case 'hbl no':
      case 'hblno':
        jobRecord = await this._db.houseJob.findFirst({
          where: {
            HBLNo: { contains: normalizedSearch, mode: 'insensitive' },
            CompanyMasterSid: companyMasterSid,
            BranchMasterSid: branchMasterSid,
            status: 'A'
          }
        });
        
        if (jobRecord) {
          transactionSid = jobRecord.HouseJobSid;
          menuName = 'HouseJob';
        }
        break;

      case 'container no':
      case 'containerno':
        const containerRecord = await this._db.masterJobContainer.findFirst({
          where: {
            ContainerNumber: { contains: normalizedSearch, mode: 'insensitive' }
          },
          include: {
            masterJob: {
              select: {
                MasterJobSid: true,
                MasterJobNumber: true,
                MBLNo: true,
                CompanyMasterSid: true,
                BranchMasterSid: true,
                MenuMasterSid: true,
                Status: true
              }
            }
          }
        });
        
        if (containerRecord?.masterJob && containerRecord.masterJob.Status === 'A') {
          jobRecord = containerRecord.masterJob;
          transactionSid = jobRecord.MasterJobSid;
          menuName = 'MasterJob';
        }
        break;

      default:
        throw new BadRequestException(`Unsupported search type: ${searchType}`);
    }

    if (!jobRecord || !transactionSid) {
      return {
        items: [],
        message: 'No matching job found for the search criteria'
      };
    }

    // Step 2: Build cost/revenue query - FIXED WHERE CLAUSE
    const whereClause: any = {
      CompanyMasterSid: companyMasterSid,
      BranchMasterSid: branchMasterSid,
      status: 'A',
      CostVoucherHeaderSid: null, // Only pending costs (not invoiced yet)
    };

    // Add transaction-specific filters based on menu type
     if (menuName === 'MasterJob') {
      whereClause.MasterJobNo = jobRecord.MasterJobNumber;
    } else if (menuName === 'HouseJob') {
      whereClause.ShipmentNo = jobRecord.BookingNo;
    }

    // Add vendor filter if provided
    if (vendorSid) {
      whereClause.CostAgentMasterSid = vendorSid;
    }

    console.log('DEBUG - Search Criteria:', {
      searchType,
      searchValue,
      vendorSid,
      companyMasterSid,
      branchMasterSid
    });

    console.log('DEBUG - Where Clause:', whereClause);

    // Step 3: Fetch pending costs
    const pendingCosts = await this._db.costRevenueCharges.findMany({
      where: whereClause,
      include: {
        chargeMaster: true,
        costChargeUOMMaster: true,
        costCurrencyMaster: true,
        costCustomerMaster: true,
        costCustomerBranch: true
      },
      orderBy: {
        SerialNumber: 'asc'
      }
    });

    console.log('DEBUG - Found pending costs:', pendingCosts.length);

    // Step 4: Transform results
    const transformedCosts = pendingCosts.map(cost => ({
      CostRevenueChargesSid: cost.CostRevenueChargesSid,
      ChargeMasterSid: cost.ChargeMasterSid,
      ChargeDescription: cost.ChargeDescription || cost.chargeMaster?.chargeName || '',
      ChargeCode: cost.chargeMaster?.chargeCode || '',
      NumberOfUnit: cost.CostNumberOfUnit || 1,
      Rate: cost.CostRate || 0,
      CostAmount: cost.CostAmount || 0,
      CostExchangeRate: cost.CostExchangeRate || 1,
      CurrencyCode: cost.costCurrencyMaster?.currencyCode || '',
      CurrencyMasterSid: cost.CostCurrencyMasterSid,
      UOMCode: cost.costChargeUOMMaster?.UOMCode || '',
      ChargeUOMSid: cost.CostChargeUomSid,
      VendorName: cost.costCustomerMaster?.CustomerName || '',
      VendorSid: cost.CostAgentMasterSid,
      vendorAddress:cost.CostAgentBranchSid,
      JobNo: menuName === 'MasterJob' ? jobRecord.MasterJobNumber : jobRecord.BookingNo,
      MBLNo: jobRecord.MBLNo || '',
      HBLNo: menuName === 'HouseJob' ? jobRecord.HBLNo : '',
      MasterJobSid: menuName === 'MasterJob' ? transactionSid : jobRecord.MasterJobSid,
      HouseJobSid: menuName === 'HouseJob' ? transactionSid : null,
      Remarks: cost.Remarks || '',
      selected: false // UI selection flag
    }));

    return {
      items: transformedCosts,
      jobInfo: {
        menuName,
        transactionSid,
        jobNumber: menuName === 'MasterJob' ? jobRecord.MasterJobNumber : jobRecord.BookingNo,
        mblNo: jobRecord.MBLNo,
        hblNo: menuName === 'HouseJob' ? jobRecord.HBLNo : null
      },
      message: `Found ${transformedCosts.length} pending cost(s)`
    };

  } catch (error) {
    this.logger.error(`Error searching pending costs: ${error.message}`);
    if (error instanceof BadRequestException) {
      throw error;
    }
    throw new InternalServerErrorException('Failed to search pending costs');
  }
}
   
    async getVendorTDSConfiguration(vendorMasterSid: number): Promise<any> {
        try {
            return await this.voucherService.getVendorTDSMapping(vendorMasterSid);
        } catch (error) {
            this.logger.error(`Error fetching vendor TDS configuration: ${error.message}`);
            throw new InternalServerErrorException('Failed to fetch vendor TDS configuration');
        }
    }
}
