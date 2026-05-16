import { BadRequestException, Injectable } from '@nestjs/common';
import { DatabaseService } from 'src/database/database.service';

@Injectable()
export class CustomerMilestoneService {
    constructor(private _db:DatabaseService) {}

    // List Page
    async getAllCustomerMilestonesByCustomerId(CustomerMasterSid) {
        try {
            const allMilestones = await this._db.customerMilestone.findMany({
                where : {
                    CustomerMasterSid : CustomerMasterSid,
                    Status : { in : ["A","S"]}
                }
            })
            return allMilestones;
        } catch (error) {
            throw error;
        }
    }

    async saveCustomerMilestone(customerMilestones :any[]) {
        try {
            return await this._db.$transaction(async (prisma)=>{
                let finalMilestones :any[] = [];
                for(const milestone of customerMilestones) {
                    let updatedMilestone;
                    let createdMilestone;
                    if(milestone.CustomerMilestoneSid){
                        updatedMilestone = await prisma.customerMilestone.update({
                            where : {
                                CustomerMilestoneSid : milestone.CustomerMilestoneSid
                            },
                            data : {
                                CustomerMasterSid : milestone.CustomerMasterSid,
                                MilestoneMasterSid : milestone.MilestoneMasterSid,
                                UpdateType : milestone.UpdateType,
                                ContactInfo : milestone.ContactInfo,
                                EffectiveFrom : milestone.EffectiveFrom,
                                Status : milestone.Status,
                                UpdatedBy : milestone.updatedBy,
                                UpdatedOn: new Date()
                            }
                        })
                        finalMilestones.push(updatedMilestone);
                    } else {
                        createdMilestone = await prisma.customerMilestone.create({
                            data : {
                                CustomerMasterSid : milestone.CustomerMasterSid,
                                MilestoneMasterSid : milestone.MilestoneMasterSid,
                                UpdateType : milestone.UpdateType,
                                ContactInfo : milestone.ContactInfo,
                                EffectiveFrom : milestone.EffectiveFrom,
                                Status : milestone.Status,
                                CreatedBy : milestone.createdBy,
                            }
                        })
                        finalMilestones.push(createdMilestone);
                    }
                }
                return finalMilestones;
            })
        } catch (error) {
            throw error;
        }
    }

    async deleteCustomerMilestone(CustomerMilestoneSid :any,updatedBy: string) {
        try {
            const ourMilestone = await this._db.customerMilestone.findUnique({
                where : {
                    CustomerMilestoneSid : CustomerMilestoneSid
                }
            })
            if(!ourMilestone){
                throw new BadRequestException('Customer Milestone not found');
            }
            if(ourMilestone.Status === "D"){
                throw new BadRequestException('Customer Milestone already deleted');
            }
            const deletedMilestone = await this._db.customerMilestone.update({
                where : {
                    CustomerMilestoneSid : CustomerMilestoneSid
                },
                data : {Status : 'D', UpdatedBy : updatedBy, UpdatedOn : new Date()}
            })
            return deletedMilestone;
        } catch (error) {
            throw error;
        }
    }
}
