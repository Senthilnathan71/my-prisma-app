import { BadRequestException, Injectable } from '@nestjs/common';
import { DatabaseService } from 'src/database/database.service';
import { SearchListDto } from 'src/masters/DTO/search-list.dto';

@Injectable()
export class CustomerSalesteamService {
    constructor(private _db:DatabaseService){}

    async getAllSalesteam(){
        try {
            const allSalesteam = await this._db.customerSalesTeam.findMany({
                where : {
                    status : 'A'
                },
                include : {
                    customerBranch : {
                        select : {
                            BranchName : true
                        }
                    }
                }
            })
            return allSalesteam;
        } catch (error) {
            throw error;
        }
    }

    async createNewSalesteam(payload){
        try {
            const createdSalesteam = await this._db.customerSalesTeam.create({
                data :{
                    ...payload,
                }
            })
            return createdSalesteam;
        } catch (error) {
            throw error;
        }
    }

    

    async fetchSalesteamById(CustomerSalesSid:number){
        try {
            const ourSalesteam =await this._db.customerSalesTeam.findUnique({
                where : {
                    CustomerSalesSid:CustomerSalesSid
                }
            })
            if(!ourSalesteam){
                throw new BadRequestException(`Salesteam with Id : ${CustomerSalesSid} not exists`);
            }
            return ourSalesteam;
        } catch (error) {
            throw error;
        }
    }

    async updateSalesteamById(CustomerSalesSid:number,payload){
        try {
             const exist =await this._db.customerSalesTeam.findUnique({
                where : {
                    CustomerSalesSid:CustomerSalesSid
                }
            })
            if(!exist){
                throw new BadRequestException(`Salesteam with Id : ${CustomerSalesSid} not exists`);
            }
            const updatedSalesteam = this._db.customerSalesTeam.update({
                where : {
                    CustomerSalesSid : CustomerSalesSid
                },
                data : payload
            })
            return updatedSalesteam;
        } catch (error) {
            throw error;
        }
    }


    async deleteSalesteam(CustomerSalesSid:number){
        try {
            const exist = await this._db.customerSalesTeam.findUnique({
                where: {
                    CustomerSalesSid: CustomerSalesSid
                }
            })
            if (!exist) {
                throw new BadRequestException(`Salesteam with Id : ${CustomerSalesSid} not exists`);
            }
            if (exist.status === 'D') {
                throw new BadRequestException(`Salesteam with Id :${CustomerSalesSid} is already deleted`)
            }
            const deletedSalesteam = this._db.customerSalesTeam.update({
                where: {
                    CustomerSalesSid: CustomerSalesSid
                },
                data: {
                    status : 'D'
                }
            })
            return deletedSalesteam;
        } catch(error) {
            throw error;
        }
    }


    async searchSalesteam(data:SearchListDto){
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

        const searchResults = await this._db.customerSalesTeam.findMany({
            where : {
                ...whereClause,
                status : 'A'
            }
        }).catch((err) => {
            throw new Error(`Error Occured : ${JSON.stringify(err), err}`);
        })

        return searchResults;

    }

    async getSalesPerson() {
        try {
            const salesPerson = await this._db.userMaster.findMany({
                where: {
                    isSalesperson: '1',
                    status : 'A'
                },
                omit : {
                    userPassword : true
                }
            })
            return salesPerson;
        } catch (error) {
            throw error
        }
    }

}
