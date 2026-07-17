import { BadRequestException, Injectable, Logger, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { Prisma, UserTypeCode } from '@prisma/client';
import { encodePassword, statusWhereClause } from 'src/common/helper';
import { DatabaseService } from 'src/database/database.service';
import { SearchListDto } from 'src/masters/DTO/search-list.dto';
import { filterDto } from 'src/masters/DTO/search-vessel.dto';
import { CreateUserMasterDto, FetchReportingUsersDto, UpdateUserMasterDto, UserBranchMasterDto, UserCompanyMasterDto, UserRoleMasterDto } from 'src/masters/DTO/user.dto';

@Injectable()
export class FfUserMasterService {
    constructor(private _db: DatabaseService, private logger: Logger) { }

    private parseAttemptDateTime(value?: string | Date | null): Date | null {
        if (!value) {
            return null;
        }

        const date = value instanceof Date ? value : new Date(value);
        return Number.isNaN(date.getTime()) ? null : date;
    }

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

    async createNewFfUser(payload: CreateUserMasterDto) {
        try {
            const hashedPassword = await encodePassword(payload.userPassword);
            const userPayload = {
                userCode: payload.userCode,
                userName: payload.userName,
                designation: payload.designation,
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
                isLoginUser : payload.isLoginUser,
                SalesCompany: payload.SalesCompany ?? [],
            };

            return await this._db.$transaction(async (prisma) => {

                 const existing = await this._db.userMaster.findFirst({
                where: {
                    OR: [
                        payload.userName ? { userName: payload.userName } : undefined,
                        payload.userEmail ? { userEmail: payload.userEmail } : undefined,
                    ].filter(Boolean) as any,
                },
            });

            if (existing) {
                if (
                    payload.userName &&
                    existing.userName?.toLowerCase() === payload.userName.trim().toLowerCase()
                ) {
                    throw new BadRequestException('User Name already exists.');
                }

                if (
                    payload.userEmail &&
                    existing.userEmail?.toLowerCase() === payload.userEmail.trim().toLowerCase()
                ) {
                    throw new BadRequestException('User Email already exists');
                }
            }
                // Step 1: Create User Master
                const ffUser = await prisma.userMaster.create({
                    data: { ...userPayload },
                    omit: {
                        userPassword: true,
                    },
                });

                if (payload.AttemptDateTime) {
                    await prisma.$executeRaw`
                        UPDATE "UserMaster"
                        SET "AttemptDateTime" = ${this.parseAttemptDateTime(payload.AttemptDateTime)}
                        WHERE "UserMasterSid" = ${ffUser.UserMasterSid}
                    `;
                }

                // Step 2: Create User Companies in parallel
                const companyPromises = payload.userCompanyMaster.map(async (company: UserCompanyMasterDto) => {
                    return await prisma.userCompanyMaster.create({
                        data: {
                            UserMasterSid: ffUser.UserMasterSid,
                            CompanyMasterSid: company.CompanyMasterSid,
                            createdBy: payload.createdBy,
                            GiveAccess: company.GiveAccess,
                            IsDefault: company.IsDefault,
                            status: 'A',
                        },
                    });
                });

                const createdCompanies = await Promise.all(companyPromises);

                // Create mapping: CompanyMasterSid => UserCompanyMasterSid
                const companySidMap = new Map(
                    createdCompanies.map((uc) => [uc.CompanyMasterSid, uc.UserCompanyMasterSid])
                );

                // Step 3: Create User Roles (within companies) - Batch operation
                const rolesToCreate = payload.userCompanyMaster.flatMap((company: UserCompanyMasterDto) => {
                    const ucSid = companySidMap.get(company.CompanyMasterSid);
                    if (!ucSid) return [];

                    return (company.userRoleMaster || []).map((role: UserRoleMasterDto) => ({
                        UserCompanyMasterSid: ucSid,
                        UserMasterSid: ffUser.UserMasterSid,
                        RoleMasterSid: role.RoleMasterSid,
                        createdBy: payload.createdBy,
                        status: 'A',
                    }));
                });

                const createdRoles =
                    rolesToCreate.length > 0
                        ? await prisma.userRoleMaster.createManyAndReturn({ data: rolesToCreate })
                        : [];

                // Step 4: Create User Branches - Batch operation
                const branchesToCreate = payload.userCompanyMaster.flatMap((company: UserCompanyMasterDto) =>
                    (company.userBranchMaster || []).map((branch: UserBranchMasterDto) => ({
                        UserMasterSid: ffUser.UserMasterSid,
                        BranchMasterSid: branch.BranchMasterSid,
                        CompanyMasterSid: branch.CompanyMasterSid,
                        createdBy: payload.createdBy,
                        status: 'A',
                        GiveAccess: branch.GiveAccess,
                        IsDefault: branch.IsDefault,
                        CostRevenueAccess: branch.CostRevenueAccess ?? 'NONE',
                    }))
                );

                const createdBranches =
                    branchesToCreate.length > 0
                        ? await prisma.userBranchMaster.createManyAndReturn({ data: branchesToCreate })
                        : [];

                return {
                    message: 'User Created Successfully',
                    data: {
                        ffUser,
                        userCompanies: createdCompanies,
                        userRoles: createdRoles,
                        userBranches: createdBranches,
                    },
                };
            });
        } catch (error: any) {
            console.error('User Creation Error:', error);
            if (error instanceof NotFoundException || error instanceof BadRequestException) {
                throw error;
            }
        }
    }

    async getReportingUsers(payload: FetchReportingUsersDto) {
        const { CompanyMasterSid } = payload;
        const reportingUserTypes: UserTypeCode[] = [
            UserTypeCode.manager,
            UserTypeCode.salesManager,
            UserTypeCode.csManager,
            UserTypeCode.opsManager,
            UserTypeCode.docManager,
            UserTypeCode.accountsManager,
            UserTypeCode.management,
            UserTypeCode.branchManager,
            UserTypeCode.generalManager,
            UserTypeCode.MD,
            UserTypeCode.CEO,
        ];

        try {
            const users = await this._db.userMaster.findMany({
                where: {
                    userType: {
                        code: {
                            in: reportingUserTypes,
                        },
                    },
                    status: 'A',
                    userCompanyMaster: {
                        some: {
                            CompanyMasterSid: CompanyMasterSid,
                            GiveAccess: 'Y',
                            status: 'A'
                        }
                    }
                },
                select: {
                    UserMasterSid: true,
                    userName: true,
                    userEmail: true,
                    userType: {
                        select: {
                            code: true,
                            name: true,
                        },
                    },
                },
                orderBy: {
                    userName: 'asc',
                },
            });
            return users;
        } catch (error) {
            throw error;
        }
    }

    async fetchFfUserById(UserMasterSid: number,CompanyMasterSid: number) {
        try {
            const ourFfUser = await this._db.userMaster.findFirst({
                where: {
                    UserMasterSid: UserMasterSid,
                    // Allow access if the user has company access (login-user flow)
                    // OR is a salesman assigned to this company via SalesCompany.
                    OR: [
                        {
                            userCompanyMaster: {
                                some: {
                                    CompanyMasterSid: CompanyMasterSid
                                }
                            }
                        },
                        {
                            SalesCompany: { has: CompanyMasterSid }
                        }
                    ]
                },
                omit: {
                    userPassword: true
                },
                include: {
                    userCompanyMaster: {
                        orderBy: { companyMaster: { companyName: 'asc' } },
                        where: { status: 'A' },
                        include: {
                            companyMaster: {
                                include: {
                                    userBranchMaster: {
                                        where: {
                                            UserMasterSid: UserMasterSid,
                                            status: 'A'
                                        },
                                        include: { branchMaster: true },
                                        orderBy: { branchMaster: { branchName: 'asc' } }
                                    }
                                },
                            },
                            userRoleMaster: { where: { status: 'A' } },
                        }
                    }
                }
            })
            if (!ourFfUser) {
                throw new UnauthorizedException(`Access denied.`);
            }

            const attemptRows = await this._db.$queryRaw<{ AttemptDateTime: Date | null }[]>`
                SELECT "AttemptDateTime"
                FROM "UserMaster"
                WHERE "UserMasterSid" = ${UserMasterSid}
                LIMIT 1
            `;

            return {
                ...ourFfUser,
                AttemptDateTime: attemptRows[0]?.AttemptDateTime ?? null,
            };
        } catch (error) {
            throw error;
        }
    }


    async updateFfUserById(UserMasterSid: number, payload: UpdateUserMasterDto) {
        try {
            const { userCompanyMaster = [], AttemptDateTime, ...userPayload } = payload;
            const { updatedBy } = payload;

            const existing = await this._db.userMaster.findFirst({
                where: {
                    UserMasterSid: { not: UserMasterSid },
                    OR: [
                        payload.userName ? { userName: payload.userName } : undefined,
                        payload.userEmail ? { userEmail: payload.userEmail } : undefined,
                    ].filter(Boolean) as any,
                },
            });

            if (existing) {
                if (
                    payload.userName &&
                    existing.userName?.toLowerCase() === payload.userName.trim().toLowerCase()
                ) {
                    throw new BadRequestException('User Name already exists.');
                }

                if (
                    payload.userEmail &&
                    existing.userEmail?.toLowerCase() === payload.userEmail.trim().toLowerCase()
                ) {
                    throw new BadRequestException('User Email already exists');
                }
            }


            return await this._db.$transaction(async (prisma) => {
                // Step 1: Update user and fetch current relations in parallel
                const [updatedUser, prevCompanies, prevBranches, prevRolesRaw] = await Promise.all([
                    prisma.userMaster.update({
                        where: { UserMasterSid },
                        data: { ...userPayload, updatedBy, updatedOn: new Date() },
                        omit: { userPassword: true }
                    }),
                    prisma.userCompanyMaster.findMany({
                        where: { UserMasterSid, status: 'A' },
                    }),
                    prisma.userBranchMaster.findMany({
                        where: { UserMasterSid, status: 'A' },
                    }),
                    prisma.userRoleMaster.findMany({
                        where: { UserMasterSid, status: 'A' },
                        include: { userCompanyMaster: true },
                    }),
                ]);

                await prisma.$executeRaw`
                    UPDATE "UserMaster"
                    SET "AttemptDateTime" = ${this.parseAttemptDateTime(AttemptDateTime)}
                    WHERE "UserMasterSid" = ${UserMasterSid}
                `;

                // Normalize previous roles with company info
                const prevRoles = prevRolesRaw
                    .filter((r) => r.userCompanyMaster?.CompanyMasterSid != null)
                    .map((r) => ({
                        UserRoleMasterSid: r.UserRoleMasterSid,
                        CompanyMasterSid: r.userCompanyMaster!.CompanyMasterSid,
                        RoleMasterSid: r.RoleMasterSid,
                        GiveAccess: r.GiveAccess,
                        IsDefault: r.IsDefault,
                        status: r.status,
                        Remarks: r.Remarks,
                        MenuMasterSid: r.MenuMasterSid,
                    }));

                /*
                 * =========================
                 *  COMPANIES SYNC
                 * =========================
                 */
                const newCompanyIds = new Set(userCompanyMaster.map((c) => c.CompanyMasterSid));
                const prevCompanyIds = new Set(prevCompanies.map((c) => c.CompanyMasterSid));

                const companiesToDelete = prevCompanies.filter((c) => !newCompanyIds.has(c.CompanyMasterSid));
                const companiesToInsert = userCompanyMaster.filter((c) => !prevCompanyIds.has(c.CompanyMasterSid));
                const companiesToUpdate = userCompanyMaster.filter((c) => prevCompanyIds.has(c.CompanyMasterSid));

                const companyOps: Promise<any>[] = [];

                // DELETE Companies + Cascade to Roles & Branches
                if (companiesToDelete.length > 0) {
                    const deleteUCompanySids = companiesToDelete.map((c) => c.UserCompanyMasterSid);
                    const deleteCompanyIds = companiesToDelete.map((c) => c.CompanyMasterSid);

                    companyOps.push(
                        prisma.userCompanyMaster.updateMany({
                            where: { UserCompanyMasterSid: { in: deleteUCompanySids } },
                            data: { status: 'D', updatedBy, updatedOn: new Date() },
                        }),
                        prisma.userRoleMaster.updateMany({
                            where: { UserCompanyMasterSid: { in: deleteUCompanySids }, status: 'A' },
                            data: { status: 'D', updatedBy, updatedOn: new Date() },
                        }),
                        prisma.userBranchMaster.updateMany({
                            where: {
                                UserMasterSid,
                                CompanyMasterSid: { in: deleteCompanyIds },
                                status: 'A',
                            },
                            data: { status: 'D', updatedBy, updatedOn: new Date() },
                        })
                    );
                }

                // INSERT Companies
                if (companiesToInsert.length > 0) {
                    companyOps.push(
                        prisma.userCompanyMaster.createMany({
                            data: companiesToInsert.map((c) => ({
                                UserMasterSid,
                                CompanyMasterSid: c.CompanyMasterSid,
                                createdBy: updatedBy,
                                GiveAccess: c.GiveAccess,
                                IsDefault: c.IsDefault,
                                status: 'A',
                            })),
                        })
                    );
                }

                // UPDATE Companies (only if changed)
                companiesToUpdate.forEach((c) => {
                    const existing = prevCompanies.find((pc) => pc.CompanyMasterSid === c.CompanyMasterSid);
                    if (existing && (existing.GiveAccess !== c.GiveAccess || existing.IsDefault !== c.IsDefault)) {
                        companyOps.push(
                            prisma.userCompanyMaster.update({
                                where: { UserCompanyMasterSid: existing.UserCompanyMasterSid },
                                data: { GiveAccess: c.GiveAccess, IsDefault: c.IsDefault, updatedBy, updatedOn: new Date() },
                            })
                        );
                    }
                });

                await Promise.all(companyOps);

                // Refresh company mapping
                const currentCompanies = await prisma.userCompanyMaster.findMany({
                    where: { UserMasterSid, status: 'A' },
                });
                const companySidMap = new Map(
                    currentCompanies.map((uc) => [uc.CompanyMasterSid, uc.UserCompanyMasterSid])
                );

                /*
                 * =========================
                 *  ROLES SYNC (Company + Role based)
                 * =========================
                 */
                const newRoles = userCompanyMaster.flatMap((company) =>
                    (company.userRoleMaster || []).map((r) => ({
                        CompanyMasterSid: company.CompanyMasterSid,
                        RoleMasterSid: r.RoleMasterSid,
                        GiveAccess: r.GiveAccess,
                        IsDefault: r.IsDefault,
                        status: r.status,
                        Remarks: r.Remarks,
                        MenuMasterSid: r.MenuMasterSid,
                    }))
                );

                const getRoleKey = (r: { CompanyMasterSid: number; RoleMasterSid: number }) =>
                    `${r.CompanyMasterSid}-${r.RoleMasterSid}`;

                const newRoleKeySet = new Set(newRoles.map(getRoleKey));
                const prevRoleKeySet = new Set(prevRoles.map(getRoleKey));

                const rolesToDelete = prevRoles.filter((r) => !newRoleKeySet.has(getRoleKey(r)));
                const rolesToInsert = newRoles.filter((r) => !prevRoleKeySet.has(getRoleKey(r)));
                const rolesToUpdate = newRoles.filter((r) => prevRoleKeySet.has(getRoleKey(r)));

                const roleOps: Promise<any>[] = [];

                // DELETE Roles
                if (rolesToDelete.length > 0) {
                    roleOps.push(
                        prisma.userRoleMaster.updateMany({
                            where: { UserRoleMasterSid: { in: rolesToDelete.map((r) => r.UserRoleMasterSid) } },
                            data: { status: 'D', updatedBy, updatedOn: new Date() },
                        })
                    );
                }

                // INSERT Roles
                if (rolesToInsert.length > 0) {
                    const roleCreateData = rolesToInsert
                        .map((r) => {
                            const ucSid = companySidMap.get(r.CompanyMasterSid);
                            if (!ucSid) return null;
                            return {
                                UserMasterSid,
                                RoleMasterSid: r.RoleMasterSid,
                                UserCompanyMasterSid: ucSid,
                                GiveAccess: r.GiveAccess,
                                IsDefault: r.IsDefault,
                                status: r.status ?? 'A',
                                Remarks: r.Remarks,
                                MenuMasterSid: r.MenuMasterSid,
                                createdBy: updatedBy,
                            };
                        })
                        .filter(Boolean);

                    if (roleCreateData.length > 0) {
                        roleOps.push(prisma.userRoleMaster.createMany({ data: roleCreateData as any }));
                    }
                }

                // UPDATE Roles (only if changed)
                rolesToUpdate.forEach((r) => {
                    const existing = prevRoles.find(
                        (pr) => pr.CompanyMasterSid === r.CompanyMasterSid && pr.RoleMasterSid === r.RoleMasterSid
                    );
                    if (!existing) return;

                    const hasChange =
                        existing.GiveAccess !== r.GiveAccess ||
                        existing.IsDefault !== r.IsDefault ||
                        existing.status !== r.status ||
                        existing.Remarks !== r.Remarks ||
                        existing.MenuMasterSid !== r.MenuMasterSid;

                    if (hasChange) {
                        roleOps.push(
                            prisma.userRoleMaster.update({
                                where: { UserRoleMasterSid: existing.UserRoleMasterSid },
                                data: {
                                    GiveAccess: r.GiveAccess,
                                    IsDefault: r.IsDefault,
                                    status: r.status,
                                    Remarks: r.Remarks,
                                    MenuMasterSid: r.MenuMasterSid,
                                    updatedBy,
                                    updatedOn: new Date()
                                },
                            })
                        );
                    }
                });

                await Promise.all(roleOps);

                /*
                 * =========================
                 *  BRANCHES SYNC
                 * =========================
                 */
                const newBranches = userCompanyMaster.flatMap((company) =>
                    (company.userBranchMaster || []).map((b) => ({
                        CompanyMasterSid: b.CompanyMasterSid,
                        BranchMasterSid: b.BranchMasterSid,
                        GiveAccess: b.GiveAccess,
                        IsDefault: b.IsDefault,
                        CostRevenueAccess: b.CostRevenueAccess,
                    }))
                );

                const getBranchKey = (b: { CompanyMasterSid: number; BranchMasterSid: number }) =>
                    `${b.CompanyMasterSid}-${b.BranchMasterSid}`;

                const newBranchKeySet = new Set(newBranches.map(getBranchKey));
                const prevBranchKeySet = new Set(prevBranches.map(getBranchKey));

                const branchesToDelete = prevBranches.filter((b) => !newBranchKeySet.has(getBranchKey(b)));
                const branchesToInsert = newBranches.filter((b) => !prevBranchKeySet.has(getBranchKey(b)));
                const branchesToUpdate = newBranches.filter((b) => prevBranchKeySet.has(getBranchKey(b)));

                const branchOps: Promise<any>[] = [];

                // DELETE Branches
                if (branchesToDelete.length > 0) {
                    branchOps.push(
                        prisma.userBranchMaster.updateMany({
                            where: { UserBranchMasterSid: { in: branchesToDelete.map((b) => b.UserBranchMasterSid) } },
                            data: { status: 'D', updatedBy , updatedOn: new Date() },
                        })
                    );
                }

                // INSERT Branches
                if (branchesToInsert.length > 0) {
                    branchOps.push(
                        prisma.userBranchMaster.createMany({
                            data: branchesToInsert.map((b) => ({
                                UserMasterSid,
                                CompanyMasterSid: b.CompanyMasterSid,
                                BranchMasterSid: b.BranchMasterSid,
                                GiveAccess: b.GiveAccess,
                                IsDefault: b.IsDefault,
                                CostRevenueAccess: b.CostRevenueAccess ?? 'NONE',
                                status: 'A',
                                createdBy: updatedBy,
                            })),
                        })
                    );
                }

                // UPDATE Branches (only if changed)
                branchesToUpdate.forEach((b) => {
                    const existing = prevBranches.find(
                        (pb) => pb.CompanyMasterSid === b.CompanyMasterSid && pb.BranchMasterSid === b.BranchMasterSid
                    );
                    if (existing && (existing.GiveAccess !== b.GiveAccess || existing.IsDefault !== b.IsDefault || existing.CostRevenueAccess !== b.CostRevenueAccess)) {
                        branchOps.push(
                            prisma.userBranchMaster.update({
                                where: { UserBranchMasterSid: existing.UserBranchMasterSid },
                                data: { GiveAccess: b.GiveAccess, IsDefault: b.IsDefault, CostRevenueAccess: b.CostRevenueAccess, updatedBy , updatedOn: new Date() },
                            })
                        );
                    }
                });

                await Promise.all(branchOps);

                return {
                    message: 'User updated successfully',
                    data: {
                        user: updatedUser,
                        summary: {
                            companies: {
                                created: companiesToInsert.length,
                                updated: companiesToUpdate.length,
                                deleted: companiesToDelete.length,
                            },
                            roles: {
                                created: rolesToInsert.length,
                                updated: rolesToUpdate.length,
                                deleted: rolesToDelete.length,
                            },
                            branches: {
                                created: branchesToInsert.length,
                                updated: branchesToUpdate.length,
                                deleted: branchesToDelete.length,
                            },
                        },
                    },
                };
            });
        } catch (error: any) {
            console.error('User Update Error:', error);
            if (error instanceof NotFoundException || error instanceof BadRequestException) {
                throw error;
            }
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
        const { search = '', page = 1, pageSize = 15, activeCompanyId } = params;
        const skip = (page - 1) * pageSize;

        // A user belongs to the active company's list if EITHER:
        //  - they have company access for the active company (login-user flow, unchanged), OR
        //  - they are a salesman whose SalesCompany includes the active company
        //    (covers non-login salesmen that have no userCompanyMaster rows).
        // Only scope when a company is actually supplied: `has` cannot take undefined,
        // and an absent company previously meant "unscoped".
        const activeCompanySid = Number(activeCompanyId);
        const companyScopeFilter: Prisma.UserMasterWhereInput[] = Number.isFinite(activeCompanySid)
            ? [{
                OR: [
                    {
                        userCompanyMaster: {
                            some: {
                                CompanyMasterSid: activeCompanySid,
                                status: statusWhereClause
                            }
                        }
                    },
                    {
                        SalesCompany: { has: activeCompanySid }
                    }
                ],
            }]
            : [];

        const where: Prisma.UserMasterWhereInput = {
            status: statusWhereClause,
            AND: [
                ...companyScopeFilter,
                ...(search
                    ? [{
                        OR: [
                            { userName: { contains: search, mode: 'insensitive' } },
                            { userEmail: { contains: search, mode: 'insensitive' } },
                            { isSalesperson: { contains: search, mode: 'insensitive' } },
                        ],
                    } as Prisma.UserMasterWhereInput]
                    : []
                ),
            ],
        };

        const [items, totalCount] = await this._db.$transaction([
            this._db.userMaster.findMany({
                where,
                omit : { userPassword : true},
                skip,
                take: pageSize,
                orderBy: { UserMasterSid: 'desc' },
            }),
            this._db.userMaster.count({ where }),
        ]);

        // Resolve SalesCompany ids -> company names so the list can display them.
        // Only salesperson-ticked users have SalesCompany populated; others stay blank.
        const salesCompanyIds = [
            ...new Set(items.flatMap((user) => user.SalesCompany || [])),
        ];

        const companyNameMap = new Map<number, string>();
        if (salesCompanyIds.length > 0) {
            const companies = await this._db.companyMaster.findMany({
                where: { CompanyMasterSid: { in: salesCompanyIds } },
                select: { CompanyMasterSid: true, companyName: true },
            });
            companies.forEach((company) =>
                companyNameMap.set(company.CompanyMasterSid, company.companyName),
            );
        }

        const itemsWithSalesCompany = items.map((user) => ({
            ...user,
            salesCompany: (user.SalesCompany || [])
                .map((id) => companyNameMap.get(id))
                .filter(Boolean)
                .join(', '),
        }));

        return {
            items: itemsWithSalesCompany,
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

    async getAllDocs(CompanyMasterSid: number) {
        try {
            const allDocs = await this._db.userMaster.findMany({
                where: {
                    userType: { code: "docPerson" },
                    status: 'A',
                    userCompanyMaster: {
                        some: {
                            CompanyMasterSid: CompanyMasterSid,
                            GiveAccess: 'Y',
                            status: 'A'
                        }
                    }
                },
                omit: {
                    userPassword: true
                }
            })
            return allDocs;
        } catch (error) {
            throw error;
        }
    }

    async getAllCS(CompanyMasterSid: number) {
        try {
            const allDocs = await this._db.userMaster.findMany({
                where: {
                    userType: { code: "csPerson" },
                    status: 'A',
                    userCompanyMaster: {
                        some: {
                            CompanyMasterSid: CompanyMasterSid,
                            GiveAccess: 'Y',
                            status: 'A'
                        }
                    }
                },
                omit: {
                    userPassword: true
                }
            })
            return allDocs;
        } catch (error) {
            throw error;
        }
    }

    async getRoleDetailsForCompany(CompanyMasterSid: number | number[]) {
        try {

            const roles = await this._db.roleMaster.findMany({
                where: {
                    CompanyMasterSid: Array.isArray(CompanyMasterSid)
                        ? { in: CompanyMasterSid }
                        : CompanyMasterSid,
                    status: 'A'
                },
                include: {
                    RoleMenuHeader: {
                        where: { status: 'A' },
                        include: {
                            RoleMenuDetail: {
                                where: { status: 'A' },
                                select: {
                                    menuMaster: {
                                        select: {
                                            ModuleName: true
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            });

            const result = roles.filter(role => role.RoleMenuHeader.length > 0).map(role => {
                const header = role.RoleMenuHeader[0]; // Only one header per role

                const moduleSet = new Set<string>();

                if (header) {
                    header.RoleMenuDetail.forEach(detail => {
                        const name = detail.menuMaster?.ModuleName;
                        if (name) moduleSet.add(name);
                    });
                }

                return {
                    RoleMasterSid: role.RoleMasterSid,
                    UserRoleName: role.UserRoleName,
                    CompanyMasterSid: role.CompanyMasterSid,
                    ModuleInvolved: [...moduleSet]
                };
            });

            return result;

        } catch (error) {
            throw error;
        }
    }

    async getUserBasedOnUserType(userType: string) {
        try {
            if (!(userType in UserTypeCode)) {
                throw new BadRequestException(`Invalid userType '${userType}'. Expected one of: ${Object.keys(UserTypeCode).join(', ')}`);
            }

            const allDocs = await this._db.userMaster.findMany({
                where: {
                    userType: { code: UserTypeCode[userType] },
                    status: 'A',
                },
                omit: {
                    userPassword: true
                }
            })
            return allDocs;
        } catch (error) {
            throw error;
        }
    }

    async getAllFfUserByCompany(companyId: number) {
        try {
            return await this._db.userMaster.findMany({
                where: {
                    status: 'A',
                    userCompanyMaster: {
                        some: { CompanyMasterSid: companyId, GiveAccess: 'Y', status: 'A' }
                    }
                },
                omit: { userPassword: true }
            });
        } catch (error) {
            throw error;
        }
    }

    async getUsersByRole(companyMasterSid: number, roleMasterSid: number) {
        return this._db.userRoleMaster.findMany({
            where: {
                RoleMasterSid: roleMasterSid,
                status: 'A',
                userCompanyMaster: {
                    CompanyMasterSid: companyMasterSid,
                },
            },
            select: {
                userCompanyMaster: {
                    select: {
                        userMaster: {
                            select: {
                                UserMasterSid: true,
                                userName: true,
                                status: true,
                            },
                        },
                    },
                },
            },
        });
    }

    async getAllSalesperson(CompanyMasterSid: number) {
        try {
            const allSalespersons = await this._db.userMaster.findMany({
                where: {
                    status: 'A',
                    isSalesperson: '1',
                    SalesCompany: { has: CompanyMasterSid },
                    // userCompanyMaster: {
                    //     some: {
                    //         CompanyMasterSid: CompanyMasterSid,
                    //         GiveAccess: 'Y',
                    //         status: 'A'
                    //     }
                    // }
                },
                omit: {
                    userPassword: true
                }
            })
            return allSalespersons;
        } catch (error) {
            throw error;
        }
    }

}
