import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { statusWhereClause } from 'src/common/helper';
import { DatabaseService } from 'src/database/database.service';
import { filterDto } from 'src/masters/DTO/search-vessel.dto';

@Injectable()
export class CoaService {
    constructor(private _db: DatabaseService, private logger: Logger) { }

    async getAllCoa(CompanyMasterSid: number) {
        try {
            const allCoa = await this._db.cOAMaster.findMany({
                where: {

                    Status: 'A',
                    CompanyMasterSid: CompanyMasterSid
                }
            })
            return allCoa;
        } catch (error) {
            throw error;
        }
    }

    async createNewCoa(payload) {
        try {
            const createdCoa = await this._db.cOAMaster.create({
                data: {
                    ...payload,

                }
            })
            return createdCoa;
        } catch (error) {
            throw error;
        }
    }

    async fetchCoaById(COAMasterSid: number) {
        try {
            const ourCoa = await this._db.cOAMaster.findUnique({
                where: {
                    COAMasterSid: COAMasterSid,

                }
            })
            if (!ourCoa) {
                throw new BadRequestException(`Coa with Id : ${COAMasterSid} not exists`);
            }
            return ourCoa;
        } catch (error) {
            throw error;
        }
    }

    async updateCoaById(COAMasterSid: number, payload) {
        try {
            const exist = await this._db.cOAMaster.findUnique({
                where: {
                    COAMasterSid: COAMasterSid,

                }
            })
            if (!exist) {
                throw new BadRequestException(`Coa with Id : ${COAMasterSid} not exists`);
            }
            const updatedCoa = this._db.cOAMaster.update({
                where: {
                    COAMasterSid: COAMasterSid,

                },
                data: {

                    UpdatedOn: new Date(),
                    ...payload,
                }
            })
            return updatedCoa;
        } catch (error) {
            throw error;
        }
    }


    async deleteCOA(COAMasterSid: number) {
        try {
            const exist = await this._db.cOAMaster.findUnique({
                where: {
                    COAMasterSid: COAMasterSid
                }
            })
            if (!exist) {
                throw new BadRequestException(`Coa with Id : ${COAMasterSid} not exists`);
            }
            if (exist.Status === 'D') {
                throw new BadRequestException(`Coa with Id : ${COAMasterSid} is already deleted`);
            }
            const deletedCoa = this._db.cOAMaster.update({
                where: {
                    COAMasterSid: COAMasterSid
                },
                data: {
                    Status: 'D'
                }
            })
            return deletedCoa;
        } catch (error) {
            throw error;
        }
    }


    async searchCoa(params: filterDto) {
        const { search = '', page = 1, pageSize = 10, activeCompanyId } = params;
        const skip = (page - 1) * pageSize;
        const where: Prisma.COAMasterWhereInput = {

            Status: statusWhereClause,
            CompanyMasterSid: activeCompanyId,
            ...(search
                ? {
                    OR: [
                        { LedgerCode: { contains: search, mode: 'insensitive' } },
                        { LedgerName: { contains: search, mode: 'insensitive' } },
                        { GroupName: { contains: search, mode: 'insensitive' } },
                        { SubGroupName: { contains: search, mode: 'insensitive' } },
                        { Status: { contains: search, mode: 'insensitive' } },
                        ...('active'.includes(search.toLowerCase())
                            ? [{ Status: 'A' }]
                            : []),
                        ...('suspended'.includes(search.toLowerCase())
                            ? [{ Status: 'S' }]
                            : []),

                        // { LedgerType: { contains: search, mode: 'insensitive' } },
                        // { SubledgerName: { contains: search, mode: 'insensitive' } },
                        // { CurrencyMaster : {currencyName : {contains : search ,mode : 'insensitive'}}},
                        // { Remarks: { contains: search, mode: 'insensitive' } },
                    ]
                }
                : {}),
        };

        const [items, totalCount] = await this._db.$transaction([
            this._db.cOAMaster.findMany({
                where,
                skip,
                take: pageSize,
                orderBy: { COAMasterSid: 'desc' },
            }),
            this._db.cOAMaster.count({ where }),
        ]);

        return {
            items,
            totalCount,
            currentPage: page,
            totalPages: Math.ceil(totalCount / pageSize),
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

