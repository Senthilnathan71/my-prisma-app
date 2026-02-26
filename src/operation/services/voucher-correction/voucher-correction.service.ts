import { BadRequestException, Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { statusWhereClause } from 'src/common/helper';
import { DatabaseService } from 'src/database/database.service';
import { filterDto } from 'src/masters/DTO/search-vessel.dto';

@Injectable()
export class VoucherCorrectionService {
    constructor(private _db: DatabaseService, private logger: Logger) { }

    async searchVoucher(params: filterDto) {
        const { search = '', page = 1, pageSize = 10, activeCompanyId, activeBranchId } = params;
        const skip = (page - 1) * pageSize;
        let normalizedCashBank = "";
        if (String(search).trim() === 'cash' || String(search).trim() === 'Cash') {
            normalizedCashBank = "C";
        } else if (String(search).trim() === 'bank' || String(search).trim() === 'Bank') {
            normalizedCashBank = "D";
        }
        const isSearchTextANumber = !isNaN(Number(search)) && search.trim() !== '';
        const where: Prisma.VoucherHeaderWhereInput = {
            CompanyMasterSid: activeCompanyId,
            BranchMasterSid: activeBranchId,
            Status: statusWhereClause,
            PostStatus: 'P',
            ...(search
                ? {
                    OR: [
                        { voucherTypeMaster: { DocumentTypeName: { contains: 'search', mode: 'insensitive' } } },
                        { VoucherNumber: { contains: 'search', mode: 'insensitive' } },
                        { PartyName: { contains: 'search', mode: 'insensitive' } },
                        { CurrencyCode: { contains: 'search', mode: 'insensitive' } },
                        { CashOrBank: { contains: 'normalizedCashBank', mode: 'insensitive' } },
                        { CreatedBy: { contains: 'search', mode: 'insensitive' } },
                        { PostStatus: { contains: 'search', mode: 'insensitive' } },
                        { Status: { contains: 'search', mode: 'insensitive' } },
                        ...(isSearchTextANumber ? [{ Amount: search }] : []),
                        ...(!isNaN(new Date(search).getTime())
                            ? [{ VoucherDate: new Date(search) }]
                            : []),
                        ...(!isNaN(new Date(search).getTime())
                            ? [{ PostDate: new Date(search) }]
                            : []),
                    ]
                } : {}
            )
        };
        const [items, totalCount] = await this._db.$transaction([
            this._db.voucherHeader.findMany({
                where,
                include: {
                    voucherTypeMaster: {
                        select: {
                            DocumentTypeName: true,
                        }
                    }
                },
                skip,
                take: pageSize,
                orderBy: { VoucherHeaderSid: 'desc' },
            }),
            this._db.voucherHeader.count({ where }),
        ]);
        return {
            items,
            totalCount,
        };
    }

    
}
