import { BadRequestException, Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { DatabaseService } from 'src/database/database.service';
import { filterDto } from 'src/masters/DTO/search-vessel.dto';
import { Prisma, VoucherHeader } from '@prisma/client';
import { statusWhereClause, toNumber } from 'src/common/helper';
import { VoucherService } from '../voucher/voucher.service';
import { SearchPostedVouchersDto, CreateStandaloneVoucherMatchingDto, UpdateStandaloneVoucherMatchingDto, FetchVoucherMatchingByIdDto, PostVoucherMatchingDto, CreateVoucherMatchingResponse, FetchVoucherMatchingResponse, PostVoucherMatchingResponse } from 'src/accounts/dto/voucher-matching.dto';
import { DOC_TYPE_CODE } from 'src/common/config/voucher-type.config';

@Injectable()
export class VoucherMatchingService {
    constructor(
        private _db: DatabaseService,
        private logger: Logger,
        private voucherService: VoucherService,
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
        const { CompanyMasterSid, BranchMasterSid, VoucherType, search = '', page = 1, pageSize = 20 } = params;
        const skip = (page - 1) * pageSize;

        const where: Prisma.VoucherHeaderWhereInput = {
            Status: 'A',
            PostStatus: 'P',
            CompanyMasterSid,
            BranchMasterSid,
            voucherTypeMaster: {
                DocumentTypeName: VoucherType,
            },
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
                        Amount: detail.Amount,
                        LocalAmount: detail.LocalAmount,
                        PartyAmount: detail.PartyAmount,
                        SourceVoucherHeaderSid: detail.SourceVoucherHeaderSid,
                        VoucherMatchingHeaderSid: createdVoucherMatching.VoucherMatchingHeaderSid,
                        MatchingCurrency: detail.MatchingCurrency,
                        MatchingExRate: detail.MatchingExRate,
                        MatchingAmount: detail.MatchingAmount,
                        MatchingLocalAmount: detail.MatchingLocalAmount,
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
                                BranchName: detail.BranchName,
                                VoucherHeaderSid: detail.VoucherHeaderSid,
                                VoucherDetailSid: detail.VoucherDetailSid,
                                VoucherTransactionSid: detail.VoucherTransactionSid,
                                VoucherType: detail.VoucherType,
                                CurrencyCode: detail.CurrencyCode,
                                ExchangeRate: detail.ExchangeRate,
                                DrCr: detail.DrCr,
                                Amount: detail.Amount,
                                LocalAmount: detail.LocalAmount,
                                PartyAmount: detail.PartyAmount,
                                SourceVoucherHeaderSid: detail.SourceVoucherHeaderSid,
                                MatchingCurrency: detail.MatchingCurrency,
                                MatchingExRate: detail.MatchingExRate,
                                MatchingAmount: detail.MatchingAmount,
                                MatchingLocalAmount: detail.MatchingLocalAmount,
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
                                BranchName: detail.BranchName,
                                VoucherHeaderSid: detail.VoucherHeaderSid,
                                VoucherDetailSid: detail.VoucherDetailSid,
                                VoucherTransactionSid: detail.VoucherTransactionSid,
                                VoucherType: detail.VoucherType,
                                CurrencyCode: detail.CurrencyCode,
                                ExchangeRate: detail.ExchangeRate,
                                DrCr: detail.DrCr,
                                Amount: detail.Amount,
                                LocalAmount: detail.LocalAmount,
                                PartyAmount: detail.PartyAmount,
                                SourceVoucherHeaderSid: detail.SourceVoucherHeaderSid,
                                VoucherMatchingHeaderSid: payload.VoucherMatchingHeaderSid,
                                MatchingCurrency: detail.MatchingCurrency,
                                MatchingExRate: detail.MatchingExRate,
                                MatchingAmount: detail.MatchingAmount,
                                MatchingLocalAmount: detail.MatchingLocalAmount,
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
                },
                include: {
                    MatchingDetail: {
                        include: {
                            VoucherTransaction: true
                        }
                    }
                }
            });

            if (!voucherMatchingHeader) {
                throw new BadRequestException('Voucher Matching Header not found');
            }

            const allMatchingDetail = voucherMatchingHeader.MatchingDetail || [];
            const enrichedDetails = await Promise.all(allMatchingDetail.map(async (md, index) => {
                const outstanding = await this.voucherService.getOutstandingAmount(md.VoucherTransactionSid);
                const transaction = md.VoucherTransaction || {};
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
                    MatchingCurrencyAmount: md.MatchingAmount ?? 0,
                    MatchingLocalAmount: md.MatchingLocalAmount ?? 0,
                    MatchingTDSAmount: md.MatchingTDSAmount ?? 0,
                    MatchingType: md.MatchingType
                }
            }))

            return {
                ...voucherMatchingHeader,
                MatchingDetail: enrichedDetails,
            }

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
                                VoucherTypeMasterSid: true,
                                COAMasterSid: true,
                                LedgerMasterSid: true,
                                voucherMatchings: true
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

        let exchangeJVHeader: VoucherHeader;
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
                // Check if the Local Amount is same
                const sourceMatchingLocalAmount = Number(allValidMatchingDetail.filter(md => md.MatchingType === 'Source').reduce((acc, md) => acc + (toNumber(md.MatchingLocalAmount) || 0), 0).toFixed(2));
                const objectMatchingLocalAmount = Number(allValidMatchingDetail.filter(md => md.MatchingType === 'Object').reduce((acc, md) => acc + (toNumber(md.MatchingLocalAmount) || 0), 0).toFixed(2));
                if (sourceMatchingLocalAmount !== objectMatchingLocalAmount) {
                    // then pass an Exchange JV
                    throw new BadRequestException('Exchange JV need to pass - Work in Progress.')
                    //TODO
                    // exchangeJvHeader = await this.createExchangeJvForMatching(
                    //     tx,
                    //     dto,
                    //     voucherMatchingHeaderSid,
                    //     yearMasterSid,
                    //     LocalCurrencyMasterSid,
                    //     LocalCurrencyCode,
                    //     current_date,
                    //     postedBy
                    // )
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

        // Check if any transaction is already full matched or the amount exceeds
        // Optimize loops by fetching outstanding amounts concurrently
        const outstandingAmounts = await Promise.all(
            allValidMatchingDetail.map(async (md) => {
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

            const matchAmount = Number(toNumber(md.MatchingAmount).toFixed(2));
            const matchLocalAmount = Number(toNumber(md.MatchingLocalAmount).toFixed(2));
            const outAmount = Number(out.OutstandingAmount.toFixed(2));
            const outLocalAmount = Number(out.OutstandingLocalAmount.toFixed(2));

            if (matchAmount > outAmount || matchLocalAmount > outLocalAmount) {
                throw new BadRequestException(
                    `Matched Amount exceeds Outstanding Amount. Please refresh the screen to get Current Outstanding of the Voucher : ${out.VoucherNumber}`
                );
            }
        }

        // Shift from MatchingDetail to VoucherMatching
        const voucherMatchingPayload: Prisma.VoucherMatchingCreateManyInput[] = allValidMatchingDetail.map((md, index) => ({
            CreatedBy: postedBy,
            Status: 'A',
            CompanyMasterSid: payload.CompanyMasterSid,
            BranchMasterSid: payload.BranchMasterSid,
            VoucherMatchingHeaderSid: VoucherMatchingHeaderSid,
            VoucherHeaderSid: md.VoucherHeaderSid,
            VoucherDetailSid: md.VoucherDetailSid,
            VoucherTransactionSid: md.VoucherTransactionSid,
            VoucherMatchingDate: voucherMatchingHeader.VoucherMatchingDate,
            VoucherType: md.VoucherTransaction?.VoucherTypeMasterSid,
            Sno: index + 1,
            COAMasterSid: md.VoucherTransaction?.COAMasterSid,
            CurrencyCode: md.CurrencyCode,
            ExchangeRate: md.ExchangeRate ?? md.MatchingExRate,
            DrCr: md.DrCr,
            Amount: md.Amount,
            LocalAmount: md.LocalAmount,
            PartyAmount: md.PartyAmount,
            MatchingType: md.MatchingType!,
            LedgerMasterSid: md.VoucherTransaction?.LedgerMasterSid
        }));

        const allVoucherMatchings = await tx.voucherMatching.createManyAndReturn({
            data: voucherMatchingPayload
        });

        return {
            ...voucherMatchingHeader,
            VoucherMatching: allVoucherMatchings
        }

    }

    /**
     * Creates an Exchange JV for voucher matching when single foreign currency
     * has different exchange rates causing a local amount difference.
     * JV has 1 header, 2 details (party + exchange ledger), 2 transactions.
     */
    // private async createExchangeJvForMatching(
    //     prisma: Prisma.TransactionClient,
    //     dto: CreateStandaloneVoucherMatchingDto,
    //     voucherMatchingHeaderSid: number,
    //     yearMasterSid: number,
    // ) {
    //     const exchangeDiff = dto.exchangeDifference!;
    //     const absExchangeDiff = Math.abs(exchangeDiff);
    //     const postDate = new Date(dto.PostDate);

    //     // 1. Get Exchange Rate Mismatch Ledger from company config
    //     const exchangeRateLedgerSid = await this.voucherService.getExchangeRateMismatchLedger(dto.CompanyMasterSid);
    //     if (!exchangeRateLedgerSid) {
    //         throw new BadRequestException('Exchange Rate Mismatch Ledger not configured. Please configure it in Company Settings.');
    //     }

    //     // 2. Get JV VoucherTypeMaster
    //     const jvVoucherType = await prisma.voucherTypeMaster.findFirst({
    //         where: {
    //             DocumentTypeCode: 'JV',
    //             CompanyMasterSid: dto.CompanyMasterSid,
    //             BranchMasterSid: dto.BranchMasterSid,
    //             status: 'A',
    //         },
    //     });
    //     if (!jvVoucherType) {
    //         throw new BadRequestException('Journal Voucher type not found for this company/branch.');
    //     }

    //     // 3. Generate JV number
    //     const jvNumber = await this.voucherService.generateVoucherNumberFromConfig(
    //         jvVoucherType, dto.CompanyMasterSid, dto.BranchMasterSid, yearMasterSid, prisma, postDate
    //     );

    //     // 4. Create VoucherHeader (auto-posted)
    //     const jvHeader = await prisma.voucherHeader.create({
    //         data: {
    //             VoucherNumber: jvNumber,
    //             VoucherDate: postDate,
    //             PostDate: postDate,
    //             VoucherType: jvVoucherType.VoucherTypeMasterSid,
    //             Narration: `Exchange Rate JV for Voucher Matching`,
    //             CompanyMasterSid: dto.CompanyMasterSid,
    //             BranchMasterSid: dto.BranchMasterSid,
    //             VoucherTypeMasterSid: jvVoucherType.VoucherTypeMasterSid,
    //             PostStatus: 'P',
    //             Amount: absExchangeDiff,
    //             LocalAmount: absExchangeDiff,
    //             NetAmount: absExchangeDiff,
    //             CurrencyCode: dto.exchangeCurrencyCode || '',
    //             ExchangeRate: 1,
    //             Status: 'A',
    //             CreatedBy: dto.CreatedBy,
    //         },
    //     });

    //     // 5. Determine Dr/Cr direction
    //     // exchangeDiff > 0 (source local > object local) → Loss → Party Cr, Exchange Ledger Dr
    //     // exchangeDiff < 0 (source local < object local) → Gain → Party Dr, Exchange Ledger Cr
    //     const partyDrCr = exchangeDiff > 0 ? 'C' : 'D';
    //     const exchangeLedgerDrCr = exchangeDiff > 0 ? 'D' : 'C';

    //     // 6. Create 2 VoucherDetail lines
    //     const partyDetail = await prisma.voucherDetail.create({
    //         data: {
    //             CompanyMasterSid: dto.CompanyMasterSid,
    //             BranchMasterSid: dto.BranchMasterSid,
    //             VoucherHeaderSid: jvHeader.VoucherHeaderSid,
    //             Sno: 1,
    //             ChargeDescription: 'Exchange Rate Difference - Party',
    //             COAMasterSid: dto.partyLedgerSid!,
    //             LedgerMasterSid: dto.partySubledgerSid || null,
    //             CurrencyMasterSid: dto.exchangeCurrencySid,
    //             CurrencyCode: dto.exchangeCurrencyCode || '',
    //             ExchangeRate: 1,
    //             Rate: absExchangeDiff,
    //             NumberOfUnit: 1,
    //             Narration: 'Exchange Rate Difference',
    //             DrCr: partyDrCr,
    //             Amount: absExchangeDiff,
    //             LocalAmount: absExchangeDiff,
    //             TaxableAmount: 0,
    //             YearMasterSid: yearMasterSid,
    //             CreatedBy: dto.CreatedBy,
    //             Status: 'A',
    //         },
    //     });

    //     const exchangeDetail = await prisma.voucherDetail.create({
    //         data: {
    //             CompanyMasterSid: dto.CompanyMasterSid,
    //             BranchMasterSid: dto.BranchMasterSid,
    //             VoucherHeaderSid: jvHeader.VoucherHeaderSid,
    //             Sno: 2,
    //             ChargeDescription: 'Exchange Rate',
    //             COAMasterSid: exchangeRateLedgerSid,
    //             CurrencyMasterSid: dto.exchangeCurrencySid,
    //             CurrencyCode: dto.exchangeCurrencyCode || '',
    //             ExchangeRate: 1,
    //             Rate: absExchangeDiff,
    //             NumberOfUnit: 1,
    //             Narration: 'Exchange Rate',
    //             DrCr: exchangeLedgerDrCr,
    //             Amount: absExchangeDiff,
    //             LocalAmount: absExchangeDiff,
    //             TaxableAmount: 0,
    //             YearMasterSid: yearMasterSid,
    //             CreatedBy: dto.CreatedBy,
    //             Status: 'A',
    //         },
    //     });

    //     // 7. Create VoucherTransaction for each detail
    //     const allDetails = [partyDetail, exchangeDetail];
    //     for (const detail of allDetails) {
    //         await prisma.voucherTransaction.create({
    //             data: {
    //                 CompanyMasterSid: dto.CompanyMasterSid,
    //                 BranchMasterSid: dto.BranchMasterSid,
    //                 VoucherHeaderSid: jvHeader.VoucherHeaderSid,
    //                 VoucherDetailSid: detail.VoucherDetailSid,
    //                 VoucherNumber: jvNumber,
    //                 VoucherType: jvVoucherType.VoucherTypeMasterSid,
    //                 VoucherDate: postDate,
    //                 GST_VAT: jvHeader.GST_VAT || '',
    //                 Rate: absExchangeDiff,
    //                 NumberOfUnit: 1,
    //                 PostDate: postDate,
    //                 Sno: detail.Sno,
    //                 ChargeDescription: detail.ChargeDescription || '',
    //                 LedgerMasterSid: detail.LedgerMasterSid!,
    //                 COAMasterSid: detail.COAMasterSid!,
    //                 CurrencyCode: detail.CurrencyCode,
    //                 ExchangeRate: detail.ExchangeRate || 1,
    //                 Narration: detail.Narration,
    //                 DrCr: detail.DrCr,
    //                 TaxableAmount: detail.LocalAmount || 0,
    //                 Amount: detail.Amount || 0,
    //                 LocalAmount: detail.LocalAmount || 0,
    //                 VoucherTypeMasterSid: jvVoucherType.VoucherTypeMasterSid,
    //                 YearMasterSid: yearMasterSid,
    //                 Status: 'A',
    //                 CreatedBy: dto.CreatedBy,
    //                 CreatedOn: postDate,
    //             },
    //         });
    //     }

    //     // 8. Add the Exchange JV party line as a matching record
    //     const partyTransaction = await prisma.voucherTransaction.findFirst({
    //         where: { VoucherHeaderSid: jvHeader.VoucherHeaderSid, COAMasterSid: dto.partyLedgerSid },
    //     });

    //     if (partyTransaction) {
    //         await prisma.voucherMatching.create({
    //             data: {
    //                 CreatedBy: dto.CreatedBy,
    //                 Status: 'A',
    //                 CompanyMasterSid: dto.CompanyMasterSid,
    //                 BranchMasterSid: dto.BranchMasterSid,
    //                 VoucherMatchingHeaderSid: voucherMatchingHeaderSid,
    //                 VoucherHeaderSid: jvHeader.VoucherHeaderSid,
    //                 VoucherDetailSid: partyDetail.VoucherDetailSid,
    //                 VoucherTransactionSid: partyTransaction.VoucherTransactionSid,
    //                 MatchingTransactionSid: partyTransaction.VoucherTransactionSid,
    //                 VoucherMatchingDate: postDate,
    //                 VoucherType: jvVoucherType.VoucherTypeMasterSid,
    //                 Sno: 0,
    //                 COAMasterSid: dto.partyLedgerSid!,
    //                 LedgerMasterSid: dto.partySubledgerSid || 0,
    //                 CurrencyCode: dto.exchangeCurrencyCode || '',
    //                 ExchangeRate: 1,
    //                 DrCr: partyDrCr,
    //                 Amount: absExchangeDiff,
    //                 LocalAmount: absExchangeDiff,
    //                 PartyAmount: absExchangeDiff,
    //                 MatchingType: 'ExchangeJV',
    //             },
    //         });
    //     }

    //     return {
    //         VoucherHeaderSid: jvHeader.VoucherHeaderSid,
    //         VoucherNumber: jvNumber,
    //         ExchangeDifference: exchangeDiff,
    //         IsGain: exchangeDiff < 0,
    //     };
    // }
}
