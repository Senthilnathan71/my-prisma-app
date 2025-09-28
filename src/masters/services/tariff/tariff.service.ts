//Tariff.service.ts//
import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { GlobalConfigService } from 'src/common/config/master-config.service';
import { statusWhereClause } from 'src/common/helper';
import { DatabaseService } from 'src/database/database.service';
import { SearchListDto } from 'src/masters/DTO/search-list.dto';
import { filterDto } from 'src/masters/DTO/search-vessel.dto';

@Injectable()
export class TariffService {
    constructor(private _db: DatabaseService, private logger: Logger, private globalConfigService: GlobalConfigService) { }

    /**
     * Dynamic duplication check based on filled fields
     */
    private async checkDuplicateTariff(newData: any, excludeTariffId?: number): Promise<void> {
        // Define all possible fields for duplication check
        const possibleFields = [
            'DepartmentMasterSid',
            'POLSid', 
            'PODSid',
            'Carrier',
            'FDCSid',
            'IncoTerms',
            'AgentSid',
            'CompanyMasterSid'
        ];

        // Filter only fields that have values (not null/undefined)
        const filledFields = possibleFields.filter(field => 
            newData[field] !== undefined && 
            newData[field] !== null && 
            newData[field] !== ''
        );

        // Must have at least Department, POL, POD for basic duplication check
        const mandatoryFields = ['DepartmentMasterSid', 'POLSid', 'PODSid', 'CompanyMasterSid'];
        const missingMandatory = mandatoryFields.filter(field => !filledFields.includes(field));
        
        if (missingMandatory.length > 0) {
            throw new BadRequestException(
                `Missing mandatory fields for duplication check: ${missingMandatory.join(', ')}`
            );
        }

        // Build where clause dynamically based on filled fields
        const whereClause: any = {
            status: 'A'
        };

        // Add only filled fields to where clause
        filledFields.forEach(field => {
            whereClause[field] = newData[field];
        });

        // Exclude current record when updating
        if (excludeTariffId) {
            whereClause.TariffHeaderSid = { not: excludeTariffId };
        }

        const existing = await this._db.tariffHeader.findFirst({
            where: whereClause,
        });

        if (existing) {
            const fieldNames = this.getFieldNames(filledFields, newData);
            throw new BadRequestException(
                `Tariff already exists for the combination: ${fieldNames}`
            );
        }
    }

    /**
     * Get human-readable field names for error message
     */
    private getFieldNames(fields: string[], data: any): string {
        const fieldMap = {
            'DepartmentMasterSid': 'Department',
            'POLSid': 'POL',
            'PODSid': 'POD',
            'Carrier': 'Carrier',
            'FDCSid': 'FDC',
            'IncoTerms': 'Inco Terms',
            'AgentSid': 'Agent',
            'CompanyMasterSid': 'Company'
        };

        return fields.map(field => {
            const value = data[field];
            const fieldName = fieldMap[field] || field;
            return `${fieldName}`;
        }).join(', ');
    }

    async createNewTariff(newData: any) {
        try {
            // Check for duplicates based on filled fields
            await this.checkDuplicateTariff(newData);

            let createdTariff = await this._db.tariffHeader.create({
                data: {
                    ...newData,
                    CompanyMasterSid: newData.CompanyMasterSid
                }
            });
            return createdTariff;
        } catch (error) {
            throw error;
        }
    }

    async getAllTariff(CompanyMasterSid: number) {
        try {
            let allTariff = await this._db.tariffHeader.findMany({
                where: {
                    status: statusWhereClause,
                    CompanyMasterSid: CompanyMasterSid
                },
                include: {
                    departmentMaster: {
                        select: {
                            departmentName: true
                        }
                    }
                }
            });
            return allTariff;
        } catch (error) {
            throw error;
        }
    }

    async getTariffById(TariffHeaderSid: number) {
        try {
            let ourTariff = await this._db.tariffHeader.findUnique({
                where: {
                    TariffHeaderSid: TariffHeaderSid
                }
            });
            if (!ourTariff) {
                throw new BadRequestException(`Tariff with id : ${TariffHeaderSid} not exists`);
            }
            return ourTariff;
        } catch (error) {
            throw error;
        }
    }

    async updateTariffById(TariffHeaderSid: number, updateData: any) {
        try {
            let exists = await this._db.tariffHeader.findUnique({
                where: {
                    TariffHeaderSid: TariffHeaderSid
                }
            });
            
            if (!exists) {
                throw new BadRequestException(`Tariff with id : ${TariffHeaderSid} not exists`);
            }

            // Merge existing data with update data
            const mergedData = { ...exists, ...updateData };
            
            // Check for duplicates based on filled fields, excluding current record
            await this.checkDuplicateTariff(mergedData, TariffHeaderSid);

            let updatedTariff = await this._db.tariffHeader.update({
                where: {
                    TariffHeaderSid: TariffHeaderSid
                },
                data: updateData
            });
            return updatedTariff;
        } catch (error) {
            throw error;
        }
    }

