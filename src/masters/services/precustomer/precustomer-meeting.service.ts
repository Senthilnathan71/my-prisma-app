import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { LeadStatus, Prisma } from '@prisma/client';
import { parseDateFromString, statusWhereClause, toUTCISO } from 'src/common/helper';
import { contains } from 'class-validator';
import { DatabaseService } from 'src/database/database.service';
import { CreatePreCustomerMeetingDto } from 'src/masters/DTO/create-precustomer-meeting.dto';
import { CreatePrecustomerDto } from 'src/masters/DTO/create-Precustomer.dto';
import { filterDto } from 'src/masters/DTO/search-vessel.dto';

const statusMap: Record<string, LeadStatus> = {
    "Qualify": LeadStatus.Qualify,
    "Discovery": LeadStatus.Discovery,
    "Meeting Scheduled": LeadStatus.MeetingScheduled,
    "Meeting Completed": LeadStatus.MeetingCompleted,
    "Enquiry Generated": LeadStatus.EnquiryGenerated,
    "Quotation Created": LeadStatus.QuotationCreated,
    "Quotation Confirmed": LeadStatus.QuotationConfirmed,
    "Contract Signed": LeadStatus.ContractSigned,
    "Deal Won": LeadStatus.DealWon,
    "Deal Lost": LeadStatus.DealLost,
};
@Injectable()
export class PreCustomerMeetingService {
    constructor(
        private _db: DatabaseService,
        private logger: Logger
    ) { }


    async getPreCustomerMastersWithoutMeetings(CompanyMasterSid: number, BranchMasterSid: number) {
        const result = await this._db.preCustomerMaster.findMany({
            where: {
                status: "A",
                leadStatus: {
                    in: ["MeetingScheduled", "EnquiryGenerated", "QuotationConfirmed", "MeetingCompleted", "QuotationCreated", "Qualify"]
                },
                CompanyMasterSid: CompanyMasterSid,
                BranchMasterSid: BranchMasterSid
            },
            include: {
                preCustomerMeeting: true, // Include if needed for debugging, otherwise remove,
                cityMaster: true,
            },
            orderBy: {
                PreCustomerMasterSid: 'desc'
            }
        });
        return result;
    }

     async searchOpportunity(params: filterDto) {
        const { search = '',page = 1, pageSize = 10, activeCompanyId, activeBranchId} = params;
        const skip = (page - 1) * pageSize;

        const where: Prisma.PreCustomerMasterWhereInput = {
            status: statusWhereClause,
            leadStatus: {
                    in: ["MeetingScheduled", "EnquiryGenerated", "QuotationConfirmed", "MeetingCompleted", "QuotationCreated", "Qualify"]
            },
            CompanyMasterSid: activeCompanyId,
            BranchMasterSid: activeBranchId,
            ...(search
                ? {
                    OR: [
                        { preCustomerName: {contains: search, mode: 'insensitive'}},
                        { cityMaster: { cityName: { contains: search, mode: 'insensitive'}}},
                        { contactPerson: {contains: search,  mode: 'insensitive'}},
                        { phone: { contains: search, mode: 'insensitive'}},
                    ],
                } : {}
            ),
        };
        const [items, totalCount] = await this._db.$transaction([
            this._db.preCustomerMaster.findMany({
                where,
                skip,
                take: pageSize,
                orderBy: { PreCustomerMasterSid: 'desc'},
                include: {
                    preCustomerMeeting: true, // Include if needed for debugging, otherwise remove,
                    cityMaster: true,
                }
            }),
            this._db.preCustomerMaster.count({where}),
        ]);

        return { items, totalCount}
    }



