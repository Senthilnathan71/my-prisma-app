import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { DatabaseService } from 'src/database/database.service';
import { SearchListDto } from 'src/masters/DTO/search-list.dto';
import { SearchVesselDto } from 'src/masters/DTO/search-vessel.dto';

@Injectable()
export class DepartmentService {
    constructor(private _db: DatabaseService, private logger: Logger) { }


    async createDepartment(payload: any) {
        this.logger.warn(`createDepartment: ${payload}`);


        const existing = await this._db.departmentMaster.findFirst({
            where: {
                OR: [
                    {
                        CompanyMasterSid:payload. CompanyMasterSid,
                        departmentName: {
                            equals: payload.departmentName.trim(),
                            mode: 'insensitive',
                        }
                    },
                    {
                        CompanyMasterSid:payload. CompanyMasterSid,
                        departmentCode: {
                            equals: payload.departmentCode.trim(),
                            mode: 'insensitive',
                        }
                    }
                ]
            },
        });

        if (existing) {
            if (existing.departmentName === payload.departmentName) {
                throw new BadRequestException('Department name already exists');
            }
            if (existing.departmentCode === payload.departmentCode) {
                throw new BadRequestException('Department code already exists');
            }
        }

        try {
            const department = await this._db.departmentMaster.create({
                data: {
                    ...payload,
                }
            });

            return department;
        } catch (error) {
            throw new Error(`Error creating department: ${error.message}`);
        }
    }


    async getAllDepartments(CompanyMasterSid: number) {
        try {
            const departmentList = await this._db.departmentMaster.findMany({
                where: {
                    Status: 'A',
                    CompanyMasterSid: CompanyMasterSid
                }
            })
            return departmentList;
        } catch (error) {
            throw error
        }
    }



    async findOne(DepartmentMasterSid: any) {
        try {
            return await this._db.departmentMaster.findUnique({
                where: {
                    DepartmentMasterSid: DepartmentMasterSid
                },
            });
        } catch (error) {
            throw error;
        }
    }


    async updateDepartment(DepartmentMasterSid: number, payload: any) {
    const existing = await this._db.departmentMaster.findUnique({
        where: {
            DepartmentMasterSid: DepartmentMasterSid
        }
    });

    if (!existing) {
        throw new NotFoundException('Department does not exist');
    }

    const duplicate = await this._db.departmentMaster.findFirst({
        where: {
            AND: [
                {
                    CompanyMasterSid:payload. CompanyMasterSid,
                    DepartmentMasterSid: {
                        not: DepartmentMasterSid
                    }
                },
                {
                    OR: [
                        {
                            CompanyMasterSid:payload. CompanyMasterSid,
                            departmentName: {
                                equals: payload.departmentName?.trim(),
                                mode: 'insensitive'
                            }
                        },
                        {
                            CompanyMasterSid:payload. CompanyMasterSid,
                            departmentCode: {
                                equals: payload.departmentCode?.trim(),
                                mode: 'insensitive'
                            }
                        }
                    ]
                }
            ]
        }
    });

    if (duplicate) {
        if (duplicate.departmentName === payload.departmentName) {
            throw new BadRequestException('Department name already exists');
        }
        if (duplicate.departmentCode === payload.departmentCode) {
            throw new BadRequestException('Department code already exists');
        }
    }

    try {
        const Department = await this._db.departmentMaster.update({
            where: {
                DepartmentMasterSid: DepartmentMasterSid
            }, 
            data: payload
        });
        return Department;
    } catch (error) {
        throw new Error(`Error updating Department: ${error.message}`);
    }
}



    async softDelete(id: number) {
        const existingDepartment = await this._db.departmentMaster.findUnique({
            where: { DepartmentMasterSid: id }
        });

        if (!existingDepartment) {
            throw new NotFoundException(`Department with ID ${id} not found`);
        }

        if (existingDepartment.Status==="D") {
            throw new Error(`Department with ID ${id} is already deleted`);
        }

        // Perform soft delete by updating deletedAt field
        return this._db.departmentMaster.update({
            where: { DepartmentMasterSid: id },
            data: {Status:"D" }
        });
    }


    async searchList(params: SearchVesselDto) {
    const { search = '', page = 1, pageSize = 15, activeCompanyId } = params;
    const skip = (page - 1) * pageSize;

    const where: Prisma.DepartmentMasterWhereInput = {
      
        Status: 'A',
        CompanyMasterSid : activeCompanyId,
        ...(search
            ? {
                OR: [
                    { departmentName: { contains: search, mode: 'insensitive' } },
                    { departmentCode: { contains: search, mode: 'insensitive' } },
                    { departmentType: { contains: search, mode: 'insensitive' } },
                    { ExportImport: { contains: search, mode: 'insensitive' } },
                    { FCLLCL: { contains: search, mode: 'insensitive' } },
                    { Division: { contains: search, mode: 'insensitive' } },
                    { Status: { contains: search, mode: 'insensitive' } },
                ],
            }
            : {}
        ),
    };

    const [items, totalCount] = await this._db.$transaction([
        this._db.departmentMaster.findMany({
            where,
            skip,
            take: pageSize,
            orderBy: { DepartmentMasterSid: 'desc' },
        }),
        this._db.departmentMaster.count({ where }),
    ]);

    return {
        items,
        totalCount,
    };
}

async getAuditLogs(tableName: string, recordId?: string) {
    try {
      const whereClause: any = { tableName };
      if (recordId) whereClause.recordId = recordId;

      const logs = await this._db.auditLog.findMany({
        where: whereClause,
        orderBy: { changedAt: 'desc' },
      });

      return logs;
    } catch (error) {
      this.logger.warn(`getAuditLogsError: ${error}`);
      throw new Error(`Error fetching audit logs: ${error.message}`);
    }
  }
}
