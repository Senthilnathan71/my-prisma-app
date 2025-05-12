import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { DatabaseService } from 'src/database/database.service';
import { SearchListDto } from 'src/masters/DTO/search-list.dto';

@Injectable()
export class CustomerLoginService {
    constructor(private _db: DatabaseService) { }


    async createNewCustomerLogin(newData: Prisma.CustomerLoginCreateInput) {
        try {
            const createdCustomerLogin = await this._db.customerLogin.create({
                data: {
                    ...newData,
                    createdBy: 'admin@crm.com'
                }
            })
            return createdCustomerLogin;
        } catch (error) {
            throw error;
        }
    }




    async getAllCustomerLogin() {
        try {
            const allCustomerLogin = await this._db.customerLogin.findMany({
                where: {
                    deletedAt: null
                }
            })
            return allCustomerLogin;
        } catch (error) {
            throw error;
        }
    }



    async getCustomerLoginById(CustomerLoginSid: number) {
        try {
            const existing = await this._db.customerLogin.findUnique({
                where: {
                    CustomerLoginSid: CustomerLoginSid
                }
            })
            if (!existing) {
                throw new BadRequestException(`Customer Login with Id : ${CustomerLoginSid} not exists`);
            }
            return existing;
        } catch (error) {
            throw error;
        }
    }




    async updateCustomerLogin(CustomerLoginSid: number, updateData: Prisma.CustomerLoginUpdateInput) {
        try {
            const existing = await this._db.customerLogin.findUnique({
                where: {
                    CustomerLoginSid: CustomerLoginSid
                }
            })
            if (!existing) {
                throw new BadRequestException(`Customer Login with Id : ${CustomerLoginSid} not exists`);
            }
            const updatedData = await this._db.customerLogin.update({
                where: {
                    CustomerLoginSid: CustomerLoginSid
                }, data: updateData
            })
            return updatedData;
        } catch (error) {
            throw error;
        }
    }




    async deleteCustomerLogin(CustomerLoginSid: number) {
        try {
            const existing = await this._db.customerLogin.findUnique({
                where: {
                    CustomerLoginSid: CustomerLoginSid
                }
            })
            if (!existing) {
                throw new BadRequestException(`Customer Login with Id : ${CustomerLoginSid} not exists`);
            }
            if (existing.deletedAt) {
                throw new BadRequestException(`Customer Login with Id : ${CustomerLoginSid} is already deleted`);
            }
            const deletedData = await this._db.customerLogin.update({
                where: {
                    CustomerLoginSid: CustomerLoginSid
                }, data: {
                    deletedAt: new Date()
                }
            })
            return deletedData;
        } catch (error) {
            throw error;
        }
    }




    async searchCustomerlogin(data: SearchListDto) {
        const { searchType, filterValue } = data;
        const acceptedType = [
            "LoginName",
            "LoginEmail",
            "status"
        ];
        if (!acceptedType.includes(searchType)) {
            throw new BadRequestException(`Invalid Search Type`);
        }
        const searchResults = await this._db.customerLogin.findMany({
            where: {
                [searchType]: {
                    contains: filterValue,
                    mode: 'insensitive'
                }
            }
        }).catch((err) => {
            throw new Error(`Error Occured : ${JSON.stringify(err)}`);
        })
        return searchResults;
    }


}
