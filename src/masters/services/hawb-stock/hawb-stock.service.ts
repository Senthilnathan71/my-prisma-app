import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { DatabaseService } from 'src/database/database.service';
import { SearchListDto } from 'src/masters/DTO/search-list.dto';
import { SearchVesselDto } from 'src/masters/DTO/search-vessel.dto';

@Injectable()
export class HawbStockService {
    constructor(private _db: DatabaseService) { }

    async getAllHawbStocks() {
        try {
            const allHawbStocks = await this._db.hawbStock.findMany({
                where: {
                    deletedAt: null
                },
                include: {
                    branchMaster: true,
                    companyMaster: true,
                    customerMaster: true
                }
            });
            return allHawbStocks;
        } catch (error) {
            throw error;
        }
    }

    async createNewHawbStock(payload) {
        try {
            const createdHawbStock = await this._db.hawbStock.create({
                data: {
                    ...payload,
                },
                include: {
                    branchMaster: true,
                    companyMaster: true,
                    customerMaster: true
                }
            });
            return createdHawbStock;
        } catch (error) {
            throw error;
        }
    }

    async fetchHawbStockById(HawbStockSid: number) {
        try {
            const hawbStock = await this._db.hawbStock.findUnique({
                where: {
                    HawbStockSid: HawbStockSid
                },
                include: {
                    branchMaster: true,
                    companyMaster: true,
                    customerMaster: true
                }
            });
            if (!hawbStock) {
                throw new BadRequestException(`HAWB Stock with Id : ${HawbStockSid} not exists`);
            }
            return hawbStock;
        } catch (error) {
            throw error;
        }
    }

    async updateHawbStockById(HawbStockSid: number, payload) {
        try {
            const exist = await this._db.hawbStock.findUnique({
                where: {
                    HawbStockSid: HawbStockSid
                }
            });
            if (!exist) {
                throw new BadRequestException(`HAWB Stock with Id : ${HawbStockSid} not exists`);
            }
            const updatedHawbStock = await this._db.hawbStock.update({
                where: {
                    HawbStockSid: HawbStockSid
                },
                data: payload,
                include: {
                    branchMaster: true,
                    companyMaster: true,
                    customerMaster: true
                }
            });
            return updatedHawbStock;
        } catch (error) {
            throw error;
        }
    }

    async deleteHawbStock(HawbStockSid: number) {
        try {
            const exist = await this._db.hawbStock.findUnique({
                where: {
                    HawbStockSid: HawbStockSid
                }
            });
            if (!exist) {
                throw new BadRequestException(`HAWB Stock with Id : ${HawbStockSid} not exists`);
            }
            if (exist.deletedAt) {
                throw new BadRequestException(`HAWB Stock with Id :${HawbStockSid} is already deleted`)
            }
            const deletedHawbStock = await this._db.hawbStock.update({
                where: {
                    HawbStockSid: HawbStockSid
                },
                data: {
                    deletedAt: new Date()
                },
                include: {
                    branchMaster: true,
                    companyMaster: true,
                    customerMaster: true
                }
            });
            return deletedHawbStock;
        } catch (error) {
            throw error;
        }
    }

    async searchHawbStock(params: SearchVesselDto) {
    const { search = '', page = 1, pageSize = 10 } = params;
    const skip = (page - 1) * pageSize;

    const where: Prisma.HawbStockWhereInput = {
        deletedAt: null,
        status: 'A',
        ...(search
            ? {
                OR: [
                    { AirwayBillType: { contains: search, mode: 'insensitive' } },
                    { AirwayBillNumber: { contains: search, mode: 'insensitive' } },
                    { HAWBSerial: { contains: search, mode: 'insensitive' } },
                    { StockStatus: { contains: search, mode: 'insensitive' } },
                    { status: { contains: search, mode: 'insensitive' } },
                    { Remarks: { contains: search, mode: 'insensitive' } },
                   
                ],
            }
            : {}
        ),
    };

    const [items, totalCount] = await this._db.$transaction([
        this._db.hawbStock.findMany({
            where,
            skip,
            take: pageSize,
            include: {
                branchMaster: true,
                companyMaster: true,
                customerMaster: true,
            },
            orderBy: { HawbStockSid: 'desc' },
        }),
        this._db.hawbStock.count({ where }),
    ]);

    return {
        items,
        totalCount,
    };
}
}