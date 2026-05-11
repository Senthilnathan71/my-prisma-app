import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { CompanyConfiguration, Prisma } from '@prisma/client';
import { DatabaseService } from 'src/database/database.service';

type ConfigType = 'string' | 'number' | 'boolean' | 'email-array';

@Injectable()
export class CompanyConfigService {
    constructor(private _db: DatabaseService, private logger: Logger) { }

    private normalizeCompanyIds(payload: any): number[] {
        const rawIds =
            payload?.CompanyMasterSids ??
            payload?.companyMasterSids ??
            payload?.CompanyMasterSid ??
            payload?.companyMasterSid ??
            payload?.companyIds ??
            payload?.companyId;

        const ids = Array.isArray(rawIds) ? rawIds : rawIds !== undefined && rawIds !== null ? [rawIds] : [];
        const normalized = ids
            .map((id: any) => Number(id))
            .filter((id: number) => Number.isInteger(id) && id > 0);

        return Array.from(new Set(normalized));
    }

    private normalizeConfigType(type: any): ConfigType {
        const normalized = String(type || 'string').toLowerCase();
        return ['string', 'number', 'boolean', 'email-array'].includes(normalized)
            ? (normalized as ConfigType)
            : 'string';
    }

    private resolveDisplayName(configurationName: string, displayName?: string | null): string {
        const trimmed = String(displayName || '').trim();
        if (trimmed) return trimmed;

        return String(configurationName || '')
            .replace(/([A-Z])/g, ' $1')
            .replace(/^./, str => str.toUpperCase())
            .trim();
    }

    private serializeConfigurationValue(value: any, configType: ConfigType): string {
        switch (configType) {
            case 'boolean':
                if (value === true || value === 1) return 'Y';
                if (value === false || value === 0 || value === null || value === undefined) return 'N';
                return ['Y', 'YES', 'TRUE'].includes(String(value).trim().toUpperCase()) ? 'Y' : 'N';
            case 'number':
                if (value === null || value === undefined || value === '') return '';
                return Number(value).toString();
            case 'email-array':
                if (Array.isArray(value)) {
                    return value.map(item => String(item).trim()).filter(Boolean).join(', ');
                }
                return String(value || '')
                    .split(',')
                    .map(item => item.trim())
                    .filter(Boolean)
                    .join(', ');
            default:
                return value === null || value === undefined ? '' : String(value);
        }
    }

    private async findDuplicateCompanies(companyIds: number[], configurationName: string, tx: any = this._db) {
        const prisma: any = tx;
        return prisma.companyConfiguration.findMany({
            where: {
                CompanyMasterSid: { in: companyIds },
                ConfigurationName: configurationName,
                Status: 'A'
            },
            select: {
                CompanyMasterSid: true,
                CompanyMaster: {
                    select: {
                        companyName: true,
                        companyCode: true
                    }
                }
            }
        });
    }

    private async createConfigurationRows(companyIds: number[], payload: any, user: any, tx: Prisma.TransactionClient) {
        const configType = this.normalizeConfigType(payload.ConfigType ?? payload.ConfigurationType);
        const configurationName = String(payload.ConfigurationName || '').trim();
        const displayName = this.resolveDisplayName(configurationName, payload.DisplayName);
        const configurationValue = this.serializeConfigurationValue(
            payload.ConfigurationValue ?? payload.ConfigurationValue?.value,
            configType
        );

        const createdConfigs: CompanyConfiguration[] = [];

        for (const companyId of companyIds) {
            const createdConfig = await tx.companyConfiguration.create({
                data: {
                    CompanyMasterSid: companyId,
                    ConfigurationName: configurationName,
                    DisplayName: displayName,
                    ConfigType: configType,
                    ConfigurationValue: configurationValue,
                    CreatedBy: user.userEmail,
                    UpdatedBy: user.userEmail,
                    Status: 'A'
                }
            });
            createdConfigs.push(createdConfig);
        }

        return createdConfigs;
    }

    async createCompanyConfig(newData: any, user: any) {
        try {
            const companyIds = this.normalizeCompanyIds(newData);
            const configurationName = String(newData.ConfigurationName || '').trim();

            if (!companyIds.length) {
                throw new BadRequestException('CompanyMasterSid is required');
            }
            if (!configurationName) {
                throw new BadRequestException('ConfigurationName is required');
            }

            const duplicateConfigs = await this.findDuplicateCompanies(companyIds, configurationName);
            if (duplicateConfigs.length) {
                const duplicateCompanyNames = duplicateConfigs
                    .map((item: any) => item.CompanyMaster?.companyName || item.CompanyMasterSid)
                    .join(', ');
                throw new BadRequestException(
                    `Configuration '${configurationName}' already exists for: ${duplicateCompanyNames}`
                );
            }

            const result = await this._db.$transaction(async (tx) => {
                const createdConfigs = await this.createConfigurationRows(companyIds, { ...newData, ConfigurationName: configurationName }, user, tx);
                return createdConfigs.length === 1 ? createdConfigs[0] : createdConfigs;
            });

            return result;
        } catch (error) {
            throw error;
        }
    }

