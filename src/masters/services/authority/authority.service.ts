import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { GlobalConfigService } from 'src/common/config/master-config.service';
import { parseDateFromString, statusWhereClause } from 'src/common/helper';
import { DatabaseService } from 'src/database/database.service';
import { SearchListDto } from 'src/masters/DTO/search-list.dto';
import { filterDto } from 'src/masters/DTO/search-vessel.dto';

@Injectable()
export class AuthorityService {
    constructor(private _db: DatabaseService, private globalConfigService: GlobalConfigService, private logger: Logger) { }

    async getAllAuthorities() {
        try {
            const allAuthorities = await this._db.authorityMaster.findMany({
                where: {
                    status: 'A'
                },
                include: {
                    branchMaster: true,
                    companyMaster: true,
                    menuMaster: true,
                    authorityDetail: {
                        where: {
                            status: 'A'
                        },
                        include: {
                            userMaster: true
                        }
                    }
                },
                orderBy: {
                    updatedOn: 'desc'
                }
            });
            return allAuthorities;
        } catch (error) {
            throw error;
        }
    }

    async createNewAuthority(payload: any) {
        try {
            if (!payload.authDetails || payload.authDetails.length === 0) {
                throw new BadRequestException('At least one authority detail is required');
            }
            const { authDetails, authorityDetails, ...masterData } = payload;
            const existing = await this._db.authorityMaster.findFirst({
                where: {
                    CompanyMasterSid: masterData.CompanyMasterSid,
                    BranchMasterSid: masterData.BranchMasterSid,
                    MenuMaster: parseInt(masterData.MenuMaster),
                    status: 'A'
                }
            });

            if (existing) {
                throw new BadRequestException('An authorization has been already set for this menu.');
            }

            return await this._db.$transaction(async (prisma) => {

                const createdMaster = await prisma.authorityMaster.create({
                    data: {
                        BranchMasterSid: masterData.BranchMasterSid,
                        CompanyMasterSid: masterData.CompanyMasterSid,
                        DepartmentMaster: masterData.DepartmentMaster,
                        MenuMaster: parseInt(masterData.MenuMaster),
                        status: masterData.status || 'A',
                        Remarks: masterData.Remarks || '',
                        createdBy: masterData.createdBy,
                    },
                });

                const createdDetails = await Promise.all(
                    authDetails.map(detail =>
                        prisma.authorityDetail.create({
                            data: {
                                AuthorityMasterSid: createdMaster.AuthorityMasterSid,
                                CompanyMasterSid: createdMaster.CompanyMasterSid,
                                BranchMasterSid: createdMaster.BranchMasterSid,
                                UserMasterSid: parseInt(detail.UserMasterSid),
                                AuthorityLevel: parseInt(detail.AuthorityLevel),
                                FinalAuthority: detail.FinalAuthority,
                                status: detail.status || 'A',
                                Remarks: detail.Remarks || '',
                                createdBy: masterData.createdBy,
                                updatedBy: detail.updatedBy || masterData.createdBy,
                            },
                        })
                    ),
                );

                return {
                    authority: createdMaster,
                    authorityDetails: createdDetails,
                };
            });
        } catch (error) {
            console.error('Transaction failed:', error);
            throw error;
        }
    }

    async fetchAuthorityById(AuthorityMasterSid: number) {
        try {
            const authority = await this._db.authorityMaster.findUnique({
                where: {
                    AuthorityMasterSid: AuthorityMasterSid
                },
                include: {
                    authorityDetail: {
                        where: {
                            status: 'A'
                        },

                    }
                }
            });
            if (!authority) {
                throw new BadRequestException(`Authority with Id : ${AuthorityMasterSid} not exists`);
            }
            return authority;
        } catch (error) {
            throw error;
        }
    }

