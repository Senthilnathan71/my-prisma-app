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
            const CompanyMasterSid = payload.CompanyMasterSid;
            const createdSupptdsMapping = await this._db.supplierTdsMapping.create({
                data: {
                    ...payload,
                    CompanyMasterSid: CompanyMasterSid
                }
            })
            return createdSupptdsMapping;
        } catch (error) {
            throw error;
        }
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
                where: {
                    SupplierTdsMappingSid: SupplierTdsMappingSid
                }
            })
            if (!exist) {
                throw new BadRequestException(`Supplier TDS Mapping with Id : ${SupplierTdsMappingSid} not exists`);
            }
            const updatedSupplierTdsMappingSid = this._db.supplierTdsMapping.update({
                where: {
                    SupplierTdsMappingSid: SupplierTdsMappingSid
                },
                data: {
                    ...payload,
                    UpdatedOn: new Date()
                }
            })
            return updatedSupplierTdsMappingSid;
        } catch (error) {
            throw error;
        }
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
                    Status: 'A'
                }
            })
            return deletedSupplierTDSMapping;
        } catch (error) {
            throw error;
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
                            customerMaster: { PanName: { contains: search, mode: 'insensitive' } },
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

        const [items, totalCount] = await this._db.$transaction([
            this._db.supplierTdsMapping.findMany({
                where,
                skip,
                take: pageSize,
                orderBy: { SupplierTdsMappingSid: 'desc' },
            }),
            this._db.supplierTdsMapping.count({ where }),
        ]);

        //  New global config included here
        const enrichedItems = await Promise.all(
            items.map(async (item) => {
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
                        countryMaster: {
                            ...country
                        }
                    }
                };
            })
        );

        return {
            items: enrichedItems,
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