    async createBulkCompanyConfigs(companyConfigs: any[], user: any) {
        try {
            if (!Array.isArray(companyConfigs)) {
                throw new BadRequestException('Configurations array is required');
            }

            const normalizedItems = companyConfigs.flatMap((configData) => {
                const companyIds = this.normalizeCompanyIds(configData);
                if (!companyIds.length) {
                    return [];
                }
                return companyIds.map(companyId => ({
                    ...configData,
                    CompanyMasterSid: companyId,
                    CompanyMasterSids: [companyId]
                }));
            });

            if (!normalizedItems.length) {
                throw new BadRequestException('CompanyMasterSid is required for all configurations');
            }

            const result = await this._db.$transaction(async (tx) => {
                const createdConfigs: CompanyConfiguration[] = [];

                for (const configData of normalizedItems) {
                    const configurationName = String(configData.ConfigurationName || '').trim();

                    if (!configurationName) {
                        throw new BadRequestException('ConfigurationName is required for all configurations');
                    }

                    const duplicateConfigs = await this.findDuplicateCompanies(
                        [Number(configData.CompanyMasterSid)],
                        configurationName,
                        tx
                    );

                    if (duplicateConfigs.length) {
                        const duplicateCompanyNames = duplicateConfigs
                            .map((item: any) => item.CompanyMaster?.companyName || item.CompanyMasterSid)
                            .join(', ');
                        throw new BadRequestException(
                            `Configuration '${configurationName}' already exists for: ${duplicateCompanyNames}`
                        );
                    }

                    const createdConfig = await this.createConfigurationRows(
                        [Number(configData.CompanyMasterSid)],
                        { ...configData, ConfigurationName: configurationName },
                        user,
                        tx
                    );
                    createdConfigs.push(...createdConfig);
                }

                return createdConfigs;
            });

            return result;
        } catch (error) {
            throw error;
        }
    }

    async getCompanyConfigsByCompanyId(CompanyMasterSid: number) {
        try {
            const configs = await this._db.companyConfiguration.findMany({
                where: {
                    CompanyMasterSid: CompanyMasterSid,
                    Status: 'A'
                },
                orderBy: {
                    ConfigurationName: 'asc'
                },
                include: {
                    CompanyMaster: {
                        select: {
                            companyName: true,
                            companyCode: true
                        }
                    }
                }
            });

            return configs || [];
        } catch (error) {
            throw error;
        }
    }

    async getCompanyConfigById(CompanyConfigurationSid: number) {
        try {
            const config = await this._db.companyConfiguration.findUnique({
                where: {
                    CompanyConfigurationSid: CompanyConfigurationSid
                },
                include: {
                    CompanyMaster: {
                        select: {
                            companyName: true,
                            companyCode: true
                        }
                    }
                }
            });

            if (!config) {
                throw new BadRequestException(`Company Configuration with id: ${CompanyConfigurationSid} not found`);
            }

            return config;
        } catch (error) {
            throw error;
        }
    }

    async updateCompanyConfig(CompanyConfigurationSid: number, updateData: any, user: any) {
        try {
            const existing = await this._db.companyConfiguration.findUnique({
                where: {
                    CompanyConfigurationSid: CompanyConfigurationSid
                }
            });

            if (!existing) {
                throw new BadRequestException(`Company Configuration with id: ${CompanyConfigurationSid} not found`);
            }

            const nextName = String((updateData.ConfigurationName ?? existing.ConfigurationName) || '').trim();
            if (nextName && nextName !== existing.ConfigurationName) {
                const duplicateConfig = await this._db.companyConfiguration.findFirst({
                    where: {
                        CompanyMasterSid: existing.CompanyMasterSid,
                        ConfigurationName: nextName,
                        Status: 'A',
                        CompanyConfigurationSid: {
                            not: CompanyConfigurationSid
                        }
                    }
                });

                if (duplicateConfig) {
                    throw new BadRequestException(`Configuration '${nextName}' already exists for this company`);
                }
            }

            const configType = this.normalizeConfigType(updateData.ConfigType ?? updateData.ConfigurationType ?? existing.ConfigType);
            const updatedConfig = await this._db.companyConfiguration.update({
                where: {
                    CompanyConfigurationSid: CompanyConfigurationSid
                },
                data: {
                    ConfigurationName: nextName || existing.ConfigurationName,
                    DisplayName: this.resolveDisplayName(nextName || existing.ConfigurationName, updateData.DisplayName ?? existing.DisplayName),
                    ConfigType: configType,
                    ConfigurationValue: this.serializeConfigurationValue(
                        updateData.ConfigurationValue ?? updateData.ConfigurationValue?.value ?? existing.ConfigurationValue,
                        configType
                    ),
                    UpdatedBy: user.userEmail,
                    UpdatedOn: new Date()
                }
            });

            return updatedConfig;
        } catch (error) {
            throw error;
        }
    }

