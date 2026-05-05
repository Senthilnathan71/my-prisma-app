import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { statusWhereClause } from 'src/common/helper';
import { DatabaseService } from 'src/database/database.service';
import { SearchListDto } from 'src/masters/DTO/search-list.dto';
import { filterDto } from 'src/masters/DTO/search-vessel.dto';

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
                }
            });

            return role;
        } catch (error) {
            throw new Error(`Error creating role: ${error.message}`);
        }
    }


    async getAllRoles(CompanyMasterSid: number) {
        try {
            const selectedCompanySid = Number(CompanyMasterSid);
            if (!Number.isFinite(selectedCompanySid) || selectedCompanySid <= 0) {
                throw new BadRequestException('CompanyMasterSid is required');
            }
            const roleList = await this._db.roleMaster.findMany({
                where: {
                    status: 'A',
                    CompanyMasterSid: selectedCompanySid
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

        if (existingrole.status === 'D') {
            throw new Error(`role with ID ${id} is already deleted`);
        }

        // Perform soft delete by updating deletedAt field
        return this._db.roleMaster.update({
            where: { RoleMasterSid: id },
            data: { status: 'D' }
        });
    }


    async searchList(params: filterDto) {
        const {
            search = '',
            page = 1,
            pageSize = 15,
            activeCompanyId,
            CurrentCompanySid,
            currentCompanySid
        } = params;
        const skip = (page - 1) * pageSize;
        const companySid = Number(activeCompanyId ?? CurrentCompanySid ?? currentCompanySid);
        if (!Number.isFinite(companySid) || companySid <= 0) {
            throw new BadRequestException('CompanyMasterSid is required');
        }

        const where: Prisma.RoleMasterWhereInput = {
            status: statusWhereClause,
            CompanyMasterSid: companySid,
            ...(search
                ? {
                    OR: [
                        { UserRoleName: { contains: search, mode: 'insensitive' } },
                        { UserRoleCode: { contains: search, mode: 'insensitive' } },
                        { status: { contains: search, mode: 'insensitive' } },
                    ],
                }
                : {}
            ),
        };

        const [items, totalCount] = await this._db.$transaction([
            this._db.roleMaster.findMany({
                where,
                skip,
                take: pageSize,
                orderBy: { RoleMasterSid: 'desc' },
            }),
            this._db.roleMaster.count({ where }),
        ]);

        return {
            items,
            totalCount,
        };
    }
}
