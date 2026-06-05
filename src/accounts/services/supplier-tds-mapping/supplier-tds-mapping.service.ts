import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { GlobalConfigService } from 'src/common/config/master-config.service';
import { statusWhereClause } from 'src/common/helper';
import { DatabaseService } from 'src/database/database.service';
import { filterDto } from 'src/masters/DTO/search-vessel.dto';
@Injectable()
export class SupplierTdsMappingService {
    constructor(private _db: DatabaseService, private globalConfigService: GlobalConfigService, private logger: Logger) { }

    async getAllSupptdsMapping() {
        try {
            const allsupptdsmapp = await this._db.supplierTdsMapping.findMany({
                where: {
                    Status: 'A'
                }
            })
            return allsupptdsmapp;
        } catch (error) {
            throw error;
        }
    }

    async createNewSupptdsMapping(payload) {
        try {
            await this.validateNoOverlappingActiveMapping(payload);
            const rateRow = await this.validateRateExistsForVendor(
                payload.TDSSetHeaderSid,
                payload.CustomerMasterSid,
            );
            await this.validateCertificateUnderMasterRate(payload, rateRow);

            const createdSupptdsMapping = await this._db.supplierTdsMapping.create({
                data: {
                    ...payload,
                    CompanyMasterSid: payload.CompanyMasterSid,
                },
            });
            return createdSupptdsMapping;
        } catch (error) {
            throw error;
        }
    }

    async createBatchSupptdsMapping(payloads: any[]) {
        // Validate every row before opening the transaction so errors surface cleanly.
        const rateRows: any[] = [];
        for (const payload of payloads) {
            await this.validateNoOverlappingActiveMapping(payload);
            const rateRow = await this.validateRateExistsForVendor(
                payload.TDSSetHeaderSid,
                payload.CustomerMasterSid,
            );
            await this.validateCertificateUnderMasterRate(payload, rateRow);
            rateRows.push(rateRow);
        }
        // All validations passed — create atomically.
        return this._db.$transaction(
            payloads.map(payload =>
                this._db.supplierTdsMapping.create({ data: payload }),
            ),
        );
    }

    async fetchSuppliertdsMappingById(SupplierTdsMappingSid: number) {
        try {
            const ourSupplierTDSMapping = await this._db.supplierTdsMapping.findUnique({
                where: {
                    SupplierTdsMappingSid: SupplierTdsMappingSid
                },
                include: {
                    customerMaster: {
                        include: { countryMaster: { select: { countryName: true } } }
                    }
                }
            })
            if (!ourSupplierTDSMapping) {
                throw new BadRequestException(`Supplier TDS Mapping with Id : ${SupplierTdsMappingSid} not exists`);
            }
            return ourSupplierTDSMapping;
        } catch (error) {
            throw error;
        }
    }


    async updateSuppliertdsMappingById(SupplierTdsMappingSid: number, payload) {
        try {
            const exist = await this._db.supplierTdsMapping.findUnique({
                where: { SupplierTdsMappingSid },
            });
            if (!exist) {
                throw new BadRequestException(`Supplier TDS Mapping with Id : ${SupplierTdsMappingSid} not exists`);
            }

            const merged = { ...exist, ...payload };
            await this.validateNoOverlappingActiveMapping(merged, SupplierTdsMappingSid);
            const rateRow = await this.validateRateExistsForVendor(
                merged.TDSSetHeaderSid,
                merged.CustomerMasterSid,
            );
            await this.validateCertificateUnderMasterRate(merged, rateRow);

            const updatedSupplierTdsMappingSid = this._db.supplierTdsMapping.update({
                where: { SupplierTdsMappingSid },
                data: {
                    ...payload,
                    UpdatedOn: new Date(),
                },
            });
            return updatedSupplierTdsMappingSid;
        } catch (error) {
            throw error;
        }
    }

