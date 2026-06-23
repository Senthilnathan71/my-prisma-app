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
import { statusWhereClause, toNumber, roundAmount } from 'src/common/helper';
import { DatabaseService } from 'src/database/database.service';
import { Prisma } from '@prisma/client';
import { VoucherService } from 'src/accounts/services/voucher/voucher.service';
import * as ExcelJS from 'exceljs';
import * as XLSX from 'xlsx';

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
    async createJournalVoucher(payload: any, externalTx?: Prisma.TransactionClient): Promise<any> {
        try {
            const runJournal = async (tx: Prisma.TransactionClient) => {
                // Get VoucherTypeMaster for "Journal Voucher"
                const voucherTypeMaster = await tx.voucherTypeMaster.findFirst({
                    where: {
                        DocumentTypeCode: payload.DocumentTypeCode || DOC_TYPE_CODE.JOURNAL_VOUCHER,
                        CompanyMasterSid: payload.CompanyMasterSid,
                        BranchMasterSid: payload.BranchMasterSid,
                        status: 'A'
                    }
                });

                if (!voucherTypeMaster) {
                    const isInterBranch = (payload.DocumentTypeCode || DOC_TYPE_CODE.JOURNAL_VOUCHER) === DOC_TYPE_CODE.INTER_BRANCH_JV;
                    const typeLabel = isInterBranch ? 'Inter Branch Journal Voucher (IJV)' : 'Journal Voucher';
                    const branch = await tx.branchMaster.findUnique({
                        where: { BranchMasterSid: payload.BranchMasterSid },
                        select: { branchName: true },
                    });
                    const branchPart = branch?.branchName ? ` for branch '${branch.branchName}'` : '';
                    throw new BadRequestException(
                        `${typeLabel} is not configured${branchPart}. Please add it in Document Type Master.`
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
                const completeJournalVoucher = await this.fetchJournalVoucherById(voucherHeader.VoucherHeaderSid,payload.CompanyMasterSid,payload.BranchMasterSid, tx);

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
            };
            return externalTx
                ? await runJournal(externalTx)
                : await this._db.$transaction(runJournal, { timeout: 60000 });
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
    async fetchJournalVoucherById(VoucherHeaderSid: number,CompanyMasterSid:number,BranchMasterSid: number, tx?: any): Promise<any> {
        try {
            const db = tx || this._db;

            const journalVoucher = await db.voucherHeader.findUnique({
                where: { VoucherHeaderSid , CompanyMasterSid: CompanyMasterSid, BranchMasterSid: BranchMasterSid },
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
            // Tolerate either field — frontend now sends HSSACMasterSid, but create reads HSSACCode.
            HSSACMasterSid: detail.HSSACMasterSid ?? detail.HSSACCode ?? null,
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
const updatedVoucher = await this.fetchJournalVoucherById(VoucherHeaderSid,payload.CompanyMasterSid,payload.BranchMasterSid, tx);

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
                postStatus,
                YearMasterSid,
                yearMasterSid
            } = params;

            const skip = (page - 1) * pageSize;
            const take = Number(pageSize);

            let resolvedDateFrom = dateFrom ?? DateFrom;
            let resolvedDateTo = dateTo ?? DateTo;

            const resolvedYearSid = YearMasterSid ?? yearMasterSid;
            if (resolvedYearSid) {
                const year = await this._db.yearMaster.findUnique({
                    where: { YearMasterSid: Number(resolvedYearSid) },
                    select: { StartDate: true, EndDate: true },
                });
                if (year) {
                    resolvedDateFrom = year.StartDate.toISOString().split('T')[0];
                    resolvedDateTo = year.EndDate.toISOString().split('T')[0];
                }
            }
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
                    DocumentTypeCode: { in: [DOC_TYPE_CODE.JOURNAL_VOUCHER, DOC_TYPE_CODE.INTER_BRANCH_JV] }
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

                
                // Balance precision = local currency's amountDecimal (mirrors the JV entry screen,
                // which rounds debit/credit totals to the company currency's amountDecimal before
                // comparing). Without this, native FP summation (e.g. 16936.540 + 2800.060 =
                // 19736.6000000002) makes a perfectly balanced voucher fail the !== 0 check.
                const localCurrency = await tx.currencyMaster.findUnique({
                    where: { CurrencyMasterSid: payload.localCurrencyMasterSid },
                    select: { amountDecimal: true },
                });
                const amountDecimals = localCurrency?.amountDecimal ?? 2;

                let sumOfDebits = 0;
                let sumOfCredits = 0;
                chargeLineItems.forEach(detail => {
                    // Include both tax components — India 'Intra' splits the line tax into CGST (TaxAmount1)
                    // + SGST (TaxAmount2); counting only TaxAmount1 would read a balanced voucher as off.
                    if (detail.DrCr === 'D') sumOfDebits += (toNumber(detail.LocalAmount) + toNumber(detail.TaxAmount1) + toNumber(detail.TaxAmount2));
                    else sumOfCredits += (toNumber(detail.LocalAmount) + toNumber(detail.TaxAmount1) + toNumber(detail.TaxAmount2))
                });
                const roundedDebits = roundAmount(sumOfDebits, amountDecimals);
                const roundedCredits = roundAmount(sumOfCredits, amountDecimals);
                if (roundedCredits - roundedDebits !== 0) {
                    const difference = roundAmount(Math.abs(roundedCredits - roundedDebits), amountDecimals);
                    throw new BadRequestException(
                        `Voucher is not balanced. Total debits (${roundedDebits.toFixed(amountDecimals)}) must equal total credits (${roundedCredits.toFixed(amountDecimals)}). Difference: ${difference.toFixed(amountDecimals)}.`,
                    );
                }
                
                // let sumOfLocalDebits = 0;
                // let sumOfLocalCredits = 0;
                // chargeLineItems.forEach(detail => {
                //     if (detail.DrCr === 'D') sumOfLocalDebits += toNumber(detail.LocalAmount);
                //     else sumOfLocalCredits += toNumber(detail.LocalAmount);
                // });

                let allDetails = [...chargeLineItems, ...createdTaxRows];
                const exchangeRateMismatch = roundedCredits - roundedDebits;
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
        // Count both tax components: India 'Intra' splits the line tax into CGST (TaxAmount1)
        // + SGST (TaxAmount2). TaxAmount2 is 0 for UAE/single-tax, so this is a no-op there.
        const debitTotal = details
            .filter(d => d.DrCr === 'D')
            .reduce((sum, d) => {
            const localAmount = Number(d.LocalAmount || 0);
            const taxAmount1 = Number(d.TaxAmount1 || 0);
            const taxAmount2 = Number(d.TaxAmount2 || 0);
            return sum + localAmount + taxAmount1 + taxAmount2;
        }, 0);

        const creditTotal = details
            .filter(d => d.DrCr === 'C')
            .reduce((sum, d) => {
            const localAmount = Number(d.LocalAmount || 0);
            const taxAmount1 = Number(d.TaxAmount1 || 0);
            const taxAmount2 = Number(d.TaxAmount2 || 0);
            return sum + localAmount + taxAmount1 + taxAmount2;
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

                
    // ─────────────────────────────────────────────────────────────────────────────
// EXCEL BULK UPLOAD
// ─────────────────────────────────────────────────────────────────────────────

async generateJournalVoucherTemplate(
    CompanyMasterSid: number,
    BranchMasterSid: number
): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();

    // ── Fetch all lookup data ─────────────────────────────────────────────────
    const [currencies, coaList, subledgerList, departments, charges, hssacList, companyInfo] =
        await Promise.all([
            this._db.currencyMaster.findMany({
                select: { CurrencyMasterSid: true, currencyCode: true }
            }),
            this._db.cOAMaster.findMany({
                where: { CompanyMasterSid, LedgerCategory: 'Ledger', Status: { not: 'D' } },
                select: { COAMasterSid: true, LedgerName: true, LedgerCurrency: true }
            }),
            this._db.subledgerMaster.findMany({
                where: { CompanyMasterSid, Status: { not: 'D' } },
                select: { SubledgerMasterSid: true, SubledgerName: true }
            }),
            this._db.departmentMaster.findMany({
                where: { CompanyMasterSid, Status: 'A' },
                select: { DepartmentMasterSid: true, departmentName: true }
            }),
            this._db.chargeMaster.findMany({
                where: { CompanyMasterSid, Status: 'A' },
                select: { ChargeMasterSid: true, chargeName: true }
            }),
            this._db.hSSACMaster.findMany({
                where: { status: 'A' },
                select: { HSSACMasterSid: true, HSSACCode: true, HSNSACDescription: true, TaxRate: true }
            }),
            this._db.companyMaster.findUnique({
                where: { CompanyMasterSid },
                select: {
                    CurrencyMasterSid: true,
                    currencyMaster: { select: { currencyCode: true } }
                }
            }),
        ]);

    // ── Company base currency ─────────────────────────────────────────────────
    const companyCurrencyCode = companyInfo?.currencyMaster?.currencyCode ?? '';

    // ── Fetch exchange rates for all unique ledger currencies ─────────────────
    const uniqueLedgerCurrencyCodes = [
        ...new Set(
            coaList
                .map(x =>
                    x.LedgerCurrency
                        ? currencies.find(c => c.CurrencyMasterSid === x.LedgerCurrency)?.currencyCode
                        : null
                )
                .filter((code): code is string => !!code && code.toLowerCase() !== companyCurrencyCode.toLowerCase())
        )
    ];

    const today = new Date();
    const utcToday = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()));

    const rateResults = await Promise.all(
        uniqueLedgerCurrencyCodes.map(async (fromCode) => {
            const rate = await this._db.currencyExchange.findFirst({
                where: {
                    CompanyMasterSid,
                    BranchMasterSid,
                    FromCurrency: fromCode,
                    ToCurrency: companyCurrencyCode,
                    status: 'A',
                    EffectiveFrom: { lte: utcToday }
                },
                orderBy: [
                    { EffectiveFrom: 'desc' },
                    { CurrencyExchangeSid: 'desc' }
                ]
            });
            return { fromCode, sellRate: rate?.SellRate?.toNumber() ?? null };
        })
    );

    // Build a map: currencyCode (lowercase) → exchange rate
    const exRateMap = new Map<string, number | null>();
    rateResults.forEach(({ fromCode, sellRate }) =>
        exRateMap.set(fromCode.toLowerCase(), sellRate)
    );
    // Same currency as company base → rate is always 1
    if (companyCurrencyCode) {
        exRateMap.set(companyCurrencyCode.toLowerCase(), 1);
    }

    // ══════════════════════════════════════════════════════════════════════════
    // SHEET 1 — VOUCHER HEADERS
    // ══════════════════════════════════════════════════════════════════════════
    const headerSheet = workbook.addWorksheet('Journal Vouchers');

    headerSheet.addRow([
        'Sno *',           // A — mandatory, user-assigned link key e.g. 1, 2, 3
        'Voucher Date *',  // B — mandatory  DD-MMM-YYYY
        'Narration *',     // C — mandatory
        'Bill No',         // D — optional
        'Bill Date',       // E — optional  DD-MMM-YYYY
    ]);

    const hRow1 = headerSheet.getRow(1);
    hRow1.font = { bold: true };
    hRow1.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E0E0' } };
    hRow1.height = 20;

    // Mandatory = red
    ['A', 'B', 'C'].forEach(col => {
        const cell = headerSheet.getCell(`${col}1`);
        cell.font = { bold: true, color: { argb: 'FFFF0000' } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFE5E5' } };
    });
    // Optional = amber
    ['D', 'E'].forEach(col => {
        const cell = headerSheet.getCell(`${col}1`);
        cell.font = { bold: true, color: { argb: 'FFD97706' } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF7E5' } };
    });

    // Example rows (rows 2–3)
    const headerExamples = [
        [1, '01-JAN-2025', 'Sample journal entry', 'DOC-001', '01-JAN-2025'],
        [2, '15-JAN-2025', 'Salary journal entry', '', ''],
    ];
    headerExamples.forEach(rowData => {
        const r = headerSheet.addRow(rowData);
        r.eachCell(cell => {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEAF2FB' } };
            cell.font = { italic: true, color: { argb: 'FF555555' } };
        });
        r.commit();
    });

    // Column widths: Sno | Date | Narration | DocNo | DocDate
    [10, 20, 40, 22, 20].forEach((w, i) => { headerSheet.getColumn(i + 1).width = w; });

    // Sno must be a positive integer
    for (let r = 4; r <= 5000; r++) {
        headerSheet.getCell(`A${r}`).dataValidation = {
            type: 'whole', operator: 'greaterThan', allowBlank: false,
            formulae: [0],
            showErrorMessage: true,
            errorTitle: 'Invalid Sno',
            error: 'Sno must be a positive whole number (1, 2, 3…)'
        };
    }

    // ══════════════════════════════════════════════════════════════════════════
    // SHEET 2 — VOUCHER DETAILS
    // ══════════════════════════════════════════════════════════════════════════
    const detailSheet = workbook.addWorksheet('Voucher Details');

    detailSheet.addRow([
        'VoucherSno *',      // A — must match Sheet 1 col A
        'COA / Ledger Name *', // B — mandatory
        'Subledger Name',    // C — optional
        'Dr/Cr *',           // D — D or C
        'Currency',          // E — auto from COA ledger currency (yellow)
        'Exchange Rate',     // F — auto from COA ledger currency rate (yellow)
        'Amount *',          // G — mandatory
        'Local Amount',      // H — auto = Amount × ExRate (yellow)
        'Narration',         // I — optional
        'Department',        // J — optional
        'Charge',            // K — optional
        'HS/SAC Code',       // L — optional
        'Tax %',             // M — auto from HS/SAC (yellow)
        'Tax Amount',        // N — auto = LocalAmount × Tax% (yellow)
        'Master Job No.',    // O — optional
        'House Job No.',     // P — optional
        'Cost Center',       // Q — optional
        'Profit Center',     // R — optional
    ]);

    const dRow1 = detailSheet.getRow(1);
    dRow1.font = { bold: true };
    dRow1.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E0E0' } };
    dRow1.height = 20;

    // Mandatory = red
    ['A', 'B', 'D', 'G'].forEach(col => {
        const cell = detailSheet.getCell(`${col}1`);
        cell.font = { bold: true, color: { argb: 'FFFF0000' } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFE5E5' } };
    });
    // Optional = amber  (F removed — now auto/yellow)
    ['C', 'I', 'J', 'K', 'L', 'O', 'P', 'Q', 'R'].forEach(col => {
        const cell = detailSheet.getCell(`${col}1`);
        cell.font = { bold: true, color: { argb: 'FFD97706' } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF7E5' } };
    });
    // Auto-computed = yellow  (E and F added)
    ['E', 'F', 'H', 'M', 'N'].forEach(col => {
        const cell = detailSheet.getCell(`${col}1`);
        cell.font = { bold: true, color: { argb: 'FF856404' } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF3CD' } };
    });

    // Example rows (rows 2–5)
    const detailExamples = [
        [1, 'Cash Account',    '', 'D', 'INR', 1, 10000, 10000, '', '', '', '', 0, 0, '', '', '', ''],
        [1, 'Revenue Account', '', 'C', 'INR', 1, 10000, 10000, '', '', '', '', 0, 0, '', '', '', ''],
        [2, 'Salary Expense',  '', 'D', 'INR', 1, 50000, 50000, '', '', '', '', 0, 0, '', '', '', ''],
        [2, 'Bank Account',    '', 'C', 'INR', 1, 50000, 50000, '', '', '', '', 0, 0, '', '', '', ''],
    ];
    detailExamples.forEach(rowData => {
        const r = detailSheet.addRow(rowData);
        r.eachCell(cell => {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEAF2FB' } };
            cell.font = { italic: true, color: { argb: 'FF555555' } };
        });
        r.commit();
    });

    // Column widths: Sno | COA | Subledger | DrCr | Cur | ExRate | Amt | LocalAmt | Narr | Dept | Charge | HSSAC | Tax% | TaxAmt | MJob | HJob | CC | PC
    [12, 36, 30, 8, 12, 14, 14, 14, 30, 22, 26, 16, 8, 12, 20, 20, 22, 22].forEach(
        (w, i) => { detailSheet.getColumn(i + 1).width = w; }
    );

    // Sno validation — positive integer
    for (let r = 6; r <= 5000; r++) {
        detailSheet.getCell(`A${r}`).dataValidation = {
            type: 'whole', operator: 'greaterThan', allowBlank: false,
            formulae: [0],
            showErrorMessage: true,
            errorTitle: 'Invalid Sno',
            error: 'Sno must match a number in the Journal Vouchers sheet'
        };
    }

    // Dr/Cr dropdown — column D
    for (let r = 6; r <= 5000; r++) {
        detailSheet.getCell(`D${r}`).dataValidation = {
            type: 'list', allowBlank: false,
            formulae: ['"D,C"'],
            showErrorMessage: true,
            errorTitle: 'Invalid Dr/Cr',
            error: 'Must be D (Debit) or C (Credit)'
        };
    }

    // Amount > 0 — column G
    for (let r = 6; r <= 5000; r++) {
        detailSheet.getCell(`G${r}`).dataValidation = {
            type: 'decimal', operator: 'greaterThan', allowBlank: true,
            formulae: [0],
            showErrorMessage: true,
            errorTitle: 'Invalid Amount',
            error: 'Amount must be greater than 0'
        };
    }

    // Tax % 0–100 — column M
    for (let r = 6; r <= 5000; r++) {
        detailSheet.getCell(`M${r}`).dataValidation = {
            type: 'decimal', operator: 'between', allowBlank: true,
            formulae: [0, 100],
            showErrorMessage: true,
            errorTitle: 'Invalid Tax %',
            error: 'Tax % must be between 0 and 100'
        };
    }

    // ══════════════════════════════════════════════════════════════════════════
    // HIDDEN REFERENCE SHEETS
    // ══════════════════════════════════════════════════════════════════════════
    const addRef = (name: string, values: string[]) => {
        const ws = workbook.addWorksheet(name);
        ws.addRow(['Value']);
        values.forEach(v => ws.addRow([v]));
        ws.state = 'hidden';
        return ws;
    };

    const coaNames = coaList
        .map(x => x.LedgerName)
        .filter((ledgerName): ledgerName is string => !!ledgerName);

    addRef('_Currencies', currencies.map(x => x.currencyCode));
    addRef('_COA', coaNames);
    addRef('_Subledgers', subledgerList.map(x => x.SubledgerName));
    addRef('_Departments', departments.map(x => x.departmentName));
    addRef('_Charges', charges.map(x => x.chargeName));

    // Hidden sheet: COA Name → Currency Code (for col E VLOOKUP)
    const coaCurrencyRef = workbook.addWorksheet('_COACurrency');
    coaCurrencyRef.addRow(['LedgerName', 'CurrencyCode']);
    coaList.forEach(x => {
        if (!x.LedgerName) return;
        const currCode = x.LedgerCurrency
            ? (currencies.find(c => c.CurrencyMasterSid === x.LedgerCurrency)?.currencyCode ?? '')
            : '';
        coaCurrencyRef.addRow([x.LedgerName, currCode]);
    });
    coaCurrencyRef.state = 'hidden';

    // Hidden sheet: COA Name → Exchange Rate (for col F VLOOKUP)
    // Rate is snapshotted at template-download time using today's effective date.
    // Same-currency rows get 1; foreign-currency rows get the SellRate from CurrencyExchange.
    // If no rate is configured, the cell will be blank — the user must fill it manually.
    const coaRateRef = workbook.addWorksheet('_COAExchangeRate');
    coaRateRef.addRow(['LedgerName', 'ExchangeRate']);
    coaList.forEach(x => {
        if (!x.LedgerName) return;
        const currCode = x.LedgerCurrency
            ? (currencies.find(c => c.CurrencyMasterSid === x.LedgerCurrency)?.currencyCode ?? '')
            : '';
        const rate = currCode ? (exRateMap.get(currCode.toLowerCase()) ?? '') : '';
        coaRateRef.addRow([x.LedgerName, rate]);
    });
    coaRateRef.state = 'hidden';

    // HSSAC reference sheet
    const hssacRef = workbook.addWorksheet('_HSSAC');
    hssacRef.addRow(['HSSACCode', 'Description', 'TaxRate']);
    hssacList.forEach(x => hssacRef.addRow([x.HSSACCode, x.HSNSACDescription || '', x.TaxRate ? Number(x.TaxRate) : 0]));
    hssacRef.state = 'hidden';

    // ── Apply dropdowns ───────────────────────────────────────────────────────
    const applyStaticDV = (
        sheet: ExcelJS.Worksheet,
        col: string,
        refSheet: string,
        count: number,
        startRow = 4
    ) => {
        const formula = `'${refSheet}'!$A$2:$A$${count + 1}`;
        for (let r = startRow; r <= 5000; r++) {
            sheet.getCell(`${col}${r}`).dataValidation = {
                type: 'list', allowBlank: true,
                formulae: [formula],
                showErrorMessage: true,
                errorTitle: 'Invalid value',
                error: 'Please select a value from the dropdown list'
            };
        }
    };

    // Detail sheet dropdowns
    applyStaticDV(detailSheet, 'B', '_COA', coaNames.length, 6);
    applyStaticDV(detailSheet, 'C', '_Subledgers', subledgerList.length, 6);
    applyStaticDV(detailSheet, 'J', '_Departments', departments.length, 6);
    applyStaticDV(detailSheet, 'K', '_Charges', charges.length, 6);

    // HS/SAC dropdown + auto-formulas for all data rows
    const hssacFormula = `'_HSSAC'!$A$2:$A$${hssacList.length + 1}`;
    for (let r = 6; r <= 5000; r++) {

        // HS/SAC dropdown — col L
        detailSheet.getCell(`L${r}`).dataValidation = {
            type: 'list', allowBlank: true,
            formulae: [hssacFormula],
            showErrorMessage: true,
            errorTitle: 'Invalid HS/SAC Code',
            error: 'Please select from the dropdown'
        };

        // Auto Currency — col E = VLOOKUP(B, _COACurrency, 2)
        // Shows the configured ledger currency for the selected COA.
        detailSheet.getCell(`E${r}`).value = {
            formula: `=IFERROR(IF(B${r}="","",VLOOKUP(B${r},'_COACurrency'!$A:$B,2,FALSE)),"")`
        };
        detailSheet.getCell(`E${r}`).fill = {
            type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFBEA' }
        };

        // Auto Exchange Rate — col F = VLOOKUP(B, _COAExchangeRate, 2)
        // Snapshotted SellRate as of template download date.
        // Blank if no rate is configured — user must fill manually for that row.
        detailSheet.getCell(`F${r}`).value = {
            formula: `=IFERROR(IF(B${r}="","",VLOOKUP(B${r},'_COAExchangeRate'!$A:$B,2,FALSE)),"")`
        };
        detailSheet.getCell(`F${r}`).fill = {
            type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFBEA' }
        };

        // Auto Local Amount — col H = G * F (falls back to 1 if F is blank)
        detailSheet.getCell(`H${r}`).value = {
            formula: `=IFERROR(IF(G${r}="","",G${r}*IF(F${r}="",1,F${r})),"")`
        };
        detailSheet.getCell(`H${r}`).fill = {
            type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFBEA' }
        };

        // Auto Tax % — col M = VLOOKUP(L, _HSSAC, 3)
        detailSheet.getCell(`M${r}`).value = {
            formula: `=IFERROR(VALUE(VLOOKUP(L${r},'_HSSAC'!$A:$C,3,FALSE)),"")`
        };
        detailSheet.getCell(`M${r}`).fill = {
            type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFBEA' }
        };

        // Auto Tax Amount — col N = H * M / 100
        detailSheet.getCell(`N${r}`).value = {
            formula:  `=IFERROR(IF(OR(H${r}="",M${r}="",VALUE(M${r})=0),"",H${r}*VALUE(M${r})/100),"")`
        };
        detailSheet.getCell(`N${r}`).fill = {
            type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFBEA' }
        };
    }

    // ══════════════════════════════════════════════════════════════════════════
    // INSTRUCTIONS SHEET
    // ══════════════════════════════════════════════════════════════════════════
    const inst = workbook.addWorksheet('Instructions');

    [
        ['Journal Voucher Bulk Upload Template — Instructions'],
        [],
        ['SHEET OVERVIEW'],
        ['  Sheet 1 "Journal Vouchers"  — One row per voucher header; assign a unique Sno (1, 2, 3…)'],
        ['  Sheet 2 "Voucher Details"   — One row per debit/credit line; link to header via Sno'],
        ['  Note: Sno is only a linking key for this file — the system generates the real Voucher Number on save'],
        [],
        ['HOW TO USE'],
        ['  1. Fill "Journal Vouchers" sheet first — assign a unique Sno per row, starting from row 4'],
        ['  2. Fill "Voucher Details" sheet — set Sno to match the header row the line belongs to'],
        ['  3. Each detail line is linked to its header by Sno alone'],
        ['  4. Debits and Credits must balance exactly per voucher (same Sno group)'],
        ['  5. Yellow cells (Currency, Exchange Rate, Local Amount, Tax %, Tax Amount) auto-compute — do NOT type in them'],
        [],
        ['JOURNAL VOUCHERS SHEET — MANDATORY FIELDS (red header)'],
        ['  Sno           — Unique positive integer per row (1, 2, 3…); used only for linking, not saved'],
        ['  Voucher Date  — Format: DD-MMM-YYYY  e.g. 15-JAN-2025'],
        ['  Narration     — Max 200 characters'],
        [],
        ['VOUCHER DETAILS SHEET — MANDATORY FIELDS (red header)'],
        ['  Sno           — Must match exactly one row in the Journal Vouchers sheet'],
        ['  COA / Ledger  — Select from dropdown (Chart of Accounts ledger name)'],
        ['  Dr/Cr         — D = Debit, C = Credit'],
        ['  Amount        — Foreign currency amount (must be > 0)'],
        [],
        ['AUTO-FILLED FIELDS (yellow cells — do not edit)'],
        ['  Currency      — Auto-filled from the COA\'s configured ledger currency'],
        ['  Exchange Rate — Auto-filled from today\'s sell rate for the COA\'s currency; blank = no rate configured (enter manually)'],
        ['  Local Amount  — Auto-calculated as Amount × Exchange Rate'],
        ['  Tax %         — Auto-filled from the selected HS/SAC code'],
        ['  Tax Amount    — Auto-calculated as Local Amount × Tax % ÷ 100'],
        [],
        ['OPTIONAL FIELDS (amber header)'],
        ['  Subledger     — Required only when the selected COA is configured to need one'],
        ['  Department, Charge, HS/SAC — Required only for Charge-type subledger accounts'],
        [],
        ['RULES'],
        ['  • Each voucher (Sno group) must have at least 2 detail lines (one Debit + one Credit)'],
        ['  • Sum of Debit Local Amounts must equal sum of Credit Local Amounts per Sno group'],
        ['  • Rows 2–3 in Sheet 1 and rows 2–5 in Sheet 2 are EXAMPLES — do not edit or delete them'],
        ['  • Enter your data starting from row 4 (Sheet 1) or row 6 (Sheet 2)'],
        ['  • Yellow cells are auto-filled — do not type in them manually'],
        ['  • If Exchange Rate is blank after selecting a COA, no rate is configured — enter it manually'],
        ['  • Sno is a temporary link key only; the system will auto-generate the real Voucher Number'],
    ].forEach(r => inst.addRow(r));

    inst.getRow(1).font = { bold: true, size: 13 };
    ['A3', 'A8', 'A15', 'A20', 'A26', 'A33', 'A38'].forEach(cell => {
        inst.getCell(cell).font = { bold: true, underline: true };
    });
    inst.getColumn(1).width = 90;

    const buf = await workbook.xlsx.writeBuffer();
    return Buffer.from(buf);
}

// ─── STEP 1: PARSE ONLY — no DB writes ───────────────────────────────────────
async parseJournalVoucherExcel(
    buffer: Buffer,
    CompanyMasterSid: number,
    BranchMasterSid: number,
    YearMasterSid: number
): Promise<{ validRows: any[]; invalidRows: any[]; summary: { total: number; valid: number; invalid: number } }> {

    const workbook = XLSX.read(buffer, { type: 'buffer' });

    const getRows = (partialName: string, skipRows: number): any[][] => {
        const name = workbook.SheetNames.find(n => n.toLowerCase().includes(partialName.toLowerCase()));
        if (!name) return [];
        const all: any[][] = XLSX.utils.sheet_to_json(workbook.Sheets[name], { header: 1, defval: null, raw: false });
        all.splice(0, skipRows);
        return all.filter(r => r.some(cell => cell !== null && cell !== ''));
    };

    // Sheet 1: skip 3 rows (header + 2 examples), data from row 4
    const headerRows = getRows('journal voucher', 3);
    // Sheet 2: skip 5 rows (header + 4 examples), data from row 6
    const detailRows = getRows('voucher detail', 5);

    if (headerRows.length === 0) {
        throw new BadRequestException('No data found in "Journal Vouchers" sheet. Please use the provided template.');
    }

    // ── Lookup tables ─────────────────────────────────────────────────────────
    const [currencies, coaList, subledgerList, departments, charges, hssacList, yearMaster] =
        await Promise.all([
            this._db.currencyMaster.findMany({ select: { CurrencyMasterSid: true, currencyCode: true } }),
            this._db.cOAMaster.findMany({
                where: { CompanyMasterSid, LedgerCategory: 'Ledger', Status: { not: 'D' } },
                select: { COAMasterSid: true, LedgerName: true, SubledgerName: true, LedgerCurrency: true }
            }),
            this._db.subledgerMaster.findMany({
                where: { CompanyMasterSid, Status: { not: 'D' } },
                select: { SubledgerMasterSid: true, SubledgerName: true, DrCOAMasterSid: true, CrCOAMasterSid: true, SubledgerType: true, }
            }),
            this._db.departmentMaster.findMany({
                where: { CompanyMasterSid, Status: 'A' },
                select: { DepartmentMasterSid: true, departmentName: true }
            }),
            this._db.chargeMaster.findMany({
                where: { CompanyMasterSid, Status: 'A' },
                select: { ChargeMasterSid: true, chargeName: true }
            }),
            this._db.hSSACMaster.findMany({
                where: { status: 'A' },
                select: { HSSACMasterSid: true, HSSACCode: true, TaxRate: true }
            }),
            this._db.yearMaster.findUnique({
                where: { YearMasterSid, CompanyMasterSid, status: 'A' },
                select: { StartDate: true, EndDate: true, YearName: true }
            }),
        ]);

    if (!yearMaster) throw new BadRequestException('Financial year not found or inactive.');

    // ── Lookup maps ───────────────────────────────────────────────────────────
    const curMap = new Map(currencies.map(x => [x.currencyCode.trim().toLowerCase(), x.CurrencyMasterSid]));
    const coaMap = new Map(coaList.filter(x => !!x.LedgerName).map(x => [x.LedgerName!.trim().toLowerCase(), x]));
    const subledgerMap = new Map(subledgerList.map(x => [x.SubledgerName.trim().toLowerCase(), x]));
    const deptMap = new Map(departments.map(x => [x.departmentName.trim().toLowerCase(), x.DepartmentMasterSid]));
    const chargeMap = new Map(charges.map(x => [x.chargeName.trim().toLowerCase(), x.ChargeMasterSid]));
    const hssacMap = new Map(hssacList.map(x => [x.HSSACCode.trim().toLowerCase(), x]));
    // After building subledgerMap, add:
// Map: COAMasterSid → SubledgerType ('Charge' | 'Customer' | 'Tax' | '' | null)
// The subledger record linked to a COA via DrCOAMasterSid or CrCOAMasterSid carries the type.
const coaSubledgerTypeMap = new Map<number, string>();
coaList.forEach(coa => {
    if (!coa.COAMasterSid) return;
    // Find any subledger where this COA is the Dr or Cr COA
    const linked = subledgerList.find(
        s => s.DrCOAMasterSid === coa.COAMasterSid ||
             s.CrCOAMasterSid === coa.COAMasterSid
    );
    coaSubledgerTypeMap.set(
        coa.COAMasterSid,
        linked?.SubledgerType ?? ''   // SubledgerType needs to be in subledgerList select
    );
});

    const fyStart = new Date(yearMaster.StartDate); fyStart.setHours(0, 0, 0, 0);
    const fyEnd = new Date(yearMaster.EndDate); fyEnd.setHours(23, 59, 59, 999);

    // ── Group detail rows by Sno (col A, index 0) ────────────────────────────
    const detailsBySno = new Map<string, any[]>();
    detailRows.forEach((row, i) => {
        const snoRaw = (row[0] || '').toString().trim();
        if (!snoRaw) return;
        if (!detailsBySno.has(snoRaw)) detailsBySno.set(snoRaw, []);
        detailsBySno.get(snoRaw)!.push({ row, rowNum: i + 7 });
    });

    const seenSnos = new Set<string>();
    const validRows: any[] = [];
    const invalidRows: any[] = [];

    for (let i = 0; i < headerRows.length; i++) {
        const row = headerRows[i];
        const rowNum = i + 4;
        const rowErrors: string[] = [];

        // Column mapping (0-indexed):
        // A=0 Sno  B=1 VoucherDate  C=2 Narration  D=3 DocNumber  E=4 DocDate
        const snoRaw    = (row[0] || '').toString().trim();
        const rawDate   = (row[1] || '').toString().trim();
        const narration = (row[2] || '').toString().trim();
        const docNumber = (row[3] || '').toString().trim() || null;
        const rawDocDate = (row[4] || '').toString().trim();

        if (!snoRaw && !rawDate && !narration) continue;

        // ── Sno validation ────────────────────────────────────────────────────
        if (!snoRaw) {
            rowErrors.push('Sno is required');
        } else if (isNaN(Number(snoRaw)) || Number(snoRaw) <= 0 || !Number.isInteger(Number(snoRaw))) {
            rowErrors.push(`Sno "${snoRaw}" must be a positive whole number`);
        } else if (seenSnos.has(snoRaw)) {
            rowErrors.push(`Duplicate Sno "${snoRaw}" — each header row must have a unique Sno`);
        } else {
            seenSnos.add(snoRaw);
        }

        // ── Voucher Date ──────────────────────────────────────────────────────
        let voucherDate: Date | null = null;
        if (!rawDate) {
            rowErrors.push('Voucher Date is required');
        } else {
            voucherDate = this.parseJVDate(rawDate);
            if (!voucherDate) {
                rowErrors.push(`Invalid Voucher Date "${rawDate}". Use DD-MMM-YYYY format`);
            } else {
                const today = new Date();
                today.setHours(23, 59, 59, 999);
                if (voucherDate > today) {
                    rowErrors.push(`Voucher Date "${rawDate}" cannot be a future date`);
                } else if (voucherDate < fyStart || voucherDate > fyEnd) {
                    rowErrors.push(`Voucher Date "${rawDate}" is outside financial year (${yearMaster.YearName})`);
                }
            }
        }

        // ── Narration ─────────────────────────────────────────────────────────
        if (!narration) rowErrors.push('Narration is required');
        else if (narration.length > 200) rowErrors.push('Narration must be ≤ 200 characters');

        // ── Document Date ─────────────────────────────────────────────────────
        let documentDate: Date | null = null;
        if (rawDocDate) {
            documentDate = this.parseJVDate(rawDocDate);
            if (!documentDate) rowErrors.push(`Invalid Document Date "${rawDocDate}". Use DD-MMM-YYYY format`);
        }

        // ── Match detail lines by Sno ─────────────────────────────────────────
        const matchedDetails = detailsBySno.get(snoRaw) || [];
        const parsedDetails: any[] = [];

        if (matchedDetails.length === 0) {
            rowErrors.push(`No detail lines found in "Voucher Details" sheet for Sno "${snoRaw}"`);
        } else if (matchedDetails.length < 2) {
            rowErrors.push('Each voucher must have at least 2 detail lines (one Debit + one Credit)');
        } else {
            let sno = 1;
            for (const { row: dRow, rowNum: dRowNum } of matchedDetails) {
                parsedDetails.push(
                    this.parseJVDetailRow(
                        dRow, dRowNum, sno++,
                        coaMap, subledgerMap, curMap, deptMap, chargeMap, hssacMap,
                        coaSubledgerTypeMap
                    )
                );
            }

            const hasDetailErrors = parsedDetails.some(d => d.errors.length > 0);
            if (!hasDetailErrors) {
                const debitTotal = parsedDetails
                    .filter(d => d.drCr === 'D')
                    .reduce((s, d) => s + d.localAmount + d.taxAmount, 0);
                const creditTotal = parsedDetails
                    .filter(d => d.drCr === 'C')
                    .reduce((s, d) => s + d.localAmount + d.taxAmount, 0);
                const diff = Math.abs(
                    parseFloat(debitTotal.toFixed(2)) - parseFloat(creditTotal.toFixed(2))
                );
                if (diff > 0.01) {
                    rowErrors.push(
                        `Debit total (${debitTotal.toFixed(2)}) ≠ Credit total (${creditTotal.toFixed(2)}). Difference: ${diff.toFixed(2)}`
                    );
                }
                if (!parsedDetails.some(d => d.drCr === 'D')) rowErrors.push('At least one Debit line is required');
                if (!parsedDetails.some(d => d.drCr === 'C')) rowErrors.push('At least one Credit line is required');
            }
        }

        const allDetailErrors = parsedDetails.flatMap(d => d.errors);

        const rowResult: any = {
            _linkSno: snoRaw,
            rowNum,
            voucherDate,
            voucherDateRaw: rawDate,
            narration,
            documentNumber: docNumber,
            documentDate,
            details: parsedDetails,
        };

        if (rowErrors.length > 0 || allDetailErrors.length > 0) {
            invalidRows.push({ ...rowResult, errors: [...rowErrors, ...allDetailErrors] });
        } else {
            validRows.push(rowResult);
        }
    }

    return {
        validRows,
        invalidRows,
        summary: {
            total: validRows.length + invalidRows.length,
            valid: validRows.length,
            invalid: invalidRows.length
        }
    };
}

// ─── STEP 2: SAVE ONLY ────────────────────────────────────────────────────────
async saveJournalVoucherExcel(
    validRows: any[],
    CompanyMasterSid: number,
    BranchMasterSid: number,
    YearMasterSid: number,
    createdBy: string
): Promise<{ created: number; skipped: number; errors: any[] }> {

    const voucherTypeMaster = await this._db.voucherTypeMaster.findFirst({
        where: {
            DocumentTypeCode: DOC_TYPE_CODE.JOURNAL_VOUCHER,
            CompanyMasterSid,
            BranchMasterSid,
            status: 'A'
        }
    });
    if (!voucherTypeMaster) {
        throw new BadRequestException('Journal Voucher type is not configured in VoucherTypeMaster.');
    }

    const defaultParty = await this._db.subledgerMaster.findFirst({
        where: { CompanyMasterSid, Status: { not: 'D' } },
        select: { SubledgerMasterSid: true }
    });

    if (!defaultParty) {
        throw new BadRequestException('No subledger found for the company. Please configure a subledger first.');
    }

    let created = 0, skipped = 0;
    const errors: any[] = [];

    for (const jv of validRows) {

        // Resolve Master/House Job SIDs from job numbers
        for (const detail of jv.details) {
            if (detail.masterJobNumber) {
                const mj = await this._db.masterJob.findFirst({
                    where: {
                        CompanyMasterSid,
                        BranchMasterSid,
                        MasterJobNumber: detail.masterJobNumber,
                        Status: 'A'
                    },
                    select: { MasterJobSid: true }
                }).catch(() => null);
                detail.MasterJobSid = mj?.MasterJobSid ?? null;
            }
            if (detail.houseJobNumber && detail.MasterJobSid) {
                const hj = await this._db.houseJob.findFirst({
                    where: {
                        CompanyMasterSid,
                        BranchMasterSid,
                        MasterJobSid: detail.MasterJobSid,
                        HBLNo: detail.houseJobNumber,
                        status: 'A'
                    },
                    select: { HouseJobSid: true }
                }).catch(() => null);
                detail.HouseJobSid = hj?.HouseJobSid ?? null;
            }
        }

        try {
            await this._db.$transaction(async (prisma) => {
                const voucherNumber = await this.voucherService.generateVoucherNumberFromConfig(
                    voucherTypeMaster,
                    CompanyMasterSid,
                    BranchMasterSid,
                    YearMasterSid,
                    prisma,
                    jv.voucherDate
                );

                const debitTotal = jv.details
                    .filter((d: any) => d.drCr === 'D')
                    .reduce((s: number, d: any) => s + d.localAmount + d.taxAmount, 0);

                const voucherHeader = await prisma.voucherHeader.create({
                    data: {
                        VoucherNumber: voucherNumber,
                        VoucherDate: jv.voucherDate,
                        PostDate: null,
                        VoucherType: voucherTypeMaster.VoucherTypeMasterSid,
                        Narration: jv.narration,
                        CompanyMasterSid,
                        BranchMasterSid,
                        VoucherTypeMasterSid: voucherTypeMaster.VoucherTypeMasterSid,
                        PartyMasterSid: defaultParty.SubledgerMasterSid,
                        PartyName: 'System Journal Entry',
                        PartyAddress: '',
                        PostStatus: 'U',
                        InvoiceType: 'B2B',
                        CurrencyMasterSid: null,
                        CurrencyCode: null,
                        ExchangeRate: 1,
                        DocumentNumber: jv.documentNumber,
                        DocumentDate: jv.documentDate,
                        Amount: debitTotal,
                        LocalAmount: debitTotal,
                        NetAmount: null,
                        CustomsDuty: 'N',
                        Remarks: '',
                        Status: 'A',
                        CreatedBy: createdBy,
                        UpdatedOn: new Date()
                    }
                });

                for (const detail of jv.details) {
                    await prisma.voucherDetail.create({
                        data: {
                            VoucherHeaderSid: voucherHeader.VoucherHeaderSid,
                            Sno: detail.sno,
                            CompanyMasterSid,
                            BranchMasterSid,
                            COAMasterSid: detail.COAMasterSid,
                            LedgerMasterSid: detail.LedgerMasterSid,
                            CurrencyMasterSid: detail.CurrencyMasterSid,
                            CurrencyCode: detail.currencyCode,
                            ExchangeRate: detail.exchangeRate,
                            Rate: detail.amount,
                            Amount: detail.amount,
                            LocalAmount: detail.localAmount,
                            TaxableAmount: detail.localAmount,
                            DrCr: detail.drCr,
                            Narration: detail.narration || jv.narration,
                            DepartmentMasterSid: detail.DepartmentMasterSid,
                            ChargeMasterSid: detail.ChargeMasterSid,
                            ChargeDescription: detail.chargeName || '',
                            HSSACMasterSid: detail.HSSACMasterSid,
                            TaxPercentage1: detail.taxPercentage,
                            TaxAmount1: detail.taxAmount,
                            MasterJobSid: detail.MasterJobSid || null,
                            HouseJobSid: detail.HouseJobSid || null,
                            CostCenter: detail.CostCenterMasterSid || null,
                            ProfitCenter: detail.ProfitCenterMasterSid || null,
                            YearMasterSid,
                            CreatedBy: createdBy,
                            Status: 'A'
                        }
                    });
                }
            });

            created++;
        } catch (err) {
            this.logger.error(`Error saving JV row ${jv.rowNum}: ${err.message}`);
            errors.push({
                rowNum: jv.rowNum,
                narration: jv.narration,
                message: err.message || 'DB error'
            });
            skipped++;
        }
    }

    return { created, skipped, errors };
}

// ─── COMBINED ─────────────────────────────────────────────────────────────────
async parseAndImportJournalVoucherExcel(
    buffer: Buffer,
    CompanyMasterSid: number,
    BranchMasterSid: number,
    YearMasterSid: number,
    createdBy: string
): Promise<{ created: number; skipped: number; errors: any[] }> {

    const { validRows, invalidRows } = await this.parseJournalVoucherExcel(
        buffer, CompanyMasterSid, BranchMasterSid, YearMasterSid
    );

    const saveResult = await this.saveJournalVoucherExcel(
        validRows, CompanyMasterSid, BranchMasterSid, YearMasterSid, createdBy
    );

    const parseErrors = invalidRows.map((r: any) => ({
        rowNum: r.rowNum,
        narration: r.narration,
        message: r.errors.join('; ')
    }));

    return {
        created: saveResult.created,
        skipped: saveResult.skipped + invalidRows.length,
        errors: [...parseErrors, ...saveResult.errors]
    };
}


private parseJVDetailRow(
    row: any[],
    rowNum: number,
    sno: number,
    coaMap: Map<string, any>,
    subledgerMap: Map<string, any>,
    curMap: Map<string, number>,
    deptMap: Map<string, number>,
    chargeMap: Map<string, number>,
    hssacMap: Map<string, any>,
    coaSubledgerTypeMap: Map<number, string>   // ← ADD
): any {
    const errors: string[] = [];

    const coaName          = (row[1]  || '').toString().trim();
    const subledgerName    = (row[2]  || '').toString().trim();
    const rawDrCr          = (row[3]  || '').toString().trim().toUpperCase();
    const rawCurrency      = (row[4]  || '').toString().trim();
    const rawExRate        = (row[5]  || '').toString().trim();
    const rawAmount        = (row[6]  || '').toString().trim();
    const lineNarration    = (row[8]  || '').toString().trim() || null;
    const departmentName   = (row[9]  || '').toString().trim() || null;
    const chargeName       = (row[10] || '').toString().trim() || null;
    const hssacCode        = (row[11] || '').toString().trim() || null;
    const rawTaxPct        = (row[12] || '').toString().trim();
    const masterJobNumber  = (row[14] || '').toString().trim() || null;
    const houseJobNumber   = (row[15] || '').toString().trim() || null;
    const costCenterName   = (row[16] || '').toString().trim() || null;
    const profitCenterName = (row[17] || '').toString().trim() || null;

    // ── COA ───────────────────────────────────────────────────────────────────
    let COAMasterSid: number | null = null;
    let coaRecord: any = null;
    if (!coaName) {
        errors.push(`Detail row ${rowNum}: COA / Ledger Name is required`);
    } else {
        coaRecord = coaMap.get(coaName.toLowerCase());
        if (!coaRecord) {
            errors.push(`Detail row ${rowNum}: COA "${coaName}" not found in Chart of Accounts`);
        } else {
            COAMasterSid = coaRecord.COAMasterSid;
        }
    }

    // ── Resolve subledger type for this COA ───────────────────────────────────
    // isChargeType mirrors the Angular component's subledgerTypes[rowIndex] === 'Charge' gate.
    // When false, all charge-section columns (Department, Charge, HS/SAC, Tax, Jobs,
    // Cost/Profit Center) are silently discarded — same behaviour as disableChargeFieldsForRow().
    const isChargeType = COAMasterSid
        ? (coaSubledgerTypeMap.get(COAMasterSid) ?? '').toLowerCase() === 'charge'
        : false;

    // ── Subledger ─────────────────────────────────────────────────────────────
    let LedgerMasterSid: number | null = null;
    const subledgerRequired = coaRecord &&
        String(coaRecord.SubledgerName || '').trim().toUpperCase() === 'Y';

    if (subledgerName) {
        if (!subledgerRequired) {
            // COA does not need a subledger — silently ignore (unchanged)
        } else {
            const sl = subledgerMap.get(subledgerName.toLowerCase());
            if (!sl) {
                errors.push(
                    `Detail row ${rowNum}: Subledger "${subledgerName}" not found. ` +
                    `Please select the correct subledger for Ledger "${coaName}"`
                );
            } else if (
                COAMasterSid &&
                sl.DrCOAMasterSid !== COAMasterSid &&
                sl.CrCOAMasterSid !== COAMasterSid
            ) {
                errors.push(
                    `Detail row ${rowNum}: Subledger "${subledgerName}" is not linked to ` +
                    `Ledger "${coaName}". Please select the correct subledger`
                );
            } else {
                LedgerMasterSid = sl.SubledgerMasterSid;
            }
        }
    } else if (subledgerRequired) {
        errors.push(
            `Detail row ${rowNum}: Subledger is required for Ledger "${coaName}". ` +
            `Please select a valid subledger`
        );
    }

    // ── Dr/Cr ─────────────────────────────────────────────────────────────────
    let drCr: 'D' | 'C' = 'D';
    if (!rawDrCr) {
        errors.push(`Detail row ${rowNum}: Dr/Cr is required`);
    } else if (rawDrCr !== 'D' && rawDrCr !== 'C') {
        errors.push(`Detail row ${rowNum}: Dr/Cr must be "D" or "C", got "${rawDrCr}"`);
    } else {
        drCr = rawDrCr as 'D' | 'C';
    }

    // ── Currency ──────────────────────────────────────────────────────────────
    let CurrencyMasterSid: number | null = null;
    let currencyCode = '';
    if (!rawCurrency) {
        errors.push(
            `Detail row ${rowNum}: Currency is required — ` +
            `ensure the COA has a ledger currency configured or enter it manually`
        );
    } else {
        const found = curMap.get(rawCurrency.toLowerCase());
        if (!found) {
            errors.push(`Detail row ${rowNum}: Currency "${rawCurrency}" not found`);
        } else {
            CurrencyMasterSid = found;
            currencyCode = rawCurrency.toUpperCase();
        }
    }

    // ── Exchange Rate ─────────────────────────────────────────────────────────
    let exchangeRate = 1;
    if (rawExRate) {
        const parsed = parseFloat(rawExRate);
        if (isNaN(parsed) || parsed <= 0) {
            errors.push(
                `Detail row ${rowNum}: Exchange Rate must be a positive number — ` +
                `no rate was found for the currency at template download time; please enter it manually`
            );
        } else {
            exchangeRate = parsed;
        }
    }

    // ── Amount ────────────────────────────────────────────────────────────────
    let amount = 0;
    if (!rawAmount) {
        errors.push(`Detail row ${rowNum}: Amount is required`);
    } else {
        amount = parseFloat(rawAmount);
        if (isNaN(amount) || amount <= 0) {
            errors.push(`Detail row ${rowNum}: Amount must be > 0`);
            amount = 0;
        }
    }
    const localAmount = parseFloat((amount * exchangeRate).toFixed(6));

    // ══════════════════════════════════════════════════════════════════════════
    // CHARGE-SECTION FIELDS — accepted only when subledger type === 'Charge'.
    // When isChargeType is false the columns are silently discarded (nulled out),
    // mirroring disableChargeFieldsForRow() in the Angular component.
    // When isChargeType is true they are validated exactly as before.
    // ══════════════════════════════════════════════════════════════════════════

    let HSSACMasterSid: number | null = null;
    let taxPercentage = 0;
    let taxAmount = 0;
    let DepartmentMasterSid: number | null = null;
    let ChargeMasterSid: number | null = null;
    let resolvedChargeName: string | null = null;
    let resolvedDepartmentName: string | null = null;
    let resolvedHssacCode: string | null = null;
    let resolvedMasterJobNumber: string | null = null;
    let resolvedHouseJobNumber: string | null = null;
    let resolvedCostCenterName: string | null = null;
    let resolvedProfitCenterName: string | null = null;

    if (isChargeType) {
        // ── Department ────────────────────────────────────────────────────────
        if (departmentName) {
            resolvedDepartmentName = departmentName;
            DepartmentMasterSid = deptMap.get(departmentName.toLowerCase()) ?? null;
            if (!DepartmentMasterSid) {
                errors.push(`Detail row ${rowNum}: Department "${departmentName}" not found`);
            }
        }

        // ── Charge ────────────────────────────────────────────────────────────
        if (chargeName) {
            resolvedChargeName = chargeName;
            ChargeMasterSid = chargeMap.get(chargeName.toLowerCase()) ?? null;
            if (!ChargeMasterSid) {
                errors.push(`Detail row ${rowNum}: Charge "${chargeName}" not found`);
            }
        }

        // ── HSSAC + Tax ───────────────────────────────────────────────────────
        if (hssacCode) {
            resolvedHssacCode = hssacCode;
            const hssac = hssacMap.get(hssacCode.toLowerCase());
            if (!hssac) {
                errors.push(`Detail row ${rowNum}: HS/SAC Code "${hssacCode}" not found`);
            } else {
                HSSACMasterSid = hssac.HSSACMasterSid;
                taxPercentage = hssac.TaxRate || 0;
            }
        }
        // Allow manual override of Tax % from the formula cell read-back
        if (rawTaxPct) {
            const pct = parseFloat(rawTaxPct);
            if (!isNaN(pct) && pct >= 0 && pct <= 100) taxPercentage = pct;
        }
        taxAmount = parseFloat(((localAmount * taxPercentage) / 100).toFixed(6));

        // ── Job references ────────────────────────────────────────────────────
        resolvedMasterJobNumber = masterJobNumber;
        resolvedHouseJobNumber  = houseJobNumber;

        // ── Cost / Profit Center ──────────────────────────────────────────────
        resolvedCostCenterName   = costCenterName;
        resolvedProfitCenterName = profitCenterName;

    } else if (
        // Warn only if the user actually filled something into the charge columns
        // so they know it was ignored rather than silently misrouted.
        departmentName || chargeName || hssacCode || rawTaxPct ||
        masterJobNumber || houseJobNumber || costCenterName || profitCenterName
    ) {
        errors.push(
            `Detail row ${rowNum}: Department, Charge, HS/SAC, Tax, Job and Cost/Profit ` +
            `Center fields are only applicable when the subledger type is "Charge". ` +
            `These values have been ignored for Ledger "${coaName}".`
        );
    }

    return {
        sno,
        coaName,
        COAMasterSid,
        ledgerName: subledgerName || null,
        LedgerMasterSid,
        drCr,
        currencyCode,
        CurrencyMasterSid,
        exchangeRate,
        amount,
        localAmount,
        narration: lineNarration,
        departmentName: resolvedDepartmentName,
        DepartmentMasterSid,
        chargeName: resolvedChargeName,
        ChargeMasterSid,
        hssacCode: resolvedHssacCode,
        HSSACMasterSid,
        taxPercentage,
        taxAmount,
        masterJobNumber: resolvedMasterJobNumber,
        MasterJobSid: null,
        houseJobNumber: resolvedHouseJobNumber,
        HouseJobSid: null,
        costCenterName: resolvedCostCenterName,
        CostCenterMasterSid: null,
        profitCenterName: resolvedProfitCenterName,
        ProfitCenterMasterSid: null,
        errors,
    };
}

private parseJVDate(raw: string): Date | null {
    if (!raw) return null;
    const months: Record<string, number> = {
        jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
        jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
    };

    const m1 = /^(\d{1,2})-([A-Za-z]{3})-(\d{4})$/.exec(raw);
    if (m1) {
        const month = months[m1[2].toLowerCase()];
        if (month !== undefined) {
            // ✅ Use Date.UTC to avoid local-timezone offset
            const d = new Date(Date.UTC(parseInt(m1[3]), month, parseInt(m1[1])));
            return isNaN(d.getTime()) ? null : d;
        }
    }

    const m2 = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(raw);
    if (m2) {
        // ✅ Same fix here
        const d = new Date(Date.UTC(parseInt(m2[3]), parseInt(m2[2]) - 1, parseInt(m2[1])));
        return isNaN(d.getTime()) ? null : d;
    }

    // For ISO strings, strip the time part and re-parse as UTC
    const iso = new Date(raw);
    if (!isNaN(iso.getTime())) {
        return new Date(Date.UTC(iso.getFullYear(), iso.getMonth(), iso.getDate()));
    }

    return null;
}
}
