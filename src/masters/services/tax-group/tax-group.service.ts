import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { equals } from 'class-validator';
import { isDate } from 'node:util/types';
import { statusWhereClause } from 'src/common/helper';
import { DatabaseService } from 'src/database/database.service';
import { SearchListDto } from 'src/masters/DTO/search-list.dto';
import { filterDto } from 'src/masters/DTO/search-vessel.dto';

@Injectable()
export class TaxGroupService {
      constructor(private _db: DatabaseService) { }
    
        async getAllTaxGroup() {
            try {
                const allTax = await this._db.taxGroup.findMany({
                    where: {
                        Status: 'A',
                    },
                    select: {
                        TaxGroupSid: true,
                        TaxGroup: true,
                        TaxRate: true,
                        Status: true,
                    },
                })
                return allTax;
            } catch (error) {
                throw error;
            }
        }
    
        async createNewTaxGroup(payload) {
    
            const existing = await this._db.taxGroup.findFirst({
                where: {
                    OR: [
                        {
                            TaxGroup: {
                                equals: String(payload.TaxGroup).trim(),
                                mode: 'insensitive'
                            }
                        },
                        {
                            TaxRate: {
                                equals: String(payload.TaxRate).trim(),
                            }
                        }
                    ],
                    Status: 'A'
                }
            });
    
            if (existing) {
                if (existing.TaxGroup === payload.TaxGroup) {
                    throw new BadRequestException('Tax Group already exists');
                }
                if (existing.TaxRate === payload.TaxRate) {
                    throw new BadRequestException('Tax Rate already exists');
                }
            }
    
            try {
                const createdTax = await this._db.taxGroup.create({
                    data: {
                        ...payload,
                    }
                });
                return createdTax;
            } catch (error) {
                throw error;
            }
        }
    
    
        async fetchTaxGroupById(TaxGroupSid: number) {
            try {
                const ourTax = await this._db.taxGroup.findUnique({
                    where: {
                        TaxGroupSid: TaxGroupSid
                    }
                })
                if (!ourTax) {
                    throw new BadRequestException(`Tax-Group with Id : ${TaxGroupSid} not exists`);
                }
                return ourTax;
            } catch (error) {
                throw error;
            }
        }
    
        async updateTaxGroupById(TaxGroupSid: number, payload) {
    
            const duplicate = await this._db.taxGroup.findFirst({
                where: {
                    AND: [
                        {
                            TaxGroupSid: { not: TaxGroupSid }
                        },
                        {
                            OR: [
                                {
                                    TaxGroup: {
                                        equals: String(payload.TaxGroup).trim(),
                                        mode: 'insensitive'
                                    }
                                },
                                {
                                    TaxRate: {
                                        equals: String(payload.TaxRate).trim(),
                                    }
                                }
                            ]
                        }
                    ],
                    Status: 'A'
                }
            });
    
            if (duplicate) {
                if (duplicate.TaxGroup === payload.TaxGroup) {
                    throw new BadRequestException('Tax Groupalready exists');
                }
                if (duplicate.TaxRate === payload.TaxRate) {
                    throw new BadRequestException('Tax Rate already exists');
                }
            }
    
            try {
                const exist = await this._db.taxGroup.findUnique({
                    where: {
                        TaxGroupSid: TaxGroupSid
                    }
                });
                if (!exist) {
                    throw new BadRequestException(`Tax-Group with Id : ${TaxGroupSid} not exists`);
                }
                const updatedTax = await this._db.taxGroup.update({
                    where: {
                        TaxGroupSid: TaxGroupSid
                    },
                    data: payload
                });
                return updatedTax;
            } catch (error) {
                throw error;
            }
        }
    
    
        async deleteTaxGroup(TaxGroupSid: number) {
            try {
                const exist = await this._db.taxGroup.findUnique({
                    where: {
                        TaxGroupSid: TaxGroupSid
                    }
                })
                if (!exist) {
                    throw new BadRequestException(`Tax-Group with Id : ${TaxGroupSid} not exists`);
                }
                if (exist.Status === 'D') {
                    throw new BadRequestException(`Tax-Group with Id :${TaxGroupSid} is already deleted`)
                }
                const deletedTax = this._db.taxGroup.update({
                    where: {
                        TaxGroupSid: TaxGroupSid
                    },
                    data: {
                        Status: 'A'
                    }
                })
                return deletedTax;
            } catch (error) {
                throw error;
            }
        }
    
    
        async searchTaxGroupMaster(params: filterDto) {
            const { search = '', page = 1, pageSize = 15 } = params;
            const skip = (page - 1) * pageSize;
            const where: Prisma.TaxGroupWhereInput = {
                Status: statusWhereClause,
                ...(search
                    ? {
                        OR: [
                            { TaxGroup: { contains: search, mode: 'insensitive' } },
                        ]
                    }
                    : {}),
            };
    
            const [items, totalCount] = await this._db.$transaction([
                this._db.taxGroup.findMany({
                    where,
                    skip,
                    take: pageSize,
                    orderBy: { TaxGroupSid: 'desc' },
                }),
                this._db.taxGroup.count({ where }),
            ]);
    
            return {
                items,
                totalCount,
                currentPage: page,
                totalPages: Math.ceil(totalCount / pageSize),
            };
        }
}