    async updateBatchSupptdsMapping(rows: { SupplierTdsMappingSid: number; payload: any }[]) {
        // Validate every row before opening the transaction so errors surface cleanly.
        for (const { SupplierTdsMappingSid, payload } of rows) {
            const exist = await this._db.supplierTdsMapping.findUnique({
                where: { SupplierTdsMappingSid },
            });
            if (!exist) {
                throw new BadRequestException(`Supplier TDS Mapping with Id: ${SupplierTdsMappingSid} not found`);
            }
            const merged = { ...exist, ...payload };
            await this.validateNoOverlappingActiveMapping(merged, SupplierTdsMappingSid);
            const rateRow = await this.validateRateExistsForVendor(
                merged.TDSSetHeaderSid,
                merged.CustomerMasterSid,
            );
            await this.validateCertificateUnderMasterRate(merged, rateRow);
        }
        // All validations passed — update atomically.
        return this._db.$transaction(
            rows.map(({ SupplierTdsMappingSid, payload }) =>
                this._db.supplierTdsMapping.update({
                    where: { SupplierTdsMappingSid },
                    data: { ...payload, UpdatedOn: new Date() },
                }),
            ),
        );
    }

    async deleteSuppliertdsMapping(SupplierTdsMappingSid: number) {
        try {
            const exist = await this._db.supplierTdsMapping.findUnique({
                where: {
                    SupplierTdsMappingSid: SupplierTdsMappingSid
                }
            })
            if (!exist) {
                throw new BadRequestException(`Supplier TDS Mapping with Id : ${SupplierTdsMappingSid} not exists`);
            }
            if (exist.Status === 'D') {
                throw new BadRequestException(`Supplier TDS Mapping with Id :${SupplierTdsMappingSid} is already deleted`)
            }
            const deletedSupplierTDSMapping = this._db.supplierTdsMapping.update({
                where: {
                    SupplierTdsMappingSid: SupplierTdsMappingSid
                },
                data: {
                    Status: 'D'
                }
            })
            return deletedSupplierTDSMapping;
        } catch (error) {
            throw error;
        }
    }

    // SM-1: only one active mapping per (Customer + Branch + Company) for any overlapping window.
    private async validateNoOverlappingActiveMapping(payload: any, excludeSid?: number): Promise<void> {
        if (!payload?.CustomerMasterSid || !payload?.CustomerBranchSid || !payload?.CompanyMasterSid) {
            return;
        }
        const newFrom = payload.EffectiveFrom ? new Date(payload.EffectiveFrom) : null;
        const newTo = payload.EffectiveTo ? new Date(payload.EffectiveTo) : null;

        const candidates = await this._db.supplierTdsMapping.findMany({
            where: {
                Status: 'A',
                CustomerMasterSid: payload.CustomerMasterSid,
                CustomerBranchSid: payload.CustomerBranchSid,
                CompanyMasterSid: payload.CompanyMasterSid,
                ...(excludeSid ? { SupplierTdsMappingSid: { not: excludeSid } } : {}),
            },
        });

        const overlap = candidates.find((row) => this.windowsOverlap(
            newFrom, newTo,
            row.EffectiveFrom ? new Date(row.EffectiveFrom) : null,
            row.EffectiveTo ? new Date(row.EffectiveTo) : null,
        ));
        if (!overlap) return;

        const [customer, branch] = await Promise.all([
            this._db.customerMaster.findUnique({
                where: { CustomerMasterSid: payload.CustomerMasterSid },
                select: { CustomerName: true },
            }),
            this._db.customerBranch.findUnique({
                where: { CustomerBranchSid: payload.CustomerBranchSid },
                select: { BranchName: true },
            }),
        ]);

        const fromStr = overlap.EffectiveFrom ? new Date(overlap.EffectiveFrom).toISOString().slice(0, 10) : 'open-start';
        const toStr = overlap.EffectiveTo ? new Date(overlap.EffectiveTo).toISOString().slice(0, 10) : 'open-ended';

        throw new BadRequestException(
            `An active TDS mapping already exists for vendor "${customer?.CustomerName}" branch "${branch?.BranchName}" covering ${fromStr} to ${toStr}. End-date or update the existing mapping before creating a new one.`,
        );
    }

    private windowsOverlap(aFrom: Date | null, aTo: Date | null, bFrom: Date | null, bTo: Date | null): boolean {
        // null treated as open-ended on that side.
        const aStart = aFrom?.getTime() ?? -Infinity;
        const aEnd = aTo?.getTime() ?? Infinity;
        const bStart = bFrom?.getTime() ?? -Infinity;
        const bEnd = bTo?.getTime() ?? Infinity;
        return aStart <= bEnd && bStart <= aEnd;
    }

