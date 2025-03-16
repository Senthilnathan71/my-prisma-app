import { Injectable } from '@nestjs/common';
import { DatabaseService } from 'src/database/database.service';
import { CreatePreCustomerMeetingDto } from 'src/masters/DTO/create-precustomer-meeting.dto';
import { CreatePrecustomerDto } from 'src/masters/DTO/create-Precustomer.dto';

@Injectable()
export class PreCustomerMeetingService {
    constructor(
        private _db: DatabaseService
    ) { }


    async getPreCustomerMastersWithoutMeetings() {
        const result = await this._db.preCustomerMaster.findMany({
            where: {
                preCustomerMeeting: {
                    none: {} // Ensures no related PreCustomerMeeting exists
                }
            },
            include: {
                preCustomerMeeting: true, // Include if needed for debugging, otherwise remove,
                cityMaster: true
            }
        });
        return result;
    }


    async CreateAndUpdatePreCustomerMeeting(params: CreatePreCustomerMeetingDto, user) {
        try {
            const payload: any = {
                meetingType: params.meetingType,
                leadAssignTo: Number(params.leadAssignTo),
                meetingStatus: params.meetingStatus,
                customerProfile: params.customerProfile,
                meetingNote: params.meetingNote,
                followUpNote: params.followUpNote,
                createdBy: user['userEmail'],
                status: params.status || "A"
            };

            if (params.PreCustomerMeetingSid) {
                // Update existing record 
                const existingLead = await this._db.preCustomerMeeting.findUnique({
                    where: { PreCustomerMeetingSid: params.PreCustomerMeetingSid },
                });

                if (!existingLead) {
                    throw new Error('Meeting not found');
                }
                payload.updatedOn = new Date(); // Only update UpdatedOn
                payload.updatedBy = user['userEmail']
                payload.followUpDate = params.followUpDate ? new Date(params.followUpDate + "Z") : null
                payload.meetingDate = new Date(params.meetingDate + "Z")

                // await this._db.preCustomerMeeting.update({
                //     where: {
                //         PreCustomerMeetingSid: params.PreCustomerMeetingSid,
                //     },
                //     data: payload

                // })


                const data = await this._db.preCustomerMeeting.update({
                    where: { PreCustomerMeetingSid: params.PreCustomerMeetingSid },
                    data: payload,
                    include: {
                        preCustomerMaster: true
                    }
                })

                const customerPayload = {
                    PreCustomerMasterSid: data.preCustomerMaster.PreCustomerMasterSid,
                    CountryMasterSid: data.preCustomerMaster.CountryMasterSid,
                    CompanyMasterSid: data.preCustomerMaster.CompanyMasterSid,
                    CustomerName: data.preCustomerMaster.preCustomerName,
                    PreCustomerAddress1: data.preCustomerMaster.preCustomerAddress1,
                    createdBy: data.preCustomerMaster.createdBy,
                    createdOn: new Date()
                }

                if (data.meetingStatus === 'confirmed') {
                    await this._db.customerMaster.create({
                        data: {
                            ...customerPayload
                        }
                    })
                }


                if (params.followUpDate) {
                    await this._db.meetingFollowup.create({
                        data: {
                            PreCustomerMeetingSid: params.PreCustomerMeetingSid,
                            CompanyMasterSid: data.CompanyMasterSid,
                            BranchMasterSid: data.BranchMasterSid,
                            DepartmentMasterSid: params.DepartmentMasterSid,
                            OpportunitySector: params.OpportunitySector,
                            FollowupDate: new Date(params.followUpDate + "Z"),
                            FollowupNote: params.followUpNote,
                            MeetingNote: params.meetingNote,
                            Remarks: params.remarks ?? null,
                            createdBy: user['userEmail'],
                            createdOn: new Date(),
                            updatedOn: new Date()
                        }
                    })
                }

                return { message: 'Meeting updated successfully', data: data };

            } else {
                payload.createdOn = new Date();
                payload.updatedOn = new Date();
                payload.meetingDate = new Date(params.meetingDate + "Z")
                const newMeeting = await this._db.preCustomerMeeting.create({
                    data: {
                        ...payload,
                        companyMaster: {
                            connect: { CompanyMasterSid: user['userBranchMaster'][0].CompanyMasterSid }
                        },
                        branchMaster: {
                            connect: { BranchMasterSid: user['userBranchMaster'][0].BranchMasterSid }
                        },
                        preCustomerMaster: {
                            connect: { PreCustomerMasterSid: params.PreCustomerMasterSid }
                        }
                    }
                });
                return { message: 'Meeting created successfully', data: newMeeting };
            }
        } catch (error) {
            throw error
        }
    }


    async getPreCustomerMeetingDate() {
        const result = await this._db.preCustomerMeeting.findMany({
            select: {
                preCustomerMaster: {
                    select: {
                        preCustomerName: true
                    }
                },
                PreCustomerMeetingSid: true,
                meetingDate: true,
                followUpDate: true
            }
        })
            .catch((error) => {
                console.error("Error fetching meetings:", error);
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
                preCustomerMaster: true
            }
        })
            .catch((error) => {
                console.error("Error fetching meetings:", error);
                return []; // Return an empty array or handle it appropriately
            });
        return result;
    }
}