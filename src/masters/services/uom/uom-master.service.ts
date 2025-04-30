import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import * as moment from 'moment-timezone';
import { DatabaseService } from 'src/database/database.service';

@Injectable()
export class UomService {
    constructor(
        private _db: DatabaseService
    ) { }

    async createUom(payload, user) { 

        const existing = await this._db.UOMMaster.findFirst({
            where: {
                OR:  [
                    {
                        UOMName: {
                            equals: payload.UOMName.trim(),
                            mode: 'insensitive',
                          }
                    },
                    {
                        UOMCode: {
                            equals: payload.UOMCode.trim(),
                            mode: 'insensitive',
                          }
                    }
                ] 
            },
        });

        if (existing) {
            
            if (existing.UOMName === payload.UOMName) {
                throw new BadRequestException('UOM name already exists');
            }
            if (existing.UOMCode === payload.UOMCode) {
                throw new BadRequestException('UOM code already exists');
            }
        }

        try {
            const uom = await this._db.UOMMaster.create({
                data: payload
            });
            return uom;
        } catch (error) {
            throw new Error(`creation failed: ${error.message}`);
        }
    }



    async getAllUom() {
        try {
            const uom = await this._db.UOMMaster.findMany({
                where: {
                    deletedAt: {
                        equals: null
                      }
                }
            });
            return uom;
        } catch (error) {
            throw error
        }
    }


    async findOne(UOMMasterSid: any) {
        try {
            return await this._db.UOMMaster.findUnique({
                
                where: {
                    UOMMasterSid: UOMMasterSid
                }
            });
        } catch (error) {
            throw error;
        }
    }


    async updateUom(UOMMasterSid: number, payload, user) {

        const existing = await this._db.UOMMaster.findFirst({
            where: {
                AND: [
                    {
                        OR:  [
                            {
                                UOMName: {
                                    equals: payload.UOMName.trim(),
                                    mode: 'insensitive',
                                  }
                            },
                            {
                                UOMCode: {
                                    equals: payload.UOMCode.trim(),
                                    mode: 'insensitive',
                                  }
                            }
                        ] 
                    },
                    {
                        NOT: {
                            UOMMasterSid: UOMMasterSid, 
                          }
                    }
            ]
            },
        });

        if (existing) {
            if (existing.UOMName === payload.UOMName) {
            //throw new Error('Port name already exists');
            throw new BadRequestException('UOM name already exists');
            }
            if (existing.UOMCode === payload.UOMCode) {
                throw new BadRequestException('UOM code already exists');
            }
        }

        try {
            const uom = await this._db.UOMMaster.update({
                where: {
                    UOMMasterSid: UOMMasterSid
                }, data: payload
            });
            return uom;
        } catch (error) {
            throw new Error(`Error updating uom: ${error.message}`);
        }
    }

    async softDelete(id: number) {
        const existingUom = await this._db.UOMMaster.findUnique({
            where: { UOMMasterSid: id }
        });

        if (!existingUom) {
            throw new NotFoundException(`Uom with ID ${id} not found`);
        }

        if (existingUom.deletedAt) {
            throw new Error(`Uom with ID ${id} is already deleted`);
        }

        // Perform soft delete by updating deletedAt field
        return this._db.UOMMaster.update({
            where: { UOMMasterSid: id },
            data: { deletedAt: new Date() }
        });
    }   










}