import { BadRequestException, Injectable } from '@nestjs/common';
import { DatabaseService } from 'src/database/database.service';
import { SearchListDto } from 'src/masters/DTO/search-list.dto';

@Injectable()
export class DocumentTypeService {
    constructor(private _db:DatabaseService){}

    async getAllDocType(){
        try {
            const allDocType = await this._db.documentTypeMaster.findMany({
                where : {
                    deletedAt:null
                }
            })
            return allDocType;
        } catch (error) {
            throw error;
        }
    }

    async createNewDocType(payload){
        try {
            const createdDocType = await this._db.documentTypeMaster.create({
                data :{
                    ...payload,
                }
            })
            return createdDocType;
        } catch (error) {
            throw error;
        }
    }

    async fetchDocTypeById(DocumentTypeMasterSid:number){
        try {
            const ourDocType =await this._db.documentTypeMaster.findUnique({
                where : {
                    DocumentTypeMasterSid:DocumentTypeMasterSid
                }
            })
            if(!ourDocType){
                throw new BadRequestException(`DocType with Id : ${DocumentTypeMasterSid} not exists`);
            }
            return ourDocType;
        } catch (error) {
            throw error;
        }
    }

    async updateDocTypeById(DocumentTypeMasterSid:number,payload){
        try {
             const exist =await this._db.documentTypeMaster.findUnique({
                where : {
                    DocumentTypeMasterSid:DocumentTypeMasterSid
                }
            })
            if(!exist){
                throw new BadRequestException(`DocType with Id : ${DocumentTypeMasterSid} not exists`);
            }
            const updatedDocType = this._db.documentTypeMaster.update({
                where : {
                    DocumentTypeMasterSid : DocumentTypeMasterSid
                },
                data : payload
            })
            return updatedDocType;
        } catch (error) {
            throw error;
        }
    }


    async deleteDocType(DocumentTypeMasterSid:number){
        try {
            const exist = await this._db.documentTypeMaster.findUnique({
                where: {
                    DocumentTypeMasterSid: DocumentTypeMasterSid
                }
            })
            if (!exist) {
                throw new BadRequestException(`DocType with Id : ${DocumentTypeMasterSid} not exists`);
            }
            if (exist.deletedAt) {
                throw new BadRequestException(`DocType with Id :${DocumentTypeMasterSid} is already deleted`)
            }
            const deletedDocType = this._db.documentTypeMaster.update({
                where: {
                    DocumentTypeMasterSid: DocumentTypeMasterSid
                },
                data: {
                    deletedAt: new Date()
                }
            })
            return deletedDocType;
        } catch(error) {
            throw error;
        }
    }


    async searchDocType(data:SearchListDto){
        const {searchType,filterValue}=data;
        const intFields=[
            'CompanyMasterSid',
            'BranchMasterSid',
            'COAGroup',
            'COASubgroup',
            'COALedger',
            'Subledger',
            'DocumentStartingNo',
            'DocumentSLNoLength',
        ];
        const stringFields = [
            'DocumentTypeName',
            'DocumentTypeCode',
            'CurrencyCode',
            'DocumentSeparator',
            'ResetValue',
            'CompanyFlag',
            'CompanyValue',
            'BranchFlag',
            'BranchValue',
            'DocumentFlag',
            'DocumentValue',
            'MonthFlag',
            'YearFlag',
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

        const searchResults = await this._db.documentTypeMaster.findMany({
            where : {
                ...whereClause,
                deletedAt:null
            },
            include : {
                branchMaster : {
                    select : {
                        branchName : true
                    }
                }
            }
        }).catch((err) => {
            throw new Error(`Error Occured : ${JSON.stringify(err), err}`);
        })

        return searchResults;

    }

}
