import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { LeadStatus } from '@prisma/client';
import { DatabaseService } from 'src/database/database.service';
import { CreatePreCustomerMeetingDto } from 'src/masters/DTO/create-precustomer-meeting.dto';
import { CreatePrecustomerDto } from 'src/masters/DTO/create-Precustomer.dto';

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


    async CreateAndUpdatePreCustomerMeeting(params: any) {
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
                    where: { PreCustomerMeetingSid: params.PreCustomerMeetingSid },
                    include: { meetingFollowUp: true }
                });

                if (!existingLead) {
                    throw new BadRequestException('Meeting not found');
                }
                payload.updatedOn = new Date(); // Only update UpdatedOn
                payload.updatedBy = params.createdBy
                payload.followUpDate = params.followUpDate ? this.toUTCISO(params.followUpDate) : null,
                    payload.meetingDate = this.toUTCISO(params.meetingDate)

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
                    meetingDate: this.toUTCISO(params.meetingDate),
                    meetingType: params.meetingType,
                    meetingStatus: params.meetingStatus ? params.meetingStatus : 'Scheduled',
                    customerProfile: params.customerProfile,
                    remarks: params.remarks,
                    meetingDuration: params.meetingDuration,
                    status: params.status,
                    followUpDate: params.followUpDate ? this.toUTCISO(params.followUpDate) : null,
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
                            companyMaster: { connect: { CompanyMasterSid: existingLead?.CompanyMasterSid ?  existingLead?.CompanyMasterSid :params.CompanyMasterSid } },
                            branchMaster: { connect: { BranchMasterSid: existingLead?.BranchMasterSid ? existingLead?.BranchMasterSid:params.BranchMasterSid  } },
                            DepartmentMasterSid: params.DepartmentMasterSid,
                            OpportunitySector: params.OpportunitySector,
                            FollowupDate: params.followUpDate ? this.toUTCISO(params.followUpDate) : "",
                            FollowupNote: params.followUpNote,
                            MeetingNote: params.meetingNote,
                            Remarks: params.remarks ?? null,
                            createdBy: params['userEmail'],

                        }
                    })
                }
                if (existingLead?.meetingFollowUp?.length > 1 ) {
                    const followup = await this._db.meetingFollowup.update({
                        where: {
                            MeetingFollowupSid: existingLead.meetingFollowUp['0'].MeetingFollowupSid
                        },
                        data: {
                            preCustomerMeeting: { connect: { PreCustomerMeetingSid: params.PreCustomerMeetingSid } }, // ✅ correct
                            companyMaster: { connect: { CompanyMasterSid: existingLead?.CompanyMasterSid ?  existingLead?.CompanyMasterSid :params.CompanyMasterSid } },
                            branchMaster: { connect: { BranchMasterSid: existingLead?.BranchMasterSid ? existingLead?.BranchMasterSid:params.BranchMasterSid  } },
                            DepartmentMasterSid: params.DepartmentMasterSid,
                            OpportunitySector: params.OpportunitySector,
                            FollowupDate: params.followUpDate ? this.toUTCISO(params.followUpDate) : "",
                            FollowupNote: params.followUpNote,
                            MeetingNote: params.meetingNote,
                            Remarks: params.remarks ?? null,
                            createdBy: params['userEmail'],
                            updatedBy: params['userEmail']
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


    async getPreCustomerMeetingDate() {
        const result = await this._db.preCustomerMeeting.findMany({
            where: {
                status: "A",
                meetingStatus: {
                    notIn: ['confirmed', 'completed']
                }
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
                meetingDuration: true
            }
        })
            .catch((error) => {
                return []; // Return an empty array or handle it appropriately
            });
        return result;
    }

    async getPreCustomer(PreCustomerMeetingSid: any) {
        const result = await this._db.preCustomerMeeting.findUnique({
            where: {
                PreCustomerMeetingSid: Number(PreCustomerMeetingSid)
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



    async todoMeetings(CompanyMasterSid: number, BranchMasterSid: number) {
        let result: any = {};

        result.inActive = await this._db.preCustomerMaster.findMany({
            where: {
                status: 'S',
                CompanyMasterSid: CompanyMasterSid
            }
        })

        result.notMet = await this._db.preCustomerMeeting.findMany({
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
                followUpDate: null
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


    async getPreCustomerFollowupMeetings(CompanyMasterSid: number, BranchMasterSid: number) {
        const result = await this._db.meetingFollowup.findMany({
            where: {
                CompanyMasterSid: CompanyMasterSid,
                BranchMasterSid: BranchMasterSid,
                Status: 'A',
                preCustomerMeeting: {
                    meetingStatus: {
                        notIn: ['confirmed', 'completed']
                    }
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


    async getAllPreCustomerMeetings(CompanyMasterSid: number, BranchMasterSid: number) {
        try {
            const allMeetings = await this._db.preCustomerMeeting.findMany({
                where: {
                    status: 'A',
                    meetingStatus: {
                        in: ['scheduled', 'inProgress', 'onHold'],
                    },
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


}