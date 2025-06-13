import { BadRequestException, Injectable } from '@nestjs/common';
import { DatabaseService } from 'src/database/database.service';
import { SearchListDto } from 'src/masters/DTO/search-list.dto';

@Injectable()
export class CustomerBranchEmailService {
    constructor(private _db: DatabaseService) { }

    async createNewCustomerBrEmail(newData: any) {
        try {
            const newlyCreatedCustomerBrEmail = await this._db.customerBrEmail.create({
                data: {
                    ...newData,
                }
            })
            return newlyCreatedCustomerBrEmail;
        } catch (error) {
            throw error;
        }
    }



    async getAllCustomerBrEmail() {
        try {
            const allCustomerBrEmail = await this._db.customerBrEmail.findMany({
                where: {
                    deletedAt: null
                }
            })
            return allCustomerBrEmail;
        } catch (error) {
            throw error;
        }
    }


    async getCustomerBrEmailById(CustomerBrEmailSid: number) {
        try {
            const ourCustomerBrEmail = await this._db.customerBrEmail.findUnique({
                where: {
                    CustomerBrEmailSid: CustomerBrEmailSid
                }
            })
            if (!ourCustomerBrEmail) {
                throw new BadRequestException(`Customer Branch Contact with id : ${CustomerBrEmailSid} not exists`)
            }
            return ourCustomerBrEmail;
        } catch (error) {
            throw error;
        }
    }


    async updateCustomerBrEmailById(CustomerBrEmailSid: number, updateData: any) {
        try {
            const existing = await this._db.customerBrEmail.findUnique({
                where: {
                    CustomerBrEmailSid: CustomerBrEmailSid
                }
            })
            if (!existing) {
                throw new BadRequestException(`Customer Branch Email with id : ${CustomerBrEmailSid} not exists`)
            }
            const updatedCustomerBrEmail = await this._db.customerBrEmail.update({
                where: {
                    CustomerBrEmailSid: CustomerBrEmailSid
                }, data: updateData
            })
            return updatedCustomerBrEmail;
        } catch (error) {
            throw error;
        }
    }


    async deleteCustomerBrEmailById(CustomerBrEmailSid: number) {
        try {
            const existing = await this._db.customerBrEmail.findUnique({
                where: {
                    CustomerBrEmailSid: CustomerBrEmailSid
                }
            })
            if (!existing) {
                throw new BadRequestException(`Customer Branch Email with id : ${CustomerBrEmailSid} not exists`)
            }
            if (existing.deletedAt) {
                throw new BadRequestException(`Customer Branch Email with Id : ${CustomerBrEmailSid} is already deleted`);
            }
            const updatedCustomerBrEmail = await this._db.customerBrEmail.update({
                where: {
                    CustomerBrEmailSid: CustomerBrEmailSid
                }, data: {
                    deletedAt: new Date()
                }
            })
            return updatedCustomerBrEmail;
        } catch (error) {
            throw error;
        }
    }


    async searchCustomerBrEmail(data: SearchListDto) {
        const { searchType, filterValue } = data;
        const acceptedType = [
            "Toemail",
            "CCemail",
            "status"
        ];
        if (!acceptedType.includes(searchType)) {
            throw new BadRequestException('Invalid Search Type');
        }
        const searchResults = await this._db.customerBrEmail.findMany({
            where: {
                [searchType]: {
                    contains: filterValue,
                    mode: 'insensitive'
                },
                deletedAt:null
            }
        }).catch((err) => {
            throw new Error(`Error Occured ${JSON.stringify(err), err}`);
        })
        return searchResults;
    }



}
