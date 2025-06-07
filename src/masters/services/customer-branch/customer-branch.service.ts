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
                    createdBy: 'admin@crm.com'
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
                    deletedAt: null
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


    async softDeleteCustomerBranch(CustomerBranchSid: number) {
        try {
            const existing = await this._db.customerBranch.findUnique({
                where: {
                    CustomerBranchSid: CustomerBranchSid
                }
            })
            if (!existing) {
                throw new BadRequestException(`Customer Branch with id :${CustomerBranchSid} is not exists`)
            }
            if (existing.deletedAt) {
                throw new BadRequestException(`Customer Branch with id : ${CustomerBranchSid} is already deleted`);
            }
            const deletedData = await this._db.customerBranch.update({
                where: {
                    CustomerBranchSid: CustomerBranchSid
                }, data: {
                    deletedAt: new Date()
                }
            })
            return deletedData;
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
                deletedAt:null
            }
        }).catch((err) => {
            throw new Error(`Error Occurred ${JSON.stringify(err)}`);
        })
        return searchResults;
    }
}
