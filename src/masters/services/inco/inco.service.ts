import {BadRequestException, Injectable } from '@nestjs/common';
import { DatabaseService } from 'src/database/database.service';
import { SearchListDto } from 'src/masters/DTO/search-list.dto';

@Injectable()
export class IncoService {
    constructor(private _db:DatabaseService){}

    async getAllInco(){
        try {
            const allInco = await this._db.incoMaster.findMany({
                where : {
                    deletedAt:null
                }
            })
            return allInco;
        } catch (error) {
            throw error;
        }
    }

    async createNewInco(payload){
        try {
            const createdInco = await this._db.incoMaster.create({
                data :{
                    ...payload,
                }
            })
            return createdInco;
        } catch (error) {
            throw error;
        }
    }

    async fetchIncoById(IncoMasterSid:number){
        try {
            const ourInco =await this._db.incoMaster.findUnique({
                where : {
                    IncoMasterSid:IncoMasterSid
                }
            })
            if(!ourInco){
                throw new BadRequestException(`Inco with Id : ${IncoMasterSid} not exists`);
            }
            return ourInco;
        } catch (error) {
            throw error;
        }
    }

    async updateIncoById(IncoMasterSid:number,payload){
        try {
             const exist =await this._db.incoMaster.findUnique({
                where : {
                    IncoMasterSid:IncoMasterSid
                }
            })
            if(!exist){
                throw new BadRequestException(`Inco with Id : ${IncoMasterSid} not exists`);
            }
            const updatedInco = this._db.incoMaster.update({
                where : {
                    IncoMasterSid : IncoMasterSid
                },
                data : payload
            })
            return updatedInco;
        } catch (error) {
            throw error;
        }
    }


    async deleteInco(IncoMasterSid:number){
        try {
            const exist = await this._db.incoMaster.findUnique({
                where: {
                    IncoMasterSid: IncoMasterSid
                }
            })
            if (!exist) {
                throw new BadRequestException(`Inco with Id : ${IncoMasterSid} not exists`);
            }
            if (exist.deletedAt) {
                throw new BadRequestException(`Inco with Id :${IncoMasterSid} is already deleted`)
            }
            const deletedInco = this._db.incoMaster.update({
                where: {
                    IncoMasterSid: IncoMasterSid
                },
                data: {
                    deletedAt: new Date()
                }
            })
            return deletedInco;
        } catch(error) {
            throw error;
        }
    }


    async searchInco(data:SearchListDto){
        const {searchType,filterValue}=data;
        const intFields=[
            'Sortorder',
            'DefaultClause',
        ];
        const stringFields = [
            'ClauseDescription',
            'Keyword',
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

        const searchResults = await this._db.incoMaster.findMany({
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
