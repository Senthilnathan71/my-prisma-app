import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { DatabaseService } from 'src/database/database.service';
import { SearchListDto } from 'src/masters/DTO/search-list.dto';

@Injectable()
export class CustomerBranchContactService {
    constructor(private _db: DatabaseService) { }

    async createNewCustomerBrContact(newData: Prisma.CusBranchContactCreateInput) {
        try {
            const newlyCreatedCustomerBrContact = await this._db.cusBranchContact.create({
                data: {
                    ...newData,
                    createdBy: 'admin@crm.com'
                }
            })
            return newlyCreatedCustomerBrContact;
        } catch (error) {
            throw error;
        }
    }



    async getAllCustomerBrContact() {
        try {
            const allCustomerBrContact = await this._db.cusBranchContact.findMany({
                where: {
                    deletedAt: null
                }
            })
            return allCustomerBrContact;
        } catch (error) {
            throw error;
        }
    }


    async getCustomerBrContactById(CusBranchContactSid: number) {
        try {
            const ourCustomerBrContact = await this._db.cusBranchContact.findUnique({
                where: {
                    CusBranchContactSid: CusBranchContactSid
                }
            })
            if (!ourCustomerBrContact) {
                throw new BadRequestException(`Customer Branch Contact with id : ${CusBranchContactSid} not exists`)
            }
            return ourCustomerBrContact;
        } catch (error) {
            throw error;
        }
    }


    async updateCustomerBrContactById(CusBranchContactSid: number, updateData: Prisma.CusBranchContactUpdateInput) {
        try {
            const existing = await this._db.cusBranchContact.findUnique({
                where: {
                    CusBranchContactSid: CusBranchContactSid
                }
            })
            if (!existing) {
                throw new BadRequestException(`Customer Branch Contact with id : ${CusBranchContactSid} not exists`)
            }
            const updatedCustomerBrContact = await this._db.cusBranchContact.update({
                where: {
                    CusBranchContactSid: CusBranchContactSid
                }, data: updateData
            })
            return updatedCustomerBrContact;
        } catch (error) {
            throw error;
        }
    }


    async deleteCustomerBrContactById(CusBranchContactSid: number) {
        try {
            const existing = await this._db.cusBranchContact.findUnique({
                where: {
                    CusBranchContactSid: CusBranchContactSid
                }
            })
            if (!existing) {
                throw new BadRequestException(`Customer Branch Contact with id : ${CusBranchContactSid} not exists`)
            }
            if (existing.deletedAt) {
                throw new BadRequestException(`Customer Branch Contact with Id : ${CusBranchContactSid} is already deleted`);
            }
            const deletedCustomerBrContact = await this._db.cusBranchContact.update({
                where: {
                    CusBranchContactSid: CusBranchContactSid
                }, data: {
                    deletedAt: new Date()
                }
            })
            return deletedCustomerBrContact;
        } catch (error) {
            throw error;
        }
    }


    async searchCustomerBrContact(data: SearchListDto) {
        const { searchType, filterValue } = data;
        const acceptedType = [
            "ContactType",
            "ContactName",
            "ContactNo",
            "MobileNo",
            "Email",
            "status"
        ];
        if (!acceptedType.includes(searchType)) {
            throw new BadRequestException('Invalid Search Type');
        }
        const searchResults = await this._db.cusBranchContact.findMany({
            where: {
                [searchType]: {
                    contains: filterValue,
                    mode: 'insensitive'
                }
            }
        }).catch((err) => {
            throw new Error(`Error Occured ${JSON.stringify(err), err}`);
        })
        return searchResults;
    }








}