    async updateAuthorityById(AuthorityMasterSid: number, payload: any) {
        try {
            const exist = await this._db.authorityMaster.findUnique({
                where: { AuthorityMasterSid },
            });

            if (!exist) {
                throw new BadRequestException(`Authority with Id: ${AuthorityMasterSid} does not exist`);
            }
            const {
                DepartmentMaster,
                MenuMaster,
                BranchMasterSid,
                CompanyMasterSid,
                status,
                Remarks,
                authDetails = [],
                updatedBy,
            } = payload;

            const existing = await this._db.authorityMaster.findFirst({
                where: {
                    AuthorityMasterSid: { not: AuthorityMasterSid },
                    CompanyMasterSid: CompanyMasterSid,
                    BranchMasterSid: BranchMasterSid,
                    MenuMaster: parseInt(MenuMaster),
                    status: 'A'
                }
            });

            if (existing) {
                throw new BadRequestException('An authorization has been already set for this menu.');
            }

            const updated = await this._db.$transaction(async (tx) => {


                if (!authDetails || authDetails.length === 0) {
                    throw new BadRequestException('At least one authority detail is required');
                }

                // Update authority master
                const authority = await tx.authorityMaster.update({
                    where: { AuthorityMasterSid },
                    data: {
                        DepartmentMaster: DepartmentMaster,
                        MenuMaster: parseInt(MenuMaster),
                        BranchMasterSid,
                        CompanyMasterSid,
                        status: status || 'A',
                        Remarks: Remarks || '',
                        updatedBy: updatedBy || null,
                        updatedOn: new Date(),
                    },
                });

                const allAuthDetails: any[] = payload.authDetails || [];
                let finalDetails: any[] = [];
                for (const authDetail of allAuthDetails) {
                    let existingDetails;
                    let newlyCreatedDetail;
                    if (authDetail.AuthorityDetailSid) {
                        existingDetails = await tx.authorityDetail.update({
                            where: {
                                AuthorityDetailSid: authDetail.AuthorityDetailSid
                            },
                            data: {
                                UserMasterSid: parseInt(authDetail.UserMasterSid),
                                AuthorityLevel: parseInt(authDetail.AuthorityLevel),
                                FinalAuthority: authDetail.FinalAuthority,
                                status: authDetail.status || 'A',
                                Remarks: authDetail.Remarks || '',
                                updatedBy: updatedBy,
                                updatedOn: new Date(),
                            },
                        });
                    } else {
                        newlyCreatedDetail = await tx.authorityDetail.create({
                            data: {
                                AuthorityMasterSid,
                                CompanyMasterSid: authority.CompanyMasterSid,
                                BranchMasterSid: authority.BranchMasterSid,
                                UserMasterSid: parseInt(authDetail.UserMasterSid),
                                AuthorityLevel: parseInt(authDetail.AuthorityLevel),
                                FinalAuthority: authDetail.FinalAuthority,
                                status: authDetail.status || 'A',
                                Remarks: authDetail.Remarks || '',
                                createdBy: updatedBy || '',
                                updatedBy: updatedBy || '',
                            },
                        });
                    }
                    finalDetails.push(existingDetails || newlyCreatedDetail);
                }


                return {
                    authority,
                    authorityDetails: finalDetails,
                };
            });

            return updated;
        } catch (error) {
            console.error('Update Authority Failed:', error);
            throw error;
        }
    }

    async deleteAuthority(AuthorityMasterSid: number) {
        try {
            const exist = await this._db.authorityMaster.findUnique({
                where: { AuthorityMasterSid }
            });
            if (!exist) {
                throw new BadRequestException(`Authority with Id : ${AuthorityMasterSid} not exists`);
            }
            if (exist.status === 'D') {
                throw new BadRequestException(`Authority with Id :${AuthorityMasterSid} is already deleted`)
            }

            await this._db.$transaction(async (tx) => {
                // Soft delete all related authority details first
                await tx.authorityDetail.updateMany({
                    where: { AuthorityMasterSid },
                    data: { status: 'D' }
                });

                // Then soft delete the authority master
                await tx.authorityMaster.update({
                    where: { AuthorityMasterSid },
                    data: { status: 'D' }
                });
            });

            return { status: true, message: 'Authority deleted successfully' };
        } catch (error) {
            throw error;
        }
    }

