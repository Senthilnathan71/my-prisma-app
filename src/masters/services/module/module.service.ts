import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { statusWhereClause } from 'src/common/helper';
import { DatabaseService } from 'src/database/database.service';
import { SearchListDto } from 'src/masters/DTO/search-list.dto';
import { filterDto } from 'src/masters/DTO/search-vessel.dto';

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
          status: 'A'
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

    if (existingmodule.status === 'D') {
      throw new Error(`module with ID ${id} is already deleted`);
    }

    // Perform soft delete by updating deletedAt field
    return this._db.moduleMaster.update({
      where: { ModuleMasterSid: id },
      data: { status: 'D' }
    });
  }


  async searchList(params: filterDto) {
    const { search = '', page = 1, pageSize = 15 } = params;
    const skip = (page - 1) * pageSize;

    const where: Prisma.ModuleMasterWhereInput = {
      status: statusWhereClause,
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
        orderBy: { ModuleMasterSid: 'desc' },
      }),
      this._db.moduleMaster.count({ where }),
    ]);

    return {
      items,
      totalCount,
    };
  }






  // async getModulesWithMenusByRoles(user): Promise<RouteInfo[]> {
  //   try {
  //     const roleIds = user.userRoleMaster.map(role => role.RoleMasterSid);

  //     if (!roleIds.length) {
  //       throw new Error('No roles found for this user.');
  //     }

  //     const roleMenus = await this._db.roleMenuMaster.findMany({
  //       where: {
  //         RoleMasterSid: { in: roleIds }
  //       },
  //       select: {
  //         menuMaster: {
  //           select: {
  //             path: true,
  //             MenuMasterSid: true,
  //             MenuName: true,
  //             icon: true,
  //             // Optional: include Sortorder if you prefer DB-based sorting
  //             // Sortorder: true,
  //             moduleMaster: {
  //               select: {
  //                 ModuleMasterSid: true,
  //                 ModuleName: true,
  //                 icon: true
  //               }
  //             }
  //           }
  //         }
  //       }
  //     });

  //     const flatMenus = roleMenus
  //       .map(r => r.menuMaster)
  //       .filter(m => m && m.moduleMaster);

  //     const grouped: { [key: string]: RouteInfo } = {};

  //     flatMenus.forEach(menu => {
  //       const moduleName = menu.moduleMaster.ModuleName;

  //       if (!grouped[moduleName]) {
  //         grouped[moduleName] = {
  //           path: '',
  //           id: menu.moduleMaster.ModuleMasterSid,
  //           title: moduleName,
  //           icon: menu.moduleMaster.icon || '',
  //           class: '',
  //           extralink: false,
  //           label: '',
  //           labelClass: '',
  //           submenu: []
  //         };
  //       }

  //       grouped[moduleName].submenu.push({
  //         path: menu.path || '',
  //         id: menu.MenuMasterSid,
  //         title: menu.MenuName,
  //         icon: menu.icon || '',
  //         class: '',
  //         extralink: false,
  //         label: '',
  //         labelClass: '',
  //         submenu: []
  //       });
  //     });

  //     // Custom order for CRM submenu
  //     const crmMenuOrder = [
  //       'Lead',
  //       'Lead Schedule Pending',
  //       'Calendar',
  //       'Meeting Update',
  //       'Rate Request',
  //       'Quotation',
  //       'Todo'
  //     ];

  //     const sortedModules = Object.values(grouped)
  //       .map(module => {
  //         const normalize = (s: string) => s.trim().toLowerCase();

  //         const sortedSubmenu = module.title === 'CRM'
  //           ? module.submenu.sort((a, b) => {
  //             const orderA = crmMenuOrder.map(normalize).indexOf(normalize(a.title));
  //             const orderB = crmMenuOrder.map(normalize).indexOf(normalize(b.title));
  //             return (orderA === -1 ? 999 : orderA) - (orderB === -1 ? 999 : orderB);
  //           })
  //           : module.submenu.sort((a, b) => a.title.localeCompare(b.title));

  //         return {
  //           ...module,
  //           submenu: sortedSubmenu
  //         };
  //       })
  //       .sort((a, b) => a.title.localeCompare(b.title)); // Sort modules alphabetically

  //     return sortedModules;
  //   } catch (error) {
  //     console.error('Error fetching menus by roles:', error.message);
  //     return []; // ✅ Ensures function always returns a value
  //   }
  // }


  //   async getModulesWithMenusByRoles(user): Promise<RouteInfo[]> {
  //     try {
  //       const roleIds = user.userRoleMaster.map(role => role.RoleMasterSid);

  //       if (!roleIds.length) {
  //         throw new Error('No roles found for this user.');
  //       }

  //       const roleMenus = await this._db.roleMenuMaster.findMany({
  //         where: {
  //           RoleMasterSid: { in: roleIds }
  //         },
  //         select: {
  //           menuMaster: {
  //             select: {
  //               MenuMasterSid: true,
  //               MenuName: true,
  //               path: true,
  //               icon: true,
  //               parentId: true,
  //               moduleMaster: {
  //                 select: {
  //                   ModuleMasterSid: true,
  //                   ModuleName: true,
  //                   icon: true
  //                 }
  //               }
  //             }
  //           }
  //         }
  //       });

  //       const flatMenus = roleMenus
  //         .map(r => r.menuMaster)
  //         .filter(m => m && m.moduleMaster);

  //       // Group menus by module
  //       const moduleMap = new Map<number, RouteInfo>();

  //       for (const menu of flatMenus) {
  //         const module = menu.moduleMaster;

  //         if (!moduleMap.has(module.ModuleMasterSid)) {
  //           moduleMap.set(module.ModuleMasterSid, {
  //             path: '',
  //             id: module.ModuleMasterSid,
  //             title: module.ModuleName,
  //             icon: module.icon || '',
  //             class: '',
  //             extralink: false,
  //             label: '',
  //             labelClass: '',
  //             submenu: []
  //           });
  //         }
  //       }

  //       // Group menus by parentId for each module
  //       const menusByModule = new Map<number, Map<number | null, any[]>>();

  //       for (const menu of flatMenus) {
  //         const moduleId = menu.moduleMaster.ModuleMasterSid;
  //         if (!menusByModule.has(moduleId)) {
  //           menusByModule.set(moduleId, new Map());
  //         }

  //         const parentMap = menusByModule.get(moduleId)!;
  //         const key = menu.parentId ?? null;

  //         if (!parentMap.has(key)) {
  //           parentMap.set(key, []);
  //         }

  //         parentMap.get(key)!.push(menu);
  //       }

  //       // Function to build menu tree recursively
  //       const buildMenuTree = (
  //         parentId: number | null,
  //         parentMap: Map<number | null, any[]>
  //       ): RouteInfo[] => {
  //         const children = parentMap.get(parentId) || [];

  //         return children.map(menu => ({
  //           path: menu.path || '',
  //           id: menu.MenuMasterSid,
  //           title: menu.MenuName,
  //           icon: menu.icon || '',
  //           class: '',
  //           extralink: false,
  //           label: '',
  //           labelClass: '',
  //           submenu: buildMenuTree(menu.MenuMasterSid, parentMap)
  //         }));
  //       };

  //       // Build final module structure with nested menus
  //       const moduleRoutes = Array.from(moduleMap.entries()).map(([moduleId, moduleRoute]) => {
  //         const parentMap = menusByModule.get(moduleId)!;

  //         const submenu = buildMenuTree(null, parentMap);

  //         // CRM Custom Menu Order
  //       const crmMenuOrder = [
  //         'Lead',
  //         'Opportunity',
  //         'Calendar',
  //         'Meeting Update',
  //         'To Do',
  //         'Enquiry',
  //         'Quotation'
  //       ];
  //         const normalize = (s: string) => s.trim().toLowerCase();
  //         const crmOrderNormalized = crmMenuOrder.map(normalize);


  //         const sortMenus = (menuList: any[]) => {
  //   return (moduleRoute.title === 'crm')
  //     ? menuList.sort((a, b) => {
  //         const orderA = crmOrderNormalized.indexOf(normalize(a.MenuName || ''));
  //         const orderB = crmOrderNormalized.indexOf(normalize(b.MenuName || ''));
  //         return (orderA === -1 ? 999 : orderA) - (orderB === -1 ? 999 : orderB);
  //       })
  //     : menuList.sort((a, b) => (a?.MenuName || '').localeCompare(b?.MenuName || ''));
  // };

  //         return {
  //           ...moduleRoute,
  //           submenu: sortMenus(submenu)
  //         };
  //       });

  //       // Final sort: modules alphabetically
  //       return moduleRoutes.sort((a, b) => a.title.localeCompare(b.title));
  //     } catch (error) {
  //       console.error('Error fetching menus by roles:', error.message,error.stack);
  //       return [];
  //     }
  //   }

  async getModulesWithMenusByRoles(user): Promise<RouteInfo[]> {
    try {
      const roleIds = user.userRoleMaster.map(role => role.RoleMasterSid);

      if (!roleIds.length) {
        throw new Error('No roles found for this user.');
      }

      // 🔹 Step 1: Fetch all RoleMenuDetails for given roleIds
      const roleMenuDetails = await this._db.roleMenuDetail.findMany({
        where: {
          RoleMenuHeader: {
            RoleMasterSid: { in: roleIds },
            status: 'A',
          },
          status: 'A',
        },
        select: {
          InsertRole: true,
          ViewRole: true,
          UpdateRole: true,
          DeleteRole: true,
          ModuleAndMenus: true,
          menuMaster: {
            select: {
              MenuMasterSid: true,
              MenuName: true,
              path: true,
              icon: true,
              parentId: true,
              moduleMaster: {
                select: {
                  ModuleMasterSid: true,
                  ModuleName: true,
                  icon: true,
                },
              },
            },
          },
        },
      });

      if (!roleMenuDetails.length) {
        return [];
      }

      // 🔹 Step 2: Flatten and filter valid menu records
      const flatMenus = roleMenuDetails
        .map(detail => ({
          ...detail.menuMaster,
          permissions: {
            add: detail.InsertRole === 'Y',
            edit: detail.UpdateRole === 'Y',
            view: detail.ViewRole === 'Y',
            delete: detail.DeleteRole === 'Y',
          },
        }))
        .filter(menu => menu && menu.moduleMaster);

      // 🔹 Step 3: Group menus by module
      const moduleMap = new Map<number, RouteInfo>();

      for (const menu of flatMenus) {
        const module = menu.moduleMaster;

        if (!moduleMap.has(module.ModuleMasterSid)) {
          moduleMap.set(module.ModuleMasterSid, {
            path: '',
            id: module.ModuleMasterSid,
            title: module.ModuleName,
            icon: module.icon || '',
            class: '',
            extralink: false,
            label: '',
            labelClass: '',
            submenu: [],
          });
        }
      }

      // 🔹 Step 4: Build parent-child menu relationships (per module)
      const menusByModule = new Map<number, Map<number | null, any[]>>();

      for (const menu of flatMenus) {
        const moduleId = menu.moduleMaster.ModuleMasterSid;

        if (!menusByModule.has(moduleId)) {
          menusByModule.set(moduleId, new Map());
        }

        const parentMap = menusByModule.get(moduleId)!;
        const key = menu.parentId ?? null;

        if (!parentMap.has(key)) {
          parentMap.set(key, []);
        }

        parentMap.get(key)!.push(menu);
      }

      // 🔹 Step 5: Recursive function to build submenu tree
      const buildMenuTree = (
        parentId: number | null,
        parentMap: Map<number | null, any[]>
      ): RouteInfo[] => {
        const children = parentMap.get(parentId) || [];

        return children.map(menu => ({
          path: menu.path || '',
          id: menu.MenuMasterSid,
          title: menu.MenuName,
          icon: menu.icon || '',
          class: '',
          extralink: false,
          label: '',
          labelClass: '',
          permissions: menu.permissions, // include CRUD permissions
          submenu: buildMenuTree(menu.MenuMasterSid, parentMap),
        }));
      };

      // 🔹 Step 6: Build module routes with sorted menus
      const moduleRoutes = Array.from(moduleMap.entries()).map(([moduleId, moduleRoute]) => {
        const parentMap = menusByModule.get(moduleId)!;
        let submenu = buildMenuTree(null, parentMap);

        // CRM Custom Order
        const crmMenuOrder = [
          'Lead',
          'Opportunity',
          'Calendar',
          'Meeting Update',
          'To Do',
          'Enquiry',
          'Quotation',
        ];
        const normalize = (s: string) => s.trim().toLowerCase();
        const crmOrderNormalized = crmMenuOrder.map(normalize);

        const sortMenus = (menuList: any[]) => {
          return moduleRoute.title.toLowerCase() === 'crm'
            ? menuList.sort((a, b) => {
              const orderA = crmOrderNormalized.indexOf(normalize(a.title || ''));
              const orderB = crmOrderNormalized.indexOf(normalize(b.title || ''));
              return (orderA === -1 ? 999 : orderA) - (orderB === -1 ? 999 : orderB);
            })
            : menuList.sort((a, b) => (a.title || '').localeCompare(b.title || ''));
        };

        submenu = sortMenus(submenu);

        return {
          ...moduleRoute,
          submenu,
        };
      });

      // 🔹 Step 7: Sort modules alphabetically
      return moduleRoutes.sort((a, b) => a.title.localeCompare(b.title));
    } catch (error) {
      console.error('Error fetching menus by roles:', error.message, error.stack);
      return [];
    }
  }


  // async getAllModulesWithMenusAsRoutes(): Promise<RouteInfo[]> {
  //   try {
  //     const modules = await this._db.moduleMaster.findMany({
  //       where: {
  //         deletedAt: null
  //       },
  //       select: {
  //         ModuleMasterSid: true,
  //         ModuleName: true,
  //         icon: true,
  //         menuMaster: {
  //           where: {
  //             deletedAt: null,
  //             status: 'A'
  //           },
  //           select: {
  //             MenuMasterSid: true,
  //             path: true,
  //             MenuName: true,
  //             icon: true
  //           }
  //         }
  //       }
  //     });

  //     // CRM Custom Menu Order
  //     const crmMenuOrder = [
  //       'Lead',
  //       'Lead Schedule Pending',
  //       'Calendar',
  //       'Meeting Update',
  //       'Rate Request',
  //       'Quotation',
  //       'Todo'
  //     ];

  //     const normalize = (s: string) => s.trim().toLowerCase();

  //     const sortedModules = modules
  //       .sort((a, b) => a.ModuleName.localeCompare(b.ModuleName))
  //       .map(module => {
  //         let sortedMenus = module.menuMaster;

  //         if (module.ModuleName.trim().toLowerCase() === 'crm') {
  //           sortedMenus = module.menuMaster.sort((a, b) => {
  //             const orderA = crmMenuOrder.map(normalize).indexOf(normalize(a.MenuName));
  //             const orderB = crmMenuOrder.map(normalize).indexOf(normalize(b.MenuName));
  //             return (orderA === -1 ? 999 : orderA) - (orderB === -1 ? 999 : orderB);
  //           });
  //         } else {
  //           sortedMenus = module.menuMaster.sort((a, b) => a.MenuName.localeCompare(b.MenuName));
  //         }

  //         return {
  //           path: '',
  //           id: module.ModuleMasterSid,
  //           title: module.ModuleName,
  //           icon: module.icon || '',
  //           class: '',
  //           extralink: false,
  //           label: '',
  //           labelClass: '',
  //           submenu: sortedMenus.map(menu => ({
  //             path: menu.path || '',
  //             id: menu.MenuMasterSid,
  //             title: menu.MenuName,
  //             icon: menu.icon || '',
  //             class: '',
  //             extralink: false,
  //             label: '',
  //             labelClass: '',
  //             submenu: []
  //           }))
  //         };
  //       });

  //     return sortedModules;
  //   } catch (error) {
  //     throw new Error(`Error fetching modules and menus: ${error.message}`);
  //   }
  // }

  async getAllModulesWithMenusAsRoutes(): Promise<RouteInfo[]> {
    try {
      const modules = await this._db.moduleMaster.findMany({
        where: {
          status: 'A'
        },
        select: {
          ModuleMasterSid: true,
          ModuleName: true,
          icon: true,
          menuMaster: {
            where: {
              status: 'A'
            },
            select: {
              MenuMasterSid: true,
              MenuName: true,
              path: true,
              icon: true,
              parentId: true
            }
          }
        }
      });

      // CRM Custom Menu Order
      const crmMenuOrder = [
        'Lead',
        'Opportunity',
        'Calendar',
        'Meeting Update',
        'To Do',
        'Enquiry',
        'Quotation'
      ];
      const normalize = (s: string) => s.trim().toLowerCase();
      const crmOrderNormalized = crmMenuOrder.map(normalize)
      const sortedModules = modules.map(module => {
        const menus = module.menuMaster;

        // 1. Group menus by parentId
        const menuMap = new Map<number | null, any[]>();

        for (const menu of menus) {
          const key = menu.parentId ?? null;
          if (!menuMap.has(key)) {
            menuMap.set(key, []);
          }
          menuMap.get(key)!.push(menu);
        }

        // 2. Sort function (CRM has custom sort)

        const sortMenus = (menuList: any[]) => {
          return (module.ModuleName.trim().toLowerCase() === 'crm')
            ? menuList.sort((a, b) => {
              const orderA = crmOrderNormalized.indexOf(normalize(a.MenuName));
              const orderB = crmOrderNormalized.indexOf(normalize(b.MenuName));
              return (orderA === -1 ? 999 : orderA) - (orderB === -1 ? 999 : orderB);
            })
            : menuList.sort((a, b) => a.MenuName.localeCompare(b.MenuName));
        }

        // 3. Build submenu recursively
        const buildMenuTree = (parentId: number | null): any[] => {
          const children = menuMap.get(parentId) || [];
          return sortMenus(children).map(menu => ({
            path: menu.path || '',
            id: menu.MenuMasterSid,
            title: menu.MenuName,
            icon: menu.icon || '',
            class: '',
            extralink: false,
            label: '',
            labelClass: '',
            submenu: buildMenuTree(menu.MenuMasterSid)
          }));
        };

        return {
          path: '',
          id: module.ModuleMasterSid,
          title: module.ModuleName,
          icon: module.icon || '',
          class: '',
          extralink: false,
          label: '',
          labelClass: '',
          submenu: buildMenuTree(null) // Top-level menus
        };
      });

      return sortedModules;
    } catch (error) {
      throw new Error(`Error fetching modules and menus: ${error.message}`);
    }
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