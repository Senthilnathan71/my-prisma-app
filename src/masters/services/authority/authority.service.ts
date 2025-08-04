import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { GlobalConfigService } from 'src/common/config/master-config.service';
import { parseDateFromString } from 'src/common/helper';
import { DatabaseService } from 'src/database/database.service';
import { SearchListDto } from 'src/masters/DTO/search-list.dto';
import { SearchVesselDto } from 'src/masters/DTO/search-vessel.dto';

@Injectable()
export class AuthorityService {
    constructor(private _db: DatabaseService,private globalConfigService:GlobalConfigService) { }

    async getAllAuthorities() {
        try {
            const allAuthorities = await this._db.authorityMaster.findMany({
                where: {
                    deletedAt: null
                },
                include: {
                    branchMaster: true,
                    companyMaster: true,
                    menuMaster: true,
                    authorityDetail: {
                        where: {
                            deletedAt: null
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

            return await this._db.$transaction(async (prisma) => {
                const { authDetails, authorityDetails, ...masterData } = payload;

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
                            deletedAt: null
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

            const updated = await this._db.$transaction(async (tx) => {
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

                const existingDetails = await tx.authorityDetail.findMany({
                    where: {
                        AuthorityMasterSid,
                        deletedAt: null,
                    },
                });

                const detailsToDelete = existingDetails.filter(
                    ed => !authDetails.some(ad => ad.UserMasterSid === ed.UserMasterSid && ad.AuthorityLevel === ed.AuthorityLevel),
                );

                
                if (detailsToDelete.length) {
                    await tx.authorityDetail.updateMany({
                        where: {
                            AuthorityDetailSid: {
                                in: detailsToDelete.map(d => d.AuthorityDetailSid),
                            },
                        },
                        data: {
                            deletedAt: new Date(),
                            updatedBy: updatedBy,
                        },
                    });
                }

                
                const updatedDetails = await Promise.all(
                    authDetails.map(async detail => {
                        const existingDetail = existingDetails.find(
                            ed => ed.UserMasterSid === parseInt(detail.UserMasterSid) && ed.AuthorityLevel === parseInt(detail.AuthorityLevel),
                        );
                        if (existingDetail) {
                           
                            return await tx.authorityDetail.update({
                                where: { AuthorityDetailSid: existingDetail.AuthorityDetailSid },
                                data: {
                                    UserMasterSid: parseInt(detail.UserMasterSid),
                                    AuthorityLevel: parseInt(detail.AuthorityLevel),
                                    FinalAuthority: detail.FinalAuthority,
                                    status: detail.status || 'A',
                                    Remarks: detail.Remarks || '',
                                    updatedBy: updatedBy,
                                    updatedOn: new Date(),
                                },
                            });
                        } else {
                            
                            return await tx.authorityDetail.create({
                                data: {
                                    AuthorityMasterSid,
                                    CompanyMasterSid: authority.CompanyMasterSid,
                                    BranchMasterSid: authority.BranchMasterSid,
                                    UserMasterSid: parseInt(detail.UserMasterSid),
                                    AuthorityLevel: parseInt(detail.AuthorityLevel),
                                    FinalAuthority: detail.FinalAuthority,
                                    status: detail.status || 'A',
                                    Remarks: detail.Remarks || '',
                                    createdBy: updatedBy || '',
                                    updatedBy: updatedBy || '',
                                },
                            });
                        }
                    }),
                );

                return {
                    authority,
                    authorityDetails: updatedDetails,
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
            if (exist.deletedAt) {
                throw new BadRequestException(`Authority with Id :${AuthorityMasterSid} is already deleted`)
            }
            
            await this._db.$transaction(async (tx) => { 
                // Soft delete all related authority details first
                await tx.authorityDetail.updateMany({
                    where: { AuthorityMasterSid },
                    data: { deletedAt: new Date() }
                });
                
                // Then soft delete the authority master
                await tx.authorityMaster.update({
                    where: { AuthorityMasterSid },
                    data: { deletedAt: new Date() }
                });
            });

            return { status: true, message: 'Authority deleted successfully' };
        } catch (error) {
            throw error;
        }
    }

    async newSearchAuthority(param : SearchVesselDto){
        const {search ='', page = 1 , pageSize = 15 } = param;
        const skip = (page - 1) * pageSize;

        const where : Prisma.AuthorityMasterWhereInput = {
            deletedAt : null,
            status : 'A',
            ...(search ? {
                OR : [
                    { DepartmentMaster : {has : search}},
                    { menuMaster : { MenuName : { contains : search , mode : 'insensitive'}}},
                    { branchMaster : { branchName : { contains : search , mode : 'insensitive' }}},
                ]
            }:{})
        }

        let items;
        let totalCount;
        [items,totalCount] = await this._db.$transaction([
            this._db.authorityMaster.findMany({
                where : where,
                take : pageSize,
                skip : skip,
                orderBy : { AuthorityMasterSid : 'desc'}
            }),
            this._db.authorityMaster.count({
                where : where
            })
        ])
        
        items = await Promise.all(
            items.map(async (item)=>{
                const [branchMaster,menuMaster] = await Promise.all([
                    item.BranchMasterSid !== null ?
                    this.globalConfigService.getMasterData('branch_master',item.BranchMasterSid,item.CompanyMasterSid) :
                     {BranchMasterSid : null , branchName : ''},

                    item.MenuMasterSid !== null ?
                    this.globalConfigService.getMasterData('menu_master',item.MenuMaster) : 
                    {MenuMasterSid : null , MenuName : ''}
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

        const whereClause: any = { deletedAt: null };

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
                    where: { deletedAt: null },
                    include: { userMaster: true }
                }
            },
            orderBy: { updatedOn: 'desc' }
        });
    }

    async searchDocAuthorization(param: SearchVesselDto, UserMasterSid: number) {
        const { search = "", page = 1, pageSize = 15 } = param;
        const skip = (page - 1) * pageSize;

        const parsedDate = parseDateFromString(search);

        const allMenuAfflicatedWithUser = await this._db.authorityDetail.findMany({
            where: {
                UserMasterSid: UserMasterSid,
                deletedAt: null,
                status: 'A'
            },
            select: {
                authorityMaster: {
                    include: {
                        menuMaster: {
                            select: {
                                MenuMasterSid: true,
                                MenuName: true
                            }
                        }
                    }
                }
            }
        });

        const menuSidToName = new Map<number, string>();
        const allMenuSidsOfUser = new Set<number>();

        allMenuAfflicatedWithUser.forEach(detail => {
            const sid = detail.authorityMaster?.menuMaster?.MenuMasterSid;
            const name = detail.authorityMaster?.menuMaster?.MenuName;
            if (sid != null && name) {
                allMenuSidsOfUser.add(sid);
                menuSidToName.set(sid, name);
            }
        });



        const modelsForMenu: Record<string | number, { model: string; whereClause: any }> = {
            81 : {
                model: 'quoteHeader',
                whereClause: {
                    OR: [
                        { QuoteNumber: { contains: search, mode: 'insensitive' } },
                        ...(parsedDate ? [{ QuoteDate: { equals: parsedDate } }] : []),
                        { CustomerName: { contains: search, mode: 'insensitive' } }
                    ],
                    authorizerStatus: "Pending"
                }
            },
            82: {
                model: 'enquiryHeader',
                whereClause: {
                    OR: [
                        { EnquiryNumber: { contains: search, mode: 'insensitive' } },
                        { CustomerName: { contains: search, mode: 'insensitive' } },
                        ...(parsedDate ? [{ EnquiryDate: { equals: parsedDate } }] : [])
                    ],
                    authorizerStatus: "Pending"
                }
            }
        };

        const results: any[] = [];

        for (const menuSid of allMenuSidsOfUser) {
            const modelConfig = modelsForMenu[menuSid];
            if (!modelConfig) continue;

            const { model, whereClause } = modelConfig;
            const prismaModel = (this._db as any)[model];

            if (!prismaModel) {
                throw new Error(`Invalid Prisma model for MenuSid ${menuSid}`);
            }

            const data = await prismaModel.findMany({
                where: whereClause,
                skip,
                take: pageSize
            });

            const menuName = menuSidToName.get(menuSid) || "Unknown";
            const shouldIncludeByMenuName = !search || menuName.toLowerCase().includes(search.toLowerCase());
            if (!shouldIncludeByMenuName) continue;

            data.forEach(item => {
                let authorizeLink = '';

                if (menuSid === 81 && item.QuoteHeaderSid) {
                    authorizeLink = `/crm/quotation/${item.QuoteHeaderSid}`;
                } else if (menuSid === 82 && item.EnquiryHeaderSid) {
                    authorizeLink = `/crm/enquiry/${item.EnquiryHeaderSid}`;
                }

                const formatted = {
                    DocumentName: menuName,
                    DocumentNo: item.EnquiryNumber || item.QuoteNumber || '',
                    CreatedBy: item.CustomerName || '',
                    CreatedOn: item.EnquiryDate || item.QuoteDate || null,
                    AuthorizeStatus : 'Waiting for approval',
                    authorizeLink,
                    menuSid
                };
                results.push(formatted);
            });
        }


        return {
            items: results,
            totalCount: results.length
        };
    }


    async isUserAuthorizer(UserMasterSid: number, MenuMasterSid: number, DocumentSid: number) {
        const authorizer = await this._db.authorityDetail.findFirst({
            where: {
                UserMasterSid,
                status: 'A',
                deletedAt: null,
                authorityMaster: {
                    status: 'A',
                    deletedAt: null,
                    MenuMaster: MenuMasterSid
                }
            },
            select: {
                AuthorityDetailSid: true
            }
        });

        if (!authorizer) {
            return { canAuthorize: false, message: "User is not an authorizer for this menu." };
        }

        // 2. Check if user already authorized the document
        const alreadyAuthorized = await this._db.authorityLog.findFirst({
            where: {
                AuthorityDetailSid: authorizer.AuthorityDetailSid,
                DocumentSid,
                Status: 'A'
            },
            select: {
                AuthorityLogSid: true
            }
        });

        if (alreadyAuthorized) {
            return { canAuthorize: false, message: "User has already authorized this document." };
        }

        return { canAuthorize: true, message: "User is authorized and has not yet approved this document." };
    }


    async getApprovalStatusData(menuMasterSid: number, documentSid: number) {
        // 1. Fetch authority users for the given menu
        const authorityUsers = await this._db.authorityDetail.findMany({
            where: {
                deletedAt: null,
                authorityMaster: {
                    MenuMaster: menuMasterSid,
                    deletedAt: null,
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

        // 2. Fetch authority logs for this document
        const logs = await this._db.authorityLog.findMany({
            where: {
                DocumentSid: documentSid,
                Status: 'A',
                AuthorityDetail: {
                    deletedAt: null,
                    authorityMaster: {
                        MenuMaster: menuMasterSid,
                        deletedAt: null,
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
        const approvalLog = authorityUsers.map(detail => {
            const userName = detail.userMaster?.userName || 'N/A';
            const log = logMap.get(userName);

            if (log) {
                return {
                    approvedBy: userName,
                    approvalStatus: log.ApprovalStatus,
                    approvalDate: log.AuthorisedDate,
                    Remarks: log.Remarks,
                };
            } else {
                return {
                    approvedBy: userName,
                    approvalStatus: 'Pending',
                    approvalDate: null,
                    Remarks: null,
                };
            }
        });

        // 6. Determine overall status
        const status = finalAuthorityApproved ? 'Approved' : 'Pending';

        return {
            logData: approvalLog,
            status,
        };
    }

}