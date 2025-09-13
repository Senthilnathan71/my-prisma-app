import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { DatabaseService } from 'src/database/database.service';
import { SearchListDto } from 'src/masters/DTO/search-list.dto';
import { filterDto } from 'src/masters/DTO/search-vessel.dto';

@Injectable()
export class ChargeTdsService {
    constructor(private _db: DatabaseService) { }

    async getAllChargeTds() {
        try {
            const allChargeTds = await this._db.chargeTds.findMany({
                where: {
                    status: 'A'
                },
                include: {
                    chargeMaster: true,
                    tdsSetHeader: true
                }
            });
            return allChargeTds;
        } catch (error) {
            throw error;
        }
    }

    async createNewChargeTds(payload: any) {
        try {
            const createdChargeTds = await this._db.chargeTds.create({
                data: {
                    ...payload,
                },
                include: {
                    chargeMaster: true,
                    tdsSetHeader: true
                }
            });
            return createdChargeTds;
        } catch (error) {
            throw error;
        }
    }

    async fetchChargeTdsById(ChargeTdsSid: number) {
        try {
            const chargeTds = await this._db.chargeTds.findUnique({
                where: {
                    ChargeTdsSid: ChargeTdsSid
                },
                include: {
                    chargeMaster: true,
                    tdsSetHeader: true
                }
            });
            if (!chargeTds) {
                throw new BadRequestException(`Charge TDS with Id : ${ChargeTdsSid} not exists`);
            }
            return chargeTds;
        } catch (error) {
            throw error;
        }
    }

    async updateChargeTdsById(ChargeTdsSid: number, payload: any) {
        try {
            const exist = await this._db.chargeTds.findUnique({
                where: {
                    ChargeTdsSid: ChargeTdsSid
                }
            });
            if (!exist) {
                throw new BadRequestException(`Charge TDS with Id : ${ChargeTdsSid} not exists`);
            }
            const updatedChargeTds = await this._db.chargeTds.update({
                where: {
                    ChargeTdsSid: ChargeTdsSid
                },
                data: payload,
                include: {
                    chargeMaster: true,
                    tdsSetHeader: true
                }
            });
            return updatedChargeTds;
        } catch (error) {
            throw error;
        }
    }

    async deleteChargeTds(ChargeTdsSid: number) {
        try {
            const exist = await this._db.chargeTds.findUnique({
                where: {
                    ChargeTdsSid: ChargeTdsSid
                }
            });
            if (!exist) {
                throw new BadRequestException(`Charge TDS with Id : ${ChargeTdsSid} not exists`);
            }
            if (exist.status === 'D') {
                throw new BadRequestException(`Charge TDS with Id :${ChargeTdsSid} is already deleted`);
            }
            const deletedChargeTds = await this._db.chargeTds.update({
                where: {
                    ChargeTdsSid: ChargeTdsSid
                },
                data: {
                    status: 'D'
                },
                include: {
                    chargeMaster: true,
                    tdsSetHeader: true
                }
            });
            return deletedChargeTds;
        } catch (error) {
            throw error;
        }
    }

    async searchChargeTds(params: filterDto) {
        const { search = '', page = 1, pageSize = 15 } = params;
        const skip = (page - 1) * pageSize;

        const where: Prisma.ChargeTdsWhereInput = {
            status: 'A',
            OR: search ? [
                { createdBy: { contains: search, mode: 'insensitive' } },
                { updatedBy: { contains: search, mode: 'insensitive' } },
                { status: { contains: search, mode: 'insensitive' } },
                ...(!isNaN(Number(search)) ? [
                    { ChargeTdsSid: Number(search) },
                    { ChargeMasterSid: Number(search) },
                    { TDSSet: Number(search) }
                ] : [])
            ] : undefined
        };

        const [items, totalCount] = await this._db.$transaction([
            this._db.chargeTds.findMany({
                where,
                skip,
                take: pageSize,
                include: {
                    chargeMaster: true,
                    tdsSetHeader: true
                },
                orderBy: { ChargeTdsSid: 'desc' },
            }),
            this._db.chargeTds.count({ where }),
        ]);

        return {
            items,
            totalCount,
        };
    }
}