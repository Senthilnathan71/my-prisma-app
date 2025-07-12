import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { DatabaseService } from 'src/database/database.service';
import { SearchListDto } from 'src/masters/DTO/search-list.dto';
import { SearchVesselDto } from 'src/masters/DTO/search-vessel.dto';

@Injectable()
export class ModuleService {
  constructor(private _db: DatabaseService, private logger: Logger) { }


  async createModule(payload: any, user) {
    this.logger.warn(`createmodule: ${payload}`);


    const existing = await this._db.moduleMaster.findFirst({
      where: {
        OR: [
          {
            ModuleName: {
              equals: payload.ModuleName.trim(),
              mode: 'insensitive',
            }
          }
        ]
      },
    });

    if (existing) {
      if (existing.ModuleName === payload.ModuleName) {
        throw new BadRequestException('module name already exists');
      }
    }

    try {
      const module = await this._db.moduleMaster.create({
        data: {
          ...payload,
        }
      });

      return module;
    } catch (error) {
      throw new Error(`Error creating module: ${error.message}`);
    }
  }


  async getAllModules() {
    try {
      const moduleList = await this._db.moduleMaster.findMany({
        where: {
          deletedAt: null
        }
      })
      return moduleList;
    } catch (error) {
      throw error
    }
  }

  async findOne(moduleMasterSid: any) {
    try {
      return await this._db.moduleMaster.findUnique({
        where: {
          ModuleMasterSid: moduleMasterSid
        },
      });
    } catch (error) {
      throw error;
    }
  }


  async updateModule(moduleMasterSid: number, payload: any, user) {

    const existing = await this._db.moduleMaster.findUnique({
      where: {
        ModuleMasterSid: moduleMasterSid
      }
    });

    if (!existing) {
      throw new Error('module is not exists');
    }

    try {
      const module = await this._db.moduleMaster.update({
        where: {
          ModuleMasterSid: moduleMasterSid
        }, data: payload
      });
      return module;
    } catch (error) {
      throw new Error(`Error updating module: ${error.message}`);
    }
  }




  async softDelete(id: number) {
    const existingmodule = await this._db.moduleMaster.findUnique({
      where: { ModuleMasterSid: id }
    });

    if (!existingmodule) {
      throw new NotFoundException(`module with ID ${id} not found`);
    }

    if (existingmodule.deletedAt) {
      throw new Error(`module with ID ${id} is already deleted`);
    }

    // Perform soft delete by updating deletedAt field
    return this._db.moduleMaster.update({
      where: { ModuleMasterSid: id },
      data: { deletedAt: new Date() }
    });
  }


  async searchList(params: SearchVesselDto) {
    const { search = '', page = 1, pageSize = 10 } = params;
    const skip = (page - 1) * pageSize;

    const where: Prisma.ModuleMasterWhereInput  = {
        deletedAt: null,
        ...(search
            ? {
                OR: [
                    { ModuleName: { contains: search, mode: 'insensitive' } },
                    { ModuleCode: { contains: search, mode: 'insensitive' } },
                    { Remarks: { contains: search, mode: 'insensitive' } },
                    { status: { contains: search, mode: 'insensitive' } },
                ],
            }
            : {}
        ),
    };

    const [items, totalCount] = await this._db.$transaction([
        this._db.moduleMaster.findMany({
            where,
            skip,
            take: pageSize,
            include: {
                menuMaster: true,
            },
            orderBy: { ModuleMasterSid: 'desc' },
        }),
        this._db.moduleMaster.count({ where }),
    ]);

    return {
        items,
        totalCount,
    };
}