    // SM-2: picked TDSSetHeader must have an active rate row matching vendor's CompanyType + Country.
    // Returns the matched rate row so SM-4 can reuse it.
    private async validateRateExistsForVendor(TDSSetHeaderSid: number, CustomerMasterSid: number) {
        if (!TDSSetHeaderSid || !CustomerMasterSid) return null;

        const customer = await this._db.customerMaster.findUnique({
            where: { CustomerMasterSid },
            select: {
                CustomerName: true,
                CompanyType: true,
                CountryMasterSid: true,
                countryMaster: { select: { countryName: true } },
            },
        });
        if (!customer) return null;

        const header = await this._db.tDSSetHeader.findUnique({
            where: { TDSSetHeaderSid },
            select: { TDSSetName: true },
        });
        if (!header) {
            throw new BadRequestException(`TDS Set not found. Pick a valid TDS Set.`);
        }

        const today = new Date();
        const rateRow = await this._db.tDSSetRate.findFirst({
            where: {
                TDSSetHeaderSid,
                status: 'A',
                EffectiveFrom: { lte: today },
                ...(customer.CompanyType ? { CompanyType: customer.CompanyType } : {}),
                OR: customer.CountryMasterSid
                    ? [{ CountryMasterSid: customer.CountryMasterSid }, { CountryMasterSid: null }]
                    : [{ CountryMasterSid: null }],
            },
            orderBy: { EffectiveFrom: 'desc' },
        });

        if (!rateRow) {
            const countryName = customer.countryMaster?.countryName ?? 'unknown';
            throw new BadRequestException(
                `TDS Set "${header.TDSSetName}" has no active rate row for vendor "${customer.CustomerName}" classification — CompanyType: "${customer.CompanyType ?? '-'}", Country: "${countryName}". Add a matching rate row in the TDS Set or pick a different set.`,
            );
        }
        return { ...rateRow, customerName: customer.CustomerName, customerCompanyType: customer.CompanyType };
    }

    // SM-4: Certificate % cannot exceed the master rate.
    private async validateCertificateUnderMasterRate(payload: any, rateRow: any): Promise<void> {
        if (payload?.TaxExempt !== 'Y') return;
        if (!rateRow) return;
        const certPct = Number(payload?.CertificatePercentage ?? 0);
        const masterRate = Number(rateRow.TDSRate ?? 0);
        if (certPct > masterRate) {
            throw new BadRequestException(
                `Certificate Percentage ${certPct}% exceeds the master rate ${masterRate}% applicable to vendor "${rateRow.customerName}" (IT Section: "${rateRow.ITSectionCode}", CompanyType: "${rateRow.customerCompanyType ?? '-'}"). A lower-deduction certificate can only reduce the rate, not increase it.`,
            );
        }
    }

    // async searchSuppliertdsMapping(params: filterDto) {
    //     const { search = '', page = 1, pageSize = 10 } = params;
    //     const skip = (page - 1) * pageSize;

    //     const where: Prisma.SupplierTdsMappingWhereInput = {
    //         deletedAt: null,
    //         Status: 'A',
    //         ...(search
    //             ? {
    //                 OR: [
    //                     {
    //                         customerMaster: {
    //                             CustomerName: { contains: search, mode: 'insensitive' },
    //                             OR: [
    //                                 { CustomerType: { path: ['supplier'], equals: 'isTrue' } },
    //                                 { CustomerType: { path: ['transporter'], equals: 'isTrue' } },
    //                                 { CustomerType: { path: ['agent'], equals: 'isTrue' } },
    //                             ],
    //                         },
    //                     },
    //                     {
    //                         customerMaster: { PanName: { contains: search, mode: 'insensitive' } },
    //                     },
    //                     {
    //                         customerMaster: { CompanyType : { contains: search, mode: 'insensitive' } },
    //                     },
    //                     {
    //                         customerMaster: { countryMaster: { countryName: { contains: search, mode: 'insensitive' } } },
    //                     },
    //                 ],
    //             }
    //             : {}),
    //     };

