import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { DatabaseService } from 'src/database/database.service';
import { SearchListDto } from 'src/masters/DTO/search-list.dto';
import { SearchVesselDto } from 'src/masters/DTO/search-vessel.dto';

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

    async searchChargeTax(params: SearchVesselDto) {
    const { search = '', page = 1, pageSize = 15 } = params;
    const skip = (page - 1) * pageSize;

    const where: Prisma.ChargeTaxMasterWhereInput = {
        deletedAt: null,
        Status: 'A',
        OR: search ? [
          
            { HSNCode: { contains: search, mode: 'insensitive' } },
            { description: { contains: search, mode: 'insensitive' } },
            { TaxGroup: { contains: search, mode: 'insensitive' } },
            { Status: { contains: search, mode: 'insensitive' } },
            { Remarks: { contains: search, mode: 'insensitive' } },
            
            ...(!isNaN(Number(search)) ? [
                { ChargeTaxMasterSid: Number(search) },
                { CompanyMasterSid: Number(search) },
                { TaxRate: Number(search) }
            ] : [])
        ] : undefined
    };

    const [items, totalCount] = await this._db.$transaction([
        this._db.chargeTaxMaster.findMany({
            where,
            skip,
            take: pageSize,
            include: {
                companyMaster: true,
            },
            orderBy: { ChargeTaxMasterSid: 'desc' },
        }),
        this._db.chargeTaxMaster.count({ where }),
    ]);

    return {
        items,
        totalCount,
    };
}

}