    async deleteTariffById(TariffHeaderSid: number) {
        try {
            let exists = await this._db.tariffHeader.findUnique({
                where: {
                    TariffHeaderSid: TariffHeaderSid
                }
            })
            if (!exists) {
                throw new BadRequestException(`Tariff with id : ${TariffHeaderSid} not exists`);
            }
            if (exists.status === 'D') {
                throw new BadRequestException(`Tariff with id : ${TariffHeaderSid} is already deleted`);
            }

            const result = await this._db.$transaction(async (prisma) => {
                let deletedTariff = await prisma.tariffHeader.update({
                    where: {
                        TariffHeaderSid: TariffHeaderSid
                    },
                    data: {
                        status: 'D'
                    }
                })
                let deletedTariffDetail = await prisma.tariffDetail.updateMany({
                    where: {
                        TariffHeaderSid: TariffHeaderSid,
                        status: { not: 'D' }
                    },
                    data: {
                        status: 'D'
                    }
                })
                return {
                    deletedTariff,
                    tariffDetail: deletedTariffDetail
                }
            })
            return result;
        } catch (error) {
            throw error;
        }
    }

    async searchTariff(data: SearchListDto) {
        const { searchType, filterValue } = data;
        const stringFields = [
            "DepartmentName",
            "POLTerminal",
            "PODTerminal",
            "EffectiveDate",
            "status"
        ];
        const intFields = [
            "Carrier",
            "AgentSid",
        ]
        const acceptedType = [...stringFields, ...intFields];
        this.logger.log(`Search List DTO`, JSON.stringify(data));
        if (!acceptedType.includes(searchType)) {
            throw new BadRequestException(`Invalid Search Type`);
        }
        let whereClause: any = {};

        if (stringFields.includes(searchType)) {
            whereClause[searchType] = {
                contains: filterValue,
                mode: 'insensitive'
            }
        } else if (intFields.includes(searchType)) {
            const numberValue = parseInt(filterValue);
            if (isNaN(numberValue)) {
                throw new BadRequestException(`${searchType} must be a valid number`);
            }
            whereClause[searchType] = numberValue;
        }
        const searchResults = await this._db.tariffHeader.findMany({
            where: {
                ...whereClause,
                status: 'A'
            },
            include: {
                departmentMaster: {
                    select: {
                        departmentName: true,
                    }
                },
                customerCarrier: {
                    select: {
                        CustomerName: true
                    }
                },
                customerAgent: {
                    select: {
                        CustomerName: true
                    }
                }
            }
        }).catch((err) => {
            throw new Error(`Error Occurred : ${JSON.stringify(err)}`);
        })
        return searchResults;
    }

    async searchTariffNew(params: filterDto) {
        const { search = '', page = 1, pageSize = 15, activeCompanyId } = params;
        const skip = (page - 1) * pageSize;

        const where: Prisma.TariffHeaderWhereInput = {
            status: statusWhereClause,
            CompanyMasterSid: activeCompanyId,
            ...(search
                ? {
                    OR: [
                        { departmentMaster: { departmentName: { contains: search, mode: 'insensitive' } } },
                        { POLTerminal: { contains: search, mode: 'insensitive' } },
                        { PODTerminal: { contains: search, mode: 'insensitive' } },
                        { customerCarrier: { CustomerName: { contains: search, mode: 'insensitive' } } },
                        { customerAgent: { CustomerName: { contains: search, mode: 'insensitive' } } },
                    ],
                }
                : {}
            ),
        };

        let items;
        let totalCount;
        [items, totalCount] = await this._db.$transaction([
            this._db.tariffHeader.findMany({
                where,
                skip,
                take: pageSize,
                orderBy: { TariffHeaderSid: 'desc' },
            }),
            this._db.tariffHeader.count({ where }),
        ]);

        items = await Promise.all(
            items.map(async (item) => {
                const [departmentMaster, customerCarrier, customerAgent] = await Promise.all([
                    item.DepartmentMasterSid !== null ?
                        this.globalConfigService.getMasterData('department_master', item.DepartmentMasterSid) :
                        { DepartmentMasterSid: null, departmentName: '' },

                    item.Carrier !== null ?
                        this.globalConfigService.getMasterData('customer_master', item.Carrier) :
                        { CustomerMasterSid: null, CustomerName: '' },

                    item.AgentSid !== null ?
                        this.globalConfigService.getMasterData('customer_master', item.AgentSid) :
                        { CustomerMasterSid: null, CustomerName: '' },

                ])

                return {
                    ...item,
                    departmentMaster,
                    customerCarrier,
                    customerAgent
                }
            })
        )

        return {
            items,
            totalCount,
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