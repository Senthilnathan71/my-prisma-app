import { BadRequestException, Injectable, NotFoundException,Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { DatabaseService } from 'src/database/database.service';
import { SearchListDto } from 'src/masters/DTO/search-list.dto';
import { SearchVesselDto } from 'src/masters/DTO/search-vessel.dto';

@Injectable()
export class UnitService {
    constructor(
        private _db: DatabaseService,private logger: Logger
    ) { }

    async getAllUnit() {
        try {

            const unitList = await this._db.unitMaster.findMany({
                where: {
                  status: 'A',
                }
            })
            return unitList;
        } catch (error) {
            throw error
        }
    }

    async createUnit(payload) { 
    
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
    
    
        async updateUnit(UnitMasterSid: number, payload) {
    
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
    
            if (existingUnit.status==="D") {
                throw new Error(`Unit with ID ${id} is already deleted`);
            }
    
            // Perform soft delete by updating deletedAt field
            return this._db.unitMaster.update({
                where: { UnitMasterSid: id },
                data: { status:"D"}
            });
        }  

       async searchUnitNew(params: SearchVesselDto) {
        const { search = '', page = 1, pageSize = 15} = params;
        const skip = (page - 1) * pageSize;

        const where: Prisma.UnitMasterWhereInput = {
           
            status: 'A',
            ...(search
                ? {
                    OR: [
                        { unitName: { contains: search, mode: 'insensitive'} },
                        { unitCode: { contains: search, mode: 'insensitive'} },
                        { jobType: { contains: search, mode: 'insensitive'} },
                        { containerType: { contains: search, mode: 'insensitive'} },
                        { measurementType: { contains: search, mode: 'insensitive'} },
                        { status: { contains: search, mode: 'insensitive'} },
                    ],
                }
                : {} 
            ),
        };

        const [items, totalCount] = await this._db.$transaction([
            this._db.unitMaster.findMany({
                where,
                skip,
                take: pageSize,
                orderBy: { UnitMasterSid: 'desc'},
            }),
            this._db.unitMaster.count({ where }),
        ]);

        return {
            items,
            totalCount,
        };
       }
    
    async getWeightUnits() {
        try {
            const weightUnits = await this._db.unitMaster.findMany({
                where : {
                    measurementType : 'Weight',
                   
                }
            })
            return weightUnits;
        } catch (error) {
            throw error;
        }
    }
    async getAuditLogs(tableName: string, recordId?: string) {
    try {
      const whereClause: any = { tableName };
      if (recordId) whereClause.recordId = recordId;

      const logs = await this._db.auditLog.findMany({
        where: whereClause,
        orderBy: { changedAt: 'desc' },
      });

      return logs;
    } catch (error) {
      this.logger.warn(`getAuditLogsError: ${error}`);
      throw new Error(`Error fetching audit logs: ${error.message}`);
    }
  }
}
