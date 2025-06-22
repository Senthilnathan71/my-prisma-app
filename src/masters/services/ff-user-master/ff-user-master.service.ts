import { BadRequestException, Injectable } from '@nestjs/common';
import { encodePassword } from 'src/common/helper';
import { DatabaseService } from 'src/database/database.service';
import { SearchListDto } from 'src/masters/DTO/search-list.dto';

@Injectable()
export class FfUserMasterService {
    constructor(private _db:DatabaseService){}

    async getAllFfUser(){
        try {
            const allFfUser = await this._db.userMaster.findMany({
                where : {
                    deletedAt:null
                },
                omit : {
                    userPassword : true
                }
            })
            return allFfUser;
        } catch (error) {
            throw error;
        }
    }

    async createNewFfUser(payload) {
        try {
            const hashedPassword = await encodePassword(payload.userPassword);
            const userPayload = {
                userCode: payload.userCode,
                userName: payload.userName,
                userEmail: payload.userEmail,
                userPassword: hashedPassword,
                isSalesperson: payload.isSalesperson,
                contactNumber: payload.contactNumber,
                department: payload.department,
                DefaultDept: payload.DefaultDept,
                createdBy: payload.createdBy,
                CountryMasterSid: payload.CountryMasterSid,
                status: payload.status,
                userTypeId: payload.userTypeId,
            };

            return await this._db.$transaction(async (prisma) => {
                // Creating User
                const ffUser = await this._db.userMaster.create({
                    data: { ...userPayload }
                });

                // Creating relation links btw user and companyMaster through UserCompanyMaster
                const userCompany = await this._db.userCompanyMaster.create({
                    data: {
                        UserMasterSid: ffUser.UserMasterSid,
                        CompanyMasterSid: payload.CompanyMasterSid,
                        createdBy: payload.createdBy
                    }
                });

                // Create relation links btw user and Many branchMasters through UserBranchMaster
                const userBranches = await prisma.userBranchMaster.createManyAndReturn({
                    data: payload.branches.map(BranchMasterSid => ({
                        UserMasterSid: ffUser.UserMasterSid,
                        CompanyMasterSid: payload.CompanyMasterSid,
                        BranchMasterSid,
                        createdBy: payload.createdBy,
                        status: payload.status
                    }))
                });

                // Create relation link btw user and RoleMaster through userRoleMaster
                const userRoles = await prisma.userRoleMaster.createManyAndReturn({
                    data: payload.roles.map(RoleMasterSid => ({
                        UserMasterSid: ffUser.UserMasterSid,
                        RoleMasterSid,
                        createdBy: payload.createdBy
                    }))
                });


                return {
                    message: 'User Created Successfully',
                    data: {
                        ffUser,
                        userCompany,
                        userBranches,
                        userRoles
                    },
                };
            });
        } catch (error) {
            throw new Error(`Transaction failed: ${error.message}`);
        }
    }

    async fetchFfUserById(UserMasterSid:number){
        try {
            const ourFfUser =await this._db.userMaster.findUnique({
                where : {
                    UserMasterSid:UserMasterSid
                },
                omit : {
                    userPassword : true
                },
                include : {
                    userCompanyMaster : {
                        where : {
                            deletedAt : null
                        }
                    },
                    userBranchMaster : {
                        where : {
                            deletedAt : null
                        }
                    },
                    userRoleMaster : {
                        where : {
                            deletedAt : null
                        }
                    }
                }
            })
            if(!ourFfUser){
                throw new BadRequestException(`User with Id : ${UserMasterSid} not exists`);
            }
            return ourFfUser;
        } catch (error) {
            throw error;
        }
    }

