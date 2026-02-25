import { BadRequestException, Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { DatabaseService } from 'src/database/database.service';
import { filterDto } from 'src/masters/DTO/search-vessel.dto';
import { Prisma, VoucherHeader } from '@prisma/client';
import { statusWhereClause, toNumber } from 'src/common/helper';
import { VoucherService } from '../voucher/voucher.service';
import { SearchPostedVouchersDto, CreateStandaloneVoucherMatchingDto, UpdateStandaloneVoucherMatchingDto, FetchVoucherMatchingByIdDto, PostVoucherMatchingDto, CreateVoucherMatchingResponse, FetchVoucherMatchingResponse, PostVoucherMatchingResponse, FetchOutstandingVouchers } from 'src/accounts/dto/voucher-matching.dto';
import { DOC_TYPE_CODE } from 'src/common/config/voucher-type.config';
import { OutstandingService } from 'src/accounts/services/outstanding/outstanding.service';
import { CompanyConfigService } from 'src/masters/services/company/company-config.service';

@Injectable()
export class VoucherMatchingService {
    constructor(
        private _db: DatabaseService,
        private logger: Logger,
        private voucherService: VoucherService,
        private outstandingService: OutstandingService,
        private companyConfigService : CompanyConfigService
    ) { }

    async searchVoucherMatching(params: filterDto) {
        const { search = '', page = 1, pageSize = 10, activeCompanyId } = params;
        const skip = (page - 1) * pageSize;

        const where: Prisma.VoucherMatchingHeaderWhereInput = {
            Status: statusWhereClause,
            CompanyMasterSid: activeCompanyId,
            ...(search
                ? {
                    OR: [
                        { VoucherMatchingNo: { contains: search, mode: 'insensitive' } },
                        { SubledgerName: { contains: search, mode: 'insensitive' } },
                        { Status: { contains: search, mode: 'insensitive' } }
                    ],
                }
                : {}
            ),
        };
        const [items, totalCount] = await this._db.$transaction([
            this._db.voucherMatchingHeader.findMany({
                where,
                skip,
                take: pageSize,
                orderBy: { VoucherMatchingHeaderSid: 'desc' },
            }),
            this._db.voucherMatchingHeader.count({ where }),
        ]);

        return {
            items,
            totalCount,
        };
    }

    async getVoucherMatchingById(VoucherMatchingHeaderSid: number) {
        try {
            const voucherMatching = await this._db.voucherMatchingHeader.findUnique({
                where: {
                    VoucherMatchingHeaderSid: VoucherMatchingHeaderSid,
                    Status: 'A'
                } as any,
                include: {
                    voucherMatchings: {
                        include: {
                            CoaMaster: {
                                select: {
                                    LedgerName: true,
                                }
                            },
                            subledgerMaster: {
                                select: {
                                    SubledgerName: true,
                                }
                            },
                            branch: {
                                select: {
                                    branchName: true,
                                }
                            },
                            VoucherHeader: {
                                select: {
                                    VoucherNumber: true,
                                    voucherTypeMaster: {
                                        select: {
                                            DocumentTypeName: true,
                                        }
                                    },
                                    VoucherDate: true,
                                    PostDate: true
                                }
                            }
                        }
                    },
                }
            });
            if (!voucherMatching) {
                throw new BadRequestException('Voucher Matching not Found');
            }
            return voucherMatching;
        } catch (error) {
            this.logger.error('find VoucherMatchiing', error);
            throw new InternalServerErrorException("Something went wrong");
        }
    }

    async searchPostedVouchers(params: SearchPostedVouchersDto) {
        const { CompanyMasterSid, BranchMasterSid, VoucherType, VoucherMatchingDate, search = '', page = 1, pageSize = 20 } = params;
        const skip = (page - 1) * pageSize;

        const where: Prisma.VoucherHeaderWhereInput = {
            Status: 'A',
            PostStatus: 'P',
            CompanyMasterSid,
            BranchMasterSid,
            voucherTypeMaster: {
                DocumentTypeName: VoucherType,
            },
            ...(VoucherMatchingDate ? { VoucherDate: { lte : VoucherMatchingDate } } : {}),
            ...(search
                ? {
                    OR: [
                        { VoucherNumber: { contains: search, mode: 'insensitive' } },
                        { PartyName: { contains: search, mode: 'insensitive' } },
                    ],
                }
                : {}
            ),
        };

        const [items, totalCount] = await this._db.$transaction([
            this._db.voucherHeader.findMany({
                where,
                skip,
                take: pageSize,
                orderBy: { VoucherHeaderSid: 'desc' },
                select: {
                    VoucherHeaderSid: true,
                    VoucherNumber: true,
                    VoucherDate: true,
                    PostDate: true,
                    PartyName: true,
                    CurrencyCode: true,
                    ExchangeRate: true,
                    VoucherTypeMasterSid: true,
                    voucherTypeMaster: {
                        select: {
                            DocumentTypeName: true,
                        },
                    },
                },
            }),
            this._db.voucherHeader.count({ where }),
        ]);

        return { items, totalCount };
    }

    async getPostedVoucherWithDetails(voucherHeaderSid: number) {
        try {
            const voucher = await this._db.voucherHeader.findUnique({
                where: {
                    VoucherHeaderSid: voucherHeaderSid,
                    Status: 'A',
                    PostStatus: 'P',
                } as any,
                include: {
                    VoucherDetail: {
                        where: { Status: 'A' },
                        include: {
                            coaMaster: {
                                select: {
                                    LedgerName: true,
                                    COAMasterSid: true,
                                },
                            },
                            subledgerMaster: {
                                select: {
                                    SubledgerName: true,
                                    SubledgerMasterSid: true,
                                },
                            },
                            voucherTransaction: {
                                where: { Status: 'A' },
                                select: {
                                    VoucherTransactionSid: true,
                                    COAMasterSid: true,
                                    LedgerMasterSid: true,
                                    CurrencyCode: true,
                                    ExchangeRate: true,
                                    DrCr: true,
                                    Amount: true,
                                    LocalAmount: true,
                                },
                            },
                        },
                    },
                    voucherTypeMaster: {
                        select: {
                            DocumentTypeName: true,
                            VoucherTypeMasterSid: true,
                        },
                    },
                },
            });

            if (!voucher) {
                throw new BadRequestException('Posted voucher not found');
            }

            return voucher;
        } catch (error) {
            if (error instanceof BadRequestException) throw error;
            this.logger.error('getPostedVoucherWithDetails', error);
            throw new InternalServerErrorException('Something went wrong');
        }
    }

    // {"CompanyMasterSid":55,"BranchMasterSid":349,"LedgerMasterSid":612,"DrCr":"D","Skip":0,"Take":10}
    async getOutstandingForALedger(payload: FetchOutstandingVouchers): Promise<any> {
        const { CompanyMasterSid, BranchMasterSid, LedgerMasterSid, DrCr, Skip = 0, Take = 50, VoucherMatchingDate } = payload;
        const customerOutstanding = await this.outstandingService.getCustomerOutstanding(
            CompanyMasterSid,
            LedgerMasterSid,
            undefined,
            BranchMasterSid
        );

        const vouchers = customerOutstanding.transactions.map((txn) => ({
            VoucherTransactionSid: txn.voucherTransactionSid,
            VoucherHeaderSid: txn.voucherHeaderSid,
            VoucherDetailSid: txn.voucherDetailSid,
            VoucherNumber: txn.voucherNumber,
            VoucherDate: typeof txn.voucherDate === 'string' ? txn.voucherDate : txn.voucherDate.toISOString(),
            VoucherTypeMasterSid: txn.voucherTypeMasterSid,
            COAMasterSid: txn.coaMasterSid!,
            VoucherType: txn.voucherTypeCode,
            LedgerMasterSid: txn.ledgerMasterSid!,
            CustomerName: customerOutstanding.customerName || '',
            OriginalCurrencyAmount: txn.originalCurrencyAmount,
            OriginalLocalAmount: txn.originalLocalAmount,
            MatchedLocalAmount: txn.matchedLocalAmount,
            MatchedCurrencyAmount: txn.matchedCurrencyAmount,
            OutstandingLocalAmount: txn.outstandingLocalAmount,
            OutstandingCurrencyAmount: txn.outstandingCurrencyAmount,
            CurrencyCode: txn.currencyCode,
            ExchangeRate: txn.exchangeRate,
            DrCr: txn.drCr,
            ChargeDescription: txn.chargeDescription,
        }));
        let result = vouchers;

        if (VoucherMatchingDate) {
            const matchingDate = new Date(VoucherMatchingDate);
            result = result.filter((inv) => new Date(inv.VoucherDate) <= matchingDate);
        }

        if (DrCr) {
            result = result.filter((inv) => inv.DrCr === DrCr);
        }

        result.sort((a, b) => new Date(b.VoucherDate).getTime() - new Date(a.VoucherDate).getTime());

        if (Skip !== undefined || Take !== undefined) {
            const skip = Skip || 0;
            const take = Take || result.length;
            result = result.slice(skip, skip + take);
        }

        return result;
    }

    async createStandaloneVoucherMatching(
        payload: CreateStandaloneVoucherMatchingDto
    ): Promise<CreateVoucherMatchingResponse | PostVoucherMatchingResponse> {
        try {
            const result = await this._db.$transaction(async (prisma) => {
                // Lookup YearMasterSid for the posting date
                const yearMaster = await prisma.yearMaster.findUnique({
                    where: {
                        YearMasterSid: payload.YearMasterSid,
                        CompanyMasterSid: payload.CompanyMasterSid,
                        status: 'A',
                    },
                });
                if (!yearMaster) {
                    throw new BadRequestException('Financial Year not found.');
                }

                if (payload.VoucherMatchingDate < yearMaster.StartDate || payload.VoucherMatchingDate > yearMaster.EndDate) {
                    throw new BadRequestException('Voucher Matching Date is not in the range of current financial year.');
                }

                const voucherTypeMaster = await prisma.voucherTypeMaster.findFirst({
                    where: {
                        DocumentTypeCode: DOC_TYPE_CODE.VOUCHER_MATCHING,
                        CompanyMasterSid: payload.CompanyMasterSid,
                        BranchMasterSid: payload.BranchMasterSid,
                        status: 'A',
                    },
                });
                if (!voucherTypeMaster) {
                    throw new BadRequestException('Voucher type master not found');
                }

                const nextNumber = await this.voucherService.generateVoucherMatchingNumber(
                    voucherTypeMaster,
                    payload.CompanyMasterSid,
                    payload.BranchMasterSid,
                    payload.YearMasterSid,
                    prisma,
                    payload.VoucherMatchingDate
                );

                const createdVoucherMatching = await prisma.voucherMatchingHeader.create({
                    data: {
                        Status: 'A',
                        CompanyMasterSid: payload.CompanyMasterSid,
                        BranchMasterSid: payload.BranchMasterSid,
                        VoucherMatchingNo: nextNumber,
                        VoucherMatchingDate: payload.VoucherMatchingDate,
                        Narration : payload.Narration,
                        Remarks: payload.Remarks,
                        VoucherHeaderSid: payload.VoucherHeaderSid,
                        SubledgerName: payload.SubledgerName,
                        CreatedBy: payload.userEmail,
                        PostStatus: 'U',
                        PostDate: null,
                    }
                })

                // MatchingDetail CreateMany Payload

                const matchingDetailPayload: Prisma.MatchingDetailCreateManyInput[] = payload.MatchingDetail
                    .map((detail, index) => ({
                        Sno: index + 1,
                        BranchName: detail.BranchName,
                        VoucherHeaderSid: detail.VoucherHeaderSid,
                        VoucherDetailSid: detail.VoucherDetailSid,
                        VoucherTransactionSid: detail.VoucherTransactionSid,
                        VoucherType: detail.VoucherType,
                        CurrencyCode: detail.CurrencyCode,
                        ExchangeRate: detail.ExchangeRate,
                        DrCr: detail.DrCr,
                        Amount: detail.OriginalCurrencyAmount,
                        LocalAmount: detail.OriginalLocalAmount,
                        PartyAmount: detail.PartyAmount,
                        SourceVoucherHeaderSid: detail.SourceVoucherHeaderSid,
                        VoucherMatchingHeaderSid: createdVoucherMatching.VoucherMatchingHeaderSid,
                        MatchingCurrency: detail.MatchingCurrency,
                        MatchingExRate: detail.MatchingExRate,
                        MatchingAmount: detail.MatchedCurrencyAmount,
                        MatchingLocalAmount: detail.MatchedLocalAmount,
                        MatchingTDSAmount: detail.MatchingTDSAmount,
                        MatchingType: detail.MatchingType
                    }));

                // const isSingleCurrencyInvolved = new Set(matchingDetailPayload.map(md => md.MatchingCurrency)).size > 1;

                // if(isSingleCurrencyInvolved){
                //     // need to check both Matching Amount
                // }

                const finalMatchingDetail = await prisma.matchingDetail.createManyAndReturn({
                    data: matchingDetailPayload
                })

                if (voucherTypeMaster.IsAutoPosting === 'Y') {
                    return await this.postVoucherMatching({
                        VoucherMatchingHeaderSid: createdVoucherMatching.VoucherMatchingHeaderSid,
                        CompanyMasterSid: payload.CompanyMasterSid,
                        BranchMasterSid: payload.BranchMasterSid,
                        YearMasterSid: payload.YearMasterSid,
                        LocalCurrencyMasterSid: payload.LocalCurrencyMasterSid,
                        LocalCurrencyCode: payload.LocalCurrencyCode,
                        current_date: payload.current_date,
                        postedBy: payload.userEmail
                    }, prisma);
                } else {
                    return {
                        ...createdVoucherMatching,
                        MatchingDetail: finalMatchingDetail
                    }
                }
            }, { timeout: 60000 });

            return result;
        } catch (error) {
            this.logger.error('createStandaloneVoucherMatching', error);
            if (error instanceof BadRequestException) throw error;
            throw new InternalServerErrorException('Failed to create voucher matching');
        }
    }

    async updateStandaloneVoucherMatching(
        payload: UpdateStandaloneVoucherMatchingDto
    ): Promise<CreateVoucherMatchingResponse> {
        try {
            const result = await this._db.$transaction(async (prisma) => {
                // Validate existing header
                const existingHeader = await prisma.voucherMatchingHeader.findUnique({
                    where: {
                        VoucherMatchingHeaderSid: payload.VoucherMatchingHeaderSid,
                        CompanyMasterSid: payload.CompanyMasterSid,
                        BranchMasterSid: payload.BranchMasterSid,
                        Status: 'A'
                    },
                    include: {
                        MatchingDetail: true
                    }
                });

                if (!existingHeader) {
                    throw new BadRequestException('Voucher Matching Header not found.');
                }

                if (existingHeader.PostStatus === 'P') {
                    throw new BadRequestException('Cannot update a posted Voucher Matching.');
                }

                // Lookup YearMasterSid for the posting date
                const yearMaster = await prisma.yearMaster.findUnique({
                    where: {
                        YearMasterSid: payload.YearMasterSid,
                        CompanyMasterSid: payload.CompanyMasterSid,
                        status: 'A',
                    },
                });
                if (!yearMaster) {
                    throw new BadRequestException('Financial Year not found.');
                }

                if (payload.VoucherMatchingDate < yearMaster.StartDate || payload.VoucherMatchingDate > yearMaster.EndDate) {
                    throw new BadRequestException('Voucher Matching Date is not in the range of current financial year.');
                }

                // Update Voucher Matching Header
                const updatedVoucherMatching = await prisma.voucherMatchingHeader.update({
                    where: {
                        VoucherMatchingHeaderSid: payload.VoucherMatchingHeaderSid,
                    },
                    data: {
                        VoucherMatchingDate: payload.VoucherMatchingDate,
                        Narration : payload.Narration,
                        Remarks: payload.Remarks,
                        VoucherHeaderSid: payload.VoucherHeaderSid,
                        SubledgerName: payload.SubledgerName,
                        UpdatedBy: payload.userEmail,
                        UpdatedOn: payload.current_date,
                    }
                });

                // Update or create matching details
                const allMatchingDetails: any[] = [];
                for (let index = 0; index < payload.MatchingDetail.length; index++) {
                    const detail = payload.MatchingDetail[index];

                    if (detail.MatchingDetailSid) {
                        // Update existing detail
                        const updated = await prisma.matchingDetail.update({
                            where: {
                                MatchingDetailSid: detail.MatchingDetailSid,
                            },
                            data: {
                                Sno: index + 1,
                                BranchName: detail.BranchName ?? '',
                                VoucherHeaderSid: detail.VoucherHeaderSid,
                                VoucherDetailSid: detail.VoucherDetailSid,
                                VoucherTransactionSid: detail.VoucherTransactionSid,
                                VoucherType: detail.VoucherType,
                                CurrencyCode: detail.CurrencyCode,
                                ExchangeRate: detail.ExchangeRate,
                                DrCr: detail.DrCr,
                                Amount: detail.OriginalCurrencyAmount,
                                LocalAmount: detail.OriginalLocalAmount,
                                PartyAmount: detail.PartyAmount,
                                SourceVoucherHeaderSid: detail.SourceVoucherHeaderSid,
                                MatchingCurrency: detail.MatchingCurrency,
                                MatchingExRate: detail.MatchingExRate,
                                MatchingAmount: detail.MatchedCurrencyAmount,
                                MatchingLocalAmount: detail.MatchedLocalAmount,
                                MatchingTDSAmount: detail.MatchingTDSAmount,
                                MatchingType: detail.MatchingType,
                            }
                        });
                        allMatchingDetails.push(updated);
                    } else {
                        // Create new detail
                        const created = await prisma.matchingDetail.create({
                            data: {
                                Sno: index + 1,
                                BranchName: detail.BranchName ?? '',
                                VoucherHeaderSid: detail.VoucherHeaderSid,
                                VoucherDetailSid: detail.VoucherDetailSid,
                                VoucherTransactionSid: detail.VoucherTransactionSid,
                                VoucherType: detail.VoucherType,
                                CurrencyCode: detail.CurrencyCode,
                                ExchangeRate: detail.ExchangeRate,
                                DrCr: detail.DrCr,
                                Amount: detail.OriginalCurrencyAmount,
                                LocalAmount: detail.OriginalLocalAmount,
                                PartyAmount: detail.PartyAmount,
                                SourceVoucherHeaderSid: detail.SourceVoucherHeaderSid,
                                VoucherMatchingHeaderSid: payload.VoucherMatchingHeaderSid,
                                MatchingCurrency: detail.MatchingCurrency,
                                MatchingExRate: detail.MatchingExRate,
                                MatchingAmount: detail.MatchedCurrencyAmount,
                                MatchingLocalAmount: detail.MatchedLocalAmount,
                                MatchingTDSAmount: detail.MatchingTDSAmount,
                                MatchingType: detail.MatchingType,
                            }
                        });
                        allMatchingDetails.push(created);
                    }
                }

                return {
                    ...updatedVoucherMatching,
                    MatchingDetail: allMatchingDetails,
                };
            }, { timeout: 60000 });

            return result;
        } catch (error) {
            this.logger.error('updateStandaloneVoucherMatching', error);
            if (error instanceof BadRequestException) throw error;
            throw new InternalServerErrorException('Failed to update voucher matching');
        }
    }

    async fetchVoucherMatchingById(payload: FetchVoucherMatchingByIdDto): Promise<FetchVoucherMatchingResponse> {
        try {
            const voucherMatchingHeader = await this._db.voucherMatchingHeader.findUnique({
                where: {
                    VoucherMatchingHeaderSid: payload.VoucherMatchingHeaderSid,
                    CompanyMasterSid: payload.CompanyMasterSid,
                    BranchMasterSid: payload.BranchMasterSid,
                    Status: 'A'
                }
            });

            if (!voucherMatchingHeader) {
                throw new BadRequestException('Voucher Matching Header not found');
            }

            let enrichedDetails: any[];
            let ledgerIdInvolved: number | undefined;
            let subledgerInvolved: number | null | undefined;

            if (voucherMatchingHeader.PostStatus === 'P') {
                // After posting: read the finalised pairs from VoucherMatching
                const allVoucherMatchings = await this._db.voucherMatching.findMany({
                    where: {
                        VoucherMatchingHeaderSid: payload.VoucherMatchingHeaderSid,
                        Status: 'A',
                    },
                    include: {
                        VoucherTransaction: {
                            include: {
                                voucherTypeMaster: {
                                    select: { DocumentTypeCode: true }
                                }
                            }
                        }
                    },
                    orderBy: { Sno: 'asc' }
                });

                // Order as pairs: Source first, then its corresponding Object (Object.MatchingTransactionSid === Source.VoucherTransactionSid)
                const groupedBySno = new Map<number, typeof allVoucherMatchings>();
                for (const vm of allVoucherMatchings) {
                    const sno = toNumber(vm.Sno) ?? 0;
                    if (!groupedBySno.has(sno)) groupedBySno.set(sno, []);
                    groupedBySno.get(sno)!.push(vm);
                }
                const orderedMatchings: typeof allVoucherMatchings = [];
                for (const [, group] of groupedBySno) {
                    const source = group.find(vm => vm.MatchingType === 'Source');
                    const object = group.find(vm => vm.MatchingType === 'Object');
                    if (source) orderedMatchings.push(source);
                    if (object) orderedMatchings.push(object);
                }

                enrichedDetails = orderedMatchings.map((vm, index) => {
                    return {
                        MatchingDetailSid: vm.VoucherMatchingSid,
                        Sno: index + 1,
                        VoucherMatchingHeaderSid: vm.VoucherMatchingHeaderSid,
                        VoucherHeaderSid: vm.VoucherHeaderSid,
                        VoucherDetailSid: vm.VoucherDetailSid,
                        VoucherTransactionSid: vm.VoucherTransactionSid,
                        VoucherNumber: vm.VoucherTransaction?.VoucherNumber,
                        VoucherType: vm.VoucherTransaction?.voucherTypeMaster?.DocumentTypeCode,
                        VoucherDate: vm.VoucherTransaction?.VoucherDate,
                        DrCr: vm.DrCr,
                        CurrencyMasterSid: null,
                        CurrencyCode: vm.CurrencyCode,
                        ExchangeRate: vm.ExchangeRate,
                        OriginalCurrencyAmount: vm.VoucherTransaction?.Amount,
                        OriginalLocalAmount: vm.VoucherTransaction?.LocalAmount,
                        MatchingCurrency: null,
                        MatchingExRate: vm.ExchangeRate ?? 0,
                        MatchedCurrencyAmount: vm.Amount ?? 0,
                        MatchedLocalAmount: vm.LocalAmount ?? 0,
                        MatchingTDSAmount: 0,
                        MatchingType: vm.MatchingType!,
                        MatchingTransactionSid: vm.MatchingTransactionSid
                    };
                });

                ledgerIdInvolved = allVoucherMatchings?.[0]?.COAMasterSid ?? undefined;
                subledgerInvolved = allVoucherMatchings?.[0]?.LedgerMasterSid ?? undefined;
            } else {
                // Before posting: read the draft rows from MatchingDetail
                const allMatchingDetail = await this._db.matchingDetail.findMany({
                    where: { VoucherMatchingHeaderSid: payload.VoucherMatchingHeaderSid },
                    include: { VoucherTransaction: true }
                });

                enrichedDetails = await Promise.all(allMatchingDetail.map(async (md, index) => {
                    const outstanding = await this.voucherService.getOutstandingAmount(md.VoucherTransactionSid);
                    const transaction = md.VoucherTransaction || {} as any;
                    return {
                        MatchingDetailSid: md.MatchingDetailSid,
                        Sno: index + 1,
                        VoucherMatchingHeaderSid: payload.VoucherMatchingHeaderSid ?? md.VoucherMatchingHeaderSid,
                        VoucherHeaderSid: transaction?.VoucherHeaderSid ?? md.VoucherHeaderSid,
                        VoucherDetailSid: transaction?.VoucherDetailSid ?? md.VoucherDetailSid,
                        VoucherTransactionSid: md.VoucherTransactionSid,
                        VoucherNumber: transaction?.VoucherNumber,
                        VoucherType: md.VoucherType,
                        VoucherDate: transaction?.VoucherDate,
                        DrCr: transaction?.DrCr ?? md.DrCr,
                        CurrencyMasterSid: md.MatchingCurrency,
                        CurrencyCode: transaction.CurrencyCode ?? md.CurrencyCode,
                        ExchangeRate: transaction.ExchangeRate ?? md.ExchangeRate ?? md.MatchingExRate,
                        OriginalCurrencyAmount: transaction?.Amount ?? md.Amount,
                        OriginalLocalAmount: transaction?.LocalAmount ?? md.LocalAmount,
                        OutstandingCurrencyAmount: outstanding?.OutstandingAmount,
                        OutstandingLocalAmount: outstanding?.OutstandingLocalAmount,
                        MatchingCurrency: md.MatchingCurrency ?? null,
                        MatchingExRate: md.MatchingExRate ?? 0,
                        MatchedCurrencyAmount: md.MatchingAmount ?? 0,
                        MatchedLocalAmount: md.MatchingLocalAmount ?? 0,
                        MatchingTDSAmount: md.MatchingTDSAmount ?? 0,
                        MatchingType: md.MatchingType!
                    };
                }));

                ledgerIdInvolved = allMatchingDetail?.[0]?.VoucherTransaction?.COAMasterSid!;
                subledgerInvolved = allMatchingDetail?.[0]?.VoucherTransaction?.LedgerMasterSid;
            }

            let ledgerRecord: any;
            if (ledgerIdInvolved) {
                const record = await this._db.cOAMaster.findUnique({
                    where: { COAMasterSid: ledgerIdInvolved },
                    select: {
                        LedgerName: true,
                        LedgerType: true,
                    }
                });
                if (record) ledgerRecord = record;
            }

            return {
                ...voucherMatchingHeader,
                COAMasterSid: ledgerIdInvolved!,
                LedgerName: ledgerRecord?.LedgerName,
                LedgerType: ledgerRecord?.LedgerType,
                SubledgerMasterSid: subledgerInvolved!,
                MatchingDetail: enrichedDetails,
            };

        } catch (error) {
            this.logger.error('fetchVoucherMatchingById', error);
            throw new InternalServerErrorException('Failed to fetch voucher matching');
        }
    }

    async postVoucherMatching(payload: PostVoucherMatchingDto, tx?: Prisma.TransactionClient): Promise<PostVoucherMatchingResponse> {
        console.log(payload)
        try {
            const result = await (tx ?
                this.postMatchingInternal(payload, tx) :
                this._db.$transaction((newTxn) =>
                    this.postMatchingInternal(payload, newTxn), { timeout: 60000 }
                ))
            return result;
        } catch (error) {
            throw error;
        }
    }

    async postMatchingInternal(payload: PostVoucherMatchingDto,
        tx: Prisma.TransactionClient
    ): Promise<PostVoucherMatchingResponse> {

        const {
            VoucherMatchingHeaderSid,
            CompanyMasterSid,
            BranchMasterSid,
            YearMasterSid,
            LocalCurrencyMasterSid,
            LocalCurrencyCode,
            current_date,
            postedBy
        } = payload;

        // Taking Full Voucher Matching Header along with Detail
        const voucherMatchingHeader = await tx.voucherMatchingHeader.findUnique({
            where: {
                VoucherMatchingHeaderSid: VoucherMatchingHeaderSid,
                CompanyMasterSid: CompanyMasterSid,
                BranchMasterSid: BranchMasterSid,
                Status: 'A'
            },
            include: {
                MatchingDetail: {
                    include: {
                        VoucherTransaction: {
                            select: {
                                VoucherTransactionSid: true,
                                VoucherTypeMasterSid: true,
                                COAMasterSid: true,
                                LedgerMasterSid: true,
                                Amount: true,
                                LocalAmount: true,
                                DrCr: true,
                                CurrencyCode: true,
                                ExchangeRate: true,
                                voucherMatchings: true,
                            }
                        }
                    }
                }
            }
        })

        // Voucher Matching Header Validations
        if (!voucherMatchingHeader) {
            throw new BadRequestException('Voucher Matching not found');
        }
        if (voucherMatchingHeader.PostStatus === 'P') {
            throw new BadRequestException('Voucher Matching is already posted.');
        }
        const { MatchingDetail, ...matchingHeader } = voucherMatchingHeader;

        if (MatchingDetail.length === 0) {
            throw new BadRequestException('No Voucher Matching Details found for this Voucher Matching Header.');
        }

        const ledgerInvolved = MatchingDetail[0].VoucherTransaction.COAMasterSid;

        if(!ledgerInvolved){
            throw new BadRequestException('Ledger not found for this voucher');
        }

        const coaRecord = await this._db.cOAMaster.findUnique({
            where : {
                COAMasterSid : ledgerInvolved,
                Status : 'A'
            }, select : {
                LedgerType : true
            }
        }) 

        if(!coaRecord){
            throw new BadRequestException('Chart of Accounts not found.');
        }
        if(!coaRecord.LedgerType){
            throw new BadRequestException('Ledger Type not found.');
        }

        const allValidMatchingDetail = MatchingDetail.filter(md => toNumber(md.MatchingAmount) > 0 || toNumber(md.MatchingLocalAmount) > 0);
        const atLeastOneMatchedSourceDetail = MatchingDetail.filter(md => md.MatchingType === 'Source' && (toNumber(md.MatchingAmount) > 0 || toNumber(md.MatchingLocalAmount) > 0));
        const atLeastOneMatchedObjectDetail = MatchingDetail.filter(md => md.MatchingType === 'Object' && (toNumber(md.MatchingAmount) > 0 || toNumber(md.MatchingLocalAmount) > 0));

        if (!allValidMatchingDetail.length) {
            throw new BadRequestException("Please make sure that atleast one matching row's Matching Amount or Matching Local Amount is greater than 0.");
        }

        if (!atLeastOneMatchedSourceDetail.length) {
            throw new BadRequestException("Please make sure that atleast one Source matching row's Matching Amount or Matching Local Amount is greater than 0.")
        }

        if (!atLeastOneMatchedObjectDetail.length) {
            throw new BadRequestException("Please make sure that atleast one Object matching row's Matching Amount or Matching Local Amount is greater than 0.")
        }

        // Get Voucher Matching Document Type
        const voucherTypeMaster = await tx.voucherTypeMaster.findFirst({
            where: {
                DocumentTypeCode: DOC_TYPE_CODE.VOUCHER_MATCHING,
                CompanyMasterSid: CompanyMasterSid,
                BranchMasterSid: BranchMasterSid,
                status: 'A'
            }
        });

        // Validate Voucher Type
        if (!voucherTypeMaster) {
            throw new BadRequestException("Voucher Type for Voucher Matching cannot be found.");
        }

        // Get Year Master
        const financialYear = await tx.yearMaster.findUnique({
            where: {
                YearMasterSid: YearMasterSid,
                CompanyMasterSid: CompanyMasterSid,
                status: 'A'
            },
            select: {
                StartDate: true,
                EndDate: true
            }
        })

        // Validate Financial Year
        if (!financialYear) throw new BadRequestException('Cannot find the financial year');
        if (
            voucherMatchingHeader.VoucherMatchingDate < financialYear.StartDate ||
            voucherMatchingHeader.VoucherMatchingDate > financialYear.EndDate
        ) {
            throw new BadRequestException(`Voucher Matching Header : ${voucherMatchingHeader.VoucherMatchingNo} is outside of current financial year.`);
        }

        // Remove unwanted Matching Details
        await tx.matchingDetail.deleteMany({
            where: {
                VoucherMatchingHeaderSid: VoucherMatchingHeaderSid,
                MatchingAmount: 0,
                MatchingLocalAmount: 0
            }
        });

        let exchangeJVHeader: VoucherHeader | undefined;
        //Amount related Validation
        const currencySet = new Set(allValidMatchingDetail.map(md => md.MatchingCurrency).filter(Boolean));
        const isSingleCurrencyInvolved = currencySet.size === 1;

        if (isSingleCurrencyInvolved) {
            const itsLocalCurrency = currencySet.values().next().value === LocalCurrencyMasterSid;
            if (itsLocalCurrency) {
                // Single currency + Local Currency
                // Source - AED , Object - AED . Both will have exRate = 1
                // check both Currency Amount and Local Amount tally btw Source and Object
                const sourceMatchingAmount = Number(allValidMatchingDetail.filter(md => md.MatchingType === 'Source').reduce((acc, md) => acc + (toNumber(md.MatchingAmount) || 0), 0).toFixed(2));
                const objectMatchingAmount = Number(allValidMatchingDetail.filter(md => md.MatchingType === 'Object').reduce((acc, md) => acc + (toNumber(md.MatchingAmount) || 0), 0).toFixed(2));
                const sourceMatchingLocalAmount = Number(allValidMatchingDetail.filter(md => md.MatchingType === 'Source').reduce((acc, md) => acc + (toNumber(md.MatchingLocalAmount) || 0), 0).toFixed(2));
                const objectMatchingLocalAmount = Number(allValidMatchingDetail.filter(md => md.MatchingType === 'Object').reduce((acc, md) => acc + (toNumber(md.MatchingLocalAmount) || 0), 0).toFixed(2));
                if (sourceMatchingAmount !== objectMatchingAmount) {
                    throw new BadRequestException(`Currency Amount do not match between Source (${sourceMatchingAmount}) and Object (${objectMatchingAmount}).`);
                }
                if (sourceMatchingLocalAmount !== objectMatchingLocalAmount) {
                    throw new BadRequestException(`Local Amount do not match between Source (${sourceMatchingLocalAmount}) and Object (${objectMatchingLocalAmount}).`);
                }
            } else {
                // Single Currency but Foreign Currency
                // Source - USD , Object - USD
                // Check if the Currency Amount is same
                const sourceMatchingAmount = Number(allValidMatchingDetail.filter(md => md.MatchingType === 'Source').reduce((acc, md) => acc + (toNumber(md.MatchingAmount) || 0), 0).toFixed(2));
                const objectMatchingAmount = Number(allValidMatchingDetail.filter(md => md.MatchingType === 'Object').reduce((acc, md) => acc + (toNumber(md.MatchingAmount) || 0), 0).toFixed(2));
                if (sourceMatchingAmount !== objectMatchingAmount) {
                    throw new BadRequestException(`Currency Amount do not match between Source (${sourceMatchingAmount}) and Object (${objectMatchingAmount}).`);
                }
                // Check if the Local Amount is same; if not, create Exchange JV
                const sourceMatchingLocalAmount = Number(allValidMatchingDetail.filter(md => md.MatchingType === 'Source').reduce((acc, md) => acc + (toNumber(md.MatchingLocalAmount) || 0), 0).toFixed(2));
                const objectMatchingLocalAmount = Number(allValidMatchingDetail.filter(md => md.MatchingType === 'Object').reduce((acc, md) => acc + (toNumber(md.MatchingLocalAmount) || 0), 0).toFixed(2));
                if (sourceMatchingLocalAmount !== objectMatchingLocalAmount) {
                    // Compute sum of local debits and credits across all matching details
                    let sumOfLocalDebits = 0;
                    let sumOfLocalCredits = 0;
                    allValidMatchingDetail.forEach(md => {
                        if (md.DrCr === 'D') sumOfLocalDebits += toNumber(md.MatchingLocalAmount) || 0;
                        else sumOfLocalCredits += toNumber(md.MatchingLocalAmount) || 0;
                    });

                    // Extract party ledger info from the first matching detail's transaction
                    const firstDetail = allValidMatchingDetail[0];
                    const partyLedgerSid = firstDetail.VoucherTransaction?.COAMasterSid;
                    const partySubledgerSid = firstDetail.VoucherTransaction?.LedgerMasterSid || null;
                    if (!partyLedgerSid) {
                        throw new BadRequestException('Party Ledger not found in matching details.');
                    }

                    const currentInvolved = await tx.currencyMaster.findUnique({
                        where : { CurrencyMasterSid : currencySet.values().next().value },
                        select : {
                            CurrencyMasterSid : true,
                            currencyCode : true
                        }
                    })

                    if(!currentInvolved){
                        throw new BadRequestException('Party Currency not found in matching details.');
                    }

                    exchangeJVHeader = await this.createExchangeJvForMatching(tx, {
                        sumOfLocalCredits,
                        sumOfLocalDebits,
                        LedgerType : coaRecord?.LedgerType,
                        CompanyMasterSid,
                        BranchMasterSid,
                        YearMasterSid,
                        PartyCurrency : currentInvolved?.CurrencyMasterSid,
                        PartyCurrencyCode : currentInvolved?.currencyCode,
                        LocalCurrencyMasterSid,
                        LocalCurrencyCode,
                        partyLedgerSid,
                        partySubledgerSid,
                        voucherMatchingHeaderSid: VoucherMatchingHeaderSid,
                        voucherMatchingNo: voucherMatchingHeader.VoucherMatchingNo,
                        matchingDate: current_date,
                        postedBy,
                    });
                }
            }
        } else {
            // Multiple Currencies Involved
            // Check if the LocalAmount is tally
            const sourceMatchingLocalAmount = Number(allValidMatchingDetail.filter(md => md.MatchingType === 'Source').reduce((acc, md) => acc + (toNumber(md.MatchingLocalAmount) || 0), 0).toFixed(2));
            const objectMatchingLocalAmount = Number(allValidMatchingDetail.filter(md => md.MatchingType === 'Object').reduce((acc, md) => acc + (toNumber(md.MatchingLocalAmount) || 0), 0).toFixed(2));
            if (sourceMatchingLocalAmount !== objectMatchingLocalAmount) {
                throw new BadRequestException(`Local Amount do not match between Source (${sourceMatchingLocalAmount}) and Object (${objectMatchingLocalAmount}).`);
            }
        }

        // Check if any transaction is already full matched or the amount exceeds.
        // Aggregate matching amounts by VoucherTransactionSid so that one transaction
        // appearing in multiple MatchingDetail rows cannot be over-matched individually.
        const matchingAmountByTxn = new Map<number, { amount: number; localAmount: number }>();
        for (const md of allValidMatchingDetail) {
            const key = md.VoucherTransactionSid;
            const existing = matchingAmountByTxn.get(key) ?? { amount: 0, localAmount: 0 };
            matchingAmountByTxn.set(key, {
                amount: existing.amount + toNumber(md.MatchingAmount),
                localAmount: existing.localAmount + toNumber(md.MatchingLocalAmount),
            });
        }

        // Deduplicate to avoid fetching outstanding for the same transaction twice
        const uniqueMatchingDetails = allValidMatchingDetail.filter(
            (md, index, arr) => arr.findIndex(m => m.VoucherTransactionSid === md.VoucherTransactionSid) === index
        );
        const outstandingAmounts = await Promise.all(
            uniqueMatchingDetails.map(async (md) => {
                const out = await this.voucherService.getOutstandingAmount(md.VoucherTransactionSid, tx);
                return { md, out };
            })
        );
        for (const { md, out } of outstandingAmounts) {
            if (out.OutstandingAmount === 0 && out.OutstandingLocalAmount === 0 && out.OriginalAmount !== 0) {
                throw new BadRequestException(
                    `Voucher Number : ${out.VoucherNumber} is already full matched.`
                );
            }

            const aggregated = matchingAmountByTxn.get(md.VoucherTransactionSid)!;
            const matchAmount = Number(aggregated.amount.toFixed(2));
            const matchLocalAmount = Number(aggregated.localAmount.toFixed(2));
            const outAmount = Number(out.OutstandingAmount.toFixed(2));
            const outLocalAmount = Number(out.OutstandingLocalAmount.toFixed(2));

            if (matchAmount > outAmount || matchLocalAmount > outLocalAmount) {
                throw new BadRequestException(
                    `Matched Amount exceeds Outstanding Amount. Please refresh the screen to get Current Outstanding of the Voucher : ${out.VoucherNumber}`
                );
            }
        }

        // Paired posting algorithm: each Object row is matched against one or more Source rows.
        // Produces 2 VoucherMatching rows per pair (Object side + Source side), sharing the same Sno,
        // and linked to each other via MatchingTransactionSid.
        const sourceMds = allValidMatchingDetail
            .filter(md => md.MatchingType === 'Source')
            .sort((a, b) => toNumber(a.Sno) - toNumber(b.Sno));
        const objectMds = allValidMatchingDetail
            .filter(md => md.MatchingType === 'Object')
            .sort((a, b) => toNumber(a.Sno) - toNumber(b.Sno));

        const sourceQueue = sourceMds.map(s => ({
            ...s,
            remainingAmount: toNumber(s.MatchingAmount),
            remainingLocalAmount: toNumber(s.MatchingLocalAmount),
        }));

        const pairs: Array<{
            pairSno: number;
            objectMd: typeof objectMds[0];
            sourceMd: typeof sourceQueue[0];
            amount: number;
            sourceLocalAmount: number;
            objectLocalAmount: number;
        }> = [];
        let pairSno = 1;

        for (const objectMd of objectMds) {
            let remainingObj = toNumber(objectMd.MatchingAmount);
            let remainingObjLocal = toNumber(objectMd.MatchingLocalAmount);
            while (remainingObj > 0 && sourceQueue.length > 0) {
                const src = sourceQueue[0];
                const consume = Number(Math.min(src.remainingAmount, remainingObj).toFixed(3));

                // Source local: use remaining on last slice to avoid rounding drift
                let sourceLocalAmount: number;
                if (Math.abs(src.remainingAmount - consume) < 0.001) {
                    sourceLocalAmount = src.remainingLocalAmount;
                } else {
                    sourceLocalAmount = Number((consume / toNumber(src.MatchingAmount) * toNumber(src.MatchingLocalAmount)).toFixed(3));
                }

                // Object local: use remaining on last slice to avoid rounding drift
                let objectLocalAmount: number;
                if (Math.abs(remainingObj - consume) < 0.001) {
                    objectLocalAmount = remainingObjLocal;
                } else {
                    objectLocalAmount = Number((consume / toNumber(objectMd.MatchingAmount) * toNumber(objectMd.MatchingLocalAmount)).toFixed(3));
                }

                pairs.push({ pairSno, objectMd, sourceMd: src, amount: consume, sourceLocalAmount, objectLocalAmount });

                src.remainingAmount = Number((src.remainingAmount - consume).toFixed(3));
                src.remainingLocalAmount = Number((src.remainingLocalAmount - sourceLocalAmount).toFixed(3));
                remainingObj = Number((remainingObj - consume).toFixed(3));
                remainingObjLocal = Number((remainingObjLocal - objectLocalAmount).toFixed(3));

                if (src.remainingAmount <= 0) sourceQueue.shift();
                pairSno++;
            }
        }

        // Build VoucherMatching rows — 2 per pair (Object side + Source side)
        const voucherMatchingPayload: Prisma.VoucherMatchingCreateManyInput[] = [];
        for (const pair of pairs) {
            const { objectMd, sourceMd } = pair;
            // Source side row
            voucherMatchingPayload.push({
                CreatedBy: postedBy,
                Status: 'A',
                CompanyMasterSid,
                BranchMasterSid,
                VoucherMatchingHeaderSid,
                VoucherHeaderSid: sourceMd.VoucherHeaderSid,
                VoucherDetailSid: sourceMd.VoucherDetailSid,
                VoucherTransactionSid: sourceMd.VoucherTransactionSid,
                MatchingTransactionSid: objectMd.VoucherTransactionSid,
                VoucherMatchingDate: voucherMatchingHeader.VoucherMatchingDate,
                VoucherType: sourceMd.VoucherTransaction?.VoucherTypeMasterSid,
                Sno: pair.pairSno,
                COAMasterSid: sourceMd.VoucherTransaction?.COAMasterSid,
                LedgerMasterSid: sourceMd.VoucherTransaction?.LedgerMasterSid,
                CurrencyCode: sourceMd.CurrencyCode,
                ExchangeRate: sourceMd.ExchangeRate ?? sourceMd.MatchingExRate,
                DrCr: sourceMd.DrCr,
                Amount: pair.amount,
                LocalAmount: pair.sourceLocalAmount,
                MatchingType: 'Source',
            });

            // Object side row
            voucherMatchingPayload.push({
                CreatedBy: postedBy,
                Status: 'A',
                CompanyMasterSid,
                BranchMasterSid,
                VoucherMatchingHeaderSid,
                VoucherHeaderSid: objectMd.VoucherHeaderSid,
                VoucherDetailSid: objectMd.VoucherDetailSid,
                VoucherTransactionSid: objectMd.VoucherTransactionSid,
                MatchingTransactionSid: sourceMd.VoucherTransactionSid,
                VoucherMatchingDate: voucherMatchingHeader.VoucherMatchingDate,
                VoucherType: objectMd.VoucherTransaction?.VoucherTypeMasterSid,
                Sno: pair.pairSno,
                COAMasterSid: objectMd.VoucherTransaction?.COAMasterSid,
                LedgerMasterSid: objectMd.VoucherTransaction?.LedgerMasterSid,
                CurrencyCode: objectMd.CurrencyCode,
                ExchangeRate: objectMd.ExchangeRate ?? objectMd.MatchingExRate,
                DrCr: objectMd.DrCr,
                Amount: pair.amount,
                LocalAmount: pair.objectLocalAmount,
                MatchingType: 'Object',
            });
        }

        const allVoucherMatchings = await tx.voucherMatching.createManyAndReturn({
            data: voucherMatchingPayload
        });

        // Update PostStatus to Posted
        await tx.voucherMatchingHeader.update({
            where: { VoucherMatchingHeaderSid: VoucherMatchingHeaderSid },
            data: {
                PostStatus: 'P',
                PostDate: current_date,
                UpdatedBy: postedBy,
                UpdatedOn: current_date,
            }
        });

        return {
            ...voucherMatchingHeader,
            PostStatus: 'P',
            PostDate: current_date,
            VoucherMatching: allVoucherMatchings,
            ...(exchangeJVHeader ? { ExchangeJV: exchangeJVHeader } : {}),
        }

    }

    /**
     * Creates an Exchange JV for voucher matching when single foreign currency
     * has different exchange rates causing a local amount difference.
     * JV has 1 header, 2 details (party + exchange ledger), 2 transactions.
     *
     * Sum of Credit > Sum of Debit → Party Dr, Exchange Ledger Cr
     * Sum of Debit > Sum of Credit → Party Cr, Exchange Ledger Dr
     */
    private async createExchangeJvForMatching(
        tx: Prisma.TransactionClient,
        params: {
            sumOfLocalCredits: number;
            sumOfLocalDebits: number;
            LedgerType : string;
            CompanyMasterSid: number;
            BranchMasterSid: number;
            YearMasterSid: number;
            PartyCurrency: number;
            PartyCurrencyCode: string;
            LocalCurrencyMasterSid: number;
            LocalCurrencyCode: string;
            partyLedgerSid: number;
            partySubledgerSid: number | null;
            voucherMatchingHeaderSid: number;
            voucherMatchingNo: string;
            matchingDate: Date;
            postedBy: string;
        },
    ) {
        const diff = Math.abs(params.sumOfLocalCredits - params.sumOfLocalDebits);
        const matchingDate = params.matchingDate;
        const narration = `Being the difference of Voucher Matching Number ${params.voucherMatchingNo}`;

        // 1. Get Exchange Rate Mismatch Ledger from company config
        const exchangeRateLedgerSid = toNumber(await this.companyConfigService.getConfigurationValue(params.CompanyMasterSid, 'ExchangeJVCOA'));
        if (!exchangeRateLedgerSid) {
            throw new BadRequestException('Exchange Rate Mismatch Ledger not configured. Please configure it in Company Settings.');
        }

        // 2. Get JV VoucherTypeMaster
        const jvVoucherType = await tx.voucherTypeMaster.findFirst({
            where: {
                DocumentTypeCode: DOC_TYPE_CODE.JOURNAL_VOUCHER,
                CompanyMasterSid: params.CompanyMasterSid,
                BranchMasterSid: params.BranchMasterSid,
                status: 'A',
            },
        });
        if (!jvVoucherType) {
            throw new BadRequestException('Journal Voucher type not found for this company/branch.');
        }

        // 3. Generate JV number
        const jvNumber = await this.voucherService.generateVoucherNumberFromConfig(
            jvVoucherType, params.CompanyMasterSid, params.BranchMasterSid,
            params.YearMasterSid, tx, matchingDate
        );

        // 4. Determine Dr/Cr direction
        // Sum of Credit > Sum of Debit → Party Dr, Exchange Ledger Cr
        // Sum of Debit > Sum of Credit → Party Cr, Exchange Ledger Dr
        let partyDrCr: string;
        let exchangeLedgerDrCr: string;
        if (params.sumOfLocalCredits > params.sumOfLocalDebits) {
            partyDrCr = 'D';
            exchangeLedgerDrCr = 'C';
        } else {
            partyDrCr = 'C';
            exchangeLedgerDrCr = 'D';
        }

        // 5. Create VoucherHeader (auto-posted, local currency, VoucherDate = MatchingDate)
        const jvHeader = await tx.voucherHeader.create({
            data: {
                VoucherNumber: jvNumber,
                VoucherDate: matchingDate,
                PostDate: matchingDate,
                VoucherType: jvVoucherType.VoucherTypeMasterSid,
                Narration: narration,
                CompanyMasterSid: params.CompanyMasterSid,
                BranchMasterSid: params.BranchMasterSid,
                VoucherTypeMasterSid: jvVoucherType.VoucherTypeMasterSid,
                PostStatus: 'P',
                Amount: diff,
                LocalAmount: diff,
                NetAmount: diff,
                PartyMasterSid: params.partySubledgerSid || null,
                COAMasterSid: params.partyLedgerSid,
                CurrencyMasterSid: params.LocalCurrencyMasterSid,
                CurrencyCode: params.LocalCurrencyCode,
                ExchangeRate: 1,
                Status: 'A',
                CreatedBy: params.postedBy,
            },
        });

        // 6. Create 2 VoucherDetail lines

        // Party row: Currency Amount = 0 (overseas currency irrelevant), Local Amount = diff
        const partyDetail = await tx.voucherDetail.create({
            data: {
                CompanyMasterSid: params.CompanyMasterSid,
                BranchMasterSid: params.BranchMasterSid,
                VoucherHeaderSid: jvHeader.VoucherHeaderSid,
                Sno: 1,
                ChargeDescription: 'Exchange Rate Difference - Party',
                COAMasterSid: params.partyLedgerSid,
                LedgerMasterSid: params.partySubledgerSid || null,
                CurrencyMasterSid: params.PartyCurrency,
                CurrencyCode: params.PartyCurrencyCode,
                ExchangeRate: 1,
                Rate: 0,
                NumberOfUnit: 1,
                Narration: narration,
                DrCr: partyDrCr,
                Amount: 0,
                LocalAmount: diff,
                PartyAmount: 0,
                TaxableAmount: 0,
                YearMasterSid: params.YearMasterSid,
                CreatedBy: params.postedBy,
                Status: 'A',
            },
        });

        // Exchange Rate Ledger row: local currency, Amount = diff, LocalAmount = diff
        const exchangeDetail = await tx.voucherDetail.create({
            data: {
                CompanyMasterSid: params.CompanyMasterSid,
                BranchMasterSid: params.BranchMasterSid,
                VoucherHeaderSid: jvHeader.VoucherHeaderSid,
                Sno: 2,
                ChargeDescription: 'Exchange Rate Fallback',
                COAMasterSid: exchangeRateLedgerSid,
                CurrencyMasterSid: params.LocalCurrencyMasterSid,
                CurrencyCode: params.LocalCurrencyCode,
                ExchangeRate: 1,
                Rate: diff,
                NumberOfUnit: 1,
                Narration: narration,
                DrCr: exchangeLedgerDrCr,
                Amount: diff,
                LocalAmount: diff,
                PartyAmount: diff,
                TaxableAmount: 0,
                YearMasterSid: params.YearMasterSid,
                CreatedBy: params.postedBy,
                Status: 'A',
            },
        });

        // 7. Post: Create VoucherTransaction for each detail
        const allDetails = [partyDetail, exchangeDetail];
        for (const detail of allDetails) {
            await tx.voucherTransaction.create({
                data: {
                    CompanyMasterSid: params.CompanyMasterSid,
                    BranchMasterSid: params.BranchMasterSid,
                    VoucherHeaderSid: jvHeader.VoucherHeaderSid,
                    VoucherDetailSid: detail.VoucherDetailSid,
                    VoucherNumber: jvNumber,
                    VoucherType: jvVoucherType.VoucherTypeMasterSid,
                    VoucherDate: matchingDate,
                    GST_VAT: '',
                    Rate: toNumber(detail.Rate) || diff,
                    NumberOfUnit: 1,
                    PostDate: matchingDate,
                    Sno: detail.Sno,
                    ChargeDescription: detail.ChargeDescription || '',
                    LedgerMasterSid: detail.LedgerMasterSid!,
                    COAMasterSid: detail.COAMasterSid!,
                    CurrencyCode: detail.CurrencyCode,
                    ExchangeRate: toNumber(detail.ExchangeRate) || 1,
                    Narration: detail.Narration,
                    DrCr: detail.DrCr,
                    TaxableAmount: 0,
                    Amount: toNumber(detail.Amount) || 0,
                    LocalAmount: toNumber(detail.LocalAmount) || 0,
                    VoucherTypeMasterSid: jvVoucherType.VoucherTypeMasterSid,
                    YearMasterSid: params.YearMasterSid,
                    Status: 'A',
                    CreatedBy: params.postedBy,
                    CreatedOn: matchingDate,
                },
            });
        }

        // 8. Attach the Exchange JV party transaction to VoucherMatching
        const partyTransaction = await tx.voucherTransaction.findFirst({
            where: {
                VoucherHeaderSid: jvHeader.VoucherHeaderSid,
                COAMasterSid: params.partyLedgerSid,
            },
        });

        const isSourceExJv = params.LedgerType === 'Sy Dr' && (params.sumOfLocalDebits > params.sumOfLocalCredits);
        if (partyTransaction) {
            await tx.voucherMatching.create({
                data: {
                    CreatedBy: params.postedBy,
                    Status: 'A',
                    CompanyMasterSid: params.CompanyMasterSid,
                    BranchMasterSid: params.BranchMasterSid,
                    VoucherMatchingHeaderSid: params.voucherMatchingHeaderSid,
                    VoucherHeaderSid: jvHeader.VoucherHeaderSid,
                    VoucherDetailSid: partyDetail.VoucherDetailSid,
                    VoucherTransactionSid: partyTransaction.VoucherTransactionSid,
                    MatchingTransactionSid: partyTransaction.VoucherTransactionSid,
                    VoucherMatchingDate: matchingDate,
                    VoucherType: jvVoucherType.VoucherTypeMasterSid,
                    Sno: 0,
                    COAMasterSid: params.partyLedgerSid,
                    LedgerMasterSid: params.partySubledgerSid || 0,
                    CurrencyCode: params.PartyCurrencyCode,
                    ExchangeRate: 1,
                    DrCr: partyDrCr,
                    Amount: 0,
                    LocalAmount: diff,
                    PartyAmount: 0,
                    MatchingType: isSourceExJv ? 'Source' : 'Object',
                },
            });
        }

        return jvHeader;
    }
}
