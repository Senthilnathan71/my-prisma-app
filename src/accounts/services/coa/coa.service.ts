
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

    async getAllGroupsByCategory(category: string, CompanyMasterSid: number) {
        try {
            const groups = await this._db.cOAMaster.findMany({
                where: {
                    Category: category,
                    LedgerCategory: 'Group',
                    Status: 'A',
                    CompanyMasterSid: CompanyMasterSid
                },
                distinct: ['GroupName'],
                select: {
                    GroupName: true
                },
                orderBy: {
                    GroupName: 'asc'
                }
            });
            
            return groups.map(group => group.GroupName).filter(name => name && name.trim() !== '');
        } catch (error) {
            throw error;
        }
    }

    async getAllSubgroupsByGroup(category: string, groupName: string, CompanyMasterSid: number) {
        try {
            const subgroups = await this._db.cOAMaster.findMany({
                where: {
                    Category: category,
                    GroupName: groupName,
                    LedgerCategory: 'Subgroup',
                    Status: 'A',
                    CompanyMasterSid: CompanyMasterSid,
                },
                distinct: ['SubGroupName'],
                select: {
                    SubGroupName: true
                },
                orderBy: {
                    SubGroupName: 'asc'
                }
            });
            
            return subgroups.map(subgroup => subgroup.SubGroupName).filter(name => name && name.trim() !== '');
        } catch (error) {
            throw error;
        }
    }

    async getCoaWithSubledger(CompanyMasterSid: number) {
        try {
            const coaWithSubledger = await this._db.cOAMaster.findMany({
                where: {
                    Status: 'A',
                    CompanyMasterSid: CompanyMasterSid,
                    SubledgerName: 'Y'
                },
                orderBy: { COAMasterSid: 'desc' },
            });
            
            return coaWithSubledger;
        } catch (error) {
            this.logger.warn(`Get Coa with Subledger Error: ${error}`);
            throw error;
        }
    }

    /**
     * Check for duplicate COA entries based on business rules
     */
    private async checkForDuplicates(payload: any, existingCoaSid?: number): Promise<void> {
        const { 
            Category, 
            LedgerCategory, 
            GroupName, 
            SubGroupName, 
            LedgerName, 
            LedgerCode,
            CompanyMasterSid 
        } = payload;

        // Base where clause excluding current record and deleted records
        const baseWhere: any = {
            Status: { in: ['A', 'S'] }, // Check both Active and Suspended
            CompanyMasterSid: CompanyMasterSid,
            NOT: existingCoaSid ? { COAMasterSid: existingCoaSid } : undefined
        };

        // 1. Check duplicate ledger code
        if (LedgerCode) {
            const duplicateCode = await this._db.cOAMaster.findFirst({
                where: {
                    ...baseWhere,
                    LedgerCode: LedgerCode
                }
            });

            if (duplicateCode) {
                throw new BadRequestException(
                    `Ledger Code '${LedgerCode}' already exists for ${duplicateCode.LedgerName}`
                );
            }
        }

        // 2. Check duplicate ledger name
        if (LedgerName) {
            const duplicateName = await this._db.cOAMaster.findFirst({
                where: {
                    ...baseWhere,
                    LedgerName: LedgerName
                }
            });

            if (duplicateName) {
                throw new BadRequestException(
                    `Ledger Name '${LedgerName}' already exists with code ${duplicateName.LedgerCode}`
                );
            }
        }

        // 3. Check combinations based on LedgerCategory
        if (LedgerCategory === 'Group') {
            // For Group: Category + LedgerCategory + GroupName must be unique
            const duplicateGroup = await this._db.cOAMaster.findFirst({
                where: {
                    ...baseWhere,
                    Category: Category,
                    LedgerCategory: 'Group',
                    GroupName: GroupName
                }
            });

            if (duplicateGroup) {
                throw new BadRequestException(
                    `Group '${GroupName}' already exists in category '${Category}'`
                );
            }

        } else if (LedgerCategory === 'Subgroup') {
            // For Subgroup: Category + LedgerCategory + GroupName + SubGroupName must be unique
            if (!GroupName || GroupName.trim() === '') {
                throw new BadRequestException('GroupName is required for Subgroup');
            }

            const duplicateSubgroup = await this._db.cOAMaster.findFirst({
                where: {
                    ...baseWhere,
                    Category: Category,
                    LedgerCategory: 'Subgroup',
                    GroupName: GroupName,
                    SubGroupName: SubGroupName
                }
            });

            if (duplicateSubgroup) {
                throw new BadRequestException(
                    `Subgroup '${SubGroupName}' already exists in group '${GroupName}' and category '${Category}'`
                );
            }

        } else if (LedgerCategory === 'Ledger') {
            // For Ledger: Category + LedgerCategory + GroupName + SubGroupName must be unique
            if (!GroupName || GroupName.trim() === '') {
                throw new BadRequestException('GroupName is required for Ledger');
            }
            if (!SubGroupName || SubGroupName.trim() === '') {
                throw new BadRequestException('SubGroupName is required for Ledger');
            }

            const duplicateLedgerStructure = await this._db.cOAMaster.findFirst({
                where: {
                    ...baseWhere,
                    Category: Category,
                    LedgerCategory: 'Ledger',
                    GroupName: GroupName,
                    SubGroupName: SubGroupName
                }
            });

            if (duplicateLedgerStructure) {
                throw new BadRequestException(
                    `A ledger already exists with the same structure in category '${Category}', group '${GroupName}', and subgroup '${SubGroupName}'`
                );
            }
        }
    }

    async createNewCoa(payload: any) {
        try {
            // Validate based on LedgerCategory
            if (payload.LedgerCategory === 'Group') {
                // For Group, SubGroupName should be empty
                payload.SubGroupName = '';
            } else if (payload.LedgerCategory === 'Subgroup') {
                // For Subgroup, GroupName is required and SubGroupName should not be empty
                if (!payload.GroupName || payload.GroupName.trim() === '') {
                    throw new BadRequestException('GroupName is required for Subgroup');
                }
            } else if (payload.LedgerCategory === 'Ledger') {
                // For Ledger, both GroupName and SubGroupName are required
                if (!payload.GroupName || payload.GroupName.trim() === '') {
                    throw new BadRequestException('GroupName is required for Ledger');
                }
                if (!payload.SubGroupName || payload.SubGroupName.trim() === '') {
                    throw new BadRequestException('SubGroupName is required for Ledger');
                }
            }

            // Check for duplicates before creation
            await this.checkForDuplicates(payload);

            const createdCoa = await this._db.cOAMaster.create({
                data: {
                    ...payload,
                    CreatedOn: new Date(),
                    UpdatedOn: new Date(),
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

    private async hasChildSubgroups(groupName: string | null, category: string | null, CompanyMasterSid: number): Promise<boolean> {
        if (!groupName || !category) return false;
        
        const childCount = await this._db.cOAMaster.count({
            where: {
                GroupName: groupName,
                Category: category,
                LedgerCategory: 'Subgroup',
                Status: 'A',
                CompanyMasterSid: CompanyMasterSid
            }
        });
        return childCount > 0;
    }

    private async hasChildLedgers(groupName: string | null, category: string | null, CompanyMasterSid: number): Promise<boolean> {
        if (!groupName || !category) return false;
        
        const childCount = await this._db.cOAMaster.count({
            where: {
                GroupName: groupName,
                Category: category,
                LedgerCategory: 'Ledger',
                Status: 'A',
                CompanyMasterSid: CompanyMasterSid
            }
        });
        return childCount > 0;
    }

    private async hasChildLedgersInSubgroup(subGroupName: string | null, category: string | null, CompanyMasterSid: number): Promise<boolean> {
        if (!subGroupName || !category) return false;
        
        const childCount = await this._db.cOAMaster.count({
            where: {
                SubGroupName: subGroupName,
                Category: category,
                LedgerCategory: 'Ledger',
                Status: 'A',
                CompanyMasterSid: CompanyMasterSid
            }
        });
        return childCount > 0;
    }

    async updateCoaById(COAMasterSid: number, payload: any) {
        try {
            const exist = await this._db.cOAMaster.findUnique({
                where: {
                    COAMasterSid: COAMasterSid,
                }
            })
            if (!exist) {
                throw new BadRequestException(`Coa with Id : ${COAMasterSid} not exists`);
            }

            // Check for duplicates before update (excluding current record)
            await this.checkForDuplicates(
                { ...exist, ...payload, CompanyMasterSid: exist.CompanyMasterSid }, 
                COAMasterSid
            );

            // Check if trying to suspend and has child records
            if (payload.Status === 'S' || payload.Status === 'suspended') {
                // Check if it's a Group and has child Subgroups or Ledgers
                if (exist.LedgerCategory === 'Group') {
                    const hasSubgroups = await this.hasChildSubgroups(exist.GroupName, exist.Category, exist.CompanyMasterSid);
                    const hasLedgers = await this.hasChildLedgers(exist.GroupName, exist.Category, exist.CompanyMasterSid);
                    
                    if (hasSubgroups || hasLedgers) {
                        throw new BadRequestException(`Cannot suspend Group '${exist.GroupName}' as it is linked to Subgroups or Ledgers`);
                    }
                }

                // Check if it's a Subgroup and has child Ledgers
                if (exist.LedgerCategory === 'Subgroup') {
                    const hasLedgers = await this.hasChildLedgersInSubgroup(exist.SubGroupName, exist.Category, exist.CompanyMasterSid);
                    
                    if (hasLedgers) {
                        throw new BadRequestException(`Cannot suspend Subgroup '${exist.SubGroupName}' as it is linked to Ledgers`);
                    }
                }
            }

            const updatedCoa = await this._db.cOAMaster.update({
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

            // Check if it's a Group and has child Subgroups or Ledgers
            if (exist.LedgerCategory === 'Group') {
                const hasSubgroups = await this.hasChildSubgroups(exist.GroupName, exist.Category, exist.CompanyMasterSid);
                const hasLedgers = await this.hasChildLedgers(exist.GroupName, exist.Category, exist.CompanyMasterSid);
                
                if (hasSubgroups || hasLedgers) {
                    throw new BadRequestException(`Cannot delete Group '${exist.GroupName}' as it is linked to Subgroups or Ledgers`);
                }
            }

            // Check if it's a Subgroup and has child Ledgers
            if (exist.LedgerCategory === 'Subgroup') {
                const hasLedgers = await this.hasChildLedgersInSubgroup(exist.SubGroupName, exist.Category, exist.CompanyMasterSid);
                
                if (hasLedgers) {
                    throw new BadRequestException(`Cannot delete Subgroup '${exist.SubGroupName}' as it is linked to Ledgers`);
                }
            }

            const deletedCoa = await this._db.cOAMaster.update({
                where: {
                    COAMasterSid: COAMasterSid
                },
                data: {
                    Status: 'D',
                    UpdatedOn: new Date()
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