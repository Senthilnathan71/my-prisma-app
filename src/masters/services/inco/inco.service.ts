import { BadRequestException, Injectable, Logger, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { DatabaseService } from "src/database/database.service";
import { SearchListDto } from "src/masters/DTO/search-list.dto";
import { SearchVesselDto } from "src/masters/DTO/search-vessel.dto";

@Injectable()
export class IncoService {
    constructor(private _db: DatabaseService, private logger: Logger) { }

    async createInco(payload: any) {
        this.logger.warn(`createInco: ${payload}`);

        const existing = await this._db.incoMaster.findFirst({
            where: {
                OR: [
                    {
                        IncoName: {
                            equals: payload.IncoName.trim(),
                            mode: 'insensitive',
                        }
                    },
                    {
                        IncoCode: {
                            equals: payload.IncoCode.trim(),
                            mode: 'insensitive',
                        }
                    }
                ]
            },
        });

        if (existing) { 
            if (existing.IncoName === payload.IncoName) {
                throw new BadRequestException('Inco name already exists');
            }
            if (existing.IncoCode === payload.IncoCode) {
                throw new BadRequestException('Inco code already exists');
            }
        }

        try {
            const Inco = await this._db.incoMaster.create({
                data: {
                    ...payload,
                }
            });

            return Inco;
        } catch (error) {
            console.log(error.stack)
            throw new Error(`Error creating Inco: ${error.message}`);
        }
    }

    async getAllInco() {
        try {
            const IncoList = await this._db.incoMaster.findMany({
                where: {
                    Status: 'A',
                }
            })
            return IncoList;
        } catch (error) {
            throw error
        }
    }

    async findOne(IncoMasterSid: any) {
        try {
            return await this._db.incoMaster.findUnique({
                where: {
                    IncoMasterSid: IncoMasterSid
                },
            });
        } catch (error) {
            throw error;
        }
    }

    async updateInco(IncoMasterSid: number, payload: any) {
        const existing = await this._db.incoMaster.findUnique({
            where: {
                IncoMasterSid: IncoMasterSid
            }
        });

        if (!existing) {
            throw new Error('Inco is not exists');
        }

        try {
            const Inco = await this._db.incoMaster.update({
                where: {
                    IncoMasterSid: IncoMasterSid
                }, data: payload
            });
            return Inco;
        } catch (error) {
            throw new Error(`Error updating Inco: ${error.message}`);
        }
    }

    async softDelete(id: number) {
        const existingInco = await this._db.incoMaster.findUnique({
            where: {IncoMasterSid: id}
        });

        if (!existingInco) {
            throw new NotFoundException(`Inco with ID ${id} not found`);
        }

        if (existingInco.Status === 'D') {
            throw new Error(`Inco with ID ${id} is already deleted`);
        }

        return this._db.incoMaster.update({
            where: { IncoMasterSid:  id},
            data: { Status : 'D' }
        });
    }

    async searchList(params: SearchVesselDto) {
    const { search = '', page = 1, pageSize = 15 } = params;
    const skip = (page - 1) * pageSize;

    const where: Prisma.IncoMasterWhereInput = {
        Status: 'A',
        ...(search
            ? {
                OR: [
                    { IncoName: { contains: search, mode: 'insensitive' } },
                    { IncoCode: { contains: search, mode: 'insensitive' } },
                    { IncoType: { contains: search, mode: 'insensitive' } },
                    { OceanFreight: { contains: search, mode: 'insensitive' } },
                    { Status: { contains: search, mode: 'insensitive' } },
                ],
            }
            : {}
        ),
    };

    const [items, totalCount] = await this._db.$transaction([
        this._db.incoMaster.findMany({
            where,
            skip,
            take: pageSize,
            orderBy: { IncoMasterSid: 'desc' },
        }),
        this._db.incoMaster.count({ where }),
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