import { BadRequestException, Injectable } from '@nestjs/common';
import { DatabaseService } from 'src/database/database.service';
import { SearchListDto } from 'src/masters/DTO/search-list.dto';

@Injectable()
export class CompanyService {
    constructor(private _db: DatabaseService) { }

    async createCompany(newData: any, user, files) {
        try {
            const createdCompany = await this._db.companyMaster.create({
                data: {
                    ...newData,
                    createdBy: 'admin@crm.com'
                }
            })
            return createdCompany;
        } catch (error) {
            throw error;
        }
    }


    async getAllCompany() {
        try {
            const allCompanies = await this._db.companyMaster.findMany({
                where: {
                    deletedAt: null
                },
                include: {
                    branchMaster: {
                        include: {
                            branchBank: {
                                where: {
                                    deletedAt: null
                                }
                            }
                        },
                        where: {
                            deletedAt: null
                        }
                    },

                }
            })
            return allCompanies;
        } catch (error) {
            throw error;
        }
    }

    async getCompanyById(CompanyMasterSid: number) {
        try {
            const ourCompany = await this._db.companyMaster.findUnique({
                where: {
                    CompanyMasterSid: CompanyMasterSid
                },
                include: {
                    branchMaster: {
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
                            },
                            branchBank: true
                        }
                    }
                }
            })
            if (!ourCompany) {
                throw new BadRequestException(`Company with id : ${CompanyMasterSid} not exists`);
            }
            return ourCompany;
        } catch (error) {
            throw error;
        }
    }


    async updateCompanyById(CompanyMasterSid: number, updateData: any) {
        try {
            const existing = await this._db.companyMaster.findUnique({
                where: {
                    CompanyMasterSid: CompanyMasterSid
                }
            })
            if (!existing) {
                throw new BadRequestException(`Company with id : ${CompanyMasterSid} not exists`);
            }
            const updatedCompany = await this._db.companyMaster.update({
                where: {
                    CompanyMasterSid: CompanyMasterSid
                }, data: updateData
            })
            return updatedCompany;
        } catch (error) {
            throw error;
        }
    }


    async softDeleteCompanyById(CompanyMasterSid: number) {
        try {
            const existing = await this._db.companyMaster.findUnique({
                where: {
                    CompanyMasterSid: CompanyMasterSid
                }
            })
            if (!existing) {
                throw new BadRequestException(`Company with id : ${CompanyMasterSid} not exists`);
            }
            if (existing.deletedAt) {
                throw new BadRequestException(`Company with id : ${CompanyMasterSid} is already deleted`);
            }
            const deletedCompany = await this._db.companyMaster.update({
                where: {
                    CompanyMasterSid: CompanyMasterSid
                }, data: {
                    deletedAt: new Date()
                }
            })
            return deletedCompany;
        } catch (error) {
            throw error;
        }
    }


    async searchCompany(data: SearchListDto) {
        const { searchType, filterValue } = data;
        const acceptedType = [
            "companyName",
            "companyCode",
            "addressLine1",
            "addressLine2",
            "postal_code",
            "webSite",
            "phoneNumber",
            "email",
            "isHo",
            "companyLogo",
            "reportLogo",
            "status"
        ];
        if (!acceptedType.includes(searchType)) {
            throw new BadRequestException(`Invalid Search Type`);
        }
        const searchResults = await this._db.companyMaster.findMany({
            where: {
                [searchType]: {
                    contains: filterValue,
                    mode: 'insensitive'
                }, deletedAt: null
            }, include: {
                branchMaster: {
                    where: {
                        deletedAt: null
                    },
                    include: {
                        branchBank: {
                            where: {
                                deletedAt: null
                            }
                        },
                    }
                },
                cityMaster: {
                    select: {
                        cityName: true
                    }
                },
                stateMaster: {
                    select: {
                        stateName: true
                    }
                },
                countryMaster: {
                    select: {
                        countryName: true
                    }
                }
            },
        }
        ).catch((err) => {
            throw new Error(`Error Occured : ${JSON.stringify(err), err}`);
        })
        return searchResults;
    }
}
