import { BadRequestException, Injectable } from '@nestjs/common';
import { DatabaseService } from 'src/database/database.service';
import { SearchListDto } from 'src/masters/DTO/search-list.dto';

@Injectable()
export class AuthorityDetailService {
    constructor(private _db: DatabaseService) { }

    async getAllAuthorityDetails() {
        try {
            const allAuthorityDetails = await this._db.authorityDetail.findMany({
                where: {
                    deletedAt: null
                },
                include: {
                    branchMaster: true,
                    companyMaster: true,
                    userMaster: true
                }
            });
            return allAuthorityDetails;
        } catch (error) {
            throw error;
        }
    }

    async createNewAuthorityDetail(payload: any) {
        try {
            const createdAuthorityDetail = await this._db.authorityDetail.create({
                data: {
                    ...payload,
                }
            });
            return createdAuthorityDetail;
        } catch (error) {
            throw error;
        }
    }

    async fetchAuthorityDetailById(AuthorityDetailSid: number) {
        try {
            const authorityDetail = await this._db.authorityDetail.findUnique({
                where: {
                    AuthorityDetailSid: AuthorityDetailSid
                },
                include: {
                    branchMaster: true,
                    companyMaster: true,
                    userMaster: true
                }
            });
            if (!authorityDetail) {
                throw new BadRequestException(`Authority Detail with Id : ${AuthorityDetailSid} does not exist`);
            }
            return authorityDetail;
        } catch (error) {
            throw error;
        }
    }

    async updateAuthorityDetailById(AuthorityDetailSid: number, payload: any) {
        try {
            const exist = await this._db.authorityDetail.findUnique({
                where: {
                    AuthorityDetailSid: AuthorityDetailSid
                }
            });
            if (!exist) {
                throw new BadRequestException(`Authority Detail with Id : ${AuthorityDetailSid} does not exist`);
            }
            const updatedAuthorityDetail = await this._db.authorityDetail.update({
                where: {
                    AuthorityDetailSid: AuthorityDetailSid
                },
                data: payload
            });
            return updatedAuthorityDetail;
        } catch (error) {
            throw error;
        }
    }

    async deleteAuthorityDetail(AuthorityDetailSid: number) {
        try {
            const exist = await this._db.authorityDetail.findUnique({
                where: {
                    AuthorityDetailSid: AuthorityDetailSid
                }
            });
            if (!exist) {
                throw new BadRequestException(`Authority Detail with Id : ${AuthorityDetailSid} does not exist`);
            }
            if (exist.deletedAt) {
                throw new BadRequestException(`Authority Detail with Id : ${AuthorityDetailSid} is already deleted`);
            }
            const deletedAuthorityDetail = await this._db.authorityDetail.update({
                where: {
                    AuthorityDetailSid: AuthorityDetailSid
                },
                data: {
                    deletedAt: new Date()
                }
            });
            return deletedAuthorityDetail;
        } catch (error) {
            throw error;
        }
    }

    async searchAuthorityDetails(data: SearchListDto) {
        const { searchType, filterValue } = data;
        const intFields = [
            'AuthorityLevel',
            'CompanyMasterSid',
            'BranchMasterSid',
            'UserMasterSid'
        ];
        const stringFields = [
            'FinalAuthority',
            'status',
            'createdBy',
            'updatedBy',
            'Remarks'
        ];
        const acceptedTypes = [...intFields, ...stringFields];
        
        if (!acceptedTypes.includes(searchType)) {
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

        const searchResults = await this._db.authorityDetail.findMany({
            where: {
                ...whereClause,
                deletedAt: null
            },
            include: {
                branchMaster: true,
                companyMaster: true,
                userMaster: true
            }
        }).catch((err) => {
            throw new Error(`Error Occurred : ${JSON.stringify(err)}`);
        });

        return searchResults;
    }
}