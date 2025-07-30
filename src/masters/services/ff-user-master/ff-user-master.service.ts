import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { encodePassword } from 'src/common/helper';
import { DatabaseService } from 'src/database/database.service';
import { SearchListDto } from 'src/masters/DTO/search-list.dto';
import { SearchVesselDto } from 'src/masters/DTO/search-vessel.dto';

@Injectable()
export class FfUserMasterService {
    constructor(private _db: DatabaseService) { }

    async getAllFfUser() {
        try {
            const allFfUser = await this._db.userMaster.findMany({
                where: {
                    status: 'A',
                    deletedAt: null
                },
                omit: {
                    userPassword: true
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
                const ffUser = await prisma.userMaster.create({
                    data: { ...userPayload },
                    omit: {
                        userPassword: true
                    }
                });

                // Creating relation links btw user and companyMaster through UserCompanyMaster
                const userCompanies = await prisma.userCompanyMaster.createManyAndReturn({
                    data: payload.companies.map(CompanyMasterSid => ({
                        UserMasterSid: ffUser.UserMasterSid,
                        CompanyMasterSid: CompanyMasterSid,
                        createdBy: payload.createdBy
                    }))
                });

                // Create relation links btw user and Many branchMasters through UserBranchMaster
                const userBranches: any[] = [];
                const newBranches: { [key: number]: number[] } = payload.branches || {};
                for (const [company, branches] of Object.entries(newBranches)) {
                    for (const branch of branches) {
                        const newUserBranch = await prisma.userBranchMaster.create({
                            data: {
                                UserMasterSid: ffUser.UserMasterSid,
                                BranchMasterSid: branch,
                                CompanyMasterSid: Number(company),
                                createdBy: payload.createdBy,
                                status: 'A'
                            }
                        });
                        userBranches.push(newUserBranch);
                    }
                }

                // Create relation link btw user and RoleMaster through userRoleMaster
                const userRoles: any[] = [];
                for (const userRole of payload.roles) {
                    const newUserRole = await prisma.userRoleMaster.create({
                        data: {
                            UserMasterSid: ffUser.UserMasterSid,
                            createdBy: payload.createdBy,
                            RoleMasterSid : userRole
                        }
                    });
                    userRoles.push(newUserRole);
                }


                return {
                    message: 'User Created Successfully',
                    data: {
                        ffUser,
                        userCompanies,
                        userBranches,
                        userRoles
                    },
                };
            });
        } catch (error) {
            throw new Error(`Transaction failed: ${error.message}`);
        }
    }

    async fetchFfUserById(UserMasterSid: number) {
        try {
            const ourFfUser = await this._db.userMaster.findUnique({
                where: {
                    UserMasterSid: UserMasterSid
                },
                omit: {
                    userPassword: true
                },
                include: {
                    userCompanyMaster: {
                        where: {
                            deletedAt: null
                        }
                    },
                    userBranchMaster: {
                        where: {
                            deletedAt: null
                        }
                    },
                    userRoleMaster: {
                        where: {
                            deletedAt: null
                        },
                    }
                }
            })
            if (!ourFfUser) {
                throw new BadRequestException(`User with Id : ${UserMasterSid} not exists`);
            }
            return ourFfUser;
        } catch (error) {
            throw error;
        }
    }


    async updateFfUserById(UserMasterSid: number, payload: any) {

        const newCompanies: number[] = payload.companies || [];
        const newBranches: { [companyId: number]: number[] } = payload.branches || {};
        const newRoles: any[] = payload.roles || [];

        const prevCompanies = await this._db.userCompanyMaster.findMany({
            where: { UserMasterSid: UserMasterSid, deletedAt: null }
        });

        const prevBranches = await this._db.userBranchMaster.findMany({
            where: { UserMasterSid: UserMasterSid, deletedAt: null }
        });

        const prevRoles = await this._db.userRoleMaster.findMany({
            where: { UserMasterSid: UserMasterSid, deletedAt: null }
        });

        const { companies, branches, roles, ...userPayload } = payload
        return await this._db.$transaction(async (prisma) => {

            const updatedUser = await prisma.userMaster.update({
                where: { UserMasterSid: UserMasterSid },
                data: {
                    ...userPayload,
                    updatedBy: payload.updatedBy
                }
            });

            // Step 2: Update Companies
            const newCompanySet = new Set(newCompanies);
            const prevCompanySet = new Set(prevCompanies.map(c => c.CompanyMasterSid));

            const companiesToDelete = prevCompanies.filter(c => !newCompanySet.has(c.CompanyMasterSid));
            const companiesToInsert = [...newCompanySet].filter(id => !prevCompanySet.has(id));

            const userCompanies  = {};
            userCompanies['deletedCompanies'] = await Promise.all(companiesToDelete.map(c =>
                 prisma.userCompanyMaster.updateManyAndReturn({
                    where: { UserCompanyMasterSid: c.UserCompanyMasterSid },
                    data: { deletedAt: new Date() }
                })
            ));

            if (companiesToInsert.length > 0) {
                userCompanies['createdCompanies']= await prisma.userCompanyMaster.createManyAndReturn({
                    data: companiesToInsert.map(id => ({
                        UserMasterSid: UserMasterSid,
                        CompanyMasterSid: id,
                        createdBy: payload.updatedBy,
                        status: 'A'
                    }))
                });
            }

            // Step 3: Update Branches
            const newBranchSet = new Set(Object.values(newBranches).flat());
            const prevBranchSet = new Set(prevBranches.map(b => b.BranchMasterSid));

            const branchesToDelete = prevBranches.filter(b => !newBranchSet.has(b.BranchMasterSid));

            const userBranches = {};
            userBranches['deletedBranch'] = await Promise.all(branchesToDelete.map(b =>
                prisma.userBranchMaster.updateManyAndReturn({
                    where: { UserBranchMasterSid: b.UserBranchMasterSid },
                    data: { deletedAt: new Date() }
                })
            ));

            const createdBranches :any[] = [];
            for (const [companyId, branchIds] of Object.entries(newBranches)) {
                for (const branchId of branchIds) {
                    if (!prevBranchSet.has(branchId)) {
                        const newBranch = await prisma.userBranchMaster.create({
                            data: {
                                UserMasterSid: UserMasterSid,
                                CompanyMasterSid: Number(companyId),
                                BranchMasterSid: branchId,
                                createdBy: payload.updatedBy,
                                status: 'A'
                            }
                        });
                        createdBranches.push(newBranch);
                    }
                }
            }
            userBranches['createdBranches']=createdBranches

            // Step 3: Update Role
            const newRoleSet = new Set(newRoles);
            const prevRoleSet = new Set(prevRoles.map(b => b.RoleMasterSid));

            const roleToDelete = prevRoles.filter(b => !newRoleSet.has(b.RoleMasterSid));
            const roleToInsert = [...newRoleSet].filter(roleId => !prevRoleSet.has(roleId));

            const userRoles = {};
            userRoles['deletedRoles'] = await Promise.all(roleToDelete.map(b =>
                prisma.userRoleMaster.updateManyAndReturn({
                    where: { UserRoleMasterSid: b.UserRoleMasterSid },
                    data: { deletedAt: new Date() }
                })
            ));

            if(roleToInsert.length > 0) {
                userRoles['createdRoles'] = await prisma.userRoleMaster.createManyAndReturn({
                    data : roleToInsert.map(roleId => ({
                        UserMasterSid : UserMasterSid,
                        RoleMasterSid : roleId,
                        createdBy : payload.updatedBy
                    }))
                })
            }

            return {
                message: 'User updated successfully',
                data: {
                    updatedUser,
                    userCompanies,
                    userBranches,
                    userRoles,
                }
            };
        });
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
        const { search = '', page = 1, pageSize = 15 } = params;
        const skip = (page - 1) * pageSize;

        const where: Prisma.UserMasterWhereInput = {
            deletedAt: null,
            status: 'A',
            ...(search
                ? {
                    OR: [
                        { userName: { contains: search, mode: 'insensitive' } },
                        { userEmail: { contains: search, mode: 'insensitive' } },
                        { isSalesperson: { contains: search, mode: 'insensitive' } },
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
                orderBy: { UserMasterSid: 'desc' },
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
                where: {
                    UserMasterSid: UserMasterSid
                },
                data: {
                    userPassword: hashedPassword,
                    updatedBy: payload.updatedBy,
                    updatedOn: new Date()
                },
                omit: {
                    userPassword: true
                }
            })
            return reset;
        } catch (error) {
            throw error;
        }
    }

}
