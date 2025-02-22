import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { UserMaster } from '../models/user-master.model';
import { Model, where } from 'sequelize';
import { UserBranch } from '../models/user-branch-master.model';
import { BranchMaster } from '../models/branch-master.model';
import { CompanyMaster } from '../models/company-master.model';
import { DatabaseService } from 'src/database/database.service';

@Injectable()
export class UserService {
    constructor(
        // @InjectModel(UserMaster) 
        // private readonly userModel : typeof UserMaster
        private _db: DatabaseService

    ){}

    async findUserById(where:any){
        // return this.userModel.findOne({where:where})
        const userData = await this._db.userMaster.findFirst({
            where:where
          })
          return userData
    }

    async getUserById(userId : number){
        try {
            // const user = await this.userModel.findOne({
            //     where:{UserMasterSid: userId},
            //     attributes: {exclude:['UserPassword']},
            //     include:[
            //         {
            //             model: UserBranch,
            //             include:[
            //                 {
            //                     model : BranchMaster,
            //                     required: true,
            //                 },
            //                 {
            //                     model : CompanyMaster,
            //                     required : true
            //                 }
            //             ]
            //         }
            //     ]
            // });


            const user = await this._db.userMaster.findUnique({
                where:{
                    UserMasterSid:userId
                },
                omit:{
                    userPassword:true
                },
                include:{
                    userBranchMaster:{
                        include:{
                            branchMaster:true,
                            companyMaster:true
                        }
                    }
                }
            })
            
            return user;
        } catch (error) {
            console.log("UserServiceError",error);
        }

    }
}
