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

    private resolveTargetCompanySids(input: any, fallbackCompanySid?: number): number[] {
        const rawCompanySids: any[] =
            (input?.CompanyMasterSids?.length
                ? input.CompanyMasterSids
                : [input?.CompanyMasterSid ?? fallbackCompanySid]) || [];

        const companySids: number[] = Array.from(
            new Set<number>(
                rawCompanySids
                    .map((sid: any) => Number(sid))
                    .filter((sid: number) => Number.isFinite(sid) && sid > 0)
            )
        );

        return companySids;
    }

    private buildMailConfigData(dto: any, userEmail: string, isUpdate = false): Prisma.MailConfigurationMasterUncheckedCreateInput {
        const data: any = {
            Sno: Number(dto.Sno),
            MailName: String(dto.MailName || '').trim(),
            MenuMasterSid: Number(dto.MenuMasterSid),
            MailSubject: String(dto.MailSubject || ''),
            MailBody: String(dto.MailBody || ''),
            ToEmailidFrom: dto.ToEmailidFrom || '',
            CcEmailidFrom: dto.CcEmailidFrom || '',
            AttachmentRequire: dto.AttachmentRequire || 'Y',
            AutoPopup: dto.AutoPopup || 'P',
            Action: dto.Action,
            Trigger: dto.Trigger,
            UpdateFields: Array.isArray(dto.UpdateFields) ? dto.UpdateFields : []
        };

        if (isUpdate) {
            data.UpdatedBy = userEmail;
            data.UpdatedOn = new Date();
        } else {
            data.CreatedBy = userEmail;
        }

        return data;
    }

    private async findDuplicateCompanies(companySids: number[], menuMasterSid: number, tx: any = this._db) {
        const prisma: any = tx;
        return prisma.mailConfigurationMaster.findMany({
            where: {
                CompanyMasterSid: { in: companySids },
                MenuMasterSid: Number(menuMasterSid),
                Status: 'A',
            },
            select: {
                CompanyMasterSid: true,
                CompanyMaster: {
                    select: {
                        companyName: true,
                    },
                },
            },
        });
    }

    async create(dto: CreateMailConfigurationDto, userEmail: string) {
        try {
            const targetCompanySids = this.resolveTargetCompanySids(dto);
            const normalizedMailName = String(dto.MailName || '').trim();
            const menuMasterSid = Number(dto.MenuMasterSid);

            if (targetCompanySids.length === 0) {
                throw new BadRequestException('At least one company must be selected.');
            }
            if (!normalizedMailName) {
                throw new BadRequestException('MailName is required.');
            }
            if (!menuMasterSid) {
                throw new BadRequestException('MenuMasterSid is required.');
            }

            const createdRecords = await this._db.$transaction(async (prisma) => {
                const duplicateConfigs = await this.findDuplicateCompanies(
                    targetCompanySids,
                    menuMasterSid,
                    prisma
                );
                if (duplicateConfigs.length) {
                    const duplicateCompanyNames = duplicateConfigs
                        .map((item: any) => item.CompanyMaster?.companyName || item.CompanyMasterSid)
                        .join(', ');
                    throw new BadRequestException(
                        `Mail configuration already exists for this menu in: ${duplicateCompanyNames}`
                    );
                }

                const results: any[] = [];
                for (const companySid of targetCompanySids) {
                    const createData: any = this.buildMailConfigData(
                        { ...dto, MailName: normalizedMailName, MenuMasterSid: menuMasterSid },
                        userEmail,
                        false
                    );
                    createData.CompanyMasterSid = companySid;
                    const createdRecord = await prisma.mailConfigurationMaster.create({ data: createData });
                    results.push(createdRecord);
                }
                return results;
            });

            return createdRecords[0];
        } catch (error) {
            this.logger.warn(`MailConfiguration create error: ${error}`);
            throw error;
        }
    }

    async findAll(CompanyMasterSid: number) {
        try {
            const records = await this._db.mailConfigurationMaster.findMany({
                where: {
                    Status: 'A',
                },
                include: {
                    MenuMaster: {
                        select: {
                            MenuName: true
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

            const groupedMap = new Map<string, any>();

            for (const record of records) {
                const key = [
                    record.Sno,
                    record.MailName,
                    record.MenuMasterSid,
                    record.MailSubject,
                    record.MailBody,
                    record.ToEmailidFrom,
                    record.CcEmailidFrom,
                    record.AttachmentRequire,
                    record.AutoPopup,
                    record.Action,
                    record.Trigger,
                    JSON.stringify(record.UpdateFields || []),
                    record.Status,
                ].join('||');

                if (!groupedMap.has(key)) {
                    groupedMap.set(key, {
                        ...record,
                        CompanyMasterSids: [Number(record.CompanyMasterSid)].filter(Boolean),
                    });
                } else {
                    const existing = groupedMap.get(key);
                    const nextSids = Array.from(new Set([
                        ...(existing.CompanyMasterSids || []),
                        Number(record.CompanyMasterSid)
                    ].filter(Boolean)));
                    existing.CompanyMasterSids = nextSids;
                    if (Number(record.CompanyMasterSid) === Number(CompanyMasterSid)) {
                        existing.CompanyMasterSid = Number(CompanyMasterSid);
                    }
                }
            }

            return Array.from(groupedMap.values());
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

            const nextMenuMasterSid = Number((dto as any).MenuMasterSid ?? existing.MenuMasterSid);
            const duplicate = await this._db.mailConfigurationMaster.findFirst({
                where: {
                    CompanyMasterSid: existing.CompanyMasterSid,
                    MenuMasterSid: nextMenuMasterSid,
                    MailConfigurationMasterSid: {
                        not: id,
                    },
                    Status: 'A',
                },
            });

            if (duplicate) {
                throw new BadRequestException(
                    'Mail configuration already exists for this company and menu.'
                );
            }

            const updateData = this.buildMailConfigData(
                {
                    ...existing,
                    ...dto,
                    Sno: dto.Sno ?? existing.Sno,
                    MailName: dto.MailName ?? existing.MailName,
                    MenuMasterSid: dto.MenuMasterSid ?? existing.MenuMasterSid,
                    MailSubject: dto.MailSubject ?? existing.MailSubject,
                    MailBody: dto.MailBody ?? existing.MailBody,
                    ToEmailidFrom: dto.ToEmailidFrom ?? existing.ToEmailidFrom,
                    CcEmailidFrom: dto.CcEmailidFrom ?? existing.CcEmailidFrom,
                    AttachmentRequire: dto.AttachmentRequire ?? existing.AttachmentRequire,
                    AutoPopup: dto.AutoPopup ?? existing.AutoPopup,
                    Action: (dto as any).Action ?? existing.Action,
                    Trigger: (dto as any).Trigger ?? existing.Trigger,
                    UpdateFields: (dto as any).UpdateFields ?? existing.UpdateFields
                },
                userEmail,
                true
            ) as any;

            if (dto.Status) {
                updateData.Status = dto.Status;
            }
            updateData.CompanyMasterSid = existing.CompanyMasterSid;

            const updatedRecord = await this._db.mailConfigurationMaster.update({
                where: {
                    MailConfigurationMasterSid: id,
                },
                data: updateData,
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

