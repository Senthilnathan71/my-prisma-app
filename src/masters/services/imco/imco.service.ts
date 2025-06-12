import { BadRequestException, Injectable } from '@nestjs/common';
import { DatabaseService } from 'src/database/database.service';
import { SearchListDto } from 'src/masters/DTO/search-list.dto';

@Injectable()
export class ImcoService {
    constructor(private _db:DatabaseService){}

    async getAllIMCO(){
        try {
            const allIMCO = await this._db.imcoMaster.findMany({
                where : {
                    deletedAt:null
                }
            })
            return allIMCO;
        } catch (error) {
            throw error;
        }
    }

    async createNewIMCO(payload){
        try {
            const createdIMCO = await this._db.imcoMaster.create({
                data :{
                    ...payload,
                }
            })
            return createdIMCO;
        } catch (error) {
            throw error;
        }
    }

    async fetchIMCOById(ImcoMasterSid:number){
        try {
            const ourimcoMaster =await this._db.imcoMaster.findUnique({
                where : {
                    ImcoMasterSid:ImcoMasterSid
                }
            })
            if(!ourimcoMaster){
                throw new BadRequestException(`IMCO with Id : ${ImcoMasterSid} not exists`);
            }
            return ourimcoMaster;
        } catch (error) {
            throw error;
        }
    }

    async updateimcoMasterById(ImcoMasterSid:number,payload){
        try {
             const exist =await this._db.imcoMaster.findUnique({
                where : {
                    ImcoMasterSid:ImcoMasterSid
                }
            })
            if(!exist){
                throw new BadRequestException(`IMCO with Id : ${ImcoMasterSid} not exists`);
            }
            const updatedimcoMaster = this._db.imcoMaster.update({
                where : {
                    ImcoMasterSid : ImcoMasterSid
                },
                data : payload
            })
            return updatedimcoMaster;
        } catch (error) {
            throw error;
        }
    }


    async deleteimcoMasters(ImcoMasterSid:number){
        try {
            const exist = await this._db.imcoMaster.findUnique({
                where: {
                    ImcoMasterSid: ImcoMasterSid
                }
            })
            if (!exist) {
                throw new BadRequestException(`IMCO with Id : ${ImcoMasterSid} not exists`);
            }
            if (exist.deletedAt) {
                throw new BadRequestException(`IMCO with Id :${ImcoMasterSid} is already deleted`)
            }
            const deletedimcoMaster = this._db.imcoMaster.update({
                where: {
                    ImcoMasterSid: ImcoMasterSid
                },
                data: {
                    deletedAt: new Date()
                }
            })
            return deletedimcoMaster;
        } catch(error) {
            throw error;
        }
    }


    async searchimcoMaster(data:SearchListDto){
        const {searchType,filterValue}=data;
        const intFields=[''];
        const stringFields = [
            'ImcoClass',
            'ImcoName',
            'Description',
            'ImcoUn',
            'ImcoPageNo',
            'PackingGroup',
            'status',
            'Remarks'
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

        const searchResults = await this._db.imcoMaster.findMany({
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
