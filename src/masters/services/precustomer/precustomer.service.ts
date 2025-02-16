import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { CreatePrecustomerDto } from 'src/masters/DTO/create-Precustomer.dto';
import { PreCustomerMaster } from 'src/masters/models/pre-customer-master.model';

@Injectable()
export class PrecustomerService {
    constructor(
        @InjectModel(PreCustomerMaster)
        private readonly preCustomer : typeof PreCustomerMaster
    ){}

    async getAllPrecustomer(user){
        try {
            const customer = await this.preCustomer.findAll({
                where:{
                    CompanyMasterSid : user.CompanyMasterSid,
                    BranchMasterSid : user.BranchMasterSid,
                    Status : "A"
                }
            });
            return customer;
        } catch (error) {
           console.log("cutomerError", error) 
        }
    }

    async createPrecustomer(params : CreatePrecustomerDto, user){
        try {
            const payload ={
                CompanyMasterSid : user['userBranch'][0].CompanyMasterSid,
                CityMasterSid : params.CityMasterSid,
                CountryMasterSid : params.CountryMasterSid,
                StateMasterSid : params.StateMasterSid,
                BranchMasterSid : user['userBranch'][0].BranchMasterSid,
                PreCustomerName : params.PreCustomerName,
                PreCustomerAddress1 : params.PreCustomerAddress1,
                PreCustomerAddress2 : params.PreCustomerAddress2,
                ContactPerson : params.ContactPerson,
                Email : params.Email,
                Phone : params.Phone,
                LeadFrom : params.LeadFrom,
                LeadReferredBy : params.LeadReferredBy,
                CreatedBy : user['UserEmail'],
                CreatedOn : new Date(),
                UpdatedOn :  new Date(),
                Status : params.Status || 'A'
            };

            if(params.PreCustomerMasterSid){

            }else{
                params = await this.preCustomer.create(payload);
            }
            return params
        } catch (error) {
            throw error
        }
    }

    async findOne(where : any){
        try {
            return await this.preCustomer.findOne({
                where : where
            });
        } catch (error) {
            throw error;
        }
    }
}
