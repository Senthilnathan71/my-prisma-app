import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { DatabaseService } from 'src/database/database.service';
import { SearchListDto } from 'src/masters/DTO/search-list.dto';
import { SearchVesselDto } from 'src/masters/DTO/search-vessel.dto';

@Injectable()
export class CostCenterService {
    constructor(private _db: DatabaseService, private logger: Logger) { }

    async createCostCenter(payload: any, user) {
        this.logger.warn(`createCostCenter: ${payload}`);

        const existing = await this._db.costCenterMaster.findFirst({
            where: {
                OR: [
                    {
                        CostCenterName: {
                            equals: payload.CostCenterName.trim(),
                            mode: 'insensitive',
                        }
                    },
                    {
                        CostCenterCode: {
                            equals: payload.CostCenterCode.trim(),
                            mode: 'insensitive',
                        }
                    }
                ]
            },
        });

        if (existing) {
            if (existing.CostCenterName === payload.CostCenterName) {
                throw new BadRequestException('Cost-Center name already exists');
            }
            if (existing.CostCenterCode === payload.CostCenterCode) {
                throw new BadRequestException('Cost-Center code already exists');
            }
        }

        try {
            const CostCenter = await this._db.costCenterMaster.create({
                data: {
                    ...payload,
                }
            });

            return CostCenter;
        } catch (error) {
            console.log(error.stack)
            throw new Error(`Error crating Cost-Center: ${error.message}`);
        }
    }

    async getAllCostCenter() {
        try {
            const CostCenterList = await this._db.costCenterMaster.findMany({
                where: {
                    Status: 'A'
                }
            })
            return CostCenterList;
        } catch (error) {
            throw error
        }
    }

    async findOne(CostCenterMasterSid: any) {
        try {
            return await this._db.costCenterMaster.findUnique({
                where: {
                    CostCenterMasterSid: CostCenterMasterSid
                },
            });
        } catch (error) {
            throw error;
        }
    }

    async updateCostCenter(CostCenterMasterSid: number, payload: any, user) {
        const existing = await this._db.costCenterMaster.findUnique({
            where: {
                CostCenterMasterSid: CostCenterMasterSid
            }
        });

        if (!existing) {
            throw new Error('Cost-Center is not exists');
        }

        try {
            const CostCenter = await this._db.costCenterMaster.update({
                where: {
                    CostCenterMasterSid: CostCenterMasterSid
                }, data: payload
            });
            return CostCenter;
        } catch (error) {
            throw new Error(`Error updating Cost-Center: ${error.message}`);
        }
    }

    async softDelete(id: number) {
        const existingCostCenter = await this._db.costCenterMaster.findUnique({
            where: {CostCenterMasterSid: id}
        });

        if (!existingCostCenter) {
            throw new NotFoundException(`Cost-Center with ID ${id} not found`);
        }

        if (existingCostCenter.deletedAt) {
            throw new Error(`Cost-Center with ID ${id} is already deleted`);
        }

        return this._db.costCenterMaster.update({
            where: { CostCenterMasterSid: id},
            data: { deletedAt: new Date()}
        });
    }

    async searchList(params: SearchVesselDto) {
    const { search = '', page = 1, pageSize = 15 } = params;
    const skip = (page - 1) * pageSize;

    const where: Prisma.CostCenterMasterWhereInput = {
        deletedAt: null,
        Status: 'A',
        ...(search
            ? {
                OR: [
                    { CostCenterName: { contains: search, mode: 'insensitive' } },
                    { CostCenterCode: { contains: search, mode: 'insensitive' } },
                    { Remarks: { contains: search, mode: 'insensitive' } },
                    { Status: { contains: search, mode: 'insensitive' } },
                ],
            }
            : {}
        ),
    };

    const [items, totalCount] = await this._db.$transaction([
        this._db.costCenterMaster.findMany({
            where,
            skip,
            take: pageSize,
            orderBy: { CostCenterMasterSid: 'desc' },
        }),
        this._db.costCenterMaster.count({ where }),
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
