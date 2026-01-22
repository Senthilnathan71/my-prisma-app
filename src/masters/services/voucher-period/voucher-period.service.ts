import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { statusWhereClause } from 'src/common/helper';
import { DatabaseService } from 'src/database/database.service';
import { filterDto } from 'src/masters/DTO/search-vessel.dto';

@Injectable()
export class VoucherPeriodService {
    constructor(private _db: DatabaseService, private logger: Logger) { }

    async getAllVoucherPeriods(CompanyMasterSid: number, BranchMasterSid: number, YearMasterSid: number) {
        try {
            const allVoucherPeriods = await this._db.voucherPeriod.findMany({
                where: {
                    Status: 'A',
                    CompanyMasterSid: CompanyMasterSid,
                    BranchMasterSid: BranchMasterSid,
                    YearMasterSid: YearMasterSid
                },
                include: {
                    YearMaster: true,
                    CompanyMaster: true,
                    BranchMaster: true
                }
            });
            return allVoucherPeriods;
        } catch (error) {
            throw error;
        }
    }

    async createVoucherPeriod(payload: any) {
        try {
            const { CompanyMasterSid, BranchMasterSid, YearMasterSid, ...rest } = payload;

            // Check for duplicate PeriodCode within the same Year
            const existingPeriod = await this._db.voucherPeriod.findFirst({
                where: {
                    PeriodCode: rest.PeriodCode,
                    YearMasterSid: YearMasterSid,
                    Status: { not: 'D' }
                }
            });

            if (existingPeriod) {
                throw new BadRequestException(`Period with code ${rest.PeriodCode} already exists for this year`);
            }

            const createdVoucherPeriod = await this._db.voucherPeriod.create({
                data: {
                    ...rest,
                    CompanyMaster: {
                        connect: { CompanyMasterSid },
                    },
                    BranchMaster: {
                        connect: { BranchMasterSid },
                    },
                    YearMaster: {
                        connect: { YearMasterSid },
                    },
                },
                include: {
                    YearMaster: true,
                    CompanyMaster: true,
                    BranchMaster: true
                },
            });

            return createdVoucherPeriod;
        } catch (error) {
            console.log(error.stack);
            throw error;
        }
    }

    async fetchVoucherPeriodById(VoucherPeriodSid: number) {
        try {
            const voucherPeriod = await this._db.voucherPeriod.findUnique({
                where: {
                    VoucherPeriodSid: VoucherPeriodSid
                },
                include: {
                    YearMaster: true,
                    CompanyMaster: true,
                    BranchMaster: true
                }
            });
            if (!voucherPeriod) {
                throw new BadRequestException(`VoucherPeriod with Id : ${VoucherPeriodSid} not exists`);
            }
            return voucherPeriod;
        } catch (error) {
            throw error;
        }
    }

    async updateVoucherPeriodById(VoucherPeriodSid: number, payload: any) {
        try {
            const exist = await this._db.voucherPeriod.findUnique({
                where: {
                    VoucherPeriodSid: VoucherPeriodSid
                }
            });
            if (!exist) {
                throw new BadRequestException(`VoucherPeriod with Id : ${VoucherPeriodSid} not exists`);
            }
            const updatedVoucherPeriod = await this._db.voucherPeriod.update({
                where: {
                    VoucherPeriodSid: VoucherPeriodSid
                },
                data: payload,
                include: {
                    YearMaster: true,
                    CompanyMaster: true,
                    BranchMaster: true
                }
            });
            return updatedVoucherPeriod;
        } catch (error) {
            throw error;
        }
    }

    async deleteVoucherPeriod(VoucherPeriodSid: number) {
        try {
            const exist = await this._db.voucherPeriod.findUnique({
                where: {
                    VoucherPeriodSid: VoucherPeriodSid
                }
            });
            if (!exist) {
                throw new BadRequestException(`VoucherPeriod with Id : ${VoucherPeriodSid} not exists`);
            }
            if (exist.Status === 'D') {
                throw new BadRequestException(`VoucherPeriod with Id :${VoucherPeriodSid} is already deleted`);
            }
            const deletedVoucherPeriod = await this._db.voucherPeriod.update({
                where: {
                    VoucherPeriodSid: VoucherPeriodSid
                },
                data: {
                    Status: 'D'
                },
                include: {
                    YearMaster: true,
                    CompanyMaster: true,
                    BranchMaster: true
                }
            });
            return deletedVoucherPeriod;
        } catch (error) {
            throw error;
        }
    }

    async searchVoucherPeriodNew(params: filterDto) {
        const { search = '', page = 1, pageSize = 15, activeCompanyId, activeBranchId } = params;
        const skip = (page - 1) * pageSize;

        const where: any = {
            Status: statusWhereClause,
            CompanyMasterSid: activeCompanyId,
            BranchMasterSid: activeBranchId,

            ...(search
                ? {
                    OR: [
                        { PeriodName: { contains: search, mode: 'insensitive' } },
                        { PeriodCode: !isNaN(Number(search)) ? Number(search) : undefined },
                        { Remarks: { contains: search, mode: 'insensitive' } },
                        { status: { contains: search, mode: 'insensitive' } },
                    ].filter(Boolean),
                }
                : {}
            ),
        };

        const [items, totalCount] = await this._db.$transaction([
            this._db.voucherPeriod.findMany({
                where,
                skip,
                take: pageSize,
                orderBy: { VoucherPeriodSid: 'desc' },
                include: {
                    YearMaster: true,
                    CompanyMaster: true,
                    BranchMaster: true
                }
            }),
            this._db.voucherPeriod.count({ where }),
        ]);

        // Add computed PeriodClosed field
        const itemsWithPeriodClosed = items.map(item => ({
            ...item,
            PeriodClosed: (item.GLClosed === 'Y' && item.ARClosed === 'Y' && item.APClosed === 'Y') ? 'Y' : 'N'
        }));

        return {
            items: itemsWithPeriodClosed,
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
