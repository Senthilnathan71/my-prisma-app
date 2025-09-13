import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { DatabaseService } from 'src/database/database.service';
import { filterDto } from 'src/masters/DTO/search-vessel.dto';

@Injectable()
export class TdsService {
    constructor(private _db: DatabaseService, private logger: Logger) { }

    async getAllTds(CompanyMasterSid: number) {
        try {
            const allTds = await this._db.tDSSetHeader.findMany({
                where: {
                    status: 'A',
                    CompanyMasterSid: CompanyMasterSid

                }
            })
            return allTds;
        } catch (error) {
            throw error;
        }
    }

    async createNewTds(payload) {

        const existing = await this._db.tDSSetHeader.findFirst({
            where: {
                TDSSetName: {
                    equals: payload.TDSSetName.trim(),
                    mode: 'insensitive'
                },
                status: 'A'
            }
        });

        if (existing) {
            if (existing.TDSSetName === payload.TDSSetName) {
                throw new BadRequestException('TDS name already exists.');
            }
        }

        try {
            const createdTds = await this._db.tDSSetHeader.create({
                data: {
                    ...payload,

                }
            });
            return createdTds;
        } catch (error) {
            throw error;
        }
    }


    async fetchTdsById(TDSSetHeaderSid: number) {
        try {
            const ourTds = await this._db.tDSSetHeader.findUnique({
                where: {
                    TDSSetHeaderSid: TDSSetHeaderSid
                },
                include: {
                    tdsSetRate: true,
                    tdsExemption: true,
                }
            })
            if (!ourTds) {
                throw new BadRequestException(`Tds with Id : ${TDSSetHeaderSid} not exists`);
            }
            return ourTds;
        } catch (error) {
            throw error;
        }
    }

    async updateTdsById(TDSSetHeaderSid: number, payload) {

        const duplicate = await this._db.tDSSetHeader.findFirst({
            where: {
                AND: [
                    {
                        TDSSetHeaderSid: { not: TDSSetHeaderSid }
                    },
                    {
                        TDSSetName: {
                            equals: payload.TDSSetName?.trim(),
                            mode: 'insensitive'
                        }
                    }
                ],
                status: 'A'
            }
        });

        if (duplicate) {
            if (duplicate.TDSSetName === payload.TDSSetName) {
                throw new BadRequestException('TDS name already exists.');
            }
        }

        try {
            const exist = await this._db.tDSSetHeader.findUnique({
                where: {
                    TDSSetHeaderSid: TDSSetHeaderSid
                }
            });
            if (!exist) {
                throw new BadRequestException(`Tds with Id : ${TDSSetHeaderSid} not exists`);
            }
            const updatedTds = await this._db.tDSSetHeader.update({
                where: {
                    TDSSetHeaderSid: TDSSetHeaderSid
                },
                data: payload
            });
            return updatedTds;
        } catch (error) {
            throw error;
        }
    }


    async deleteTds(TDSSetHeaderSid: number) {
        try {
            const exist = await this._db.tDSSetHeader.findUnique({
                where: {
                    TDSSetHeaderSid: TDSSetHeaderSid
                }
            })
            if (!exist) {
                throw new BadRequestException(`Tds with Id : ${TDSSetHeaderSid} not exists`);
            }
            if (exist.status === 'D') {
                throw new BadRequestException(`Tds with Id :${TDSSetHeaderSid} is already deleted`)
            }
            const deletedTds = this._db.tDSSetHeader.update({
                where: {
                    TDSSetHeaderSid: TDSSetHeaderSid
                },
                data: {
                    status: 'D'
                }
            })
            return deletedTds;
        } catch (error) {
            throw error;
        }
    }


    async searchTds(params: filterDto) {
        const { search = '', page = 1, pageSize = 15 } = params;
        const skip = (page - 1) * pageSize;
        console.log(search);
        let sec = Date.parse(search);
        console.log(new Date(search));
        const where: Prisma.TDSSetHeaderWhereInput = {
            status: 'A',
            ...(search
                ? {
                    OR: [
                        { TDSSetName: { contains: search, mode: 'insensitive' } },
                        ...(isNaN(Date.parse(search)) ? [] : [{
                            EffectiveFrom: { equals: new Date(search) }
                        }]),
                        ...(isNaN(Number(search)) ? [] : [{
                            TransactionLimit: { equals: Number(search) }
                        }]),
                        ...(isNaN(Number(search)) ? [] : [{
                            AnnualLimit: { equals: Number(search) }
                        }]),
                        ...('active'.includes(search.toLowerCase())
                            ? [{ status: 'A' }]
                            : []),
                        ...('suspended'.includes(search.toLowerCase())
                            ? [{ status: 'S' }]
                            : []),
                    ]
                }
                : {}),
        };

        const [items, totalCount] = await this._db.$transaction([
            this._db.tDSSetHeader.findMany({
                where,
                skip,
                take: pageSize,
                orderBy: { TDSSetHeaderSid: 'desc' },
            }),
            this._db.tDSSetHeader.count({ where }),
        ]);

        return {
            items,
            totalCount,
            currentPage: page,
            totalPages: Math.ceil(totalCount / pageSize),
        };
    }

    async getAuditLogs(tableName: string, recordId?: string) {
        try {
            const whereClause: any = { tableName };
            if (recordId) whereClause.recordId = recordId;

            const logs = await this._db.auditLog.findMany({
                where: whereClause,
                orderBy: { changedAt: 'desc' },
            });

            return logs;
        } catch (error) {
            this.logger.warn(`getAuditLogsError: ${error}`);
            throw new Error(`Error fetching audit logs: ${error.message}`);
        }
    }
}
