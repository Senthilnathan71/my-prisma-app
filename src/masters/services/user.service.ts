import { BadRequestException, Injectable, InternalServerErrorException } from '@nestjs/common';
import { CreateUserDto } from 'src/auth/dto/create-user.dto';
import { encodePassword } from 'src/common/helper';
import { DatabaseService } from 'src/database/database.service';

@Injectable()
export class UserService {
    constructor(
        private _db: DatabaseService

    ) { }

    async findUserById(where: any) {
        const userData = await this._db.userMaster.findFirst({
            where: {
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
                    }
                }
            })

            return user;
        } catch (error) {
            console.log("UserServiceError", error);
        }

    }


    async getSalesPerson() {
        try {
            const salesPerson = await this._db.userMaster.findMany({
                where: {
                    isSalesperson: '1'
                }
            })
            console.log("Salespersons:", salesPerson);

            return salesPerson;
        } catch (error) {
            console.log("UserServiceError", error);
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
                    userLogin: user.userEmail,
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
