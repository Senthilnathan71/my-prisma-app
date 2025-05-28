import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { DatabaseService } from 'src/database/database.service';
import { SearchListDto } from 'src/masters/DTO/search-list.dto';

@Injectable()
export class RoleService {
    constructor(private _db: DatabaseService, private logger: Logger) { }


    async createRole(payload: any, user) {
        this.logger.warn(`createrole: ${payload}`);


        const existing = await this._db.roleMaster.findFirst({
            where: {
                OR: [
                    {
                        UserRoleName: {
                            equals: payload.UserRoleName.trim(),
                            mode: 'insensitive',
                        }
                    }
                ]
            },
        });

        if (existing) {
            if (existing.UserRoleName === payload.UserRoleName) {
                throw new BadRequestException('role name already exists');
            }
        }

        try {
            const role = await this._db.roleMaster.create({
                data: {
                    ...payload,
                    createdBy: "admin@crm.com"
                }
            });

            return role;
        } catch (error) {
            throw new Error(`Error creating role: ${error.message}`);
        }
    }


    async getAllRoles() {
        try {
            const roleList = await this._db.roleMaster.findMany({
                where: {
                    status: 'A'
                }
            })
            return roleList;
        } catch (error) {
            throw error
        }
    }



    async findOne(roleMasterSid: any) {
        try {
            return await this._db.roleMaster.findUnique({
                where: {
                    RoleMasterSid: roleMasterSid
                },
            });
        } catch (error) {
            throw error;
        }
    }


    async updateRole(roleMasterSid: number, payload: any, user) {

        const existing = await this._db.roleMaster.findUnique({
            where: {
                RoleMasterSid: roleMasterSid
            }
        });

        if (!existing) {
            throw new Error('role is not exists');
        }

        try {
            const role = await this._db.roleMaster.update({
                where: {
                    RoleMasterSid: roleMasterSid
                }, data: payload
            });
            return role;
        } catch (error) {
            throw new Error(`Error updating role: ${error.message}`);
        }
    }




    async softDelete(id: number) {
        const existingrole = await this._db.roleMaster.findUnique({
            where: { RoleMasterSid: id }
        });

        if (!existingrole) {
            throw new NotFoundException(`role with ID ${id} not found`);
        }

        if (existingrole.deletedAt) {
            throw new Error(`role with ID ${id} is already deleted`);
        }

        // Perform soft delete by updating deletedAt field
        return this._db.roleMaster.update({
            where: { RoleMasterSid: id },
            data: { deletedAt: new Date() }
        });
    }


    async searchList(dto: SearchListDto) {
        const { searchType, filterValue } = dto;

        // Whitelist allowed fields to prevent SQL injection or invalid column access
        //write column names
        const allowedFields = [
            'UserRoleName',
            'UserRoleCode',
            'status',
        ];

        if (!allowedFields.includes(searchType)) {
            throw new BadRequestException('Invalid search type');
        }

        // Dynamically build query
        const roles = await this._db.roleMaster.findMany({
            where: {
                [searchType]: {
                    contains: filterValue,
                    mode: 'insensitive',
                },
                deletedAt: null,
            }
        }).catch(err => {
            throw new Error(`Error Search role: ${err}`);
        });
        return roles;
    }
}
