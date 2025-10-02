import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { LeadStatus } from '@prisma/client';
import { DatabaseService } from 'src/database/database.service';
import { CreatePreCustomerMeetingDto } from 'src/masters/DTO/create-precustomer-meeting.dto';
import { CreatePrecustomerDto } from 'src/masters/DTO/create-Precustomer.dto';

@Injectable()
export class PreCustomerMeetingService {
    constructor(
        private _db: DatabaseService,
        private logger : Logger
    ) { }


    async getPreCustomerMastersWithoutMeetings(CompanyMasterSid:number,BranchMasterSid:number) {
        const result = await this._db.preCustomerMaster.findMany({
            where: {
                isQualify:"Y",
                status:"A",
                CompanyMasterSid: CompanyMasterSid,
                BranchMasterSid: BranchMasterSid
            },
            include: {
                preCustomerMeeting: true, // Include if needed for debugging, otherwise remove,
                cityMaster: true,
            },
            orderBy : {
                PreCustomerMasterSid: 'desc'
            }
        });
        return result;
    }


    async CreateAndUpdatePreCustomerMeeting(params: any) {
        try {
            const payload: any = {
                meetingType: params.meetingType,
                leadAssignTo: Number(params.leadAssignTo),
                meetingStatus: params.meetingStatus,
                customerProfile: params.customerProfile,
                meetingNote: params.meetingNote,
                followUpNote: params.followUpNote,
                createdBy: params['userEmail'],
                status: params.status || "A",
                companyMaster: {
                    connect: { CompanyMasterSid: params.CompanyMasterSid }
                },
                branchMaster: {
                    connect: { BranchMasterSid: params.BranchMasterSid }
                }
            };
               console.log('Final payload:', payload); 
            if (params.PreCustomerMeetingSid) {
                const existingLead = await this._db.preCustomerMeeting.findUnique({
                    where: { PreCustomerMeetingSid: params.PreCustomerMeetingSid },
                });

                if (!existingLead) {
                    throw new BadRequestException('Meeting not found');
                }
                payload.updatedOn = new Date(); // Only update UpdatedOn
                payload.updatedBy = params['userEmail']
                payload.followUpDate = params.followUpDate ? this.toUTCISO(params.followUpDate) : null,
                payload.meetingDate = this.toUTCISO(params.meetingDate)

                const data = await this._db.preCustomerMeeting.update({
                    where: { PreCustomerMeetingSid: params.PreCustomerMeetingSid },
                    data: payload,
                    include: {
                        preCustomerMaster: true
                    }
                })

                const customerPayload = {
                    PreCustomerMasterSid: data.preCustomerMaster?.PreCustomerMasterSid!,
                    CountryMasterSid: data.preCustomerMaster?.CountryMasterSid!,
                    CompanyMasterSid: data.preCustomerMaster?.CompanyMasterSid!,
                    CustomerName: data.preCustomerMaster?.preCustomerName!,
                    CustomerAddress1: data.preCustomerMaster?.preCustomerAddress1!,
                    createdBy: data.preCustomerMaster?.createdBy!,
                    createdOn: new Date()
                }

                // if (data.meetingStatus === 'confirmed' && params.LeadOrCustomer === 'L') {
                //     const customerName = data.preCustomerMaster?.preCustomerName;

                //     if (!customerName) {
                //         throw new Error('Customer name is missing for confirmed meeting.');
                //     }

                //     const existCustomer = await this._db.customerMaster.findFirst({
                //         where: {
                //             CustomerName: customerName 
                //         }
                //     })

                //     if (!existCustomer) {
                //         await this._db.customerMaster.create({
                //             data: {
                //                 ...customerPayload,
                //                 CustomerName: customerName, // this is now guaranteed to be a string

                //             }
                //         })
                //     } else {
                //         this.logger.warn("Customer already exists!");
                //     }
                // }


                if (params.followUpDate) {
                    await this._db.meetingFollowup.create({
                        data: {
                            PreCustomerMeetingSid: params.PreCustomerMeetingSid,
                            CompanyMasterSid: data.CompanyMasterSid,
                            BranchMasterSid: data.BranchMasterSid,
                            DepartmentMasterSid: params.DepartmentMasterSid,
                            OpportunitySector: params.OpportunitySector,
                            FollowupDate: params.followUpDate ? new Date(params.followUpDate + "Z") : "",
                            FollowupNote: params.followUpNote,
                            MeetingNote: params.meetingNote,
                            Remarks: params.remarks ?? null,
                            createdBy: params['userEmail'],
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
                const payloadData = {
                        createdBy : params.userEmail || '',
                        meetingDate : new Date(params.meetingDate + "Z"),
                        meetingType : params.meetingType,
                        meetingStatus : params.meetingStatus,
                        customerProfile : params.customerProfile,
                        remarks : params.remarks,
                        status : params.status,
                        followUpDate : params.followUpDate ? new Date(params.followUpDate + "Z") : null,
                        followUpNote : params.followUpNote,
                        meetingNote : params.meetingNote,
                        leadAssignTo : Number(params.leadAssignTo) || 0,
                        CompanyMasterSid : params.CompanyMasterSid,
                        BranchMasterSid : params.BranchMasterSid,
                        LeadOrCustomer : params.LeadOrCustomer
                    }

                    if(params.LeadOrCustomer === 'L'){
                        payloadData['PreCustomerMasterSid'] = Number(params.PreCustomerMasterSid)
                        payloadData['CustomerMasterSid'] = null
                    } else {
                        payloadData['PreCustomerMasterSid'] = null
                        payloadData['CustomerMasterSid'] = Number(params.CustomerMasterSid)
                    }

                const newMeeting = await this._db.preCustomerMeeting.create({
                    data : payloadData
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
                customerMaster : {
                    select : {
                        CustomerName : true
                    }
                },
                LeadOrCustomer : true,
                PreCustomerMeetingSid: true,
                meetingDate: true,
                followUpDate: true,
                meetingStatus: true
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



    async todoMeetings(CompanyMasterSid:number,BranchMasterSid:number) {
        let result: any = {};

        result.inActive = await this._db.preCustomerMaster.findMany({
            where: {
                status: 'S',
                CompanyMasterSid:CompanyMasterSid
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


    async getPreCustomerFollowupMeetings(CompanyMasterSid:number,BranchMasterSid:number){
        const result = await this._db.meetingFollowup.findMany({
            where:{
                CompanyMasterSid:CompanyMasterSid,
                BranchMasterSid:BranchMasterSid
            },
            include:{
                preCustomerMeeting:{
                    include:{
                        preCustomerMaster:{
                            include:{
                                customerMaster:true
                            }
                        }
                    }
                }
            }
            // select: {
            //     preCustomerMaster: {
            //         select: {
            //             preCustomerName: true
            //         }
            //     },
            //     customerMaster : {
            //         select : {
            //             CustomerName : true
            //         }
            //     },
            //     LeadOrCustomer : true,
            //     PreCustomerMeetingSid: true,
            //     meetingDate: true,
            //     followUpDate: true,
            //     meetingStatus: true
            // }
        })
            .catch((error) => {
                return []; // Return an empty array or handle it appropriately
            });
        return result;
    }


 toUTCISO(localDateTime: string) {
  const local = new Date(localDateTime);
  return new Date(local.getTime() - local.getTimezoneOffset() * 60000).toISOString();
}


}