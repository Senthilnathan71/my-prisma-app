import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { DatabaseService } from 'src/database/database.service';
import {
    CreateMailConfigurationDto,
    SearchMailConfigurationDto,
    UpdateMailConfigurationDto,
} from 'src/masters/DTO/mail-configuration.dto';

@Injectable()
export class MailConfigurationService {
    constructor(
        private _db: DatabaseService,
        private logger: Logger
    ) {}

    async create(dto: CreateMailConfigurationDto, userEmail: string) {
        try {
            // Check for duplicate MailName within the same company
            const existing = await this._db.mailConfigurationMaster.findFirst({
                where: {
                    CompanyMasterSid: dto.CompanyMasterSid,
                    MailName: {
                        equals: dto.MailName.trim(),
                        mode: 'insensitive',
                    },
                    Status: 'A',
                },
            });

            if (existing) {
                throw new BadRequestException(
                    'Mail configuration with this name already exists for the company.'
                );
            }

            const createdRecord = await this._db.mailConfigurationMaster.create({
                data: {
                    CompanyMasterSid: dto.CompanyMasterSid,
                    Sno: dto.Sno,
                    Action:dto.Action,
                    Trigger: dto.Trigger,
                    MailName: dto.MailName.trim(),
                    MenuMasterSid: dto.MenuMasterSid,
                    MailSubject: dto.MailSubject,
                    MailBody: dto.MailBody,
                    ToEmailidFrom: dto.ToEmailidFrom || '',
                    CcEmailidFrom: dto.CcEmailidFrom || '',
                    AttachmentRequire: dto.AttachmentRequire || 'Y',
                    AutoPopup: dto.AutoPopup || 'P',
                    CreatedBy: userEmail,
                },
            });

            return createdRecord;
        } catch (error) {
            this.logger.warn(`MailConfiguration create error: ${error}`);
            throw error;
        }
    }

    async findAll(CompanyMasterSid: number) {
        try {
            const records = await this._db.mailConfigurationMaster.findMany({
                where: {
                    CompanyMasterSid,
                    Status: 'A',
                },
                include: {
                    MenuMaster: {
                        select: {
                            MenuName:true
                        },
                    },
                    CompanyMaster: {
                        select: {
                            companyName: true,
                        },
                    },
                },
                orderBy: {
                    Sno: 'asc',
                },
            });

            return records;
        } catch (error) {
            this.logger.warn(`MailConfiguration findAll error: ${error}`);
            throw error;
        }
    }

    async findById(id: number) {
        try {
            const record = await this._db.mailConfigurationMaster.findUnique({
                where: {
                    MailConfigurationMasterSid: id,
                },
                include: {
                    MenuMaster: {
                        select: {
                            MenuName: true,
                            MenuMasterSid: true,
                        },
                    },
                    CompanyMaster: {
                        select: {
                            companyName: true,
                        },
                    },
                },
            });

            if (!record) {
                throw new BadRequestException(
                    `Mail configuration with id ${id} not found.`
                );
            }

            return record;
        } catch (error) {
            this.logger.warn(`MailConfiguration findById error: ${error}`);
            throw error;
        }
    }

    async update(id: number, dto: UpdateMailConfigurationDto, userEmail: string) {
        try {
            const existing = await this._db.mailConfigurationMaster.findUnique({
                where: {
                    MailConfigurationMasterSid: id,
                },
            });

            if (!existing) {
                throw new BadRequestException(
                    `Mail configuration with id ${id} not found.`
                );
            }

            // Check for duplicate MailName if updating
            if (dto.MailName) {
                const duplicate = await this._db.mailConfigurationMaster.findFirst({
                    where: {
                        CompanyMasterSid: existing.CompanyMasterSid,
                        MailName: {
                            equals: dto.MailName.trim(),
                            mode: 'insensitive',
                        },
                        MailConfigurationMasterSid: {
                            not: id,
                        },
                        Status: 'A',
                    },
                });

                if (duplicate) {
                    throw new BadRequestException(
                        'Mail configuration with this name already exists.'
                    );
                }
            }

            const { CompanyMasterSid, MenuMasterSid, ...updateData } = dto as any;

            const updatedRecord = await this._db.mailConfigurationMaster.update({
                where: {
                    MailConfigurationMasterSid: id,
                },
                data: {
                    ...updateData,
                    MailName: dto.MailName?.trim(),
                    UpdatedBy: userEmail,
                    UpdatedOn: new Date(),
                    ...(MenuMasterSid && {
                        MenuMaster: { connect: { MenuMasterSid: Number(MenuMasterSid) } },
                    }),
                },
            });

            return updatedRecord;
        } catch (error) {
            this.logger.warn(`MailConfiguration update error: ${error}`);
            throw error;
        }
    }

    async softDelete(id: number, userEmail: string) {
        try {
            const existing = await this._db.mailConfigurationMaster.findUnique({
                where: {
                    MailConfigurationMasterSid: id,
                },
            });

            if (!existing) {
                throw new BadRequestException(
                    `Mail configuration with id ${id} not found.`
                );
            }

            if (existing.Status === 'D') {
                throw new BadRequestException(
                    `Mail configuration is already deleted.`
                );
            }

            const deletedRecord = await this._db.mailConfigurationMaster.update({
                where: {
                    MailConfigurationMasterSid: id,
                },
                data: {
                    Status: 'D',
                    UpdatedBy: userEmail,
                    UpdatedOn: new Date(),
                },
            });

            return deletedRecord;
        } catch (error) {
            this.logger.warn(`MailConfiguration softDelete error: ${error}`);
            throw error;
        }
    }

    async search(params: SearchMailConfigurationDto) {
        try {
            const {
                search = '',
                page = 1,
                pageSize = 10,
                CompanyMasterSid,
                sortColumn = 'Sno',
                sortDirection = 'asc',
            } = params;

            const skip = (page - 1) * pageSize;

            const where: Prisma.MailConfigurationMasterWhereInput = {
                CompanyMasterSid,
                Status: 'A',
                ...(search
                    ? {
                          OR: [
                              {
                                  MailName: {
                                      contains: search,
                                      mode: 'insensitive',
                                  },
                              },
                              {
                                  MailSubject: {
                                      contains: search,
                                      mode: 'insensitive',
                                  },
                              },
                              {
                                  MenuMaster: {
                                      MenuName: {
                                          contains: search,
                                          mode: 'insensitive',
                                      },
                                  },
                              },
                          ],
                      }
                    : {}),
            };

            const orderBy: any = {};
            if (sortColumn && sortDirection) {
                orderBy[sortColumn] = sortDirection.toLowerCase();
            } else {
                orderBy['Sno'] = 'asc';
            }

            const [items, totalCount] = await this._db.$transaction([
                this._db.mailConfigurationMaster.findMany({
                    where,
                    skip,
                    take: pageSize,
                    include: {
                        MenuMaster: {
                            select: {
                                MenuName: true,
                            },
                        },
                        CompanyMaster: {
                            select: {
                                companyName: true,
                            },
                        },
                    },
                    orderBy,
                }),
                this._db.mailConfigurationMaster.count({ where }),
            ]);

            return {
                items,
                totalCount,
            };
        } catch (error) {
            this.logger.warn(`MailConfiguration search error: ${error}`);
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
            this.logger.warn(`MailConfiguration getAuditLogs error: ${error}`);
            throw new Error(`Error fetching audit logs: ${error.message}`);
        }
    }
}
