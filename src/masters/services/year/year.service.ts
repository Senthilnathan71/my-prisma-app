import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { statusWhereClause } from 'src/common/helper';
import { DatabaseService } from 'src/database/database.service';
import { SearchListDto } from 'src/masters/DTO/search-list.dto';
import { filterDto } from 'src/masters/DTO/search-vessel.dto';

@Injectable()
export class YearService {
    constructor(private _db: DatabaseService, private logger: Logger) { }

    async getAllYears(CompanyMasterSid: number) {
        try {
            const allYears = await this._db.yearMaster.findMany({
                where: {
                    status: 'A',
                    CompanyMasterSid: CompanyMasterSid
                },
                include: {
                    companyMaster: true
                }
            });
            return allYears;
        } catch (error) {
            throw error;
        }
    }
    async createNewYear(payload: any) {
        try {
            const { CompanyMasterSid, ...rest } = payload;
            if (!CompanyMasterSid) {
                throw new BadRequestException('CompanyMasterSid is required');
            }

            // Check if year name already exists for this company
            const existingYear = await this._db.yearMaster.findFirst({
                where: {
                    YearName: rest.YearName,
                    CompanyMasterSid: CompanyMasterSid,
                    status: { not: 'D' }  // Exclude deleted records
                }
            });

            if (existingYear) {
                throw new BadRequestException(`Year with name '${rest.YearName}' already exists`);
            }

            const createdYear = await this._db.yearMaster.create({
                data: {
                    ...rest,
                    companyMaster: {
                        connect: { CompanyMasterSid },
                    },
                },
                include: {
                    companyMaster: true,
                },
            });

            return createdYear;
        } catch (error) {
            console.log(error.stack);
            throw error;
        }
    }


    async fetchYearById(YearMasterSid: number) {
        try {
            const year = await this._db.yearMaster.findUnique({
                where: {
                    YearMasterSid: YearMasterSid
                },
                include: {
                    companyMaster: true
                }
            });
            if (!year) {
                throw new BadRequestException(`Year with Id : ${YearMasterSid} not exists`);
            }
            return year;
        } catch (error) {
            throw error;
        }
    }

    async getAllYearMaster(email: string) {
        try {
            const user = await this._db.userMaster.findFirst({
                where: { userEmail: email },
                include: {
                    userCompanyMaster: {
                        where: {
                            IsDefault: 'Y',
                            status: 'A',
                        },
                    },
                },
            });

            if (!user) {
                throw new NotFoundException(`User with email ${email} not found.`);
            }

            const defaultCompany = user.userCompanyMaster[0];
            if (!defaultCompany) {
                throw new NotFoundException(`No default company found for user ${email}.`);
            }

            const financialYears = await this._db.yearMaster.findMany({
                where: {
                    CompanyMasterSid: defaultCompany.CompanyMasterSid,
                    status: 'A'
                },
                select: {
                    YearMasterSid: true,
                    YearName: true,
                    CurrentYear : true,
                    StartDate : true,
                    EndDate : true
                },
                orderBy: {
                    YearName: 'desc'
                }
            });

            return financialYears;
        } catch (error) {
            throw error;
        }
    }

    async getFinancialYearsByCompany(companyId: number) {
        try {
            const financialYears = await this._db.yearMaster.findMany({
                where: {
                    CompanyMasterSid: companyId,
                    status: 'A',
                },
                select: {
                    YearMasterSid: true,
                    YearName: true,
                    CurrentYear : true,
                    StartDate: true,
                    EndDate: true
                },
                orderBy: {
                    YearName: 'desc',
                },
            });

            if (!financialYears.length) {
                throw new NotFoundException(`No financial years found for this company.`);
            }

            return financialYears;
        } catch (error) {
            throw error;
        }
    }

    async updateYearById(YearMasterSid: number, payload: any) {
        try {
            const exist = await this._db.yearMaster.findUnique({
                where: {
                    YearMasterSid: YearMasterSid
                }
            });
            if (!exist) {
                throw new BadRequestException(`Year with Id : ${YearMasterSid} not exists`);
            }
            const selectedCompanySid = payload.CompanyMasterSid ?? exist.CompanyMasterSid;
            if (!selectedCompanySid) {
                throw new BadRequestException('CompanyMasterSid is required');
            }

            const existingYear = await this._db.yearMaster.findFirst({
                where: {
                    YearName: payload.YearName,
                    CompanyMasterSid: selectedCompanySid,
                    status: { not: 'D' },
                    YearMasterSid: { not: YearMasterSid }
                }
            });
            if (existingYear) {
                throw new BadRequestException(`Year with name '${payload.YearName}' already exists`);
            }
            const updatedYear = await this._db.yearMaster.update({
                where: {
                    YearMasterSid: YearMasterSid
                },
                data: {
                    ...payload,
                    CompanyMasterSid: selectedCompanySid
                },
                include: {
                    companyMaster: true
                }
            });
            return updatedYear;
        } catch (error) {
            throw error;
        }
    }

    async deleteYear(YearMasterSid: number) {
        try {
            const exist = await this._db.yearMaster.findUnique({
                where: {
                    YearMasterSid: YearMasterSid
                }
            });
            if (!exist) {
                throw new BadRequestException(`Year with Id : ${YearMasterSid} not exists`);
            }
            if (exist.status === 'D') {
                throw new BadRequestException(`Year with Id :${YearMasterSid} is already deleted`);
            }
            const deletedYear = await this._db.yearMaster.update({
                where: {
                    YearMasterSid: YearMasterSid
                },
                data: {
                    status: 'D'
                },
                include: {
                    companyMaster: true
                }
            });
            return deletedYear;
        } catch (error) {
            throw error;
        }
    }


    async searchYearNew(params: filterDto) {
        const { search = '', page = 1, pageSize = 15, activeCompanyId, CurrentCompanySid, currentCompanySid } = params;
        const skip = (page - 1) * pageSize;
        const companySid = activeCompanyId ?? CurrentCompanySid ?? currentCompanySid;

        const where: Prisma.YearMasterWhereInput = {
            status: statusWhereClause,
            CompanyMasterSid: companySid,

            ...(search
                ? {
                    OR: [
                        { YearName: { contains: search, mode: 'insensitive' } },
                        { CurrentYear: { contains: search, mode: 'insensitive' } },
                        { YearEndCompleted: { contains: search, mode: 'insensitive' } },
                        { status: { contains: search, mode: 'insensitive' } },
                    ],
                }
                : {}
            ),
        };

        const [items, totalCount] = await this._db.$transaction([
            this._db.yearMaster.findMany({
                where,
                skip,
                take: pageSize,
                orderBy: { YearMasterSid: 'desc' },
            }),
            this._db.yearMaster.count({ where }),
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
