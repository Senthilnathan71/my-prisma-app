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
            // The entry screen sends CompanyMasterSids (array) so one milestone is
            // created per selected company. Fall back to the legacy single
            // CompanyMasterSid for backward compatibility.
            const { CompanyMasterSids, CompanyMasterSid, ...rest } = payload;
            const companyIds: number[] = Array.isArray(CompanyMasterSids) && CompanyMasterSids.length
                ? [...new Set(CompanyMasterSids.map((id: any) => Number(id)).filter((id: number) => !!id))]
                : (CompanyMasterSid != null ? [Number(CompanyMasterSid)] : []);

            if (!companyIds.length) {
                throw new BadRequestException('At least one company must be selected');
            }

            const createdMilestones = await this._db.$transaction(
                companyIds.map((cid) =>
                    this._db.milestoneMaster.create({
                        data: { ...rest, CompanyMasterSid: cid },
                        include: {
                            branchMaster: true,
                            companyMaster: true
                        }
                    })
                )
            );

            // Preserve the previous single-object response for single-company creates.
            return createdMilestones.length === 1 ? createdMilestones[0] : createdMilestones;
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
            // A milestone can exist as separate rows across companies (linked by
            // MilestoneCode). Return every company that already has it so the
            // entry screen pre-selects all of them, not just the login company.
            const siblings = await this._db.milestoneMaster.findMany({
                where: {
                    MilestoneCode: milestone.MilestoneCode,
                    status: 'A'
                },
                select: { CompanyMasterSid: true }
            });
            const CompanyMasterSids = [
                ...new Set(siblings.map((s) => s.CompanyMasterSid).filter((id): id is number => id != null))
            ];
            return { ...milestone, CompanyMasterSids };
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
            // Strip the fields that must not flow into the record's own update:
            //  - CompanyMasterSids: the multi-company array, handled separately below
            //  - CompanyMasterSid : never move the edited record to another company
            //  - createdBy        : preserve the original creator on update
            const { CompanyMasterSids, CompanyMasterSid, createdBy, ...cleanPayload } = payload;

            return await this._db.$transaction(async (tx) => {
                const updatedMilestone = await tx.milestoneMaster.update({
                    where: {
                        MilestoneMasterSid: MilestoneMasterSid
                    },
                    data: cleanPayload,
                    include: {
                        branchMaster: true,
                        companyMaster: true
                    }
                });

                // In edit mode the user can add more companies. Create the milestone
                // in the newly-selected companies only — skip the record's own
                // company, and skip any company that already has this milestone
                // code, so existing companies are never duplicated.
                const selectedIds: number[] = Array.isArray(CompanyMasterSids)
                    ? [...new Set(CompanyMasterSids.map((id: any) => Number(id)).filter((id: number) => !!id))]
                    : [];
                const targetCompanyIds = selectedIds.filter((id) => id !== updatedMilestone.CompanyMasterSid);

                for (const cid of targetCompanyIds) {
                    const duplicate = await tx.milestoneMaster.findFirst({
                        where: {
                            CompanyMasterSid: cid,
                            MilestoneCode: updatedMilestone.MilestoneCode,
                            status: 'A'
                        }
                    });
                    if (duplicate) continue;

                    await tx.milestoneMaster.create({
                        data: {
                            MilestoneName: updatedMilestone.MilestoneName,
                            MilestoneCode: updatedMilestone.MilestoneCode,
                            ShipmentType: updatedMilestone.ShipmentType,
                            SortBy: updatedMilestone.SortBy,
                            AutoCapture: updatedMilestone.AutoCapture,
                            AutomailRequire: updatedMilestone.AutomailRequire,
                            Remarks: updatedMilestone.Remarks,
                            DepartmentMasterSid: updatedMilestone.DepartmentMasterSid,
                            IsCustomerSpecific: updatedMilestone.IsCustomerSpecific,
                            status: 'A',
                            CompanyMasterSid: cid,
                            BranchMasterSid: null,
                            createdBy: createdBy || payload.updatedBy || exist.createdBy || 'system'
                        }
                    });
                }

                return updatedMilestone;
            });
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