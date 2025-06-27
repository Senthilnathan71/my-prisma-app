import { BadRequestException, Injectable } from '@nestjs/common';
import { DatabaseService } from 'src/database/database.service';
import { SearchListDto } from 'src/masters/DTO/search-list.dto';

@Injectable()
export class GenerationService {
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

    async searchHawbStock(data: SearchListDto) {
        const { searchType, filterValue } = data;
        const intFields = [
            'HawbStockSid',
            'CompanyMasterSid',
            'BranchMasterSid',
            'Agent',
            'NumberofHAWB'
        ];
        const stringFields = [
            'AirwayBillType',
            'AirwayBillNumber',
            'HAWBSerial',
            'StockStatus',
            'createdBy',
            'updatedBy',
            'status',
            'Remarks'
        ];
        const dateFields = [
            'ReceivedDate',
            'createdOn',
            'updatedOn'
        ];
        const acceptedType = [...intFields, ...stringFields, ...dateFields];
        if (!acceptedType.includes(searchType)) {
            throw new BadRequestException('Invalid Search Type');
        }

        const whereClause: any = {}

        if (stringFields.includes(searchType)) {
            whereClause[searchType] = {
                contains: filterValue,
                mode: 'insensitive'
            };
        } else if (intFields.includes(searchType)) {
            const numberValue = parseInt(filterValue);
            if (isNaN(numberValue)) {
                throw new BadRequestException(`${searchType} must be a valid number`);
            }
            whereClause[searchType] = numberValue;
        } else if (dateFields.includes(searchType)) {
            const dateValue = new Date(filterValue);
            if (isNaN(dateValue.getTime())) {
                throw new BadRequestException(`${searchType} must be a valid date`);
            }
            whereClause[searchType] = dateValue;
        }

        const searchResults = await this._db.hawbStock.findMany({
            where: {
                ...whereClause,
                deletedAt: null
            },
            include: {
                branchMaster: true,
                companyMaster: true,
                customerMaster: true
            }
        }).catch((err) => {
            throw new Error(`Error Occured : ${JSON.stringify(err), err}`);
        });

        return searchResults;
    }
}