    //     const [items, totalCount] = await this._db.$transaction([
    //         this._db.supplierTdsMapping.findMany({
    //             where,
    //             skip,
    //             take: pageSize,
    //             orderBy: { SupplierTdsMappingSid: 'desc' },

    //         }),
    //         this._db.supplierTdsMapping.count({ where }),
    //     ]);

    //     // Enrich each item with master data using GlobalConfigService
    //     const enrichedItems = await Promise.all(
    //         items.map(async (item) => {
    //             const customer = await this.globalConfigService.getMasterData(
    //                 'customer_master',
    //                 item.CustomerMasterSid,
    //                 item.CompanyMasterSid
    //             );

    //             const country = item.CountryMasterSid
    //                 ? await this.globalConfigService.getMasterData(
    //                     'country_master',
    //                     item.CountryMasterSid,
    //                     item.CompanyMasterSid
    //                 )
    //                 : null;

    //             return {
    //                 ...item,
    //                 customerMaster: customer,
    //                 countryMaster: country,
    //             };
    //         })
    //     );


    //     return {
    //         items,
    //         totalCount,
    //     };
    // }

    async searchSuppliertdsMapping(params: filterDto) {
        const { search = '', page = 1, pageSize = 10, activeCompanyId } = params;
        const skip = (page - 1) * pageSize;

        const where: Prisma.SupplierTdsMappingWhereInput = {
            Status: statusWhereClause,
            CompanyMasterSid: activeCompanyId,
            ...(search
                ? {
                    OR: [
                        {
                            customerMaster: {
                                CustomerName: { contains: search, mode: 'insensitive' },
                                OR: [
                                    { CustomerType: { path: ['supplier'], equals: 'isTrue' } },
                                    { CustomerType: { path: ['transporter'], equals: 'isTrue' } },
                                    { CustomerType: { path: ['agent'], equals: 'isTrue' } },
                                ],
                            },
                        },
                        {
                            customerMaster: { PanType: { contains: search, mode: 'insensitive' } },
                        },
                        {
                            customerMaster: { CompanyType: { contains: search, mode: 'insensitive' } },
                        },
                        {
                            customerMaster: { countryMaster: { countryName: { contains: search, mode: 'insensitive' } } },
                        },
                    ],
                }
                : {}),
        };

        // Fetch all matching rows lightweight, then deduplicate per CustomerMasterSid
        // (the list shows one entry per vendor/ledger, not per branch).
        const allRows = await this._db.supplierTdsMapping.findMany({
            where,
            orderBy: { SupplierTdsMappingSid: 'desc' },
            select: {
                SupplierTdsMappingSid: true,
                CustomerMasterSid: true,
                CompanyType: true,
                Status: true,
            },
        });

        const seenCustomers = new Set<number>();
        const distinctRows = allRows.filter(row => {
            if (seenCustomers.has(row.CustomerMasterSid)) return false;
            seenCustomers.add(row.CustomerMasterSid);
            return true;
        });

        const totalCount = distinctRows.length;
        const paginatedRows = distinctRows.slice(skip, skip + pageSize);

        const enrichedItems = await Promise.all(
            paginatedRows.map(async (item) => {
                const customer = item.CustomerMasterSid !== null ?
                    await this.globalConfigService.getMasterData(
                        'customer_master',
                        item.CustomerMasterSid
                    ) : { CustomerMasterSid: null, CustomerName: '' };

                const country = customer.CountryMasterSid !== null ?
                    await this.globalConfigService.getMasterData(
                        'country_master',
                        customer.CountryMasterSid
                    ) : { CountryMasterSid: null, countryName: '' }

                return {
                    ...item,
                    customerMaster: {
                        ...customer,
                        countryMaster: { ...country }
                    }
                };
            })
        );

        return { items: enrichedItems, totalCount };
    }
    async getByCustomer(CustomerMasterSid: number, CompanyMasterSid: number) {
        return this._db.supplierTdsMapping.findMany({
            where: {
                CustomerMasterSid,
                CompanyMasterSid,
                Status: { in: ['A', 'S'] },
            },
            orderBy: { CustomerBranchSid: 'asc' },
        });
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
