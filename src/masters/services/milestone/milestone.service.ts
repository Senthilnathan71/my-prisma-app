import { BadRequestException, Injectable } from '@nestjs/common';
import { DatabaseService } from 'src/database/database.service';
import { SearchListDto } from 'src/masters/DTO/search-list.dto';

@Injectable()
export class MilestoneService {
    constructor(private _db: DatabaseService) { }

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

    async searchMilestone(data: SearchListDto) {
        const { searchType, filterValue } = data;
        const intFields = [
            'MilestoneMasterSid',
            'CompanyMasterSid',
            'BranchMasterSid',
            'DepartmentMasterSid',
            'SortBy'
        ];
        const stringFields = [
            'MilestoneName',
            'MilestoneCode',
            'AutomailRequire',
            'ShipmentType',
            'AutoCapture',
            'status',
            'Remarks'
        ];
        const acceptedType = [...intFields, ...stringFields];
        if (!acceptedType.includes(searchType)) {
            throw new BadRequestException('Invalid Search Type');
        }

        const whereClause: any = {};

        if (stringFields.includes(searchType)) {
            whereClause[searchType] = {
                contains: filterValue,
                mode: 'insensitive'
            };
        } else if (intFields.includes(searchType)) {
            const numberValue = parseInt(filterValue);
            if (isNaN(numberValue)) {
                throw new BadRequestException(`${searchType} must be a valid number`);
            }
            whereClause[searchType] = numberValue;
        }

        const searchResults = await this._db.milestoneMaster.findMany({
            where: {
                ...whereClause,
                deletedAt: null
            },
            include: {
                departmentMaster: true,
                branchMaster: true,
                companyMaster: true
            }
        }).catch((err) => {
            throw new Error(`Error Occurred : ${JSON.stringify(err)}`);
        });

        return searchResults;
    }
}