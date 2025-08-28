import { BadRequestException, Injectable, NotFoundException,Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import * as moment from 'moment-timezone';
import { DatabaseService } from 'src/database/database.service';
import { SearchListDto } from 'src/masters/DTO/search-list.dto';
import { SearchVesselDto } from 'src/masters/DTO/search-vessel.dto';

@Injectable()
export class UomService {
    constructor(
        private _db: DatabaseService,private logger: Logger
    ) { }

    async createUom(payload, user) {

        const existing = await this._db.uOMMaster.findFirst({
            where: {
                OR: [
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
            const uom = await this._db.uOMMaster.create({
                data: payload
            });
            return uom;
        } catch (error) {
            throw new Error(`creation failed: ${error.message}`);
        }
    }



    async getAllUom() {
        try {
            const uom = await this._db.uOMMaster.findMany({
                where: {
                  status:"A"
                }
            });
            return uom;
        } catch (error) {
            throw error
        }
    }


    async findOne(uOMMasterSid: any) {
        try {
            return await this._db.uOMMaster.findUnique({

                where: {
                    UOMMasterSid: uOMMasterSid
                }
            });
        } catch (error) {
            throw error;
        }
    }


    async updateUom(uOMMasterSid: number, payload, user) {

        const existing = await this._db.uOMMaster.findFirst({
            where: {
                AND: [
                    {
                        OR: [
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
                            UOMMasterSid: uOMMasterSid,
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
            const uom = await this._db.uOMMaster.update({
                where: {
                    UOMMasterSid: uOMMasterSid
                }, data: payload
            });
            return uom;
        } catch (error) {
            throw new Error(`Error updating uom: ${error.message}`);
        }
    }

    async softDelete(id: number) {
        const existingUom = await this._db.uOMMaster.findUnique({
            where: { UOMMasterSid: id }
        });

        if (!existingUom) {
            throw new NotFoundException(`Uom with ID ${id} not found`);
        }

        if (existingUom.status==="D") {
            throw new Error(`Uom with ID ${id} is already deleted`);
        }

        // Perform soft delete by updating deletedAt field
        return this._db.uOMMaster.update({
            where: { UOMMasterSid: id },
            data: { status:"D" }
        });
    }

    async searchUomNew(params: SearchVesselDto) {
        const { search = '', page = 1, pageSize = 15 } = params;
        const skip = (page - 1) * pageSize;

        const where: Prisma.UOMMasterWhereInput = {
          
            status: 'A',
            ...(search
                ? {
                    OR: [
                        { UOMName: { contains: search, mode: 'insensitive'} },
                        { UOMCode: { contains: search, mode: 'insensitive'} },
                    ],
                }
                : {}
            ),
        };

        const [items, totalCount] = await this._db.$transaction([
            this._db.uOMMaster.findMany({
                where,
                skip,
                take: pageSize,
                orderBy: { UOMMasterSid: 'desc'},
            }),
            this._db.uOMMaster.count({ where }),
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