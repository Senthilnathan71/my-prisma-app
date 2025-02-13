import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
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
                    Status : "1"
                }
            });
            return customer;
        } catch (error) {
           console.log("cutomerError", error) 
        }
    }
}
