import { BadRequestException, Injectable } from '@nestjs/common';
import { DatabaseService } from 'src/database/database.service';
import { SearchListDto } from 'src/masters/DTO/search-list.dto';

@Injectable()
export class TermsAndConditionsDetailService {
    constructor(private _db:DatabaseService){}

    async getAllTermAndCondDetails(){
        try {
            const allTCDetails = await this._db.termsAndConditionsDetail.findMany({
                where : {
                    deletedAt:null
                }
            })
            return allTCDetails;
        } catch (error) {
            throw error;
        }
    }

    async createNewTermAndCondDetail(payload){
        try {
            const createdTCdetail = await this._db.termsAndConditionsDetail.create({
                data :{
                    ...payload,
                    createdBy :'admin@crm.com'
                }
            })
            return createdTCdetail;
        } catch (error) {
            throw error;
        }
    }

    async fetchTermAndCondDetailById(TermsAndConditionsDetailSid:number){
        try {
            const ourTCDetail =await this._db.termsAndConditionsDetail.findUnique({
                where : {
                    TermsAndConditionsDetailSid:TermsAndConditionsDetailSid
                }
            })
            if(!ourTCDetail){
                throw new BadRequestException(`Terms and Conditions Detail with Id : ${TermsAndConditionsDetailSid} not exists`);
            }
            return ourTCDetail;
        } catch (error) {
            throw error;
        }
    }

    async updateTermAndCondDetailById(TermsAndConditionsDetailSid:number,payload){
        try {
             const exist =await this._db.termsAndConditionsDetail.findUnique({
                where : {
                    TermsAndConditionsDetailSid:TermsAndConditionsDetailSid
                }
            })
            if(!exist){
                throw new BadRequestException(`Terms and Conditions Details with Id : ${TermsAndConditionsDetailSid} not exists`);
            }
            const updatedProduct = this._db.termsAndConditionsDetail.update({
                where : {
                    TermsAndConditionsDetailSid : TermsAndConditionsDetailSid
                },
                data : payload
            })
            return updatedProduct;
        } catch (error) {
            throw error;
        }
    }


    async deleteTermAndCondDetail(TermsAndConditionsDetailSid:number){
        try {
            const exist = await this._db.termsAndConditionsDetail.findUnique({
                where: {
                    TermsAndConditionsDetailSid: TermsAndConditionsDetailSid
                }
            })
            if (!exist) {
                throw new BadRequestException(`Terms and Conditions Detail with Id : ${TermsAndConditionsDetailSid} not exists`);
            }
            if (exist.deletedAt) {
                throw new BadRequestException(`Terms and Conditions Detail with Id :${TermsAndConditionsDetailSid} is already deleted`)
            }
            const deletedTCDetail = this._db.termsAndConditionsDetail.update({
                where: {
                    TermsAndConditionsDetailSid: TermsAndConditionsDetailSid
                },
                data: {
                    deletedAt: new Date()
                }
            })
            return deletedTCDetail;
        } catch(error) {
            throw error;
        }
    }


    async searchTermAndCondDetail(data:SearchListDto){
        const {searchType,filterValue}=data;
        const intFields=[
            "TermsAndConditionsMasterSid",
        ];
        const stringFields = [  
            "TandC",
            "Type",
            "TypeValue",
            "status",
            "IsDefaut"
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

        const searchResults = await this._db.termsAndConditionsDetail.findMany({
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