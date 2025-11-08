import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { GlobalConfigService } from 'src/common/config/master-config.service';
import { MENU_CONFIG_MAP } from 'src/common/config/menu-config';
import { statusWhereClause, toCamelCase } from 'src/common/helper';
import { DatabaseService } from 'src/database/database.service';
import { SearchListDto } from 'src/masters/DTO/search-list.dto';
import { filterDto } from 'src/masters/DTO/search-vessel.dto';

@Injectable()
export class MenuService {
    constructor(private _db: DatabaseService, private logger: Logger, private globalConfigService: GlobalConfigService) { }


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
                const { permissions, menuPermissions, otherPermissions, ...menuPayload } = payload
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

                const configKey = toCamelCase(payload.MenuName);
                const menuConfig = MENU_CONFIG_MAP[configKey];
                const linkPattern = this.buildLinkPattern(menu.path, configKey);

                console.log("Config Key:", JSON.stringify(configKey));
                console.log("All Keys:", Object.keys(MENU_CONFIG_MAP));
                console.log("MENU_CONFIG_MAP:", MENU_CONFIG_MAP);

                if (menuConfig) {
                    await tx.menuConfig.create({
                        data: {
                            MenuMasterSid: menu.MenuMasterSid,
                            ModelName: menuConfig.modelName,
                            PrimaryKey: menuConfig.primaryKey,
                            LinkPattern: linkPattern,
                            CreatedBy: payload.createdBy,
                        }
                    });
                }


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
                    status: 'A',

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
    async getAllMenus(user) {
        try {
            if (user.userTypeId === 1) {
                return await this._db.menuMaster.findMany({
                    where: { status: 'A' },
                });
            }

            // Otherwise, filter menus by user roles
            const roleIds = user.userRoleMaster.map(role => role.RoleMasterSid);

            const menuList = await this._db.menuMaster.findMany({
                where: {
                    status: 'A',
                    roleMenuMaster: {
                        some: { RoleMasterSid: { in: roleIds } },
                    },
                },
            });

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
                    status: 'A'
                },
                select: {
                    permissionName: true,
                    permissionCode: true,
                    status: true,
                    MenuMasterSid: true,
                    MenuPermissionSid: true
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
            const { permissions, menuPermissions, otherPermissions, ...menuPayload } = payload;

            const result = await this._db.$transaction(async (tx) => {
                // 1. Update menu
                const { ModuleMasterSid, ...payloadWithoutModule } = menuPayload;

                const updatedMenu = await tx.menuMaster.update({
                    where: {
                        MenuMasterSid: menuMasterSid
                    },
                    data: {
                        moduleMaster: { connect: { ModuleMasterSid } }, // use relation
                        ...payloadWithoutModule,                        // no conflicting key
                        parentId: menuPayload.parentId || null
                    }
                });

                let allPermissions: any[] = [];
                if (permissions?.length) {
                    // Soft Delete existing records that aren't in payload
                    const existingPerms = await tx.menuPermission.findMany({
                        where: {
                            MenuMasterSid: menuMasterSid,
                            status: 'A'
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
                                status: 'D',
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
                                status: 'A'
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

                // 3. Update menu config
                const configKey = toCamelCase(updatedMenu.MenuName);
                const menuConfig = MENU_CONFIG_MAP[configKey];
                const linkPattern = this.buildLinkPattern(updatedMenu.path, configKey);

                if (menuConfig) {
                    const existingConfig = await tx.menuConfig.findFirst({
                        where: {
                            MenuMasterSid: updatedMenu.MenuMasterSid,
                            ModelName: menuConfig.modelName,
                            PrimaryKey: menuConfig.primaryKey
                        }
                    });

                    if (existingConfig) {
                        await tx.menuConfig.update({
                            where: {
                                menuConfigSid: existingConfig.menuConfigSid
                            },
                            data: {
                                ModelName: menuConfig.modelName,
                                PrimaryKey: menuConfig.primaryKey,
                                LinkPattern: linkPattern
                            }
                        });
                    } else {
                        await tx.menuConfig.create({
                            data: {
                                MenuMasterSid: updatedMenu.MenuMasterSid,
                                ModelName: menuConfig.modelName,
                                PrimaryKey: menuConfig.primaryKey,
                                LinkPattern: linkPattern,
                                CreatedBy: payload.createdBy,
                            }
                        });
                    }
                }

                return {
                    updatedMenu,
                    permissions: allPermissions
                };
            });

            return result;
        } catch (error) {
            throw new Error(`Error updating menu: ${error.message},${error.stack}`);
        }
    }

    buildLinkPattern(path: string | null, configKey: string): string {
        if (!path || path.trim() === '') {
            return `/${configKey}/{id}`;
        }

        if (path.endsWith('/list')) {
            // Remove '/list' and replace with '/entry/{id}'
            const basePath = path.slice(0, -5);
            return `${basePath}/entry/{id}`;
        } else {
            // Just append '/{id}' to the path
            if (path.endsWith('/')) {
                return `${path}{id}`;
            } else {
                return `${path}/{id}`;
            }
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

        if (existingmenu.status === 'D') {
            throw new Error(`Menu with ID ${id} is already deleted`);
        }

        // Now check if any related permissions are already deleted
        const deletedPermissions = await this._db.menuPermission.findMany({
            where: {
                MenuMasterSid: id,
                NOT: {
                    status: 'D'
                }
            }
        });

        if (deletedPermissions.length > 0) {
            throw new Error(`One or more permissions under Menu ID ${id} are already deleted`);
        }

        return await this._db.$transaction(async (tx) => {
            await tx.menuPermission.updateMany({
                where: { MenuMasterSid: id },
                data: { status: 'D', updatedBy: user?.userName || 'system' }
            });

            await tx.menuMaster.update({
                where: { MenuMasterSid: id },
                data: {
                    status: 'D',
                    updatedBy: user?.userName || 'system'
                }
            });

            await tx.menuConfig.updateMany({
                where: {
                    MenuMasterSid: id
                },
                data: {
                    Status: 'D',
                }
            });
        });
    }



    async searchList(params: filterDto) {
        const { search = '', page = 1, pageSize = 15 } = params;
        const skip = (page - 1) * pageSize;

        const where: Prisma.MenuMasterWhereInput = {
            status: statusWhereClause,
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
                orderBy: { MenuMasterSid: 'desc' },
            }),
            this._db.menuMaster.count({ where }),
        ]);

        items = await Promise.all(
            items.map(async (item) => {
                const moduleMaster = item.ModuleMasterSid !== null ?
                    await this.globalConfigService.getMasterData('module_master', item.ModuleMasterSid, item.CompanyMasterSid) :
                    { ModuleMasterSid: null, ModuleName: '' };

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
                    status: 'A'
                },
            })
            return menus;
        } catch (error) {
            throw error;
        }
    }

    async getMenusByModules(moduleIds: number[]) {
  try {
    const menus = await this._db.menuMaster.findMany({
      where: {
        ModuleMasterSid: {
          in: moduleIds
        },
        status: 'A'
      },
      orderBy: {
        ModuleMasterSid: 'asc'
      }
    });
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
                    status: 'A'
                },
            })
            return submenus;
        } catch (error) {
            throw error;
        }
    }

    // Used for Master Jobs and House Jobs
    async getMenuSidByName(menuName:string){
        try {
            const menu = await this._db.menuMaster.findFirst({
                where: {
                    MenuName: menuName
                },
            })
            if(!menu || menu.MenuMasterSid === null){
                throw new Error('Menu not found');
            }
            return menu?.MenuMasterSid;
        } catch (error) {
            throw error;
        }
    }


}
