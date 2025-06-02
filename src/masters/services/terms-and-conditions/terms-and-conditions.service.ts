import { BadRequestException, Injectable } from '@nestjs/common';
import { DatabaseService } from 'src/database/database.service';
import { SearchListDto } from 'src/masters/DTO/search-list.dto';

@Injectable()
export class TermsAndConditionsService {
    constructor(private _db:DatabaseService){}

    async getAllTermCond(){
        try {
            const allTermConds = await this._db.termsAndConditionsMaster.findMany({
                where : {
                    deletedAt:null
                }
            })
            return allTermConds;
        } catch (error) {
            throw error;
        }
    }

    async createNewTermCond(payload){
        try {
            const createdTermCond = await this._db.termsAndConditionsMaster.create({
                data :{
                    ...payload,
                    createdBy :'admin@crm.com'
                }
            })
            return createdTermCond;
        } catch (error) {
            throw error;
        }
    }

    async fetchTermCondById(TermsAndConditionsMasterSid:number){
        try {
            const ourTermCond =await this._db.termsAndConditionsMaster.findUnique({
                where : {
                    TermsAndConditionsMasterSid:TermsAndConditionsMasterSid
                }
            })
            if(!ourTermCond){
                throw new BadRequestException(`Terms and Conditions with Id : ${TermsAndConditionsMasterSid} not exists`);
            }
            return ourTermCond;
        } catch (error) {
            throw error;
        }
    }

    async updateTermCondById(TermsAndConditionsMasterSid:number,payload){
        try {
             const exist =await this._db.termsAndConditionsMaster.findUnique({
                where : {
                    TermsAndConditionsMasterSid:TermsAndConditionsMasterSid
                }
            })
            if(!exist){
                throw new BadRequestException(`Terms and Conditions with Id : ${TermsAndConditionsMasterSid} not exists`);
            }
            const updatedTermCond = this._db.termsAndConditionsMaster.update({
                where : {
                    TermsAndConditionsMasterSid : TermsAndConditionsMasterSid
                },
                data : payload
            })
            return updatedTermCond;
        } catch (error) {
            throw error;
        }
    }


    async deleteTermCond(TermsAndConditionsMasterSid:number){
        try {
            const exist = await this._db.termsAndConditionsMaster.findUnique({
                where: {
                    TermsAndConditionsMasterSid: TermsAndConditionsMasterSid
                }
            })
            if (!exist) {
                throw new BadRequestException(`Term and Conditions with Id : ${TermsAndConditionsMasterSid} not exists`);
            }
            if (exist.deletedAt) {
                throw new BadRequestException(`Terms and Conditions with Id :${TermsAndConditionsMasterSid} is already deleted`)
            }
            const deletedTermsAndConditions = this._db.termsAndConditionsMaster.update({
                where: {
                    TermsAndConditionsMasterSid: TermsAndConditionsMasterSid
                },
                data: {
                    deletedAt: new Date()
                }
            })
            return deletedTermsAndConditions;
        } catch(error) {
            throw error;
        }
    }


    async searchTermCond(data:SearchListDto){
        const {searchType,filterValue}=data;
        const intFields=[
            "CompanyMasterSid",
            "BranchMasterSid",
            "MenuMasterSid",
            "Carrier",
        ];
        const stringFields = [
            "PrintType",
            "POL",
            "POD",
            "FDC",
            "status",
            "Remarks"
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

        const searchResults = await this._db.termsAndConditionsMaster.findMany({
            where : whereClause
        }).catch((err) => {
            throw new Error(`Error Occured : ${JSON.stringify(err), err}`);
        })

        return searchResults;

    }

}