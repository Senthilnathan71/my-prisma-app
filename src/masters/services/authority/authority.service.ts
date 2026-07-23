import { BadRequestException, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ApprovalStatus, Prisma } from '@prisma/client';
import { GlobalConfigService } from 'src/common/config/master-config.service';
import { parseDateFromString, statusWhereClause } from 'src/common/helper';
import { DatabaseService } from 'src/database/database.service';
import { SearchListDto } from 'src/masters/DTO/search-list.dto';
import { filterDto } from 'src/masters/DTO/search-vessel.dto';

@Injectable()
export class AuthorityService {
    constructor(private _db: DatabaseService, private globalConfigService: GlobalConfigService, private logger: Logger) { }

    /**
     * Menus whose authorization is MENU-ONLY (department not required when configuring the rule).
     *
     * These are exactly the accounts voucher menus, derived from VoucherTypeMaster.MenuMasterSid —
     * the same link the posting gate uses to resolve a voucher's menu. Deriving it from data avoids
     * a hardcoded menu-name list that would silently break when a menu is renamed or added.
     * Every other menu (Booking, Enquiry, House Job, ...) stays department-based.
     */
    async getMenuOnlyAuthorityMenus(): Promise<number[]> {
        const voucherTypeMenus = await this._db.voucherTypeMaster.findMany({
            where: {
                status: 'A',
                MenuMasterSid: { not: null }
            },
            select: { MenuMasterSid: true },
            distinct: ['MenuMasterSid']
        });

        return voucherTypeMenus
            .map(row => row.MenuMasterSid)
            .filter((sid): sid is number => typeof sid === 'number');
    }

    /**
     * Menus that are ALLOWED to be configured for authorization on the Authority screen.
     * Rules:
     *  - Only CRM / Accounts / Operation module menus are authorizable.
     *  - A menu whose Document Type (VoucherType) has Auto Post = 'Y' is EXCLUDED
     *    (auto-posting documents never wait for manual authorization).
     *  - A menu with Auto Approval config = 'Y' is EXCLUDED (it auto-approves), and if
     *    the company-wide AUTO_APPROVAL flag is 'Y' every menu is excluded.
     */
    async getAuthorizableMenus(companyMasterSid: number) {
        const allowedModules = ['CRM', 'Account', 'Accounts', 'Operation', 'Operations'];
        const truthy = (v?: string | null) => ['y', 'yes', 'true', '1'].includes(String(v || '').trim().toLowerCase());

        // Classify every voucher menu by its document types. A voucher menu is only
        // "auto-post" (and therefore excluded) when EVERY one of its types is auto-post;
        // if it has at least one Manual type it still needs authorization (e.g. Journal
        // Voucher has a Manual "JV" type alongside the system auto-posting type).
        const voucherTypes = await this._db.voucherTypeMaster.findMany({
            where: { status: 'A', MenuMasterSid: { not: null } },
            select: { MenuMasterSid: true, IsAutoPosting: true },
        });
        const voucherMenuSids = new Set<number>();
        const autoPostMenuSids = new Set<number>();
        const manualMenuSids = new Set<number>();
        for (const vt of voucherTypes) {
            if (vt.MenuMasterSid == null) continue;
            voucherMenuSids.add(vt.MenuMasterSid);
            if (truthy(vt.IsAutoPosting)) autoPostMenuSids.add(vt.MenuMasterSid);
            else manualMenuSids.add(vt.MenuMasterSid);
        }
        // Excluded only when purely auto-post (no manual type on the menu).
        const pureAutoPostMenuSids = new Set(
            [...autoPostMenuSids].filter((sid) => !manualMenuSids.has(sid)),
        );

        // Auto-approval config -> excluded (per-menu, and a company-wide flag).
        const configs = await this._db.companyConfiguration.findMany({
            where: {
                CompanyMasterSid: companyMasterSid,
                Status: 'A',
                ConfigurationName: { startsWith: 'AUTO_APPROVAL' },
            },
            select: { ConfigurationName: true, ConfigurationValue: true },
        });
        const globalAutoApproval = configs.some(
            (c) => c.ConfigurationName === 'AUTO_APPROVAL' && truthy(c.ConfigurationValue),
        );
        const autoApprovalMenuSids = new Set<number>();
        for (const c of configs) {
            const m = c.ConfigurationName.match(/^AUTO_APPROVAL_MENU_(\d+)$/);
            if (m && truthy(c.ConfigurationValue)) autoApprovalMenuSids.add(Number(m[1]));
        }

        // Authorizable = CRM/Accounts/Operation menus OR any voucher menu (voucher menus
        // are inconsistently categorised by module, so include them explicitly).
        const menus = await this._db.menuMaster.findMany({
            where: {
                status: 'A',
                OR: [
                    { ModuleName: { in: allowedModules } },
                    { MenuMasterSid: { in: Array.from(voucherMenuSids) } },
                ],
            },
            select: { MenuMasterSid: true, MenuName: true, MenuCode: true, ModuleName: true },
            orderBy: [{ ModuleName: 'asc' }, { MenuName: 'asc' }],
        });

        if (globalAutoApproval) return [];
        return menus.filter(
            (m) => !pureAutoPostMenuSids.has(m.MenuMasterSid) && !autoApprovalMenuSids.has(m.MenuMasterSid),
        );
    }

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
                            userMaster: {
                                omit : { userPassword : true }
                            }
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
            payload.CompanyMasterSid = Number(payload.CompanyMasterSid);
            payload.BranchMasterSid = Number(payload.BranchMasterSid);
            if (!payload.CompanyMasterSid || !payload.BranchMasterSid) {
                throw new BadRequestException('CompanyMasterSid and BranchMasterSid are required');
            }
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

