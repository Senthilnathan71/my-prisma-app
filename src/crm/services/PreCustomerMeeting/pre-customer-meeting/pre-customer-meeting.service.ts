import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { LeadStatus, Prisma } from '@prisma/client';
import { statusWhereClause } from 'src/common/helper';
import { DatabaseService } from 'src/database/database.service';
import { SearchListDto } from 'src/masters/DTO/search-list.dto';
import { filterDto } from 'src/masters/DTO/search-vessel.dto';

@Injectable()
export class PreCustomerMeetingService {
    constructor(private _db: DatabaseService,private logger: Logger) { }

    private async getScopedUserIds(
        companyMasterSid: number,
        branchMasterSid: number,
        userTypeCode?: string,
        userId?: number
    ): Promise<number[]> {
        const normalizedUserType = String(userTypeCode || '').trim().toLowerCase();
        const normalizedUserId = Number(userId || 0);

        if (!normalizedUserId) {
            throw new BadRequestException('userId is required for scoped meeting fetch');
        }

        if (normalizedUserType === 'salesmanager') {
            const rows: any[] = await this._db.$queryRawUnsafe(
                `SELECT
                    um."UserMasterSid"
                 FROM "UserMaster" um
                 INNER JOIN "UserBranchMaster" ubm
                    ON um."UserMasterSid" = ubm."UserMasterSid"
                 WHERE
                    ubm."CompanyMasterSid" = $1
                    AND ubm."BranchMasterSid" = $2
                    AND um."DeptHead" = $3
                    AND um."isSalesperson" IN ('1','Y')
                    AND um."status" = 'A'
                    AND ubm."status" = 'A'`,
                companyMasterSid,
                branchMasterSid,
                normalizedUserId,
            );

            const teamIds = rows
                .map((r: any) => Number(r.UserMasterSid))
                .filter((id: number) => Number.isFinite(id) && id > 0);

            return Array.from(new Set([...teamIds, normalizedUserId]));
        }

        return [normalizedUserId];
    }

    async getAllPreCustomerMeetings(
        CompanyMasterSid:number,
        BranchMasterSid:number,
        userTypeCode?: string,
        userId?: number
    ) {
        try {
            const scopedUserIds = await this.getScopedUserIds(
                CompanyMasterSid,
                BranchMasterSid,
                userTypeCode,
                userId
            );

            const allMeetings = await this._db.preCustomerMeeting.findMany({
                where: {
                    status: 'A',
                    meetingStatus: {
                        notIn: ['Completed', 'Confirmed'],
                    },
                    CompanyMasterSid,
                    BranchMasterSid,
                    leadAssignTo: { in: scopedUserIds },
                },
                include : {
                    preCustomerMaster : {
                        select : {
                            preCustomerName : true,
                            leadStatus:true,
                        }
                    },
                    customerMaster : {
                        select : {
                            CustomerName : true,
                        }}
                },
                orderBy: {
                    preCustomerMaster: {
                        preCustomerName: 'asc'
                    }
                }
            });
            return allMeetings;
        } catch (error) {
            throw error;
        }
    }

    async createNewPreCustomerMeeting(payload: any) {
        try {
            const companyMasterSid = Number(payload.CompanyMasterSid) || null;
            const branchMasterSid = Number(payload.BranchMasterSid) || null;
            const customerMasterSid = Number(payload.CustomerMasterSid) || null;
            const preCustomerMasterSid = Number(payload.PreCustomerMasterSid) || null;
            const meetingDate = payload.meetingDate ? new Date(payload.meetingDate) : null;

            if (!companyMasterSid || !branchMasterSid) {
                throw new BadRequestException('CompanyMasterSid and BranchMasterSid are required');
            }
            if (!meetingDate || Number.isNaN(meetingDate.getTime())) {
                throw new BadRequestException('meetingDate is required');
            }
            if (payload.LeadOrCustomer === 'C' && !customerMasterSid) {
                throw new BadRequestException('CustomerMasterSid is required for customer meetings');
            }
            if (payload.LeadOrCustomer === 'L' && !preCustomerMasterSid) {
                throw new BadRequestException('PreCustomerMasterSid is required for lead meetings');
            }

            const {
                customerName,
                userEmail,
                createdBy,
                PreCustomerMeetingid,
                followUp,
                CompanyMasterSid: _companyMasterSid,
                BranchMasterSid: _branchMasterSid,
                CustomerMasterSid: _customerMasterSid,
                PreCustomerMasterSid: _preCustomerMasterSid,
                meetingDate: _meetingDate,
                ...prismaData
            } = payload;

            const meetingData: any = {
                ...prismaData,
                meetingDate,
                companyMaster: {
                    connect: { CompanyMasterSid: companyMasterSid }
                },
                branchMaster: {
                    connect: { BranchMasterSid: branchMasterSid }
                },
                createdBy: createdBy || userEmail || 'system',
            };

            if (customerMasterSid) {
                meetingData.customerMaster = {
                    connect: { CustomerMasterSid: customerMasterSid }
                };
            }

            if (preCustomerMasterSid) {
                meetingData.preCustomerMaster = {
                    connect: { PreCustomerMasterSid: preCustomerMasterSid }
                };
            }

            const createdMeeting = await this._db.preCustomerMeeting.create({
                data: meetingData,
                include: {
                    branchMaster: true,
                    companyMaster: true,
                    preCustomerMaster: true
                }
            });
            return createdMeeting;
        } catch (error) {
            throw error;
        }
    }