    async newSearchAuthority(param: filterDto) {
        const { search = '', page = 1, pageSize = 15 } = param;
        const skip = (page - 1) * pageSize;

        const where: Prisma.AuthorityMasterWhereInput = {
            status: statusWhereClause,
            ...(search ? {
                OR: [
                    { DepartmentMaster: { has: search } },
                    { menuMaster: { MenuName: { contains: search, mode: 'insensitive' } } },
                    { branchMaster: { branchName: { contains: search, mode: 'insensitive' } } },
                ]
            } : {})
        }

        let items;
        let totalCount;
        [items, totalCount] = await this._db.$transaction([
            this._db.authorityMaster.findMany({
                where: where,
                take: pageSize,
                skip: skip,
                orderBy: { AuthorityMasterSid: 'desc' }
            }),
            this._db.authorityMaster.count({
                where: where
            })
        ])

        items = await Promise.all(
            items.map(async (item) => {
                const [branchMaster, menuMaster] = await Promise.all([
                    item.BranchMasterSid !== null ?
                        this.globalConfigService.getMasterData('branch_master', item.BranchMasterSid, item.CompanyMasterSid) :
                        { BranchMasterSid: null, branchName: '' },

                    item.MenuMasterSid !== null ?
                        this.globalConfigService.getMasterData('menu_master', item.MenuMaster) :
                        { MenuMasterSid: null, MenuName: '' }
                ])
                return {
                    ...item,
                    branchMaster,
                    menuMaster
                }
            })
        )
        return {
            items,
            totalCount
        }
    }

    async searchAuthority(data: SearchListDto) {
        const { searchType, filterValue } = data;
        const intFields = [
            'AuthorityMasterSid',
            'CompanyMasterSid',
            'BranchMasterSid',
            'MenuMaster'
        ];
        const stringFields = [
            'DepartmentMaster',
            'createdBy',
            'updatedBy',
            'status',
            'Remarks'
        ];
        const acceptedType = [...intFields, ...stringFields];
        if (!acceptedType.includes(searchType)) {
            throw new BadRequestException('Invalid Search Type');
        }

        const whereClause: any = { status: statusWhereClause };

        if (searchType === 'DepartmentMaster') {
            whereClause[searchType] = { has: filterValue };
        } else if (stringFields.includes(searchType)) {
            whereClause[searchType] = {
                contains: filterValue,
                mode: 'insensitive'
            };
        } else if (intFields.includes(searchType)) {
            const numberValue = parseInt(filterValue);
            if (isNaN(numberValue)) {
                throw new BadRequestException(`${searchType} must be a valid number`);
            }
            whereClause[searchType] = numberValue;
        }

        return await this._db.authorityMaster.findMany({
            where: whereClause,
            include: {
                branchMaster: true,
                companyMaster: true,
                menuMaster: true,
                authorityDetail: {
                    where: { status: statusWhereClause },
                    include: { userMaster: true }
                }
            },
            orderBy: { updatedOn: 'desc' }
        });
    }

