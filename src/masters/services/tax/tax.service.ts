import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { equals } from 'class-validator';
import { isDate } from 'node:util/types';
import { DatabaseService } from 'src/database/database.service';
import { SearchListDto } from 'src/masters/DTO/search-list.dto';
import { SearchVesselDto } from 'src/masters/DTO/search-vessel.dto';

@Injectable()
export class TaxService {
    constructor(private _db:DatabaseService){}

    async getAllTax(){
        try {
            const allTax = await this._db.taxMaster.findMany({
                where : {
                    Status : 'A',
                }
            })
            return allTax;
        } catch (error) {
            throw error;
        }
    }

    async createNewTax(payload) {
       
        const existing = await this._db.taxMaster.findFirst({
            where: {
                OR: [
                    { 
                        TaxCode: { 
                            equals: payload.TaxCode.trim(),
                            mode: 'insensitive' 
                        } 
                    },
                    { 
                        TaxName: { 
                            equals: payload.TaxName.trim(),
                            mode: 'insensitive' 
                        } 
                    }
                ],
                Status:'A'
            }
        });

        if (existing) {
            if (existing.TaxCode === payload.TaxCode) {
                throw new BadRequestException('Tax code already exists');
            }
            if (existing.TaxName === payload.TaxName) {
                throw new BadRequestException('Tax name already exists');
            }
        }

        try {
            const createdTax = await this._db.taxMaster.create({
                data: {
                    ...payload,
                }
            });
            return createdTax;
        } catch (error) {
            throw error;
        }
    }


    async fetchTaxById(TaxMasterSid:number){
        try {
            const ourTax =await this._db.taxMaster.findUnique({
                where : {
                    TaxMasterSid:TaxMasterSid
                }
            })
            if(!ourTax){
                throw new BadRequestException(`Tax with Id : ${TaxMasterSid} not exists`);
            }
            return ourTax;
        } catch (error) {
            throw error;
        }
    }

    async updateTaxById(TaxMasterSid: number, payload) {
        
        const duplicate = await this._db.taxMaster.findFirst({
            where: {
                AND: [
                    {
                        TaxMasterSid: { not: TaxMasterSid } 
                    },
                    {
                        OR: [
                            { 
                                TaxCode: { 
                                    equals: payload.TaxCode?.trim(),
                                    mode: 'insensitive' 
                                } 
                            },
                            { 
                                TaxName: { 
                                    equals: payload.TaxName?.trim(),
                                    mode: 'insensitive' 
                                } 
                            }
                        ]
                    }
                ],
                Status:'A'
            }
        });

        if (duplicate) {
            if (duplicate.TaxCode === payload.TaxCode) {
                throw new BadRequestException('Tax code already exists');
            }
            if (duplicate.TaxName === payload.TaxName) {
                throw new BadRequestException('Tax name already exists');
            }
        }

        try {
            const exist = await this._db.taxMaster.findUnique({
                where: {
                    TaxMasterSid: TaxMasterSid
                }
            });
            if (!exist) {
                throw new BadRequestException(`Tax with Id : ${TaxMasterSid} not exists`);
            }
            const updatedTax = await this._db.taxMaster.update({
                where: {
                    TaxMasterSid: TaxMasterSid
                },
                data: payload
            });
            return updatedTax;
        } catch (error) {
            throw error;
        }
    }


    async deleteTax(TaxMasterSid:number){
        try {
            const exist = await this._db.taxMaster.findUnique({
                where: {
                    TaxMasterSid: TaxMasterSid
                }
            })
            if (!exist) {
                throw new BadRequestException(`Tax with Id : ${TaxMasterSid} not exists`);
            }
            if (exist.Status==='D') {
                throw new BadRequestException(`Tax with Id :${TaxMasterSid} is already deleted`)
            }
            const deletedTax = this._db.taxMaster.update({
                where: {
                    TaxMasterSid: TaxMasterSid
                },
                data: {
                    Status:'A'
                }
            })
            return deletedTax;
        } catch(error) {
            throw error;
        }
    }


   async searchTax(params: SearchVesselDto) {
    const { search = '', page = 1, pageSize = 15 } = params;
    const skip = (page - 1) * pageSize;
    const where : Prisma.TaxMasterWhereInput = {
        Status: 'A',
        ...(search
            ? {
                OR: [
                    { TaxName: { contains: search, mode: 'insensitive' } },
                    { TaxCode: { contains: search, mode: 'insensitive' } },
                    { TaxType: { contains: search, mode: 'insensitive' } },
                    ...(isNaN(Date.parse(search)) ? [] : [{
                        EffectiveFrom: { equals: new Date(search) }
                    }]),
                    ...(isNaN(Number(search)) ? [] : [{
                        TaxRate: { equals: Number(search) }
                    }]),
                    { Remarks: { contains: search, mode: 'insensitive' } },
                ]
            }
            : {}),
    };

    const [items, totalCount] = await this._db.$transaction([
        this._db.taxMaster.findMany({
            where,
            skip,
            take: pageSize,
            orderBy: { TaxMasterSid: 'desc' },
        }),
        this._db.taxMaster.count({ where }),
    ]);

    return {
        items,
        totalCount,
        currentPage: page,
        totalPages: Math.ceil(totalCount / pageSize),
    };
}
}