    async fetchPreCustomerMeetingById(PreCustomerMeetingSid: number) {
        try {
            const meeting = await this._db.preCustomerMeeting.findUnique({
                where: {
                    PreCustomerMeetingSid: PreCustomerMeetingSid
                },
                include: {
                    branchMaster: true,
                    companyMaster: true,
                    preCustomerMaster: true,
                    customerMaster: true
                }
            });
            if (!meeting) {
                throw new BadRequestException(`PreCustomerMeeting with Id : ${PreCustomerMeetingSid} does not exist`);
            }
            return meeting;
        } catch (error) {
            throw error;
        }
    }

    async updatePreCustomerMeetingById(PreCustomerMeetingSid: number, payload: any) {
        try {
            const companyMasterSid = Number(payload.CompanyMasterSid) || null;
            const branchMasterSid = Number(payload.BranchMasterSid) || null;
            const customerMasterSid = Number(payload.CustomerMasterSid) || null;
            const preCustomerMasterSid = Number(payload.PreCustomerMasterSid) || null;
            const meetingDate = payload.meetingDate ? new Date(payload.meetingDate) : null;

            if (!companyMasterSid || !branchMasterSid) {
                throw new BadRequestException('CompanyMasterSid and BranchMasterSid are required');
            }
            if (!meetingDate || Number.isNaN(meetingDate.getTime())) {
                throw new BadRequestException('meetingDate is required');
            }

            const exist = await this._db.preCustomerMeeting.findUnique({
                where: {
                    PreCustomerMeetingSid: PreCustomerMeetingSid
                }
            });
            if (!exist) {
                throw new BadRequestException(`PreCustomerMeeting with Id : ${PreCustomerMeetingSid} does not exist`);
            }

            const {
                customerName,
                userEmail,
                createdBy,
                PreCustomerMeetingid,
                followUp,
                PreCustomerMeetingSid: _,
                CompanyMasterSid: _companyMasterSid,
                BranchMasterSid: _branchMasterSid,
                CustomerMasterSid: _customerMasterSid,
                PreCustomerMasterSid: _preCustomerMasterSid,
                meetingDate: _meetingDate,
                ...prismaData
            } = payload;

            const meetingData: any = {
                ...prismaData,
                meetingDate,
                companyMaster: {
                    connect: { CompanyMasterSid: companyMasterSid }
                },
                branchMaster: {
                    connect: { BranchMasterSid: branchMasterSid }
                },
                updatedBy: payload.updatedBy || userEmail || createdBy || exist.updatedBy || exist.createdBy || 'system'
            };

            if (customerMasterSid) {
                meetingData.customerMaster = {
                    connect: { CustomerMasterSid: customerMasterSid }
                };
            }

            if (preCustomerMasterSid) {
                meetingData.preCustomerMaster = {
                    connect: { PreCustomerMasterSid: preCustomerMasterSid }
                };
            }

            const updatedMeeting = await this._db.preCustomerMeeting.update({
                where: {
                    PreCustomerMeetingSid: PreCustomerMeetingSid
                },
                data: meetingData,
                include: {
                    branchMaster: true,
                    companyMaster: true,
                    preCustomerMaster: true
                }
            });
            return updatedMeeting;
        } catch (error) {
            throw error;
        }
    }

