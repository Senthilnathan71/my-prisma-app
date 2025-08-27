import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { DatabaseService } from 'src/database/database.service';
import { SearchListDto } from 'src/masters/DTO/search-list.dto';
import { SearchVesselDto } from 'src/masters/DTO/search-vessel.dto';

@Injectable()
export class ProfitCenterService {
    constructor(private _db: DatabaseService, private logger: Logger){ }
    
        async createProfitCenter(payload: any, user) {
            this.logger.warn(`createProfitCenter: ${payload}`);
    
            const existing = await this._db.profitCenterMaster.findFirst({
                where: {
                    OR: [
                        {
                            ProfitCenterName: {
                                equals: payload.ProfitCenterName.trim(),
                                mode: 'insensitive',
                            }
                        },
                        {
                            ProfitCenterCode: {
                                equals: payload.ProfitCenterCode.trim(),
                                mode: 'insensitive',
                            }
                        }
                    ]
                },
            });
    
            if (existing) {
                if (existing.ProfitCenterName === payload.ProfitCenterName) {
                    throw new BadRequestException('Profit-Center name already exists');
                }
                if (existing.ProfitCenterCode === payload.ProfitCenterCode) {
                    throw new BadRequestException('Profit-Center code already exists');
                }
            }
    
            try {
                const ProfitCenter = await this._db.profitCenterMaster.create({
                    data: {
                        ...payload,
                    }
                });
    
                return ProfitCenter;
            } catch (error) {
                console.log(error.stack)
                throw new Error(`Error creating Profit-Center: ${error.message}`);
            }
        }
    
        async getAllProfitCenter() {
            try {
                const ProfiCenterList = await this._db.profitCenterMaster.findMany({
                    where: {
                        Status: 'A'
                    }
                })
                return ProfiCenterList;
            } catch (error) {
                throw error
            }
        }
    
        async findOne(ProfitCenterMasterSid: any) {
            try {
                return await this._db.profitCenterMaster.findUnique({
                    where: {
                        ProfitCenterMasterSid: ProfitCenterMasterSid
                    },
                });
            } catch (error) {
                throw error;
            }
        }
    
        async updateProfitCenter(ProfitCenterMasterSid: number, payload: any, user) {
            const existing = await this._db.profitCenterMaster.findUnique({
                where: {
                    ProfitCenterMasterSid: ProfitCenterMasterSid
                }
            });
    
            if (!existing) {
                throw new Error('Profit-Center is not exists');
            }
    
            try {
                const ProfitCenter = await this._db.profitCenterMaster.update({
                    where: {
                        ProfitCenterMasterSid: ProfitCenterMasterSid
                    }, data: payload
                });
                return ProfitCenter;
            } catch (error) {
                throw new Error(`Error updating Profit-Center: ${error.message}`);
            }
        }
    
        async softDelete(id: number) {
            const existingProfitCenter = await this._db.profitCenterMaster.findUnique({
                where: {ProfitCenterMasterSid: id}
            });
    
            if (!existingProfitCenter) {
                throw new NotFoundException(`Profit-Center with ID ${id} not found`);
            }
    
            if (existingProfitCenter.Status === 'D') {
                throw new Error(`Profit-Center with ID ${id} is already deleted`);
            }
    
            return this._db.profitCenterMaster.update({
                where: {ProfitCenterMasterSid: id},
                data: { Status:'D'}
            });
        }
    
       async searchProfitCenterNew(params: SearchVesselDto) {
        const { search = '', page =1, pageSize = 15 } = params;
        const skip = (page - 1) * pageSize;

        const where: Prisma.ProfitCenterMasterWhereInput = {
            Status: 'A',
            ...(search
                ? {
                    OR: [
                        { ProfitCenterName: { contains: search, mode: 'insensitive'} },
                        { ProfitCenterName: { contains: search, mode: 'insensitive'} },
                        { Remarks: { contains: search, mode: 'insensitive'} },
                        {Status: { contains: search, mode: 'insensitive'} },
                    ],
                }
                : {}
            ),
        };

        const [items, totalCount] = await this._db.$transaction([
            this._db.profitCenterMaster.findMany({
                where,
                skip,
                take: pageSize,
                orderBy: { ProfitCenterMasterSid: 'desc'},
            }),
            this._db.profitCenterMaster.count({ where }),
        ]);

        return {
            items,
            totalCount,
        };
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