    async searchDocAuthorization(param: filterDto, UserMasterSid: number) {
        const { search = "", page = 1, pageSize = 15, activeCompanyId, activeBranchId } = param;
        const skip = (page - 1) * pageSize;
        const parsedDate = parseDateFromString(search);

        const authorityDetails = await this._db.authorityDetail.findMany({
            where: {
                CompanyMasterSid: activeCompanyId,
                BranchMasterSid: activeBranchId,
                UserMasterSid,
                status: statusWhereClause
            },
            select: {
                AuthorityDetailSid: true,
                authorityMaster: {
                    where: {
                        status: statusWhereClause,
                        CompanyMasterSid: activeCompanyId,
                        BranchMasterSid: activeBranchId
                    },
                    include: {
                        menuMaster: {
                            select: {
                                MenuMasterSid: true,
                                MenuName: true,
                                menuConfig: {
                                    select: {
                                        ModelName: true,
                                        PrimaryKey: true,
                                        LinkPattern: true
                                    }
                                }
                            }
                        }
                    }
                }
            }
        });

        const menuSidToName = new Map<number, string>();
        const authorityDetailMap = new Map<number, number>();

        authorityDetails.forEach(({ AuthorityDetailSid, authorityMaster }) => {
            const menu = authorityMaster?.menuMaster;
            if (menu) {
                menuSidToName.set(menu.MenuMasterSid, menu.MenuName);
                authorityDetailMap.set(menu.MenuMasterSid, AuthorityDetailSid);
            }
        });


        const allPendingResults: any[] = [];

        for (const [menuSid, authorityDetailSid] of authorityDetailMap.entries()) {

            const menuData = authorityDetails.find(ad =>
                ad.authorityMaster?.menuMaster?.MenuMasterSid === menuSid
            )?.authorityMaster?.menuMaster;

            if (!menuData?.menuConfig) continue;
            const config = menuData.menuConfig[0];
            const model = config?.ModelName!;
            const primaryKey = config?.PrimaryKey!;


            const prismaModel = (this._db as any)[model];
            if (!prismaModel) continue;

            // Build where clause dynamically
            const whereClause: any = { authorizerStatus: "Pending", status: statusWhereClause };

            if (search) {
                whereClause.OR = [
                    { CustomerName: { contains: search, mode: 'insensitive' } }
                ];

                if (model === 'quoteHeader') {
                    whereClause.OR.push({
                        QuoteNumber: { contains: search, mode: 'insensitive' }
                    });
                } else if (model === 'enquiryHeader') {
                    whereClause.OR.push({
                        EnquiryNumber: { contains: search, mode: 'insensitive' }
                    });
                }
            }

            if (parsedDate) {
                if (model === 'quoteHeader') {
                    whereClause.QuoteDate = { equals: parsedDate };
                } else if (model === 'enquiryHeader') {
                    whereClause.EnquiryDate = { equals: parsedDate };
                }
            }

            const data = await prismaModel.findMany({ where: whereClause });
            const docSids = data.map((d: any) => d[primaryKey]);
            if (docSids.length === 0) continue;

            const authorizedDocs = await this._db.authorityLog.findMany({
                where: {
                    AuthorityDetailSid: authorityDetailSid,
                    // checking with DetailSid also confirms user
                    DocumentSid: { in: docSids }
                },
                select: { DocumentSid: true }
            });
            const authorizedSidSet = new Set(authorizedDocs.map(d => d.DocumentSid));

            const pendingData = data.filter((d: any) => !authorizedSidSet.has(d[primaryKey]));

            const menuName = menuSidToName.get(menuSid) || "Unknown";

            pendingData.forEach((item: any) => {
                const authorizeLink = config.LinkPattern
                    ? config.LinkPattern.replace('{id}', item[primaryKey])
                    : `${menuName.toLowerCase()}/entry/${item[primaryKey]}`;

                allPendingResults.push({
                    DocumentName: menuName,
                    DocumentNo: item.EnquiryNumber || item.QuoteNumber || '',
                    CreatedBy: item.CustomerName || '',
                    CreatedOn: item.EnquiryDate || item.QuoteDate || null,
                    AuthorizeStatus: 'Waiting for approval',
                    authorizeLink,
                    menuSid
                });
            });
        }


        const filteredResults = search
            ? allPendingResults.filter(item => {
                const searchLower = search.toLowerCase();
                const matchDate = parsedDate && item.CreatedOn
                    ? new Date(item.CreatedOn).toDateString() === parsedDate.toDateString()
                    : false;

                return (
                    matchDate ||
                    item.DocumentName.toLowerCase().includes(searchLower) ||
                    item.DocumentNo.toLowerCase().includes(searchLower) ||
                    item.CreatedBy.toLowerCase().includes(searchLower) ||
                    item.AuthorizeStatus.toLowerCase().includes(searchLower)
                );
            })
            : allPendingResults;

        const sortedResults = filteredResults.sort((a, b) => {
            const dateA = a.CreatedOn ? new Date(a.CreatedOn).getTime() : 0;
            const dateB = b.CreatedOn ? new Date(b.CreatedOn).getTime() : 0;
            return dateB - dateA;
        });

        const totalCount = sortedResults.length;
        const paginatedResults = sortedResults.slice(skip, skip + pageSize);

        return { items: paginatedResults, totalCount };
    }


    async isUserAuthorizer(payload: any) {
        const authorizer = await this._db.authorityDetail.findFirst({
            where: {
                UserMasterSid: payload.UserMasterSid,
                CompanyMasterSid: payload.CompanyMasterSid,
                BranchMasterSid: payload.BranchMasterSid,
                status: 'A',
                authorityMaster: {
                    status: 'A',
                    MenuMaster: payload.MenuMasterSid,
                    CompanyMasterSid: payload.CompanyMasterSid,
                    BranchMasterSid: payload.BranchMasterSid
                }
            },
            select: {
                AuthorityDetailSid: true,
                AuthorityLevel: true,
            }
        });

        if (!authorizer) {
            return { 
                canAuthorize: false, 
                alreadyApproved: false,
                AuthorityDetailSid : null,
                AuthorityLevel : null,
                message: "User is not an authorizer for this menu." 
            };
        }

        // 2. Check if user already authorized the document
        const alreadyAuthorized = await this._db.authorityLog.findFirst({
            where: {
                AuthorityDetailSid: authorizer.AuthorityDetailSid,
                DocumentSid: payload.DocumentSid,
                Status: 'A'
            },
            select: {
                AuthorityLogSid: true
            }
        });

        if (alreadyAuthorized) {
            return { 
                canAuthorize: true, 
                alreadyApproved: true, 
                AuthorityDetailSid: authorizer.AuthorityDetailSid,
                AuthorityLevel: authorizer.AuthorityLevel,
                message: "User has already authorized this document." 
            };
        }

        return {
            canAuthorize: true,
            alreadyApproved: false,
            AuthorityDetailSid: authorizer.AuthorityDetailSid,
            AuthorityLevel: authorizer.AuthorityLevel,
            message: "User is a valid authorizer for this menu."
        };
    }


