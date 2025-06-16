import { BadRequestException, Injectable } from '@nestjs/common';
import { DatabaseService } from 'src/database/database.service';
import { SearchListDto } from 'src/masters/DTO/search-list.dto';

@Injectable()
export class RoleMenuService {
    constructor(private _db:DatabaseService){}

    async getAllRoleMenu(){
        try {
            const allRoleMenu = await this._db.roleMenuMaster.findMany({
                where : {
                    deletedAt:null
                }
            })
            return allRoleMenu;
        } catch (error) {
            throw error;
        }
    }

    async createNewRoleMenu(payload){
        try {
            const createdRoleMenu = await this._db.roleMenuMaster.create({
                data :{
                    ...payload,
                }
            })
            return createdRoleMenu;
        } catch (error) {
            throw error;
        }
    }

    async fetchroleMenuById(RoleMenuMasterSid:number){
        try {
            const ourRoleMenu =await this._db.roleMenuMaster.findUnique({
                where : {
                    RoleMenuMasterSid:RoleMenuMasterSid
                }
            })
            if(!ourRoleMenu){
                throw new BadRequestException(`roleMenu with Id : ${RoleMenuMasterSid} not exists`);
            }
            return ourRoleMenu;
        } catch (error) {
            throw error;
        }
    }

    async updateRoleMenuById(RoleMenuMasterSid:number,payload){
        try {
             const exist =await this._db.roleMenuMaster.findUnique({
                where : {
                    RoleMenuMasterSid:RoleMenuMasterSid
                }
            })
            if(!exist){
                throw new BadRequestException(`RoleMenu with Id : ${RoleMenuMasterSid} not exists`);
            }
            const updatedRoleMenu = this._db.roleMenuMaster.update({
                where : {
                    RoleMenuMasterSid : RoleMenuMasterSid
                },
                data : payload
            })
            return updatedRoleMenu;
        } catch (error) {
            throw error;
        }
    }


    async deleteRoleMenu(RoleMenuMasterSid:number){
        try {
            const exist = await this._db.roleMenuMaster.findUnique({
                where: {
                    RoleMenuMasterSid: RoleMenuMasterSid
                }
            })
            if (!exist) {
                throw new BadRequestException(`RoleMenu with Id : ${RoleMenuMasterSid} not exists`);
            }
            if (exist.deletedAt) {
                throw new BadRequestException(`RoleMenu with Id :${RoleMenuMasterSid} is already deleted`)
            }
            const deletedRoleMenu = this._db.roleMenuMaster.update({
                where: {
                    RoleMenuMasterSid: RoleMenuMasterSid
                },
                data: {
                    deletedAt: new Date()
                }
            })
            return deletedRoleMenu;
        } catch(error) {
            throw error;
        }
    }


    async searchroleMenu(data:SearchListDto){
        const {searchType,filterValue}=data;
        const intFields=[
            ''
        ];
        const stringFields = [
            ''
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

        const searchResults = await this._db.roleMenuMaster.findMany({
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

