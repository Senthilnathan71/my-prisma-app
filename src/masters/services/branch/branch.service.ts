import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { DatabaseService } from 'src/database/database.service';
import { SearchListDto } from 'src/masters/DTO/search-list.dto';

@Injectable()
export class BranchService {
    constructor(private _db: DatabaseService, private logger: Logger) { }

    async createNewBranch(newData: any, logo) {
        try {
            const createdBranch = await this._db.branchMaster.create({
                data: {
                    ...newData,
                },
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
                    status : 'A'
                },
                include: {
                    cityMaster: {
                        select: {
                            cityName: true,
                            stateMaster: {
                                select: {
                                    stateName: true,
                                    countryMaster: {
                                        select: {
                                            countryName: true
                                        }
                                    }
                                }
                            }
                        }
                    },
                    company: {
                        select: {
                            companyName: true
                        }
                    }

                }
            })
            return allBranches;
        } catch (error) {
            throw error;
        }
    }

     async getCurrentBranch(CompanyMasterSid: number) {
        try {
            const allBranches = await this._db.branchMaster.findMany({
                where: {
                    status : 'A',
                    CompanyMasterSid: CompanyMasterSid
                },
                include: {
                    cityMaster: {
                        select: {
                            cityName: true,
                            stateMaster: {
                                select: {
                                    stateName: true,
                                    countryMaster: {
                                        select: {
                                            countryName: true
                                        }
                                    }
                                }
                            }
                        }
                    },
                    company: {
                        select: {
                            companyName: true
                        }
                    }

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

                },
            })
            if (!ourBranch) {
                throw new BadRequestException(`Branch with id : ${BranchMasterSid} not exists`);
            }
            return ourBranch;
        } catch (error) {
            throw error;
        }
    }
        async getBranchesByCompanyId(CompanyMasterSid: number) {
        try {
            const branches = await this._db.branchMaster.findMany({
                where: {
                    CompanyMasterSid: CompanyMasterSid,
                    status :'A'
                },
                
            });
            
            if (!branches || branches.length === 0) {
                throw new BadRequestException(`No branches found for Company with id : ${CompanyMasterSid}`);
            }
            
            return branches;
        } catch (error) {
            throw error;
        }
    }

    async updateBranchById(BranchMasterSid: number, updateData: any) {
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
            if (exist.status === 'D') {
                throw new BadRequestException(`Branch with id : ${BranchMasterSid} is already deleted`);
            }
            const deletedBranch = await this._db.branchMaster.update({
                where: {
                    BranchMasterSid: BranchMasterSid
                }, data: {
                    status : 'D'
                }
            })
            return deletedBranch;
        } catch (error) {
            throw error;
        }
    }


    async searchBranch(data: SearchListDto) {
        const { searchType, filterValue } = data;
        const stringFields = [
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
            "status"
        ];
        const intFields = [""];
        const acceptedType = [
            ...stringFields,
            ...intFields
        ];
        this.logger.log('Search List DTO', JSON.stringify(data))
        if (!acceptedType.includes(searchType)) {
            throw new BadRequestException(`Invalid Search Type`);
        }
        let whereClause: any = {};
        if (stringFields.includes(searchType)) {
            whereClause[searchType] = {
                contains: filterValue,
                mode: "insensitive"
            };
        } else if (intFields.includes(searchType)) {
            const numberValue = parseInt(filterValue);
            if (isNaN(numberValue)) {
                throw new BadRequestException(`${searchType} must be a valid number`);
            }
            whereClause[searchType] = numberValue;
        }
        const searchResults = await this._db.branchMaster.findMany({
            where: {
                ...whereClause,
                status : 'A'
            },
            include: {
                cityMaster: {
                    select: {
                        cityName: true
                    }
                },
                company: {
                    select: {
                        companyName: true
                    }
                }
            }
        }).catch((err) => {
            throw new Error(`Error Occured : ${JSON.stringify(err), err}`);
        })
        return searchResults;
    }
}
