import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { DatabaseService } from 'src/database/database.service';
import { SearchListDto } from 'src/masters/DTO/search-list.dto';
import { SearchVesselDto } from 'src/masters/DTO/search-vessel.dto';

@Injectable()
export class CommodityService {
    constructor(private _db: DatabaseService) { }

    async createNewCommodity(newData: any) {
        try {
            const newlyCreateCommodity = await this._db.commodityMaster.create({
                data: {
                    ...newData,
                }
            })
            return newlyCreateCommodity;
        } catch (error) {
            throw error;
        }
    }

    async getAllCommodity() {
        try {
            const allCommodities = await this._db.commodityMaster.findMany({
                where: {
                    deletedAt: null
                }
            })
            return allCommodities;
        } catch (error) {
            throw error;
        }
    }

    async getCommodityById(CommodityMasterSid: number) {
        try {
            const ourCommodity = await this._db.commodityMaster.findUnique({
                where: {
                    CommodityMasterSid: CommodityMasterSid
                }
            })
            if (!ourCommodity) {
                throw new BadRequestException(`Commodity with id :${CommodityMasterSid} not exist`);
            }
            return ourCommodity;
        } catch (error) {
            throw error;
        }
    }


    async updateCommodityById(CommodityMasterSid: number, updateData: any) {
        try {
            const exist = await this._db.commodityMaster.findUnique({
                where: {
                    CommodityMasterSid: CommodityMasterSid
                }
            })
            if (!exist) {
                throw new BadRequestException(`Commodity with id : ${CommodityMasterSid} not exist`);
            }
            const updatedCommodity = await this._db.commodityMaster.update({
                where: {
                    CommodityMasterSid: CommodityMasterSid
                },
                data: updateData,
            })
            return updatedCommodity;
        } catch (error) {
            throw error;
        }
    }

    async deleteCommodityById(CommodityMasterSid: number) {
        try {
            const exist = await this._db.commodityMaster.findUnique({
                where: {
                    CommodityMasterSid: CommodityMasterSid
                }
            })
            if (!exist) {
                throw new BadRequestException(`Commodity with id : ${CommodityMasterSid} not exist`);
            }
            if (exist.deletedAt) {
                throw new BadRequestException(`Commodity with id :${CommodityMasterSid} is already deleted`);
            }
            const deletedCommodity = await this._db.commodityMaster.update({
                where: {
                    CommodityMasterSid: CommodityMasterSid
                }, data: {
                    deletedAt: new Date()
                }
            })
            return deletedCommodity;
        } catch (error) {
            throw error;
        }
    }


    async searchCommodity(params: SearchVesselDto) {
    const { search = '', page = 1, pageSize = 10 } = params;
    const skip = (page - 1) * pageSize;

    const where: Prisma.CommodityMasterWhereInput = {
        deletedAt: null,
        status: 'A',
        ...(search
            ? {
                OR: [
                    { CommodityCode: { contains: search, mode: 'insensitive' } },
                    { CommodityName: { contains: search, mode: 'insensitive' } },
                    { CommodityNameLL: { contains: search, mode: 'insensitive' } },
                    { ImcoName: { contains: search, mode: 'insensitive' } },
                    { UNNo: { contains: search, mode: 'insensitive' } },
                    { PackingGroup: { contains: search, mode: 'insensitive' } },
                    { CommodityType: { contains: search, mode: 'insensitive' } },
                    // { HSSACCode: { contains: search, mode: 'insensitive' } },
                    { FlashPoint: { contains: search, mode: 'insensitive' } },
                    { status: { contains: search, mode: 'insensitive' } },
                    { Remarks: { contains: search, mode: 'insensitive' } },
                ],
            }
            : {}
        ),
    };

    const [items, totalCount] = await this._db.$transaction([
        this._db.commodityMaster.findMany({
            where,
            skip,
            take: pageSize,
            orderBy: { CommodityMasterSid: 'desc' },
        }),
        this._db.commodityMaster.count({ where }),
    ]);

    return {
        items,
        totalCount,
    };
}
}
