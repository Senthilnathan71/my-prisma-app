import { BadRequestException, Injectable, InternalServerErrorException, Logger, NotFoundException } from '@nestjs/common';
import { DatabaseService } from 'src/database/database.service';
import { VoucherService } from '../voucher/voucher.service';
import { VoucherPeriodService } from 'src/masters/services/voucher-period/voucher-period.service';
import * as moment from 'moment-timezone';
import { statusWhereClause, toNumber } from 'src/common/helper';
import { Prisma } from '@prisma/client';
import { MenuService } from 'src/masters/services/menu/menu.service';
import { DOC_TYPE_CODE } from 'src/common/config/voucher-type.config';

@Injectable()
export class VendorInvoiceService {
    private readonly logger = new Logger(VendorInvoiceService.name);

    constructor(
        private readonly _db: DatabaseService,
        private readonly voucherService: VoucherService,
        private readonly voucherPeriodService: VoucherPeriodService,
        private readonly menuService: MenuService,
    ) {}

    /**
     * Create Vendor Invoice with TDS
     */
    async createVendorInvoice(payload: any): Promise<any> {
        try {
            // Validate period before creating vendor invoice (AP module)
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

                // Get VoucherTypeMaster for "Vendor Invoice"
                const voucherTypeMaster = await tx.voucherTypeMaster.findFirst({
                    where: {
                        DocumentTypeCode : DOC_TYPE_CODE.VENDOR_INVOICE,
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

                // Generate voucher number using config-based approach
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
                        CashOrBank : payload.CashOrBank || 'N',
                        Status: payload.Status || 'A',
                        CreatedBy: payload.CreatedBy || 'System'
                    }
                });

                // Create VoucherDetails
                let totalTaxableAmount = 0;
                const patchedCostRevenueIds: number[]=[];
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
                                NumberOfUnit: toNumber(detail.NumberOfUnit),
                                Rate: toNumber(detail.Rate),
                                Amount: toNumber(detail.Amount),
                                TaxableAmount: toNumber(detail.TaxableAmount),
                                TaxPercentage1: toNumber(detail.TaxPercentage1), // CGST or VAT
                                TaxAmount1: toNumber(detail.TaxAmount1),
                                TaxPercentage2: toNumber(detail.TaxPercentage2), // SGST
                                TaxAmount2: toNumber(detail.TaxAmount2),
                                LocalAmount: toNumber(detail.LocalAmount),
                                PartyAmount : toNumber(detail.PartyAmount),
                                CurrencyCode: detail.CurrencyCode || payload.CurrencyCode,
                                CurrencyMasterSid: detail.CurrencyMasterSid || currencyMasterSid,
                                ExchangeRate: detail.ExchangeRate || payload.ExchangeRate || 1,
                                DrCr: detail.DrCr || 'D', // Vendor invoice = Debit (payable)
                                LedgerMasterSid: detail.LedgerMasterSid,
                                COAMasterSid: detail.COAMasterSid,
                                YearMasterSid : detail.YearMasterSid || payload.YearMasterSid,
                                MasterJobSid: detail.MasterJobSid || payload.MasterJobSid,
                                HouseJobSid: detail.HouseJobSid || payload.HouseJobSid,
                                DepartmentMasterSid : detail.DepartmentMasterSid || null,
                                CostRevenueChargesSid : detail.CostRevenueChargesSid || null,
                                CreatedBy: payload.CreatedBy || 'System',
                                Narration : detail.Narration || null,
                                Status: 'A'
                            }
                        });

                        totalTaxableAmount += Number(detail.TaxableAmount || detail.Amount || 0);
                        if(detail.CostRevenueChargesSid){
                            patchedCostRevenueIds.push(detail.CostRevenueChargesSid);
                        }
                    }
                }

                 if (payload.isPatching === true && patchedCostRevenueIds.length > 0) {
                console.log('Patching CostRevenueCharges with IDs:', patchedCostRevenueIds);
                
                await tx.costRevenueCharges.updateMany({
                    where: {
                        CostRevenueChargesSid: { in: patchedCostRevenueIds }
                    },
                    data: {
                        CostVoucherHeaderSid: voucherHeader.VoucherHeaderSid,
                        CostVoucherTypeMasterSid: voucherTypeMaster.VoucherTypeMasterSid,
                        updatedOn: new Date(),
                        updatedBy: payload.CreatedBy || 'System'
                    }
                });
                
                console.log(`Updated ${patchedCostRevenueIds.length} CostRevenueCharges records`);
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
                    VoucherNumber: VoucherNumber,
                    patchedCostRevenueCount: patchedCostRevenueIds.length
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
                        DocumentTypeCode : DOC_TYPE_CODE.VENDOR_INVOICE
                    },
                     Status: { in: ['A', 'S'] } 
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
    async fetchVendorInvoiceById(VoucherHeaderSid: number, tx?: Prisma.TransactionClient): Promise<any> {
        try {
            const db = tx || this._db;

            const vendorInvoice = await db.voucherHeader.findUnique({
                where: { VoucherHeaderSid },
                include: {
                    VoucherDetail: {
                        where: { Status: 'A' },
                        orderBy : { Sno : 'asc' },
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
                    departmentMaster : {
                        select : {
                            departmentName : true,
                            departmentType : true,
                        }
                    },
                    BookingHeader : {
                        select : {
                            BookingHeaderSid : true,
                            BookingNo : true
                        }
                    },
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

                if (payload.Status === 'S') {
                    return await this.voucherService.deleteVoucher({
                        VoucherHeaderSid: VoucherHeaderSid,
                        CompanyMasterSid: payload.CompanyMasterSid,
                        BranchMasterSid: payload.BranchMasterSid,
                        UserEmail: payload.UpdatedBy
                    })
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
                        Status: payload.Status,
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
                    NumberOfUnit: toNumber(detail.NumberOfUnit),
                    Rate: toNumber(detail.Rate),
                    Amount: toNumber(detail.Amount),
                    TaxableAmount: toNumber(detail.TaxableAmount),
                    TaxPercentage1: toNumber(detail.TaxPercentage1),
                    TaxAmount1: toNumber(detail.TaxAmount1),
                    TaxPercentage2: toNumber(detail.TaxPercentage2),
                    TaxAmount2: toNumber(detail.TaxAmount2),
                    LocalAmount: toNumber(detail.LocalAmount),
                    PartyAmount : toNumber(detail.PartyAmount),
                    CurrencyCode: detail.CurrencyCode || payload.CurrencyCode,
                    CurrencyMasterSid: detail.CurrencyMasterSid || currencyMasterSid,
                    ExchangeRate: toNumber(detail.ExchangeRate),
                    DrCr: detail.DrCr || 'D',
                    LedgerMasterSid: detail.LedgerMasterSid,
                    COAMasterSid: detail.COAMasterSid,
                    MasterJobSid: detail.MasterJobSid || payload.MasterJobSid,
                    HouseJobSid: detail.HouseJobSid || payload.HouseJobSid,
                    UpdatedBy: payload.UpdatedBy || 'System',
                    Narration : detail.Narration || "",
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
                    NumberOfUnit: toNumber(detail.NumberOfUnit),
                    Rate: toNumber(detail.Rate),
                    Amount: toNumber(detail.Amount),
                    TaxableAmount: toNumber(detail.TaxableAmount),
                    TaxPercentage1: toNumber(detail.TaxPercentage1),
                    TaxAmount1: toNumber(detail.TaxAmount1),
                    TaxPercentage2: toNumber(detail.TaxPercentage2),
                    TaxAmount2: toNumber(detail.TaxAmount2),
                    LocalAmount: toNumber(detail.LocalAmount),
                    CurrencyCode: detail.CurrencyCode || payload.CurrencyCode,
                    CurrencyMasterSid: detail.CurrencyMasterSid || currencyMasterSid,
                    ExchangeRate: toNumber(detail.ExchangeRate) || 0,
                    DrCr: detail.DrCr || 'D',
                    LedgerMasterSid: detail.LedgerMasterSid,
                    COAMasterSid: detail.COAMasterSid,
                    YearMasterSid : detail.YearMasterSid || payload.YearMasterSid,
                    MasterJobSid: detail.MasterJobSid || payload.MasterJobSid,
                    HouseJobSid: detail.HouseJobSid || payload.HouseJobSid,
                    CostRevenueChargesSid : detail.CostRevenueChargeSid || null,
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
                activeCompanyId, activeBranchId,
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

            // const where: any = {
            //     voucherTypeMaster: {
            //         DocumentTypeName: 'Vendor Invoice'
            //     },
            //     Status: statusWhereClause
            // };
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
                    DocumentTypeCode: DOC_TYPE_CODE.VENDOR_INVOICE,
                    status: 'A'
                },
                ...(normalizedPartySid && { PartyMasterSid: normalizedPartySid }),
                ...(normalizedCurrencyCode && { CurrencyCode: normalizedCurrencyCode }),
                ...((normalizedDateFrom || normalizedDateTo) && {
                    [selectedDateField]: {
                        ...(normalizedDateFrom && { gte: normalizedDateFrom }),
                        ...(normalizedDateTo && { lte: normalizedDateTo })
                    }
                })
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
                        VoucherTDS: {
                            where: { Status: 'A' }
                        },
                        subledgerMaster: true,
                        currencyMaster: true,
                        BookingHeader : {
                            select : {
                                BookingNo : true
                            }
                        },
                        departmentMaster : {
                            select : {
                                departmentName : true,
                                departmentType : true
                            }
                        }
                    },
                    orderBy: [
                       { VoucherDate : 'desc' },
                       { VoucherNumber : 'desc' }
                    ],
                    skip,
                    take
                }),
                this._db.voucherHeader.count({ where })
            ]);

            // Calculate local amount and TDS amount for each invoice
            const enrichedItems = items.map(item => ({
                ...item,
                Amount: item.Amount,
                TDSAmount: item.VoucherTDS?.[0]?.TDSAmount || 0,
                VendorName: item.PartyName,
                BillNo: item.DocumentNumber,
                BillDate: item.DocumentDate,
                MBLNo: item.MasterNumber,
                HBLNo: item.HouseNumber,
                BookingNo : item.BookingHeader?.BookingNo,
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
  vendorBranchSid?: number; // Add this parameter
}): Promise<any> {
  try {
    const { searchType, searchValue, vendorSid, companyMasterSid, branchMasterSid, vendorBranchSid } = searchCriteria;
    
    if (!searchValue?.trim()) {
      throw new BadRequestException('Search value is required');
    }
    
    // Step 1: Determine search target and build where clause
    let jobRecord: any = null;
    let transactionSid: number | null = null;
    let menuName = '';
    let masterJobSid: number | null = null;
    let houseJobSid: number | null = null;
    let masterJobNumber: string = '';
    let houseJobNumber: string = '';
    
    // Normalize search value
    const normalizedSearch = searchValue.trim().toUpperCase();

    // Special handling for Vendor Name search
    if (searchType.toLowerCase().includes('vendor') || searchType.toLowerCase() === 'vendor name') {
      // For vendor name search, we'll return all costs for that vendor
      // Don't look for job records, just proceed to cost query
      menuName = 'Vendor';
    } else {
      // Original logic for other search types
      switch (searchType.toLowerCase()) {
        case 'master job':
        case 'masterjob':
          jobRecord = await this._db.masterJob.findFirst({
            where: {
              MasterJobNumber: { contains: normalizedSearch, mode: 'insensitive' },
              CompanyMasterSid: companyMasterSid,
              BranchMasterSid: branchMasterSid,
              Status: 'A',
            }
          });
          
          if (jobRecord) {
            transactionSid = jobRecord.MasterJobSid;
            masterJobSid = jobRecord.MasterJobSid;
            masterJobNumber = jobRecord.MasterJobNumber;
            menuName = 'Master Job';
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
            },
            include: {
              masterJob: {
                select: {
                  MasterJobSid: true,
                  MasterJobNumber: true
                }
              }
            }
          });
          
          if (jobRecord) {
            transactionSid = jobRecord.HouseJobSid;
            houseJobSid = jobRecord.HouseJobSid;
            houseJobNumber = jobRecord.HBLNo;
            
            if (jobRecord.masterJob) {
              masterJobSid = jobRecord.masterJob.MasterJobSid;
              masterJobNumber = jobRecord.masterJob.MasterJobNumber;
            }
            
            menuName = 'House Job';
          }
          break;

        case 'mbl no':
        case 'mblno':
          jobRecord = await this._db.masterJob.findFirst({
            where: {
              MBLNo: { contains: normalizedSearch, mode: 'insensitive' },
              CompanyMasterSid: companyMasterSid,
              BranchMasterSid: branchMasterSid,
              Status: 'A'
            }
          });
          
          if (jobRecord) {
            transactionSid = jobRecord.MasterJobSid;
            masterJobSid = jobRecord.MasterJobSid;
            masterJobNumber = jobRecord.MasterJobNumber;
            menuName = 'Master Job';
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
            },
            include: {
              masterJob: {
                select: {
                  MasterJobSid: true,
                  MasterJobNumber: true
                }
              }
            }
          });
          
          if (jobRecord) {
            transactionSid = jobRecord.HouseJobSid;
            houseJobSid = jobRecord.HouseJobSid;
            houseJobNumber = jobRecord.BookingNo;
            
            if (jobRecord.masterJob) {
              masterJobSid = jobRecord.masterJob.MasterJobSid;
              masterJobNumber = jobRecord.masterJob.MasterJobNumber;
            }
            
            menuName = 'House Job';
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
            masterJobSid = jobRecord.MasterJobSid;
            masterJobNumber = jobRecord.MasterJobNumber;
            menuName = 'Master Job';
          }
          break;
      }
    }

    // For vendor name search, we don't need job record
    if (menuName !== 'Vendor' && (!jobRecord || !transactionSid)) {
      return {
        items: [],
        message: 'No matching job found for the search criteria'
      };
    }

    // Step 2: Build cost/revenue query
    const whereClause: Prisma.CostRevenueChargesWhereInput = {
        CompanyMasterSid: companyMasterSid,
        BranchMasterSid: branchMasterSid,
        status: 'A',
        CostVoucherHeaderSid: null, 
    };
    
    // Add transaction-specific filters based on menu type
    if(menuName !== 'Vendor'){
        whereClause.TransactionSid = transactionSid;
        const menuId = await this.menuService.getMenuSidByName(menuName);
        if (menuId) {
          whereClause.MenuMasterSid = menuId;
        }
    }
    // if (menuName === 'Master Job') {
    //   whereClause.MasterJobNo = jobRecord.MasterJobNumber;
    // } else if (menuName === 'House Job') {
    //   whereClause.ShipmentNo = jobRecord.ShipmentNo;
    // } else if (menuName === 'Vendor') {
    //   // For vendor name search, filter by vendor
    // }
    if (menuName === 'Vendor' && vendorSid) {
      whereClause.CostAgentMasterSid = vendorSid;
    }
    if (menuName === 'Vendor' && vendorBranchSid) {
      whereClause.CostAgentBranchSid = vendorBranchSid;
    }

    // // Add vendor filter if provided
    // if (vendorSid && menuName !== 'Vendor') {
    //   whereClause.CostAgentMasterSid = vendorSid;
    // }

    // Step 3: Fetch pending costs
    console.log(whereClause);
    const pendingCosts = await this._db.costRevenueCharges.findMany({
      where: whereClause,
      include: {
        menuMaster : {
            select : { MenuName : true}
        },
        chargeMaster: true,
        costChargeUOMMaster: true,
        costCurrencyMaster: true,
        costCustomerMaster: true,
        costCustomerBranch: true,
        costVoucherHeader: {
          select: {
            VoucherHeaderSid: true,
            VoucherNumber: true
          }
        },
        costVoucherTypeMaster: {
          select: {
            VoucherTypeMasterSid: true,
            DocumentTypeName: true
          }
        }
      },
      orderBy: {
        SerialNumber: 'asc'
      }
    });



    // Step 4: Transform results with job information
