import { BadRequestException, Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { DatabaseService } from 'src/database/database.service';
import { filterDto } from 'src/masters/DTO/search-vessel.dto';
import { Prisma, VoucherHeader } from '@prisma/client';
import { statusWhereClause, toNumber, roundAmount } from 'src/common/helper';
import { VoucherService } from '../voucher/voucher.service';
import { SearchPostedVouchersDto, CreateStandaloneVoucherMatchingDto, UpdateStandaloneVoucherMatchingDto, FetchVoucherMatchingByIdDto, PostVoucherMatchingDto, CreateVoucherMatchingResponse, FetchVoucherMatchingResponse, PostVoucherMatchingResponse, FetchOutstandingVouchers, CancelVoucherMatchingDto, VoucherMatchingCancellationWarnings, EnquireVoucherDto } from 'src/accounts/dto/voucher-matching.dto';
import { DOC_TYPE_CODE, getPartyDrCr } from 'src/common/config/voucher-type.config';
import { OutstandingService } from 'src/accounts/services/outstanding/outstanding.service';
import { CompanyConfigService } from 'src/masters/services/company/company-config.service';
import { VoucherAuthorizationService } from 'src/accounts/services/voucher-authorization/voucher-authorization.service';

@Injectable()
export class VoucherMatchingService {
    constructor(
        private _db: DatabaseService,
        private logger: Logger,
        private voucherService: VoucherService,
        private outstandingService: OutstandingService,
        private companyConfigService : CompanyConfigService,
        private voucherAuthorizationService: VoucherAuthorizationService
    ) { }

    async searchVoucherMatching(params: filterDto) {
        const {
            search = '',
            page = 1,
            pageSize = 10,
            activeCompanyId,
            activeBranchId,
            dateFrom,
            DateFrom,
            dateTo,
            DateTo,
            dateField,
            DateField,
            SubledgerName,
            subledgerName,
            YearMasterSid,
            yearMasterSid
        } = params as any;
        const skip = (page - 1) * pageSize;
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
        const allowedDateFields = ['VoucherMatchingDate'];
        const selectedDateField = allowedDateFields.includes(rawDateField) ? rawDateField : 'VoucherMatchingDate';
        const parsedDateFrom = resolvedDateFrom ? new Date(resolvedDateFrom) : null;
        const parsedDateTo = resolvedDateTo ? new Date(resolvedDateTo) : null;
        const normalizedDateFrom = parsedDateFrom && !Number.isNaN(parsedDateFrom.getTime()) ? parsedDateFrom : null;
        const normalizedDateTo = parsedDateTo && !Number.isNaN(parsedDateTo.getTime()) ? parsedDateTo : null;
        const normalizedSubledgerName = (SubledgerName ?? subledgerName ?? '').toString().trim();

        const where: Prisma.VoucherMatchingHeaderWhereInput = {
            Status: statusWhereClause,
            CompanyMasterSid: activeCompanyId,
            ...(activeBranchId && { BranchMasterSid: activeBranchId }),
            ...(normalizedSubledgerName && { SubledgerName: { contains: normalizedSubledgerName, mode: 'insensitive' } }),
            ...((normalizedDateFrom || normalizedDateTo) && {
                [selectedDateField]: {
                    ...(normalizedDateFrom && { gte: normalizedDateFrom }),
                    ...(normalizedDateTo && { lte: normalizedDateTo })
                }
            }),
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
                // Newest first by date, with the matching number as a deterministic tiebreaker
                // so paginated windows don't skip/duplicate rows that share a date.
                orderBy: [{ VoucherMatchingDate: 'desc' }, { VoucherMatchingNo: 'desc' }],
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
                    Status: statusWhereClause
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
        const { CompanyMasterSid, BranchMasterSid, LedgerMasterSid, DrCr, Skip = 0, Take = 50, COAMasterSid, VoucherMatchingDate } = payload;
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
            Narration: txn.narration,
        }));
        let result = vouchers;

        if (COAMasterSid) {
            result = result.filter((inv) => inv.COAMasterSid === COAMasterSid);
        }

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
                    throw new BadRequestException('VoucherMatching Voucher Type is not found. Please configure it in the Document Type Master.');
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
                        UpdatedOn : new Date(),
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
                        MatchingType: detail.MatchingType,
                        CreatedBy: payload.userEmail,
                        CreatedOn: new Date()
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
                        UpdatedOn: new Date(),
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
                                UpdatedBy: payload.userEmail,
                                UpdatedOn: new Date()
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
                    Status: statusWhereClause
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
                        Narration: vm.VoucherTransaction?.Narration ?? '',
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
                        Narration: transaction?.Narration ?? '',
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

            const voucherTypeAliases: Record<string, string> = {
                RPT: 'Receipt',
                RECEIPT: 'Receipt',
                PMT: 'Payment',
                PAYMENT: 'Payment',
            };
            const exchangeRateLedgerSid = toNumber(
                await this.companyConfigService.getConfigurationValue(payload.CompanyMasterSid, 'ExchangeJVCOA')
            );
            const receiptOrPaymentVouchers = Array.from(
                new Map(
                    enrichedDetails
                        .map((detail) => {
                            const normalizedType = String(detail?.VoucherType ?? '').trim().toUpperCase();
                            const voucherHeaderSid = toNumber(detail?.VoucherHeaderSid);
                            const voucherNumber = String(detail?.VoucherNumber ?? '').trim();
                            const voucherType = voucherTypeAliases[normalizedType];
                            if (!voucherType || !voucherHeaderSid || !voucherNumber) {
                                return null;
                            }
                            return [voucherHeaderSid, {
                                voucherHeaderSid,
                                voucherNumber,
                                voucherType,
                            }] as const;
                        })
                        .filter((entry): entry is readonly [number, { voucherHeaderSid: number; voucherNumber: string; voucherType: string; }] => !!entry)
                ).values()
            );

            let affectedVouchers: VoucherMatchingCancellationWarnings['affectedVouchers'] = [];
            if (exchangeRateLedgerSid && receiptOrPaymentVouchers.length > 0) {
                const voucherHeadersWithExchangeRows = await this._db.voucherDetail.findMany({
                    where: {
                        VoucherHeaderSid: { in: receiptOrPaymentVouchers.map((item) => item.voucherHeaderSid) },
                        COAMasterSid: exchangeRateLedgerSid,
                        Status: 'A',
                    },
                    select: {
                        VoucherHeaderSid: true,
                    },
                    distinct: ['VoucherHeaderSid'],
                });

                const affectedVoucherHeaderSids = new Set(voucherHeadersWithExchangeRows.map((item) => item.VoucherHeaderSid));
                affectedVouchers = receiptOrPaymentVouchers
                    .filter((item) => affectedVoucherHeaderSids.has(item.voucherHeaderSid))
                    .map((item) => ({
                        ...item,
                        reason: 'WRITE_OFF_OR_EXCHANGE_JV',
                    }));
            }

            const exchangeJVLinks = await this._db.voucherMatchingExchangeJV.findMany({
                where: {
                    VoucherMatchingHeaderSid: payload.VoucherMatchingHeaderSid,
                    Status: 'A',
                },
                include: {
                    exchangeJVVoucherHeader: {
                        select: {
                            VoucherNumber: true,
                        }
                    }
                }
            });

            // Fetch DocumentTypeName from VoucherTypeMaster via the first source voucher
            let documentTypeName: string | null = null;
            const firstSourceVoucherHeaderSid = receiptOrPaymentVouchers[0]?.voucherHeaderSid;
            if (firstSourceVoucherHeaderSid) {
                const voucherHeader = await this._db.voucherHeader.findUnique({
                    where: { VoucherHeaderSid: firstSourceVoucherHeaderSid },
                    select: { voucherTypeMaster: { select: { DocumentTypeName: true } } },
                });
                documentTypeName = voucherHeader?.voucherTypeMaster?.DocumentTypeName?.trim() || null;
            }

            const cancellationWarnings: VoucherMatchingCancellationWarnings = {
                hasWarning: affectedVouchers.length > 0 || exchangeJVLinks.length > 0,
                documentTypeName,
                affectedVouchers,
                exchangeJVs: exchangeJVLinks
                    .map((item) => {
                        const voucherHeaderSid = toNumber(item.ExchangeJVHeaderSid);
                        const voucherNumber = String(item.exchangeJVVoucherHeader?.VoucherNumber ?? '').trim();
                        if (!voucherHeaderSid || !voucherNumber) {
                            return null;
                        }
                        return {
                            voucherHeaderSid,
                            voucherNumber,
                            voucherType: 'Journal Voucher',
                        };
                    })
                    .filter((item): item is VoucherMatchingCancellationWarnings['exchangeJVs'][number] => !!item),
            };

            return {
                ...voucherMatchingHeader,
                COAMasterSid: ledgerIdInvolved!,
                LedgerName: ledgerRecord?.LedgerName,
                LedgerType: ledgerRecord?.LedgerType,
                SubledgerMasterSid: subledgerInvolved!,
                MatchingDetail: enrichedDetails,
                cancellationWarnings,
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

        // Authorize-before-post (menu-scoped; auto-posting types are exempt).
        // VoucherMatchingHeader carries no VoucherTypeMasterSid, so resolve its voucher type the
        // same way create() does — by DocumentTypeCode — to reach MenuMasterSid / IsAutoPosting.
        const matchingVoucherType = await tx.voucherTypeMaster.findFirst({
            where: {
                DocumentTypeCode: DOC_TYPE_CODE.VOUCHER_MATCHING,
                CompanyMasterSid: CompanyMasterSid,
                BranchMasterSid: BranchMasterSid,
                status: 'A',
            },
            select: { MenuMasterSid: true, IsAutoPosting: true },
        });
        await this.voucherAuthorizationService.ensureAuthorizedToPost({
            documentSid: voucherMatchingHeader.VoucherMatchingHeaderSid,
            menuMasterSid: matchingVoucherType?.MenuMasterSid,
            isAutoPosting: matchingVoucherType?.IsAutoPosting,
            companyMasterSid: CompanyMasterSid,
            branchMasterSid: BranchMasterSid,
            documentLabel: 'voucher matching'
        });

        const { MatchingDetail, ...matchingHeader } = voucherMatchingHeader;

        if (MatchingDetail.length === 0) {
            throw new BadRequestException('No Voucher Matching Details found for this Voucher Matching Header.');
        }

        const ledgerInvolved = MatchingDetail[0].VoucherTransaction.COAMasterSid;

        if (!ledgerInvolved) {
            throw new BadRequestException('Ledger not found for this voucher');
        }

        const coaRecord = await this._db.cOAMaster.findUnique({
            where: {
                COAMasterSid: ledgerInvolved,
                Status: 'A'
            }, select: {
                LedgerType: true
            }
        })

        if (!coaRecord) {
            throw new BadRequestException('Chart of Accounts not found.');
        }
        if (!coaRecord.LedgerType) {
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
            throw new BadRequestException('VoucherMatching Voucher Type is not found. Please configure it in the Document Type Master.');
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

        let exchangeJVData: { jvHeader: VoucherHeader; partyTransaction: any | null } | undefined;
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
                        where: { CurrencyMasterSid: currencySet.values().next().value },
                        select: {
                            CurrencyMasterSid: true,
                            currencyCode: true
                        }
                    })

                    if (!currentInvolved) {
                        throw new BadRequestException('Party Currency not found in matching details.');
                    }

                    exchangeJVData = await this.createExchangeJvForMatching(tx, {
                        sumOfLocalCredits,
                        sumOfLocalDebits,
                        LedgerType: coaRecord?.LedgerType,
                        CompanyMasterSid,
                        BranchMasterSid,
                        YearMasterSid,
                        PartyCurrency: currentInvolved?.CurrencyMasterSid,
                        PartyCurrencyCode: currentInvolved?.currencyCode,
                        LocalCurrencyMasterSid,
                        LocalCurrencyCode,
                        partyLedgerSid,
                        partySubledgerSid,
                        voucherMatchingHeaderSid: VoucherMatchingHeaderSid,
                        voucherMatchingNo: voucherMatchingHeader.VoucherMatchingNo,
                        matchingDate: current_date,
                        postedBy,
                    });

                    // Persist Exchange JV <-> VoucherMatchingHeader link
                    await tx.voucherMatchingExchangeJV.create({
                        data: {
                            CompanyMasterSid,
                            BranchMasterSid,
                            VoucherMatchingHeaderSid,
                            ExchangeJVHeaderSid: exchangeJVData.jvHeader.VoucherHeaderSid,
                            CreatedBy: postedBy,
                            UpdatedOn: new Date(),
                        }
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

        // ─── Fetch currency decimal precision ─────────────────────────────────────
        // Collect all unique CurrencyMasterSid values (MatchingCurrency) + local currency
        const allCurrencySids = new Set<number>();
        allCurrencySids.add(LocalCurrencyMasterSid);
        for (const md of allValidMatchingDetail) {
            if (md.MatchingCurrency) allCurrencySids.add(toNumber(md.MatchingCurrency));
        }
        const currencyRecords = await tx.currencyMaster.findMany({
            where: { CurrencyMasterSid: { in: Array.from(allCurrencySids) } },
            select: { CurrencyMasterSid: true, amountDecimal: true },
        });
        const currencyDecimalMap = new Map<number, number>();
        for (const cr of currencyRecords) {
            currencyDecimalMap.set(cr.CurrencyMasterSid, cr.amountDecimal ?? 2);
        }
        const localDecimal = currencyDecimalMap.get(LocalCurrencyMasterSid) ?? 2;

        const roundByCurrency = (value: number, currencyMasterSid: number | null | undefined): number => {
            const decimals = currencyMasterSid ? (currencyDecimalMap.get(toNumber(currencyMasterSid)) ?? 2) : 2;
            return Number(value.toFixed(decimals));
        };

        // ─── Local Amount Based Matching (FIFO) ──────────────────────────────────
        // Matches Source entries against Object entries sequentially based on LocalAmount.
        // For each pair: matchedLocal = MIN(sourceRemainingLocal, objectRemainingLocal)
        // Amount is derived from LocalAmount using ExRate: amountUsed = matchedLocal / exRate
        // Precision is determined by each currency's amountDecimal from CurrencyMaster.
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
        const objectQueue = objectMds.map(o => ({
            ...o,
            remainingAmount: toNumber(o.MatchingAmount),
            remainingLocalAmount: toNumber(o.MatchingLocalAmount),
        }));

        const pairs: Array<{
            pairSno: number;
            objectMd: typeof objectQueue[0];
            sourceMd: typeof sourceQueue[0];
            sourceAmount: number;
            objectAmount: number;
            sourceLocalAmount: number;
            objectLocalAmount: number;
        }> = [];
        let pairSno = 1;

        let srcIdx = 0;
        let objIdx = 0;

        while (srcIdx < sourceQueue.length && objIdx < objectQueue.length) {
            const src = sourceQueue[srcIdx];
            const obj = objectQueue[objIdx];

            if (src.remainingLocalAmount <= 0) { srcIdx++; continue; }
            if (obj.remainingLocalAmount <= 0) { objIdx++; continue; }

            const matchedLocal = roundByCurrency(
                Math.min(src.remainingLocalAmount, obj.remainingLocalAmount),
                LocalCurrencyMasterSid
            );
            if (matchedLocal <= 0) { srcIdx++; continue; }

            // Derive currency amount from local amount using exchange rate
            const srcExRate = toNumber(src.ExchangeRate ?? src.MatchingExRate) || 1;
            const objExRate = toNumber(obj.ExchangeRate ?? obj.MatchingExRate) || 1;

            // If this consumes the entire remaining local, use the remaining amount directly to avoid rounding drift
            const sourceAmount = Math.abs(src.remainingLocalAmount - matchedLocal) < Math.pow(10, -localDecimal)
                ? src.remainingAmount
                : roundByCurrency(matchedLocal / srcExRate, src.MatchingCurrency);

            const objectAmount = Math.abs(obj.remainingLocalAmount - matchedLocal) < Math.pow(10, -localDecimal)
                ? obj.remainingAmount
                : roundByCurrency(matchedLocal / objExRate, obj.MatchingCurrency);

            pairs.push({
                pairSno,
                objectMd: obj,
                sourceMd: src,
                sourceAmount,
                objectAmount,
                sourceLocalAmount: matchedLocal,
                objectLocalAmount: matchedLocal,
            });

            src.remainingLocalAmount = roundByCurrency(src.remainingLocalAmount - matchedLocal, LocalCurrencyMasterSid);
            src.remainingAmount = roundByCurrency(src.remainingAmount - sourceAmount, src.MatchingCurrency);
            obj.remainingLocalAmount = roundByCurrency(obj.remainingLocalAmount - matchedLocal, LocalCurrencyMasterSid);
            obj.remainingAmount = roundByCurrency(obj.remainingAmount - objectAmount, obj.MatchingCurrency);

            pairSno++;
            if (src.remainingLocalAmount <= 0) srcIdx++;
            if (obj.remainingLocalAmount <= 0) objIdx++;
        }

        // ─── Post-pairing Local Amount Tally Check ──────────────────────────────
        // Verify that total paired source local amount equals total paired object local amount.
        const totalPairedSourceLocal = roundByCurrency(
            pairs.reduce((sum, p) => sum + p.sourceLocalAmount, 0),
            LocalCurrencyMasterSid
        );
        const totalPairedObjectLocal = roundByCurrency(
            pairs.reduce((sum, p) => sum + p.objectLocalAmount, 0),
            LocalCurrencyMasterSid
        );
        if (totalPairedSourceLocal !== totalPairedObjectLocal) {
            throw new BadRequestException(
                `Local Amount do not tally after pairing. Source total: ${totalPairedSourceLocal}, Object total: ${totalPairedObjectLocal}. Please review matching amounts.`
            );
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
                Amount: pair.sourceAmount,
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
                Amount: pair.objectAmount,
                LocalAmount: pair.objectLocalAmount,
                MatchingType: 'Object',
            });
        }

        // ─── Exchange JV Pairs (remaining amounts after FIFO) ──────────────────────
        if (exchangeJVData?.partyTransaction) {
            const remainingSources = sourceQueue.filter(s => s.remainingLocalAmount > 0);
            const remainingObjects = objectQueue.filter(o => o.remainingLocalAmount > 0);

            // Remaining Source ↔ Exchange JV as Object
            for (const src of remainingSources) {
                voucherMatchingPayload.push({
                    CreatedBy: postedBy, Status: 'A', CompanyMasterSid, BranchMasterSid,
                    VoucherMatchingHeaderSid,
                    VoucherHeaderSid: src.VoucherHeaderSid,
                    VoucherDetailSid: src.VoucherDetailSid,
                    VoucherTransactionSid: src.VoucherTransactionSid,
                    MatchingTransactionSid: exchangeJVData.partyTransaction.VoucherTransactionSid,
                    VoucherMatchingDate: voucherMatchingHeader.VoucherMatchingDate,
                    VoucherType: src.VoucherTransaction?.VoucherTypeMasterSid,
                    Sno: pairSno,
                    COAMasterSid: src.VoucherTransaction?.COAMasterSid,
                    LedgerMasterSid: src.VoucherTransaction?.LedgerMasterSid,
                    CurrencyCode: src.CurrencyCode,
                    ExchangeRate: src.ExchangeRate ?? src.MatchingExRate,
                    DrCr: src.DrCr,
                    Amount: src.remainingAmount,
                    LocalAmount: src.remainingLocalAmount,
                    MatchingType: 'Source',
                });
                voucherMatchingPayload.push({
                    CreatedBy: postedBy, Status: 'A', CompanyMasterSid, BranchMasterSid,
                    VoucherMatchingHeaderSid,
                    VoucherHeaderSid: exchangeJVData.partyTransaction.VoucherHeaderSid,
                    VoucherDetailSid: exchangeJVData.partyTransaction.VoucherDetailSid,
                    VoucherTransactionSid: exchangeJVData.partyTransaction.VoucherTransactionSid,
                    MatchingTransactionSid: src.VoucherTransactionSid,
                    VoucherMatchingDate: voucherMatchingHeader.VoucherMatchingDate,
                    VoucherType: exchangeJVData.partyTransaction.VoucherTypeMasterSid,
                    Sno: pairSno,
                    COAMasterSid: exchangeJVData.partyTransaction.COAMasterSid,
                    LedgerMasterSid: exchangeJVData.partyTransaction.LedgerMasterSid,
                    CurrencyCode: src.CurrencyCode,
                    ExchangeRate: toNumber(exchangeJVData.partyTransaction.ExchangeRate) || 1,
                    DrCr: exchangeJVData.partyTransaction.DrCr,
                    Amount: 0,
                    LocalAmount: src.remainingLocalAmount,
                    MatchingType: 'Object',
                });
                pairSno++;
            }

            // Remaining Object ↔ Exchange JV as Source (symmetric case)
            for (const obj of remainingObjects) {
                voucherMatchingPayload.push({
                    CreatedBy: postedBy, Status: 'A', CompanyMasterSid, BranchMasterSid,
                    VoucherMatchingHeaderSid,
                    VoucherHeaderSid: exchangeJVData.partyTransaction.VoucherHeaderSid,
                    VoucherDetailSid: exchangeJVData.partyTransaction.VoucherDetailSid,
                    VoucherTransactionSid: exchangeJVData.partyTransaction.VoucherTransactionSid,
                    MatchingTransactionSid: obj.VoucherTransactionSid,
                    VoucherMatchingDate: voucherMatchingHeader.VoucherMatchingDate,
                    VoucherType: exchangeJVData.partyTransaction.VoucherTypeMasterSid,
                    Sno: pairSno,
                    COAMasterSid: exchangeJVData.partyTransaction.COAMasterSid,
                    LedgerMasterSid: exchangeJVData.partyTransaction.LedgerMasterSid,
                    CurrencyCode: obj.CurrencyCode,
                    ExchangeRate: toNumber(exchangeJVData.partyTransaction.ExchangeRate) || 1,
                    DrCr: exchangeJVData.partyTransaction.DrCr,
                    Amount: 0,
                    LocalAmount: obj.remainingLocalAmount,
                    MatchingType: 'Source',
                });
                voucherMatchingPayload.push({
                    CreatedBy: postedBy, Status: 'A', CompanyMasterSid, BranchMasterSid,
                    VoucherMatchingHeaderSid,
                    VoucherHeaderSid: obj.VoucherHeaderSid,
                    VoucherDetailSid: obj.VoucherDetailSid,
                    VoucherTransactionSid: obj.VoucherTransactionSid,
                    MatchingTransactionSid: exchangeJVData.partyTransaction.VoucherTransactionSid,
                    VoucherMatchingDate: voucherMatchingHeader.VoucherMatchingDate,
                    VoucherType: obj.VoucherTransaction?.VoucherTypeMasterSid,
                    Sno: pairSno,
                    COAMasterSid: obj.VoucherTransaction?.COAMasterSid,
                    LedgerMasterSid: obj.VoucherTransaction?.LedgerMasterSid,
                    CurrencyCode: obj.CurrencyCode,
                    ExchangeRate: obj.ExchangeRate ?? obj.MatchingExRate,
                    DrCr: obj.DrCr,
                    Amount: obj.remainingAmount,
                    LocalAmount: obj.remainingLocalAmount,
                    MatchingType: 'Object',
                });
                pairSno++;
            }
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
                UpdatedOn: new Date()
            }
        });

        return {
            ...voucherMatchingHeader,
            PostStatus: 'P',
            PostDate: current_date,
            VoucherMatching: allVoucherMatchings,
            ...(exchangeJVData?.jvHeader ? { ExchangeJV: exchangeJVData.jvHeader } : {}),
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
        const narration = `Being the difference of ${params.voucherMatchingNo}`;

        // 1. Get Exchange Rate Mismatch Ledger from company config
        const exchangeRateLedgerSid = toNumber(await this.companyConfigService.getConfigurationValue(params.CompanyMasterSid, 'ExchangeJVCOA'));
        if (!exchangeRateLedgerSid) {
            throw new BadRequestException('Exchange Rate Mismatch Ledger not configured. Please configure it in Company Configuration.');
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
                UpdatedOn : new Date(),
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

        // 8. Fetch the Exchange JV party transaction (to be paired in FIFO logic)
        const partyTransaction = await tx.voucherTransaction.findFirst({
            where: {
                VoucherHeaderSid: jvHeader.VoucherHeaderSid,
                COAMasterSid: params.partyLedgerSid,
            },
        });

        return { jvHeader, partyTransaction };
    }

    /**
     * Creates a reversal JV for an Exchange JV, then creates & posts a Voucher Matching
     * between the original and reversal JVs to zero out the exchange difference.
     */
    private async reverseExchangeJV(
        tx: Prisma.TransactionClient,
        params: {
            originalJVHeaderSid: number;
            CompanyMasterSid: number;
            BranchMasterSid: number;
            YearMasterSid: number;
            LocalCurrencyMasterSid: number;
            LocalCurrencyCode: string;
            cancelledBy: string;
        },
    ) {
        // Step A — Create Reversal JV

        // A.1 Fetch original Exchange JV header + details
        const originalJV = await tx.voucherHeader.findUnique({
            where: { VoucherHeaderSid: params.originalJVHeaderSid },
        });
        if (!originalJV) {
            throw new BadRequestException(`Exchange JV header ${params.originalJVHeaderSid} not found.`);
        }

        const originalDetails = await tx.voucherDetail.findMany({
            where: { VoucherHeaderSid: params.originalJVHeaderSid, Status: 'A' },
        });

        // A.2 Get JV VoucherTypeMaster
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

        // A.3 Generate reversal JV number
        const now = new Date();
        const reversalJVNumber = await this.voucherService.generateVoucherNumberFromConfig(
            jvVoucherType, params.CompanyMasterSid, params.BranchMasterSid,
            params.YearMasterSid, tx, now,
        );

        // A.4 Create reversal VoucherHeader
        const reversalHeader = await tx.voucherHeader.create({
            data: {
                VoucherNumber: reversalJVNumber,
                VoucherDate: now,
                PostDate: now,
                VoucherType: jvVoucherType.VoucherTypeMasterSid,
                Narration: `Reversal of ${originalJV.VoucherNumber}`,
                CompanyMasterSid: params.CompanyMasterSid,
                BranchMasterSid: params.BranchMasterSid,
                VoucherTypeMasterSid: jvVoucherType.VoucherTypeMasterSid,
                PostStatus: 'P',
                Amount: toNumber(originalJV.Amount),
                LocalAmount: toNumber(originalJV.LocalAmount),
                NetAmount: toNumber(originalJV.NetAmount),
                PartyMasterSid: originalJV.PartyMasterSid,
                COAMasterSid: originalJV.COAMasterSid,
                CurrencyMasterSid: originalJV.CurrencyMasterSid,
                CurrencyCode: originalJV.CurrencyCode,
                ExchangeRate: toNumber(originalJV.ExchangeRate) || 1,
                ReversalVoucher: params.originalJVHeaderSid,
                Status: 'A',
                UpdatedOn: now,
                CreatedBy: params.cancelledBy,
            },
        });

        // A.5 Create mirrored VoucherDetail rows with flipped DrCr
        const reversalDetails: any[] = [];
        for (const detail of originalDetails) {
            const flippedDrCr = detail.DrCr === 'D' ? 'C' : 'D';
            const reversalDetail = await tx.voucherDetail.create({
                data: {
                    CompanyMasterSid: params.CompanyMasterSid,
                    BranchMasterSid: params.BranchMasterSid,
                    VoucherHeaderSid: reversalHeader.VoucherHeaderSid,
                    Sno: detail.Sno,
                    ChargeDescription: detail.ChargeDescription,
                    COAMasterSid: detail.COAMasterSid,
                    LedgerMasterSid: detail.LedgerMasterSid,
                    CurrencyMasterSid: detail.CurrencyMasterSid,
                    CurrencyCode: detail.CurrencyCode,
                    ExchangeRate: toNumber(detail.ExchangeRate) || 1,
                    Rate: toNumber(detail.Rate) || 0,
                    NumberOfUnit: toNumber(detail.NumberOfUnit) || 1,
                    Narration: `Reversal of ${originalJV.VoucherNumber}`,
                    DrCr: flippedDrCr,
                    Amount: toNumber(detail.Amount) || 0,
                    LocalAmount: toNumber(detail.LocalAmount) || 0,
                    PartyAmount: toNumber(detail.PartyAmount) || 0,
                    TaxableAmount: toNumber(detail.TaxableAmount) || 0,
                    YearMasterSid: params.YearMasterSid,
                    CreatedBy: params.cancelledBy,
                    Status: 'A',
                },
            });
            reversalDetails.push(reversalDetail);
        }

        // A.6 Create VoucherTransaction for each reversal detail
        for (const detail of reversalDetails) {
            await tx.voucherTransaction.create({
                data: {
                    CompanyMasterSid: params.CompanyMasterSid,
                    BranchMasterSid: params.BranchMasterSid,
                    VoucherHeaderSid: reversalHeader.VoucherHeaderSid,
                    VoucherDetailSid: detail.VoucherDetailSid,
                    VoucherNumber: reversalJVNumber,
                    VoucherType: jvVoucherType.VoucherTypeMasterSid,
                    VoucherDate: now,
                    GST_VAT: '',
                    Rate: toNumber(detail.Rate) || toNumber(detail.LocalAmount) || 0,
                    NumberOfUnit: 1,
                    PostDate: now,
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
                    CreatedBy: params.cancelledBy,
                    CreatedOn: now,
                },
            });
        }

        // A.7 Fetch the reversal party transaction (subledger line)
        const reversalPartyTx = await tx.voucherTransaction.findFirst({
            where: {
                VoucherHeaderSid: reversalHeader.VoucherHeaderSid,
                LedgerMasterSid: originalJV.PartyMasterSid,
            },
        });

        // Step B — Create & Post Voucher Matching between Original and Reversal JVs

        // B.1 Get VM VoucherTypeMaster
        const vmVoucherType = await tx.voucherTypeMaster.findFirst({
            where: {
                DocumentTypeCode: DOC_TYPE_CODE.VOUCHER_MATCHING,
                CompanyMasterSid: params.CompanyMasterSid,
                BranchMasterSid: params.BranchMasterSid,
                status: 'A',
            },
        });
        if (!vmVoucherType) {
            throw new BadRequestException('Voucher Matching type not found for this company/branch.');
        }

        // B.2 Generate matching number
        const vmNumber = await this.voucherService.generateVoucherMatchingNumber(
            vmVoucherType, params.CompanyMasterSid, params.BranchMasterSid,
            params.YearMasterSid, tx, now,
        );

        // B.3 Get subledger name for the header
        let subledgerName = '';
        if (originalJV.PartyMasterSid) {
            const subledger = await tx.subledgerMaster.findUnique({
                where: { SubledgerMasterSid: originalJV.PartyMasterSid },
                select: { SubledgerName: true },
            });
            subledgerName = subledger?.SubledgerName || '';
        }

        // B.4 Create VoucherMatchingHeader
        const vmHeader = await tx.voucherMatchingHeader.create({
            data: {
                VoucherMatchingNo: vmNumber,
                VoucherMatchingDate: now,
                CompanyMasterSid: params.CompanyMasterSid,
                BranchMasterSid: params.BranchMasterSid,
                PostStatus: 'U',
                Status: 'A',
                SubledgerName: subledgerName,
                Narration: `Reversal matching for ${originalJV.VoucherNumber}`,
                CreatedBy: params.cancelledBy,
                UpdatedOn: now,
            },
        });

        // B.5 Get party VoucherTransaction from original Exchange JV
        const originalPartyTx = await tx.voucherTransaction.findFirst({
            where: {
                VoucherHeaderSid: originalJV.VoucherHeaderSid,
                LedgerMasterSid: originalJV.PartyMasterSid,
            },
        });

        if (!originalPartyTx || !reversalPartyTx) {
            throw new BadRequestException('Party transaction not found on Exchange JV.');
        }

        // B.6 Determine Source (Debit side) and Object (Credit side)
        const debitTx = originalPartyTx.DrCr === 'D' ? originalPartyTx : reversalPartyTx;
        const creditTx = originalPartyTx.DrCr === 'C' ? originalPartyTx : reversalPartyTx;
        const debitDetail = originalPartyTx.DrCr === 'D'
            ? originalDetails.find(d => d.LedgerMasterSid === originalJV.PartyMasterSid)
            : reversalDetails.find(d => d.LedgerMasterSid === originalJV.PartyMasterSid);
        const creditDetail = originalPartyTx.DrCr === 'C'
            ? originalDetails.find(d => d.LedgerMasterSid === originalJV.PartyMasterSid)
            : reversalDetails.find(d => d.LedgerMasterSid === originalJV.PartyMasterSid);

        const diff = toNumber(debitTx.LocalAmount) || 0;

        // Create Source MatchingDetail (Debit side)
        await tx.matchingDetail.create({
            data: {
                VoucherMatchingHeaderSid: vmHeader.VoucherMatchingHeaderSid,
                VoucherHeaderSid: debitTx.VoucherHeaderSid,
                VoucherDetailSid: debitDetail?.VoucherDetailSid || debitTx.VoucherDetailSid,
                VoucherTransactionSid: debitTx.VoucherTransactionSid,
                VoucherType: String(jvVoucherType.VoucherTypeMasterSid),
                Sno: 1,
                CurrencyCode: debitTx.CurrencyCode,
                ExchangeRate: toNumber(debitTx.ExchangeRate) || 1,
                DrCr: 'D',
                Amount: toNumber(debitTx.Amount) || 0,
                LocalAmount: diff,
                MatchingAmount: 0,
                MatchingLocalAmount: diff,
                MatchingCurrency: params.LocalCurrencyMasterSid,
                MatchingExRate: 1,
                MatchingType: 'Source',
            },
        });

        // Create Object MatchingDetail (Credit side)
        await tx.matchingDetail.create({
            data: {
                VoucherMatchingHeaderSid: vmHeader.VoucherMatchingHeaderSid,
                VoucherHeaderSid: creditTx.VoucherHeaderSid,
                VoucherDetailSid: creditDetail?.VoucherDetailSid || creditTx.VoucherDetailSid,
                VoucherTransactionSid: creditTx.VoucherTransactionSid,
                VoucherType: String(jvVoucherType.VoucherTypeMasterSid),
                Sno: 2,
                CurrencyCode: creditTx.CurrencyCode,
                ExchangeRate: toNumber(creditTx.ExchangeRate) || 1,
                DrCr: 'C',
                Amount: toNumber(creditTx.Amount) || 0,
                LocalAmount: diff,
                MatchingAmount: 0,
                MatchingLocalAmount: diff,
                MatchingCurrency: params.LocalCurrencyMasterSid,
                MatchingExRate: 1,
                MatchingType: 'Object',
            },
        });

        // B.7 Post the reversal matching
        await this.postVoucherMatching({
            VoucherMatchingHeaderSid: vmHeader.VoucherMatchingHeaderSid,
            CompanyMasterSid: params.CompanyMasterSid,
            BranchMasterSid: params.BranchMasterSid,
            YearMasterSid: params.YearMasterSid,
            LocalCurrencyMasterSid: params.LocalCurrencyMasterSid,
            LocalCurrencyCode: params.LocalCurrencyCode,
            current_date: now,
            postedBy: params.cancelledBy,
        }, tx);
    }

    async enquireVoucher(dto: EnquireVoucherDto) {
        const { CompanyMasterSid, BranchMasterSid, LocalCurrencyMasterSid } = dto;
        const voucherNumber = dto.VoucherNumber?.trim();

        // 1. Find the voucher header
        const voucherHeader = await this._db.voucherHeader.findFirst({
            where: {
                VoucherNumber: { equals: voucherNumber, mode: 'insensitive' },
                CompanyMasterSid,
                BranchMasterSid,
                Status: 'A',
            },
        });

        if (!voucherHeader) {
            throw new BadRequestException(`Voucher "${voucherNumber}" not found`);
        }

        // 2. Party transactions — subledgerMaster.SubledgerType = 'Customer'
        // All scalar fields of VoucherTransaction are returned (COAMasterSid is available)
        const partyTransactions = await this._db.voucherTransaction.findMany({
            where: {
                VoucherHeaderSid: voucherHeader.VoucherHeaderSid,
                CompanyMasterSid,
                BranchMasterSid,
                Status: 'A',
                subledgerMaster: { SubledgerType: 'Customer' },
            },
            include: {
                subledgerMaster: { select: { SubledgerName: true } },
                voucherTypeMaster: { select: { DocumentTypeName: true, DocumentTypeCode: true } },
            },
        });

        if (partyTransactions.length === 0) {
            throw new BadRequestException(`No party transactions found for voucher "${voucherNumber}"`);
        }

        const partyTransactionSids = partyTransactions.map(t => t.VoucherTransactionSid);
        const partyName = partyTransactions[0]?.subledgerMaster?.SubledgerName ?? '';
        const partyCurrencyCode = partyTransactions[0]?.CurrencyCode ?? '';
        const voucherTypeName = partyTransactions[0]?.voucherTypeMaster?.DocumentTypeName ?? '';
        const voucherDocTypeCode = partyTransactions[0]?.voucherTypeMaster?.DocumentTypeCode ?? '';
        const partyCoaMasterSid = partyTransactions[0]?.COAMasterSid;

        // 3. Currency decimal lookups — one query; returns 1 row if local = party currency
        const currencyRecords = await this._db.currencyMaster.findMany({
            where: {
                OR: [
                    { CurrencyMasterSid: LocalCurrencyMasterSid },
                    { currencyCode: partyCurrencyCode },
                ],
            },
            select: { CurrencyMasterSid: true, currencyCode: true, amountDecimal: true, exchangeDecimal: true },
        });
        const localCurrRecord = currencyRecords.find(r => r.CurrencyMasterSid === LocalCurrencyMasterSid);
        const partyCurrRecord = currencyRecords.find(r => r.currencyCode === partyCurrencyCode) ?? localCurrRecord;
        const localCurrencyCode = localCurrRecord?.currencyCode ?? '';
        const localDecimals = localCurrRecord?.amountDecimal ?? 2;
        const partyDecimals = partyCurrRecord?.amountDecimal ?? 2;
        const partyExchangeDecimals = partyCurrRecord?.exchangeDecimal ?? 4;
        const voucherExchangeRate = toNumber(partyTransactions[0]?.ExchangeRate) || 1;

        // 4. Determine sign convention for DrCr summing:
        // JV/RJV: party DrCr depends on COAMaster.LedgerType (not fixed by config)
        //   'Sy Cr' typed ledger → party side is Credit ('C'); others → Debit ('D')
        // All other types: use PARTY_VTYPE_DRCR_MAP via getPartyDrCr
        let expectedPartyDrCr: string | undefined;
        if ((voucherDocTypeCode === 'JV' || voucherDocTypeCode === 'RJV') && partyCoaMasterSid) {
            const coaRecord = await this._db.cOAMaster.findUnique({
                where: { COAMasterSid: partyCoaMasterSid },
                select: { LedgerType: true },
            });
            expectedPartyDrCr = (coaRecord?.LedgerType ?? '').includes('Cr') ? 'C' : 'D';
        } else {
            expectedPartyDrCr = getPartyDrCr(voucherDocTypeCode);
        }

        // Party DrCr = +1; opposite (reversal/correction) = -1
        const signForDrCr = (drCr: string) =>
            expectedPartyDrCr ? (drCr === expectedPartyDrCr ? 1 : -1) : (drCr === 'D' ? 1 : -1);

        // 5. Original amounts — LocalAmount (local currency) and Amount (party currency) separately
        const originalLocalAmount = roundAmount(
            Math.abs(partyTransactions.reduce((sum, t) => sum + signForDrCr(t.DrCr) * toNumber(t.LocalAmount), 0)),
            localDecimals
        );
        const originalPartyAmount = roundAmount(
            Math.abs(partyTransactions.reduce((sum, t) => sum + signForDrCr(t.DrCr) * toNumber(t.Amount), 0)),
            partyDecimals
        );

        // 6. Active VoucherMatching rows for party transactions
        const activeMatchings = await this._db.voucherMatching.findMany({
            where: {
                VoucherTransactionSid: { in: partyTransactionSids },
                Status: 'A',
                CompanyMasterSid,
                BranchMasterSid,
            },
        });

        const totalMatchedLocalAmount = roundAmount(
            Math.abs(activeMatchings.reduce((sum, m) => sum + signForDrCr(m.DrCr) * toNumber(m.LocalAmount), 0)),
            localDecimals
        );
        const outstandingLocalAmount = roundAmount(originalLocalAmount - totalMatchedLocalAmount, localDecimals);

        // 7. VMH details for active matchings
        const uniqueVMHSids = [...new Set(activeMatchings.map(m => m.VoucherMatchingHeaderSid))];
        const vmHeaders = await this._db.voucherMatchingHeader.findMany({
            where: { VoucherMatchingHeaderSid: { in: uniqueVMHSids } },
            select: {
                VoucherMatchingHeaderSid: true,
                VoucherMatchingNo: true,
                VoucherMatchingDate: true,
                PostStatus: true,
                Status: true,
            },
        });
        const vmHeaderMap = new Map(vmHeaders.map(h => [h.VoucherMatchingHeaderSid, h]));

        // 8. Counter transactions and the complete VM composition
        const counterTxSids = [...new Set(
            activeMatchings.map(m => m.MatchingTransactionSid).filter((s): s is number => s != null)
        )];
        const counterTransactions = await this._db.voucherTransaction.findMany({
            where: { VoucherTransactionSid: { in: counterTxSids } },
            include: {
                VoucherHeader: { select: { VoucherHeaderSid: true, VoucherNumber: true } },
                voucherTypeMaster: { select: { DocumentTypeName: true, DocumentTypeCode: true } },
            },
        });
        const counterTxMap = new Map(counterTransactions.map(t => [t.VoucherTransactionSid, t]));

        const allRowsForActiveHeaders = await this._db.voucherMatching.findMany({
            where: {
                VoucherMatchingHeaderSid: { in: uniqueVMHSids },
                Status: 'A',
                CompanyMasterSid,
                BranchMasterSid,
            },
            include: {
                VoucherTransaction: {
                    include: {
                        VoucherHeader: { select: { VoucherHeaderSid: true, VoucherNumber: true } },
                        voucherTypeMaster: { select: { DocumentTypeName: true, DocumentTypeCode: true } },
                    },
                },
            },
            orderBy: [
                { VoucherMatchingHeaderSid: 'asc' },
                { Sno: 'asc' },
                { VoucherMatchingSid: 'asc' },
            ],
        });

        // 9. Group by VMH and build rows
        const matchingsByVMH = new Map<number, typeof activeMatchings>();
        for (const m of activeMatchings) {
            const arr = matchingsByVMH.get(m.VoucherMatchingHeaderSid) ?? [];
            arr.push(m);
            matchingsByVMH.set(m.VoucherMatchingHeaderSid, arr);
        }

        const allRowsByVMH = new Map<number, any[]>();
        for (const row of allRowsForActiveHeaders) {
            const arr = allRowsByVMH.get(row.VoucherMatchingHeaderSid) ?? [];
            arr.push(row);
            allRowsByVMH.set(row.VoucherMatchingHeaderSid, arr);
        }

        const buildVoucherSummaries = (rows: any[], matchingType: 'Source' | 'Object') => {
            const voucherMap = new Map<number, any>();
            for (const row of rows) {
                if (row.MatchingType !== matchingType) continue;

                const txHeader = row.VoucherTransaction?.VoucherHeader;
                const voucherHeaderSid = txHeader?.VoucherHeaderSid ?? row.VoucherHeaderSid;
                if (!voucherHeaderSid) continue;

                const current = voucherMap.get(voucherHeaderSid) ?? {
                    voucherHeaderSid,
                    voucherNumber: txHeader?.VoucherNumber ?? row.VoucherTransaction?.VoucherNumber ?? '',
                    voucherType: row.VoucherTransaction?.voucherTypeMaster?.DocumentTypeName ?? '',
                    voucherTypeCode: row.VoucherTransaction?.voucherTypeMaster?.DocumentTypeCode ?? '',
                    matchingType,
                    currencyCode: row.CurrencyCode,
                    matchedPartyAmount: 0,
                    matchedLocalAmount: 0,
                };

                current.matchedPartyAmount = roundAmount(current.matchedPartyAmount + Math.abs(toNumber(row.Amount)), partyDecimals);
                current.matchedLocalAmount = roundAmount(current.matchedLocalAmount + Math.abs(toNumber(row.LocalAmount)), localDecimals);
                voucherMap.set(voucherHeaderSid, current);
            }

            return Array.from(voucherMap.values());
        };

        const buildCounterSummaries = (rows: typeof activeMatchings) => {
            const voucherMap = new Map<number, any>();
            for (const row of rows) {
                const counterTx = row.MatchingTransactionSid ? counterTxMap.get(row.MatchingTransactionSid) : null;
                const counterHeader = counterTx?.VoucherHeader;
                const voucherHeaderSid = counterHeader?.VoucherHeaderSid ?? counterTx?.VoucherHeaderSid;
                if (!voucherHeaderSid || voucherHeaderSid === voucherHeader.VoucherHeaderSid) continue;

                const current = voucherMap.get(voucherHeaderSid) ?? {
                    voucherHeaderSid,
                    voucherNumber: counterHeader?.VoucherNumber ?? counterTx?.VoucherNumber ?? '',
                    voucherType: counterTx?.voucherTypeMaster?.DocumentTypeName ?? '',
                    voucherTypeCode: counterTx?.voucherTypeMaster?.DocumentTypeCode ?? '',
                    currencyCode: row.CurrencyCode,
                    matchedPartyAmount: 0,
                    matchedLocalAmount: 0,
                };

                current.matchedPartyAmount = roundAmount(current.matchedPartyAmount + Math.abs(toNumber(row.Amount)), partyDecimals);
                current.matchedLocalAmount = roundAmount(current.matchedLocalAmount + Math.abs(toNumber(row.LocalAmount)), localDecimals);
                voucherMap.set(voucherHeaderSid, current);
            }

            return Array.from(voucherMap.values());
        };

        const matchings = uniqueVMHSids.map(vmhSid => {
            const vmh = vmHeaderMap.get(vmhSid);
            const rows = matchingsByVMH.get(vmhSid) ?? [];
            const allRows = allRowsByVMH.get(vmhSid) ?? [];
            const firstRow = rows[0];
            const rowCurrencyCode = firstRow?.CurrencyCode ?? partyCurrencyCode;
            const counterVouchers = buildCounterSummaries(rows);
            const sourceVouchers = buildVoucherSummaries(allRows, 'Source');
            const objectVouchers = buildVoucherSummaries(allRows, 'Object');
            const primaryCounter = counterVouchers[0];

            const sumMatchedLocal = roundAmount(
                Math.abs(rows.reduce((sum, r) => sum + signForDrCr(r.DrCr) * toNumber(r.LocalAmount), 0)),
                localDecimals
            );
            const sumMatchedPartyAmount = roundAmount(
                Math.abs(rows.reduce((sum, r) => sum + signForDrCr(r.DrCr) * toNumber(r.Amount), 0)),
                partyDecimals
            );

            return {
                VoucherMatchingHeaderSid: vmhSid,
                VoucherMatchingNo: vmh?.VoucherMatchingNo ?? '',
                VoucherMatchingDate: vmh?.VoucherMatchingDate ?? null,
                PostStatus: vmh?.PostStatus ?? 'U',
                Status: vmh?.Status ?? 'A',
                MatchingType: firstRow?.MatchingType ?? '',
                counterVoucherHeaderSid: primaryCounter?.voucherHeaderSid ?? null,
                counterVoucherNumber: counterVouchers.map(v => v.voucherNumber).filter(Boolean).join(', '),
                counterVoucherType: [...new Set(counterVouchers.map(v => v.voucherType).filter(Boolean))].join(', '),
                counterVouchers,
                sourceVouchers,
                objectVouchers,
                sourceVoucherCount: sourceVouchers.length,
                objectVoucherCount: objectVouchers.length,
                matchedLocalAmount: sumMatchedLocal,
                matchedPartyAmount: sumMatchedPartyAmount,
                currencyCode: rowCurrencyCode,
            };
        });

        // 10. Cancelled VMH headers for this voucher
        const cancelledHeaders = await this._db.voucherMatchingHeader.findMany({
            where: {
                VoucherHeaderSid: voucherHeader.VoucherHeaderSid,
                CompanyMasterSid,
                BranchMasterSid,
                Status: 'S',
            },
            select: {
                VoucherMatchingHeaderSid: true,
                VoucherMatchingNo: true,
                VoucherMatchingDate: true,
                UpdatedOn: true,
            },
        });

        // 11. Insight — contribution % per VMH by local amount
        const insightDivisor = totalMatchedLocalAmount || 1;
        const insight = matchings.map(m => ({
            VoucherMatchingNo: m.VoucherMatchingNo,
            VoucherMatchingHeaderSid: m.VoucherMatchingHeaderSid,
            matchedLocalAmount: m.matchedLocalAmount,
            contributionPercent: roundAmount((m.matchedLocalAmount / insightDivisor) * 100, 1),
        }));

        return {
            voucherDetails: {
                VoucherHeaderSid: voucherHeader.VoucherHeaderSid,
                VoucherNumber: voucherHeader.VoucherNumber,
                VoucherType: voucherTypeName,
                VoucherDate: voucherHeader.VoucherDate,
                PostStatus: voucherHeader.PostStatus,
                Narration: voucherHeader.Narration ?? null,
                partyName,
                currencyCode: partyCurrencyCode,
                localCurrencyCode,
                exchangeRate: voucherExchangeRate,
                exchangeDecimal: partyExchangeDecimals,
                originalLocalAmount,
                originalPartyAmount,
            },
            stats: {
                originalLocalAmount,
                totalMatchedLocalAmount,
                outstandingLocalAmount,
                localCurrencyCode,
                exchangeDecimal: partyExchangeDecimals,
                matchingCount: uniqueVMHSids.length,
                cancelledCount: cancelledHeaders.length,
                sourceVoucherCount: new Set(matchings.flatMap(m => m.sourceVouchers.map(v => v.voucherHeaderSid))).size,
                objectVoucherCount: new Set(matchings.flatMap(m => m.objectVouchers.map(v => v.voucherHeaderSid))).size,
            },
            matchings,
            cancelledMatchings: cancelledHeaders,
            insight,
        };
    }

    async cancelVoucherMatching(dto: CancelVoucherMatchingDto) {
        const { VoucherMatchingHeaderSid, cancelledBy } = dto;

        // 1. Validate header exists, is Active, and is Posted
        const header = await this._db.voucherMatchingHeader.findUnique({
            where: { VoucherMatchingHeaderSid },
        });

        if (!header) {
            throw new BadRequestException('Voucher Matching Header not found');
        }
        if (header.Status !== 'A') {
            throw new BadRequestException('Voucher Matching is not in Active status');
        }
        if (header.PostStatus !== 'P') {
            throw new BadRequestException('Voucher Matching is not Posted');
        }

        // 2. Wrap in transaction
        const result = await this._db.$transaction(async (tx) => {
            // 2a. Delete VoucherMatching rows (detail lines)
            await tx.voucherMatching.deleteMany({
                where: { VoucherMatchingHeaderSid },
            });

            // 2b. Delete MatchingDetail rows
            await tx.matchingDetail.deleteMany({
                where: { VoucherMatchingHeaderSid },
            });

            // 2c. Reverse any Exchange JVs linked to this matching
            const exchangeJVLinks = await tx.voucherMatchingExchangeJV.findMany({
                where: { VoucherMatchingHeaderSid, Status: 'A' },
            });

            for (const link of exchangeJVLinks) {
                await this.reverseExchangeJV(tx, {
                    originalJVHeaderSid: link.ExchangeJVHeaderSid,
                    CompanyMasterSid: dto.CompanyMasterSid,
                    BranchMasterSid: dto.BranchMasterSid,
                    YearMasterSid: dto.YearMasterSid,
                    LocalCurrencyMasterSid: dto.LocalCurrencyMasterSid,
                    LocalCurrencyCode: dto.LocalCurrencyCode,
                    cancelledBy,
                });

                // Suspend the link record
                await tx.voucherMatchingExchangeJV.update({
                    where: { VoucherMatchingExchangeJVSid: link.VoucherMatchingExchangeJVSid },
                    data: { Status: 'S', UpdatedBy: cancelledBy, UpdatedOn: new Date() },
                });
            }

            // 2d. Update VoucherMatchingHeader: Status = 'S' (Suspended)
            const updatedHeader = await tx.voucherMatchingHeader.update({
                where: { VoucherMatchingHeaderSid },
                data: {
                    Status: 'S',
                    UpdatedBy: cancelledBy,
                    UpdatedOn: new Date(),
                },
            });

            return updatedHeader;
        }, {
            timeout: 60000,
        });

        return result;
    }
}
