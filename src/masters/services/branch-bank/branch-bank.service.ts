import { BadRequestException, Injectable } from '@nestjs/common';
import { DatabaseService } from 'src/database/database.service';
import { SearchListDto } from 'src/masters/DTO/search-list.dto';

@Injectable()
export class BranchBankService {
    constructor(private _db:DatabaseService){}

    async createNewBranchBack(newData:any){
        try {
            const newlyCreatedBank= await this._db.branchBank.create({
                data:{
                    ...newData,
                }
            })
            return newlyCreatedBank;
        } catch (error) {
            throw error;
        }
    }

    async getAllBranchBanks(){
        try {
            const allBranchBanks = await this._db.branchBank.findMany({
                where : {
                    status : 'A'
                }
            })
            return allBranchBanks;
        } catch (error) {
            throw error;
        }
    }

    async getBranchBankById(BranchBankSid:number){
        try {
            const ourBranchBank = await this._db.branchBank.findUnique({
                where : {
                    BranchBankSid:BranchBankSid
                }
            })
            if(!ourBranchBank){
                throw new BadRequestException(`Branch Bank with id : ${BranchBankSid} not found`);
            }
            return ourBranchBank;
        } catch (error) {
            throw error;
        }
    }


    async updateBranchBankById(BranchBankSid:number,updateData:any){
        try {
            const exist = await this._db.branchBank.findUnique({
                where : {
                    BranchBankSid:BranchBankSid
                }
            })
            if(!exist){
                throw new BadRequestException(`Branch Bank with id : ${BranchBankSid} not found`);
            }
            const updatedBrBank = await this._db.branchBank.update({
                where : {
                    BranchBankSid:BranchBankSid
                },
                data : updateData,
            })
            return updatedBrBank
        } catch (error) {
            throw error;
        }
    }

    async deleteBranchBankById(BranchBankSid:number){
        try {
            const exist = await this._db.branchBank.findUnique({
                where : {
                    BranchBankSid:BranchBankSid
                }
            })
            if(!exist){
                throw new BadRequestException(`Branch Bank with id : ${BranchBankSid} not found`);
            }
            if(exist.status === 'D'){
                throw new BadRequestException(`Branch Bank with id:${BranchBankSid} is already deleted`)
            }
            const deletedBrBank = await this._db.branchBank.update({
                where : {
                    BranchBankSid:BranchBankSid
                },
                data : {
                    status : 'D'
                },
            })
            return deletedBrBank;
        } catch (error) {
            throw error;
        }
    }

    async searchBranchBank(data:SearchListDto){
        const {searchType,filterValue}=data;
        const intFields=[''];
        const stringFields = [
            'BankCode',
            'BankName',
            'BankAddress',
            'IFSCCode',
            'BankAccountNo',
            'BeneficiaryName',
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

        const searchResults = await this._db.branchBank.findMany({
            where : {
                ...whereClause,
                status : 'A'
            }
        }).catch((err) => {
            throw new Error(`Error Occured : ${JSON.stringify(err), err}`);
        })

        return searchResults;

    }

}
