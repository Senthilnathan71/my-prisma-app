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
                leadAssignTo: Number(user['UserMasterSid']),
                meetingStatus: params.meetingStatus || "A",
                customerProfile: params.customerProfile,
                createdBy: user['userEmail'],
                status: params.status || 'A'
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
                await this._db.preCustomerMeeting.update({
                    where: {
                        PreCustomerMeetingSid: params.PreCustomerMeetingSid,
                    },
                    data: payload

                })
                return { message: 'Meeting updated successfully', data: params };

            } else {
                payload.createdOn = new Date();
                payload.updatedOn = new Date();
                payload.meetingDate = new Date(params.meetingDate)
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
                meetingDate: true
            }
        })
            .catch((error) => {
                console.error("Error fetching meetings:", error);
                return []; // Return an empty array or handle it appropriately
            });
        return result;
    }

    async getPreCustomer(id) {
        const result = await this._db.preCustomerMeeting.findUnique({
            where: {
                PreCustomerMeetingSid: id
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