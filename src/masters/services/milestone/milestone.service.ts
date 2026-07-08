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
    // Returns milestones that exist in the source (login) company but are NOT
    // yet present in the target company. Two milestones are treated as "the same"
    // when they share a ShipmentType and either the MilestoneName or MilestoneCode
    // matches (case-insensitive), so allocating never creates a duplicate.
    async getAllocatableMilestones(sourceCompanyId: number, targetCompanyId: number) {
        try {
            if (!sourceCompanyId || !targetCompanyId) {
                throw new BadRequestException('Source and target company are required');
            }
            if (sourceCompanyId === targetCompanyId) {
                throw new BadRequestException('Source and target company must be different');
            }

            const [sourceMilestones, targetMilestones] = await Promise.all([
                this._db.milestoneMaster.findMany({
                    where: { status: 'A', CompanyMasterSid: sourceCompanyId },
                    orderBy: { SortBy: 'asc' },
                }),
                this._db.milestoneMaster.findMany({
                    where: { status: 'A', CompanyMasterSid: targetCompanyId },
                    select: { MilestoneName: true, MilestoneCode: true, ShipmentType: true },
                }),
            ]);

            const existing = new Set<string>();
            for (const m of targetMilestones) {
                const type = (m.ShipmentType ?? '').trim().toLowerCase();
                existing.add(`name:${(m.MilestoneName ?? '').trim().toLowerCase()}|${type}`);
                existing.add(`code:${(m.MilestoneCode ?? '').trim().toLowerCase()}|${type}`);
            }

            return sourceMilestones.filter((m) => {
                const type = (m.ShipmentType ?? '').trim().toLowerCase();
                const nameKey = `name:${(m.MilestoneName ?? '').trim().toLowerCase()}|${type}`;
                const codeKey = `code:${(m.MilestoneCode ?? '').trim().toLowerCase()}|${type}`;
                return !existing.has(nameKey) && !existing.has(codeKey);
            });
        } catch (error) {
            throw error;
        }
    }

    // Copies the selected source milestones into the target company. The milestone
    // SIDs are re-fetched from the DB (never trusting the client payload) and
    // re-checked for duplicates so a stale modal can't create collisions.
    // MilestoneMaster.DepartmentMasterSid is a string array of department *names*
    // (the entry form's multi-select binds `bindValue="departmentName"`), not
    // numeric SIDs, so the names are copied verbatim — they are already portable
    // across companies.
    async allocateMilestones(targetCompanyId: number, milestoneSids: number[], createdBy: string) {
        try {
            if (!targetCompanyId) {
                throw new BadRequestException('Target company is required');
            }
            if (!Array.isArray(milestoneSids) || milestoneSids.length === 0) {
                throw new BadRequestException('At least one milestone must be selected');
            }

            const sourceMilestones = await this._db.milestoneMaster.findMany({
                where: { status: 'A', MilestoneMasterSid: { in: milestoneSids } },
            });
            if (sourceMilestones.length === 0) {
                throw new BadRequestException('Selected milestones not found');
            }

            const targetMilestones = await this._db.milestoneMaster.findMany({
                where: { status: 'A', CompanyMasterSid: targetCompanyId },
                select: { MilestoneName: true, MilestoneCode: true, ShipmentType: true },
            });
            const existing = new Set<string>();
            for (const m of targetMilestones) {
                const type = (m.ShipmentType ?? '').trim().toLowerCase();
                existing.add(`name:${(m.MilestoneName ?? '').trim().toLowerCase()}|${type}`);
                existing.add(`code:${(m.MilestoneCode ?? '').trim().toLowerCase()}|${type}`);
            }

            const toCreate = sourceMilestones.filter((m) => {
                const type = (m.ShipmentType ?? '').trim().toLowerCase();
                const nameKey = `name:${(m.MilestoneName ?? '').trim().toLowerCase()}|${type}`;
                const codeKey = `code:${(m.MilestoneCode ?? '').trim().toLowerCase()}|${type}`;
                return !existing.has(nameKey) && !existing.has(codeKey);
            });
            if (toCreate.length === 0) {
                throw new BadRequestException('Selected milestones already exist in the target company');
            }

            // DepartmentMasterSid holds department *names* (see method comment); copy
            // them across verbatim, de-duplicating and dropping any blank entries.
            const copyDepartments = (names: string[] | null | undefined): string[] => {
                if (!Array.isArray(names)) return [];
                return Array.from(new Set(names.filter((n) => typeof n === 'string' && n.trim())));
            };

            // A milestone's departments are stored by name, so every referenced
            // department must already exist in the target company. If any doesn't,
            // abort without creating anything and report the missing name(s).
            const targetDepartments = await this._db.departmentMaster.findMany({
                where: { Status: 'A', CompanyMasterSid: targetCompanyId },
                select: { departmentName: true },
            });
            const targetDeptNames = new Set(
                targetDepartments.map((d) => (d.departmentName ?? '').trim().toLowerCase()),
            );
            const missingDepartments = new Set<string>();
            for (const m of toCreate) {
                for (const name of copyDepartments(m.DepartmentMasterSid)) {
                    if (!targetDeptNames.has(name.trim().toLowerCase())) {
                        missingDepartments.add(name.trim());
                    }
                }
            }
            if (missingDepartments.size > 0) {
                const names = Array.from(missingDepartments).join(', ');
                throw new BadRequestException(
                    `The following department(s) do not exist in the selected company: ${names}`,
                );
            }

            const created = await this._db.$transaction(
                toCreate.map((m) =>
                    this._db.milestoneMaster.create({
                        data: {
                            CompanyMasterSid: targetCompanyId,
                            BranchMasterSid: null,
                            MilestoneName: m.MilestoneName,
                            MilestoneCode: m.MilestoneCode,
                            SortBy: m.SortBy,
                            ShipmentType: m.ShipmentType,
                            AutoCapture: m.AutoCapture ?? 'N',
                            AutomailRequire: m.AutomailRequire ?? 'N',
                            IsCustomerSpecific: m.IsCustomerSpecific ?? 'N',
                            IsMandatory: m.IsMandatory ?? 'N',
                            DepartmentMasterSid: copyDepartments(m.DepartmentMasterSid),
                            Remarks: m.Remarks,
                            status: 'A',
                            createdBy: createdBy || 'system',
                        },
                    }),
                ),
            );

            return {
                createdCount: created.length,
                skippedCount: sourceMilestones.length - created.length,
                created,
            };
        } catch (error) {
            throw error;
        }
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