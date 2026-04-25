import { BadRequestException, Injectable, InternalServerErrorException } from '@nestjs/common';
import { CreateUserDto } from 'src/auth/dto/create-user.dto';
import { encodePassword } from 'src/common/helper';
import { DatabaseService } from 'src/database/database.service';

@Injectable()
export class UserService {
    constructor(
        private _db: DatabaseService

    ) { }

    async getUserData(user: any) {
        console.log(user)
        try {
            const result = await this._db.userMaster.findUnique({
                where: {
                    UserMasterSid: user.UserMasterSid
                }, 
                omit : {
                    userPassword : true
                },
                include: {
                    userType: { select : {code : true}},
                    countryMaster: {
                        include: {
                            stateMaster: {
                                include: {
                                    cityMaster: true
                                }
                            }
                        }
                    },
                    userCompanyMaster: {
                        where : {
                            status:'A'
                        },
                        include: {
                            companyMaster: {
                                include: {
                                    userBranchMaster : {
                                        where : {
                                            UserMasterSid : user.UserMasterSid,
                                            status:'A'
                                        },
                                        include : {
                                            branchMaster : {
                                                include : {
                                                    stateMaster : {
                                                        select : {
                                                            stateName : true,
                                                            stateCode : true
                                                        }
                                                    },
                                                    cityMaster : {
                                                        select : {
                                                            cityName : true,
                                                            cityCode : true
                                                        }
                                                    }
                                                }
                                            }
                                        }
                                    },
                                    countryMaster:{
                                        select:{
                                            countryName:true,
                                            countryCode:true
                                        }
                                    }
                                }
                            },
                            userRoleMaster: {
                                where: {
                                    status: 'A'
                                }
                            }
                        }
                    }
                }
            })
            return result
        } catch (error) {
            throw error
        }
    }

    async findUserById(where: any) {
        const userData = await this._db.userMaster.findFirst({
            where: {
                status:"A",
                userEmail: where.UserEmail
            }
        })
        return userData
    }

    async getUserById(userId: number) {
        try {
            const user = await this._db.userMaster.findUnique({
                where: {
                    UserMasterSid: userId
                },
                omit: {
                    userPassword: true
                },
                include: {
                    userBranchMaster: {
                        include: {
                            branchMaster: true,
                            companyMaster: true
                        }
                    },
                    userType: true,
                    userRoleMaster: true
                }
            })

            return user;
        } catch (error) {
            throw error
        }

    }


    async getSalesPerson() {
        try {
            const salesPerson = await this._db.userMaster.findMany({
                where: {
                    isSalesperson: '1'
                }
            })
            return salesPerson;
        } catch (error) {
            throw error
        }
    }


    async updatePassword(userId: number, password: string) {
        try {
            const data: any = {}
            if (!userId) return new BadRequestException('User Id is required')

            const userExists: any = await this._db.userMaster.findUnique({
                where: { UserMasterSid: userId }
            })

            if (!userExists) return new BadRequestException('User not found')

            if (password !== '*******') data.userPassword = await encodePassword(password)

            await this._db.userMaster.update({
                where: { UserMasterSid: userId },
                data: data
            })

            delete userExists.userPassword

            return userExists

        } catch (error) {
            throw new InternalServerErrorException("UpdatePassword error: Something went wrong.")
        }
    }


    async signUp(user: CreateUserDto) {
        try {
            const createCode = user.userName.toLowerCase().split(' ').join('_')
            const userPassword = await encodePassword(user.userPassword)
            const output: any = await this._db.userMaster.create({
                data: {
                    userName: user.userName,
                    userEmail: user.userEmail,
                    userPassword: userPassword,
                    CountryMasterSid: user.CountryMasterSid,
                    userCode: createCode,
                    status: "A"
                }
            })
            delete output.userPassword
            return output

        } catch (error) {
            throw error;
        }
    }

    async getAllCountries() {
        return this._db.countryMaster.findMany().catch(err => { throw err });
    }
}
