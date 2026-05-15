import { Prisma } from '.prisma/client/default';
import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { GlobalConfigService } from 'src/common/config/master-config.service';
import { statusWhereClause } from 'src/common/helper';
import { DatabaseService } from 'src/database/database.service';
import { SearchListDto } from 'src/masters/DTO/search-list.dto';
import { filterDto } from 'src/masters/DTO/search-vessel.dto';
import * as ExcelJS from 'exceljs';
import * as XLSX from 'xlsx';

@Injectable()
export class ChargeService {
    constructor(private _db: DatabaseService, private logger: Logger, private globalConfigService: GlobalConfigService) { }


    async createCharge(payload: any) {
        const { chargeTaxMaster, chargeTds, ...chargeData } = payload;
        const existing = await this._db.chargeMaster.findFirst({
            where: {
                OR: [
                    {
                        CompanyMasterSid: payload.CompanyMasterSid,
                        chargeName: {
                            equals: payload.chargeName.trim(),
                            mode: 'insensitive',
                        }
                    },
                    {
                        CompanyMasterSid: payload.CompanyMasterSid,
                        chargeCode: {
                            equals: payload.chargeCode.trim(),
                            mode: 'insensitive',
                        }
                    }
                ]
            },
        });

        if (existing) {
            if (existing.chargeName === payload.chargeName) {
                throw new BadRequestException('Charge name already exists');
            }
            if (existing.chargeCode === payload.chargeCode) {
                throw new BadRequestException('Charge code already exists');
            }
        }



        return this._db.$transaction(async (prisma) => {
            // 1. Create ChargeMaster
            const charge = await prisma.chargeMaster.create({
                data: {
                    ...chargeData,
                    createdBy: payload.createdBy,
                    updatedBy: payload.createdBy, // Add updatedBy
                    CompanyMasterSid: payload.CompanyMasterSid,
                    Status: 'A',
                },
            });

            // 2. Create ChargeTaxMaster if provided
            const createdChargeTaxes: any[] = [];
            if (payload.chargeTaxMaster) {
                const chargeTaxPayload = payload.chargeTaxMaster.map(chargeTax => ({
                    HSNCode: chargeTax.HSNCode,
                    HSSACMasterSid: chargeTax.HSSACMasterSid,
                    description: chargeTax.description,
                    TaxGroup: chargeTax.TaxGroup,
                    TaxGroupSid: chargeTax.TaxGroupSid,
                    TaxRate: chargeTax.TaxRate,
                    CreatedBy: payload.createdBy,
                    UpdatedBy: payload.createdBy, // Ensure updatedBy is set
                    Status: chargeTax.Status,
                    CompanyMasterSid: payload.CompanyMasterSid,
                    chargeTaxMasterSid: charge.ChargeMasterSid,

                }));
                const newlyCreated = await prisma.chargeTaxMaster.createManyAndReturn({
                    data: chargeTaxPayload,
                });
                createdChargeTaxes.push(...newlyCreated);
            }

            // 3. Create ChargeTds if provided
            const createdChargeTds: any[] = [];
            if (payload.chargeTds) {
                const chargeTdsPayload = payload.chargeTds.map(chargeTds => ({
                    ChargeMasterSid: charge.ChargeMasterSid,
                    TDSSet: chargeTds.TDSSet || null,
                    EffectiveFrom: chargeTds.EffectiveFrom ? new Date(chargeTds.EffectiveFrom) : null,
                    createdBy: payload.createdBy,
                    updatedBy: payload.createdBy, // Add updatedBy

                }));
                const newlyCreated = await prisma.chargeTds.createManyAndReturn({
                    data: chargeTdsPayload,
                });
                createdChargeTds.push(...newlyCreated);
            }

            return {
                charge,
                chargeTaxMaster: createdChargeTaxes,
                chargeTds: createdChargeTds,
            };
        });
    }

    async getAllCharges(CompanyMasterSid: number) {
        try {
            const ChargeList = await this._db.chargeMaster.findMany({
                where: {
                    Status: 'A',
                    CompanyMasterSid: CompanyMasterSid

                }
            })
            return ChargeList;
        } catch (error) {
            throw error
        }
    }

    async getAllChargeGroups() {
        try {
            const ChargeGroupList = await this._db.chargeGroup.findMany({
                where: {
                    status: 'A'
                }
            })
            return ChargeGroupList;
        } catch (error) {
            throw error
        }
    }



    async findOne(ChargeMasterSid: any) {
        try {
            return await this._db.chargeMaster.findUnique({
                where: {
                    ChargeMasterSid: ChargeMasterSid,

                },
                include: {
                    chargeTaxMaster: {
                        where: {
                            Status: 'A'
                        }
                    },
                    chargeTds: {
                        where: {
                            status: 'A'
                        }
                    }
                }
            });
        } catch (error) {
            throw error;
        }
    }


    async updateCharge(ChargeMasterSid: number, payload: any) {

        const { chargeTaxMaster, chargeTds, ...chargeData } = payload;

        // Check for duplicates
        const duplicate = await this._db.chargeMaster.findFirst({
            where: {
                AND: [
                    {
                        CompanyMasterSid: payload.CompanyMasterSid,
                        ChargeMasterSid: {
                            not: ChargeMasterSid,
                        },
                    },
                    {
                        OR: [
                            {
                                CompanyMasterSid: payload.CompanyMasterSid,
                                chargeName: {
                                    equals: payload.chargeName.trim(),
                                    mode: 'insensitive',
                                },
                            },
                            {
                                CompanyMasterSid: payload.CompanyMasterSid,
                                chargeCode: {
                                    equals: payload.chargeCode.trim(),
                                    mode: 'insensitive',
                                },
                            },
                        ]
                    },
                ],
            },
        });
        if (duplicate) {
            if (duplicate.chargeName === payload.chargeName) {
                throw new BadRequestException('Charge name already exists');
            }
            if (duplicate.chargeCode === payload.chargeCode) {
                throw new BadRequestException('Charge code already exists');
            }
        }


        return this._db.$transaction(async (prisma) => {

            // 1. Update ChargeMaster
            const charge = await prisma.chargeMaster.update({
                where: { ChargeMasterSid: ChargeMasterSid },
                data: {
                    ...chargeData,
                    updatedBy: payload.updatedBy,
                    updatedOn: new Date(),
                },
            });

            // 2. Handle ChargeTaxMaster updates
            const updatedChargeTaxes: any[] = [];
            if (chargeTaxMaster && chargeTaxMaster.length > 0) {

                const incomingIds = chargeTaxMaster
                    .filter(t => t.ChargeTaxMasterSid)
                    .map(t => t.ChargeTaxMasterSid);

                await prisma.chargeTaxMaster.updateMany({
                    where: {
                        chargeTaxMasterSid: ChargeMasterSid,
                        ...(incomingIds.length > 0 && {
                            ChargeTaxMasterSid: { notIn: incomingIds }
                        }),
                    },
                    data: { Status: 'D' },
                });

                for (const chargeTax of chargeTaxMaster) {
                    const commonData = {
                        HSNCode: chargeTax.HSNCode,
                        HSSACMasterSid: chargeTax.HSSACMasterSid,
                        description: chargeTax.description,
                        TaxGroup: chargeTax.TaxGroup,
                        TaxGroupSid: chargeTax.TaxGroupSid,
                        TaxRate: chargeTax.TaxRate,
                        UpdatedBy: payload.updatedBy,
                        updatedOn: new Date(),
                        Status: chargeTax.Status,
                        CompanyMasterSid: payload.CompanyMasterSid,
                        chargeTaxMasterSid: ChargeMasterSid,
                    };

                    if (chargeTax.ChargeTaxMasterSid) {
                        // Update existing record
                        const updated = await prisma.chargeTaxMaster.update({
                            where: { ChargeTaxMasterSid: chargeTax.ChargeTaxMasterSid },
                            data: commonData,
                        });
                        updatedChargeTaxes.push(updated);
                    } else {
                        // Insert new record
                        const created = await prisma.chargeTaxMaster.create({
                            data: { ...commonData, CreatedBy: payload.updatedBy },
                        });
                        updatedChargeTaxes.push(created);
                    }
                }
            }

            // 3. Handle ChargeTds — upsert existing, delete removed
            const updatedChargeTds: any[] = [];
            if (chargeTds && chargeTds.length > 0) {

                const incomingTdsIds = chargeTds
                    .filter(t => t.ChargeTdsSid)
                    .map(t => t.ChargeTdsSid);

                await prisma.chargeTds.updateMany({
                    where: {
                        ChargeMasterSid: ChargeMasterSid,
                        ...(incomingTdsIds.length > 0 && {
                            ChargeTdsSid: { notIn: incomingTdsIds }
                        }),
                    },
                    data: { status: 'D' },
                });

                for (const tds of chargeTds) {
                    const commonData = {
                        ChargeMasterSid: ChargeMasterSid,
                        TDSSet: tds.TDSSet || null,
                        EffectiveFrom: tds.EffectiveFrom ? new Date(tds.EffectiveFrom) : null,
                        updatedBy: payload.updatedBy,
                        updatedOn: new Date(),
                        status: tds.Status,
                    };

                    if (tds.ChargeTdsSid) {
                        // Update existing record
                        const updated = await prisma.chargeTds.update({
                            where: { ChargeTdsSid: tds.ChargeTdsSid },
                            data: commonData,
                        });
                        updatedChargeTds.push(updated);
                    } else {
                        // Insert new record
                        const created = await prisma.chargeTds.create({
                            data: { ...commonData, createdBy: payload.updatedBy },
                        });
                        updatedChargeTds.push(created);
                    }
                }
            }

            return { charge, chargeTaxMaster: updatedChargeTaxes, chargeTds: updatedChargeTds };
        });
    }



