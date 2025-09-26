import { BadRequestException, Injectable } from '@nestjs/common';
import { statusWhereClause } from 'src/common/helper';
import { DatabaseService } from 'src/database/database.service';
import { SearchListDto } from 'src/masters/DTO/search-list.dto';

@Injectable()
export class TariffDetailService {
    constructor(private _db: DatabaseService) { }

    async getAllTariffDetails() {
        try {
            const allTariffDetails = await this._db.tariffDetail.findMany({
                where: {
                    status:statusWhereClause,
                },
                include: {
                    UOMMaster: {
                        select: {
                            UOMName: true
                        }
                    },
                    currencyMasterBuy: {
                        select: {
                            currencyCode: true
                        }
                    },
                    currencyMasterSale: {
                        select: {
                            currencyCode: true
                        }
                    },
                }
            })
            return allTariffDetails;
        } catch (error) {
            throw error;
        }
    }

    async createNewTariffDetail(payload) {
        try {
            const createdTariffDetail = await this._db.tariffDetail.create({
                data: {
                    ...payload,
                }
            })
            return createdTariffDetail;
        } catch (error) {
            throw error;
        }
    }

    async fetchTariffDetail(TariffDetailSid: number) {
        try {
            const ourTariffDetail = await this._db.tariffDetail.findUnique({
                where: {
                    TariffDetailSid: TariffDetailSid
                }
            })
            if (!ourTariffDetail) {
                throw new BadRequestException(`Tariff Detail with Id : ${TariffDetailSid} not exists`);
            }
            return ourTariffDetail;
        } catch (error) {
            throw error;
        }
    }

    async updateTariffDetailById(TariffDetailSid: number, payload) {
        try {
            const exist = await this._db.tariffDetail.findUnique({
                where: {
                    TariffDetailSid: TariffDetailSid
                }
            })
            if (!exist) {
                throw new BadRequestException(`Tariff Detail with Id : ${TariffDetailSid} not exists`);
            }
            const updatedTariffDetail = this._db.tariffDetail.update({
                where: {
                    TariffDetailSid: TariffDetailSid
                },
                data: payload
            })
            return updatedTariffDetail;
        } catch (error) {
            throw error;
        }
    }


    async deleteTariffDetails(TariffDetailSid: number) {
        try {
            const exist = await this._db.tariffDetail.findUnique({
                where: {
                    TariffDetailSid: TariffDetailSid
                }
            })
            if (!exist) {
                throw new BadRequestException(`Tariff Detail with Id : ${TariffDetailSid} not exists`);
            }
            if (exist.status==='D') {
                throw new BadRequestException(`Tariff detail with Id :${TariffDetailSid} is already deleted`)
            }
            const deletedTariffDetail = this._db.tariffDetail.update({
                where: {
                    TariffDetailSid: TariffDetailSid
                },
                data: {
                    status:'D'
                }
            })
            return deletedTariffDetail;
        } catch (error) {
            throw error;
        }
    }


    async searchTariffDetail(data: SearchListDto) {
        const { searchType, filterValue } = data;
        const intFields = [''];
        const stringFields = [
            "EffectiveDate",
            "ChargeCode",
            "CargoType",
            "IsSlabApplicable",
            "SlabFrom",
            "SlabTo",
            "status"
        ];
        const acceptedType = [...intFields, ...stringFields];
        if (!acceptedType.includes(searchType)) {
            throw new BadRequestException('Invalid Search Type');
        }

        const whereClause: any = {}

        if (stringFields.includes(searchType)) {
            whereClause[searchType] = {
                contains: filterValue,
                mode: 'insensitive'
            }
        } else if (intFields.includes(searchType)) {
            const numberValue = parseInt(filterValue);
            if (isNaN(numberValue)) {
                throw new BadRequestException(`${searchType} must be a valid number`);
            }
            whereClause[searchType] = numberValue;
        }

        const searchResults = await this._db.tariffDetail.findMany({
            where:{ 
                ...whereClause,
                status:'A'
            }
        }).catch((err) => {
            throw new Error(`Error Occured : ${JSON.stringify(err), err}`);
        })

        return searchResults;

    }

}
