import { BadRequestException, Injectable, Logger, Module, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { statusWhereClause } from 'src/common/helper';
import { DatabaseService } from 'src/database/database.service';
import { RoleMenuDetailDto, RoleMenuFetchPayload, RoleMenuItemDto, RoleMenuPayload, RoleMenuPermissionDto } from 'src/masters/DTO/role-menu.dto';
import { filterDto } from 'src/masters/DTO/search-vessel.dto';

@Injectable()
export class RoleMenuService {
    private readonly logger = new Logger(RoleMenuService.name);

    constructor(private _db:DatabaseService){}

    async createRoleMenu(payload: RoleMenuPayload) {
        try {
            const roleMenu = await this._db.$transaction(async (prisma) => {
                const existing = await prisma.roleMenuHeader.findFirst({
                    where: {
                        RoleMasterSid: payload.RoleMasterSid,
                        CompanyMasterSid : payload.CompanyMasterSid,
                        status: statusWhereClause
                    }
                });

                if (existing) {
                    throw new BadRequestException('Role menu already exists for this role and company.');
                }

                const header = await prisma.roleMenuHeader.create({
                    data : {
                        RoleMasterSid: payload.RoleMasterSid,
                        CompanyMasterSid: payload.CompanyMasterSid || null,
                        createdBy: payload.createdBy || "",
                        updatedOn : new Date(),
                        Remarks: payload.Remarks || "",
                        status : 'A'
                    }
                });

                const details = payload.RoleMenuDetail.map((detail: RoleMenuDetailDto) => ({
                    RoleMenuHeaderSid: header.RoleMenuHeaderSid,
                    MenuMasterSid: detail.MenuMasterSid,
                    DisplayName: detail.DisplayName || "",
                    CompanyMasterSid: payload.CompanyMasterSid || null,
                    InsertRole: detail.InsertRole || "N",
                    ViewRole: detail.ViewRole || "N",
                    UpdateRole: detail.UpdateRole || "N",
                    DeleteRole: detail.DeleteRole || "N",
                    createdBy: payload.createdBy || "",
                    status: 'A',
                    ModuleAndMenus: {}
                }))

                await prisma.roleMenuDetail.createMany({
                    data: details
                });

                return {
                    ...header
                }
            });
            return roleMenu;
        } catch (error) {
            throw error;
        }
    }

    async getRoleMenuByRoleId(payload: RoleMenuFetchPayload) {
        try {
            const result = await this._db.$transaction(async (prisma) => {
                const roleMenu = await prisma.roleMenuHeader.findFirst({
                    where: {
                        RoleMenuHeaderSid: payload.RoleMenuHeaderSid,
                        CompanyMasterSid: payload.CompanyMasterSid,
                        status: 'A'
                    },
                    include: {
                        RoleMenuDetail: {
                            where: { status: statusWhereClause },
                            select: {
                                RoleMenuDetailSid: true,
                                MenuMasterSid: true,
                                DisplayName: true,
                                InsertRole: true,
                                ViewRole: true,
                                UpdateRole: true,
                                DeleteRole: true,
                                menuMaster: {
                                    select: {
                                        MenuName: true,
                                        menuPermission: { where: { status: 'A' } },
                                        ModuleMasterSid: true,
                                        moduleMaster: {
                                            select: { ModuleName: true }
                                        }
                                    }
                                }

                            }
                        }
                    }
                });


                if (!roleMenu) {
                    throw new BadRequestException('RoleMenu not found');
                }

                const { RoleMenuDetail, ...header } = roleMenu;

                const formattedDetailItems: RoleMenuItemDto[] =await Promise.all( RoleMenuDetail.map(async (detail) => {
                    return {
                        RoleMenuDetailSid: detail.RoleMenuDetailSid,
                        ModuleMasterSid: detail.menuMaster?.ModuleMasterSid,
                        ModuleName: detail.menuMaster?.moduleMaster?.ModuleName,
                        MenuMasterSid: detail.MenuMasterSid,
                        MenuName: detail.menuMaster?.MenuName,
                        MenuDisplayName: detail.DisplayName!,
                        InsertRole : detail.InsertRole || 'N',
                        ViewRole : detail.ViewRole || 'N',
                        UpdateRole : detail.UpdateRole || 'N',
                        DeleteRole : detail.DeleteRole || 'N',
                        menuPermission : detail.menuMaster?.menuPermission?.map(permission => permission.permissionCode!)
                    }
                }));
                return {
                    ...header,
                    roleMenuDetails: formattedDetailItems
                }
            })
            return result;
        } catch (error) {
            throw error;
        }
    }

    async updateRoleMenu(payload:RoleMenuPayload){
        try {
            const existing = await this._db.roleMenuHeader.findFirst({
                where: {
                    RoleMasterSid : payload.RoleMasterSid,
                    CompanyMasterSid : payload.CompanyMasterSid,
                    status : statusWhereClause,
                    RoleMenuHeaderSid : {not : payload.RoleMenuHeaderSid}
                }
            });
            if (existing) {
                throw new BadRequestException('Role menu already exists for this role and company.');
            }

            const { RoleMenuDetail, ...header } = payload;

            const updatedRoleMenu = await this._db.$transaction(async (prisma) => {
                const roleMenuHeader = await prisma.roleMenuHeader.update({
                    where: {
                        RoleMenuHeaderSid: payload.RoleMenuHeaderSid
                    },
                    data : {
                        RoleMasterSid: payload.RoleMasterSid,
                        CompanyMasterSid: payload.CompanyMasterSid,
                        updatedBy : payload.updatedBy,
                        updatedOn : new Date(),
                        Remarks : payload.Remarks,
                        status : payload.status,
                    }
                });

                const detailsToSoftDelete = payload.RoleMenuDetail.filter(del => del.isDeleted);
                await prisma.roleMenuDetail.updateMany({
                    where: {
                        RoleMenuDetailSid: {
                            in: detailsToSoftDelete.map(detail => detail.RoleMenuDetailSid!)
                        }
                    },
                    data: {
                        status: 'D'
                    }
                });
                
                const detailsToCreate = payload.RoleMenuDetail
                    .filter(detail => !detail.RoleMenuDetailSid && !detail.isDeleted)
                    .map(detail => ({
                        RoleMenuHeaderSid: roleMenuHeader.RoleMenuHeaderSid,
                        MenuMasterSid: detail.MenuMasterSid,
                        DisplayName: detail.DisplayName || "",
                        CompanyMasterSid: payload.CompanyMasterSid || null,
                        InsertRole: detail.InsertRole || "N",
                        ViewRole: detail.ViewRole || "N",
                        UpdateRole: detail.UpdateRole || "N",
                        DeleteRole: detail.DeleteRole || "N",
                        createdBy: payload.createdBy || "",
                        status: 'A',
                        ModuleAndMenus: {}
                    }));
                const detailsToUpdate = payload.RoleMenuDetail
                    .filter(detail => detail.RoleMenuDetailSid && !detail.isDeleted);

                
                if(detailsToCreate.length > 0){
                    await prisma.roleMenuDetail.createMany({
                        data: detailsToCreate
                    });
                }

                if (detailsToUpdate.length > 0) {
                    await Promise.all(
                        detailsToUpdate.map(detail =>
                            prisma.roleMenuDetail.update({
                                where: { RoleMenuDetailSid: detail.RoleMenuDetailSid! },
                                data: {
                                    RoleMenuHeaderSid: detail.RoleMenuHeaderSid,
                                    MenuMasterSid: detail.MenuMasterSid,
                                    DisplayName: detail.DisplayName || '',
                                    CompanyMasterSid: payload.CompanyMasterSid || null,
                                    InsertRole: detail.InsertRole || 'N',
                                    ViewRole: detail.ViewRole || 'N',
                                    UpdateRole: detail.UpdateRole || 'N',
                                    DeleteRole: detail.DeleteRole || 'N',
                                    updatedBy: payload.updatedBy || '',
                                    status: 'A',
                                    ModuleAndMenus: {}
                                }
                            })
                        )
                    );
                }

                return {
                    ...roleMenuHeader,
                }
            });
            return updatedRoleMenu;
        } catch (error) {
            throw error;
        }
    }

    async searchRoleMenu(params: filterDto) {
        try {
            const { search = '', page = 1, pageSize = 15 ,activeCompanyId} = params;
            const skip = (page - 1) * pageSize;
            const where: Prisma.RoleMenuHeaderWhereInput = {
                status: statusWhereClause,
                CompanyMasterSid: activeCompanyId,
                ...(search
                    ? {
                        OR: [
                            { roleMaster: { UserRoleName: { contains: search, mode: 'insensitive' } } },
                            {
                                RoleMenuDetail: {
                                    some: {
                                        menuMaster : {
                                            ModuleName : { contains: search, mode: 'insensitive' },
                                        }
                                    },
                                },
                            },
                            ...(search.toLowerCase() === 'active' ? [{ status: 'A' }] : []),
                            ...(search.toLowerCase() === 'suspended' ? [{ status: 'S' }] : []),
                        ],
                    }
                    : {}
                ),
            };
            let items;
            let totalCount;
            [items, totalCount] = await this._db.$transaction([
                this._db.roleMenuHeader.findMany({
                    where,
                    skip,
                    take: pageSize,
                    orderBy: { RoleMenuHeaderSid: 'desc' },
                    select: {
                        RoleMenuHeaderSid: true,
                        roleMaster: { select: { RoleMasterSid: true, UserRoleName: true } },
                        RoleMenuDetail: {
                            where : {status : 'A'},
                            include : {
                                menuMaster : {
                                    select : {ModuleName : true}
                                }
                            }
                        },
                        status : true,
                    },
                }),
                this._db.roleMenuHeader.count({ where }),
            ]);

            const enrichedItems = items.map(item => {
                const allModules = item.RoleMenuDetail.map(detail => detail.menuMaster?.ModuleName);
                const modules = new Set<string>(allModules);
                const concatenatedModules = Array.from(modules).sort((a,b)=>a.localeCompare(b)).join(', ');
                return {
                    RoleMenuHeaderSid: item.RoleMenuHeaderSid,
                    RoleName : item.roleMaster?.UserRoleName,
                    Modules : concatenatedModules,
                    status : item.status
                }
            })

            return {
                items : enrichedItems,
                totalCount,
            }

        } catch (error) {
            throw error;
        }
    }

    async getMenuPermission(payload: {
        CompanyMasterSid: number,
        Roles: number[],
        MenuMasterSid: number
    }) {
        try {
            const { CompanyMasterSid, Roles, MenuMasterSid } = payload;

            console.log('🔍 getMenuPermission:', { CompanyMasterSid, Roles, MenuMasterSid });

            // Find role menus for ALL provided roles
            const roleMenus = await this._db.roleMenuHeader.findMany({
                where: {
                    RoleMasterSid: { in: Roles },
                    CompanyMasterSid,
                    status: 'A',
                    RoleMenuDetail: {
                        some: {
                            MenuMasterSid,
                            status: 'A'
                        }
                    }
                },
                select: {
                    RoleMasterSid: true,
                    roleMaster: { select: { UserRoleName: true } },
                    RoleMenuDetail: {
                        where: { MenuMasterSid, status: 'A' },
                        take: 1,
                        select: {
                            MenuMasterSid: true,
                            InsertRole: true,
                            ViewRole: true,
                            UpdateRole: true,
                            DeleteRole: true,
                            menuMaster: {
                                select: {
                                    MenuName: true,
                                    menuPermission: {
                                        where: { status: 'A' },
                                        select: { permissionCode: true }
                                    }
                                }
                            }
                        }
                    }
                }
            });

            console.log('📋 Found roleMenus:', roleMenus.length);

            if (!roleMenus || roleMenus.length === 0) {
                throw new NotFoundException('No role menu permissions found for provided roles');
            }

            // MERGE permissions across all matching roles (OR logic)
            const mergedPermissions: Record<string, boolean> = {
                InsertRole: false,
                ViewRole: false,
                UpdateRole: false,
                DeleteRole: false
            };

            // Collect all role names
            const roleNames: string[] = [];
            let menuName = '';
            let menuMasterSid = MenuMasterSid;

            roleMenus.forEach((roleMenu, index) => {
                console.log(`🎭 Processing role ${index + 1}/${roleMenus.length}:`, roleMenu.RoleMasterSid);

                // Collect role name
                if (roleMenu.roleMaster?.UserRoleName) {
                    roleNames.push(roleMenu.roleMaster.UserRoleName);
                }

                const detail = roleMenu.RoleMenuDetail[0];
                if (!detail) return;

                // Set menu name and ID from first available detail
                if (!menuName && detail.menuMaster?.MenuName) {
                    menuName = detail.menuMaster.MenuName;
                }
                if (detail.MenuMasterSid) {
                    menuMasterSid = detail.MenuMasterSid;
                }

                // OR operation: if ANY role has permission = "Y", set to true
                if (detail.InsertRole === "Y") mergedPermissions.InsertRole = true;
                if (detail.ViewRole === "Y") mergedPermissions.ViewRole = true;
                if (detail.UpdateRole === "Y") mergedPermissions.UpdateRole = true;
                if (detail.DeleteRole === "Y") mergedPermissions.DeleteRole = true;

                // Merge extra permissions (OR logic)
                (detail.menuMaster?.menuPermission ?? []).forEach(p => {
                    const code = p.permissionCode?.toLowerCase();
                    if (code && !['add', 'view', 'edit', 'delete'].includes(code)) {
                        mergedPermissions[code] = true;
                    }
                });
            });

            console.log('✅ Merged permissions:', mergedPermissions);
            console.log('👥 Role names:', roleNames);

            // Concatenate role names
            const concatenatedRoleNames = roleNames.length > 0
                ? roleNames.join(', ')
                : 'Multiple Roles';

            return {
                MenuPermissions: mergedPermissions,
                MenuMasterSid: menuMasterSid,
                MenuName: menuName || '',
                RoleIds : Roles,
                UserRoleName: concatenatedRoleNames
            };

        } catch (error) {
            console.error('💥 getMenuPermission error:', error);
            throw error;
        }
    }



    /**
     * Helper Section
     */


    async isMenuPermissionGranted(
        menuMasterSid:number, 
        permissionCode:string,
        permissionValue:string,
        prisma:any
    ) : Promise<RoleMenuPermissionDto> {
        let tx = prisma || this._db;
        try {
            const mPermission = await tx.menuPermission.findFirst({
                where : {
                    MenuMasterSid : menuMasterSid,
                    permissionCode : permissionCode,
                    status : 'A'
                }
            })
            if(mPermission){
                return {
                    id : mPermission.MenuPermissionSid,
                    key : permissionCode,
                    value : true && permissionValue === 'Y',
                    state : true
                }
            } else {
                return {
                    id : null,
                    key : permissionCode,
                    value : false,
                    state : false
                }
            }
        } catch (error) {
            throw error;
        }
    }

    async getAllMenuWithModules() {
        try {
            const menus = await this._db.menuMaster.findMany({
                where: {
                    status: 'A'
                },
                select: {
                    MenuMasterSid: true,
                    MenuName: true,
                    ModuleMasterSid: true,
                    moduleMaster: {
                        select: {
                            ModuleName: true
                        }
                    },
                    menuPermission: { where: { status: 'A' } },
                }
            });

            // Map from ModuleMasterSid to an array of menus
            const menuModuleMap = new Map<number, any[]>();
            menus.forEach(menu => {
                const formattedMenu = {
                    MenuMasterSid: menu.MenuMasterSid,
                    MenuName: menu.MenuName,
                    ModuleMasterSid: menu.ModuleMasterSid,
                    ModuleName: menu.moduleMaster?.ModuleName,
                    menuPermission: (menu.menuPermission || [])
                        .map(permission =>permission.permissionCode)
                };
                if (!menuModuleMap.has(menu.ModuleMasterSid)) {
                    menuModuleMap.set(menu.ModuleMasterSid, []);
                }
                menuModuleMap.get(menu.ModuleMasterSid)!.push(formattedMenu);
            });

            return Object.fromEntries(menuModuleMap);
        } catch (error) {
            throw error;
        }
    }
    
}