    async CreateAndUpdatePreCustomerMeeting(user,params: any) {
        try {
            let output;
            const payload: any = {
                meetingType: params.meetingType,
                leadAssignTo: Number(params.leadAssignTo),
                meetingStatus: params.meetingStatus,
                customerProfile: params.customerProfile,
                meetingNote: params.meetingNote,
                followUpNote: params.followUpNote,
                createdBy: params.createdBy,
                status: params.status || "A",
                remarks: params.remarks,
                companyMaster: {
                    connect: { CompanyMasterSid: params.CompanyMasterSid }
                },
                branchMaster: {
                    connect: { BranchMasterSid: params.BranchMasterSid }
                },
                meetingDuration: params.meetingDuration
            };
            console.log('Final payload:', payload);
            let updatePreCustomer;
            let newMeeting;
            let existingLead;
            if (params.PreCustomerMeetingSid) {
                existingLead = await this._db.preCustomerMeeting.findUnique({
                    where: {
                        PreCustomerMeetingSid: params.PreCustomerMeetingSid, leadAssignTo: user.UserMasterSid
                    },
                    include: { meetingFollowUp: true }
                });

                if (!existingLead) {
                    throw new BadRequestException('Meeting not found');
                }
                payload.updatedOn = new Date(); // Only update UpdatedOn
                payload.updatedBy = params.createdBy
                payload.followUpDate = params.followUpDate ? toUTCISO(params.followUpDate) : null,
                    payload.meetingDate = toUTCISO(params.meetingDate)

                updatePreCustomer = await this._db.preCustomerMeeting.update({
                    where: { PreCustomerMeetingSid: params.PreCustomerMeetingSid },
                    data: payload,
                    include: {
                        preCustomerMaster: true
                    }
                })

                if (updatePreCustomer && (payload.meetingStatus === 'confirmed' || payload.meetingStatus === 'completed')) {
                    await this._db.preCustomerMaster.update({
                        where: {
                            PreCustomerMasterSid: updatePreCustomer.preCustomerMaster?.PreCustomerMasterSid
                        }, data: {
                            leadStatus: LeadStatus.MeetingCompleted
                        }
                    })
                }


            } else {
                payload.createdOn = new Date();
                payload.updatedOn = new Date();
                const payloadData = {
                    createdBy: params.userEmail || '',
                    meetingDate: toUTCISO(params.meetingDate),
                    meetingType: params.meetingType,
                    meetingStatus: params.meetingStatus ? params.meetingStatus : 'Scheduled',
                    customerProfile: params.customerProfile,
                    remarks: params.remarks,
                    meetingDuration: params.meetingDuration,
                    status: params.status,
                    followUpDate: params.followUpDate ? toUTCISO(params.followUpDate) : null,
                    followUpNote: params.followUpNote,
                    meetingNote: params.meetingNote,
                    leadAssignTo: Number(params.leadAssignTo) || 0,
                    CompanyMasterSid: params.CompanyMasterSid,
                    BranchMasterSid: params.BranchMasterSid,
                    LeadOrCustomer: params.LeadOrCustomer
                }

                if (params.LeadOrCustomer === 'L') {
                    payloadData['PreCustomerMasterSid'] = Number(params.PreCustomerMasterSid)
                    payloadData['CustomerMasterSid'] = null
                } else {
                    payloadData['PreCustomerMasterSid'] = null
                    payloadData['CustomerMasterSid'] = Number(params.CustomerMasterSid)
                }

                newMeeting = await this._db.preCustomerMeeting.create({
                    data: payloadData
                }).catch(err => { throw err });
            }

            if ((newMeeting || updatePreCustomer) && params.followUpDate) {
                if (((!existingLead?.followUpDate || existingLead?.followUpDate) && existingLead?.meetingFollowUp?.length === 0) || params.followUpDate) {
                    const followup = await this._db.meetingFollowup.create({
                        data: {
                            preCustomerMeeting: { connect: { PreCustomerMeetingSid: params.PreCustomerMeetingSid ? params.PreCustomerMeetingSid : newMeeting.PreCustomerMeetingSid } }, // ✅ correct
                            companyMaster: { connect: { CompanyMasterSid: existingLead?.CompanyMasterSid ? existingLead?.CompanyMasterSid : params.CompanyMasterSid } },
                            branchMaster: { connect: { BranchMasterSid: existingLead?.BranchMasterSid ? existingLead?.BranchMasterSid : params.BranchMasterSid } },
                            DepartmentMasterSid: params.DepartmentMasterSid,
                            OpportunitySector: params.OpportunitySector,
                            FollowupDate: params.followUpDate ? toUTCISO(params.followUpDate) : "",
                            FollowupNote: params.followUpNote,
                            MeetingNote: params.meetingNote,
                            Remarks: params.remarks ?? null,
                            createdBy: user['userEmail'],

                        }
                    })
                }
                if (existingLead?.meetingFollowUp?.length > 1) {
                    const followup = await this._db.meetingFollowup.update({
                        where: {
                            MeetingFollowupSid: existingLead.meetingFollowUp['0'].MeetingFollowupSid
                        },
                        data: {
                            preCustomerMeeting: { connect: { PreCustomerMeetingSid: params.PreCustomerMeetingSid } }, // ✅ correct
                            companyMaster: { connect: { CompanyMasterSid: existingLead?.CompanyMasterSid ? existingLead?.CompanyMasterSid : params.CompanyMasterSid } },
                            branchMaster: { connect: { BranchMasterSid: existingLead?.BranchMasterSid ? existingLead?.BranchMasterSid : params.BranchMasterSid } },
                            DepartmentMasterSid: params.DepartmentMasterSid,
                            OpportunitySector: params.OpportunitySector,
                            FollowupDate: params.followUpDate ? toUTCISO(params.followUpDate) : "",
                            FollowupNote: params.followUpNote,
                            MeetingNote: params.meetingNote,
                            Remarks: params.remarks ?? null,
                            createdBy: user['userEmail'],
                            updatedBy: user['userEmail']
                        }
                    })
                }
            }
            let mes;
            if (newMeeting) {
                const updateLeadStatus = await this._db.preCustomerMaster.update({
                    where: {
                        PreCustomerMasterSid: params.PreCustomerMasterSid
                    }, data: {
                        leadStatus: LeadStatus.MeetingScheduled
                    }
                }).catch(err => { throw err })
                mes = 'Meeting created successfully'
                output = newMeeting
            } else {
                mes = 'Meeting updated successfully'
                output = updatePreCustomer
            }

            return { message: mes, data: output };

        } catch (error) {
            console.log(error.stack)
            throw error
        }
    }


