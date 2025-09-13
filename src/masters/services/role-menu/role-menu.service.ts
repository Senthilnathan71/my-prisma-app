import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { GlobalConfigService } from 'src/common/config/master-config.service';
import { DatabaseService } from 'src/database/database.service';
import { SearchListDto } from 'src/masters/DTO/search-list.dto';
import { filterDto } from 'src/masters/DTO/search-vessel.dto';

@Injectable()
export class RoleMenuService {
    constructor(private _db: DatabaseService, private globalConfigService: GlobalConfigService) { }

    async getAllRoleMenu() {
        try {
            const allRoleMenu = await this._db.roleMenuMaster.findMany({
                where: {
                    status: 'A'
                }
            })
            return allRoleMenu;
        } catch (error) {
            throw error;
        }
    }

    async createNewRoleMenu(payload) {
        try {
            const existing = await this._db.roleMenuMaster.findFirst({
                where: {
                    MenuMasterSid: payload.MenuMasterSid,
                    RoleMasterSid: payload.RoleMasterSid,
                    status: 'A'
                },
            });

            if (existing?.MenuMasterSid === payload.MenuMasterSid && existing?.RoleMasterSid === payload.RoleMasterSid) {
                throw new BadRequestException('Role menu has been already created for the provided role and menu.');
            }
            const createdRoleMenu = await this._db.roleMenuMaster.create({
                data: {
                    ...payload,
                }
            })
            return createdRoleMenu;
        } catch (error) {
            throw error;
        }
    }

    async fetchroleMenuById(RoleMenuMasterSid: number) {
        try {
            const ourRoleMenu = await this._db.roleMenuMaster.findUnique({
                where: {
                    RoleMenuMasterSid: RoleMenuMasterSid
                }
            })
            if (!ourRoleMenu) {
                throw new BadRequestException(`roleMenu with Id : ${RoleMenuMasterSid} not exists`);
            }
            return ourRoleMenu;
        } catch (error) {
            throw error;
        }
    }

    async updateRoleMenuById(RoleMenuMasterSid: number, payload) {
        try {
            const exist = await this._db.roleMenuMaster.findUnique({
                where: {
                    RoleMenuMasterSid: RoleMenuMasterSid
                }
            })

            const existing = await this._db.roleMenuMaster.findFirst({
                where: {
                    MenuMasterSid: payload.MenuMasterSid,
                    RoleMasterSid: payload.RoleMasterSid,
                    RoleMenuMasterSid: { not: RoleMenuMasterSid },
                    status: 'A'
                },
            });

            if (existing?.MenuMasterSid === payload.MenuMasterSid && existing?.RoleMasterSid === payload.RoleMasterSid) {
                throw new BadRequestException('Role menu has been already created for the provided role and menu.');
            }
            if (!exist) {
                throw new BadRequestException(`RoleMenu with Id : ${RoleMenuMasterSid} not exists`);
            }
            const updatedRoleMenu = this._db.roleMenuMaster.update({
                where: {
                    RoleMenuMasterSid: RoleMenuMasterSid
                },
                data: payload
            })
            return updatedRoleMenu;
        } catch (error) {
            throw error;
        }
    }


    async deleteRoleMenu(RoleMenuMasterSid: number) {
        try {
            const exist = await this._db.roleMenuMaster.findUnique({
                where: {
                    RoleMenuMasterSid: RoleMenuMasterSid
                }
            })
            if (!exist) {
                throw new BadRequestException(`RoleMenu with Id : ${RoleMenuMasterSid} not exists`);
            }
            if (exist.status === 'D') {
                throw new BadRequestException(`RoleMenu with Id :${RoleMenuMasterSid} is already deleted`)
            }
            const deletedRoleMenu = this._db.roleMenuMaster.update({
                where: {
                    RoleMenuMasterSid: RoleMenuMasterSid
                },
                data: {
                    status: 'D'
                }
            })
            return deletedRoleMenu;
        } catch (error) {
            throw error;
        }
    }

    async searchRoleMenu(params: filterDto) {
        const { search = '', page = 1, pageSize = 15 } = params;
        const skip = (page - 1) * pageSize;

        const where: Prisma.RoleMenuMasterWhereInput = {
            status: 'A',
            OR: search ? [
                { menuMaster: { MenuName: { contains: search, mode: 'insensitive' } } },
                { roleMaster: { UserRoleName: { contains: search, mode: 'insensitive' } } },
                ...(search.toLowerCase() === 'active' ? [{ status: 'A' }] : []),
                ...(search.toLowerCase() === 'suspended' ? [{ status: 'S' }] : []),

            ] : undefined
        };

        let items;
        let totalCount;
        [items, totalCount] = await this._db.$transaction([
            this._db.roleMenuMaster.findMany({
                where,
                skip,
                take: pageSize,
                orderBy: { menuMaster: { MenuName: 'asc' } },
            }),
            this._db.roleMenuMaster.count({ where }),
        ]);

        items = await Promise.all(
            items.map(async (item) => {
                const [menuMaster, roleMaster] = await Promise.all([
                    item.MenuMasterSid !== null ?
                        this.globalConfigService.getMasterData('menu_master', item.MenuMasterSid) :
                        { MenuMasterSid: null, MenuName: '' },

                    item.RoleMasterSid !== null ?
                        this.globalConfigService.getMasterData('role_master', item.RoleMasterSid) :
                        { RoleMasterSid: null, UserRoleName: '' },
                ])

                return {
                    ...item,
                    menuMaster,
                    roleMaster
                }
            })
        )

        return {
            items,
            totalCount,
        };
    }


    async searchRoleMenuByMenu(filterValue) {
        try {
            const allRoleMenu = await this._db.roleMenuMaster.findMany({
                where: {
                    menuMaster: {
                        MenuName: {
                            contains: filterValue,
                            mode: 'insensitive',
                        },
                    },
                    status: 'A',
                },
                include: {
                    roleMaster: {
                        select: {
                            UserRoleName: true
                        }
                    },
                    menuMaster: {
                        select: {
                            MenuName: true
                        }
                    }
                }
            })
            return allRoleMenu;
        } catch (error) {
            throw error;
        }
    }


    async roleMenuSpecialSearch(data: any) {
        const { moduleName, role, remarks } = data;
        const whereClause: any = {
            status: 'A',
        };


        if (moduleName) whereClause.Module = moduleName;
        if (role) whereClause.RoleMasterSid = Number(role);
        if (remarks) whereClause.Remarks = { contains: remarks, mode: 'insensitive' };


        const fetchedData = await this._db.roleMenuMaster.findMany({
            where: Object.keys(whereClause).length > 0 ? whereClause : undefined,
            include: {
                menuMaster: {
                    select: {
                        MenuName: true,
                    },
                },
            },
        });

        return fetchedData;
    }

    async getRoleMenuPermissions(menuId: number, roleId: number) {
        try {
            const roleMenu = await this._db.roleMenuMaster.findFirst({
                where: {
                    MenuMasterSid: menuId,
                    RoleMasterSid: roleId,
                    status: 'A'
                },
                select: {
                    MenuPermissions: true
                }
            });

            return roleMenu || { MenuPermissions: {} };
        } catch (error) {
            throw error;
        }
    }

}

