import { 
  BadRequestException, 
  Injectable, 
  InternalServerErrorException, 
  Logger, 
  NotFoundException 
} from '@nestjs/common';
import { DatabaseService } from 'src/database/database.service';
import { VoucherService } from 'src/operation/services/voucher/voucher.service';

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
                        DocumentTypeName: 'Journal Voucher',
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
                let coaMasterSid = payload.COAMasterSid;
                if (!coaMasterSid) {
                    // Use the COA from voucher type master or find a default COA
                    coaMasterSid = voucherTypeMaster.COALedger;
                    
                    if (!coaMasterSid) {
                        // Find a default COA for journal entries
                        const defaultCOA = await tx.cOAMaster.findFirst({
                            where: {
                                CompanyMasterSid: payload.CompanyMasterSid,
                                LedgerCategory: 'Ledger',
                                Status: 'Active'
                            }
                        });
                        
                        if (defaultCOA) {
                            coaMasterSid = defaultCOA.COAMasterSid;
                        } else {
                            throw new BadRequestException(
                                'No default COA found for journal voucher. Please configure Chart of Accounts.'
                            );
                        }
                    }
                }

                // Create VoucherHeader
                const voucherHeader = await tx.voucherHeader.create({
                    data: {
                        VoucherNumber: voucherNumber,
                        VoucherDate: payload.VoucherDate ? new Date(payload.VoucherDate) : new Date(),
                        PostDate: payload.PostDate ? new Date(payload.PostDate) : new Date(),
                        VoucherType: voucherTypeMaster.VoucherTypeMasterSid,
                        Narration: payload.Narration || '',
                        COAMasterSid: coaMasterSid,
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
                        DocumentDate: payload.DocumentDate ? new Date(payload.DocumentDate) : null,
                        Amount: payload.Amount,
                        LocalAmount: payload.LocalAmount,
                        NetAmount: payload.NetAmount,
                        MasterJobSid: payload.MasterJobSid,
                        HouseJobSid: payload.HouseJobSid,
                        MasterNumber: payload.MasterNumber,
                        HouseNumber: payload.HouseNumber,
                        Remarks: payload.Remarks,
                        Status: payload.status || 'A',
                        CreatedBy: payload.CreatedBy || 'System'
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
                        DocumentTypeName: 'Journal Voucher'
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
                        DocumentNumber: payload.DocumentNumber,
                        DocumentDate: payload.DocumentDate ? new Date(payload.DocumentDate) : undefined,
                        Amount: payload.Amount,
                        LocalAmount: payload.LocalAmount,
                        NetAmount: payload.NetAmount,
                        MasterJobSid: payload.MasterJobSid,
                        HouseJobSid: payload.HouseJobSid,
                        MasterNumber: payload.MasterNumber,
                        HouseNumber: payload.HouseNumber,
                        Remarks: payload.Remarks,
                        Status: payload.status,
                        UpdatedBy: payload.UpdatedBy || 'System',
                        UpdatedOn: new Date()
                    }
                });

                // Update VoucherDetails with proper update logic
