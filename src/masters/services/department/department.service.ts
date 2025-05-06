import { Prisma } from './../../../../node_modules/.prisma/client/index.d';
import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { DatabaseService } from 'src/database/database.service';

@Injectable()
export class DepartmentService {
    constructor(private _db: DatabaseService, private logger: Logger) { }


    async createDepartment(payload: Prisma.DepartmentMasterCreateInput, user) {
        this.logger.warn(`createDepartment: ${payload}`);


        const existing = await this._db.departmentMaster.findFirst({
            where: {
                OR: [
                    {
                        departmentName: {
                            equals: payload.departmentName.trim(),
                            mode: 'insensitive',
                        }
                    },
                    {
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
                    createdBy: "admin@crm.com"
                }
            });

            return department;
        } catch (error) {
            throw new Error(`Error creating department: ${error.message}`);
        }
    }


    async getAllDepartments() {
        try {
            const departmentList = await this._db.departmentMaster.findMany({
                where: {
                    Status: 'A'
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


    async updateDepartment(DepartmentMasterSid: number, payload: Prisma.DepartmentMasterUpdateInput, user) {

        const existing = await this._db.departmentMaster.findUnique({
            where: {
                DepartmentMasterSid: DepartmentMasterSid
            }
        });

        if (!existing) {
            throw new Error('Department is not exists');
        }

        try {
            const Department = await this._db.departmentMaster.update({
                where: {
                    DepartmentMasterSid: DepartmentMasterSid
                }, data: payload
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

        if (existingDepartment.deletedAt) {
            throw new Error(`Department with ID ${id} is already deleted`);
        }

        // Perform soft delete by updating deletedAt field
        return this._db.departmentMaster.update({
            where: { DepartmentMasterSid: id },
            data: { deletedAt: new Date() }
        });
    }
}