    async deletePreCustomerMeeting(PreCustomerMeetingSid: number) {
        try {
            const exist = await this._db.preCustomerMeeting.findUnique({
                where: {
                    PreCustomerMeetingSid: PreCustomerMeetingSid
                }
            });
            if (!exist) {
                throw new BadRequestException(`PreCustomerMeeting with Id : ${PreCustomerMeetingSid} does not exist`);
            }
            if (exist.status === 'D') {
                throw new BadRequestException(`PreCustomerMeeting with Id : ${PreCustomerMeetingSid} is already deleted`);
            }
            const deletedMeeting = await this._db.preCustomerMeeting.update({
                where: {
                    PreCustomerMeetingSid: PreCustomerMeetingSid
                },
                data: {
                    status: 'D'
                },
                include: {
                    branchMaster: true,
                    companyMaster: true,
                    preCustomerMaster: true
                }
            });
            return deletedMeeting;
        } catch (error) {
            throw error;
        }
    }

    async searchPreCustomerMeeting(data: SearchListDto) {
        const { searchType, filterValue } = data;
        const intFields = [
            'PreCustomerMeetingSid',
            'leadAssignTo',
            'BranchMasterSid',
            'CompanyMasterSid',
            'LoginSid',
            'PreCustomerMasterSid'
        ];
        const stringFields = [
            'meetingType',
            'meetingStatus',
            'customerProfile',
            'remarks',
            'status',
            'followUpNote',
            'meetingNote'
        ];
        const dateFields = [
            'meetingDate',
            'followUpDate'
        ];
        const acceptedType = [...intFields, ...stringFields, ...dateFields];

        if (!acceptedType.includes(searchType)) {
            throw new BadRequestException('Invalid Search Type');
        }

        const whereClause: any = {};

        if (stringFields.includes(searchType)) {
            whereClause[searchType] = {
                contains: filterValue,
                mode: 'insensitive'
            };
        } else if (intFields.includes(searchType)) {
            const numberValue = parseInt(filterValue);
            if (isNaN(numberValue)) {
                throw new BadRequestException(`${searchType} must be a valid number`);
            }
            whereClause[searchType] = numberValue;
        } else if (dateFields.includes(searchType)) {
            const dateValue = new Date(filterValue);
            if (isNaN(dateValue.getTime())) {
                throw new BadRequestException(`${searchType} must be a valid date`);
            }
            whereClause[searchType] = {
                equals: dateValue
            };
        }

        const searchResults = await this._db.preCustomerMeeting.findMany({
            where: {
                ...whereClause,
                status : 'A'
            },
            include: {
                branchMaster: true,
                companyMaster: true,
                preCustomerMaster: true
            }
        }).catch((err) => {
            throw new Error(`Error Occurred : ${JSON.stringify(err)}`);
        });

        return searchResults;
    }

    async searchList(params: filterDto & { userTypeCode?: string; userId?: number }) {
    const { search = '', page = 1, pageSize = 10, activeCompanyId, activeBranchId, userTypeCode, userId } = params as any;
    const skip = (page - 1) * pageSize;

    if (!activeCompanyId || !activeBranchId) {
        throw new BadRequestException('CompanyMasterSid and BranchMasterSid are required');
    }

    const scopedUserIds = await this.getScopedUserIds(activeCompanyId, activeBranchId, userTypeCode, userId);

    const where: Prisma.PreCustomerMeetingWhereInput = {
        status: statusWhereClause,
        CompanyMasterSid : activeCompanyId,
        BranchMasterSid: activeBranchId,
        ...(scopedUserIds && scopedUserIds.length
            ? { leadAssignTo: { in: scopedUserIds } }
            : {}),
        ...(search
            ? {
                OR: [
                    { meetingType: { contains: search, mode: 'insensitive' } },
                    { meetingStatus: { contains: search, mode: 'insensitive' } },
                    (!isNaN(Number(search)) ? { leadAssignTo: Number(search) } : {}),
                    { preCustomerMaster: { preCustomerName : { contains: search, mode: 'insensitive' }}},
                ],
            }
            : {}
        ),
    };

    const [items, totalCount] = await this._db.$transaction([
        this._db.preCustomerMeeting.findMany({
            where,
            skip,
            take: pageSize,
            orderBy: { PreCustomerMeetingSid: 'desc' },
            include: {
                branchMaster: true,
                companyMaster: true,
                preCustomerMaster: true,
            },
        }),
        this._db.preCustomerMeeting.count({ where }),
    ]);

    return { items, totalCount };
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
