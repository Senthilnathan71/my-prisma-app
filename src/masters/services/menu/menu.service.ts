import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { GlobalConfigService } from 'src/common/config/master-config.service';
import { DatabaseService } from 'src/database/database.service';
import { SearchListDto } from 'src/masters/DTO/search-list.dto';
import { SearchVesselDto } from 'src/masters/DTO/search-vessel.dto';

@Injectable()
export class MenuService {
    constructor(private _db: DatabaseService, private logger: Logger,private globalConfigService:GlobalConfigService) { }


    async createMenu(payload: any, user) {
        this.logger.warn(`createmenu: ${JSON.stringify(payload)}`);

        // Check if MenuName or MenuCode already exists
        const existing = await this._db.menuMaster.findFirst({
            where: {
                OR: [
                    {
                        MenuName: {
                            equals: payload.MenuName.trim(),
                            mode: 'insensitive',
                        }
                    },
                    {
                        MenuCode: {
                            equals: payload.MenuCode.trim(),
                            mode: 'insensitive',
                        }
                    }
                ]
            },
        });

        if (existing) {
            if (existing.MenuName === payload.MenuName) {
                throw new BadRequestException('Menu name already exists');
            }
            if (existing.MenuCode === payload.MenuCode) {
                throw new BadRequestException('Menu code already exists');
            }
        }

        try {
            const result = await this._db.$transaction(async (tx) => {
                const { permissions, ...menuPayload } = payload
                // 1. Create menu
                const menu = await tx.menuMaster.create({
                    data: {
                        ...menuPayload,
                    }
                });

                // 2. Check if any permission already exists for this menu
                for (const permission of payload.permissions) {
                    const existingPermission = await tx.menuPermission.findFirst({
                        where: {
                            MenuMasterSid: menu.MenuMasterSid,
                            permissionName: {
                                equals: permission.permissionName.trim(),
                                mode: 'insensitive',
                            }
                        }
                    });

                    if (existingPermission) {
                        throw new BadRequestException(`${permission.permissionName} permission already exists`);
                    }
                }

                // 3. Create all permissions using createMany
                await tx.menuPermission.createMany({
                    data: payload.permissions.map(p => ({
                        MenuMasterSid: menu.MenuMasterSid,
                        permissionName: p.permissionName,
                        permissionCode: this.getPermissionCode(p.permissionName),
                        createdBy: payload.createdBy,
                    }))
                });

                return { menu };
            });

            return result;
        } catch (error) {
            if (error instanceof BadRequestException) {
                throw error;
            }
            throw new Error(`Error creating menu with permissions: ${error.message}`);
        }
    }

    async getMainMenus() {
        try {
            return await this._db.menuMaster.findMany({
                where: {
                    parentId: null,
                    status:'A',

                },
                select: {
                    MenuMasterSid: true,
                    MenuName: true,
                    MenuCode: true
                },
                orderBy: {
                    MenuName: 'asc'  // Alphabetical order
                }
            });
        } catch (error) {
            throw error;
        }
    }
    async getAllMenus() {
        try {
            const menuList = await this._db.menuMaster.findMany({
                where: {
                    status:'A'
                },
            })

            return menuList;
        } catch (error) {
            throw error
        }
    }


    async getAllMenuPermissions(MenuMasterSid) {
        try {
            const menuPermissions = await this._db.menuPermission.findMany({
                where: {
                    MenuMasterSid: MenuMasterSid,
                    status:'A'
                }
            })
            return menuPermissions
        } catch (error) {
            throw error
        }
    }



    async findOne(menuMasterSid: any) {
        try {
            return await this._db.menuMaster.findUnique({
                where: {
                    MenuMasterSid: menuMasterSid
                },
            });
        } catch (error) {
            throw error;
        }
    }