    async updateFfUserById(UserMasterSid, payload) {
        try {
            const exist = await this._db.userMaster.findUnique({
                where: {
                    UserMasterSid: UserMasterSid
                }
            })
            if (!exist) {
                throw new BadRequestException(`User with Id : ${UserMasterSid} not exists`);
            }
            const userPayload = {
                userCode: payload.userCode,
                userName: payload.userName,
                userEmail: payload.userEmail,
                isSalesperson: payload.isSalesperson,
                contactNumber: payload.contactNumber,
                department: payload.department,
                DefaultDept: payload.DefaultDept,
                updatedBy: payload.updatedBy,
                CountryMasterSid: payload.CountryMasterSid,
                status: payload.status,
                userTypeId: payload.userTypeId,
            };

            return await this._db.$transaction(async (prisma) => {
                // Update User
                const ffUser = await this._db.userMaster.update({
                    where: { UserMasterSid: UserMasterSid },
                    data: userPayload,
                    omit : {
                        userPassword: true
                    }
                });

                // Check if UserCompanyMaster record exists
                const existingUserCompany = await this._db.userCompanyMaster.findFirst({
                    where: {
                        UserMasterSid: ffUser.UserMasterSid,
                        CompanyMasterSid: payload.CompanyMasterSid
                    }
                });

                let userCompany;
                if (existingUserCompany) {
                    // Update existing UserCompanyMaster record
                    userCompany = await this._db.userCompanyMaster.updateManyAndReturn({
                        where: {
                            UserMasterSid: ffUser.UserMasterSid,
                            CompanyMasterSid: payload.CompanyMasterSid
                        },
                        data: {
                            updatedBy: payload.updatedBy,
                            deletedAt: null
                        }
                    });
                } else {
                    // Create new UserCompanyMaster record
                    userCompany = await this._db.userCompanyMaster.create({
                        data: {
                            UserMasterSid: ffUser.UserMasterSid,
                            CompanyMasterSid: payload.CompanyMasterSid,
                            createdBy: payload.updatedBy,
                            updatedBy: payload.updatedBy,
                            deletedAt: null
                        }
                    });
                }

                // Soft-delete existing branch Relations
                await prisma.userBranchMaster.updateMany({
                    where: {
                        UserMasterSid: ffUser.UserMasterSid,
                        deletedAt: null
                    },
                    data: {
                        deletedAt: new Date()
                    }
                });

                // Create new branch Relations
                const userBranches = await prisma.userBranchMaster.createManyAndReturn({
                    data: payload.branches.map(BranchMasterSid => ({
                        UserMasterSid: ffUser.UserMasterSid,
                        CompanyMasterSid: payload.CompanyMasterSid,
                        BranchMasterSid: BranchMasterSid,
                        createdBy: payload.updatedBy,
                        updatedBy: payload.updatedBy,
                        status: payload.status,
                        deletedAt: null
                    }))
                });

                // Soft-delete existing role Relations
                await prisma.userRoleMaster.updateMany({
                    where: {
                        UserMasterSid: ffUser.UserMasterSid,
                        deletedAt: null
                    },
                    data: {
                        deletedAt: new Date()
                    }
                });

                // Create new role Relations
                const userRoles = await prisma.userRoleMaster.createManyAndReturn({
                    data: payload.roles.map(RoleMasterSid => ({
                        UserMasterSid: ffUser.UserMasterSid,
                        RoleMasterSid: RoleMasterSid,
                        createdBy: payload.updatedBy,
                        updatedBy: payload.updatedBy,
                        deletedAt: null
                    }))
                });

                return {
                    message: 'User Updated Successfully',
                    data: {
                        ffUser,
                        userCompany,
                        userBranches,
                        userRoles
                    }
                };
            });
        } catch (error) {
            throw new Error(`Transaction failed: ${error.message}`);
        }
    }


    async deleteFfUser(UserMasterSid: number) {
        try {
            const exist = await this._db.userMaster.findUnique({
                where: {
                    UserMasterSid: UserMasterSid
                }
            })
            if (!exist) {
                throw new BadRequestException(`User with Id : ${UserMasterSid} not exists`);
            }
            if (exist.deletedAt) {
                throw new BadRequestException(`User with Id :${UserMasterSid} is already deleted`)
            }
            const deletedFfUser = this._db.userMaster.update({
                where: {
                    UserMasterSid: UserMasterSid
                },
                data: {
                    deletedAt: new Date()
                },
                omit : {
                    userPassword : true
                }
            })
            return deletedFfUser;
        } catch (error) {
            throw error;
        }
    }


    async searchFfUser(data:SearchListDto){
        const {searchType,filterValue}=data;
        const intFields=[
            ''
        ];
        const stringFields = [
            'userName',
            'userEmail',
            'isSalesperson',
            'status'
        ];
        const acceptedType = [...intFields,...stringFields];
        if(!acceptedType.includes(searchType)){
            throw new BadRequestException('Invalid Search Type');
        }

        const whereClause:any ={}

        if(stringFields.includes(searchType)){
            whereClause[searchType]={
                contains:filterValue,
                mode:'insensitive'
            }
        } else if(intFields.includes(searchType)){
            const numberValue=parseInt(filterValue);
            if (isNaN(numberValue)) {
                throw new BadRequestException(`${searchType} must be a valid number`);
            }
            whereClause[searchType]=numberValue;
        }

        const searchResults = await this._db.userMaster.findMany({
            where : {
                ...whereClause,
                deletedAt:null
            }, omit: {
                userPassword: true
            },
        }).catch((err) => {
            throw new Error(`Error Occured : ${JSON.stringify(err), err}`);
        })

        return searchResults;

    }

}
