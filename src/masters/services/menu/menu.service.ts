import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { DatabaseService } from 'src/database/database.service';
import { SearchListDto } from 'src/masters/DTO/search-list.dto';

@Injectable()
export class MenuService {
    constructor(private _db: DatabaseService, private logger: Logger) { }


    async createMenu(payload: any, user) {
        this.logger.warn(`createmenu: ${payload}`);


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
                throw new BadRequestException('menu name already exists');
            }
            if (existing.MenuCode === payload.MenuCode) {
                throw new BadRequestException('menu code already exists');
            }
        }

        try {
            const menu = await this._db.menuMaster.create({
                data: {
                    ...payload,
                }
            });

            return menu;
        } catch (error) {
            throw new Error(`Error creating menu: ${error.message}`);
        }
    }


    async getAllMenus() {
        try {
            const menuList = await this._db.menuMaster.findMany({
                where: {
                    status: 'A'
                }
            })
            return menuList;
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
            throw new Error('menu is not exists');
        }

        try {
            const menu = await this._db.menuMaster.update({
                where: {
                    MenuMasterSid: menuMasterSid
                }, data: payload
            });
            return menu;
        } catch (error) {
            throw new Error(`Error updating menu: ${error.message}`);
        }
    }




    async softDelete(id: number) {
        const existingmenu = await this._db.menuMaster.findUnique({
            where: { MenuMasterSid: id }
        });

        if (!existingmenu) {
            throw new NotFoundException(`menu with ID ${id} not found`);
        }

        if (existingmenu.deletedAt) {
            throw new Error(`menu with ID ${id} is already deleted`);
        }

        // Perform soft delete by updating deletedAt field
        return this._db.menuMaster.update({
            where: { MenuMasterSid: id },
            data: { deletedAt: new Date() }
        });
    }


    async searchList(dto: SearchListDto) {
        const { searchType, filterValue } = dto;

        // Whitelist allowed fields to prevent SQL injection or invalid column access
        //write column names
        const allowedFields = [
            'MenuName',
            'MenuCode',
            'MenuType',
            'ModuleName',
            'status',
        ];

        if (!allowedFields.includes(searchType)) {
            throw new BadRequestException('Invalid search type');
        }

        // Dynamically build query
        const menus = await this._db.menuMaster.findMany({
            where: {
                [searchType]: {
                    contains: filterValue,
                    mode: 'insensitive',
                },
                deletedAt: null,
            },
        }).catch(err => {
            throw new Error(`Error Search menu: ${err}`);
        });
        return menus;


    }
}