    async getPreCustomerMeetingDate(user) {
        const result = await this._db.preCustomerMeeting.findMany({
            where: {
                status: "A",
                leadAssignTo: user.UserMasterSid
            },
            select: {
                preCustomerMaster: {
                    select: {
                        preCustomerName: true
                    }
                },
                customerMaster: {
                    select: {
                        CustomerName: true
                    }
                },
                LeadOrCustomer: true,
                PreCustomerMeetingSid: true,
                meetingDate: true,
                followUpDate: true,
                meetingStatus: true,
                meetingDuration: true,
                remarks: true,
            }
        })
            .catch((error) => {
                return []; // Return an empty array or handle it appropriately
            });
        return result;
    }

    async getPreCustomer(user, PreCustomerMeetingSid: any) {
        const result = await this._db.preCustomerMeeting.findUnique({
            where: {
                PreCustomerMeetingSid: Number(PreCustomerMeetingSid),
                leadAssignTo: user.UserMasterSid
            },
            include: {
                preCustomerMaster: true,
                customerMaster: true
            }
        })
            .catch((error) => {
                return []; // Return an empty array or handle it appropriately
            });
        return result;
    }



    async todoMeetings(user, CompanyMasterSid: number, BranchMasterSid: number) {
        let result: any = {};

        result.inActive = await this._db.preCustomerMaster.findMany({
            where: {
                status: 'S',
                CompanyMasterSid: CompanyMasterSid
            }
        })

        result.notMet = await this._db.preCustomerMeeting.findMany({
            where: {
                leadAssignTo: user.UserMasterSid
            },
            select: {
                meetingDate: true,
                preCustomerMaster: {
                    select: {
                        preCustomerName: true
                    }
                }
            }
        })

        result.toMeet = await this._db.preCustomerMeeting.findMany({
            where: {
                followUpDate: null,
                leadAssignTo: user.UserMasterSid
            },
            select: {
                meetingDate: true,
                preCustomerMaster: {
                    select: {
                        preCustomerName: true,
                    }
                }
            },
            orderBy: {
                preCustomerMaster: {
                    preCustomerName: 'desc'
                }
            }
        })

        return result;
    }


    async getPreCustomerFollowupMeetings(user, CompanyMasterSid: number, BranchMasterSid: number) {
        const result = await this._db.meetingFollowup.findMany({
            where: {
                CompanyMasterSid: CompanyMasterSid,
                BranchMasterSid: BranchMasterSid,
                Status: 'A',
                preCustomerMeeting: {
                    leadAssignTo: user.UserMasterSid,
                }
            },
            include: {
                preCustomerMeeting: {
                    include: {
                        preCustomerMaster: {
                            include: {
                                customerMaster: true
                            }
                        }
                    }
                }
            }

        }).catch((error) => {
            throw error
        });
        return result;
    }


