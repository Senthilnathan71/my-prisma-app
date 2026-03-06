import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { GlobalConfigService } from 'src/common/config/master-config.service';
import { statusWhereClause } from 'src/common/helper';
import { DatabaseService } from 'src/database/database.service';
import { SearchListDto } from 'src/masters/DTO/search-list.dto';
import { filterDto } from 'src/masters/DTO/search-vessel.dto';

@Injectable()
export class DocumentTypeService {
    constructor(private _db: DatabaseService, private globalConfigService: GlobalConfigService, private logger: Logger) { }

    async getAllDocType(CompanyMasterSid: number, BranchMasterSid: number) {
        try {
            const allDocType = await this._db.voucherTypeMaster.findMany({
                where: {
                    status: 'A',
                    CompanyMasterSid: CompanyMasterSid,
                    BranchMasterSid: BranchMasterSid
                }
            })
            return allDocType;
        } catch (error) {
            throw error;
        }
    }

    async createNewDocType(payload) {
        try {
            const duplicate = await this._db.voucherTypeMaster.findFirst({
                where: {
                    CompanyMasterSid: payload.CompanyMasterSid,
                    DocumentTypeCode: payload.DocumentTypeCode,
                    Type: payload.Type,
                    status: statusWhereClause,
                }
            });
            if (duplicate) {
                throw new BadRequestException('Document type with this combination of Company, DocumentTypeCode and Type already exists');
            }
            const createdDocType = await this._db.voucherTypeMaster.create({
                data: {
                    ...payload,
                }
            })
            return createdDocType;
        } catch (error) {
            throw error;
        }
    }

    async fetchDocTypeById(VoucherTypeMasterSid: number) {
        try {
            const ourDocType = await this._db.voucherTypeMaster.findUnique({
                where: {
                    VoucherTypeMasterSid: VoucherTypeMasterSid
                }
            })
            if (!ourDocType) {
                throw new BadRequestException(`DocType with Id : ${VoucherTypeMasterSid} not exists`);
            }
            return ourDocType;
        } catch (error) {
            throw error;
        }
    }

    async updateDocTypeById(VoucherTypeMasterSid: number, payload) {
        try {
            const exist = await this._db.voucherTypeMaster.findUnique({
                where: {
                    VoucherTypeMasterSid: VoucherTypeMasterSid
                }
            })
            if (!exist) {
                throw new BadRequestException(`DocType with Id : ${VoucherTypeMasterSid} not exists`);
            }
            const duplicate = await this._db.voucherTypeMaster.findFirst({
                where: {
                    CompanyMasterSid: payload.CompanyMasterSid ?? exist.CompanyMasterSid,
                    DocumentTypeCode: payload.DocumentTypeCode ?? exist.DocumentTypeCode,
                    Type: payload.Type ?? exist.Type,
                    status: statusWhereClause,
                    VoucherTypeMasterSid: { not: VoucherTypeMasterSid },
                }
            });
            if (duplicate) {
                throw new BadRequestException('Document type with this combination of Company, DocumentTypeCode and Type already exists');
            }
            const updatedDocType = this._db.voucherTypeMaster.update({
                where: {
                    VoucherTypeMasterSid: VoucherTypeMasterSid
                },
                data: payload
            })
            return updatedDocType;
        } catch (error) {
            throw error;
        }
    }


    async deleteDocType(VoucherTypeMasterSid: number) {
        try {
            const exist = await this._db.voucherTypeMaster.findUnique({
                where: {
                    VoucherTypeMasterSid: VoucherTypeMasterSid
                }
            })
            if (!exist) {
                throw new BadRequestException(`DocType with Id : ${VoucherTypeMasterSid} not exists`);
            }
            if (exist.status === 'D') {
                throw new BadRequestException(`DocType with Id :${VoucherTypeMasterSid} is already deleted`)
            }
            const deletedDocType = this._db.voucherTypeMaster.update({
                where: {
                    VoucherTypeMasterSid: VoucherTypeMasterSid
                },
                data: {
                    status: 'D'
                }
            })
            return deletedDocType;
        } catch (error) {
            throw error;
        }
    }


    async searchDocType(params: filterDto) {
        const { search = '', page = 1, pageSize = 15, activeCompanyId, activeBranchId } = params;
        const skip = (page - 1) * pageSize;

        const where: Prisma.VoucherTypeMasterWhereInput = {
            status: statusWhereClause,
            CompanyMasterSid: activeCompanyId,
            BranchMasterSid: activeBranchId,
            ...(search
                ? {
                    OR: [
                        { DocumentTypeName: { contains: search, mode: 'insensitive' } },
                        { DocumentTypeCode: { contains: search, mode: 'insensitive' } },
                        { status: { contains: search, mode: 'insensitive' } },
                        { Remarks: { contains: search, mode: 'insensitive' } },
                    ],
                }
                : {}
            ),
        };

        let items;
        let totalCount;
        [items, totalCount] = await this._db.$transaction([
            this._db.voucherTypeMaster.findMany({
                where,
                skip,
                take: pageSize,
                orderBy: { VoucherTypeMasterSid: 'desc' },
            }),
            this._db.voucherTypeMaster.count({ where }),
        ]);

        items = await Promise.all(
            items.map(async (item) => {
                const [branchMaster] = await Promise.all([
                    this.globalConfigService.getMasterData('branch_master', item.BranchMasterSid, item.CompanyMasterSid)
                ])
                return {
                    ...item,
                    branchMaster
                }
            })
        )

        return {
            items,
            totalCount,
        };
    }
    async getSubledgersByCOA(COAMasterSid: number) {
        try {
            const subledgers = await this._db.subledgerMaster.findMany({
                where: {
                    COAMasterSid: COAMasterSid,
                    Status: 'A'
                },
                select: {
                    SubledgerMasterSid: true,
                    SubledgerName: true
                }
            });
            return { status: true, data: subledgers };
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

}
