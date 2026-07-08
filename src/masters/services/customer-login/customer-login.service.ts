import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { DatabaseService } from 'src/database/database.service';
import { SearchListDto } from 'src/masters/DTO/search-list.dto';

@Injectable()
export class CustomerLoginService {
    constructor(private _db: DatabaseService) { }


    async createNewCustomerLogin(newData: any) {
        try {
            const loginEmail = newData.LoginEmail?.trim();

            // Reject duplicate login email (case-insensitive, ignoring deleted logins)
            const duplicateLogin = await this._db.customerLogin.findFirst({
                where: {
                    LoginEmail: { equals: loginEmail, mode: 'insensitive' },
                    status: { not: 'D' }
                }
            })
            if (duplicateLogin) {
                throw new ConflictException(`A login with the email '${loginEmail}' already exists.`);
            }

            const createdCustomerLogin = await this._db.customerLogin.create({
                data: {
                    ...newData,
                    LoginEmail: loginEmail,
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
                    status : 'A'
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




    async updateCustomerLogin(CustomerLoginSid: number, updateData: any) {
        try {
            const existing = await this._db.customerLogin.findUnique({
                where: {
                    CustomerLoginSid: CustomerLoginSid
                }
            })
            if (!existing) {
                throw new BadRequestException(`Customer Login with Id : ${CustomerLoginSid} not exists`);
            }

            // If the email is being changed, reject a duplicate held by another (non-deleted) login
            if (updateData.LoginEmail) {
                const loginEmail = updateData.LoginEmail.trim();
                const duplicateLogin = await this._db.customerLogin.findFirst({
                    where: {
                        LoginEmail: { equals: loginEmail, mode: 'insensitive' },
                        status: { not: 'D' },
                        CustomerLoginSid: { not: CustomerLoginSid }
                    }
                })
                if (duplicateLogin) {
                    throw new ConflictException(`A login with the email '${loginEmail}' already exists.`);
                }
                updateData.LoginEmail = loginEmail;
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




    async deleteCustomerLogin(CustomerLoginSid: number, updatedBy: string) {
        try {
            const existing = await this._db.customerLogin.findUnique({
                where: {
                    CustomerLoginSid: CustomerLoginSid
                }
            })
            if (!existing) {
                throw new BadRequestException(`Customer Login with Id : ${CustomerLoginSid} not exists`);
            }
            if (existing.status === 'D') {
                throw new BadRequestException(`Customer Login with Id : ${CustomerLoginSid} is already deleted`);
            }
            const deletedData = await this._db.customerLogin.update({
                where: {
                    CustomerLoginSid: CustomerLoginSid
                }, data: {
                    status : 'D',
                    updatedBy : updatedBy,
                    updatedOn : new Date()
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
                },
                status : 'A'
            }
        }).catch((err) => {
            throw new Error(`Error Occured : ${JSON.stringify(err)}`);
        })
        return searchResults;
    }


}
