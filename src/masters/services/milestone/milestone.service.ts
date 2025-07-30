import { BadRequestException, Injectable } from '@nestjs/common';
import { GlobalConfigService } from 'src/common/config/master-config.service';
import { DatabaseService } from 'src/database/database.service';
import { SearchListDto } from 'src/masters/DTO/search-list.dto';
import { SearchVesselDto } from 'src/masters/DTO/search-vessel.dto';

@Injectable()
export class MilestoneService {
    constructor(private _db: DatabaseService,private globalConfigService :GlobalConfigService) { }

    async getAllMilestones() {
        try {
            const allMilestones = await this._db.milestoneMaster.findMany({
                where: {
                    deletedAt: null
                },
                include: {
                    departmentMaster: true,
                    branchMaster: true,
                    companyMaster: true
                }
            });
            return allMilestones;
        } catch (error) {
            throw error;
        }
    }

    async createNewMilestone(payload: any) {
        try {
            const createdMilestone = await this._db.milestoneMaster.create({
                data: {
                    ...payload,
                },
                include: {
                    departmentMaster: true,
                    branchMaster: true,
                    companyMaster: true
                }
            });
            return createdMilestone;
        } catch (error) {
            throw error;
        }
    }

    async fetchMilestoneById(MilestoneMasterSid: number) {
        try {
            const milestone = await this._db.milestoneMaster.findUnique({
                where: {
                    MilestoneMasterSid: MilestoneMasterSid
                },
                include: {
                    departmentMaster: true,
                    branchMaster: true,
                    companyMaster: true
                }
            });
            if (!milestone) {
                throw new BadRequestException(`Milestone with Id : ${MilestoneMasterSid} not exists`);
            }
            return milestone;
        } catch (error) {
            throw error;
        }
    }

    async updateMilestoneById(MilestoneMasterSid: number, payload: any) {
        try {
            const exist = await this._db.milestoneMaster.findUnique({
                where: {
                    MilestoneMasterSid: MilestoneMasterSid
                }
            });
            if (!exist) {
                throw new BadRequestException(`Milestone with Id : ${MilestoneMasterSid} not exists`);
            }
            const updatedMilestone = await this._db.milestoneMaster.update({
                where: {
                    MilestoneMasterSid: MilestoneMasterSid
                },
                data: payload,
                include: {
                    departmentMaster: true,
                    branchMaster: true,
                    companyMaster: true
                }
            });
            return updatedMilestone;
        } catch (error) {
            throw error;
        }
    }

    async deleteMilestone(MilestoneMasterSid: number) {
        try {
            const exist = await this._db.milestoneMaster.findUnique({
                where: {
                    MilestoneMasterSid: MilestoneMasterSid
                }
            });
            if (!exist) {
                throw new BadRequestException(`Milestone with Id : ${MilestoneMasterSid} not exists`);
            }
            if (exist.deletedAt) {
                throw new BadRequestException(`Milestone with Id :${MilestoneMasterSid} is already deleted`);
            }
            const deletedMilestone = await this._db.milestoneMaster.update({
                where: {
                    MilestoneMasterSid: MilestoneMasterSid
                },
                data: {
                    deletedAt: new Date()
                },
                include: {
                    departmentMaster: true,
                    branchMaster: true,
                    companyMaster: true
                }
            });
            return deletedMilestone;
        } catch (error) {
            throw error;
        }
    }

    async searchMilestone(params: SearchVesselDto) {
    const { search = '', page = 1, pageSize = 15 } = params;
    const skip = (page - 1) * pageSize;

    const where: any = {
        deletedAt: null,
        status: 'A',
        ...(search
            ? {
                OR: [
                    { MilestoneName: { contains: search, mode: 'insensitive'} },
                    { MilestoneCode: { contains: search, mode: 'insensitive'} },
                    { ShipmentType: { contains: search, mode: 'insensitive'} },
                    { status: { contains: search, mode: 'insensitive'} },
                    { Remarks: { contains: search, mode: 'insensitive'} },
                ],
            }
            : {}
        ),
    };

    let items;
    let totalCount;
    [items, totalCount] = await this._db.$transaction([
        this._db.milestoneMaster.findMany({
            where,
            skip,
            take: pageSize,
            orderBy: { MilestoneMasterSid: 'desc'},
        }),
        this._db.milestoneMaster.count({ where }),
    ]);

    items = await Promise.all(
        items.map(async (item)=>{
            const departmentMaster = item.DepartmentMasterSid !== null ? 
            await this.globalConfigService.getMasterData('department_master',item.DepartmentMasterSid,item.CompanyMasterSid) : 
            { DepartmentMasterSid : null , departmentName : ''};

            return {
                ...item,
                departmentMaster
            }

        })
    )

    return {
        items,
        totalCount,
    };
}
}