import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { statusWhereClause } from 'src/common/helper';
import { DatabaseService } from 'src/database/database.service';
import { filterDto } from 'src/masters/DTO/search-vessel.dto';

@Injectable()
export class TdsDetailService {
    constructor(private _db: DatabaseService) { }

    async getAllTdsDetail() {
        try {
            const allTdsDetail = await this._db.tDSSetRate.findMany({
                where: {
                    status: 'A',
                }
            })
            return allTdsDetail;
        } catch (error) {
            throw error;
        }
    }

    async createNewTdsDetail(payload) {
        this.validateRateRange(payload);
        await this.validateUniqueRateRow(payload);
        try {
            const createdTdsDetail = await this._db.tDSSetRate.create({
                data: {
                    ...payload,
                    TDSRate: this.roundRate(payload.TDSRate),
                },
            });
            return createdTdsDetail;
        } catch (error) {
            throw error;
        }
    }


    async fetchTdsDetailById(TDSSetRateSid: number) {
        try {
            const ourTdsDetail = await this._db.tDSSetRate.findUnique({
                where: {
                    TDSSetRateSid: TDSSetRateSid
                }
            })
            if (!ourTdsDetail) {
                throw new BadRequestException(`TdsDetail with Id : ${TDSSetRateSid} not exists`);
            }
            return ourTdsDetail;
        } catch (error) {
            throw error;
        }
    }
    async fetchTdsDetailByHeaderId(TDSSetHeaderSid: number) {
        try {
            const ourTdsDetail = await this._db.tDSSetRate.findMany({
                where: {
                    TDSSetHeaderSid: TDSSetHeaderSid,
                    status: 'A'
                },
                include: {
                    countryMaster: {
                        select: {
                            countryName: true
                        }
                    }
                },
                orderBy: {
                    Sno: 'asc'
                }
            })
            if (!ourTdsDetail) {
                throw new BadRequestException(`TdsDetail with Id : ${TDSSetHeaderSid} not exists`);
            }
            return ourTdsDetail;
        } catch (error) {
            throw error;
        }
    }

    async updateTdsDetailById(TDSSetRateSid: number, payload) {
        this.validateRateRange(payload);
        await this.validateUniqueRateRow(payload, TDSSetRateSid);

        try {
            const exist = await this._db.tDSSetRate.findUnique({
                where: { TDSSetRateSid },
            });
            if (!exist) {
                throw new BadRequestException(`TdsDetail with Id : ${TDSSetRateSid} not exists`);
            }
            const updatedTdsDetail = await this._db.tDSSetRate.update({
                where: { TDSSetRateSid },
                data: {
                    ...payload,
                    TDSRate: this.roundRate(payload.TDSRate),
                },
            });
            return updatedTdsDetail;
        } catch (error) {
            throw error;
        }
    }


    async deleteTdsDetail(TDSSetRateSid: number) {
        try {
            const exist = await this._db.tDSSetRate.findUnique({
                where: {
                    TDSSetRateSid: TDSSetRateSid
                }
            })
            if (!exist) {
                throw new BadRequestException(`TdsDetail with Id : ${TDSSetRateSid} not exists`);
            }
            if (exist.status === 'D') {
                throw new BadRequestException(`TdsDetail with Id :${TDSSetRateSid} is already deleted`)
            }
            const deletedTdsDetail = this._db.tDSSetRate.update({
                where: {
                    TDSSetRateSid: TDSSetRateSid
                },
                data: {
                    status: 'D'
                }
            })
            return deletedTdsDetail;
        } catch (error) {
            throw error;
        }
    }


    // MR-4: TDSRate must be a finite number in [0, 100].
    private validateRateRange(payload: any): void {
        if (payload?.TDSRate === undefined || payload?.TDSRate === null || payload?.TDSRate === '') {
            return; // TDSAmount may be used instead; the form mutually-disables them.
        }
        const rate = Number(payload.TDSRate);
        if (!Number.isFinite(rate) || rate < 0 || rate > 100) {
            throw new BadRequestException(
                `TDSRate "${payload.TDSRate}" is invalid. Must be a number between 0 and 100 (e.g., 1.5, 7.5, 10).`,
            );
        }
    }

    private roundRate(value: any): number | undefined {
        if (value === undefined || value === null || value === '') return undefined;
        const n = Number(value);
        if (!Number.isFinite(n)) return undefined;
        return Math.round(n * 100) / 100;
    }

    // MR-6: unique active rate row per (Header, CompanyType, Country, ITSection, EffectiveFrom).
    private async validateUniqueRateRow(payload: any, excludeSid?: number): Promise<void> {
        if (!payload?.TDSSetHeaderSid || !payload?.CompanyType || !payload?.ITSectionCode || !payload?.EffectiveFrom) {
            return;
        }
        const existing = await this._db.tDSSetRate.findFirst({
            where: {
                status: 'A',
                TDSSetHeaderSid: payload.TDSSetHeaderSid,
                CompanyType: payload.CompanyType,
                ITSectionCode: payload.ITSectionCode,
                EffectiveFrom: new Date(payload.EffectiveFrom),
                ...(payload.CountryMasterSid != null
                    ? { CountryMasterSid: payload.CountryMasterSid }
                    : { CountryMasterSid: null }),
                ...(excludeSid ? { TDSSetRateSid: { not: excludeSid } } : {}),
            },
            include: {
                countryMaster: { select: { countryName: true } },
            },
        });
        if (existing) {
            const countryName = existing.countryMaster?.countryName ?? 'any country';
            throw new BadRequestException(
                `A rate row already exists in this TDS Set for CompanyType "${payload.CompanyType}", Country "${countryName}", IT Section "${payload.ITSectionCode}" effective from ${new Date(payload.EffectiveFrom).toISOString().slice(0, 10)}. Edit the existing row or choose different parameters.`,
            );
        }
    }

    async searchTdsDetail(params: filterDto) {
        const { search = '', page = 1, pageSize = 15 } = params;
        const skip = (page - 1) * pageSize;
        const where: Prisma.TDSSetRateWhereInput = {
            status: statusWhereClause,
        };

        const [items, totalCount] = await this._db.$transaction([
            this._db.tDSSetRate.findMany({
                where,
                skip,
                take: pageSize,
                orderBy: { TDSSetRateSid: 'desc' },
            }),
            this._db.tDSSetRate.count({ where }),
        ]);

        return {
            items,
            totalCount,
            currentPage: page,
            totalPages: Math.ceil(totalCount / pageSize),
        };
    }
}