    async softDelete(id: number) {
        const existingCharge = await this._db.chargeMaster.findUnique({
            where: { ChargeMasterSid: id }
        });

        if (!existingCharge) {
            throw new NotFoundException(`Charge with ID ${id} not found`);
        }

        if (existingCharge.Status === 'D') {
            throw new Error(`Charge with ID ${id} is already deleted`);
        }

        // Perform soft delete by updating deletedAt field
        return this._db.chargeMaster.update({
            where: { ChargeMasterSid: id },
            data: { Status: 'D' }
        });
    }


    async searchList(params: filterDto) {

        const { search = '', page = 1, pageSize = 15, activeCompanyId } = params;
        const skip = (page - 1) * pageSize;

        const where: Prisma.ChargeMasterWhereInput = {
            Status: statusWhereClause,
            CompanyMasterSid: activeCompanyId,
        };

        if (search) {
            where.OR = [
                { chargeName: { contains: search, mode: 'insensitive' } },
                { chargeCode: { contains: search, mode: 'insensitive' } },
                { Status: { contains: search, mode: 'insensitive' } },
                {
                    chargeTaxMaster: {
                        some: {
                            HSNCode: { contains: search, mode: 'insensitive' }
                        }
                    }
                },
                {
                    chargeTds: {
                        some: {
                            tdsSetHeader: {
                                TDSSetName: { contains: search, mode: 'insensitive' }
                            }
                        }
                    }
                }
            ];
        }

        const [items, totalCount] = await this._db.$transaction([
            this._db.chargeMaster.findMany({
                where,
                skip,
                take: pageSize,
                select: {
                    ChargeMasterSid: true,
                    chargeName: true,
                    chargeCode: true,
                    UOM: true,
                    Status: true,
                    chargeTaxMaster: {
                        where: { Status: 'A' },
                        select: { ChargeTaxMasterSid: true },
                        take: 1,
                    },
                    chargeTds: {
                        where: { status: 'A' },
                        select: { TDSSet: true },
                        take: 1,
                    },
                },
                orderBy: { ChargeMasterSid: 'desc' },
            }),
            this._db.chargeMaster.count({ where }),
        ]);

        const formattedItems = await Promise.all(
            items.map(async (item) => {
                const ChargeTaxMasterSid = item.chargeTaxMaster?.[0]?.ChargeTaxMasterSid;
                const TDSSet = item.chargeTds?.[0]?.TDSSet;

                const [hsn, tdsSet] = await Promise.all([
                    ChargeTaxMasterSid ?
                        this.globalConfigService.getMasterData('charge_tax_master', ChargeTaxMasterSid) : null,

                    TDSSet ?
                        this.globalConfigService.getMasterData('tds_set_header', TDSSet) : null,
                ]);

                return {
                    ...item,
                    chargeTaxMaster: hsn ? [hsn] : [],
                    chargeTds: tdsSet ? [{ tdsSetHeader: tdsSet }] : []
                };
            }),
        );


        return {
            items: formattedItems,
            totalCount,
        };

    }

