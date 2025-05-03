import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from 'src/database/database.service';

@Injectable()
export class UnitService {
    constructor(
        private _db: DatabaseService
    ) { }

    async getAllUnit() {
        try {

            const unitList = await this._db.unitMaster.findMany({
                where: {
                    deletedAt: {
                        equals: null
                      }
                }
            })
            return unitList;
        } catch (error) {
            throw error
        }
    }

    async createUnit(payload, user) { 
    
            const existing = await this._db.unitMaster.findFirst({
                where: {
                    OR:  [
                        {
                            unitName: {
                                equals: payload.unitName.trim(),
                                mode: 'insensitive',
                              }
                        },
                        {
                            unitCode: {
                                equals: payload.unitCode.trim(),
                                mode: 'insensitive',
                              }
                        }
                    ] 
                },
            });
    
            if (existing) {
                
                if (existing.unitName === payload.unitName) {
                    throw new BadRequestException('Unit name already exists');
                }
                if (existing.unitCode === payload.unitCode) {
                    throw new BadRequestException('Unit code already exists');
                }
            }
    
            try {
                const unit = await this._db.unitMaster.create({
                    data: payload
                });
                return unit;
            } catch (error) {
                throw new Error(`creation failed: ${error.message}`);
            }
        }
    
        async findOne(UnitMasterSid: any) {
            try {
                return await this._db.unitMaster.findUnique({
                    
                    where: {
                        UnitMasterSid: UnitMasterSid
                    }
                });
            } catch (error) {
                throw error;
            }
        }
    
    
        async updateUnit(UnitMasterSid: number, payload, user) {
    
            const existing = await this._db.unitMaster.findFirst({
                where: {
                    AND: [
                        {
                            OR:  [
                                {
                                    unitName: {
                                        equals: payload.unitName.trim(),
                                        mode: 'insensitive',
                                      }
                                },
                                {
                                    unitCode: {
                                        equals: payload.unitCode.trim(),
                                        mode: 'insensitive',
                                      }
                                }
                            ] 
                        },
                        {
                            NOT: {
                                UnitMasterSid: UnitMasterSid, 
                              }
                        }
                ]
                },
            });
    
            if (existing) {
                if (existing.unitName === payload.unitName) {
                //throw new Error('Port name already exists');
                throw new BadRequestException('Unit name already exists');
                }
                if (existing.unitCode === payload.unitCode) {
                    throw new BadRequestException('Unit code already exists');
                }
            }
    
            try {
                const unit = await this._db.unitMaster.update({
                    where: {
                        UnitMasterSid: UnitMasterSid
                    }, data: payload
                });
                return unit;
            } catch (error) {
                throw new Error(`Error updating unit: ${error.message}`);
            }
        }
    
        async softDelete(id: number) {
            const existingUnit = await this._db.unitMaster.findUnique({
                where: { UnitMasterSid: id }
            });
    
            if (!existingUnit) {
                throw new NotFoundException(`UUnit with ID ${id} not found`);
            }
    
            if (existingUnit.deletedAt) {
                throw new Error(`Unit with ID ${id} is already deleted`);
            }
    
            // Perform soft delete by updating deletedAt field
            return this._db.unitMaster.update({
                where: { UnitMasterSid: id },
                data: { deletedAt: new Date() }
            });
        }  


}