if (payload.VoucherDetail && Array.isArray(payload.VoucherDetail)) {
    let sno = 1;
    
    for (const detail of payload.VoucherDetail) {
        const detailData = {
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
            DepartmentMasterSid: detail.DepartmentMasterSid,
            MasterJobSid: detail.MasterJobSid || payload.MasterJobSid,
            HouseJobSid: detail.HouseJobSid || payload.HouseJobSid,
            CostCenter: detail.CostCenterMasterSid,
            ProfitCenter: detail.ProfitCenterMasterSid,
            UpdatedBy: payload.UpdatedBy || 'System',
            UpdatedOn: new Date(),
            Status: 'A'
        };

        // ALWAYS UPDATE existing detail - don't create new records
        if (detail.VoucherDetailSid) {
            await tx.voucherDetail.update({
                where: { 
                    VoucherDetailSid: detail.VoucherDetailSid
                },
                data: detailData
            });
        }
    }

    // Handle details that are not in the payload - mark them as deleted
    const incomingDetailSids = payload.VoucherDetail
        .map(d => d.VoucherDetailSid)
        .filter(sid => sid); // Remove null/undefined

    if (incomingDetailSids.length > 0) {
        await tx.voucherDetail.updateMany({
            where: {
                VoucherHeaderSid,
                VoucherDetailSid: { notIn: incomingDetailSids },
                Status: 'A'
            },
            data: {
                Status: 'D',
                UpdatedBy: payload.UpdatedBy || 'System',
                UpdatedOn: new Date()
            }
        });
    }
}
                // Update VoucherOthers if provided
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

                // Fetch updated journal voucher
                return await this.fetchJournalVoucherById(VoucherHeaderSid, tx);
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
                postStatus,
                fromDate,
                toDate
            } = params;

            const skip = (page - 1) * pageSize;
            const take = Number(pageSize);

            const where: any = {
                voucherTypeMaster: {
                    DocumentTypeName: 'Journal Voucher'
                },
                Status: 'A'
            };

            // Add search filter
            if (search) {
                where.OR = [
                    { VoucherNumber: { contains: search, mode: 'insensitive' } },
                    { Narration: { contains: search, mode: 'insensitive' } },
                    { Remarks: { contains: search, mode: 'insensitive' } },
                    { PartyName: { contains: search, mode: 'insensitive' } },
                    { DocumentNumber: { contains: search, mode: 'insensitive' } }
                ];
            }

            // Add post status filter
            if (postStatus) {
                where.PostStatus = postStatus;
            }

            // Add date range filter
            if (fromDate || toDate) {
                where.VoucherDate = {};
                if (fromDate) where.VoucherDate.gte = new Date(fromDate);
                if (toDate) where.VoucherDate.lte = new Date(toDate);
            }

            const [items, totalCount] = await Promise.all([
                this._db.voucherHeader.findMany({
                    where,
                    include: {
                        VoucherDetail: {
                            where: { Status: 'A' }
                        },
                        VoucherOthers: {
                            where: { Status: 'A' }
                        },
                        subledgerMaster: true,
                        currencyMaster: true,
                        voucherTypeMaster: true
                    },
                    orderBy: {
                        [sortColumn]: sortDirection
                    },
                    skip,
                    take
                }),
                this._db.voucherHeader.count({ where })
            ]);

            // Calculate totals for each voucher
            const enrichedItems = items.map(item => ({
                ...item,
                DebitTotal: item.VoucherDetail?.filter(d => d.DrCr === 'D')?.reduce((sum, d) => sum + Number(d.LocalAmount || 0), 0) || 0,
                CreditTotal: item.VoucherDetail?.filter(d => d.DrCr === 'C')?.reduce((sum, d) => sum + Number(d.LocalAmount || 0), 0) || 0,
                TotalAmount: item.VoucherDetail?.reduce((sum, d) => sum + Number(d.LocalAmount || 0), 0) || 0,
                IsBalanced: Math.abs(
                    (item.VoucherDetail?.filter(d => d.DrCr === 'D')?.reduce((sum, d) => sum + Number(d.LocalAmount || 0), 0) || 0) -
                    (item.VoucherDetail?.filter(d => d.DrCr === 'C')?.reduce((sum, d) => sum + Number(d.LocalAmount || 0), 0) || 0)
                ) <= 0.01
            }));

            return {
                items: enrichedItems,
                totalCount,
                page: Number(page),
                pageSize: Number(pageSize)
            };
        } catch (error) {
            this.logger.error(`Error searching journal vouchers: ${error.message}`);
            throw new InternalServerErrorException('Failed to search journal vouchers');
        }
    }

    /**
     * Post journal voucher
     */
    async postJournalVoucher(VoucherHeaderSid: number): Promise<any> {
        try {
            return await this._db.$transaction(async (tx) => {
                // Check if voucher exists
                const existing = await tx.voucherHeader.findUnique({
                    where: { VoucherHeaderSid },
                    include: {
                        VoucherDetail: {
                            where: { Status: 'A' }
                        }
                    }
                });

                if (!existing) {
                    throw new NotFoundException(`Journal Voucher with ID ${VoucherHeaderSid} not found`);
                }

                if (existing.PostStatus === 'P') {
                    throw new BadRequestException('Journal Voucher is already posted');
                }

                // Validate debit/credit balance before posting
                this.validateDebitCreditBalance(existing.VoucherDetail);

                // Update voucher header to posted status
                await tx.voucherHeader.update({
                    where: { VoucherHeaderSid },
                    data: {
                        PostStatus: 'P',
                        PostDate: new Date(),
                        UpdatedBy: 'System',
                        UpdatedOn: new Date()
                    }
                });

                // Create voucher transactions (if needed for your system)
                // This would depend on your specific accounting system requirements

                return { posted: true, VoucherHeaderSid, PostDate: new Date() };
            });
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
            .reduce((sum, d) => sum + Number(d.LocalAmount || 0), 0);

        const creditTotal = details
            .filter(d => d.DrCr === 'C')
            .reduce((sum, d) => sum + Number(d.LocalAmount || 0), 0);

        const difference = Math.abs(debitTotal - creditTotal);

        if (difference > 0.01) {
            throw new BadRequestException(
                `Debit and Credit totals must be equal. Debit: ${debitTotal.toFixed(2)}, Credit: ${creditTotal.toFixed(2)}, Difference: ${difference.toFixed(2)}`
            );
        }
    }
}