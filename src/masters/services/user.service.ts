import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { UserMaster } from '../models/user-master.model';
import { Model, where } from 'sequelize';
import { UserBranch } from '../models/user-branch-master.model';
import { BranchMaster } from '../models/branch-master.model';
import { CompanyMaster } from '../models/company-master.model';

@Injectable()
export class UserService {
    constructor(
        @InjectModel(UserMaster) 
        private readonly userModel : typeof UserMaster
    ){}

    findUserById(where:any){
        return this.userModel.findOne({where:where})
    }

    async getUserById(userId : number){
        try {
            const user = await this.userModel.findOne({
                where:{UserMasterSid: userId},
                attributes: {exclude:['UserPassword']},
                include:[
                    {
                        model: UserBranch,
                        include:[
                            {
                                model : BranchMaster,
                                required: true,
                            },
                            {
                                model : CompanyMaster,
                                required : true
                            }
                        ]
                    }
                ]
            });
            
            return user;
        } catch (error) {
            console.log("UserServiceError",error);
        }

    }
}
