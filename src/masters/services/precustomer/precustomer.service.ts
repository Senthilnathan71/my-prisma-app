import { Injectable } from '@nestjs/common';
import { DatabaseService } from 'src/database/database.service';
import { CreatePrecustomerDto } from 'src/masters/DTO/create-Precustomer.dto';

@Injectable()
export class PrecustomerService {
    constructor(
        private _db: DatabaseService
    ) { }

    async getAllPrecustomer(user) {
        try {
            const customer = await this._db.preCustomerMaster.findMany({
                where: {
                    CompanyMasterSid: user.CompanyMasterSid,
                    BranchMasterSid: user.BranchMasterSid,
                    status: "A"
                }
            });
            return customer;
        } catch (error) {
            console.log("cutomerError", error)
        }
    }

    async createPrecustomer(params: CreatePrecustomerDto, user) {
        try {
            const payload: any = {
                CompanyMasterSid: user['userBranchMaster'][0].CompanyMasterSid,
                CityMasterSid: Number(params.CityMasterSid),
                CountryMasterSid: params.CountryMasterSid,
                StateMasterSid: params.StateMasterSid,
                BranchMasterSid: user['userBranchMaster'][0].BranchMasterSid,
                preCustomerName: params.preCustomerName,
                preCustomerAddress1: params.preCustomerAddress1,
                preCustomerAddress2: params.preCustomerAddress2,
                contactPerson: params.contactPerson,
                email: params.email,
                phone: params.phone,
                leadAssignTo: user['UserMasterSid'],
                leadFrom: params.leadFrom,
                leadReferredBy: params.leadReferredBy,
                createdBy: user['userEmail'],
                status: params.status || 'A'
            };

            if (params.PreCustomerMasterSid) {
                // Update existing record 
                const existingLead = await this._db.preCustomerMaster.findUnique({
                    where: { PreCustomerMasterSid: params.PreCustomerMasterSid },
                });

                if (!existingLead) {
                    throw new Error('Lead not found');
                }
                payload.updatedOn = new Date(); // Only update UpdatedOn
                payload.updatedBy = user['userEmail']
                await this._db.preCustomerMaster.update({
                    where: {
                        PreCustomerMasterSid: params.PreCustomerMasterSid,
                    },
                    data: payload

                })
                return { message: 'Lead updated successfully', data: params };

            } else {
                //check customer name already exist or not
                let leadName = payload.preCustomerName.trim();
                let existingLead = await this._db.preCustomerMaster.findFirst({
                    where: {
                        preCustomerName: leadName
                    }
                });

                if (existingLead) {
                    throw 'Lead already exist.'
                }
                payload.createdOn = new Date();
                payload.updatedOn = new Date();
                payload.createdBy = user['userEmail']; // Only used when creating
                const newLead = await this._db.preCustomerMaster.create({
                    data: payload
                });
                return { message: 'Lead created successfully', data: newLead };
            }
        } catch (error) {
            throw error
        }
    }

    async findOne(PreCustomerMasterSid: any) {
        try {
            return await this._db.preCustomerMaster.findUnique({
                where: {
                    PreCustomerMasterSid: PreCustomerMasterSid
                }
            });
        } catch (error) {
            throw error;
        }
    }





}

