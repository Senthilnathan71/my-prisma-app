import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { DatabaseService } from 'src/database/database.service';
import { CompanyConfiguration } from '@prisma/client';

@Injectable()
export class CompanyConfigService {
    constructor(private _db: DatabaseService, private logger: Logger) { }

    async createCompanyConfig(newData: any, user: any) {
        try {
            // Validate required fields
            if (!newData.CompanyMasterSid) {
                throw new BadRequestException('CompanyMasterSid is required');
            }
            if (!newData.ConfigurationName) {
                throw new BadRequestException('ConfigurationName is required');
            }

            // Check if configuration already exists for this company
            const existingConfig = await this._db.companyConfiguration.findFirst({
                where: {
                    CompanyMasterSid: newData.CompanyMasterSid,
                    ConfigurationName: newData.ConfigurationName,
                    Status: 'A'
                }
            });

            if (existingConfig) {
                throw new BadRequestException(`Configuration '${newData.ConfigurationName}' already exists for this company`);
            }

            const createdConfig = await this._db.companyConfiguration.create({
                data: {
                    CompanyMasterSid: newData.CompanyMasterSid,
                    ConfigurationName: newData.ConfigurationName,
                    ConfigurationValue: newData.ConfigurationValue || '',
                    CreatedBy: user.userEmail,
                    Status: 'A'
                }
            });

            return createdConfig;
        } catch (error) {
            throw error;
        }
    }

    async createBulkCompanyConfigs(companyConfigs: any[], user: any) {
        try {
            const result = await this._db.$transaction(async (prisma) => {
                // Explicitly type the array
                const createdConfigs: CompanyConfiguration[] = [];

                for (const configData of companyConfigs) {
                    // Validate required fields
                    if (!configData.CompanyMasterSid) {
                        throw new BadRequestException('CompanyMasterSid is required for all configurations');
                    }
                    if (!configData.ConfigurationName) {
                        throw new BadRequestException('ConfigurationName is required for all configurations');
                    }

                    // Check if configuration already exists
                    const existingConfig = await prisma.companyConfiguration.findFirst({
                        where: {
                            CompanyMasterSid: configData.CompanyMasterSid,
                            ConfigurationName: configData.ConfigurationName,
                            Status: 'A'
                        }
                    });

                    if (existingConfig) {
                        // Update existing configuration
                        const updatedConfig = await prisma.companyConfiguration.update({
                            where: {
                                CompanyConfigurationSid: existingConfig.CompanyConfigurationSid
                            },
                            data: {
                                ConfigurationValue: configData.ConfigurationValue || '',
                                UpdatedBy: user.userEmail,
                                UpdatedOn: new Date()
                            }
                        });
                        createdConfigs.push(updatedConfig);
                    } else {
                        // Create new configuration
                        const createdConfig = await prisma.companyConfiguration.create({
                            data: {
                                CompanyMasterSid: configData.CompanyMasterSid,
                                ConfigurationName: configData.ConfigurationName,
                                ConfigurationValue: configData.ConfigurationValue || '',
                                CreatedBy: user.userEmail,
                                Status: 'A'
                            }
                        });
                        createdConfigs.push(createdConfig);
                    }
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

            if (!configs || configs.length === 0) {
                throw new BadRequestException(`No configurations found for company with id: ${CompanyMasterSid}`);
            }

            return configs;
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

            // If ConfigurationName is being updated, check for duplicates
            if (updateData.ConfigurationName && updateData.ConfigurationName !== existing.ConfigurationName) {
                const duplicateConfig = await this._db.companyConfiguration.findFirst({
                    where: {
                        CompanyMasterSid: existing.CompanyMasterSid,
                        ConfigurationName: updateData.ConfigurationName,
                        Status: 'A',
                        CompanyConfigurationSid: {
                            not: CompanyConfigurationSid
                        }
                    }
                });

                if (duplicateConfig) {
                    throw new BadRequestException(`Configuration '${updateData.ConfigurationName}' already exists for this company`);
                }
            }

            const updatedConfig = await this._db.companyConfiguration.update({
                where: {
                    CompanyConfigurationSid: CompanyConfigurationSid
                },
                data: {
                    ...updateData,
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
                // Explicitly type the array
                const results: CompanyConfiguration[] = [];

                for (const config of configurations) {
                    let operationResult: CompanyConfiguration;

                    if (config.CompanyConfigurationSid) {
                        // Update existing configuration
                        operationResult = await prisma.companyConfiguration.update({
                            where: {
                                CompanyConfigurationSid: config.CompanyConfigurationSid
                            },
                            data: {
                                ConfigurationName: config.ConfigurationName,
                                ConfigurationValue: config.ConfigurationValue || '',
                                UpdatedBy: user.userEmail,
                                UpdatedOn: new Date()
                            }
                        });
                    } else {
                        // Create new configuration
                        operationResult = await prisma.companyConfiguration.create({
                            data: {
                                CompanyMasterSid: CompanyMasterSid,
                                ConfigurationName: config.ConfigurationName,
                                ConfigurationValue: config.ConfigurationValue || '',
                                CreatedBy: user.userEmail,
                                Status: 'A'
                            }
                        });
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

    async getConfigurationValue(CompanyMasterSid: number, ConfigurationName: string) {
        try {
            const config = await this._db.companyConfiguration.findFirst({
                where: {
                    CompanyMasterSid: CompanyMasterSid,
                    ConfigurationName: ConfigurationName,
                    
                }
            });

            return config ? config.ConfigurationValue : null;
        } catch (error) {
            throw error;
        }
    }
}