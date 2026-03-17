import { BadRequestException, Injectable, InternalServerErrorException, Logger, NotFoundException } from '@nestjs/common';
import { DatabaseService } from 'src/database/database.service';
import { VoucherService } from '../voucher/voucher.service';
import { Prisma } from '@prisma/client';
import { DOC_TYPE_CODE } from 'src/common/config/voucher-type.config';
import { PullVoucherDTO } from 'src/accounts/dto/voucher.dto';
import { VoucherPeriodService } from 'src/masters/services/voucher-period/voucher-period.service';
import { statusWhereClause, toNumber } from 'src/common/helper';

@Injectable()
export class ReverseVoucherService {
    private readonly logger = new Logger(ReverseVoucherService.name);
    constructor(
        private readonly _db: DatabaseService,
        private readonly voucherService: VoucherService,
        private voucherPeriodService: VoucherPeriodService,
    ) { }

    async createReverseVoucher(payload: any): Promise<any> {
        try {
            const periodValidation = await this.voucherPeriodService.validateVoucherPeriod({
                voucherDate: payload.VoucherDate || new Date(),
                module: 'AR',
                CompanyMasterSid: payload.CompanyMasterSid,
                BranchMasterSid: payload.BranchMasterSid
            });
            if (!periodValidation.allowed) {
                throw new BadRequestException(periodValidation.message);
            }
            return await this._db.$transaction(async (tx) => {
                const voucherTypeMaster = await tx.voucherTypeMaster.findFirst({
                    where: {
                        DocumentTypeCode: DOC_TYPE_CODE.REVERSAL_JOURNAL_VOUCHER,
                        CompanyMasterSid: payload.CompanyMasterSid,
                        BranchMasterSid: payload.BranchMasterSid,
                        status: 'A'
                    }
                });

                if (!voucherTypeMaster) {
                    throw new BadRequestException(
                        'Reverse voucher type not configured. Please configure "Reverse Voucher" in VoucherTypeMaster.'
                    );
                }

                // Generate voucher number
                const voucherNumber = await this.voucherService.generateVoucherNumberFromConfig(
                    voucherTypeMaster,
                    payload.CompanyMasterSid,
                    payload.BranchMasterSid,
                    payload.YearMasterSid,
                    tx,
                    payload.VoucherDate ? new Date(payload.VoucherDate) : undefined
                );

                // Create VoucherHeader
                const voucherHeader = await tx.voucherHeader.create({
                    data: {
                        VoucherNumber: voucherNumber,
                        VoucherDate: payload.VoucherDate ? new Date(payload.VoucherDate) : new Date(),
                        PostDate: null,
                        VoucherType: voucherTypeMaster.VoucherTypeMasterSid,
                        Narration: payload.Narration || '',
                        COAMasterSid: payload.COAMasterSid,
                        CompanyMasterSid: payload.CompanyMasterSid,
                        BranchMasterSid: payload.BranchMasterSid,
                        VoucherTypeMasterSid: voucherTypeMaster.VoucherTypeMasterSid,
                        PartyMasterSid: payload.PartyMasterSid,
                        PartyName: payload.PartyName || '',
                        PartyAddress: payload.PartyAddress || '',
                        CustomerBranchSid: payload.CustomerBranchSid,
                        PlaceOfSupply: payload.PlaceOfSupply,
                        PostStatus: payload.PostStatus,
                        GST_VAT: payload.GSTNo || payload.GST_VAT,
                        InvoiceType: payload.InvoiceType || 'B2B',
                        GSTType: payload.GSTType,
                        CurrencyMasterSid: payload.CurrencyMasterSid,
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
                const finalDetails: any[] = [];
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
                                PartyAmount: detail.Amount || 0,
                                CurrencyCode: detail.CurrencyCode || payload.CurrencyCode,
                                CurrencyMasterSid: detail.CurrencyMasterSid || null,
                                ExchangeRate: detail.ExchangeRate || payload.ExchangeRate || 1,
                                DrCr: detail.DrCr || '',
                                LedgerMasterSid: detail.LedgerMasterSid,
                                COAMasterSid: detail.COAMasterSid,
                                MasterJobSid: detail.MasterJobSid || payload.MasterJobSid,
                                HouseJobSid: detail.HouseJobSid || payload.HouseJobSid,
                                CostCenter: detail.CostCenterMasterSid,
                                ProfitCenter: detail.ProfitCenterMasterSid,
                                YearMasterSid: detail.YearMasterSid || payload.YearMasterSid,
                                CreatedBy: payload.CreatedBy || 'System',
                                Status: 'A'
                            }
                        });

                        finalDetails.push(newDetail);
                        totalTaxableAmount += Number(detail.TaxableAmount || detail.Amount || 0);
                    }
                }
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


                if (voucherTypeMaster.IsAutoPosting === 'Y') {
                    const postResult = await this.postReversalInternal({
                        voucherHeaderSid: voucherHeader.VoucherHeaderSid,
                        companyMasterSid: voucherHeader.CompanyMasterSid,
                        branchMasterSid: voucherHeader.BranchMasterSid,
                        yearMasterSid: payload.YearMasterSid,
                        localCurrencyMasterSid: Number(payload?.PostingInfo?.LocalCurrencyMasterSid),
                        localCurrencyCode: String(payload?.PostingInfo?.LocalCurrencyCode),
                        postedBy: payload.CreatedBy,
                        taxDetails: payload?.PostingInfo?.TaxDetails,
                    }, tx);
                }


                return {
                    ...voucherHeader,
                    VoucherDetail: finalDetails
                };
            }, { timeout: 60000 });
        } catch (error) {
            this.logger.error(`Error creating reverse voucher: ${error.message}`);
            if (error instanceof BadRequestException) {
                throw error;
            }
            throw new InternalServerErrorException('Failed to create reverse voucher');
        }
    }

    async fetchReverseVouchers(): Promise<any[]> {
        try {
            const reverseVouchers = await this._db.voucherHeader.findMany({
                where: {
                    voucherTypeMaster: {
                        DocumentTypeCode: DOC_TYPE_CODE.REVERSAL_JOURNAL_VOUCHER
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

            return reverseVouchers;
        } catch (error) {
            this.logger.error(`Error fetching reverse vouchers: ${error.message}`);
            throw new InternalServerErrorException('Failed to fetch reverse vouchers');
        }
    }

    async fetchReverseVoucherById(VoucherHeaderSid: number) {
        try {

            const reverseVoucher = await this._db.voucherHeader.findUnique({
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

            if (!reverseVoucher) {
                throw new NotFoundException(`Reverse Voucher with ID ${VoucherHeaderSid} not found`);
            }

            if (reverseVoucher.ReversalVoucher) {
                       // Checking if any other credit note is created against this vendor invoice
                       const reversalVoucher = await this._db.voucherHeader.findFirst({
                         where: {
                           AND: [
                             { VoucherHeaderSid: reverseVoucher.ReversalVoucher },
                             { PostStatus: 'P' },
                           ]
                         },
                         select: {
                           VoucherHeaderSid: true,
                           VoucherNumber: true,
                           VoucherDetail: {
                             select: {
                               VoucherDetailSid: true,
                               Rate: true,
                               CostRevenueChargesSid: true
                             }
                           }
                         }
                       })
            
                       // If no reversal voucher found, return original vendor credit note
                       if (!reversalVoucher) {
                         return reverseVoucher;
                       }
            
                       return {
                         ...reverseVoucher,
                         reversalVoucher
                       }
                     }

            return reverseVoucher;
        } catch (error) {
            this.logger.error(`Error fetching reverse voucher by ID: ${error.message}`);
            if (error instanceof NotFoundException) {
                throw error;
            }
            throw new InternalServerErrorException('Failed to fetch reverse voucher');
        }
    }

    async updateReverseVoucher(VoucherHeaderSid: number, payload: any): Promise<any> {
        try {
            return await this._db.$transaction(async (tx) => {
                const existing = await tx.voucherHeader.findUnique({
                    where: { VoucherHeaderSid }
                });

                if (!existing) {
                    throw new NotFoundException(`reverse voucher with ID ${VoucherHeaderSid} not found`);
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
                                    PartyAmount: detail.Amount || 0,
                                    CurrencyCode: detail.CurrencyCode || payload.CurrencyCode,
                                    CurrencyMasterSid: detail.CurrencyMasterSid || currencyMasterSid,
                                    ExchangeRate: detail.ExchangeRate || payload.ExchangeRate || 1,
                                    DrCr: detail.DrCr || 'D',
                                    LedgerMasterSid: detail.LedgerMasterSid,
                                    COAMasterSid: detail.COAMasterSid,
                                    MasterJobSid: detail.MasterJobSid || payload.MasterJobSid,
                                    HouseJobSid: detail.HouseJobSid || payload.HouseJobSid,
                                    UpdatedBy: payload.UpdatedBy || 'System',
                                    CostCenter: detail.CostCenterMasterSid,
                                    ProfitCenter: detail.ProfitCenterMasterSid,
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
                                    PartyAmount: detail.Amount || 0,
                                    CurrencyCode: detail.CurrencyCode || payload.CurrencyCode,
                                    CurrencyMasterSid: detail.CurrencyMasterSid || currencyMasterSid,
                                    ExchangeRate: detail.ExchangeRate || payload.ExchangeRate || 1,
                                    DrCr: detail.DrCr || 'D',
                                    LedgerMasterSid: detail.LedgerMasterSid,
                                    COAMasterSid: detail.COAMasterSid,
                                    YearMasterSid: detail.YearMasterSid || payload.YearMasterSid,
                                    MasterJobSid: detail.MasterJobSid || payload.MasterJobSid,
                                    HouseJobSid: detail.HouseJobSid || payload.HouseJobSid,
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

                return await this.fetchReverseVoucherById(VoucherHeaderSid);
            });
        } catch (error) {
            this.logger.error(`Error updating reverse voucher: ${error.message}`);
            if (error instanceof NotFoundException || error instanceof BadRequestException) {
                throw error;
            }
            throw new InternalServerErrorException('Failed to update reverse voucher');
        }
    }

    async deleteReverseVoucher(VoucherHeaderSid: number): Promise<any> {
        try {
            return await this._db.$transaction(async (tx) => {
                // Check if exists
                const existing = await tx.voucherHeader.findUnique({
                    where: { VoucherHeaderSid }
                });

                if (!existing) {
                    throw new NotFoundException(`reverse voucher with ID ${VoucherHeaderSid} not found`);
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
            this.logger.error(`Error deleting reverse voucher : ${error.message}`);
            if (error instanceof NotFoundException) {
                throw error;
            }
            throw new InternalServerErrorException('Failed to delete reverse voucher');
        }
    }
    async searchReverseVouchers(params: any): Promise<any> {
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
                VendorName,
                vendorName,
                PostStatus,
                postStatus
            } = params;

            const skip = (page - 1) * pageSize;
            const take = Number(pageSize);

            // const where: any = {
            //     voucherTypeMaster: {
            //         DocumentTypeCode: DOC_TYPE_CODE.REVERSAL_JOURNAL_VOUCHER
            //     },
            //     Status: 'A'
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
            const normalizedVendorName = (VendorName ?? vendorName ?? '').toString().trim();
            const normalizedPostStatus = (PostStatus ?? postStatus ?? '').toString().trim();

            const where: Prisma.VoucherHeaderWhereInput = {
                CompanyMasterSid: activeCompanyId,
                BranchMasterSid: activeBranchId,
                Status: statusWhereClause,
                voucherTypeMaster: {
                    DocumentTypeCode: DOC_TYPE_CODE.REVERSAL_JOURNAL_VOUCHER
                },
                ...(normalizedVendorName && { PartyName: { contains: normalizedVendorName, mode: 'insensitive' } }),
                ...(normalizedPostStatus && { PostStatus: normalizedPostStatus }),
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
                        // VoucherTDS: {
                        //     where: { Status: 'A' }
                        // },
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

            // Calculate local amount and TDS amount for each invoice
            const enrichedItems = await Promise.all(items.map(async (item) => {
                if (item.ReversalVoucher) {
                    const reversalVoucher = await this._db.voucherHeader.findUnique({
                        where: {
                            VoucherHeaderSid: item.ReversalVoucher!
                        },
                        select: {
                            VoucherNumber: true,
                            voucherTypeMaster: {
                                select: { DocumentTypeName: true }
                            }
                        }
                    });
                    return {
                        ...item,
                        reversalVoucherNumber: reversalVoucher?.VoucherNumber || "",
                        reversalVoucherType: reversalVoucher?.voucherTypeMaster?.DocumentTypeName || null,
                        LocalAmount: item.VoucherDetail?.reduce((sum, d) => sum + Number(d.LocalAmount || 0), 0) || 0,
                        // TDSAmount: item.VoucherTDS?.[0]?.TDSAmount || 0,
                        VendorName: item.PartyName,
                        BillNo: item.DocumentNumber,
                        BillDate: item.DocumentDate,
                        MBLNo: item.MasterNumber,
                        HBLNo: item.HouseNumber
                    };
                } else {
                    return {
                        ...item,
                        reversalVoucherNumber: "",
                        reversalVoucherType: null,
                        LocalAmount: item.VoucherDetail?.reduce((sum, d) => sum + Number(d.LocalAmount || 0), 0) || 0,
                        // TDSAmount: item.VoucherTDS?.[0]?.TDSAmount || 0,
                        VendorName: item.PartyName,
                        BillNo: item.DocumentNumber,
                        BillDate: item.DocumentDate,
                        MBLNo: item.MasterNumber,
                        HBLNo: item.HouseNumber
                    };
                }

            })
            );

            return {
                items: enrichedItems,
                totalCount,
                page: Number(page),
                pageSize: Number(pageSize)
            };
        } catch (error) {
            this.logger.error(`Error searching reverse voucher: ${error.message}`);
            throw new InternalServerErrorException('Failed to search reverse voucher');
        }
    }

    async fetchVouchers(CompanyMasterSid: number, BranchMasterSid: number): Promise<any[]> {
        try {
            const vouchers = await this._db.voucherHeader.findMany({
                where: {
                    CompanyMasterSid: CompanyMasterSid,
                    BranchMasterSid: BranchMasterSid,
                    voucherMatchings: {
                        none: {}
                    },
                    Status: 'A',
                    PostStatus: 'P',
                    VoucherDetail: {}

                },
                include: {
                    voucherTypeMaster: {
                        select: {
                            VoucherTypeMasterSid: true,
                            DocumentTypeCode: true
                        }
                    }
                }


            });

            return vouchers;
        } catch (error) {
            this.logger.error(`Error fetching vouchers: ${error.message}`);
            throw new InternalServerErrorException('Failed to fetch vouchers');
        }
    }

    async fetchVoucherById(payload: PullVoucherDTO,
        tx?: Prisma.TransactionClient,): Promise<any> {
        try {
            const db = tx || this._db;
            const { VoucherNumber, CompanyMasterSid, BranchMasterSid } = payload;

            const voucher = await db.voucherHeader.findFirst({
                where: {
                    VoucherNumber: { contains: VoucherNumber, mode: 'insensitive' },
                    CompanyMasterSid,
                    BranchMasterSid,
                    PostStatus: 'P',
                    Status: 'A',
                    voucherMatchings: {
                        none: {}
                    },
                    voucherTypeMaster: {
                        DocumentTypeCode: {
                            in: [
                                DOC_TYPE_CODE.RECEIPT,
                                DOC_TYPE_CODE.PAYMENT,
                                DOC_TYPE_CODE.JOURNAL_VOUCHER
                            ]
                        }
                    }
                },
                include: {
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
                        include: {
                            voucherDetail: true
                        }
                    }
                }
            });

            if (!voucher) {
                throw new BadRequestException(`Voucher not found`);
            }

            const alreadyReversed = await db.voucherHeader.findFirst({
                where: {
                    ReversalVoucher: voucher.VoucherHeaderSid,
                    PostStatus: 'P',
                    Status: 'A'
                },
                select: {
                    VoucherHeaderSid: true,
                    VoucherNumber: true
                }
            });

            if (alreadyReversed) {
                throw new BadRequestException(
                    `Voucher ${voucher.VoucherNumber} is already reversed by ${alreadyReversed.VoucherNumber}`
                );
            }

            return voucher;
        } catch (error) {
            this.logger.error(`Error fetching vouchers by ID: ${error.message}`);
            if (error instanceof BadRequestException) {
                throw error;
            }
            throw new InternalServerErrorException('Failed to fetch vouchers');
        }
    }

    async postReversalInternal(payload: {
        voucherHeaderSid: number,
        companyMasterSid: number,
        branchMasterSid: number,
        yearMasterSid: number,
        localCurrencyMasterSid: number,
        localCurrencyCode: string,
        postedBy: string,
        taxDetails: {
            CountryMasterSid: number,
            countryCode: string,
            TaxCategory: 'Inter' | 'Intra',
            EffectiveFrom: Date,
            TaxType: 'Input' | 'Output',
        }
    }, tx?: Prisma.TransactionClient) {
        try {
            const result = await (tx
                ? this.postReversalVoucher(payload, tx)
                : this._db.$transaction((newTx) =>
                    this.postReversalVoucher(payload, newTx), { timeout: 60000 }
                )
            );
            return result;

        } catch (error) {
            throw error;
        }
    }

    async postReversalVoucher(
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
                countryCode: string,
                TaxCategory: 'Inter' | 'Intra',
                EffectiveFrom: Date,
                TaxType: 'Input' | 'Output',
            }
        }, tx: Prisma.TransactionClient
    ) {
        try {

            // Fetch voucher
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
                        orderBy: { Sno: 'asc' }
                    },
                    SourceMatchingDetail: true,
                    voucherTypeMaster: true,
                    subledgerMaster: { select: { SubledgerName: true } }
                }
            });

            if (!voucher) throw new BadRequestException('Voucher not found.');
            if (voucher.PostStatus === 'P') throw new BadRequestException('Voucher is already posted.');
            if (!voucher.VoucherDetail?.length) throw new BadRequestException('No detail lines are found.');
            if (!voucher.voucherTypeMaster) throw new BadRequestException('Voucher type is not found.');

            const now = new Date();

            const {
                voucherTypeMaster,
                SourceMatchingDetail,
                VoucherDetail,
                ...VoucherHeader
            } = voucher;

            // Validate FY year
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

            if (voucherDate < startDate || voucherDate > endDate) {
                throw new Error('Voucher date is outside of current financial year.');
            }

            // Validate debit/credit
            let sumOfCurrencyDebits = 0;
            let sumOfCurrencyCredits = 0;

            VoucherDetail.forEach(detail =>
                detail.DrCr === 'D'
                    ? (sumOfCurrencyDebits += toNumber(detail.LocalAmount))
                    : (sumOfCurrencyCredits += toNumber(detail.LocalAmount))
            );

            if (sumOfCurrencyCredits - sumOfCurrencyDebits !== 0) {
                throw new BadRequestException('Sum of currency debits and credits should be zero.');
            }

            // Validate local amounts
            let sumOfLocalDebits = 0;
            let sumOfLocalCredits = 0;

            VoucherDetail.forEach(detail =>
                detail.DrCr === 'D'
                    ? (sumOfLocalDebits += detail.LocalAmount.toNumber())
                    : (sumOfLocalCredits += detail.LocalAmount.toNumber())
            );

            // Check exchange rate mismatch
            let allDetails = [...VoucherDetail];

            // Prepare voucher transaction payload
            const voucherTransactionsPayload = allDetails.map((item) => ({
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
                DrCr: `${item.DrCr}`.charAt(0),
                TaxableAmount: item.TaxableAmount ?? 0,
                Amount: item.Amount ?? 0,
                LocalAmount: item.LocalAmount ?? 0,
                CostCenter: item.CostCenter ?? null,
                ProfitCenter: item.ProfitCenter ?? null,
                TransType: "",
                VoucherTypeMasterSid: voucherTypeMaster.VoucherTypeMasterSid,
                YearMasterSid: item.YearMasterSid ?? null,
                IsAutoGenerated: 'N'
            }));

            // Insert Voucher Transactions
            const allTransactions = await tx.voucherTransaction.createManyAndReturn({
                data: voucherTransactionsPayload
            });

            // Update voucher details with transaction sid
            const allCompleteDetails: any[] = [];
            for (const vt of allTransactions) {
                const completeDetail = await tx.voucherDetail.update({
                    where: { VoucherDetailSid: vt.VoucherDetailSid },
                    data: { VoucherTransactionSid: vt.VoucherTransactionSid },
                    include: {
                        subledgerMaster: {
                            select: { SubledgerType: true }
                        }
                    }
                });
                allCompleteDetails.push(completeDetail);
            }
            
            // Find reversal voucher customer entry
            const object = await tx.voucherTransaction.findFirst({
                where: {
                    VoucherHeaderSid: voucher.ReversalVoucher!,
                    Status: 'A',
                    subledgerMaster: {  SubledgerType: 'Customer' }
                },
                orderBy : {
                    Sno : 'asc'
                },
                include : {
                    subledgerMaster : {
                        select : {
                            SubledgerName : true
                        }
                    }
                }
            });

            // Matching: Party details
            const partyDetailForMatching = allCompleteDetails.filter(
                vd => vd.subledgerMaster?.SubledgerType === 'Customer' && vd.LedgerMasterSid === object?.LedgerMasterSid
            );

            const billMatchingCurrencyAmount = partyDetailForMatching.reduce(
                (sum, detail) => sum + Number(detail.Amount),
                0
            );

            const billMatchingLocalAmount = partyDetailForMatching.reduce(
                (sum, detail) => sum + Number(detail.LocalAmount),
                0
            );


            //   if (!object) throw new BadRequestException('Reversal Voucher not found');

            // Create voucher matching
            let newVoucherMatchings: any;

            if (partyDetailForMatching && object && (billMatchingCurrencyAmount > 0 || billMatchingLocalAmount > 0)) {
                partyDetailForMatching['Amount'] = billMatchingCurrencyAmount;
                partyDetailForMatching['PartyAmount'] = billMatchingCurrencyAmount;
                partyDetailForMatching['LocalAmount'] = billMatchingLocalAmount;
                newVoucherMatchings = await this.voucherService.createVoucherMatching({
                    CompanyMasterSid: payload.companyMasterSid,
                    BranchMasterSid: payload.branchMasterSid,
                    VoucherHeaderSid: payload.voucherHeaderSid,
                    VoucherTypeCode: voucher.voucherTypeMaster.DocumentTypeCode,
                    VoucherTypeMasterSid: voucher.voucherTypeMaster.VoucherTypeMasterSid,
                    SubledgerName: voucher.subledgerMaster?.SubledgerName || object.subledgerMaster?.SubledgerName || '',
                    VoucherMatchingDate: now,
                    PostDate: now,
                    YearMasterSid: payload.yearMasterSid,
                    Narration: `${voucher.VoucherNumber} ${voucher.VoucherDate.toISOString().split('T')[0]} ${voucher.CurrencyCode || object.CurrencyCode} ${voucher.Amount || object.Amount}`,
                    createdBy: payload.postedBy,
                    voucherMatching: [object],
                    partyVoucherDetail: partyDetailForMatching,
                    BillMatchingCurrencyAmount: billMatchingCurrencyAmount,
                    BillMatchingLocalAmount: billMatchingLocalAmount
                }, tx);
            }

            // Update voucher as posted
            const partyDetail = allCompleteDetails.find(
                d => d.subledgerMaster?.SubledgerType === 'Customer' ||
                    d.LedgerMasterSid === voucher.PartyMasterSid
            );
            const updatedVoucher = await tx.voucherHeader.update({
                where: {
                    VoucherHeaderSid: voucher.VoucherHeaderSid
                },
                data: {
                    Amount: partyDetail.Amount,
                    LocalAmount: partyDetail.LocalAmount,
                    PostStatus: 'P',
                    PostDate: now,
                    UpdatedBy: payload.postedBy
                }
            });

            return {
                ...updatedVoucher,
                voucherDetail: allCompleteDetails,
                voucherMatchings: newVoucherMatchings
            };

        } catch (error) {
            throw error;
        }
    }
}