    async fetchAuthorityById(AuthorityMasterSid: number, CompanyMasterSid?: number, BranchMasterSid?: number) {
        try {
            const authority = await this._db.authorityMaster.findUnique({
                where: {
                    AuthorityMasterSid: AuthorityMasterSid,
                    CompanyMasterSid: CompanyMasterSid,
                    BranchMasterSid: BranchMasterSid
                },
                include: {
                    authorityDetail: {
                        where: {
                            status: 'A'
                        },
                        // Show approver rows in level order so the last row is the final authority.
                        orderBy: { AuthorityLevel: 'asc' }
                    }
                }
            });
            if (!authority) {
                throw new UnauthorizedException(`Access denied.`);
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
                BranchMasterSid: rawBranchMasterSid,
                CompanyMasterSid: rawCompanyMasterSid,
                status,
                Remarks,
                authDetails = [],
                updatedBy,
            } = payload;
            const CompanyMasterSid = Number(rawCompanyMasterSid);
            const BranchMasterSid = Number(rawBranchMasterSid);
            if (!CompanyMasterSid || !BranchMasterSid) {
                throw new BadRequestException('CompanyMasterSid and BranchMasterSid are required');
            }

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
                                CompanyMasterSid: authority.CompanyMasterSid,
                                BranchMasterSid: authority.BranchMasterSid,
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
        const { search = '', page = 1, pageSize = 15, activeCompanyId, activeBranchId } = param;
        const skip = (page - 1) * pageSize;

        const where: Prisma.AuthorityMasterWhereInput = {
            status: statusWhereClause,
            ...(activeCompanyId ? { CompanyMasterSid: Number(activeCompanyId) } : {}),
            ...(activeBranchId ? { BranchMasterSid: Number(activeBranchId) } : {}),
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

                    item.MenuMaster !== null ?
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
                    include: { userMaster: { omit : { userPassword : true } } }
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

    /**
    * Checks whether a given user is an authorized approver for a specific menu and document,
    * and returns additional metadata such as the total number of active authorizers.
    *
    * @async
    * @param {Object} payload - The input data used for authorization checks.
    * @param {number} payload.UserMasterSid - Current User's Sid.
    * @param {number} payload.CompanyMasterSid - Current User's Active Company's Sid.
    * @param {number} payload.BranchMasterSid -Current User's Active Branch's Sid.
    * @param {number} payload.MenuMasterSid - Menu identifier for which authorization is being checked.
    * @param {number} payload.DocumentSid - Document identifier for which authorization is being checked.
    * @returns {Promise<{
    *   canAuthorize: boolean,
    *   alreadyApproved: boolean,
    *   AuthorityDetailSid: number | null,
    *   AuthorityLevel: number | null,
    *   totalNumberOfAuthorizers: number,
    *   message: string
    * }>} An object indicating whether the user can authorize, has already approved,
    * and how many total active authorizers exist for that menu.
    */
    private async getAuthorityDepartmentName(payload: any): Promise<string | null> {
        const departmentName = String(payload.DepartmentMaster || payload.departmentName || '').trim();
        if (departmentName) {
            return departmentName;
        }

        const departmentSid = Number(payload.DepartmentMasterSid || payload.departmentMasterSid || 0);
        if (!departmentSid) {
            return null;
        }

        const department = await this._db.departmentMaster.findFirst({
            where: {
                DepartmentMasterSid: departmentSid,
                CompanyMasterSid: payload.CompanyMasterSid,
                Status: 'A'
            },
            select: { departmentName: true }
        });

        return department?.departmentName || null;
    }

    async isUserAuthorizer(payload: any) {
        const authorityDepartmentName = await this.getAuthorityDepartmentName(payload);
        const authorityMasterScope: Prisma.AuthorityMasterWhereInput = {
            status: 'A',
            MenuMaster: payload.MenuMasterSid,
            CompanyMasterSid: payload.CompanyMasterSid,
            BranchMasterSid: payload.BranchMasterSid,
            // Department is OPTIONAL on an authority rule: a menu-only rule (no departments)
            // applies to every department of that menu; a rule that lists departments applies
            // only to those. Menu is the mandatory key.
            ...(authorityDepartmentName
                ? {
                    OR: [
                        { DepartmentMaster: { isEmpty: true } },
                        { DepartmentMaster: { has: authorityDepartmentName } }
                    ]
                }
                : {})
        };

        // 1. Find if user is an active authorizer
        const authorizer = await this._db.authorityDetail.findFirst({
            where: {
                UserMasterSid: payload.UserMasterSid,
                CompanyMasterSid: payload.CompanyMasterSid,
                BranchMasterSid: payload.BranchMasterSid,
                status: 'A',
                authorityMaster: authorityMasterScope
            },
            select: {
                AuthorityDetailSid: true,
                AuthorityLevel: true,
                FinalAuthority: true,
            }
        });

        // 2. Count total active authorizers for this menu
        const totalNumberOfAuthorizers = await this._db.authorityDetail.count({
            where: {
                status: 'A',
                CompanyMasterSid: payload.CompanyMasterSid,
                BranchMasterSid: payload.BranchMasterSid,
                authorityMaster: authorityMasterScope
            }
        });

        // 3. If user is not an authorizer
        if (!authorizer) {
            return {
                canAuthorize: false,
                alreadyApproved: false,
                AuthorityDetailSid: null,
                AuthorityLevel: null,
                FinalAuthority: null,
                totalNumberOfAuthorizers,
                message: "User is not an authorizer for this menu."
            };
        }

        // 4. Check if user already authorized this document. New quotations do not have a document id yet.
        const alreadyAuthorized = payload.DocumentSid
            ? await this._db.authorityLog.findFirst({
                where: {
                    AuthorityDetailSid: authorizer.AuthorityDetailSid,
                    DocumentSid: Number(payload.DocumentSid),
                    Status: 'A'
                },
                select: {
                    AuthorityLogSid: true
                }
            })
            : null;

        // 5. Return based on already authorized state
        if (alreadyAuthorized) {
            return {
                canAuthorize: true,
                alreadyApproved: true,
                AuthorityDetailSid: authorizer.AuthorityDetailSid,
                AuthorityLevel: authorizer.AuthorityLevel,
                FinalAuthority: authorizer.FinalAuthority,
                totalNumberOfAuthorizers,
                message: "User has already authorized this document."
            };
        }

        return {
            canAuthorize: true,
            alreadyApproved: false,
            AuthorityDetailSid: authorizer.AuthorityDetailSid,
            AuthorityLevel: authorizer.AuthorityLevel,
            FinalAuthority: authorizer.FinalAuthority,
            totalNumberOfAuthorizers,
            message: "User is a valid authorizer for this menu."
        };
    }

    /**
     * Records an approve/reject decision for a document under a menu.
     * Enforces that the caller is a valid authorizer, has not already acted,
     * and that approvals follow the configured level order (Level 1 -> 2 -> 3).
     * Returns the refreshed approval status/log for the document.
     */
    async authorizeDocument(payload: any) {
        const decision = String(payload.decision || payload.ApprovalStatus || '').trim();
        if (decision !== 'Approved' && decision !== 'Rejected') {
            throw new BadRequestException('Invalid approval decision. Expected Approved or Rejected.');
        }

        const menuMasterSid = Number(payload.MenuMasterSid);
        const documentSid = Number(payload.DocumentSid);
        const companyMasterSid = Number(payload.CompanyMasterSid);
        const branchMasterSid = Number(payload.BranchMasterSid);
        if (!menuMasterSid || !documentSid || !companyMasterSid || !branchMasterSid) {
            throw new BadRequestException('Menu, document, company and branch are required to authorize.');
        }

        // 1. Confirm the caller is a valid authorizer for this scope and not already acted.
        const auth = await this.isUserAuthorizer(payload);
        if (!auth.canAuthorize) {
            throw new BadRequestException(auth.message || 'You are not authorized to approve this document.');
        }
        if (auth.alreadyApproved) {
            throw new BadRequestException('You have already acted on this document.');
        }

        const authorityDetailSid = Number(auth.AuthorityDetailSid);
        const myLevel = Number(auth.AuthorityLevel || 0);
        if (!authorityDetailSid) {
            throw new BadRequestException('Authority detail not found for the current user.');
        }

        // 2. Sequential enforcement: every lower level must already be Approved and none Rejected.
        const departmentMasterSid = payload.DepartmentMasterSid ? Number(payload.DepartmentMasterSid) : undefined;
        const beforeStatus = await this.getApprovalStatusData(
            menuMasterSid, documentSid, companyMasterSid, branchMasterSid, departmentMasterSid, payload.DepartmentMaster
        );
        const logData: any[] = beforeStatus?.logData || [];

        if (logData.some(row => row.approvalStatus === 'Rejected')) {
            throw new BadRequestException('This document has already been rejected.');
        }

        // The Final authorizer may approve directly; lower pending levels are auto-marked as
        // skipped by getApprovalStatusData. Non-final levels must still follow the order.
        const isFinalAuthorizer = auth.FinalAuthority === 'Y' || (auth.FinalAuthority as any) === true;
        if (!isFinalAuthorizer) {
            const pendingLowerLevel = logData.find(
                row => Number(row.approvalLevel) < myLevel && row.approvalStatus !== 'Approved'
            );
            if (pendingLowerLevel) {
                throw new BadRequestException(
                    `Level ${pendingLowerLevel.approvalLevel} must approve before you can act.`
                );
            }
        }

        // 3. Persist this level's decision.
        const approvedBy = payload.ApprovedBy || payload.UpdatedBy || payload.CreatedBy || 'system';
        await this._db.authorityLog.create({
            data: {
                CompanyMasterSid: companyMasterSid,
                BranchMasterSid: branchMasterSid,
                AuthorityDetailSid: authorityDetailSid,
                AuthorisedDate: new Date(),
                ApprovalStatus: decision as ApprovalStatus,
                DocumentSid: documentSid,
                Remarks: payload.Remarks || null,
                CreatedBy: approvedBy,
                UpdatedBy: approvedBy,
                Status: 'A',
            },
        });

        // 4. Return refreshed status so the caller can re-render immediately.
        return this.getApprovalStatusData(
            menuMasterSid, documentSid, companyMasterSid, branchMasterSid, departmentMasterSid, payload.DepartmentMaster
        );
    }


    async getApprovalStatusData(menuMasterSid: number, documentSid: number, companyMasterSid?: number, branchMasterSid?: number, departmentMasterSid?: number, departmentMaster?: string) {
        const scopeWhere: any = {};
        if (companyMasterSid) {
            scopeWhere.CompanyMasterSid = companyMasterSid;
        }
        if (branchMasterSid) {
            scopeWhere.BranchMasterSid = branchMasterSid;
        }
        const authorityDepartmentName = await this.getAuthorityDepartmentName({
            CompanyMasterSid: companyMasterSid,
            DepartmentMasterSid: departmentMasterSid,
            DepartmentMaster: departmentMaster
        });
        const authorityMasterScope: Prisma.AuthorityMasterWhereInput = {
            ...scopeWhere,
            MenuMaster: menuMasterSid,
            status: 'A',
            // Department is OPTIONAL (see isUserAuthorizer): a menu-only rule matches any department.
            ...(authorityDepartmentName
                ? {
                    OR: [
                        { DepartmentMaster: { isEmpty: true } },
                        { DepartmentMaster: { has: authorityDepartmentName } }
                    ]
                }
                : {})
        };

        // 1. Fetch authority users for the given menu
        const authorityUsers = await this._db.authorityDetail.findMany({
            where: {
                ...scopeWhere,
                status: 'A',
                authorityMaster: authorityMasterScope,
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
                ...scopeWhere,
                Status: 'A',
                AuthorityDetail: {
                    status: 'A',
                    authorityMaster: authorityMasterScope,
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
                    approvalLevel: detail.AuthorityLevel,
                    isFinalAuthorizer: detail.FinalAuthority === 'Y',
                    approvalStatus: log.ApprovalStatus,
                    approvalDate: log.AuthorisedDate,
                    Remarks: log.Remarks,
                };
            } else {
                baseItem = {
                    approvedBy: userName,
                    approvalLevel: detail.AuthorityLevel,
                    isFinalAuthorizer: detail.FinalAuthority === 'Y',
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




