import { BadRequestException, Injectable } from '@nestjs/common';
import { DatabaseService } from 'src/database/database.service';
import { SearchListDto } from 'src/masters/DTO/search-list.dto';

@Injectable()
export class CustomerBranchService {
    constructor(private _db: DatabaseService) { }
    async createNewCustomerBranch(newCustomerBranchData: any) {
        try {
            const createdCustomerBranch = await this._db.customerBranch.create({
                data: {
                    ...newCustomerBranchData,
                }
            });
            return createdCustomerBranch;
        } catch (error) {
            throw error;
        }
    }

    async getAllCustomerBranch() {
        try {
            const allCustomerBranches = await this._db.customerBranch.findMany({
                where: {
                    status : 'A'
                }
            })
            return allCustomerBranches;
        } catch (error) {
            throw error;
        }
    }

    async getCustomerBranchById(CustomerBranchSid: number) {
        try {
            const ourCustomerBranch = await this._db.customerBranch.findUnique({
                where: {
                    CustomerBranchSid: CustomerBranchSid
                }
            })
            if (!ourCustomerBranch) {
                throw new BadRequestException(`Customer Branch with id :${CustomerBranchSid} is not exists`);
            }
            return ourCustomerBranch;
        } catch (error) {
            throw error;
        }
    }

    async getCustomerBranchByCustomerMasterId(CustomerMasterId: number) {
        try {
            const ourCustomerBranch = await this._db.customerBranch.findMany({
                where: {
                    CustomerMasterSid: CustomerMasterId,
                    status : 'A'
                },
                include : {
                    stateMaster : {
                        select : {
                            StateMasterSid : true,
                            stateName : true,
                            IsUnionTerritory : true
                        }
                    },
                    customerMaster : {
                        select : {
                            PanType : true
                        }
                    }
                }
            })
            if (!ourCustomerBranch) {
                throw new BadRequestException(`Customer Branch with CustomerMasterId :${CustomerMasterId} is not exists`);
            }
            return ourCustomerBranch;
        } catch (error) {
            throw error;
        }
    }

    async updateCustomerBranchById(CustomerBranchSid: number, updateData: any) {
        try {
            const existing = await this._db.customerBranch.findUnique({
                where: {
                    CustomerBranchSid: CustomerBranchSid
                }
            })
            if (!existing) {
                throw new BadRequestException(`Customer Branch with id :${CustomerBranchSid} is not exists`)
            }
            const updatedCustomerBranch = await this._db.customerBranch.update({
                where: {
                    CustomerBranchSid: CustomerBranchSid
                },
                data: updateData
            })
            return updatedCustomerBranch;
        } catch (error) {
            throw error;
        }
    }


    async softDeleteCustomerBranch(CustomerBranchSid: number, updatedBy: string) {
        try {
            const existing = await this._db.customerBranch.findUnique({
                where: {
                    CustomerBranchSid: CustomerBranchSid
                }
            })
            if (!existing) {
                throw new BadRequestException(`Customer Branch with id :${CustomerBranchSid} is not exists`)
            }

            // Step 2: Suspend branch and related tables in a transaction
            await this._db.$transaction(async (tx) => {
                // Suspend Customer Branch
                await tx.customerBranch.update({
                    where: { CustomerBranchSid: CustomerBranchSid },
                    data: { status: 'S' , updatedBy : updatedBy, updatedOn : new Date()},
                });

                // Suspend all related child tables
                await Promise.all([
                    tx.cusBranchContact.updateMany({
                        where: { CustomerBranchSid: CustomerBranchSid },
                        data: { status: 'S' ,updatedBy : updatedBy, updatedOn : new Date()},
                    }),
                    tx.customerBrEmail.updateMany({
                        where: { CustomerBranchSid: CustomerBranchSid },
                        data: { status: 'S' ,updatedBy : updatedBy, updatedOn : new Date()},
                    }),
                    tx.customerLogin.updateMany({
                        where: { CustomerBranchSid: CustomerBranchSid },
                        data: { status: 'S' ,updatedBy : updatedBy, updatedOn : new Date()},
                    }),
                    tx.customerSalesTeam.updateMany({
                        where: { CustomerBranchSid: CustomerBranchSid },
                        data: { status: 'S' ,updatedBy : updatedBy, updatedOn : new Date()},
                    }),
                    tx.customerMilestone.updateMany({
                        where: { CustomerBranchSid: CustomerBranchSid },
                        data: { Status: 'S' ,UpdatedBy : updatedBy, UpdatedOn : new Date()},
                    }),
                ]);
            });

            // Step 3: Return success message
            return {
                message: 'Customer Branch and all related records suspended successfully',
            };
      
        } catch (error) {
            throw error;
        }
    }

    async getBranchSidsByCustomerMasterSid(CustomerMasterSid: number) {
        try {
            // Ensure the customer has active branches; return only the SIDs
            const branches = await this._db.customerBranch.findMany({
                where: {
                    CustomerMasterSid,
                    status: 'A',
                },
               
                orderBy: {
                    CustomerBranchSid: 'asc',
                }
            });

        
            if (!branches || branches.length === 0) {
                throw new BadRequestException(
                    `No active Customer Branches found for CustomerMasterSid: ${CustomerMasterSid}`
                );
            }

            return branches; 
        } catch (error) {
            throw error;
        }
    }

    async searchCustomerBranch(data: SearchListDto) {
        const { searchType, filterValue } = data;
        const acceptedType = [
            "CustomerMasterSid",
            "CompanyMasterSid",
            "StateMasterSid",
            "CityMasterSid",
            "BranchName",
            "Zip_PostBox",
            "TanNo",
            "Address",
            "Email",
            "Registered",
            "CustomerGstType",
            "VendorGstType",
            "GSTNo",
            "ContactNo",
            "status"
        ];
        if (!acceptedType.includes(searchType)) {
            throw new BadRequestException('Invalid Search Type');
        }
        const searchResults = await this._db.customerBranch.findMany({
            where: {
                [searchType]: {
                    contains: filterValue,
                    mode: 'insensitive'
                },
                status : 'A'
            }
        }).catch((err) => {
            throw new Error(`Error Occurred ${JSON.stringify(err)}`);
        })
        return searchResults;
    }
}
