import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { statusWhereClause } from 'src/common/helper';
import { DatabaseService } from 'src/database/database.service';
import { filterDto } from 'src/masters/DTO/search-vessel.dto';
import { TdsFilterDto } from 'src/masters/DTO/tds-filter.dto';

@Injectable()
export class TdsService {
    constructor(private _db: DatabaseService, private logger: Logger) { }

    async getAllTds(filter: TdsFilterDto = {}) {
        try {
            const { CompanyType, CountryMasterSid } = filter;
            const allTds = await this._db.tDSSetHeader.findMany({
                where: {
                    status: 'A',
                    EffectiveFrom: { lte: new Date() },
                    ...(CompanyType || CountryMasterSid
                        ? {
                              tdsSetRate: {
                                  some: {
                                      status: 'A',
                                      ...(CompanyType ? { CompanyType } : {}),
                                      ...(CountryMasterSid ? { CountryMasterSid } : {}),
                                  },
                              },
                          }
                        : {}),
                },
            });
            return allTds;
        } catch (error) {
            throw error;
        }
    }

    async createNewTds(payload) {
        this.validateLimitOrdering(payload);
        this.validateNewEffectiveFrom(payload);

        const existing = await this._db.tDSSetHeader.findFirst({
            where: {
                TDSSetName: {
                    equals: payload.TDSSetName?.trim(),
                    mode: 'insensitive',
                },
                status: 'A',
            },
        });

        if (existing) {
            throw new BadRequestException(
                `TDS Set Name "${payload.TDSSetName}" already exists (effective from ${this.formatDate(existing.EffectiveFrom)}). Open the existing set or choose a different name.`,
            );
        }

        try {
            const createdTds = await this._db.tDSSetHeader.create({
                data: { ...payload },
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
        this.validateLimitOrdering(payload);

        const duplicate = await this._db.tDSSetHeader.findFirst({
            where: {
                AND: [
                    { TDSSetHeaderSid: { not: TDSSetHeaderSid } },
                    {
                        TDSSetName: {
                            equals: payload.TDSSetName?.trim(),
                            mode: 'insensitive',
                        },
                    },
                ],
                status: 'A',
            },
        });

        if (duplicate) {
            throw new BadRequestException(
                `TDS Set Name "${payload.TDSSetName}" already exists (effective from ${this.formatDate(duplicate.EffectiveFrom)}). Open the existing set or choose a different name.`,
            );
        }

        try {
            const exist = await this._db.tDSSetHeader.findUnique({
                where: { TDSSetHeaderSid },
            });
            if (!exist) {
                throw new BadRequestException(`Tds with Id : ${TDSSetHeaderSid} not exists`);
            }
            const updatedTds = await this._db.tDSSetHeader.update({
                where: { TDSSetHeaderSid },
                data: payload,
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
        const where: Prisma.TDSSetHeaderWhereInput = {
            status: statusWhereClause,
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

    // MH-6: per-payment threshold cannot exceed the annual aggregate threshold.
    private validateLimitOrdering(payload: any): void {
        const tx = Number(payload?.TransactionLimit ?? 0);
        const an = Number(payload?.AnnualLimit ?? 0);
        if (tx > an) {
            throw new BadRequestException(
                `Transaction Limit (${tx}) cannot exceed Annual Limit (${an}). Per-payment threshold must be ≤ annual aggregate threshold.`,
            );
        }
    }

    // MH-4: new headers cannot start in the past.
    private validateNewEffectiveFrom(payload: any): void {
        if (!payload?.EffectiveFrom) return;
        const eff = new Date(payload.EffectiveFrom);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        if (eff < today) {
            throw new BadRequestException(
                `EffectiveFrom ${this.formatDate(eff)} cannot be earlier than today (${this.formatDate(today)}). Pick a future date or today.`,
            );
        }
    }

    private formatDate(d: Date): string {
        return new Date(d).toISOString().slice(0, 10);
    }
}
