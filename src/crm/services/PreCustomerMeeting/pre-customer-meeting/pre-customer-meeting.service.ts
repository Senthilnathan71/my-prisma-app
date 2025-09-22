import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { statusWhereClause } from 'src/common/helper';
import { DatabaseService } from 'src/database/database.service';
import { SearchListDto } from 'src/masters/DTO/search-list.dto';
import { filterDto } from 'src/masters/DTO/search-vessel.dto';

@Injectable()
export class PreCustomerMeetingService {
    constructor(private _db: DatabaseService) { }

    async getAllPreCustomerMeetings(CompanyMasterSid:number, BranchMasterSid:number) {
        try {
            const allMeetings = await this._db.preCustomerMeeting.findMany({
                where: {
                    status: 'A',
                    CompanyMasterSid: CompanyMasterSid,
                    BranchMasterSid: BranchMasterSid
                },
                include : {
                    preCustomerMaster : {
                        select : {
                            preCustomerName : true,
                            
                        }
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
            const createdMeeting = await this._db.preCustomerMeeting.create({
                data: {
                    ...payload,
                },
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
                    preCustomerMaster: true
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
            const exist = await this._db.preCustomerMeeting.findUnique({
                where: {
                    PreCustomerMeetingSid: PreCustomerMeetingSid
                }
            });
            if (!exist) {
                throw new BadRequestException(`PreCustomerMeeting with Id : ${PreCustomerMeetingSid} does not exist`);
            }
            const updatedMeeting = await this._db.preCustomerMeeting.update({
                where: {
                    PreCustomerMeetingSid: PreCustomerMeetingSid
                },
                data: payload,
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

    async searchList(params: filterDto) {
    const { search = '', page = 1, pageSize = 15, activeCompanyId, activeBranchId } = params;
    const skip = (page - 1) * pageSize;

    const where: Prisma.PreCustomerMeetingWhereInput = {
        status: statusWhereClause,
        CompanyMasterSid : activeCompanyId,
        BranchMasterSid: activeBranchId,
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

    
}