    async softDeleteCompanyConfigById(CompanyConfigurationSid: number) {
        try {
            const existing = await this._db.companyConfiguration.findUnique({
                where: {
                    CompanyConfigurationSid: CompanyConfigurationSid
                }
            });

            if (!existing) {
                throw new BadRequestException(`Company Configuration with id: ${CompanyConfigurationSid} not found`);
            }

            if (existing.Status === 'D') {
                throw new BadRequestException(`Company Configuration with id: ${CompanyConfigurationSid} is already deleted`);
            }

            const deletedConfig = await this._db.companyConfiguration.update({
                where: {
                    CompanyConfigurationSid: CompanyConfigurationSid
                },
                data: {
                    Status: 'D',
                    UpdatedOn: new Date()
                }
            });

            return deletedConfig;
        } catch (error) {
            throw error;
        }
    }

    async bulkUpdateCompanyConfigs(bulkData: any, user: any) {
        try {
            const { CompanyMasterSid, configurations } = bulkData;

            if (!CompanyMasterSid) {
                throw new BadRequestException('CompanyMasterSid is required for bulk update');
            }

            if (!configurations || !Array.isArray(configurations)) {
                throw new BadRequestException('Configurations array is required');
            }

            const result = await this._db.$transaction(async (prisma) => {
                const results: CompanyConfiguration[] = [];

                for (const config of configurations) {
                    const configType = this.normalizeConfigType(config.ConfigType ?? config.ConfigurationType);

                    let operationResult: CompanyConfiguration;

                    if (config.CompanyConfigurationSid) {
                        const existing = await prisma.companyConfiguration.findUnique({
                            where: {
                                CompanyConfigurationSid: Number(config.CompanyConfigurationSid)
                            }
                        });

                        if (!existing) {
                            throw new BadRequestException(
                                `Company Configuration with id: ${config.CompanyConfigurationSid} not found`
                            );
                        }

                        operationResult = await prisma.companyConfiguration.update({
                            where: {
                                CompanyConfigurationSid: Number(config.CompanyConfigurationSid)
                            },
                            data: {
                                ConfigurationName: config.ConfigurationName ?? existing.ConfigurationName,
                                DisplayName: this.resolveDisplayName(
                                    config.ConfigurationName ?? existing.ConfigurationName,
                                    config.DisplayName ?? existing.DisplayName
                                ),
                                ConfigType: configType,
                                ConfigurationValue: this.serializeConfigurationValue(
                                    config.ConfigurationValue ?? existing.ConfigurationValue,
                                    configType
                                ),
                                UpdatedBy: user.userEmail,
                                UpdatedOn: new Date()
                            }
                        });
                    } else {
                        const companyIds = this.normalizeCompanyIds(config);
                        const targetCompanyIds = companyIds.length ? companyIds : [Number(CompanyMasterSid)];
                        const configurationName = String(config.ConfigurationName || '').trim();

                        if (!configurationName) {
                            throw new BadRequestException('ConfigurationName is required for all configurations');
                        }

                        const duplicateConfigs = await this.findDuplicateCompanies(targetCompanyIds, configurationName, prisma);

                        if (duplicateConfigs.length) {
                            const duplicateCompanyNames = duplicateConfigs
                                .map((item: any) => item.CompanyMaster?.companyName || item.CompanyMasterSid)
                                .join(', ');
                            throw new BadRequestException(
                                `Configuration '${configurationName}' already exists for: ${duplicateCompanyNames}`
                            );
                        }

                        const createdConfig = await this.createConfigurationRows(
                            targetCompanyIds,
                            { ...config, ConfigurationName: configurationName },
                            user,
                            prisma
                        );
                        operationResult = createdConfig[0];
                    }

                    results.push(operationResult);
                }

                return results;
            });

            return result;
        } catch (error) {
            throw error;
        }
    }

    async getEligibleCompaniesForConfiguration(ConfigurationName: string) {
        try {
            const configurationName = String(ConfigurationName || '').trim();
            const configuredCompanies = await this._db.companyConfiguration.findMany({
                where: {
                    ConfigurationName: configurationName,
                    Status: 'A'
                },
                select: {
                    CompanyMasterSid: true
                }
            });

            const excludedCompanyIds = configuredCompanies.map(item => item.CompanyMasterSid);

            const companies = await this._db.companyMaster.findMany({
                where: {
                    status: 'A',
                    ...(excludedCompanyIds.length
                        ? { CompanyMasterSid: { notIn: excludedCompanyIds } }
                        : {})
                },
                select: {
                    CompanyMasterSid: true,
                    companyName: true,
                    companyCode: true
                },
                orderBy: {
                    companyName: 'asc'
                }
            });

            return companies;
        } catch (error) {
            throw error;
        }
    }

    async getConfigurationValue(CompanyMasterSid: number, ConfigurationName: string, tx?: Prisma.TransactionClient) {
        try {
            const prisma = tx || this._db;
            const config = await prisma.companyConfiguration.findFirst({
                where: {
                    CompanyMasterSid: CompanyMasterSid,
                    ConfigurationName: ConfigurationName,
                    Status: 'A'
                }
            });

            return config ? config.ConfigurationValue : null;
        } catch (error) {
            throw error;
        }
    }
}