    async updateMenu(menuMasterSid: number, payload: any, user) {
        const existing = await this._db.menuMaster.findUnique({
            where: {
                MenuMasterSid: menuMasterSid
            }
        });

        if (!existing) {
            throw new Error('Menu does not exist');
        }

        try {
            const { permissions, ...menuPayload } = payload;
            const result = await this._db.$transaction(async (tx) => {
                // 1. Update menu
                const updatedMenu = await tx.menuMaster.update({
                    where: {
                        MenuMasterSid: menuMasterSid
                    },
                    data: {
                        ...menuPayload,
                        parentId: menuPayload.parentId || null
                    }
                });

                let allPermissions: any[] = [];
                if (permissions?.length) {
                    // Soft Delete existing records that aren't in payload
                    const existingPerms = await tx.menuPermission.findMany({
                        where: {
                            MenuMasterSid: menuMasterSid,
                            status:'A'
                        }
                    });

                    const newPerms = permissions;
                    const permsToSoftDelete = existingPerms.filter(ep =>
                        !newPerms.some(np =>
                            np.permissionName.trim().toLowerCase() ===
                            ep.permissionName.toLowerCase()
                        )
                    );

                    // Soft delete the permissions
                    if (permsToSoftDelete.length > 0) {
                        await tx.menuPermission.updateMany({
                            where: {
                                MenuPermissionSid: {
                                    in: permsToSoftDelete.map(p => p.MenuPermissionSid)
                                }
                            },
                            data: {
                                status:'A',
                            }
                        });
                    }
                    // 2. Process permissions
                    for (const p of permissions) {
                        const existingPermission = await tx.menuPermission.findFirst({
                            where: {
                                MenuMasterSid: menuMasterSid,
                                permissionName: {
                                    equals: p.permissionName.trim(),
                                    mode: 'insensitive'
                                },
                                status:'A'
                            }
                        });

                        let permission;
                        if (existingPermission) {
                            permission = await tx.menuPermission.update({
                                where: {
                                    MenuPermissionSid: existingPermission.MenuPermissionSid
                                },
                                data: {
                                    permissionName: p.permissionName,
                                    permissionCode: this.getPermissionCode(p.permissionName),
                                    updatedBy: payload.updatedBy,
                                }
                            });
                        } else {
                            permission = await tx.menuPermission.create({
                                data: {
                                    MenuMasterSid: menuMasterSid,
                                    permissionName: p.permissionName,
                                    permissionCode: this.getPermissionCode(p.permissionName),
                                    createdBy: payload.createdBy
                                }
                            });
                        }
                        allPermissions.push(permission);
                    }
                }

                return {
                    updatedMenu,
                    permissions: allPermissions
                };
            });

            return result;
        } catch (error) {
            throw new Error(`Error updating menu: ${error.message}`);
        }
    }
    getPermissionCode(permsName: string) {
        let code = permsName.replace(/[^a-zA-Z0-9]/g, '_');
        code = code.toLowerCase();
        code.replace(/_+/g, '_').replace(/^_|_$/g, '');
        return code;
    }



    async softDelete(id: number, user?: any) {
        const existingmenu = await this._db.menuMaster.findUnique({
            where: { MenuMasterSid: id }
        });

        if (!existingmenu) {
            throw new NotFoundException(`Menu with ID ${id} not found`);
        }

        if (existingmenu.status==='D') {
            throw new Error(`Menu with ID ${id} is already deleted`);
        }

        // Now check if any related permissions are already deleted
        const deletedPermissions = await this._db.menuPermission.findMany({
            where: {
                MenuMasterSid: id,
                NOT: {
                    status:'D'
                }
            }
        });

        if (deletedPermissions.length > 0) {
            throw new Error(`One or more permissions under Menu ID ${id} are already deleted`);
        }

        return await this._db.$transaction(async (tx) => {
            await tx.menuPermission.updateMany({
                where: { MenuMasterSid: id },
                data: { status:'D', updatedBy: user?.userName || 'system' }
            });

            return tx.menuMaster.update({
                where: { MenuMasterSid: id },
                data: {
                    status:'D',
                    updatedBy: user?.userName || 'system'
                }
            });
        });
    }



    async searchList(params: SearchVesselDto) {
        const { search = '', page = 1, pageSize = 15 } = params;
        const skip = (page - 1) * pageSize;

        const where: Prisma.MenuMasterWhereInput = {
            status: 'A',
            ...(search
                ? {
                    OR: [
                        { MenuName: { contains: search, mode: 'insensitive' } },
                        { MenuCode: { contains: search, mode: 'insensitive' } },
                        { status: { contains: search, mode: 'insensitive' } },
                        {
                            moduleMaster: {
                                ModuleName: { contains: search, mode: 'insensitive' }
                            }
                        },
                    ],
                }
                : {}
            ),
        };

        let items;
        let totalCount;
        [items, totalCount] = await this._db.$transaction([
            this._db.menuMaster.findMany({
                where,
                skip,
                take: pageSize,
                orderBy: { ModuleMasterSid: 'desc' },
            }),
            this._db.menuMaster.count({ where }),
        ]);

        items = await Promise.all(
            items.map(async (item)=> {
                const moduleMaster = item.ModuleMasterSid !== null ? 
                await this.globalConfigService.getMasterData('module_master',item.ModuleMasterSid,item.CompanyMasterSid) :
                {ModuleMasterSid : null , ModuleName : ''};

                return {
                    ...item,
                    moduleMaster
                }
            })
        )

        return {
            items,
            totalCount,
        };
    }

    async getMenusByModule(ModuleMasterSid) {
        try {
            const menus = await this._db.menuMaster.findMany({
                where: {
                    ModuleMasterSid: ModuleMasterSid,
                    status:'A'
                },
            })
            return menus;
        } catch (error) {
            throw error;
        }
    }

    async getSubMenuList(moduleId) {
        try {
            const submenus = await this._db.menuMaster.findMany({
                where: {
                    ModuleMasterSid: moduleId,
                    parentId: null,
                    status:'A'
                },
            })
            return submenus;
        } catch (error) {
            throw error;
        }
    }
}