    async getAllPreCustomerMeetings(user, CompanyMasterSid: number, BranchMasterSid: number) {
        try {
            const allMeetings = await this._db.preCustomerMeeting.findMany({
                where: {
                    status: 'A',
                    meetingStatus: {
                        in: ['Scheduled', 'In Progress', 'On Hold'],
                    },
                    leadAssignTo: user.UserMasterSid,
                    CompanyMasterSid: CompanyMasterSid,
                    BranchMasterSid: BranchMasterSid
                },
                include: {
                    preCustomerMaster: {
                        select: {
                            preCustomerName: true,
                            leadStatus: true
                        }
                    }

                }
            });
            return allMeetings;
        } catch (error) {
            throw error;
        }
    }


    toUTCISO(localDateTime: string) {
        const local = new Date(localDateTime);
        return new Date(local.getTime() - local.getTimezoneOffset() * 60000).toISOString();
    }
 async searchPreCustomerMeeting(params: filterDto, user: any) {
    const { search = '', page = 1, pageSize = 10, activeCompanyId, activeBranchId } = params;
    const skip = (page - 1) * pageSize;
    const parsedDate = parseDateFromString(search);

    let salesmanIds: number[] = [];

    if (search) {
       
        const users = await this._db.userMaster.findMany({
            where: { 
                userName: { contains: search, mode: 'insensitive' }, 
                status: 'A' 
            },
            select: { UserMasterSid: true },
        });
        salesmanIds = users.map(u => u.UserMasterSid);
    }

    const where: Prisma.PreCustomerMeetingWhereInput = {
        status: statusWhereClause,
        leadAssignTo: user.UserMasterSid,
        meetingStatus: {
            in: ['Scheduled', 'In Progress', 'On Hold'],
        },
        CompanyMasterSid: activeCompanyId,
        BranchMasterSid: activeBranchId,
        ...(search ? {
            OR: [
                { meetingType: { contains: search, mode: 'insensitive' } },
                { meetingStatus: { contains: search, mode: 'insensitive' } },
                { meetingNote: { contains: search, mode: 'insensitive' } },
                { remarks: { contains: search, mode: 'insensitive' } },
               
                { 
                    preCustomerMaster: { 
                        preCustomerName: { contains: search, mode: 'insensitive' } 
                    }
                },
                
                ...(salesmanIds.length > 0 ? [{ leadAssignTo: { in: salesmanIds } }] : []),
               
                ...(!isNaN(Number(search)) ? [{ leadAssignTo: Number(search) }] : []),
                
                ...(parsedDate ? [
                    { meetingDate: { equals: parsedDate } },
                    { followUpDate: { equals: parsedDate } },
                ] : []),
            ],
        } : {})
    };

    let items;
    let totalCount;
    [items, totalCount] = await this._db.$transaction([
        this._db.preCustomerMeeting.findMany({
            where,
            skip,
            take: pageSize,
            orderBy: { 
                preCustomerMaster: {
                    preCustomerName: 'asc'
                }
            },     
            include: {
                branchMaster: true,
                companyMaster: true,
                preCustomerMaster: true,
            },
        }),
        this._db.preCustomerMeeting.count({ where }),
    ]);

  
    const allSalesPersonIds: number[] = [...new Set(items.map(item => item.leadAssignTo))].filter(id => id !== null && id !== undefined) as number[];
    
    const salesPersons = allSalesPersonIds.length > 0 ? await this._db.userMaster.findMany({
        where: {
            UserMasterSid: { in: allSalesPersonIds }
        },
        select: {
            UserMasterSid: true,
            userName: true
        }
    }) : [];

    const salesPersonMap = new Map(salesPersons.map(sp => [sp.UserMasterSid, sp]));

    const enrichedItems = items.map(item => ({
        ...item,
        salesPerson: salesPersonMap.get(item.leadAssignTo) || { UserMasterSid: item.leadAssignTo, userName: 'N/A' }
    }));

    return {
        items: enrichedItems,
        totalCount,
    };
}
    async getSalesmanOfPreCustomer(PreCustomerMasterSid:number){
        try {
            const customerMeeting = await this._db.preCustomerMeeting.findMany({
                where: {
                    PreCustomerMasterSid: PreCustomerMasterSid,
                    status : "A",
                    customerMaster : {}
                }
            })
            if(customerMeeting.length === 0){
                return null;
            }
            const salesPersonId = customerMeeting[0].leadAssignTo;
            return salesPersonId;
        } catch (error) {
            throw error;
        }
    }
}