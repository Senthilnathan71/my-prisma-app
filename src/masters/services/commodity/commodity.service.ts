import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { DatabaseService } from 'src/database/database.service';
import { SearchListDto } from 'src/masters/DTO/search-list.dto';

@Injectable()
export class CommodityService {
    constructor(private _db: DatabaseService) { }

    async createNewCommodity(newData: Prisma.CommodityMasterCreateInput) {
        try {
            const newlyCreateCommodity = await this._db.commodityMaster.create({
                data: {
                    ...newData,
                    createdBy: 'admin@crm.com'
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


    async updateCommodityById(CommodityMasterSid: number, updateData: Prisma.CommodityMasterUpdateInput) {
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


    async searchCommodity(data: SearchListDto) {
        const { searchType, filterValue } = data;
        const acceptedType = [
            "CommodityCode",
            "CommodityName",
            "CommodityNameLL",
            "UOMSid",
            "ImcoName",
            "UNNo",
            "PackingGroup",
            "CommodityType",
            "HSSACCode",
            "FlashPoint",
            "status",
            "Remarks"
        ];
        if (!acceptedType.includes(searchType)) {
            throw new BadRequestException('Invalid Search Type');
        }
        const searchResults = await this._db.commodityMaster.findMany({
            where: {
                [searchType]: {
                    contains: filterValue,
                    mode: 'insensitive'
                }
            }
        }).catch((err) => {
            throw new Error(`Error Occured : ${JSON.stringify(err)}`);
        })
        return searchResults;
    }
}
