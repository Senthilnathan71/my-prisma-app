import { 
  BadRequestException, 
  Injectable, 
  InternalServerErrorException, 
  Logger, 
  NotFoundException 
} from '@nestjs/common';
import { Decimal } from '@prisma/client/runtime/library';
import { PostVoucherResponseDto, VoucherDetailDto } from 'src/accounts/dto/voucher-posting.dto';
import { TaxVoucherType, DOC_TYPE_CODE } from 'src/common/config/voucher-type.config';
import { statusWhereClause, toNumber } from 'src/common/helper';
import { DatabaseService } from 'src/database/database.service';
import { Prisma } from '@prisma/client';
import { VoucherService } from 'src/accounts/services/voucher/voucher.service';

@Injectable()
export class JournalVoucherService {
    private readonly logger = new Logger(JournalVoucherService.name);

    constructor(
        private readonly _db: DatabaseService,
        private readonly voucherService: VoucherService
    ) {}

    /**
     * Create Journal Voucher
     */
    async createJournalVoucher(payload: any): Promise<any> {
        try {
            return await this._db.$transaction(async (tx) => {
                // Get VoucherTypeMaster for "Journal Voucher"
                const voucherTypeMaster = await tx.voucherTypeMaster.findFirst({
                    where: {
                        DocumentTypeCode: DOC_TYPE_CODE.JOURNAL_VOUCHER,
                        CompanyMasterSid: payload.CompanyMasterSid,
                        BranchMasterSid: payload.BranchMasterSid,
                        status: 'A'
                    }
                });

                if (!voucherTypeMaster) {
                    throw new BadRequestException(
                        'Journal Voucher voucher type not configured. Please configure "Journal Voucher" in VoucherTypeMaster.'
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

                // Get currency master ID
                let currencyMasterSid = payload.CurrencyMasterSid;
                if (!currencyMasterSid && payload.CurrencyCode) {
                    const currency = await tx.currencyMaster.findFirst({
                        where: { currencyCode: payload.CurrencyCode }
                    });
                    currencyMasterSid = currency?.CurrencyMasterSid;
                }

                // Validate debit/credit balance
                this.validateDebitCreditBalance(payload.VoucherDetail || []);

                // Get a valid PartyMasterSid for journal voucher (use company as party or find a system account)
                let partyMasterSid = payload.PartyMasterSid;
                let partyName = payload.PartyName || '';
                
                // If no party provided, use company as the default party for journal vouchers
                if (!partyMasterSid) {
                    const company = await tx.companyMaster.findUnique({
                        where: { CompanyMasterSid: payload.CompanyMasterSid },
                        select: { CompanyMasterSid: true, companyName: true }
                    });
                    
                    if (company) {
                        // Find or create a subledger for the company
                        const companySubledger = await tx.subledgerMaster.findFirst({
                            where: {
                                CompanyMasterSid: payload.CompanyMasterSid,
                                // CustomerName: { contains: company.companyName }
                            }
                        });
                        
                        if (companySubledger) {
                            partyMasterSid = companySubledger.SubledgerMasterSid;
                            // partyName = companySubledger.customerName;
                        } else {
                            // Create a system party for journal vouchers
                            const systemParty = await tx.subledgerMaster.findFirst({
                                where: {
                                    CompanyMasterSid: payload.CompanyMasterSid,
                                    // CustomerName: 'System Journal Account'
                                }
                            });
                            
                            if (systemParty) {
                                partyMasterSid = systemParty.SubledgerMasterSid;
                                // partyName = systemParty.CustomerName;
                            } else {
                                throw new BadRequestException(
                                    'No valid party found for journal voucher. Please configure a system account.'
                                );
                            }
                        }
                    }
                }

                // Get COAMasterSid - use the one from voucher type or find a default
                // let coaMasterSid = payload.COAMasterSid;
                // if (!coaMasterSid) {
                //     // Use the COA from voucher type master or find a default COA
                //     coaMasterSid = voucherTypeMaster.COALedger;
                    
                //     if (!coaMasterSid) {
                //         // Find a default COA for journal entries
                //         const defaultCOA = await tx.cOAMaster.findFirst({
                //             where: {
                //                 CompanyMasterSid: payload.CompanyMasterSid,
                //                 LedgerCategory: 'Ledger',
                //                 Status: 'Active'
                //             }
                //         });
                        
                //         if (defaultCOA) {
                //             coaMasterSid = defaultCOA.COAMasterSid;
                //         } else {
                //             throw new BadRequestException(
                //                 'No default COA found for journal voucher. Please configure Chart of Accounts.'
                //             );
                //         }
                //     }
                // }

                // Create VoucherHeader
                const voucherHeader = await tx.voucherHeader.create({
                    data: {
                        VoucherNumber: voucherNumber,
                        VoucherDate: payload.VoucherDate ? new Date(payload.VoucherDate) : new Date(),
                        PostDate: payload.PostDate,
                        VoucherType: voucherTypeMaster.VoucherTypeMasterSid,
                        Narration: payload.Narration || '',
                        COAMasterSid: payload.COAMasterSid || null,
                        CompanyMasterSid: payload.CompanyMasterSid,
                        BranchMasterSid: payload.BranchMasterSid,
                        VoucherTypeMasterSid: voucherTypeMaster.VoucherTypeMasterSid,
                        PartyMasterSid: partyMasterSid,
                        PartyName: partyName,
                        PartyAddress: payload.PartyAddress || '',
                        PlaceOfSupply: payload.PlaceOfSupply,
                        PostStatus: payload.PostStatus || 'U',
                        GST_VAT: payload.GSTNo || payload.GST_VAT,
                        InvoiceType: payload.InvoiceType || 'B2B',
                        GSTType: payload.GSTType,
                        CurrencyMasterSid: currencyMasterSid,
                        CurrencyCode: payload.CurrencyCode,
                        ExchangeRate: payload.ExchangeRate || 1,
                        DocumentNumber: payload.DocumentNumber,
                        DocumentDate: payload.DocumentDate || null,
                        Amount: payload.Amount,
                        LocalAmount: payload.LocalAmount,
                        NetAmount: payload.NetAmount,
                        MasterJobSid: payload.MasterJobSid,
                        HouseJobSid: payload.HouseJobSid,
                        MasterNumber: payload.MasterNumber,
                        HouseNumber: payload.HouseNumber,
                        Remarks: payload.Remarks,
                        Status: payload.Status,
                        CreatedBy: payload.CreatedBy || 'System',
                        //TODO - need to remove
                        UpdatedOn : new Date()
                    }
                });

                // Create VoucherDetails
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
                                HSSACMasterSid: detail.HSSACCode,
                                Narration: detail.Narration,
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
                                DepartmentMasterSid: detail.DepartmentMasterSid,
                                MasterJobSid: detail.MasterJobSid || payload.MasterJobSid,
                                HouseJobSid: detail.HouseJobSid || payload.HouseJobSid,
                                CostCenter: detail.CostCenterMasterSid,
                                ProfitCenter: detail.ProfitCenterMasterSid,
                                YearMasterSid : detail.YearMasterSid || payload.YearMasterSid,
                                CreatedBy: payload.CreatedBy || 'System',
                                Status: 'A'
                            }
                        });
                    }
                }

                // Fetch complete journal voucher with relations
                const completeJournalVoucher = await this.fetchJournalVoucherById(voucherHeader.VoucherHeaderSid, tx);

                if (voucherTypeMaster.IsAutoPosting === 'Y') {
                    const postResult = await this.postJournalInternal({
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
                    newVoucher: completeJournalVoucher,
                    VoucherHeaderSid: voucherHeader.VoucherHeaderSid,
                    VoucherNumber: voucherNumber
                };
            });
        } catch (error) {
            this.logger.error(`Error creating journal voucher: ${error.message}`);
            if (error instanceof BadRequestException) {
                throw error;
            }
            throw new InternalServerErrorException('Failed to create journal voucher');
        }
    }

    /**
     * Fetch all journal vouchers
     */
    async fetchJournalVouchers(): Promise<any[]> {
        try {
            const journalVouchers = await this._db.voucherHeader.findMany({
                where: {
                    voucherTypeMaster: {
                        DocumentTypeCode: DOC_TYPE_CODE.JOURNAL_VOUCHER
                    },
                    Status: 'A'
                },
                include: {
                    VoucherDetail: true,
                    VoucherOthers: true,
                    subledgerMaster: true,
                    currencyMaster: true,
                    masterJob: true,
                    houseJob: true,
                    voucherTypeMaster: true
                },
                orderBy: {
                    VoucherDate: 'desc'
                }
            });

            return journalVouchers;
        } catch (error) {
            this.logger.error(`Error fetching journal vouchers: ${error.message}`);
            throw new InternalServerErrorException('Failed to fetch journal vouchers');
        }
    }

    /**
     * Fetch journal voucher by ID
     */
    async fetchJournalVoucherById(VoucherHeaderSid: number, tx?: any): Promise<any> {
        try {
            const db = tx || this._db;

            const journalVoucher = await db.voucherHeader.findUnique({
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
                            currencyMaster: true,
                            subledgerMaster: true,
                            departmentMaster: true,
                            masterJob: true,
                            houseJob: true
                        }
                    },
                    VoucherOthers: {
                        where: { Status: 'A' }
                    },
                    subledgerMaster: true,
                    currencyMaster: true,
                    masterJob: true,
                    houseJob: true,
                    voucherTypeMaster: true,
                }
            });

            if (!journalVoucher) {
                throw new NotFoundException(`Journal Voucher with ID ${VoucherHeaderSid} not found`);
            }

            return journalVoucher;
        } catch (error) {
            this.logger.error(`Error fetching journal voucher by ID: ${error.message}`);
            if (error instanceof NotFoundException) {
                throw error;
            }
            throw new InternalServerErrorException('Failed to fetch journal voucher');
        }
    }

    /**
     * Update journal voucher
     */
    async updateJournalVoucher(VoucherHeaderSid: number, payload: any): Promise<any> {
        try {
            return await this._db.$transaction(async (tx) => {
                // Check if journal voucher exists
                const existing = await tx.voucherHeader.findUnique({
                    where: { VoucherHeaderSid }
                });

                if (!existing) {
                    throw new NotFoundException(`Journal Voucher with ID ${VoucherHeaderSid} not found`);
                }

                if (existing.PostStatus === 'P') {
                    throw new BadRequestException('Cannot update posted journal voucher');
                }

                // Validate debit/credit balance if details are being updated
                if (payload.VoucherDetail && Array.isArray(payload.VoucherDetail)) {
                    this.validateDebitCreditBalance(payload.VoucherDetail);
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
                        VoucherDate: payload.VoucherDate || null,
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
                        DocumentNumber: payload.DocumentNumber,
                        DocumentDate: payload.DocumentDate || null,
                        Amount: payload.Amount,
                        LocalAmount: payload.LocalAmount,
                        NetAmount: payload.NetAmount,
                        MasterJobSid: payload.MasterJobSid,
                        HouseJobSid: payload.HouseJobSid,
                        MasterNumber: payload.MasterNumber,
                        HouseNumber: payload.HouseNumber,
                        Remarks: payload.Remarks,
                        Status: payload.Status,
                        UpdatedBy: payload.UpdatedBy || 'System',
                        UpdatedOn: new Date()
                    }
                });

              if (payload.VoucherDetail && Array.isArray(payload.VoucherDetail)) {
    let sno = 1;

    const keptDetailSids: number[] = [];

    for (const detail of payload.VoucherDetail) {
        const detailData: any = {
            Sno: sno++,
            CompanyMasterSid: existing.CompanyMasterSid,
            BranchMasterSid: existing.BranchMasterSid,
            ChargeMasterSid: detail.ChargeMasterSid,
            ChargeDescription: detail.ChargeDescription || '',
            HSSACMasterSid: detail.HSSACMasterSid || null,
            Narration: detail.Narration || '',
            ChargeUOMSid: detail.ChargeUOMSid || null,
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
            LedgerMasterSid: detail.LedgerMasterSid || null,
            COAMasterSid: detail.COAMasterSid || null,
            DepartmentMasterSid: detail.DepartmentMasterSid || null,
            MasterJobSid: detail.MasterJobSid || payload.MasterJobSid || null,
            HouseJobSid: detail.HouseJobSid || payload.HouseJobSid || null,
            CostCenter: detail.CostCenterMasterSid || null,
            ProfitCenter: detail.ProfitCenterMasterSid || null,
            YearMasterSid: detail.YearMasterSid || payload.YearMasterSid || null,
            UpdatedBy: payload.UpdatedBy || 'System',
            UpdatedOn: new Date(),
            Status: 'A'
        };

        if (detail.VoucherDetailSid) {
            const updatedDetail = await tx.voucherDetail.update({
                where: {
                    VoucherDetailSid: Number(detail.VoucherDetailSid)
                },
                data: detailData
            });

            keptDetailSids.push(updatedDetail.VoucherDetailSid);
        } else {
            const createdDetail = await tx.voucherDetail.create({
                data: {
                    VoucherHeaderSid,
                    ...detailData,
                    CreatedBy: payload.UpdatedBy || payload.CreatedBy || 'System'
                }
            });

            keptDetailSids.push(createdDetail.VoucherDetailSid);
        }
    }

    await tx.voucherDetail.updateMany({
        where: {
            VoucherHeaderSid,
            Status: 'A',
            VoucherDetailSid: { notIn: keptDetailSids }
        },
        data: {
            Status: 'D',
            UpdatedBy: payload.UpdatedBy || 'System',
            UpdatedOn: new Date()
        }
    });
}

                // Fetch updated journal voucher
const updatedVoucher = await this.fetchJournalVoucherById(VoucherHeaderSid, tx);

return {
  newVoucher: updatedVoucher,
  VoucherHeaderSid: updatedVoucher.VoucherHeaderSid,
  VoucherNumber: updatedVoucher.VoucherNumber,
};
            });
        } catch (error) {
            this.logger.error(`Error updating journal voucher: ${error.message}`);
            if (error instanceof NotFoundException || error instanceof BadRequestException) {
                throw error;
            }
            throw new InternalServerErrorException('Failed to update journal voucher');
        }
    }

    /**
     * Delete journal voucher (soft delete)
     */
    async deleteJournalVoucher(VoucherHeaderSid: number): Promise<any> {
        try {
            return await this._db.$transaction(async (tx) => {
                // Check if exists
                const existing = await tx.voucherHeader.findUnique({
                    where: { VoucherHeaderSid }
                });

                if (!existing) {
                    throw new NotFoundException(`Journal Voucher with ID ${VoucherHeaderSid} not found`);
                }

                if (existing.PostStatus === 'P') {
                    throw new BadRequestException('Cannot delete posted journal voucher');
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

                // Soft delete others
                await tx.voucherOthers.updateMany({
                    where: { VoucherHeaderSid },
                    data: { Status: 'D' }
                });

                return { deleted: true, VoucherHeaderSid };
            });
        } catch (error) {
            this.logger.error(`Error deleting journal voucher: ${error.message}`);
            if (error instanceof NotFoundException || error instanceof BadRequestException) {
                throw error;
            }
            throw new InternalServerErrorException('Failed to delete journal voucher');
        }
    }

    /**
     * Search journal vouchers with filters and pagination
     */
    async searchJournalVouchers(params: any): Promise<any> {
        try {
            const {
                search = '',
                page = 1,
                pageSize = 10,
                sortColumn = 'VoucherDate',
                sortDirection = 'desc',
                activeCompanyId, 
                activeBranchId,
                dateFrom,
                DateFrom,
                dateTo,
                DateTo,
                dateField,
                DateField,
                PostStatus,
                postStatus
            } = params;

            const skip = (page - 1) * pageSize;
            const take = Number(pageSize);

            const resolvedDateFrom = dateFrom ?? DateFrom;
            const resolvedDateTo = dateTo ?? DateTo;
            const rawDateField = (dateField ?? DateField ?? '').toString();
            const allowedDateFields = ['VoucherDate', 'PostDate'];
            const selectedDateField = allowedDateFields.includes(rawDateField) ? rawDateField : 'VoucherDate';
            const parsedDateFrom = resolvedDateFrom ? new Date(resolvedDateFrom) : null;
            const parsedDateTo = resolvedDateTo ? new Date(resolvedDateTo) : null;
            const normalizedDateFrom = parsedDateFrom && !Number.isNaN(parsedDateFrom.getTime()) ? parsedDateFrom : null;
            const normalizedDateTo = parsedDateTo && !Number.isNaN(parsedDateTo.getTime()) ? parsedDateTo : null;
            const normalizedPostStatus = (PostStatus ?? postStatus ?? '').toString().trim();

            const where: any = {
                CompanyMasterSid: activeCompanyId,
                BranchMasterSid: activeBranchId,
                voucherTypeMaster: {
                    DocumentTypeCode: DOC_TYPE_CODE.JOURNAL_VOUCHER
                },
                Status: statusWhereClause,
                ...(normalizedPostStatus && { PostStatus: normalizedPostStatus }),
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
                    { Narration: { contains: search, mode: 'insensitive' } },
                ];
            }

            const [items, totalCount] = await Promise.all([
                this._db.voucherHeader.findMany({
                    where,
                    include: {
                        VoucherDetail: {
                            where: { Status: statusWhereClause }
                        },
                        VoucherOthers: {
                            where: { Status: statusWhereClause }
                        },
                        subledgerMaster: true,
                        currencyMaster: true,
                        voucherTypeMaster: true
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
            this.logger.error(`Error searching journal vouchers: ${error.message}`);
            throw new InternalServerErrorException('Failed to search journal vouchers');
        }
    }

    async postJournalInternal(payload: {
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
                    ? this.postJournalVoucher(payload, tx)
                    : this._db.$transaction((newTx) =>
                        this.postJournalVoucher(payload, newTx), { timeout: 60000 }
                    )
                );
                return result;
    
            } catch (error) {
                throw error;
            }
        }
    /**
     * Post journal voucher
     */
    async postJournalVoucher(
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
    ): Promise<PostVoucherResponseDto> {
        try {
                // Check if voucher exists
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
                        voucherTypeMaster: true,
                        subledgerMaster : true
                    }
                });

                if (!voucher) throw new BadRequestException('Journal Voucher not found.');
                if (voucher.PostStatus === 'P') throw new BadRequestException('Journal Voucher is already posted.');
                if (!voucher.VoucherDetail || voucher.VoucherDetail.length === 0) throw new BadRequestException('No detail lines are found.');
                if (!voucher.voucherTypeMaster) throw new BadRequestException('Voucher type is not found.');

                const voucherType  = voucher.voucherTypeMaster?.DocumentTypeCode;


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
                if (voucherDate < startDate || voucherDate > endDate) throw new BadRequestException('Voucher date is outside of current financial year.');

                const now = new Date();
                const chargeLineItems = voucher.VoucherDetail;
                const transactionSids: number[] = [];
                const autoGeneratedDetailSids = new Set<number>();
                const fullUpdatedDetail: any[] = [];

                const hasAnyTax = chargeLineItems.some(detail => detail.TaxPercentage1 || detail.TaxPercentage2);
                let createdTaxRows: VoucherDetailDto[] = [];
                if (hasAnyTax) {
                    const taxSummaries = await this.voucherService.summarizeTaxes(
                        chargeLineItems,
                        voucherType as TaxVoucherType,
                        taxDetails,
                        voucher.CompanyMasterSid,
                        tx
                    );
                    let currentSno = chargeLineItems.length + 1;
                    for (const taxSummary of taxSummaries) {
                        const headerExchangeRate = toNumber(voucher.ExchangeRate || 1);
                        let finalTaxPartyAmount = toNumber(taxSummary.taxAmount) / toNumber(headerExchangeRate);

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
                                DepartmentMasterSid: voucher.DepartmentMasterSid,
                                HouseJobSid: voucher.HouseJobSid,
                                MasterJobSid: voucher.MasterJobSid,
                                CostRevenue: voucher.voucherTypeMaster.DocumentTypeCode === DOC_TYPE_CODE.INVOICE || voucher.voucherTypeMaster.DocumentTypeCode === DOC_TYPE_CODE.CREDIT_NOTE ? "Revenue" : "Cost",
                                CurrencyMasterSid: voucher.CurrencyMasterSid! || payload.localCurrencyMasterSid,
                                CurrencyCode: voucher.CurrencyCode! || payload.localCurrencyCode,
                                ExchangeRate: new Decimal(1),
                                Rate: new Decimal(taxSummary.taxAmount),
                                NumberOfUnit: new Decimal(1),
                                Narration: voucher.Narration,
                                DrCr: taxSummary.DrCr!,
                                TaxableAmount: new Decimal(taxSummary.taxableAmount),
                                Amount: new Decimal(taxSummary.taxAmount),
                                LocalAmount: new Decimal(taxSummary.taxAmount),
                                PartyAmount: finalTaxPartyAmount,
                                YearMasterSid: payload.yearMasterSid,
                                IsAutoGenerated: 'Y',
                                Status: 'A',
                                CreatedBy: postedBy,
                                CreatedOn: now,
                            }
                        });
                        createdTaxRows.push(taxDetail as any);
                        autoGeneratedDetailSids.add(taxDetail.VoucherDetailSid);
                    }
                }

                
                let sumOfDebits = 0;
                let sumOfCredits = 0;
                chargeLineItems.forEach(detail => {
                    if (detail.DrCr === 'D') sumOfDebits += (toNumber(detail.LocalAmount) + toNumber(detail.TaxAmount1));
                    else sumOfCredits += (toNumber(detail.LocalAmount) + toNumber(detail.TaxAmount1))
                });
                if (sumOfCredits - sumOfDebits !== 0) {
                    throw new BadRequestException('Sum of currency debits and credits should be zero.');
                }
                
                // let sumOfLocalDebits = 0;
                // let sumOfLocalCredits = 0;
                // chargeLineItems.forEach(detail => {
                //     if (detail.DrCr === 'D') sumOfLocalDebits += toNumber(detail.LocalAmount);
                //     else sumOfLocalCredits += toNumber(detail.LocalAmount);
                // });

                let allDetails = [...chargeLineItems, ...createdTaxRows];
                const exchangeRateMismatch = sumOfCredits - sumOfDebits;
                if (exchangeRateMismatch) {
                    const exchangeRateDetail = await tx.voucherDetail.create({
                        data: {
                            CompanyMasterSid: payload.companyMasterSid,
                            BranchMasterSid: payload.branchMasterSid,
                            VoucherHeaderSid: voucherHeaderSid,
                            Sno: chargeLineItems.length + 1,
                            ChargeDescription: 'Exchange Rate',
                            COAMasterSid: await this.voucherService.getExchangeRateMismatchLedger(payload.companyMasterSid),
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
                            YearMasterSid: payload.yearMasterSid,
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
                        where: { 
                            VoucherDetailSid: detail.VoucherDetailSid 
                        },
                        data: { 
                            VoucherTransactionSid: transaction.VoucherTransactionSid 
                        },
                        include: {
                            subledgerMaster: { select: { SubledgerType: true } }
                        }
                    });

                    fullUpdatedDetail.push(completeDetail);
                }

                const totalLocalAmount = allDetails.reduce((sum, line) => {
                    if(line.DrCr === 'C') return sum;
                    return sum + toNumber(line.LocalAmount);
                }, 0);
                await tx.voucherHeader.update({
                    where: { VoucherHeaderSid: voucherHeaderSid },
                    data: {
                        Amount: totalLocalAmount,
                        LocalAmount: totalLocalAmount,
                        PostStatus: 'P',
                        PostDate: now,
                        UpdatedOn: now,
                        UpdatedBy: postedBy
                    }
                });

                 return {
                    success: true,
                    voucherHeaderSid: voucherHeaderSid,
                    transactionCount: transactionSids.length,
                    transactionSids: transactionSids,
                    postedAt: now,
                    errors: [],
                    message: 'Voucher posted successfully'
                };
        } catch (error) {
            this.logger.error(`Error posting journal voucher: ${error.message}`);
            if (error instanceof NotFoundException || error instanceof BadRequestException) {
                throw error;
            }
            throw new InternalServerErrorException('Failed to post journal voucher');
        }
    }

    /**
     * Validate debit/credit balance
     */
    private validateDebitCreditBalance(details: any[]): void {
        const debitTotal = details
            .filter(d => d.DrCr === 'D')
            .reduce((sum, d) => {
            const localAmount = Number(d.LocalAmount || 0);
            const taxAmount1 = Number(d.TaxAmount1 || 0);
            return sum + localAmount + taxAmount1;
        }, 0);

        const creditTotal = details
            .filter(d => d.DrCr === 'C')
            .reduce((sum, d) => {
            const localAmount = Number(d.LocalAmount || 0);
            const taxAmount1 = Number(d.TaxAmount1 || 0);
            return sum + localAmount + taxAmount1;
        }, 0);

        const difference = Number(Math.abs(debitTotal - creditTotal).toFixed(2));

        if (difference > 0) {
            throw new BadRequestException(
                `Debit and Credit totals must be equal. Debit: ${debitTotal}, Credit: ${creditTotal}, Difference: ${difference}`
            );
        }
    }

    async fetchjournalVouchers(): Promise<any[]> {
                    try {
                        const journalVoucher = await this._db.voucherHeader.findMany({
                            where: {
                                voucherTypeMaster: {
                                    DocumentTypeCode: DOC_TYPE_CODE.JOURNAL_VOUCHER
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
            
                        return journalVoucher;
                    } catch (error) {
                        this.logger.error(`Error fetching journal vouchers: ${error.message}`);
                        throw new InternalServerErrorException('Failed to fetch journal vouchers');
                    }
                }
}
