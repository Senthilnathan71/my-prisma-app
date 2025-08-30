import { BadRequestException, Injectable } from '@nestjs/common';
import { DatabaseService } from 'src/database/database.service';
import { SearchListDto } from 'src/masters/DTO/search-list.dto';

@Injectable()
export class UserTypeService {
    constructor(private _db:DatabaseService){}

    async getAllUserType(){
        try {
            const allUserType = await this._db.userType.findMany({
                where : {
                    status:'A'
                }
            })
            return allUserType;
        } catch (error) {
            throw error;
        }
    }

    async createNewUserType(payload){
        try {
            const createdUserType = await this._db.userType.create({
                data :{
                    ...payload,
                }
            })
            return createdUserType;
        } catch (error) {
            throw error;
        }
    }

    async fetchUserTypeById(UserTypeSid:number){
        try {
            const ourUserType =await this._db.userType.findUnique({
                where : {
                    UserTypeSid:UserTypeSid
                }
            })
            if(!ourUserType){
                throw new BadRequestException(`UserType with Id : ${UserTypeSid} not exists`);
            }
            return ourUserType;
        } catch (error) {
            throw error;
        }
    }

    async updateUserTypeById(UserTypeSid:number,payload){
        try {
             const exist =await this._db.userType.findUnique({
                where : {
                    UserTypeSid:UserTypeSid
                }
            })
            if(!exist){
                throw new BadRequestException(`UserType with Id : ${UserTypeSid} not exists`);
            }
            const updatedUserType = this._db.userType.update({
                where : {
                    UserTypeSid : UserTypeSid
                },
                data : payload
            })
            return updatedUserType;
        } catch (error) {
            throw error;
        }
    }


    async deleteUserType(UserTypeSid:number){
        try {
            const exist = await this._db.userType.findUnique({
                where: {
                    UserTypeSid: UserTypeSid
                }
            })
            if (!exist) {
                throw new BadRequestException(`UserType with Id : ${UserTypeSid} not exists`);
            }
            if (exist.status==='D') {
                throw new BadRequestException(`UserType with Id :${UserTypeSid} is already deleted`)
            }
            const deletedUserType = this._db.userType.update({
                where: {
                    UserTypeSid: UserTypeSid
                },
                data: {
                    status:'D'
                }
            })
            return deletedUserType;
        } catch(error) {
            throw error;
        }
    }


    async searchUserType(data:SearchListDto){
        const {searchType,filterValue}=data;
        const intFields=[
            ''
        ];
        const stringFields = [
            'name',
            'code',
        ];
        const acceptedType = [...intFields,...stringFields];
        if(!acceptedType.includes(searchType)){
            throw new BadRequestException('Invalid Search Type');
        }

        const whereClause:any ={}

        if(stringFields.includes(searchType)){
            whereClause[searchType]={
                contains:filterValue,
                mode:'insensitive'
            }
        } else if(intFields.includes(searchType)){
            const numberValue=parseInt(filterValue);
            if (isNaN(numberValue)) {
                throw new BadRequestException(`${searchType} must be a valid number`);
            }
            whereClause[searchType]=numberValue;
        }

        const searchResults = await this._db.userType.findMany({
            where : {
                ...whereClause,
                status:'A'
            }
        }).catch((err) => {
            throw new Error(`Error Occured : ${JSON.stringify(err), err}`);
        })

        return searchResults;

    }

}
