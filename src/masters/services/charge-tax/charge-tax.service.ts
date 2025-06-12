import { BadRequestException, Injectable } from '@nestjs/common';
import { DatabaseService } from 'src/database/database.service';
import { SearchListDto } from 'src/masters/DTO/search-list.dto';

@Injectable()
export class ChargeTaxService {
    constructor(private _db: DatabaseService) { }

    async getAllChargeTax() {
        try {
            const allChargeTax = await this._db.chargeTaxMaster.findMany({
                where: {
                    deletedAt: null
                },
                include: {
                    companyMaster: true
                }
            });
            return allChargeTax;
        } catch (error) {
            throw error;
        }
    }

    async createNewChargeTax(payload: any) {
        try {
            const createdChargeTax = await this._db.chargeTaxMaster.create({
                data: {
                    ...payload,
                }
            });
            return createdChargeTax;
        } catch (error) {
            throw error;
        }
    }

    async fetchChargeTaxById(ChargeTaxMasterSid: number) {
        try {
            const chargeTax = await this._db.chargeTaxMaster.findUnique({
                where: {
                    ChargeTaxMasterSid: ChargeTaxMasterSid
                },
                include: {
                    companyMaster: true
                }
            });
            if (!chargeTax) {
                throw new BadRequestException(`Charge Tax with Id : ${ChargeTaxMasterSid} not exists`);
            }
            return chargeTax;
        } catch (error) {
            throw error;
        }
    }

    async updateChargeTaxById(ChargeTaxMasterSid: number, payload: any) {
        try {
            const exist = await this._db.chargeTaxMaster.findUnique({
                where: {
                    ChargeTaxMasterSid: ChargeTaxMasterSid
                }
            });
            if (!exist) {
                throw new BadRequestException(`Charge Tax with Id : ${ChargeTaxMasterSid} not exists`);
            }
            const updatedChargeTax = await this._db.chargeTaxMaster.update({
                where: {
                    ChargeTaxMasterSid: ChargeTaxMasterSid
                },
                data: payload
            });
            return updatedChargeTax;
        } catch (error) {
            throw error;
        }
    }

    async deleteChargeTax(ChargeTaxMasterSid: number) {
        try {
            const exist = await this._db.chargeTaxMaster.findUnique({
                where: {
                    ChargeTaxMasterSid: ChargeTaxMasterSid
                }
            });
            if (!exist) {
                throw new BadRequestException(`Charge Tax with Id : ${ChargeTaxMasterSid} not exists`);
            }
            if (exist.deletedAt) {
                throw new BadRequestException(`Charge Tax with Id :${ChargeTaxMasterSid} is already deleted`);
            }
            const deletedChargeTax = await this._db.chargeTaxMaster.update({
                where: {
                    ChargeTaxMasterSid: ChargeTaxMasterSid
                },
                data: {
                    deletedAt: new Date()
                }
            });
            return deletedChargeTax;
        } catch (error) {
            throw error;
        }
    }

    async searchChargeTax(data: SearchListDto) {
        const { searchType, filterValue } = data;
        const intFields = [
            'ChargeTaxMasterSid',
            'CompanyMasterSid',
            'TaxRate'
        ];
        const stringFields = [
            'HSNCode',
            'description',
            'TaxGroup',
            'Status',
            'Remarks'
        ];
        const acceptedType = [...intFields, ...stringFields];
        if (!acceptedType.includes(searchType)) {
            throw new BadRequestException('Invalid Search Type');
        }

        const whereClause: any = {};

        if (stringFields.includes(searchType)) {
            whereClause[searchType] = {
                contains: filterValue,
                mode: 'insensitive'
            };
        } else if (intFields.includes(searchType)) {
            if (searchType === 'TaxRate') {
                const decimalValue = parseFloat(filterValue);
                if (isNaN(decimalValue)) {
                    throw new BadRequestException(`${searchType} must be a valid number`);
                }
                whereClause[searchType] = decimalValue;
            } else {
                const numberValue = parseInt(filterValue);
                if (isNaN(numberValue)) {
                    throw new BadRequestException(`${searchType} must be a valid number`);
                }
                whereClause[searchType] = numberValue;
            }
        }

        const searchResults = await this._db.chargeTaxMaster.findMany({
            where: {
                ...whereClause,
                deletedAt: null
            },
            include: {
                companyMaster: true
            }
        }).catch((err) => {
            throw new Error(`Error Occured : ${JSON.stringify(err), err}`);
        });

        return searchResults;
    }
}