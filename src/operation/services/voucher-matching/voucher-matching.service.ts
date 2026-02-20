import { BadRequestException, Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { DatabaseService } from 'src/database/database.service';
import { filterDto } from 'src/masters/DTO/search-vessel.dto';
import { Prisma } from '@prisma/client';
import { statusWhereClause } from 'src/common/helper';

@Injectable()
export class VoucherMatchingService {
    constructor(private _db: DatabaseService, private logger: Logger) { }

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
}
