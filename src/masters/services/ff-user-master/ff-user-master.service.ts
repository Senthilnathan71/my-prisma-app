import { BadRequestException, Injectable } from '@nestjs/common';
import { DatabaseService } from 'src/database/database.service';
import { SearchListDto } from 'src/masters/DTO/search-list.dto';

@Injectable()
export class FfUserMasterService {
    constructor(private _db:DatabaseService){}

    async getAllFfUser(){
        try {
            const allFfUser = await this._db.userMaster.findMany({
                where : {
                    deletedAt:null
                }
            })
            return allFfUser;
        } catch (error) {
            throw error;
        }
    }

    async createNewFfUser(payload){
        try {
            const createdFfUser = await this._db.userMaster.create({
                data :{
                    ...payload
                }
            })
            return createdFfUser;
        } catch (error) {
            throw error;
        }
    }

    async fetchFfUserById(UserMasterSid:number){
        try {
            const ourFfUser =await this._db.userMaster.findUnique({
                where : {
                    UserMasterSid:UserMasterSid
                }
            })
            if(!ourFfUser){
                throw new BadRequestException(`User with Id : ${UserMasterSid} not exists`);
            }
            return ourFfUser;
        } catch (error) {
            throw error;
        }
    }

    async updateFfUserById(UserMasterSid:number,payload){
        try {
             const exist =await this._db.userMaster.findUnique({
                where : {
                    UserMasterSid:UserMasterSid
                }
            })
            if(!exist){
                throw new BadRequestException(`User with Id : ${UserMasterSid} not exists`);
            }
            const updatedFfUser = this._db.userMaster.update({
                where : {
                    UserMasterSid : UserMasterSid
                },
                data : payload
            })
            return updatedFfUser;
        } catch (error) {
            throw error;
        }
    }


    async deleteFfUser(UserMasterSid:number){
        try {
            const exist = await this._db.userMaster.findUnique({
                where: {
                    UserMasterSid: UserMasterSid
                }
            })
            if (!exist) {
                throw new BadRequestException(`User with Id : ${UserMasterSid} not exists`);
            }
            if (exist.deletedAt) {
                throw new BadRequestException(`User with Id :${UserMasterSid} is already deleted`)
            }
            const deletedFfUser = this._db.userMaster.update({
                where: {
                    UserMasterSid: UserMasterSid
                },
                data: {
                    deletedAt: new Date()
                }
            })
            return deletedFfUser;
        } catch(error) {
            throw error;
        }
    }


    async searchFfUser(data:SearchListDto){
        const {searchType,filterValue}=data;
        const intFields=[
            ''
        ];
        const stringFields = [
            'userName',
            'userEmail',
            'isSalesperson',
            'status'
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

        const searchResults = await this._db.userMaster.findMany({
            where : {
                ...whereClause,
                deletedAt:null
            }
        }).catch((err) => {
            throw new Error(`Error Occured : ${JSON.stringify(err), err}`);
        })

        return searchResults;

    }

}
