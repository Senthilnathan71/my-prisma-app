import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { DatabaseService } from 'src/database/database.service';
import { SearchListDto } from 'src/masters/DTO/search-list.dto';

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
                    createdBy: "admin@crm.com"
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

        if (existingmodule.deletedAt) {
            throw new Error(`module with ID ${id} is already deleted`);
        }

        // Perform soft delete by updating deletedAt field
        return this._db.moduleMaster.update({
            where: { ModuleMasterSid: id },
            data: { deletedAt: new Date() }
        });
    }


    async searchList(dto: SearchListDto) {
        const { searchType, filterValue } = dto;

        // Whitelist allowed fields to prevent SQL injection or invalid column access
        //write column names
        const allowedFields = [
            'ModuleName',
            'MenuName',
            'MenuCode',
            'MenuType',
            'status',
        ];

        if (!allowedFields.includes(searchType)) {
            throw new BadRequestException('Invalid search type');
        }

        // Dynamically build query
        const modules = await this._db.moduleMaster.findMany({
            where: {
                [searchType]: {
                    contains: filterValue,
                    mode: 'insensitive',
                },
                deletedAt: null,
            }, include: {
                menuMaster: true
            }
        }).catch(err => {
            throw new Error(`Error Search module: ${err}`);
        });
        return modules;
    }
}
