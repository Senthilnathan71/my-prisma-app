import { BadRequestException, Injectable } from '@nestjs/common';
import { DatabaseService } from 'src/database/database.service';
import { SearchListDto } from 'src/masters/DTO/search-list.dto';

@Injectable()
export class BlclauseService {
    constructor(private _db:DatabaseService){}

    async getAllBlclause(){
        try {
            const allBlclause = await this._db.bLClauseMaster.findMany({
                where : {
                    deletedAt:null
                }
            })
            return allBlclause;
        } catch (error) {
            throw error;
        }
    }

    async createNewBlclause(payload){
        try {
            const createdBlclause = await this._db.bLClauseMaster.create({
                data :{
                    ...payload,
                    createdBy :'admin@crm.com'
                }
            })
            return createdBlclause;
        } catch (error) {
            throw error;
        }
    }

    async fetchBlclauseById(BLClauseMasterSid:number){
        try {
            const ourBlclause =await this._db.bLClauseMaster.findUnique({
                where : {
                    BLClauseMasterSid:BLClauseMasterSid
                }
            })
            if(!ourBlclause){
                throw new BadRequestException(`Blclause with Id : ${BLClauseMasterSid} not exists`);
            }
            return ourBlclause;
        } catch (error) {
            throw error;
        }
    }

    async updateBlclauseById(BLClauseMasterSid:number,payload){
        try {
             const exist =await this._db.bLClauseMaster.findUnique({
                where : {
                    BLClauseMasterSid:BLClauseMasterSid
                }
            })
            if(!exist){
                throw new BadRequestException(`Blclause with Id : ${BLClauseMasterSid} not exists`);
            }
            const updatedBlclause = this._db.bLClauseMaster.update({
                where : {
                    BLClauseMasterSid : BLClauseMasterSid
                },
                data : payload
            })
            return updatedBlclause;
        } catch (error) {
            throw error;
        }
    }


    async deleteBlClause(BLClauseMasterSid:number){
        try {
            const exist = await this._db.bLClauseMaster.findUnique({
                where: {
                    BLClauseMasterSid: BLClauseMasterSid
                }
            })
            if (!exist) {
                throw new BadRequestException(`Blclause with Id : ${BLClauseMasterSid} not exists`);
            }
            if (exist.deletedAt) {
                throw new BadRequestException(`Blclause with Id :${BLClauseMasterSid} is already deleted`)
            }
            const deletedBlclause = this._db.bLClauseMaster.update({
                where: {
                    BLClauseMasterSid: BLClauseMasterSid
                },
                data: {
                    deletedAt: new Date()
                }
            })
            return deletedBlclause;
        } catch(error) {
            throw error;
        }
    }


    async searchBlclause(data:SearchListDto){
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

        const searchResults = await this._db.bLClauseMaster.findMany({
            where : whereClause
        }).catch((err) => {
            throw new Error(`Error Occured : ${JSON.stringify(err), err}`);
        })

        return searchResults;

    }

}
