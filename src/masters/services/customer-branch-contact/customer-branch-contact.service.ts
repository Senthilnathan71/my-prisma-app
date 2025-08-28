import { BadRequestException, Injectable } from '@nestjs/common';
import { DatabaseService } from 'src/database/database.service';
import { SearchListDto } from 'src/masters/DTO/search-list.dto';

@Injectable()
export class CustomerBranchContactService {
    constructor(private _db: DatabaseService) { }

    async createNewCustomerBrContact(newData: any) {
        try {
            const newlyCreatedCustomerBrContact = await this._db.cusBranchContact.create({
                data: {
                    ...newData,
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
                    status : 'A'
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


    async updateCustomerBrContactById(CusBranchContactSid: number, updateData:any) {
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
            if (existing.status === 'D') {
                throw new BadRequestException(`Customer Branch Contact with Id : ${CusBranchContactSid} is already deleted`);
            }
            const deletedCustomerBrContact = await this._db.cusBranchContact.update({
                where: {
                    CusBranchContactSid: CusBranchContactSid
                }, data: {
                    status : 'D'
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
                },
                status : 'A'
            }
        }).catch((err) => {
            throw new Error(`Error Occured ${JSON.stringify(err), err}`);
        })
        return searchResults;
    }








}
