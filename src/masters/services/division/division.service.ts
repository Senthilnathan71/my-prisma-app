import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { DatabaseService } from 'src/database/database.service';
import { SearchListDto } from 'src/masters/DTO/search-list.dto';
import { filterDto } from 'src/masters/DTO/search-vessel.dto';


@Injectable()
export class DivisionService {
    constructor(private _db: DatabaseService, private logger: Logger) { }
    async createNewDivision(payload: any, user) {
        this.logger.warn(`createNewDivision: ${payload}`);

        const existing = await this._db.divisionMaster.findFirst({
            where: {

                OR: [
                    {
                        CompanyMasterSid: payload.CompanyMasterSid,
                        DivisionName: {
                            equals: payload.DivisionName.trim(),
                            mode: 'insensitive',
                        }
                    },
                    {
                        CompanyMasterSid: payload.CompanyMasterSid,
                        DivisionCode: {
                            equals: payload.DivisionCode.trim(),
                            mode: 'insensitive',
                        }
                    }
                ]
            },
        });
        if (existing) {
            if (existing.DivisionName === payload.DivisionName) {
                throw new BadRequestException('Division name already exists');
            }
            if (existing.DivisionCode === payload.DivisionCode) {
                throw new BadRequestException('Division code already exists');
            }
        }
        try {
            const Division = await this._db.divisionMaster.create({
                data: {
                    ...payload,
                }
            });
            return Division;
        } catch (error) {
            console.log(error.stack)
            throw new Error(`Error creating Division: ${error.message}`);
        }
    }

    async getAllDivisions(CompanyMasterSid: number) {
        try {
            const DivisionList = await this._db.divisionMaster.findMany({
                where: {
                    status: 'A',
                    CompanyMasterSid: CompanyMasterSid
                }
            })
            return DivisionList;
        } catch (error) {
            throw error;
        }
    }

    async getDivisionById(divisionId: number) {
        try {
            const ourDivision = await this._db.divisionMaster.findUnique({
                where: {
                    DivisionMasterSid: divisionId
                }
            })
            if (!ourDivision) {
                throw new BadRequestException(`Division with id : ${divisionId} not exist`);
            }
            return ourDivision;
        } catch (error) {
            throw error;
        }
    }

    async editDivisionById(divisionId: number, newData: any) {
        try {
            const existing = await this._db.divisionMaster.findUnique({
                where: {
                    CompanyMasterSid: newData.CompanyMasterSid,
                    DivisionMasterSid: divisionId
                }
            })
            if (!existing) {
                throw new BadRequestException(`Division with id : ${divisionId} not exist`);
            }
            const editedDivision = await this._db.divisionMaster.update({
                where: {
                    DivisionMasterSid: divisionId
                },
                data: newData
            })
            return editedDivision;
        } catch (error) {
            throw error;
        }
    }

    async softDeleteDivision(divisionId: number) {
        try {
            const existing = await this._db.divisionMaster.findUnique({
                where: {
                    DivisionMasterSid: divisionId
                }
            })
            if (!existing) {
                throw new BadRequestException(`Division with id : ${divisionId} not exist`);
            }
            if (existing.status === "D") {
                throw new BadRequestException(`Division with id : ${divisionId} is already deleted`);
            }
            const deletedDivision = await this._db.divisionMaster.update({
                where: {
                    DivisionMasterSid: divisionId
                },
                data: {
                    status: "D"
                }
            })
            return deletedDivision;
        } catch (error) {
            throw error;
        }
    }

    async searchDivisionNew(params: filterDto) {
        const { search = '', page = 1, pageSize = 15, activeCompanyId } = params;
        const skip = (page - 1) * pageSize;

        const where: Prisma.DivisionMasterWhereInput = {

            status: 'A',
            CompanyMasterSid: activeCompanyId,
            ...(search
                ? {
                    OR: [
                        { DivisionName: { contains: search, mode: 'insensitive' } },
                        { DivisionCode: { contains: search, mode: 'insensitive' } },
                        { status: { contains: search, mode: 'insensitive' } },
                    ],
                }
                : {}
            ),
        };

        const [items, totalCount] = await this._db.$transaction([
            this._db.divisionMaster.findMany({
                where,
                skip,
                take: pageSize,
                orderBy: { DivisionMasterSid: 'desc' },
            }),
            this._db.divisionMaster.count({ where }),
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
