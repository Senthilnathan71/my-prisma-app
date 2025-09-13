import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { encodePassword } from 'src/common/helper';
import { DatabaseService } from 'src/database/database.service';
import { SearchListDto } from 'src/masters/DTO/search-list.dto';
import { filterDto } from 'src/masters/DTO/search-vessel.dto';

@Injectable()
export class FfUserMasterService {
    constructor(private _db: DatabaseService, private logger: Logger) { }

    async getAllFfUser() {
        try {
            const allFfUser = await this._db.userMaster.findMany({
                where: {
                    status: 'A',
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

    async createNewFfUser(payload: any) {
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

                // Creating relation links between user and companyMaster through UserCompanyMaster
                const userCompaniesData = payload.companies.map((company: any) => ({
                    UserMasterSid: ffUser.UserMasterSid,
                    CompanyMasterSid: company.CompanyMasterSid,
                    createdBy: payload.createdBy,
                    GiveAccess: company.GiveAccess,
                    IsDefault: company.IsDefault
                }));

                const userCompanies = await prisma.userCompanyMaster.createManyAndReturn({
                    data: userCompaniesData
                });

                // Create relation links between user and branchMasters through UserBranchMaster
                const userBranches: any[] = [];
                for (const company of payload.companies) {
                    for (const branch of company.userBranches) {
                        const newUserBranch = await prisma.userBranchMaster.create({
                            data: {
                                UserMasterSid: ffUser.UserMasterSid,
                                BranchMasterSid: branch.BranchMasterSid,
                                CompanyMasterSid: branch.CompanyMasterSid,
                                createdBy: payload.createdBy,
                                status: 'A',
                                GiveAccess: branch.GiveAccess,
                                IsDefault: branch.IsDefault
                            }
                        });
                        userBranches.push(newUserBranch);
                    }
                }

                // Create relation link between user and RoleMaster through userRoleMaster
                const userRoles: any[] = [];
                if (payload.roles && Array.isArray(payload.roles)) {
                    for (const userRole of payload.roles) {
                        const newUserRole = await prisma.userRoleMaster.create({
                            data: {
                                UserMasterSid: ffUser.UserMasterSid,
                                createdBy: payload.createdBy,
                                RoleMasterSid: userRole
                            }
                        });
                        userRoles.push(newUserRole);
                    }
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
                        orderBy: {
                            companyMaster: { companyName: 'asc' }
                        },
                        where: {
                            status: 'A'
                        },
                        include: {
                            companyMaster: {
                                include: {
                                    userBranchMaster: {
                                        where: {
                                            UserMasterSid: UserMasterSid,
                                            status: 'A'
                                        },
                                        orderBy: {
                                            branchMaster: { branchName: 'asc' }
                                        },
                                        include: {
                                            branchMaster: true
                                        }
                                    }
                                }
                            }
                        }
                    },
                    userRoleMaster: {
                        where: {
                            status: 'A'
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
        try {
            const { companies, roles, ...userPayload } = payload;

            const prevCompanies = await this._db.userCompanyMaster.findMany({
                where: { UserMasterSid, status: 'A' }
            });

            const prevBranches = await this._db.userBranchMaster.findMany({
                where: { UserMasterSid, status: 'A' }
            });

            const prevRoles = await this._db.userRoleMaster.findMany({
                where: { UserMasterSid, status: "A" }
            });

            return await this._db.$transaction(async (prisma) => {

                // Update User
                const updatedUser = await prisma.userMaster.update({
                    where: { UserMasterSid },
                    data: {
                        ...userPayload,
                        updatedBy: payload.updatedBy
                    }
                });

                // Step 1: Update Companies
                const newCompanySet = new Set(companies.map((c: any) => c.CompanyMasterSid));
                const prevCompanySet = new Set(prevCompanies.map(c => c.CompanyMasterSid));

                const companiesToDelete = prevCompanies.filter(c => !newCompanySet.has(c.CompanyMasterSid));
                const companiesToInsert = companies.filter((c: any) => !prevCompanySet.has(c.CompanyMasterSid));
                const companiesToUpdate = companies.filter((c: any) => prevCompanySet.has(c.CompanyMasterSid));

                const userCompanies: any = { deletedCompanies: [], createdCompanies: [], updatedCompanies: [] };

                // Soft delete removed companies
                userCompanies.deletedCompanies = await prisma.userCompanyMaster.updateManyAndReturn({
                    where: { UserCompanyMasterSid: { in: companiesToDelete.map(c => c.UserCompanyMasterSid) } },
                    data: { status: 'D' }
                });

                // Create new companies
                if (companiesToInsert.length > 0) {
                    userCompanies.createdCompanies = await prisma.userCompanyMaster.createManyAndReturn({
                        data: companiesToInsert.map((c: any) => ({
                            UserMasterSid,
                            CompanyMasterSid: c.CompanyMasterSid,
                            createdBy: payload.updatedBy,
                            GiveAccess: c.GiveAccess,
                            IsDefault: c.IsDefault,
                            status: 'A'
                        }))
                    });
                }

                // Update existing companies (GiveAccess, IsDefault)
                if (companiesToUpdate.length > 0) {
                    userCompanies.updatedCompanies = await Promise.all(companiesToUpdate.map(async (c: any) => {
                        const existing = prevCompanies.find(pc => pc.CompanyMasterSid === c.CompanyMasterSid);
                        if (existing && (existing.GiveAccess !== c.GiveAccess || existing.IsDefault !== c.IsDefault)) {
                            return prisma.userCompanyMaster.update({
                                where: { UserCompanyMasterSid: existing.UserCompanyMasterSid },
                                data: {
                                    GiveAccess: c.GiveAccess,
                                    IsDefault: c.IsDefault,
                                    updatedBy: payload.updatedBy
                                }
                            });
                        }
                        return existing;
                    }));
                }

                // Step 2: Update Branches
                const newBranches = companies.flatMap((c: any) =>
                    c.userBranches.map((b: any) => ({
                        CompanyMasterSid: b.CompanyMasterSid,
                        BranchMasterSid: b.BranchMasterSid,
                        GiveAccess: b.GiveAccess,
                        IsDefault: b.IsDefault
                    }))
                );
                const newBranchSet = new Set(newBranches.map(b => `${b.CompanyMasterSid}-${b.BranchMasterSid}`));
                const prevBranchSet = new Set(prevBranches.map(b => `${b.CompanyMasterSid}-${b.BranchMasterSid}`));

                const branchesToDelete = prevBranches.filter(b => !newBranchSet.has(`${b.CompanyMasterSid}-${b.BranchMasterSid}`));
                const branchesToInsert = newBranches.filter(b => !prevBranchSet.has(`${b.CompanyMasterSid}-${b.BranchMasterSid}`));
                const branchesToUpdate = newBranches.filter(b => prevBranchSet.has(`${b.CompanyMasterSid}-${b.BranchMasterSid}`));

                const userBranches: any = { deletedBranches: [], createdBranches: [], updatedBranches: [] };

                // Soft delete removed branches
                userBranches.deletedBranches = await prisma.userBranchMaster.updateManyAndReturn({
                    where: { UserBranchMasterSid: { in: branchesToDelete.map(b => b.UserBranchMasterSid) } },
                    data: { status: 'D' }
                });

                // Create new branches
                if (branchesToInsert.length > 0) {
                    userBranches.createdBranches = await prisma.userBranchMaster.createManyAndReturn({
                        data: branchesToInsert.map(b => ({
                            UserMasterSid,
                            CompanyMasterSid: b.CompanyMasterSid,
                            BranchMasterSid: b.BranchMasterSid,
                            createdBy: payload.updatedBy,
                            GiveAccess: b.GiveAccess,
                            IsDefault: b.IsDefault,
                            status: 'A'
                        }))
                    });
                }

                // Update existing branches (GiveAccess, IsDefault)
                if (branchesToUpdate.length > 0) {
                    userBranches.updatedBranches = await Promise.all(branchesToUpdate.map(async (b: any) => {
                        const existing = prevBranches.find(pb => pb.CompanyMasterSid === b.CompanyMasterSid && pb.BranchMasterSid === b.BranchMasterSid);
                        if (existing && (existing.GiveAccess !== b.GiveAccess || existing.IsDefault !== b.IsDefault)) {
                            return prisma.userBranchMaster.update({
                                where: { UserBranchMasterSid: existing.UserBranchMasterSid },
                                data: {
                                    GiveAccess: b.GiveAccess,
                                    IsDefault: b.IsDefault,
                                    updatedBy: payload.updatedBy
                                }
                            });
                        }
                        return existing;
                    }));
                }

                // Step 3: Update Roles
                const newRoleSet = new Set(roles || []);
                const prevRoleSet = new Set(prevRoles.map(r => r.RoleMasterSid));

                const rolesToDelete = prevRoles.filter(r => !newRoleSet.has(r.RoleMasterSid));
                const rolesToInsert = [...newRoleSet].filter(roleId => !prevRoleSet.has(Number(roleId)));

                const userRoles: any = { deletedRoles: [], createdRoles: [] };

                // Soft delete removed roles
                userRoles.deletedRoles = await prisma.userRoleMaster.updateManyAndReturn({
                    where: { UserRoleMasterSid: { in: rolesToDelete.map(r => r.UserRoleMasterSid) } },
                    data: { status: 'D' }
                });

                // Create new roles
                if (rolesToInsert.length > 0) {
                    userRoles.createdRoles = await prisma.userRoleMaster.createManyAndReturn({
                        data: rolesToInsert.map((roleId: number) => ({
                            UserMasterSid,
                            RoleMasterSid: roleId,
                            createdBy: payload.updatedBy
                        }))
                    });
                }

                return {
                    message: 'User updated successfully',
                    data: {
                        updatedUser,
                        userCompanies,
                        userBranches,
                        userRoles
                    }
                };
            });
        } catch (error) {
            console.error('User Update Error:', error);
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

            if (exist.status === 'D') {
                throw new BadRequestException(`User with Id : ${UserMasterSid} is already deleted`);
            }

            return await this._db.$transaction(async (prisma) => {
                // Soft-delete user
                const deletedUser = await prisma.userMaster.update({
                    where: { UserMasterSid: UserMasterSid },
                    data: {
                        status: 'D'
                    },
                    omit: {
                        userPassword: true
                    }
                });

                // Soft-delete user company relations
                const deletedUserCompanies = await prisma.userCompanyMaster.updateManyAndReturn({
                    where: {
                        UserMasterSid: UserMasterSid,
                        status: 'D'
                    },
                    data: {
                        status: 'D'
                    }
                });

                // Soft-delete user branch relations
                const deletedUserBranches = await prisma.userBranchMaster.updateManyAndReturn({
                    where: {
                        UserMasterSid: UserMasterSid,
                        status: 'D'
                    },
                    data: {
                        status: 'D'
                    }
                });

                // Soft-delete user role relations
                const deletedUserRoles = await prisma.userRoleMaster.updateManyAndReturn({
                    where: {
                        UserMasterSid: UserMasterSid,
                        status: 'D'
                    },
                    data: {
                        status: 'D'
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


    async searchFfUserNew(params: filterDto) {
        const { search = '', page = 1, pageSize = 15 } = params;
        const skip = (page - 1) * pageSize;

        const where: Prisma.UserMasterWhereInput = {
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

    async getAuditLogs(tableName: string, recordId?: string) {
        try {
            const whereClause: any = { tableName };
            if (recordId) whereClause.recordId = recordId;

            const logs = await this._db.auditLog.findMany({
                where: whereClause,
                orderBy: { changedAt: 'desc' },
            });

            return logs;
        } catch (error) {
            this.logger.warn(`getAuditLogsError: ${error}`);
            throw new Error(`Error fetching audit logs: ${error.message}`);
        }
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