    async getApprovalStatusData(menuMasterSid: number, documentSid: number) {
        // 1. Fetch authority users for the given menu
        const authorityUsers = await this._db.authorityDetail.findMany({
            where: {
                CompanyMasterSid: 7,
                BranchMasterSid: 50,
                status: 'A',
                authorityMaster: {
                    CompanyMasterSid: 7,
                    BranchMasterSid: 50,
                    MenuMaster: menuMasterSid,
                    status: 'A',
                },
            },
            include: {
                userMaster: {
                    select: { userName: true },
                },
            },
            orderBy: {
                AuthorityLevel: 'asc',
            },
        });

        console.log(authorityUsers);

        // 2. Fetch authority logs for this document
        const logs = await this._db.authorityLog.findMany({
            where: {
                DocumentSid: documentSid,
                Status: 'A',
                AuthorityDetail: {
                    status: 'A',
                    authorityMaster: {
                        MenuMaster: menuMasterSid,
                        status: 'A',
                    },
                },
            },
            include: {
                AuthorityDetail: {
                    include: {
                        userMaster: {
                            select: { userName: true },
                        },
                    },
                },
            },
        });

        // 3. Map logs by userName for quick lookup
        const logMap = new Map<string, any>();
        for (const log of logs) {
            const userName = log.AuthorityDetail?.userMaster?.userName;
            if (userName) {
                logMap.set(userName, log);
            }
        }

        // 4. Check if final-level authority has approved
        const finalAuthorityApproved = logs.some(log =>
            log.AuthorityDetail?.FinalAuthority === 'Y' &&
            log.ApprovalStatus === 'Approved'
        );

        // 5. Build full approval log
        const approvalLog = authorityUsers.map((detail, index) => {
            const userName = detail.userMaster?.userName || 'N/A';
            const log = logMap.get(userName);


            let baseItem;
            if (log) {
                baseItem = {
                    approvedBy: userName,
                    approvalStatus: log.ApprovalStatus,
                    approvalDate: log.AuthorisedDate,
                    Remarks: log.Remarks,
                };
            } else {
                baseItem = {
                    approvedBy: userName,
                    approvalStatus: 'Pending',
                    approvalDate: null,
                    Remarks: null,
                };
            }

            return baseItem;
        });


        for (let i = 0; i < approvalLog.length; i++) {
            if (approvalLog[i].approvalStatus === 'Rejected') {

                for (let j = i + 1; j < approvalLog.length; j++) {
                    approvalLog[j] = {
                        ...approvalLog[j],
                        approvalStatus: 'Rejected',
                        approvalDate: null,
                        Remarks: null,
                    };
                }
                break;
            }
        }


        const finalAuthorizerIndex = authorityUsers.findIndex(detail =>
            detail.FinalAuthority === 'Y'
        );

        if (finalAuthorizerIndex !== -1) {
            const finalAuthorizerStatus = approvalLog[finalAuthorizerIndex].approvalStatus;

            if (finalAuthorizerStatus === 'Approved' || finalAuthorizerStatus === 'Rejected') {
                for (let i = 0; i < finalAuthorizerIndex; i++) {
                    if (approvalLog[i].approvalStatus === 'Pending') {
                        approvalLog[i] = {
                            ...approvalLog[i],
                            approvalStatus: finalAuthorizerStatus,
                            approvalDate: approvalLog[finalAuthorizerIndex].approvalDate,
                            Remarks: 'Skipped - Final Authorizer directly approved',
                        };
                    }
                }
            }
        }



        // 6. Determine overall status
        const status = finalAuthorityApproved ? 'Approved' : 'Pending';

        return {
            logData: approvalLog,
            status,
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

}