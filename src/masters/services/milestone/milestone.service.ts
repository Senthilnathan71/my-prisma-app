import { BadRequestException, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { GlobalConfigService } from 'src/common/config/master-config.service';
import { statusWhereClause } from 'src/common/helper';
import { DatabaseService } from 'src/database/database.service';
import { SearchListDto } from 'src/masters/DTO/search-list.dto';
import { filterDto } from 'src/masters/DTO/search-vessel.dto';

@Injectable()
export class MilestoneService {
    constructor(private _db: DatabaseService, private globalConfigService: GlobalConfigService, private logger: Logger) { }

    async getAllMilestones(CompanyMasterSid: number, BranchMasterSid: number) {
        try {
            const allMilestones = await this._db.milestoneMaster.findMany({
                where: {
                    status: "A",
                    // MilestoneMaster is company-level (not differentiated by branch)
                    CompanyMasterSid: CompanyMasterSid
                },
                include: {
                    branchMaster: true,
                    companyMaster: true
                }
            });
            return allMilestones;
        } catch (error) {
            throw error;
        }
    }

    async createNewMilestone(payload: any) {
        try {
            const createdMilestone = await this._db.milestoneMaster.create({
                data: {
                    ...payload,
                },
                include: {
                    branchMaster: true,
                    companyMaster: true
                }
            });
            return createdMilestone;
        } catch (error) {
            throw error;
        }
    }

    async fetchMilestoneById(MilestoneMasterSid: number,CompanyMasterSid: number, BranchMasterSid: number) {
        try {
            const milestone = await this._db.milestoneMaster.findUnique({
                where: {
                    MilestoneMasterSid: MilestoneMasterSid,
                    CompanyMasterSid: CompanyMasterSid   // company-level; no branch filter
                },
                include: {
                    branchMaster: true,
                    companyMaster: true
                }
            });
            if (!milestone) {
                throw new UnauthorizedException(`Access denied.`);
            }
            return milestone;
        } catch (error) {
            throw error;
        }
    }

    async updateMilestoneById(MilestoneMasterSid: number, payload: any) {
        try {
            const exist = await this._db.milestoneMaster.findUnique({
                where: {
                    MilestoneMasterSid: MilestoneMasterSid
                }
            });
            if (!exist) {
                throw new BadRequestException(`Milestone with Id : ${MilestoneMasterSid} not exists`);
            }
            const updatedMilestone = await this._db.milestoneMaster.update({
                where: {
                    MilestoneMasterSid: MilestoneMasterSid
                },
                data: payload,
                include: {
                    branchMaster: true,
                    companyMaster: true
                }
            });
            return updatedMilestone;
        } catch (error) {
            throw error;
        }
    }

    async deleteMilestone(MilestoneMasterSid: number) {
        try {
            const exist = await this._db.milestoneMaster.findUnique({
                where: {
                    MilestoneMasterSid: MilestoneMasterSid
                }
            });
            if (!exist) {
                throw new BadRequestException(`Milestone with Id : ${MilestoneMasterSid} not exists`);
            }
            if (exist.status === "D") {
                throw new BadRequestException(`Milestone with Id :${MilestoneMasterSid} is already deleted`);
            }
            const deletedMilestone = await this._db.milestoneMaster.update({
                where: {
                    MilestoneMasterSid: MilestoneMasterSid
                },
                data: {
                    status: "D"
                },
                include: {
                    branchMaster: true,
                    companyMaster: true
                }
            });
            return deletedMilestone;
        } catch (error) {
            throw error;
        }
    }

    async searchMilestone(params: filterDto) {
        const { search = '', page = 1, pageSize = 15, activeCompanyId, activeBranchId } = params;
        const skip = (page - 1) * pageSize;

        const where: any = {

            status: statusWhereClause,
            CompanyMasterSid: activeCompanyId,   // MilestoneMaster is company-level; no branch filter
            ...(search
                ? {
                    OR: [
                        { MilestoneName: { contains: search, mode: 'insensitive' } },
                        { MilestoneCode: { contains: search, mode: 'insensitive' } },
                        { ShipmentType: { contains: search, mode: 'insensitive' } },
                        { status: { contains: search, mode: 'insensitive' } },
                        { Remarks: { contains: search, mode: 'insensitive' } },
                    ],
                }
                : {}
            ),
        };

        let items;
        let totalCount;
        [items, totalCount] = await this._db.$transaction([
            this._db.milestoneMaster.findMany({
                where,
                skip,
                take: pageSize,
                orderBy: { SortBy: 'asc' },
            }),
            this._db.milestoneMaster.count({ where }),
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