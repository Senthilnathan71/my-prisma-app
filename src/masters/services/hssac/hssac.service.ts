import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { statusWhereClause } from 'src/common/helper';
import { DatabaseService } from 'src/database/database.service';
import { SearchListDto } from 'src/masters/DTO/search-list.dto';
import { filterDto } from 'src/masters/DTO/search-vessel.dto';

@Injectable()
export class HssacService {
    constructor(private _db: DatabaseService, private logger: Logger) { }


    async createHssac(payload: any, user) {
        this.logger.warn(`createHssac: ${payload}`);


        const existing = await this._db.hSSACMaster.findFirst({
            where: {
                AND: [
                    {
                        HSSACName: {
                            equals: payload.HSSACName.trim(),
                            mode: 'insensitive',
                        },
                    },
                    {
                        HSSACCode: {
                            equals: payload.HSSACCode.trim(),
                            mode: 'insensitive',
                        },
                    },
                    {
                        TaxType: payload.TaxType,
                    },
                    {
                        status: { not: 'D' } // ignore deleted records (optional but recommended)
                    }
                ],
            },
        });

        if (existing) {
            throw new BadRequestException(
                'HS-SAC with same Name, Code and Tax Type already exists'
            );
        }

        try {
            const Hssac = await this._db.hSSACMaster.create({
                data: {
                    ...payload,
                }
            });

            return Hssac;
        } catch (error) {
            console.log(error.stack)
            throw new Error(`Error creating Hssac: ${error.message}`);
        }
    }


    async getAllHssac() {
        try {
            const HssacList = await this._db.hSSACMaster.findMany({
                where: {
                    status: 'A',

                }
            })
            return HssacList;
        } catch (error) {
            throw error
        }
    }

    async getHssacByCountry(countryMasterSid: number, taxType?: string) {
        try {
            const taxWhere: Prisma.TaxMasterWhereInput = {
                Status: 'A',
                CountryMasterSid: countryMasterSid,
                TaxGroupSid: { not: null },
                ...(taxType ? { TaxType: taxType } : {}),
            };

            const countryTaxGroups = await this._db.taxMaster.findMany({
                where: taxWhere,
                select: { TaxGroupSid: true },
                distinct: ['TaxGroupSid'],
            });

            const taxGroupSids = countryTaxGroups
                .map((tax) => tax.TaxGroupSid)
                .filter((taxGroupSid): taxGroupSid is number => taxGroupSid !== null && taxGroupSid !== undefined);

            if (!taxGroupSids.length) return [];

            return await this._db.hSSACMaster.findMany({
                where: {
                    status: 'A',
                    TaxGroupSid: { in: taxGroupSids },
                },
                include: {
                    taxGroup: true,
                },
                orderBy: { HSSACMasterSid: 'asc' },
            });
        } catch (error) {
            throw error;
        }
    }





    async findOne(HssacMasterSid: any) {
        try {
            return await this._db.hSSACMaster.findUnique({
                where: {
                    HSSACMasterSid: HssacMasterSid
                },
            });
        } catch (error) {
            throw error;
        }
    }


    async updateHssac(HssacMasterSid: number, payload: any, user) {

        const existing = await this._db.hSSACMaster.findUnique({
            where: {
                HSSACMasterSid: HssacMasterSid
            }
        });

        if (!existing) {
            throw new Error('Hssac is not exists');
        }
        const existingDuplicate = await this._db.hSSACMaster.findFirst({
            where: {
                AND: [
                    {
                        HSSACName: {
                            equals: payload.HSSACName.trim(),
                            mode: 'insensitive',
                        },
                    },
                    {
                        HSSACCode: {
                            equals: payload.HSSACCode.trim(),
                            mode: 'insensitive',
                        },
                    },
                    {
                        TaxType: payload.TaxType,
                    },
                    {
                        HSSACMasterSid: {
                            not: HssacMasterSid, // ✅ IMPORTANT (exclude current record)
                        },
                    },
                    {
                        status: { not: 'D' } // optional (ignore deleted)
                    }
                ],
            },
        });

        if (existingDuplicate) {
            throw new BadRequestException(
                'HS-SAC with same Name, Code and Tax Type already exists'
            );
        }

        try {
            const Hssac = await this._db.hSSACMaster.update({
                where: {
                    HSSACMasterSid: HssacMasterSid
                }, data: payload
            });
            return Hssac;
        } catch (error) {
            throw new Error(`Error updating Hssac: ${error.message}`);
        }
    }




    async softDelete(id: number) {
        const existingHssac = await this._db.hSSACMaster.findUnique({
            where: { HSSACMasterSid: id }
        });

        if (!existingHssac) {
            throw new NotFoundException(`Hssac with ID ${id} not found`);
        }

        if (existingHssac.status === "D") {
            throw new Error(`Hssac with ID ${id} is already deleted`);
        }

        // Perform soft delete by updating deletedAt field
        return this._db.hSSACMaster.update({
            where: { HSSACMasterSid: id },
            data: { status: "D" }
        });
    }


    async searchList(params: filterDto) {
        const { search = '', page = 1, pageSize = 15 } = params;
        const skip = (page - 1) * pageSize;

        const where: Prisma.HSSACMasterWhereInput = {

            status: statusWhereClause,
            ...(search
                ? {
                    OR: [
                        { HSSACName: { contains: search, mode: 'insensitive' } },
                        { HSSACCode: { contains: search, mode: 'insensitive' } },
                        { ServiceName: { contains: search, mode: 'insensitive' } },
                        // { TaxRate: { contains: search, mode: 'insensitive' } },
                        { TaxType: { contains: search, mode: 'insensitive' } },
                        { status: { contains: search, mode: 'insensitive' } },
                    ],
                }
                : {}
            ),
        };

        const [items, totalCount] = await this._db.$transaction([
            this._db.hSSACMaster.findMany({
                where,
                skip,
                take: pageSize,
                orderBy: { HSSACMasterSid: 'desc' },
            }),
            this._db.hSSACMaster.count({ where }),
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