 async getModulesWithMenusByRoles(user): Promise<RouteInfo[]> {
  try {
    const roleIds = user.userRoleMaster.map(role => role.RoleMasterSid);

    if (!roleIds.length) {
      throw new Error('No roles found for this user.');
    }

    const roleMenus = await this._db.roleMenuMaster.findMany({
      where: {
        RoleMasterSid: { in: roleIds }
      },
      select: {
        menuMaster: {
          select: {
            path: true,
            MenuMasterSid: true,
            MenuName: true,
            icon: true,
            // Optional: include Sortorder if you prefer DB-based sorting
            // Sortorder: true,
            moduleMaster: {
              select: {
                ModuleMasterSid: true,
                ModuleName: true,
                icon: true
              }
            }
          }
        }
      }
    });

    const flatMenus = roleMenus
      .map(r => r.menuMaster)
      .filter(m => m && m.moduleMaster);

    const grouped: { [key: string]: RouteInfo } = {};

    flatMenus.forEach(menu => {
      const moduleName = menu.moduleMaster.ModuleName;

      if (!grouped[moduleName]) {
        grouped[moduleName] = {
          path: '',
          id: menu.moduleMaster.ModuleMasterSid,
          title: moduleName,
          icon: menu.moduleMaster.icon || '',
          class: '',
          extralink: false,
          label: '',
          labelClass: '',
          submenu: []
        };
      }

      grouped[moduleName].submenu.push({
        path: menu.path || '',
        id: menu.MenuMasterSid,
        title: menu.MenuName,
        icon: menu.icon || '',
        class: '',
        extralink: false,
        label: '',
        labelClass: '',
        submenu: []
      });
    });

    // Custom order for CRM submenu
    const crmMenuOrder = [
      'Lead',
      'Lead Schedule Pending',
      'Calendar',
      'Meeting Update',
      'Rate Request',
      'Quotation',
      'Todo'
    ];

    const sortedModules = Object.values(grouped)
      .map(module => {
        const normalize = (s: string) => s.trim().toLowerCase();

        const sortedSubmenu = module.title === 'CRM'
          ? module.submenu.sort((a, b) => {
              const orderA = crmMenuOrder.map(normalize).indexOf(normalize(a.title));
              const orderB = crmMenuOrder.map(normalize).indexOf(normalize(b.title));
              return (orderA === -1 ? 999 : orderA) - (orderB === -1 ? 999 : orderB);
            })
          : module.submenu.sort((a, b) => a.title.localeCompare(b.title));

        return {
          ...module,
          submenu: sortedSubmenu
        };
      })
      .sort((a, b) => a.title.localeCompare(b.title)); // Sort modules alphabetically

    return sortedModules;
  } catch (error) {
    console.error('Error fetching menus by roles:', error.message);
    return []; // ✅ Ensures function always returns a value
  }
}



async getAllModulesWithMenusAsRoutes(): Promise<RouteInfo[]> {
  try {
    const modules = await this._db.moduleMaster.findMany({
      where: {
        deletedAt: null
      },
      select: {
        ModuleMasterSid: true,
        ModuleName: true,
        icon: true,
        menuMaster: {
          where: {
            deletedAt: null,
            status: 'A'
          },
          select: {
            MenuMasterSid: true,
            path: true,
            MenuName: true,
            icon: true
          }
        }
      }
    });

    // CRM Custom Menu Order
    const crmMenuOrder = [
      'Lead',
      'Lead Schedule Pending',
      'Calendar',
      'Meeting Update',
      'Rate Request',
      'Quotation',
      'Todo'
    ];

    const normalize = (s: string) => s.trim().toLowerCase();

    const sortedModules = modules
      .sort((a, b) => a.ModuleName.localeCompare(b.ModuleName))
      .map(module => {
        let sortedMenus = module.menuMaster;

        if (module.ModuleName.trim().toLowerCase() === 'crm') {
          sortedMenus = module.menuMaster.sort((a, b) => {
            const orderA = crmMenuOrder.map(normalize).indexOf(normalize(a.MenuName));
            const orderB = crmMenuOrder.map(normalize).indexOf(normalize(b.MenuName));
            return (orderA === -1 ? 999 : orderA) - (orderB === -1 ? 999 : orderB);
          });
        } else {
          sortedMenus = module.menuMaster.sort((a, b) => a.MenuName.localeCompare(b.MenuName));
        }

        return {
          path: '',
          id: module.ModuleMasterSid,
          title: module.ModuleName,
          icon: module.icon || '',
          class: '',
          extralink: false,
          label: '',
          labelClass: '',
          submenu: sortedMenus.map(menu => ({
            path: menu.path || '',
            id: menu.MenuMasterSid,
            title: menu.MenuName,
            icon: menu.icon || '',
            class: '',
            extralink: false,
            label: '',
            labelClass: '',
            submenu: []
          }))
        };
      });

    return sortedModules;
  } catch (error) {
    throw new Error(`Error fetching modules and menus: ${error.message}`);
  }
}



 mapRoleMenusToRoutes(roleMenus): RouteInfo[] {
  const routeMap: { [key: string]: RouteInfo } = {};

  const crmMenuOrder = [
    'Lead',
    'Lead Schedule Pending',
    'Calendar',
    'Meeting Update',
    'Rate Request',
    'Quotation',
    'Todo'
  ];

  const normalize = (s: string) => s.trim().toLowerCase();

  for (const item of roleMenus) {
    const menu = item.menuMaster;
    const module = menu.moduleMaster;

    if (!routeMap[module.ModuleName]) {
      routeMap[module.ModuleName] = {
        path: '',
        id: module.ModuleMasterSid,
        title: module.ModuleName,
        icon: module.icon || '',
        class: '',
        extralink: false,
        label: '',
        labelClass: '',
        submenu: []
      };
    }

    routeMap[module.ModuleName].submenu.push({
      path: menu.path || '',
      id: menu.MenuMasterSid,
      title: menu.MenuName,
      icon: menu.icon || '',
      class: '',
      extralink: false,
      label: '',
      labelClass: '',
      submenu: []
    });
  }

  // Sort CRM submenu only
  Object.keys(routeMap).forEach(moduleName => {
    const route = routeMap[moduleName];
    if (moduleName.trim().toLowerCase() === 'crm') {
      route.submenu.sort((a, b) => {
        const orderA = crmMenuOrder.map(normalize).indexOf(normalize(a.title));
        const orderB = crmMenuOrder.map(normalize).indexOf(normalize(b.title));
        return (orderA === -1 ? 999 : orderA) - (orderB === -1 ? 999 : orderB);
      });
    } else {
      route.submenu.sort((a, b) => a.title.localeCompare(b.title));
    }
  });

  return Object.values(routeMap);
}




}


export interface RouteInfo {
  path: string;
  id: number;
  title: string;
  icon: string;
  class: string;
  extralink: boolean;
  label: string;
  labelClass: string;
  submenu: RouteInfo[];
}