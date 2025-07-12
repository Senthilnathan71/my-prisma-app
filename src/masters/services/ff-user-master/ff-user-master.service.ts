import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { encodePassword } from 'src/common/helper';
import { DatabaseService } from 'src/database/database.service';
import { SearchListDto } from 'src/masters/DTO/search-list.dto';
import { SearchVesselDto } from 'src/masters/DTO/search-vessel.dto';

@Injectable()
export class FfUserMasterService {
    constructor(private _db:DatabaseService){}

    async getAllFfUser(){
        try {
            const allFfUser = await this._db.userMaster.findMany({
                where : {
                    status : 'A'
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
                        CompanyMasterSid: payload.CompanyMasterSid,
                        deletedAt : null
                    }
                });

                let userCompany;
                if (existingUserCompany) {
                    // Update existing UserCompanyMaster record
                    userCompany = await this._db.userCompanyMaster.updateMany({
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
                    const deletedUser = await this._db.userCompanyMaster.updateMany({
                        where: {
                            UserMasterSid: ffUser.UserMasterSid,
                            CompanyMasterSid: { not: payload.CompanyMasterSid },
                            deletedAt : null
                        }, data: {
                            updatedBy : payload.updatedBy,
                            deletedAt : new Date()
                        }
                    })

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
        // Check if user exists and not already deleted
        const exist = await this._db.userMaster.findUnique({
            where: {
                UserMasterSid: UserMasterSid
            }
        });
        
        if (!exist) {
            throw new BadRequestException(`User with Id : ${UserMasterSid} not exists`);
        }
        
        if (exist.deletedAt) {
            throw new BadRequestException(`User with Id : ${UserMasterSid} is already deleted`);
        }

        return await this._db.$transaction(async (prisma) => {
            // Soft-delete user
            const deletedUser = await prisma.userMaster.update({
                where: { UserMasterSid: UserMasterSid },
                data: {
                    deletedAt: new Date()
                },
                omit: {
                    userPassword: true
                }
            });

            // Soft-delete user company relations
            const deletedUserCompanies = await prisma.userCompanyMaster.updateManyAndReturn({
                where: {
                    UserMasterSid: UserMasterSid,
                    deletedAt: null
                },
                data: {
                    deletedAt: new Date()
                }
            });

            // Soft-delete user branch relations
            const deletedUserBranches = await prisma.userBranchMaster.updateManyAndReturn({
                where: {
                    UserMasterSid: UserMasterSid,
                    deletedAt: null
                },
                data: {
                    deletedAt: new Date()
                }
            });

            // Soft-delete user role relations
            const deletedUserRoles = await prisma.userRoleMaster.updateManyAndReturn({
                where: {
                    UserMasterSid: UserMasterSid,
                    deletedAt: null
                },
                data: {
                    deletedAt: new Date()
                }
            });

            return {
                    deletedUser,
                    deletedUserCompanies,
                    deletedUserBranches,
                    deletedUserRoles
            };
        });
    } catch (error) {
        throw new Error(`User deletion failed: ${error.message}`);
    }
}


    async searchFfUserNew(params: SearchVesselDto) {
        const { search = '', page = 1, pageSize = 10 } = params;
        const skip = (page - 1) * pageSize;

        const where: Prisma.UserMasterWhereInput = {
            deletedAt: null,
            status: 'A',
            ...(search
                ? {
                    OR: [
                        { userName: { contains: search, mode: 'insensitive'} },
                        { userEmail: { contains: search, mode: 'insensitive'} },
                        { isSalesperson: { contains: search, mode: 'insensitive'} },
                    ],
                }
                : {}
            ),
        };

        const [items, totalCount] = await this._db.$transaction([
            this._db.userMaster.findMany({
                where,
                skip,
                take: pageSize,
                orderBy: { UserMasterSid: 'desc'},
            }),
            this._db.userMaster.count({ where }),
        ]);

        return {
            items,
            totalCount,
        };
    }
    
    async resetPassword(UserMasterSid, payload) {
        try {
            const hashedPassword = await encodePassword(payload.password);
            const exist = await this._db.userMaster.findFirst({
                where: {
                    UserMasterSid: UserMasterSid
                }
            })
            if (!exist) {
                throw new BadRequestException(`User with Id :${UserMasterSid} not exists`);
            }

            const reset = await this._db.userMaster.update({
                where : {
                    UserMasterSid : UserMasterSid
                },
                data : {
                    userPassword : hashedPassword,
                    updatedBy : payload.updatedBy,
                    updatedOn : new Date()
                },
                omit : {
                    userPassword : true
                }
            })
            return reset;
        } catch (error) {
            throw error;
        }
    }

}