    async getChargeTaxByChargeId(chargeId: number) {
        try {
            const chargeTaxes = await this._db.chargeTaxMaster.findMany({
                where: { chargeTaxMasterSid: chargeId },
                include: {
                    hssacMaster: true
                }
            });
            if (!chargeTaxes) throw new Error('Charge Tax not found For Charge Id');

            const hssacSet: Set<any> = new Set();

            chargeTaxes.forEach(ct => {
                hssacSet.add(ct.hssacMaster);
            });
            return Array.from(hssacSet);
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
 
    async generateChargeTemplate(CompanyMasterSid: number): Promise<Buffer> {
        const workbook = new ExcelJS.Workbook();
 
        // ── Fetch all lookup data ──────────────────────────────────────────────────
        const [chargeGroups, currencies, departments, uoms, hsnsacs, tdsSets] = await Promise.all([
            this._db.chargeGroup.findMany({
                where: { status: 'A', CompanyMasterSid },
                select: { ChargeGroupSid: true, GroupName: true }
            }),
            this._db.currencyMaster.findMany({
                select: { CurrencyMasterSid: true, currencyCode: true }
            }),
            this._db.departmentMaster.findMany({
                where: { CompanyMasterSid , Status: 'A'},
                select: { DepartmentMasterSid: true, departmentName: true }
            }),
            
            this._db.uOMMaster.findMany({
                where: { UOMType: 'C', status: 'A' },
                select: { UOMMasterSid: true, UOMCode: true }
            }),
            this._db.hSSACMaster.findMany({
                where: { status: 'A' },
                select: {
                    HSSACMasterSid: true, HSSACCode: true, TaxType: true,
                    TaxRate: true, TaxGroupSid: true, HSNSACDescription: true
                }
            }),
            this._db.tDSSetHeader.findMany({
                where: { status: 'A', CompanyMasterSid },
                select: { TDSSetHeaderSid: true, TDSSetName: true, EffectiveFrom: true }
            }),
        ]);
 
        const unitQtyOptions = [
  'Per 45ft Cont', 'Per 40ft Cont', 'Per 20ft Cont', 'Per Cont',
  'Per CBM', 'Per BL', 'ChargeableWeight', 'Per Shipment', 'Per GrossWeight'
];
 
        // ══════════════════════════════════════════════════════════════════════════════
        // SHEET 1 — CHARGES
        // ══════════════════════════════════════════════════════════════════════════════
        const chargeSheet = workbook.addWorksheet('Charges');
 
        const chargeHeaders = [
            'Charge Code',    // A — mandatory
            'Charge Name',    // B — mandatory
            'Charge Group',   // C — mandatory
            'Currency',       // D — mandatory
            'UOM',            // E — mandatory
            'Unit Quantity',  // F — mandatory
            'Department 1',   // G — mandatory (at least one required)
            'Department 2',   // H — optional
            'Department 3',   // I — optional
            'Department 4',   // J — optional
            'Department 5',   // K — optional
        ];
        chargeSheet.addRow(chargeHeaders);
 
        // Header styling
        const chargeHeaderRow = chargeSheet.getRow(1);
        chargeHeaderRow.font = { bold: true };
        chargeHeaderRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E0E0' } };
        chargeHeaderRow.height = 20;
 
        // Mandatory columns red (A–G), optional columns orange (H–K)
        ['A', 'B', 'C', 'D', 'E', 'F', 'G'].forEach(col => {
            const cell = chargeSheet.getCell(`${col}1`);
            cell.font = { bold: true, color: { argb: 'FFFF0000' } };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFE5E5' } };
        });
        ['H', 'I', 'J', 'K'].forEach(col => {
            const cell = chargeSheet.getCell(`${col}1`);
            cell.font = { bold: true, color: { argb: 'FFD97706' } };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF7E5' } };
        });
 
        // Example rows
        const chargeExamples = [
            ['DEMO', 'Demo Ocean Freight', 'Ocean Freight', 'USD', 'CBM', 'Per CBM', 'FCL Export', 'FCL Import', '', '', ''],
            ['DEMO2', 'Demo Air Freight', 'Air Freight', 'INR', 'KG', 'Per Gross Weight', 'Air Export', '', '', '', ''],
        ];
        chargeExamples.forEach(rowData => {
            const r = chargeSheet.addRow(rowData);
            r.eachCell(cell => {
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEAF2FB' } };
                cell.font = { italic: true, color: { argb: 'FF555555' } };
            });
            r.commit();
        });
 
        // Charge Code: max 5 chars
        for (let r = 4; r <= 5000; r++) {
            chargeSheet.getCell(`A${r}`).dataValidation = {
                type: 'textLength', operator: 'lessThanOrEqual', allowBlank: true,
                formulae: [5],
                showErrorMessage: true,
                errorTitle: 'Invalid Charge Code',
                error: 'Charge Code must be at most 5 characters'
            };
        }
 
        // Column widths
        [14, 32, 22, 14, 10, 20, 24, 24, 24, 24, 24].forEach((w, i) => {
            chargeSheet.getColumn(i + 1).width = w;
        });
 
        // ══════════════════════════════════════════════════════════════════════════════
        // SHEET 2 — TAX DETAILS
        // ══════════════════════════════════════════════════════════════════════════════
        const taxSheet = workbook.addWorksheet('Tax Details');
 
        const taxHeaders = [
            'Charge Name',   // A — mandatory
            'HS/SAC Code',   // B — mandatory, dropdown
            'Description',   // C — auto-patched from HS/SAC selection
            'Tax Group',     // D — auto-patched from HS/SAC selection
            'Tax Rate (%)',   // E — auto-patched from HS/SAC selection
            'Status',        // F — dropdown: Active / Suspended
        ];
        taxSheet.addRow(taxHeaders);
 
        const taxHeaderRow = taxSheet.getRow(1);
        taxHeaderRow.font = { bold: true };
        taxHeaderRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E0E0' } };
        taxHeaderRow.height = 20;
 
        ['A', 'B'].forEach(col => {
            const cell = taxSheet.getCell(`${col}1`);
            cell.font = { bold: true, color: { argb: 'FFFF0000' } };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFE5E5' } };
        });
 
        ['C', 'D', 'E'].forEach(col => {
            const cell = taxSheet.getCell(`${col}1`);
            cell.font = { bold: true, color: { argb: 'FF856404' } };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF3CD' } };
        });
 
        const taxExamples = [
            ['Demo Ocean Freight', '998517', 'Ocean freight service', 'IGST', 18, 'Active'],
            ['Demo Ocean Freight', '998518', 'Freight forwarding service', 'GST', 5, 'Active'],
            ['Demo Air Freight', '998519', 'Air freight service', 'IGST', 18, 'Active'],
        ];
        taxExamples.forEach(rowData => {
            const r = taxSheet.addRow(rowData);
            r.eachCell(cell => {
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEAF2FB' } };
                cell.font = { italic: true, color: { argb: 'FF555555' } };
            });
            r.commit();
        });
 
        [32, 14, 32, 18, 14, 14].forEach((w, i) => {
            taxSheet.getColumn(i + 1).width = w;
        });
 
        // ══════════════════════════════════════════════════════════════════════════════
        // SHEET 3 — TDS DETAILS
        // ══════════════════════════════════════════════════════════════════════════════
        const tdsSheet = workbook.addWorksheet('TDS Details');
 
        const tdsHeaders = [
            'Charge Name',    // A — mandatory
            'TDS Set',        // B — mandatory, dropdown
            'Effective From', // C — auto-patched from TDS Set selection
            'Status',         // D — dropdown: Active / Suspended
        ];
        tdsSheet.addRow(tdsHeaders);
 
        const tdsHeaderRow = tdsSheet.getRow(1);
        tdsHeaderRow.font = { bold: true };
        tdsHeaderRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E0E0' } };
        tdsHeaderRow.height = 20;
 
        ['A', 'B'].forEach(col => {
            const cell = tdsSheet.getCell(`${col}1`);
            cell.font = { bold: true, color: { argb: 'FFFF0000' } };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFE5E5' } };
        });
 
        const tdsEffCell = tdsSheet.getCell('C1');
        tdsEffCell.font = { bold: true, color: { argb: 'FF856404' } };
        tdsEffCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF3CD' } };
 
        const tdsExamples = [
            ['Demo Ocean Freight', 'TDS 194C', '01-JAN-2024', 'Active'],
            ['Demo Air Freight', 'TDS 194I', '01-JAN-2024', 'Active'],
        ];
        tdsExamples.forEach(rowData => {
            const r = tdsSheet.addRow(rowData);
            r.eachCell(cell => {
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEAF2FB' } };
                cell.font = { italic: true, color: { argb: 'FF555555' } };
            });
            r.commit();
        });
 
        [32, 20, 18, 14].forEach((w, i) => {
            tdsSheet.getColumn(i + 1).width = w;
        });
 
        // ══════════════════════════════════════════════════════════════════════════════
        // HIDDEN REFERENCE SHEETS
        // ══════════════════════════════════════════════════════════════════════════════
        const addRef = (name: string, values: string[]) => {
            const ws = workbook.addWorksheet(name);
            ws.addRow(['Value']);
            values.forEach(v => ws.addRow([v]));
            ws.state = 'hidden';
            return ws;
        };
 
        addRef('_ChargeGroups', chargeGroups.map(x => x.GroupName));
        addRef('_Currencies', currencies.map(x => x.currencyCode));
        addRef('_Departments', departments.map(x => x.departmentName));
        addRef('_UOMs', uoms.map(x => x.UOMCode));
        addRef('_UnitQty', unitQtyOptions);
        addRef('_Status', ['Active', 'Suspended']);
 
        const hssacRefSheet = workbook.addWorksheet('_HSSAC');
        hssacRefSheet.addRow(['HSSACCode', 'Description', 'TaxType', 'TaxRate']);
        hsnsacs.forEach(x => {
            hssacRefSheet.addRow([
                x.HSSACCode,
                x.HSNSACDescription || '',
                x.TaxType || '',
                x.TaxRate || 0,
            ]);
        });
        hssacRefSheet.state = 'hidden';
 
        const tdsRefSheet = workbook.addWorksheet('_TDS');
        tdsRefSheet.addRow(['TDSSetName', 'EffectiveFrom']);
        tdsSets.forEach(x => {
            const effDate = x.EffectiveFrom
                ? new Date(x.EffectiveFrom).toLocaleDateString('en-GB', {
                    day: '2-digit', month: 'short', year: 'numeric'
                  }).toUpperCase().replace(/ /g, '-')
                : '';
            tdsRefSheet.addRow([x.TDSSetName, effDate]);
        });
        tdsRefSheet.state = 'hidden';
 
        // ══════════════════════════════════════════════════════════════════════════════
        // APPLY DROPDOWNS
        // ══════════════════════════════════════════════════════════════════════════════
        const applyStaticDV = (
            sheet: ExcelJS.Worksheet,
            col: string,
            refSheet: string,
            count: number,
            startRow = 4
        ) => {
            const formula = `'${refSheet}'!$A$2:$A$${count + 1}`;
            for (let r = startRow; r <= 5000; r++) {
                sheet.getCell(`${col}${r}`).dataValidation = {
                    type: 'list', allowBlank: true,
                    formulae: [formula],
                    showErrorMessage: true,
                    errorTitle: 'Invalid value',
                    error: 'Please select a value from the dropdown list'
                };
            }
        };
 
        applyStaticDV(chargeSheet, 'C', '_ChargeGroups', chargeGroups.length);
        applyStaticDV(chargeSheet, 'D', '_Currencies', currencies.length);
        applyStaticDV(chargeSheet, 'E', '_UOMs', uoms.length);
        applyStaticDV(chargeSheet, 'F', '_UnitQty', unitQtyOptions.length);
 
        ['G', 'H', 'I', 'J', 'K'].forEach(col => {
            applyStaticDV(chargeSheet, col, '_Departments', departments.length);
        });
 
        for (let r = 5; r <= 5000; r++) {
            taxSheet.getCell(`A${r}`).dataValidation = {
                type: 'list', allowBlank: true,
                formulae: [`OFFSET(Charges!$B$4,0,0,COUNTA(Charges!$B$4:$B$5002),1)`],
                showErrorMessage: true,
                errorTitle: 'Invalid Charge Name',
                error: 'Please select a Charge Name that exists in the Charges sheet'
            };
        }
 
        const hssacDVFormula = `'_HSSAC'!$A$2:$A$${hsnsacs.length + 1}`;
        for (let r = 5; r <= 5000; r++) {
            taxSheet.getCell(`B${r}`).dataValidation = {
                type: 'list', allowBlank: true,
                formulae: [hssacDVFormula],
                showErrorMessage: true,
                errorTitle: 'Invalid HS/SAC Code',
                error: 'Please select a value from the dropdown list'
            };
        }
 
        applyStaticDV(taxSheet, 'F', '_Status', 2, 5);
 
        for (let r = 5; r <= 5000; r++) {
            taxSheet.getCell(`C${r}`).value = { formula: `=IFERROR(VLOOKUP(B${r},'_HSSAC'!$A:$D,2,FALSE),"")` };
            taxSheet.getCell(`D${r}`).value = { formula: `=IFERROR(VLOOKUP(B${r},'_HSSAC'!$A:$D,3,FALSE),"")` };
            taxSheet.getCell(`E${r}`).value = { formula: `=IFERROR(VLOOKUP(B${r},'_HSSAC'!$A:$D,4,FALSE),"")` };
            ['C', 'D', 'E'].forEach(col => {
                taxSheet.getCell(`${col}${r}`).fill = {
                    type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFBEA' }
                };
            });
        }
 
        for (let r = 5; r <= 5000; r++) {
            taxSheet.getCell(`E${r}`).dataValidation = {
                type: 'decimal', operator: 'between', allowBlank: true,
                formulae: [0, 100],
                showErrorMessage: true,
                errorTitle: 'Invalid Tax Rate',
                error: 'Tax Rate must be between 0 and 100'
            };
        }
 
        for (let r = 4; r <= 5000; r++) {
            tdsSheet.getCell(`A${r}`).dataValidation = {
                type: 'list', allowBlank: true,
                formulae: [`OFFSET(Charges!$B$4,0,0,COUNTA(Charges!$B$4:$B$5002),1)`],
                showErrorMessage: true,
                errorTitle: 'Invalid Charge Name',
                error: 'Please select a Charge Name that exists in the Charges sheet'
            };
        }
 
        const tdsDVFormula = `'_TDS'!$A$2:$A$${tdsSets.length + 1}`;
        for (let r = 4; r <= 5000; r++) {
            tdsSheet.getCell(`B${r}`).dataValidation = {
                type: 'list', allowBlank: true,
                formulae: [tdsDVFormula],
                showErrorMessage: true,
                errorTitle: 'Invalid TDS Set',
                error: 'Please select a value from the dropdown list'
            };
        }
 
        applyStaticDV(tdsSheet, 'D', '_Status', 2, 4);
 
        for (let r = 4; r <= 5000; r++) {
            tdsSheet.getCell(`C${r}`).value = { formula: `=IFERROR(VLOOKUP(B${r},'_TDS'!$A:$B,2,FALSE),"")` };
            tdsSheet.getCell(`C${r}`).fill = {
                type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFBEA' }
            };
        }
 
        // ══════════════════════════════════════════════════════════════════════════════
        // INSTRUCTIONS SHEET
        // ══════════════════════════════════════════════════════════════════════════════
        const inst = workbook.addWorksheet('Instructions');
 
        [
            ['Charge Bulk Upload Template — Instructions'],
            [],
            ['SHEET OVERVIEW'],
            ['  Charges      — Enter one charge per row (mandatory)'],
            ['  Tax Details  — Enter tax rows linked to a charge by Charge Name'],
            ['  TDS Details  — Enter TDS rows linked to a charge by Charge Name'],
            [],
            ['HOW TO USE'],
            ['  1. Fill the Charges sheet first (one row per charge)'],
            ['  2. Departments: select one department per column (G through K). You can assign up to 5 departments per charge.'],
            ['  3. Go to Tax Details — select Charge Name from the dropdown, then select HS/SAC Code.'],
            ['     Description, Tax Group and Tax Rate will auto-fill automatically via formula.'],
            ['  4. Go to TDS Details — select Charge Name, then select TDS Set.'],
            ['     Effective From will auto-fill automatically via formula.'],
            ['  5. Multiple tax or TDS rows can be linked to the same charge by selecting the same Charge Name'],
            [],
            ['CHARGES SHEET — MANDATORY FIELDS (red header)'],
            ['  Charge Code   — max 5 alphanumeric chars, must be unique'],
            ['  Charge Name   — max 100 chars, must be unique'],
            ['  Charge Group  — select from dropdown'],
            ['  Currency      — select from dropdown'],
            ['  UOM           — select from dropdown'],
            ['  Unit Qty      — select from dropdown'],
            ['  Department 1  — select from dropdown (at least one department required)'],
            ['  Department 2–5 — optional additional departments, each with its own dropdown'],
            [],
            ['UOM + DEPARTMENT COMPATIBILITY RULES'],
            ['  • CBM is NOT applicable when any selected department is FCL (Export or Import)'],
            ['  • Container UOMs (CON, 20F, 40F, 45F) are NOT applicable for LCL departments'],
            [],
            ['TAX DETAILS SHEET'],
            ['  Charge Name   — must match a name entered in the Charges sheet'],
            ['  HS/SAC Code   — select from dropdown; Description, Tax Group, Tax Rate auto-fill (yellow cells)'],
            ['  Status        — Active or Suspended'],
            [],
            ['TDS DETAILS SHEET'],
            ['  Charge Name    — must match a name entered in the Charges sheet'],
            ['  TDS Set        — select from dropdown; Effective From auto-fills (yellow cell)'],
            ['  Status         — Active or Suspended'],
            [],
            ['RULES'],
            ['  • Rows 2–3 in each sheet are EXAMPLES — do not edit or delete them'],
            ['  • Enter your data starting from the next blank row'],
            ['  • Yellow cells are auto-filled — do not type in them manually'],
            ['  • Duplicate Charge Code or Charge Name (per company) will be skipped with an error'],
            ['  • A charge with no matching Tax or TDS row is still created successfully'],
        ].forEach(r => inst.addRow(r));
 
        inst.getRow(1).font = { bold: true, size: 13 };
        ['A3', 'A11', 'A20', 'A27', 'A31', 'A36', 'A41'].forEach(cell => {
            inst.getCell(cell).font = { bold: true, underline: true };
        });
        inst.getColumn(1).width = 90;
 
        const buf = await workbook.xlsx.writeBuffer();
        return Buffer.from(buf);
    }

    // ── Shared helper: validates UOM vs resolved department records ──────────────
    private validateUOMDeptCompatibility(
        uomCode: string,
        resolvedDepts: { FCLLCL?: string; ExportImport?: string }[]
    ): string | null {
        if (!uomCode || resolvedDepts.length === 0) return null;

        const hasFCL = resolvedDepts.some(
            d => d.FCLLCL === 'FCL' && (d.ExportImport === 'Export' || d.ExportImport === 'Import')
        );
        const hasLCL = resolvedDepts.some(
            d => d.FCLLCL === 'LCL' && (d.ExportImport === 'Export' || d.ExportImport === 'Import')
        );

        if (hasFCL && uomCode === 'CBM') {
            return 'CBM is not applicable for FCL departments';
        }

        const containerUoms = ['CON', '20F', '40F', '45F'];
        if (hasLCL && containerUoms.includes(uomCode)) {
            return `${uomCode} is not applicable for LCL departments`;
        }

        return null;
    }
 
    async parseAndImportChargeExcel(
        buffer: Buffer,
        CompanyMasterSid: number,
        createdBy: string
    ): Promise<{ created: number; skipped: number; errors: any[] }> {
 
        const workbook = XLSX.read(buffer, { type: 'buffer' });
 
        const getRows = (partialName: string, headerRows: number): any[][] => {
            const name = workbook.SheetNames.find(n =>
                n.toLowerCase().includes(partialName.toLowerCase())
            );
            if (!name) return [];
            const all: any[][] = XLSX.utils.sheet_to_json(workbook.Sheets[name], {
                header: 1, defval: null, raw: false
            });
            all.splice(0, headerRows);
            return all.filter(r => r.some(cell => cell !== null && cell !== ''));
        };
 
        const chargeRows = getRows('charge', 3);
        const taxRows = getRows('tax', 4);
        const tdsRows = getRows('tds', 3);
 
        const [chargeGroups, currencies, departments, uoms, hsnsacs, tdsSets] = await Promise.all([
            this._db.chargeGroup.findMany({ where: { status: 'A', CompanyMasterSid } }),
            this._db.currencyMaster.findMany(),
            // ── Fetch full department records including FCLLCL and ExportImport ──
            this._db.departmentMaster.findMany({
                where: { CompanyMasterSid },
                select: { DepartmentMasterSid: true, departmentName: true, FCLLCL: true, ExportImport: true }
            }),
            this._db.uOMMaster.findMany({ where: { UOMType: 'C', status: 'A' } }),
            this._db.hSSACMaster.findMany({ where: { status: 'A' } }),
            this._db.tDSSetHeader.findMany({ where: { status: 'A', CompanyMasterSid } }),
        ]);
 
        const cgMap = new Map(chargeGroups.map(x => [x.GroupName.trim().toLowerCase(), x.ChargeGroupSid]));
        const curMap = new Map(currencies.map(x => [x.currencyCode.trim().toLowerCase(), x.CurrencyMasterSid]));
        const deptNameSet = new Set<string>(departments.map(x => x.departmentName.trim().toLowerCase()));
        const uomMap = new Map(uoms.map(x => [x.UOMCode.trim().toLowerCase(), x.UOMMasterSid]));
        // ── UOM lookup by SID for compatibility check ──
        const uomCodeBySid = new Map(uoms.map(x => [x.UOMMasterSid, x.UOMCode]));
        const hsMap = new Map(hsnsacs.map(x => [x.HSSACCode.trim().toLowerCase(), x]));
        const tdsMap = new Map(tdsSets.map(x => [x.TDSSetName.trim().toLowerCase(), x]));
 
        const taxByCharge = new Map<string, any[]>();
        taxRows.forEach((row, i) => {
            const name = (row[0] || '').toString().trim().toLowerCase();
            if (!name) return;
            if (!taxByCharge.has(name)) taxByCharge.set(name, []);
            taxByCharge.get(name)!.push({ row, rowNum: i + 5 });
        });
 
        const tdsByCharge = new Map<string, any[]>();
        tdsRows.forEach((row, i) => {
            const name = (row[0] || '').toString().trim().toLowerCase();
            if (!name) return;
            if (!tdsByCharge.has(name)) tdsByCharge.set(name, []);
            tdsByCharge.get(name)!.push({ row, rowNum: i + 4 });
        });
 
        let created = 0, skipped = 0;
        const errors: any[] = [];
 
        for (let i = 0; i < chargeRows.length; i++) {
            const row = chargeRows[i];
            const rowNum = i + 4;
 
            const chargeCode = (row[0] || '').toString().trim().toUpperCase();
            const chargeName = (row[1] || '').toString().trim();
            if (!chargeCode && !chargeName) continue;
 
            const rowErrors: string[] = [];
 
            if (!chargeCode) rowErrors.push('Charge Code is required');
            else if (chargeCode.length > 5) rowErrors.push('Charge Code must be ≤ 5 characters');
 
            if (!chargeName) rowErrors.push('Charge Name is required');
            else if (chargeName.length > 100) rowErrors.push('Charge Name must be ≤ 100 characters');
 
            const cgName = (row[2] || '').toString().trim();
            const ChargeGroupSid = cgMap.get(cgName.toLowerCase());
            if (!cgName) rowErrors.push('Charge Group is required');
            else if (!ChargeGroupSid) rowErrors.push(`Charge Group "${cgName}" not found`);
 
            const curCode = (row[3] || '').toString().trim();
            const CurrencyMasterSid = curMap.get(curCode.toLowerCase());
            if (!curCode) rowErrors.push('Currency is required');
            else if (!CurrencyMasterSid) rowErrors.push(`Currency "${curCode}" not found`);
 
            const uomCode = (row[4] || '').toString().trim();
            const UOMMasterSid = uomMap.get(uomCode.toLowerCase());
            if (!uomCode) rowErrors.push('UOM is required');
            else if (!UOMMasterSid) rowErrors.push(`UOM "${uomCode}" not found`);
 
            const UnitQty = (row[5] || '').toString().trim();
            const unitQtyDisplayToValue: Record<string, string> = {
  'per 45ft cont':       'Per 45ft Cont',
  'per 40ft cont':       'Per 40ft Cont',
  'per 20ft cont':       'Per 20ft Cont',
  'per cont':            'Per Cont',
  'per cbm':             'Per CBM',
  'per bl':              'Per BL',
  'chargeableweight':    'ChargeableWeight',
  'chargeable weight':   'ChargeableWeight',  // handles the spaced variant
  'per shipment':        'Per Shipment',
  'per grossweight':     'Per GrossWeight',
  'per gross weight':    'Per GrossWeight',   // handles the spaced variant
};

const normalizedUnitQty = unitQtyDisplayToValue[UnitQty.toLowerCase()] ?? UnitQty;
            if (!normalizedUnitQty) rowErrors.push('Unit Quantity is required');
 
            // Read departments from columns G–K (indices 6–10)
            const rawDeptNames: string[] = [];
            for (let dCol = 6; dCol <= 10; dCol++) {
                const dName = (row[dCol] || '').toString().trim();
                if (dName) rawDeptNames.push(dName);
            }
 
            if (rawDeptNames.length === 0) {
                rowErrors.push('At least one Department is required');
            }
 
            if (rowErrors.length) {
                errors.push({ sheet: 'Charges', row: rowNum, chargeCode, message: rowErrors.join('; ') });
                skipped++;
                continue;
            }
 
            // Resolve department names
            const DepartmentMasterSid: string[] = [];
            for (const dName of rawDeptNames) {
                if (deptNameSet.has(dName.toLowerCase())) {
                    const matched = departments.find(d => d.departmentName.toLowerCase() === dName.toLowerCase());
                    if (matched) DepartmentMasterSid.push(matched.departmentName);
                } else {
                    errors.push({ sheet: 'Charges', row: rowNum, chargeCode, message: `Department "${dName}" not found — skipped` });
                }
            }

            // ── UOM + Department compatibility validation ──────────────────────────
            const resolvedUOMCode = uomCodeBySid.get(UOMMasterSid!) || uomCode.toUpperCase();
            const resolvedDepts = departments.filter(d =>
                rawDeptNames.map(n => n.toLowerCase()).includes(d.departmentName.toLowerCase())
            );
            const compatError = this.validateUOMDeptCompatibility(resolvedUOMCode, resolvedDepts);
            if (compatError) {
                errors.push({ sheet: 'Charges', row: rowNum, chargeCode, message: compatError });
                skipped++;
                continue;
            }
            // ─────────────────────────────────────────────────────────────────────
 
            const dup = await this._db.chargeMaster.findFirst({
                where: {
                    CompanyMasterSid,
                    OR: [
                        { chargeCode: { equals: chargeCode, mode: 'insensitive' } },
                        { chargeName: { equals: chargeName, mode: 'insensitive' } },
                    ]
                }
            });
            if (dup) {
                errors.push({ sheet: 'Charges', row: rowNum, chargeCode, message: 'Duplicate Charge Code or Name — skipped' });
                skipped++;
                continue;
            }
 
            const taxRecords: any[] = [];
            const matchedTaxRows = taxByCharge.get(chargeName.toLowerCase()) || [];
 
            for (const { row: taxRow, rowNum: taxRowNum } of matchedTaxRows) {
                const hssacCode = (taxRow[1] || '').toString().trim();
                if (!hssacCode) continue;
 
                const hsRec = hsMap.get(hssacCode.toLowerCase());
                if (!hsRec) {
                    errors.push({ sheet: 'Tax Details', row: taxRowNum, chargeCode, message: `HS/SAC Code "${hssacCode}" not found — skipped` });
                    continue;
                }
 
                const statusRaw = (taxRow[5] || 'Active').toString().trim();
                const status = statusRaw.toLowerCase() === 'suspended' ? 'S' : 'A';
 
                taxRecords.push({
                    HSNCode: hsRec.HSSACCode,
                    HSSACMasterSid: hsRec.HSSACMasterSid,
                    TaxGroup: hsRec.TaxType || (taxRow[3] || '').toString().trim(),
                    TaxGroupSid: hsRec.TaxGroupSid || null,
                    TaxRate: hsRec.TaxRate ?? parseFloat(taxRow[4]) ?? 0,
                    description: (taxRow[2] || hsRec.HSNSACDescription || '').toString().trim(),
                    Status: status,
                    CompanyMasterSid,
                    CreatedBy: createdBy,
                    UpdatedBy: createdBy,
                });
            }
 
            const tdsRecords: any[] = [];
            const matchedTdsRows = tdsByCharge.get(chargeName.toLowerCase()) || [];
 
            for (const { row: tdsRow, rowNum: tdsRowNum } of matchedTdsRows) {
                const tdsName = (tdsRow[1] || '').toString().trim();
                if (!tdsName) continue;
 
                const tdsRec = tdsMap.get(tdsName.toLowerCase());
                if (!tdsRec) {
                    errors.push({ sheet: 'TDS Details', row: tdsRowNum, chargeCode, message: `TDS Set "${tdsName}" not found — skipped` });
                    continue;
                }
 
                const statusRaw = (tdsRow[3] || 'Active').toString().trim();
                const status = statusRaw.toLowerCase() === 'suspended' ? 'S' : 'A';
 
                tdsRecords.push({
                    TDSSet: tdsRec.TDSSetHeaderSid,
                    EffectiveFrom: tdsRec.EffectiveFrom ? new Date(tdsRec.EffectiveFrom) : null,
                    status,
                    createdBy,
                    updatedBy: createdBy,
                });
            }
 
            try {
                await this._db.$transaction(async (prisma) => {
                    const charge = await prisma.chargeMaster.create({
                        data: {
                            chargeCode,
                            chargeName,
                            ChargeGroupSid: Number(ChargeGroupSid),
                            CurrencyMasterSid: Number(CurrencyMasterSid),
                            UOM: UOMMasterSid,
                            UnitQty,
                            DepartmentMasterSid,
                            CompanyMasterSid,
                            Status: 'A',
                            createdBy,
                            updatedBy: createdBy,
                        }
                    });
 
                    if (taxRecords.length) {
                        await prisma.chargeTaxMaster.createMany({
                            data: taxRecords.map(t => ({ ...t, chargeTaxMasterSid: charge.ChargeMasterSid }))
                        });
                    }
 
                    if (tdsRecords.length) {
                        await prisma.chargeTds.createMany({
                            data: tdsRecords.map(t => ({ ...t, ChargeMasterSid: charge.ChargeMasterSid }))
                        });
                    }
                });
 
                created++;
            } catch (err) {
                errors.push({ sheet: 'Charges', row: rowNum, chargeCode, message: err.message || 'DB error' });
                skipped++;
            }
        }
 
        return { created, skipped, errors };
    }
 
    // ─── STEP 1 SERVICE: PARSE ONLY — no DB writes ────────────────────────────────
    async parseChargeExcel(
        buffer: Buffer,
        CompanyMasterSid: number
    ): Promise<{
        validRows: any[];
        invalidRows: any[];
        summary: { total: number; valid: number; invalid: number };
    }> {
        const workbook = XLSX.read(buffer, { type: 'buffer' });
 
        const getRows = (partialName: string, skipRows: number): any[][] => {
            const name = workbook.SheetNames.find(n =>
                n.toLowerCase().includes(partialName.toLowerCase())
            );
            if (!name) return [];
            const all: any[][] = XLSX.utils.sheet_to_json(workbook.Sheets[name], {
                header: 1, defval: null, raw: false
            });
            all.splice(0, skipRows);
            return all.filter(r => r.some(cell => cell !== null && cell !== ''));
        };
 
        const chargeRows = getRows('charge', 3);
        const taxRows = getRows('tax', 4);
        const tdsRows = getRows('tds', 3);
 
        const [chargeGroups, currencies, departments, uoms, hsnsacs, tdsSets] = await Promise.all([
            this._db.chargeGroup.findMany({ where: { status: 'A', CompanyMasterSid } }),
            this._db.currencyMaster.findMany(),
            // ── Fetch full department records including FCLLCL and ExportImport ──
            this._db.departmentMaster.findMany({
                where: { CompanyMasterSid },
                select: { DepartmentMasterSid: true, departmentName: true, FCLLCL: true, ExportImport: true }
            }),
            this._db.uOMMaster.findMany({ where: { UOMType: 'C', status: 'A' } }),
            this._db.hSSACMaster.findMany({ where: { status: 'A' } }),
            this._db.tDSSetHeader.findMany({ where: { status: 'A', CompanyMasterSid } }),
        ]);
 
        const cgMap = new Map(chargeGroups.map(x => [x.GroupName.trim().toLowerCase(), x.ChargeGroupSid]));
        const curMap = new Map(currencies.map(x => [x.currencyCode.trim().toLowerCase(), x.CurrencyMasterSid]));
        const deptNameSet = new Set<string>(departments.map(x => x.departmentName.trim().toLowerCase()));
        const uomMap = new Map(uoms.map(x => [x.UOMCode.trim().toLowerCase(), x.UOMMasterSid]));
        // ── UOM lookup by SID for compatibility check ──
        const uomCodeBySid = new Map(uoms.map(x => [x.UOMMasterSid, x.UOMCode]));
        const hsMap = new Map(hsnsacs.map(x => [x.HSSACCode.trim().toLowerCase(), x]));
        const tdsMap = new Map(tdsSets.map(x => [x.TDSSetName.trim().toLowerCase(), x]));
 
        const taxByCharge = new Map<string, any[]>();
        taxRows.forEach((row, i) => {
            const name = (row[0] || '').toString().trim().toLowerCase();
            if (!name) return;
            if (!taxByCharge.has(name)) taxByCharge.set(name, []);
            taxByCharge.get(name)!.push({ row, rowNum: i + 5 });
        });
 
        const tdsByCharge = new Map<string, any[]>();
        tdsRows.forEach((row, i) => {
            const name = (row[0] || '').toString().trim().toLowerCase();
            if (!name) return;
            if (!tdsByCharge.has(name)) tdsByCharge.set(name, []);
            tdsByCharge.get(name)!.push({ row, rowNum: i + 4 });
        });
 
        const existingCharges = await this._db.chargeMaster.findMany({
            where: { CompanyMasterSid, Status: { not: 'D' } },
            select: { chargeCode: true, chargeName: true }
        });
        const existingCodes = new Set(existingCharges.map(x => x.chargeCode.toLowerCase()));
        const existingNames = new Set(existingCharges.map(x => x.chargeName.toLowerCase()));
 
        const validRows: any[] = [];
        const invalidRows: any[] = [];
 
        for (let i = 0; i < chargeRows.length; i++) {
            const row = chargeRows[i];
            const rowNum = i + 4;
            const rowErrors: string[] = [];
 
            const chargeCode = (row[0] || '').toString().trim().toUpperCase();
            const chargeName = (row[1] || '').toString().trim();
            if (!chargeCode && !chargeName) continue;
 
            if (!chargeCode) rowErrors.push('Charge Code is required');
            else if (chargeCode.length > 5) rowErrors.push('Charge Code must be ≤ 5 characters');
 
            if (!chargeName) rowErrors.push('Charge Name is required');
            else if (chargeName.length > 100) rowErrors.push('Charge Name must be ≤ 100 characters');
 
            const cgName = (row[2] || '').toString().trim();
            const ChargeGroupSid = cgMap.get(cgName.toLowerCase());
            if (!cgName) rowErrors.push('Charge Group is required');
            else if (!ChargeGroupSid) rowErrors.push(`Charge Group "${cgName}" not found`);
 
            const curCode = (row[3] || '').toString().trim();
            const CurrencyMasterSid = curMap.get(curCode.toLowerCase());
            if (!curCode) rowErrors.push('Currency is required');
            else if (!CurrencyMasterSid) rowErrors.push(`Currency "${curCode}" not found`);
 
            const uomCode = (row[4] || '').toString().trim();
            const UOMMasterSid = uomMap.get(uomCode.toLowerCase());
            if (!uomCode) rowErrors.push('UOM is required');
            else if (!UOMMasterSid) rowErrors.push(`UOM "${uomCode}" not found`);
 
            const UnitQty = (row[5] || '').toString().trim();
            const unitQtyDisplayToValue: Record<string, string> = {
  'per 45ft cont':       'Per 45ft Cont',
  'per 40ft cont':       'Per 40ft Cont',
  'per 20ft cont':       'Per 20ft Cont',
  'per cont':            'Per Cont',
  'per cbm':             'Per CBM',
  'per bl':              'Per BL',
  'chargeableweight':    'ChargeableWeight',
  'chargeable weight':   'ChargeableWeight',  // handles the spaced variant
  'per shipment':        'Per Shipment',
  'per grossweight':     'Per GrossWeight',
  'per gross weight':    'Per GrossWeight',   // handles the spaced variant
};

const normalizedUnitQty = unitQtyDisplayToValue[UnitQty.toLowerCase()] ?? UnitQty;
            if (!normalizedUnitQty) rowErrors.push('Unit Quantity is required');
 
            // Read multi-select departments from columns G–K (indices 6–10)
            const rawDeptNames: string[] = [];
            for (let dCol = 6; dCol <= 10; dCol++) {
                const dName = (row[dCol] || '').toString().trim();
                if (dName) rawDeptNames.push(dName);
            }
            if (rawDeptNames.length === 0) rowErrors.push('At least one Department is required');
 
            if (chargeCode && existingCodes.has(chargeCode.toLowerCase()))
                rowErrors.push(`Charge Code "${chargeCode}" already exists`);
 
            if (chargeName && existingNames.has(chargeName.toLowerCase()))
                rowErrors.push(`Charge Name "${chargeName}" already exists`);
 
            const alreadyInValid = validRows.find(
                v => v.chargeCode === chargeCode || v.chargeName.toLowerCase() === chargeName.toLowerCase()
            );
            if (alreadyInValid)
                rowErrors.push(`Duplicate in file: "${chargeCode}" already appears in a previous row`);
 
            // Resolve department names
            const DepartmentMasterSid: string[] = [];
            const deptErrors: string[] = [];
            for (const dName of rawDeptNames) {
                if (deptNameSet.has(dName.toLowerCase())) {
                    const matched = departments.find(d => d.departmentName.toLowerCase() === dName.toLowerCase());
                    if (matched) DepartmentMasterSid.push(matched.departmentName);
                } else {
                    deptErrors.push(`Department "${dName}" not found`);
                }
            }
            if (deptErrors.length) rowErrors.push(...deptErrors);

            // ── UOM + Department compatibility validation ──────────────────────────
            // Only run if both UOM and departments resolved successfully
            if (UOMMasterSid && rawDeptNames.length > 0 && deptErrors.length === 0) {
                const resolvedUOMCode = uomCodeBySid.get(UOMMasterSid) || uomCode.toUpperCase();
                const resolvedDepts = departments.filter(d =>
                    rawDeptNames.map(n => n.toLowerCase()).includes(d.departmentName.toLowerCase())
                );
                const compatError = this.validateUOMDeptCompatibility(resolvedUOMCode, resolvedDepts);
                if (compatError) {
                    rowErrors.push(compatError);
                }
            }
            // ─────────────────────────────────────────────────────────────────────
 
            const taxRecords: any[] = [];
            const taxErrors: any[] = [];
            const matchedTax = taxByCharge.get(chargeName.toLowerCase()) || [];
 
            for (const { row: taxRow, rowNum: taxRowNum } of matchedTax) {
                const hssacCode = (taxRow[1] || '').toString().trim();
                if (!hssacCode) continue;
                const hsRec = hsMap.get(hssacCode.toLowerCase());
                if (!hsRec) {
                    taxErrors.push({ sheet: 'Tax Details', row: taxRowNum, message: `HS/SAC "${hssacCode}" not found` });
                    continue;
                }
                const statusRaw = (taxRow[5] || 'Active').toString().trim();
                taxRecords.push({
                    HSNCode: hsRec.HSSACCode,
                    HSSACMasterSid: hsRec.HSSACMasterSid,
                    TaxGroup: hsRec.TaxType || (taxRow[3] || '').toString().trim(),
                    TaxGroupSid: hsRec.TaxGroupSid || null,
                    TaxRate: hsRec.TaxRate ?? parseFloat(taxRow[4]) ?? 0,
                    description: (taxRow[2] || hsRec.HSNSACDescription || '').toString().trim(),
                    Status: statusRaw.toLowerCase() === 'suspended' ? 'S' : 'A',
                });
            }
 
            const tdsRecords: any[] = [];
            const tdsErrors: any[] = [];
            const matchedTds = tdsByCharge.get(chargeName.toLowerCase()) || [];
 
            for (const { row: tdsRow, rowNum: tdsRowNum } of matchedTds) {
                const tdsName = (tdsRow[1] || '').toString().trim();
                if (!tdsName) continue;
                const tdsRec = tdsMap.get(tdsName.toLowerCase());
                if (!tdsRec) {
                    tdsErrors.push({ sheet: 'TDS Details', row: tdsRowNum, message: `TDS Set "${tdsName}" not found` });
                    continue;
                }
                const statusRaw = (tdsRow[3] || 'Active').toString().trim();
                tdsRecords.push({
                    TDSSet: tdsRec.TDSSetHeaderSid,
                    EffectiveFrom: tdsRec.EffectiveFrom ? new Date(tdsRec.EffectiveFrom) : null,
                    status: statusRaw.toLowerCase() === 'suspended' ? 'S' : 'A',
                });
            }
 
            const rowResult = {
                rowNum,
                chargeCode,
                chargeName,
                chargeGroup: cgName,
                currency: curCode,
                uom: uomCode,
                unitQty: normalizedUnitQty,
                departments: rawDeptNames.join('; '),
                ChargeGroupSid: ChargeGroupSid ?? null,
                CurrencyMasterSid: CurrencyMasterSid ?? null,
                UOMMasterSid: UOMMasterSid ?? null,
                DepartmentMasterSid,
                taxRecords,
                tdsRecords,
                taxErrors,
                tdsErrors,
            };
 
            if (rowErrors.length) {
                invalidRows.push({ ...rowResult, errors: rowErrors });
            } else {
                validRows.push(rowResult);
            }
        }
 
        return {
            validRows,
            invalidRows,
            summary: {
                total: validRows.length + invalidRows.length,
                valid: validRows.length,
                invalid: invalidRows.length,
            }
        };
    }
 
    // ─── STEP 2 SERVICE: SAVE ONLY — receives pre-validated rows ──────────────────
    async saveChargeExcel(
        validRows: any[],
        CompanyMasterSid: number,
        createdBy: string
    ): Promise<{ created: number; skipped: number; errors: any[] }> {
 
        let created = 0, skipped = 0;
        const errors: any[] = [];
 
        for (const row of validRows) {
            const dup = await this._db.chargeMaster.findFirst({
                where: {
                    CompanyMasterSid,
                    OR: [
                        { chargeCode: { equals: row.chargeCode, mode: 'insensitive' } },
                        { chargeName: { equals: row.chargeName, mode: 'insensitive' } },
                    ]
                }
            });
            if (dup) {
                errors.push({ chargeCode: row.chargeCode, message: 'Duplicate found at save time — skipped' });
                skipped++;
                continue;
            }
 
            try {
                await this._db.$transaction(async (prisma) => {
                    const charge = await prisma.chargeMaster.create({
                        data: {
                            chargeCode: row.chargeCode,
                            chargeName: row.chargeName,
                            ChargeGroupSid: Number(row.ChargeGroupSid),
                            CurrencyMasterSid: Number(row.CurrencyMasterSid),
                            UOM: row.UOMMasterSid,
                            UnitQty: row.unitQty,
                            DepartmentMasterSid: row.DepartmentMasterSid,
                            CompanyMasterSid,
                            Status: 'A',
                            createdBy,
                            updatedBy: createdBy,
                        }
                    });
 
                    if (row.taxRecords?.length) {
                        await prisma.chargeTaxMaster.createMany({
                            data: row.taxRecords.map((t: any) => ({
                                ...t,
                                chargeTaxMasterSid: charge.ChargeMasterSid,
                                CompanyMasterSid,
                                CreatedBy: createdBy,
                                UpdatedBy: createdBy,
                            }))
                        });
                    }
 
                    if (row.tdsRecords?.length) {
                        await prisma.chargeTds.createMany({
                            data: row.tdsRecords.map((t: any) => ({
                                ...t,
                                ChargeMasterSid: charge.ChargeMasterSid,
                                createdBy,
                                updatedBy: createdBy,
                            }))
                        });
                    }
                });
 
                created++;
            } catch (err) {
                errors.push({ chargeCode: row.chargeCode, message: err.message || 'DB insert failed' });
                skipped++;
            }
        }
 
        return { created, skipped, errors };
    }
}
