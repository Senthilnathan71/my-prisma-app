import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { DatabaseService } from 'src/database/database.service';
import { SearchListDto } from 'src/masters/DTO/search-list.dto';

@Injectable()
export class BranchService {
    constructor(private _db: DatabaseService) { }

    async createNewBranch(newData: Prisma.BranchMasterCreateInput) {
        try {
            const createdBranch = await this._db.branchMaster.create({
                data: {
                    ...newData,
                    createdBy: 'admin@crm.com'
                }
            })
            return createdBranch;
        } catch (error) {
            throw error;
        }
    }

    async getAllBranches() {
        try {
            const allBranches = await this._db.branchMaster.findMany({
                where: {
                    deletedAt: null
                }
            })
            return allBranches;
        } catch (error) {
            throw error;
        }
    }

    async getBranchById(BranchMasterSid: number) {
        try {
            const ourBranch = await this._db.branchMaster.findUnique({
                where: {
                    BranchMasterSid: BranchMasterSid
                }
            })
            if (!ourBranch) {
                throw new BadRequestException(`Branch with id : ${BranchMasterSid} not exists`);
            }
            return ourBranch;
        } catch (error) {
            throw error;
        }
    }

    async updateBranchById(BranchMasterSid: number, updateData: Prisma.BranchMasterUpdateInput) {
        try {
            const exist = await this._db.branchMaster.findUnique({
                where: {
                    BranchMasterSid: BranchMasterSid
                }
            })
            if (!exist) {
                throw new BadRequestException(`Branch with id : ${BranchMasterSid} not exists`);
            }
            const updatedBranch = await this._db.branchMaster.update({
                where: {
                    BranchMasterSid: BranchMasterSid
                }, data: updateData
            })
            return updatedBranch;
        } catch (error) {
            throw error;
        }
    }

    async deleteBranchById(BranchMasterSid: number) {
        try {
            const exist = await this._db.branchMaster.findUnique({
                where: {
                    BranchMasterSid: BranchMasterSid
                }
            })
            if (!exist) {
                throw new BadRequestException(`Branch with id : ${BranchMasterSid} not exists`);
            }
            if (exist.deletedAt) {
                throw new BadRequestException(`Branch with id : ${BranchMasterSid} is already deleted`);
            }
            const deletedBranch = await this._db.branchMaster.update({
                where: {
                    BranchMasterSid: BranchMasterSid
                }, data: {
                    deletedAt: new Date()
                }
            })
            return deletedBranch;
        } catch (error) {
            throw error;
        }
    }


    async searchBranch(data: SearchListDto) {
        const { searchType, filterValue } = data;
        const acceptedType = [
            "branchName",
            "branchCode",
            "taxRegistrationNo",
            "CISN",
            "addressLine1",
            "addressLine2",
            "postalCode",
            "webSite",
            "phoneNumber",
            "email",
            "timeZone",
            "companyLogo",
            "reportLogo",
            "status"
        ];
        if (!acceptedType.includes(searchType)) {
            throw new BadRequestException(`Invalid Search Type`);
        }
        const searchResults = await this._db.branchMaster.findMany({
            where: {
                [searchType]: {
                    contains: filterValue,
                    mode: 'insensitive'
                }
            }
        }).catch((err) => {
            throw new Error(`Error Occured : ${JSON.stringify(err), err}`);
        })
        return searchResults;
    }
}
