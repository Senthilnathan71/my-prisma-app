import { BadRequestException, Injectable } from '@nestjs/common';
import { DatabaseService } from 'src/database/database.service';
import { SearchListDto } from 'src/masters/DTO/search-list.dto';

@Injectable()
export class AuthorityService {
    constructor(private _db: DatabaseService) { }

    async getAllAuthorities() {
        try {
            const allAuthorities = await this._db.authorityMaster.findMany({
                where: {
                    deletedAt: null
                },
                include: {
                    branchMaster: true,
                    companyMaster: true,
                    menuMaster: true
                }
            });
            return allAuthorities;
        } catch (error) {
            throw error;
        }
    }

    async createNewAuthority(payload) {
        try {
            const createdAuthority = await this._db.authorityMaster.create({
                data: {
                    ...payload,
                },
                include: {
                    branchMaster: true,
                    companyMaster: true,
                    menuMaster: true
                }
            });
            return createdAuthority;
        } catch (error) {
            throw error;
        }
    }

    async fetchAuthorityById(AuthorityMasterSid: number) {
        try {
            const authority = await this._db.authorityMaster.findUnique({
                where: {
                    AuthorityMasterSid: AuthorityMasterSid
                },
                include: {
                    branchMaster: true,
                    companyMaster: true,
                    menuMaster: true
                }
            });
            if (!authority) {
                throw new BadRequestException(`Authority with Id : ${AuthorityMasterSid} not exists`);
            }
            return authority;
        } catch (error) {
            throw error;
        }
    }

    async updateAuthorityById(AuthorityMasterSid: number, payload) {
        try {
            const exist = await this._db.authorityMaster.findUnique({
                where: {
                    AuthorityMasterSid: AuthorityMasterSid
                }
            });
            if (!exist) {
                throw new BadRequestException(`Authority with Id : ${AuthorityMasterSid} not exists`);
            }
            const updatedAuthority = await this._db.authorityMaster.update({
                where: {
                    AuthorityMasterSid: AuthorityMasterSid
                },
                data: payload,
                include: {
                    branchMaster: true,
                    companyMaster: true,
                    menuMaster: true
                }
            });
            return updatedAuthority;
        } catch (error) {
            throw error;
        }
    }

    async deleteAuthority(AuthorityMasterSid: number) {
        try {
            const exist = await this._db.authorityMaster.findUnique({
                where: {
                    AuthorityMasterSid: AuthorityMasterSid
                }
            });
            if (!exist) {
                throw new BadRequestException(`Authority with Id : ${AuthorityMasterSid} not exists`);
            }
            if (exist.deletedAt) {
                throw new BadRequestException(`Authority with Id :${AuthorityMasterSid} is already deleted`)
            }
            const deletedAuthority = await this._db.authorityMaster.update({
                where: {
                    AuthorityMasterSid: AuthorityMasterSid
                },
                data: {
                    deletedAt: new Date()
                },
                include: {
                    branchMaster: true,
                    companyMaster: true,
                    menuMaster: true
                }
            });
            return deletedAuthority;
        } catch (error) {
            throw error;
        }
    }

    async searchAuthority(data: SearchListDto) {
        const { searchType, filterValue } = data;
        const intFields = [
            'AuthorityMasterSid',
            'CompanyMasterSid',
            'BranchMasterSid',
            'MenuMaster'
        ];
        const stringFields = [
            'DepartmentMaster',
            'createdBy',
            'updatedBy',
            'status',
            'Remarks'
        ];
        const acceptedType = [...intFields, ...stringFields];
        if (!acceptedType.includes(searchType)) {
            throw new BadRequestException('Invalid Search Type');
        }

        const whereClause: any = {}

        if (stringFields.includes(searchType)) {
            whereClause[searchType] = {
                contains: filterValue,
                mode: 'insensitive'
            }
        } else if (intFields.includes(searchType)) {
            const numberValue = parseInt(filterValue);
            if (isNaN(numberValue)) {
                throw new BadRequestException(`${searchType} must be a valid number`);
            }
            whereClause[searchType] = numberValue;
        }

        const searchResults = await this._db.authorityMaster.findMany({
            where: {
                ...whereClause,
                deletedAt: null
            },
            include: {
                branchMaster: true,
                companyMaster: true,
                menuMaster: true
            }
        }).catch((err) => {
            throw new Error(`Error Occured : ${JSON.stringify(err), err}`);
        });

        return searchResults;
    }
}