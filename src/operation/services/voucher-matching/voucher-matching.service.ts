import { BadRequestException, Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { DatabaseService } from 'src/database/database.service';
import { filterDto } from 'src/masters/DTO/search-vessel.dto';
import { Prisma } from '@prisma/client';
import { statusWhereClause } from 'src/common/helper';
import { VoucherService } from '../voucher/voucher.service';
import { SearchPostedVouchersDto, CreateStandaloneVoucherMatchingDto } from 'src/accounts/dto/voucher-matching.dto';

@Injectable()
export class VoucherMatchingService {
    constructor(
        private _db: DatabaseService,
        private logger: Logger,
        private voucherService: VoucherService,
    ) { }

    async searchVoucherMatching(params: filterDto) {
        const {search='', page=1, pageSize=10,activeCompanyId} = params;
        const skip = (page - 1) * pageSize;

        const where: Prisma.VoucherMatchingHeaderWhereInput = {
            Status: statusWhereClause,
            CompanyMasterSid: activeCompanyId,
            ...(search
                ? {
                    OR:[
                        { VoucherMatchingNo: { contains: search, mode: 'insensitive'}},
                        { SubledgerName: { contains:search, mode:'insensitive'}},
                        { Status: { contains: search,  mode: 'insensitive'}}
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
                orderBy: { VoucherMatchingHeaderSid : 'desc'},
            }),
            this._db.voucherMatchingHeader.count({ where }),
        ]);

        return {
            items,
            totalCount,
        };
    }

    async getVoucherMatchingById(VoucherMatchingHeaderSid:number) {
        try {
            const voucherMatching = await this._db.voucherMatchingHeader.findUnique({
                where: {
                    VoucherMatchingHeaderSid: VoucherMatchingHeaderSid,
                    Status: 'A'
                } as any,
                include:{
                    voucherMatchings : {
                        include: {
                            CoaMaster :{
                                select: {
                                    LedgerName: true,
                                }
                            },
                            subledgerMaster: {
                                select: {
                                    SubledgerName : true,
                                }
                            },
                            branch: {
                                select: {
                                    branchName : true,
                                }
                            },
                            VoucherHeader: {
                                select : {
                                    VoucherNumber: true,
                                    voucherTypeMaster : {
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
                    VoucherDetail : {
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
                                    Amount : true,
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

    async createStandaloneVoucherMatching(dto: CreateStandaloneVoucherMatchingDto) {
        try {
            const result = await this._db.$transaction(async (prisma) => {
                const payload = {
                    CompanyMasterSid: dto.CompanyMasterSid,
                    BranchMasterSid: dto.BranchMasterSid,
                    VoucherHeaderSid: dto.VoucherHeaderSid,
                    VoucherTypeMasterSid: dto.VoucherTypeMasterSid,
                    voucherTypeInName: dto.voucherTypeInName,
                    SubledgerName: dto.SubledgerName || '',
                    PostDate: new Date(dto.PostDate),
                    Narration: dto.Narration || '',
                    createdBy: dto.CreatedBy,
                    partyVoucherDetail: dto.partyVoucherDetail.map((d, i) => ({
                        VoucherDetailSid: d.VoucherDetailSid,
                        VoucherTransactionSid: d.VoucherTransactionSid,
                        COAMasterSid: d.COAMasterSid,
                        LedgerMasterSid: d.LedgerMasterSid,
                        CurrencyCode: d.CurrencyCode,
                        ExchangeRate: d.ExchangeRate,
                        DrCr: d.DrCr,
                        PartyAmount: d.PartyAmount,
                        LocalAmount: d.LocalAmount,
                        Sno: d.Sno ?? i + 1,
                    })),
                    voucherMatching: dto.matchingInvoices.map((m) => ({
                        VoucherHeaderSid: m.VoucherHeaderSid,
                        VoucherDetailSid: m.VoucherDetailSid,
                        VoucherTransactionSid: m.VoucherTransactionSid,
                        VoucherTypeMasterSid: m.VoucherTypeMasterSid,
                        COAMasterSid: m.COAMasterSid,
                        LedgerMasterSid: m.LedgerMasterSid,
                        CurrencyCode: m.CurrencyCode,
                        ExchangeRate: m.ExchangeRate,
                        DrCr: m.DrCr,
                        PartyAmount: m.PartyAmount,
                        LocalAmount: m.LocalAmount,
                    })),
                    BillMatchingCurrencyAmount: dto.matchingInvoices.reduce(
                        (sum, m) => sum + Number(m.PartyAmount || 0), 0
                    ),
                    BillMatchingLocalAmount: dto.matchingInvoices.reduce(
                        (sum, m) => sum + Number(m.LocalAmount || 0), 0
                    ),
                };

                return await this.voucherService.createVoucherMatching(payload as any, prisma);
            });

            return result;
        } catch (error) {
            this.logger.error('createStandaloneVoucherMatching', error);
            if (error instanceof BadRequestException) throw error;
            throw new InternalServerErrorException('Failed to create voucher matching');
        }
    }
}
