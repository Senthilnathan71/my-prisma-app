import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { DatabaseService } from 'src/database/database.service';
import { SearchListDto } from 'src/masters/DTO/search-list.dto';

@Injectable()
export class TariffService {
    constructor(private _db: DatabaseService) { }

    async createNewTariff(newData: Prisma.TariffHeaderCreateInput) {
        try {
            let createdTariff = await this._db.tariffHeader.create({
                data: {
                    ...newData,
                    createdBy: 'admin@crm.com'
                }
            })
            return createdTariff;
        } catch (error) {
            throw error;
        }
    }

    async getAllTariff() {
        try {
            let allTariff = await this._db.tariffHeader.findMany({
                where: {
                    deletedAt: null
                }
            })
            return allTariff;
        } catch (error) {
            throw error;
        }
    }


    async getTariffById(TariffHeaderSid: number) {
        try {
            let ourTariff = await this._db.tariffHeader.findUnique({
                where: {
                    TariffHeaderSid: TariffHeaderSid
                }
            })
            if (!ourTariff) {
                throw new BadRequestException(`Tariff with id : ${TariffHeaderSid} not exists`);
            }
            return ourTariff;
        } catch (error) {
            throw error;
        }
    }


    async updateTariffById(TariffHeaderSid: number, updateData: Prisma.TariffHeaderUpdateInput) {
        try {
            let exists = await this._db.tariffHeader.findUnique({
                where: {
                    TariffHeaderSid: TariffHeaderSid
                }
            })
            if (!exists) {
                throw new BadRequestException(`Tariff with id : ${TariffHeaderSid} not exists`);
            }
            let updatedTariff = await this._db.tariffHeader.update({
                where: {
                    TariffHeaderSid: TariffHeaderSid
                },
                data: updateData
            })
            return updatedTariff;
        } catch (error) {
            throw error;
        }
    }



    async deleteTariffById(TariffHeaderSid: number) {
        try {
            let exists = await this._db.tariffHeader.findUnique({
                where: {
                    TariffHeaderSid: TariffHeaderSid
                }
            })
            if (!exists) {
                throw new BadRequestException(`Tariff with id : ${TariffHeaderSid} not exists`);
            }
            if (exists.deletedAt) {
                throw new BadRequestException(`Tariff with id : ${TariffHeaderSid} is already deleted`);
            }
            let deletedTariff = await this._db.tariffHeader.update({
                where: {
                    TariffHeaderSid: TariffHeaderSid
                },
                data: {
                    deletedAt: new Date()
                }
            })
            return deletedTariff;
        } catch (error) {
            throw error;
        }
    }

    async searchTariff(data: SearchListDto) {
        const { searchType, filterValue } = data;
        const acceptedType = [
            "DepartmentName",
            "POLTerminal",
            "PODTerminal",
            "Carrier",
            "EffectiveDate",
            "AgentSid",
            "status"
        ];
        if (!acceptedType.includes(searchType)) {
            throw new BadRequestException(`Invalid Search Type`);
        }
        const searchResults = await this._db.tariffHeader.findMany({
            where: {
                [searchType]: {
                    contains: filterValue,
                    mode: 'insensitive'
                },
                deletedAt: null
            }
        }).catch((err) => {
            throw new Error(`Error Occurred : ${JSON.stringify(err), err}`);
        })
        return searchResults;
    }
}