const transformedCosts = await Promise.all(
  pendingCosts.map(async (cost) => {
    let houseJob: any = null;
    let masterJob : any = null;
    const screenName = cost.menuMaster?.MenuName;
    if (screenName === "House Job") {
      houseJob = await this._db.houseJob.findUnique({
        where: {
          HouseJobSid: cost.TransactionSid!
        },
          select: {
              MBLNo: true,
              HBLNo: true,
              MasterJobSid: true,
              DepartmentMasterSid: true,
          }
      });
    } else if (screenName === "Master Job") {
      masterJob = await this._db.masterJob.findUnique({
        where: {
          MasterJobSid: cost.TransactionSid!
        },
        select: {
          MasterJobNumber: true,
          MBLNo : true,
          DepartmentMasterSid : true,
        }
      });
    }

    
    return {
      CostRevenueChargesSid: cost.CostRevenueChargesSid,
      ChargeMasterSid: cost.ChargeMasterSid,
      ChargeDescription: cost.ChargeDescription || cost.chargeMaster?.chargeName || '',
      ChargeCode: cost.chargeMaster?.chargeCode || '',
      ChargeUOMSid: cost.CostChargeUomSid,
      UOMCode: cost.costChargeUOMMaster?.UOMCode || '',
      NumberOfUnit: cost.CostNumberOfUnit || 1,
      DrCr : cost.CostDrCr || 'D',
      CurrencyMasterSid: cost.CostCurrencyMasterSid,
      CurrencyCode: cost.costCurrencyMaster?.currencyCode || '',
      Rate: cost.CostRate || 0,
      CostExchangeRate: cost.CostExchangeRate || 1,
      CostAmount: cost.CostAmount || 0,
      CostLocalAmount : cost.CostLocalAmount || 0,
      VendorName: cost.costCustomerMaster?.CustomerName || '',
      VendorSid: cost.CostAgentMasterSid,
      VendorAddress: cost.costCustomerBranch?.Address || '',
      CostAgentBranchSid: cost.CostAgentBranchSid,
      JobNo: screenName === 'Master Job' ? masterJob?.MasterJobNumber :
             screenName === 'House Job' ? houseJob?.HBLNo :
             cost.MasterJobNo || cost.ShipmentNo || '',
      MBLNo : 
        screenName === "House Job" ? houseJob?.MBLNo : 
        (screenName === "Master Job" ? masterJob?.MBLNo : null),
      HBLNo : 
        screenName === "House Job" ? houseJob?.HBLNo : 
        (screenName === "Master Job" ? masterJob?.HBLNo : null),
      DepartmentMasterSid : 
        screenName === "Master Job" ? 
            masterJob?.DepartmentMasterSid :
                screenName === "House Job" ? 
                    houseJob?.DepartmentMasterSid : null,
      MasterJobSid: (screenName === "Master Job" ? cost.TransactionSid : null) || 
                    (houseJob ? (screenName === "House Job" ? houseJob?.MasterJobSid : null) : null),
      HouseJobSid: screenName === "House Job" ? cost.TransactionSid : null,
      Remarks: cost.Remarks || '',
      selected: false,
      isAlreadyPatched: !!cost.CostVoucherHeaderSid,
      existingVoucherNumber: cost.costVoucherHeader?.VoucherNumber
    };
  })
);

    return {
      items: transformedCosts,
      jobInfo: {
        menuName,
        transactionSid,
        masterJobSid,      
        houseJobSid,       
        jobNumber: menuName === 'MasterJob' ? jobRecord?.MasterJobNumber : 
                   menuName === 'HouseJob' ? jobRecord?.BookingNo : 
                   'Vendor Search',
        masterJobNumber,   
        houseJobNumber,    
        mblNo: jobRecord?.MBLNo,
        hblNo: menuName === 'HouseJob' ? jobRecord?.HBLNo : null
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
