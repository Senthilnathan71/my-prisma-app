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
                    menuMaster: true,
                    authorityDetail: {
                        where: {
                            deletedAt: null
                        },
                        include: {
                            userMaster: true
                        }
                    }
                },
                orderBy: {
                    updatedOn: 'desc'
                }
            });
            return allAuthorities;
        } catch (error) {
            throw error;
        }
    }

    async createNewAuthority(payload: any) {
        try {
            if (!payload.authorityDetails || payload.authorityDetails.length === 0) {
                throw new BadRequestException('At least one authority detail is required');
            }

            const result = await this._db.$transaction(async (prisma) => {
                const { authorityDetails = [], ...masterData } = payload;
                
                const departmentMaster = Array.isArray(masterData.DepartmentMaster) 
                    ? masterData.DepartmentMaster.map(d => d.toString())
                    : [masterData.DepartmentMaster.toString()];

                const createdMaster = await prisma.authorityMaster.create({
                    data: {
                        ...masterData,
                        DepartmentMaster: departmentMaster,
                        status: masterData.status ,
                        MenuMaster: parseInt(masterData.MenuMaster)
                    }
                });

                const createdDetails = await Promise.all(
                    authorityDetails.map(detail => 
                        prisma.authorityDetail.create({
                            data: {
                                AuthorityMasterSid: createdMaster.AuthorityMasterSid,
                                CompanyMasterSid: createdMaster.CompanyMasterSid,
                                BranchMasterSid: createdMaster.BranchMasterSid,
                                UserMasterSid: parseInt(detail.UserMasterSid),
                                AuthorityLevel: parseInt(detail.AuthorityLevel),
                                FinalAuthority: detail.FinalAuthority || 'Y',
                                status: detail.status ,
                                Remarks: detail.Remarks || '',
                                createdBy: detail.createdBy,
                                updatedBy: detail.updatedBy
                            },
                        })
                    )
                );

                return {
                    authority: createdMaster,
                    authorityDetails: createdDetails
                };
            });

            return result;
        } catch (error) {
            console.error('Transaction failed:', error);
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
                    menuMaster: true,
                    authorityDetail: {
                        where: {
                            deletedAt: null
                        },
                            
                    }
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

    async updateAuthorityById(AuthorityMasterSid: number, payload: any) {
        try {
            const exist = await this._db.authorityMaster.findUnique({
                where: { AuthorityMasterSid }
            });

            if (!exist) {
                throw new BadRequestException(`Authority with Id : ${AuthorityMasterSid} does not exist`);
            }

            const updated = await this._db.$transaction(async (tx) => {
                const {
                    DepartmentMaster,
                    MenuMaster,
                    BranchMasterSid,
                    status,
                    Remarks,
                    authorityDetails = [],
                    updatedBy
                } = payload;

                // Update authority master
                const authority = await tx.authorityMaster.update({
                    where: { AuthorityMasterSid },
                    data: {
                        DepartmentMaster: Array.isArray(DepartmentMaster)
                            ? DepartmentMaster.map(d => d.toString())
                            : [DepartmentMaster.toString()],
                        MenuMaster: MenuMaster ? parseInt(MenuMaster) : undefined,
                        BranchMasterSid,
                        status: status ,
                        Remarks,
                        updatedBy: updatedBy || null,
                        updatedOn: new Date()
                    }
                });

                // Get existing details to compare
                const existingDetails = await tx.authorityDetail.findMany({
                    where: { 
                        AuthorityMasterSid,
                        deletedAt: null 
                    }
                });

                // Identify details to delete (not in new payload)
                const detailsToDelete = existingDetails.filter(ed => 
                    !authorityDetails.some(ad => 
                        ad.AuthorityDetailSid === ed.AuthorityDetailSid
                    )
                );

                // Soft delete removed details
                if (detailsToDelete.length > 0) {
                    await tx.authorityDetail.updateMany({
                        where: { 
                            AuthorityDetailSid: { 
                                in: detailsToDelete.map(d => d.AuthorityDetailSid) 
                            } 
                        },
                        data: { 
                            deletedAt: new Date(),
                            updatedBy: updatedBy || null
                        }
                    });
                }

                // Process each detail in payload
                const updatedDetails = await Promise.all(
                    authorityDetails.map(async detail => {
                        if (detail.AuthorityDetailSid) {
                            // Update existing detail
                            return await tx.authorityDetail.update({
                                where: { AuthorityDetailSid: detail.AuthorityDetailSid },
                                data: {
                                    UserMasterSid: Number(detail.UserMasterSid),
                                    AuthorityLevel: Number(detail.AuthorityLevel),
                                    FinalAuthority: detail.FinalAuthority || 'Y',
                                    status: detail.status ,
                                    Remarks: detail.Remarks || '',
                                    updatedBy: detail.updatedBy || '',
                                    updatedOn: new Date()
                                }
                            });
                        } else {
                            // Create new detail
                            return await tx.authorityDetail.create({
                                data: {
                                    AuthorityMasterSid: AuthorityMasterSid,
                                    CompanyMasterSid: authority.CompanyMasterSid,
                                    BranchMasterSid: authority.BranchMasterSid,
                                    UserMasterSid: Number(detail.UserMasterSid),
                                    AuthorityLevel: Number(detail.AuthorityLevel),
                                    FinalAuthority: detail.FinalAuthority || 'Y',
                                    status: detail.status ,
                                    Remarks: detail.Remarks || '',
                                    createdBy: detail.createdBy || '',
                                    updatedBy: detail.updatedBy || ''
                                }
                            });
                        }
                    })
                );

                return { 
                    authority, 
                    authorityDetails: updatedDetails 
                };
            });

            return updated;
        } catch (error) {
            console.error('Update Authority Failed:', error);
            throw error;
        }
    }

    async deleteAuthority(AuthorityMasterSid: number) {
        try {
            const exist = await this._db.authorityMaster.findUnique({
                where: { AuthorityMasterSid }
            });
            if (!exist) {
                throw new BadRequestException(`Authority with Id : ${AuthorityMasterSid} not exists`);
            }
            if (exist.deletedAt) {
                throw new BadRequestException(`Authority with Id :${AuthorityMasterSid} is already deleted`)
            }
            
            await this._db.$transaction(async (tx) => { 
                // Soft delete all related authority details first
                await tx.authorityDetail.updateMany({
                    where: { AuthorityMasterSid },
                    data: { deletedAt: new Date() }
                });
                
                // Then soft delete the authority master
                await tx.authorityMaster.update({
                    where: { AuthorityMasterSid },
                    data: { deletedAt: new Date() }
                });
            });

            return { status: true, message: 'Authority deleted successfully' };
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

        const whereClause: any = { deletedAt: null };

        if (searchType === 'DepartmentMaster') {
            whereClause[searchType] = { has: filterValue };
        } else if (stringFields.includes(searchType)) {
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

        return await this._db.authorityMaster.findMany({
            where: whereClause,
            include: {
                branchMaster: true,
                companyMaster: true,
                menuMaster: true,
                authorityDetail: {
                    where: { deletedAt: null },
                    include: { userMaster: true }
                }
            },
            orderBy: { updatedOn: 'desc' }
        });
    }
}