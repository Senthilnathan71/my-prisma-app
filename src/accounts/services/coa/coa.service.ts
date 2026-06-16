
import { BadRequestException, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { statusWhereClause } from 'src/common/helper';
import { getAllowedLedgerTypes } from 'src/common/config/voucher-type.config';
import { DatabaseService } from 'src/database/database.service';
import { filterDto } from 'src/masters/DTO/search-vessel.dto';
import * as ExcelJS from 'exceljs';
import * as XLSX from 'xlsx';

@Injectable()
export class CoaService {
    constructor(private _db: DatabaseService, private logger: Logger) { }

    async getAllCoa(CompanyMasterSid: number) {
        try {
            const allCoa = await this._db.cOAMaster.findMany({
                where: {
                    Status: 'A',
                    LedgerName: {
                    not: null,
                    notIn: ['']
                },
                    CompanyMasterSid: CompanyMasterSid
                }
            })
            return allCoa;
        } catch (error) {
            throw error;
        }
    }
    async getCOAByLedgerType(LedgerType: string, CompanyMasterSid: number) {
    try {
        const coa = await this._db.cOAMaster.findMany({
            where: {
                LedgerType: LedgerType,
                Status: "A",
                SubledgerName: 'Y',
                CompanyMasterSid: CompanyMasterSid
            },
            orderBy: {
                LedgerName: 'asc'
            }
        });
        return coa;
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

    /**
     * it is common service to get Chart of Accounts for the specified ledger category
     * @param ledgerCategory it can be Ledger , Group or SubGroup
     * @param CompanyMasterSid Company's Sid
     * @returns returns all the Chart of Accounts with specified ledger category
     * Used in below components :
     * 1. Receipt detail part
     * 
     */
    async getCOAByLedgerCategory(ledgerCategory: string, CompanyMasterSid: number , filterNonJob ?: boolean, voucherType ?: string) {
        try {
            const allowedLedgerTypes = voucherType ? getAllowedLedgerTypes(voucherType) : [];
            const allCoaWithSpecificLedgerCategory = await this._db.cOAMaster.findMany({
                where: {
                    Status: 'A',
                    CompanyMasterSid: CompanyMasterSid,
                    ...(allowedLedgerTypes.length > 0
                        ? { LedgerType: { in: allowedLedgerTypes } }
                        : { LedgerCategory: ledgerCategory }),
                    ...(filterNonJob ? { JobNoRequire : 'N' } : {})
                },
                select: {
                    COAMasterSid: true,
                    LedgerName: true,
                    SubledgerName : true,  // is subledgermapped?
                    JobNoRequire : true,
                    LedgerType: true,
                    LedgerCurrency: true,
                    SubGroupName: true,
                    HSNRequire: true,
                    Category: true,
                },
                orderBy: {
                    LedgerName: 'asc'
                }
            });
            return allCoaWithSpecificLedgerCategory;
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

   
    private async checkForDuplicates(payload: any, existingCoaSid?: number): Promise<void> {
        let {
            Category,
            LedgerCategory,
            GroupName,
            SubGroupName,
            LedgerName,
            LedgerCode,
            LedgerType,
            InterBranchLocation,
            CompanyMasterSid
        } = payload;

        GroupName = GroupName?.trim();
    SubGroupName = SubGroupName?.trim();
    LedgerName = LedgerName?.trim();
    LedgerCode = LedgerCode?.trim();
        // Base where clause excluding current record and deleted records
        const baseWhere: any = {
    Status: { in: ['A', 'S'] }, 
    CompanyMasterSid: CompanyMasterSid,
    ...(existingCoaSid ? { NOT: { COAMasterSid: existingCoaSid } } : {})
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

        // // 2. Check duplicate ledger name
        // if (LedgerName) {
        //     const duplicateName = await this._db.cOAMaster.findFirst({
        //         where: {
        //             ...baseWhere,
        //             LedgerName: LedgerName
        //         }
        //     });

        //     if (duplicateName) {
        //         throw new BadRequestException(
        //             `Ledger Name '${LedgerName}' already exists with code ${duplicateName.LedgerCode}`
        //         );
        //     }
        // }

        // 2b. Inter Branch ledger: only one ACTIVE ledger per (Company, InterBranchLocation)
        if (LedgerType === 'Inter Branch' && InterBranchLocation) {
            const duplicateInterBranch = await this._db.cOAMaster.findFirst({
                where: {
                    ...baseWhere,
                    Status: 'A',
                    LedgerType: 'Inter Branch',
                    InterBranchLocation: InterBranchLocation,
                },
                include: { interBranchBranch: true },
            });

            if (duplicateInterBranch) {
                throw new BadRequestException(
                    `An active Inter Branch ledger for branch '${duplicateInterBranch.interBranchBranch?.branchName}' already exists ('${duplicateInterBranch.LedgerName}'). Only one active Inter Branch ledger is allowed per branch.`
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
      
        if (!GroupName || GroupName.trim() === '') {
            throw new BadRequestException('GroupName is required for Ledger');
        }
        if (!SubGroupName || SubGroupName.trim() === '') {
            throw new BadRequestException('SubGroupName is required for Ledger');
        }
        if (!LedgerName || LedgerName.trim() === '') {
            throw new BadRequestException('LedgerName is required for Ledger');
        }

       
        const duplicateLedgerName = await this._db.cOAMaster.findFirst({
            where: {
                ...baseWhere,
                Category: Category,
                LedgerCategory: 'Ledger',
                GroupName: GroupName,
                SubGroupName: SubGroupName,
                LedgerName: LedgerName
            }
        });

        if (duplicateLedgerName) {
            throw new BadRequestException(
                `Ledger Name '${LedgerName}' already exists in group '${GroupName}' and subgroup '${SubGroupName}'. Please use a different ledger name.`
            );
        }
        }
    }

    async createNewCoa(payload: any) {
        try {
            payload.GroupName = payload.GroupName?.trim();
        payload.SubGroupName = payload.SubGroupName?.trim();
        payload.LedgerName = payload.LedgerName?.trim();
        payload.LedgerCode = payload.LedgerCode?.trim();
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

    async fetchCoaById(COAMasterSid: number,CompanyMasterSid: number) {
        try {
            const ourCoa = await this._db.cOAMaster.findUnique({
                where: {
                    COAMasterSid: COAMasterSid,
                    CompanyMasterSid: CompanyMasterSid,
                }
            })
            if (!ourCoa) {
                throw new UnauthorizedException(`Access denied`);
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
            payload.GroupName = payload.GroupName?.trim();
        payload.SubGroupName = payload.SubGroupName?.trim();
        payload.LedgerName = payload.LedgerName?.trim();
        payload.LedgerCode = payload.LedgerCode?.trim();

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
        const {
            search = '',
            page = 1,
            pageSize = 10,
            activeCompanyId,
            Category,
            category,
            GroupName,
            groupName,
            SubGroupName,
            subGroupName
        } = params as any;
        const skip = (page - 1) * pageSize;
        const normalizedCategory = (Category ?? category ?? '').toString().trim();
        const normalizedGroupName = (GroupName ?? groupName ?? '').toString().trim();
        const normalizedSubGroupName = (SubGroupName ?? subGroupName ?? '').toString().trim();
        const where: Prisma.COAMasterWhereInput = {
            Status: statusWhereClause,
            CompanyMasterSid: activeCompanyId,
            ...(normalizedCategory && { Category: normalizedCategory }),
            ...(normalizedGroupName && { GroupName: normalizedGroupName }),
            ...(normalizedSubGroupName && { SubGroupName: normalizedSubGroupName }),
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

    async getCOAByCashOrBank(LedgerType: 'Cash' | 'Bank', CompanyMasterSid: number, filterNonJob?: boolean) {
        try {
            const whereClause : any = {
                Status : 'A',
                CompanyMasterSid : CompanyMasterSid,
                ...(filterNonJob ? { JobNoRequire: 'N' } : {})
            }
            if (Array.isArray(LedgerType)) {
                whereClause.LedgerType = {
                    in: LedgerType
                }
            } else {
                whereClause.LedgerType = LedgerType
            }
            const coa = await this._db.cOAMaster.findMany({
                where: whereClause,
                orderBy: {
                    LedgerName: 'asc'
                }
            });
            return coa;
        } catch (error) {
            throw error;
        }
    }

    /**
     * Get all distinct Groups by Company for Trial Balance
     */
    async getGroupsByCompany(CompanyMasterSid: number) {
        try {
            const groups = await this._db.cOAMaster.findMany({
                where: {
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

            return groups.map(group => ({ GroupName: group.GroupName }))
                .filter(item => item.GroupName && item.GroupName.trim() !== '');
        } catch (error) {
            throw error;
        }
    }

    /**
     * Get all distinct SubGroups by Company for Trial Balance
     */
    async getSubGroupsByCompany(CompanyMasterSid: number) {
        try {
            const subgroups = await this._db.cOAMaster.findMany({
                where: {
                    LedgerCategory: 'Sub Group',
                    Status: 'A',
                    CompanyMasterSid: CompanyMasterSid,
                    SubGroupName: { not: null }
                },
                distinct: ['SubGroupName'],
                select: {
                    SubGroupName: true
                },
                orderBy: {
                    SubGroupName: 'asc'
                }
            });

            return subgroups.map(sg => ({ SubGroupName: sg.SubGroupName }))
                .filter(item => item.SubGroupName && item.SubGroupName.trim() !== '');
        } catch (error) {
            throw error;
        }
    }

// ════════════════════════════════════════════════════════════════════════════
// METHOD 1 — generateCoaTemplate
// ════════════════════════════════════════════════════════════════════════════
async generateCoaTemplate(CompanyMasterSid: number): Promise<Buffer> {
    const ExcelJS = await import('exceljs');
    const workbook = new ExcelJS.Workbook();

    // ── Fetch reference data ──────────────────────────────────────────────
    const [currencies, ledgerTypes, existingGroups, existingSubgroups] = await Promise.all([
        this._db.currencyMaster.findMany({ select: { currencyCode: true } }),
        // Ledger types are static; we embed them directly
        Promise.resolve([
            'Accrual','Asset','Bank','Cash','Cost','Depreciation',
            'Expenses GST','Imprest','Income GST','Income Tax Payable',
            'Income Tax Receivable','Input Tax','Liabilities','Other Cost',
            'Other Revenue','Output Tax','Revenue','Sy Cr','Sy Dr'
        ]),
        this._db.cOAMaster.findMany({
            where: { CompanyMasterSid, LedgerCategory: 'Group', Status: 'A' },
            distinct: ['GroupName'],
            select: { GroupName: true }
        }),
        this._db.cOAMaster.findMany({
            where: { CompanyMasterSid, LedgerCategory: 'Subgroup', Status: 'A' },
            distinct: ['SubGroupName'],
            select: { SubGroupName: true }
        }),
    ]);

    const categoryOptions    = ['Asset', 'Liability', 'Income', 'Expense'];
    const ledgerCategoryOpts = ['Group', 'Subgroup', 'Ledger'];
    const statusOptions      = ['Active', 'Suspended'];
    const subledgerOptions   = ['Y', 'N'];

    // ════════════════════════════════════════════════════════════════════════
    // SHEET 1 — COA
    // ════════════════════════════════════════════════════════════════════════
    const coaSheet = workbook.addWorksheet('COA');

    const coaHeaders = [
        'Category',           // A — mandatory
        'Ledger Category',    // B — mandatory  (Group | Subgroup | Ledger)
        'Group Name',         // C — mandatory for Subgroup & Ledger; free text for Group
        'Sub Group Name',     // D — mandatory for Ledger; free text for Subgroup
        'Ledger Name',        // E — mandatory for Ledger only
        'Ledger Code',        // F — mandatory for Ledger only (max 10 chars)
        'Ledger Type',        // G — optional  (Ledger only)
        'Currency',           // H — optional  (Ledger only)
        'Remarks',            // I — optional
        'Subledger Mapping',  // J — optional (Y/N, Ledger only)
        'Job No Required',    // K — optional (Y/N, Ledger only)
        'HSN Required',       // L — optional (Y/N, Ledger only)
        'Status',             // M — optional (Active/Suspended)
    ];
    coaSheet.addRow(coaHeaders);

    // Header styling
    const coaHeaderRow = coaSheet.getRow(1);
    coaHeaderRow.font   = { bold: true };
    coaHeaderRow.fill   = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E0E0' } };
    coaHeaderRow.height = 20;

    // Mandatory cols (A,B) — red; conditional mandatory (C-F) — orange; optional — grey
    ['A', 'B', 'F'].forEach(col => {
        const cell = coaSheet.getCell(`${col}1`);
        cell.font = { bold: true, color: { argb: 'FFFF0000' } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFE5E5' } };
    });
    ['C', 'D', 'E'].forEach(col => {
        const cell = coaSheet.getCell(`${col}1`);
        cell.font = { bold: true, color: { argb: 'FFD97706' } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF7E5' } };
    });
    ['G', 'H', 'I', 'J', 'K', 'L', 'M'].forEach(col => {
        const cell = coaSheet.getCell(`${col}1`);
        cell.font = { bold: true, color: { argb: 'FF555555' } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF5F5F5' } };
    });

    // Example rows (rows 2–4)
    const examples = [
        ['Asset',     'Group',    'Fixed Assets',    '',            '',                '',       '',    '', '',  'N', 'N', 'N', 'Active'],
        ['Asset',     'Subgroup', 'Fixed Assets',    'Machinery',   '',                '',       '',    '', '',  'N', 'N', 'N', 'Active'],
        ['Asset',     'Ledger',   'Fixed Assets',    'Machinery',   'Plant & Machinery','FA001', 'Asset','USD','', 'N', 'N', 'N', 'Active'],
        ['Liability', 'Group',    'Current Liabilities','',         '',                '',       '',    '', '',  'N', 'N', 'N', 'Active'],
        ['Income',    'Group',    'Revenue',         '',            '',                '',       '',    '', '',  'N', 'N', 'N', 'Active'],
        ['Income',    'Subgroup', 'Revenue',         'Freight Income','',              '',       '',    '', '',  'N', 'N', 'N', 'Active'],
        ['Income',    'Ledger',   'Revenue',         'Freight Income','Ocean Freight', 'OC001', 'Revenue','', '', 'Y', 'Y', 'N', 'Active'],
    ];
    examples.forEach(rowData => {
        const r = coaSheet.addRow(rowData);
        r.eachCell(cell => {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEAF2FB' } };
            cell.font = { italic: true, color: { argb: 'FF555555' } };
        });
        r.commit();
    });

    // Reset style for editable rows (after examples)
for (let r = examples.length + 2; r <= 5000; r++) {
    for (let c = 1; c <= coaHeaders.length; c++) {
        const cell = coaSheet.getCell(r, c);

        cell.font = {
            italic: false,
            color: { argb: 'FF000000' }
        };
    }
}

    // Column widths
    [16, 18, 26, 26, 30, 14, 22, 14, 24, 18, 16, 14, 14].forEach((w, i) => {
        coaSheet.getColumn(i + 1).width = w;
    });

    // Ledger Code max-length validation
    for (let r = examples.length + 2; r <= 5000; r++) {
        coaSheet.getCell(`F${r}`).dataValidation = {
            type: 'textLength', operator: 'lessThanOrEqual', allowBlank: true,
            formulae: [10],
            showErrorMessage: true,
            errorTitle: 'Invalid Ledger Code',
            error: 'Ledger Code must be at most 10 characters'
        };
    }

    // ════════════════════════════════════════════════════════════════════════
    // HIDDEN REFERENCE SHEETS
    // ════════════════════════════════════════════════════════════════════════
    const addRef = (name: string, values: string[]) => {
        const ws = workbook.addWorksheet(name);
        ws.addRow(['Value']);
        values.forEach(v => ws.addRow([v]));
        ws.state = 'hidden';
        return ws;
    };

    addRef('_Category',      categoryOptions);
    addRef('_LedgerCategory',ledgerCategoryOpts);
    addRef('_LedgerType',    ledgerTypes as string[]);
    addRef('_Currency',      currencies.map(x => x.currencyCode));
    addRef('_Status',        statusOptions);
    addRef('_YN',            subledgerOptions);
    addRef('_Groups',        existingGroups.map(x => x.GroupName).filter(Boolean) as string[]);
    addRef('_Subgroups',     existingSubgroups.map(x => x.SubGroupName).filter(Boolean) as string[]);

    // ════════════════════════════════════════════════════════════════════════
    // APPLY DROPDOWNS
    // ════════════════════════════════════════════════════════════════════════
    const applyDV = (col: string, refSheet: string, count: number, startRow = examples.length + 2) => {
        const formula = `'${refSheet}'!$A$2:$A$${count + 1}`;
        for (let r = startRow; r <= 5000; r++) {
            coaSheet.getCell(`${col}${r}`).dataValidation = {
                type: 'list', allowBlank: true,
                formulae: [formula],
                showErrorMessage: true,
                errorTitle: 'Invalid value',
                error: 'Please select a value from the dropdown list'
            };
        }
    };

    applyDV('A', '_Category',       categoryOptions.length);
    applyDV('B', '_LedgerCategory', ledgerCategoryOpts.length);
    applyDV('G', '_LedgerType',     (ledgerTypes as string[]).length);
    applyDV('H', '_Currency',       currencies.length);
    applyDV('J', '_YN',             subledgerOptions.length);
    applyDV('K', '_YN',             subledgerOptions.length);
    applyDV('L', '_YN',             subledgerOptions.length);
    applyDV('M', '_Status',         statusOptions.length);

    // ════════════════════════════════════════════════════════════════════════
    // INSTRUCTIONS SHEET
    // ════════════════════════════════════════════════════════════════════════
    const inst = workbook.addWorksheet('Instructions');

    [
        ['Chart of Accounts Bulk Upload Template — Instructions'],
        [],
        ['OVERVIEW'],
        ['  Each row in the COA sheet represents one account entry (Group, Subgroup, or Ledger).'],
        [],
        ['LEDGER CATEGORY RULES'],
        ['  Group    — enter Category + Group Name only. Sub Group, Ledger Name, Ledger Code must be blank.'],
        ['  Subgroup — enter Category + Group Name (must already exist as a Group) + Sub Group Name.'],
        ['  Ledger   — enter all fields: Category, Group Name (existing Group), Sub Group Name (existing Subgroup),'],
        ['             Ledger Name, Ledger Code (max 10 chars). All other fields optional.'],
        [],
        ['FIELD NOTES'],
        ['  Ledger Code   — max 10 characters, must be unique per company'],
        ['  Ledger Name   — required for Ledger category, max 100 characters'],
        ['  Ledger Type   — select from dropdown (Ledger only)'],
        ['  Currency      — select from dropdown (Ledger only)'],
        ['  Subledger / Job No / HSN — Y or N (default N). Once set to Y, cannot be changed back.'],
        ['  Status        — Active (default) or Suspended'],
        [],
        ['HIERARCHY RULES'],
        ['  • To create a Subgroup, the referenced Group must already exist (in DB or in a previous row in this file)'],
        ['  • To create a Ledger, both the Group and Subgroup must already exist'],
        ['  • Duplicate Group Name within a Category, or duplicate Ledger Name within Group+Subgroup, will be skipped'],
        [],
        ['ROWS 2-8 ARE EXAMPLES — Do not edit or delete them. Enter your data starting from the next blank row.'],
    ].forEach(r => inst.addRow(r));

    inst.getRow(1).font = { bold: true, size: 13 };
    inst.getColumn(1).width = 90;

    const buf = await workbook.xlsx.writeBuffer();
    return Buffer.from(buf);
}

// ════════════════════════════════════════════════════════════════════════════
// METHOD 2 — parseCoaExcel
// ════════════════════════════════════════════════════════════════════════════
async parseCoaExcel(
    buffer: Buffer,
    CompanyMasterSid: number
): Promise<{
    validRows: any[];
    invalidRows: any[];
    summary: { total: number; valid: number; invalid: number };
}> {
    const XLSX = await import('xlsx');
    const workbook = XLSX.read(buffer, { type: 'buffer' });

    // Find COA sheet (case-insensitive)
    const coaSheetName = workbook.SheetNames.find(n => /^coa$/i.test(n.trim()));
    if (!coaSheetName) {
        return {
            validRows: [],
            invalidRows: [],
            summary: { total: 0, valid: 0, invalid: 0 },
        };
    }

    // Skip header row (row 1) + example rows (rows 2–8) = 8 rows total
    const EXAMPLE_ROWS = 8;
    const allRows: any[][] = XLSX.utils.sheet_to_json(workbook.Sheets[coaSheetName], {
        header: 1, defval: null, raw: false
    });
    allRows.splice(0, EXAMPLE_ROWS);
    const dataRows = allRows.filter(r => r.some(cell => cell !== null && cell !== ''));

    // ── Fetch lookup data ─────────────────────────────────────────────────
    const [currencies, existingCoa] = await Promise.all([
        this._db.currencyMaster.findMany({ select: { CurrencyMasterSid: true, currencyCode: true } }),
        this._db.cOAMaster.findMany({
            where: { CompanyMasterSid, Status: { not: 'D' } },
            select: {
                LedgerCode: true,
                LedgerName: true,
                GroupName: true,
                SubGroupName: true,
                Category: true,
                LedgerCategory: true,
            }
        }),
    ]);

    const curMap = new Map(currencies.map(x => [x.currencyCode.trim().toLowerCase(), x.CurrencyMasterSid]));

    // FIX 1: Exclude blank/null LedgerCodes from the uniqueness set
    const existingCodes = new Set(
        existingCoa
            .map(x => (x.LedgerCode ?? '').trim().toLowerCase())
            .filter(code => code !== '')
    );

    const existingGroups = new Set(
        existingCoa
            .filter(x => x.LedgerCategory === 'Group')
            .map(x => `${(x.Category ?? '').toLowerCase()}||${(x.GroupName ?? '').toLowerCase()}`)
    );
    const existingSubgroups = new Set(
        existingCoa
            .filter(x => x.LedgerCategory === 'Subgroup')
            .map(x =>
                `${(x.Category ?? '').toLowerCase()}||${(x.GroupName ?? '').toLowerCase()}||${(x.SubGroupName ?? '').toLowerCase()}`
            )
    );

    // FIX 2: Track existing ledger names per group+subgroup for duplicate check
    const existingLedgerNames = new Set(
        existingCoa
            .filter(x => x.LedgerCategory === 'Ledger')
            .map(x =>
                `${(x.Category ?? '').toLowerCase()}||${(x.GroupName ?? '').toLowerCase()}||${(x.SubGroupName ?? '').toLowerCase()}||${(x.LedgerName ?? '').toLowerCase()}`
            )
    );

    const validRows:   any[] = [];
    const invalidRows: any[] = [];

    // Track groups/subgroups/ledger names added in this file (so later rows can reference them)
    const fileGroups      = new Set<string>();
    const fileSubgroups   = new Set<string>();
    const fileLedgerNames = new Set<string>();   // FIX 3: for in-file duplicate ledger name detection
    const fileLedgerCodes = new Set<string>();   // FIX 4: faster in-file duplicate code detection

    const VALID_CATEGORIES   = new Set(['asset', 'liability', 'income', 'expense']);
    const VALID_LEDGER_CATS  = new Set(['group', 'subgroup', 'ledger']);
    const VALID_LEDGER_TYPES = new Set([
        'accrual', 'asset', 'bank', 'cash', 'cost', 'depreciation',
        'expenses gst', 'imprest', 'income gst', 'income tax payable',
        'income tax receivable', 'input tax', 'liabilities', 'other cost',
        'other revenue', 'output tax', 'revenue', 'sy cr', 'sy dr'
    ]);

    for (let i = 0; i < dataRows.length; i++) {
        const row    = dataRows[i];
        const rowNum = i + EXAMPLE_ROWS + 1;

        const category       = (row[0]  ?? '').toString().trim();
        const ledgerCategory = (row[1]  ?? '').toString().trim();
        const groupName      = (row[2]  ?? '').toString().trim();
        const subGroupName   = (row[3]  ?? '').toString().trim();
        const ledgerName     = (row[4]  ?? '').toString().trim();
        const ledgerCode     = (row[5]  ?? '').toString().trim().toUpperCase();
        const ledgerType     = (row[6]  ?? '').toString().trim();
        const currencyRaw    = (row[7]  ?? '').toString().trim();
        const remarks        = (row[8]  ?? '').toString().trim();
        const subledgerName  = this.normaliseYN(row[9]);
        const jobNoRequire   = this.normaliseYN(row[10]);
        const hsnRequire     = this.normaliseYN(row[11]);
        const statusRaw      = (row[12] ?? 'Active').toString().trim();

        if (!category && !ledgerCategory) continue;

        const rowErrors:   string[] = [];
        const rowWarnings: string[] = [];

        // ── Category ──────────────────────────────────────────────────────
        if (!category) {
            rowErrors.push('Category is required');
        } else if (!VALID_CATEGORIES.has(category.toLowerCase())) {
            rowErrors.push(`Category "${category}" is invalid. Must be one of: Asset, Liability, Income, Expense`);
        }

        // ── Ledger Category ───────────────────────────────────────────────
        if (!ledgerCategory) {
            rowErrors.push('Ledger Category is required');
        } else if (!VALID_LEDGER_CATS.has(ledgerCategory.toLowerCase())) {
            rowErrors.push(`Ledger Category "${ledgerCategory}" is invalid. Must be Group, Subgroup, or Ledger`);
        }

        const lc = ledgerCategory.toLowerCase();

        // ── Ledger Code — required for Ledger only ────────────────────────
        // FIX 5: Group and Subgroup rows do not need a Ledger Code
        if (lc === 'ledger') {
            if (!ledgerCode) {
                rowErrors.push('Ledger Code is required');
            } else if (ledgerCode.length > 10) {
                rowErrors.push('Ledger Code must be at most 10 characters');
            }

            // ── Ledger Code uniqueness (Ledger rows only) ─────────────────
            if (ledgerCode) {
                if (existingCodes.has(ledgerCode.toLowerCase())) {
                    rowErrors.push(`Ledger Code "${ledgerCode}" already exists in the system`);
                } else if (fileLedgerCodes.has(ledgerCode.toLowerCase())) {
                    // FIX 6: use a Set instead of .find() for O(1) lookup
                    rowErrors.push(`Duplicate Ledger Code "${ledgerCode}" in this file`);
                }
            }
        }

        // ── Hierarchy validations ─────────────────────────────────────────
        if (lc === 'group') {
            if (!groupName) {
                rowErrors.push('Group Name is required for Group');
            } else if (category) {
                // Duplicate group check (DB + file)
                const key = `${category.toLowerCase()}||${groupName.toLowerCase()}`;
                if (existingGroups.has(key) || fileGroups.has(key)) {
                    rowErrors.push(`Group "${groupName}" already exists in category "${category}"`);
                }
            }
        }

        if (lc === 'subgroup') {
            if (!groupName) {
                rowErrors.push('Group Name is required for Subgroup');
            } else {
                // Group must already exist in DB or earlier in this file (same category)
                const groupKey = `${category.toLowerCase()}||${groupName.toLowerCase()}`;
                if (!existingGroups.has(groupKey) && !fileGroups.has(groupKey)) {
                    rowErrors.push(`Group "${groupName}" does not exist for category "${category}". Create the Group first.`);
                }
            }

            if (!subGroupName) {
                rowErrors.push('Sub Group Name is required for Subgroup');
            } else if (groupName && category) {
                // Duplicate subgroup check (DB + file)
                const key = `${category.toLowerCase()}||${groupName.toLowerCase()}||${subGroupName.toLowerCase()}`;
                if (existingSubgroups.has(key) || fileSubgroups.has(key)) {
                    rowErrors.push(`Subgroup "${subGroupName}" already exists under Group "${groupName}" in category "${category}"`);
                }
            }
        }

        if (lc === 'ledger') {
            if (!groupName) {
                rowErrors.push('Group Name is required for Ledger');
            } else {
                // Group must already exist in DB or earlier in this file (same category)
                const groupKey = `${category.toLowerCase()}||${groupName.toLowerCase()}`;
                if (!existingGroups.has(groupKey) && !fileGroups.has(groupKey)) {
                    rowErrors.push(`Group "${groupName}" does not exist for category "${category}"`);
                }
            }

            if (!subGroupName) {
                rowErrors.push('Sub Group Name is required for Ledger');
            } else if (groupName) {
                // FIX 7: Only validate subgroup key when groupName is present (prevents false key matches)
                const subKey = `${category.toLowerCase()}||${groupName.toLowerCase()}||${subGroupName.toLowerCase()}`;
                if (!existingSubgroups.has(subKey) && !fileSubgroups.has(subKey)) {
                    rowErrors.push(`Subgroup "${subGroupName}" does not exist under Group "${groupName}" for category "${category}"`);
                }
            }

            if (!ledgerName) {
                rowErrors.push('Ledger Name is required for Ledger');
            } else if (groupName && subGroupName && category) {
                // FIX 8: Duplicate ledger name check within same Group + Subgroup (DB + file)
                const ledgerKey = `${category.toLowerCase()}||${groupName.toLowerCase()}||${subGroupName.toLowerCase()}||${ledgerName.toLowerCase()}`;
                if (existingLedgerNames.has(ledgerKey) || fileLedgerNames.has(ledgerKey)) {
                    rowErrors.push(`Ledger Name "${ledgerName}" already exists under "${groupName} > ${subGroupName}" in category "${category}"`);
                }
            }

            // Optional field validations — Ledger only
            if (ledgerType && !VALID_LEDGER_TYPES.has(ledgerType.toLowerCase())) {
                rowWarnings.push(`Ledger Type "${ledgerType}" is unrecognised — it will be stored as-is`);
            }
        }

        // ── Currency resolve (Ledger only; ignored for Group/Subgroup) ────
        let CurrencyMasterSid: number | null = null;
        if (lc === 'ledger' && currencyRaw) {
            CurrencyMasterSid = curMap.get(currencyRaw.toLowerCase()) ?? null;
            if (!CurrencyMasterSid) rowWarnings.push(`Currency "${currencyRaw}" not found — will be ignored`);
        }

        const resolvedStatus = statusRaw.toLowerCase() === 'suspended' ? 'S' : 'A';

        // ── Strip fields that don't apply to this ledger category ─────────
        const isLedger   = lc === 'ledger';
        const isSubgroup = lc === 'subgroup';

        const rowResult = {
            rowNum,
            category,
            ledgerCategory,
            groupName,
            ledgerCode:        ledgerCode,   // Ledger only
            subGroupName:      isSubgroup || isLedger ? subGroupName : '',
            ledgerName:        isLedger   ? ledgerName         : '',
            ledgerType:        isLedger   ? ledgerType         : '',
            currency:          isLedger   ? currencyRaw        : '',
            CurrencyMasterSid: isLedger   ? CurrencyMasterSid : null,
            remarks:           isLedger   ? remarks            : '',
            subledgerName:     isLedger   ? subledgerName      : 'N',
            jobNoRequire:      isLedger   ? jobNoRequire       : 'N',
            hsnRequire:        isLedger   ? hsnRequire         : 'N',
            status:            statusRaw,
            resolvedStatus,
            warnings:          rowWarnings,
        };

        if (rowErrors.length) {
            invalidRows.push({ ...rowResult, errors: rowErrors });
        } else {
            validRows.push(rowResult);

            // Register in file sets so subsequent rows can reference them
            if (lc === 'group' && category && groupName) {
                fileGroups.add(`${category.toLowerCase()}||${groupName.toLowerCase()}`);
            }
            if (lc === 'subgroup' && category && groupName && subGroupName) {
                fileSubgroups.add(`${category.toLowerCase()}||${groupName.toLowerCase()}||${subGroupName.toLowerCase()}`);
            }
            if (lc === 'ledger') {
                if (ledgerCode) {
                    fileLedgerCodes.add(ledgerCode.toLowerCase());
                }
                if (category && groupName && subGroupName && ledgerName) {
                    fileLedgerNames.add(`${category.toLowerCase()}||${groupName.toLowerCase()}||${subGroupName.toLowerCase()}||${ledgerName.toLowerCase()}`);
                }
            }
        }
    }

    return {
        validRows,
        invalidRows,
        summary: {
            total:   validRows.length + invalidRows.length,
            valid:   validRows.length,
            invalid: invalidRows.length,
        }
    };
}

// ════════════════════════════════════════════════════════════════════════════
// METHOD 3 — saveCoaExcel
// ════════════════════════════════════════════════════════════════════════════
async saveCoaExcel(
    validRows: any[],
    CompanyMasterSid: number,
    createdBy: string
): Promise<{ created: number; skipped: number; errors: any[] }> {
    let created = 0, skipped = 0;
    const errors: any[] = [];

    for (const row of validRows) {
        try {
            // Final duplicate guard at save time
            const lc = (row.ledgerCategory ?? '').toLowerCase();

            if (row.ledgerCode) {
                const dupCode = await this._db.cOAMaster.findFirst({
                    where: { CompanyMasterSid, LedgerCode: row.ledgerCode, Status: { not: 'D' } }
                });
                if (dupCode) {
                    errors.push({ ledgerCode: row.ledgerCode, message: 'Duplicate Ledger Code at save time — skipped' });
                    skipped++;
                    continue;
                }
            }

            const reportType =
                (row.category === 'Asset' || row.category === 'Liability') ? 'Balance Sheet' :
                (row.category === 'Income' || row.category === 'Expense')  ? 'Profit and Loss' : '';

            await this._db.cOAMaster.create({
                data: {
                    Category:        row.category,
                    LedgerCategory:  row.ledgerCategory,
                    GroupName:       row.groupName   || null,
                    SubGroupName:    row.subGroupName || null,
                    LedgerName:      row.ledgerName  || null,
                    LedgerCode:      row.ledgerCode  || null,
                    LedgerType:      row.ledgerType  || null,
                    LedgerCurrency:  row.CurrencyMasterSid ?? null,
                    ReportType:      reportType,
                    Remarks:         row.remarks     || null,
                    SubledgerName:   row.subledgerName || 'N',
                    JobNoRequire:    row.jobNoRequire  || 'N',
                    HSNRequire:      row.hsnRequire    || 'N',
                    Status:          row.resolvedStatus ?? 'A',
                    CompanyMasterSid,
                    CreatedBy:       createdBy,
                    UpdatedBy:       createdBy,
                    CreatedOn:       new Date(),
                    UpdatedOn:       new Date(),
                }
            });

            created++;
        } catch (err: any) {
            errors.push({ ledgerCode: row.ledgerCode, message: err.message || 'DB insert failed' });
            skipped++;
        }
    }

    return { created, skipped, errors };
}

// ── Helper (add as private method or module-level function) ──────────────────
    private normaliseYN(val: any): string {
        const s = (val ?? '').toString().trim().toUpperCase();
        if (s === 'Y' || s === 'YES') return 'Y';
        return 'N';
    }

}
