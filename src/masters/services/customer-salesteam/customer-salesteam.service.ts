import { BadRequestException, Injectable } from '@nestjs/common';
import { statusWhereClause } from 'src/common/helper';
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
                    DepartmentMasterSid : payload.DepartmentMasterSid,
                    Salesman : payload.Salesman,
                    // CustomerBranchSid : payload.CustomerBranchSid,
                    // CSPerson : payload.CSPerson,
                    // DocPerson : payload.DocPerson,
                    EffectiveFrom : payload.EffectiveFrom,
                    status : payload.status,
                    createdBy : payload.createdBy,

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

    async getAllSalesteamOfCustomer(CustomerMasterSid:number){
        try {
            const allBranches = await this._db.customerBranch.findMany({
                where : {
                    CustomerMasterSid : CustomerMasterSid,
                    status : statusWhereClause
                },
                select : {
                    CustomerBranchSid : true
                }
            })
            const allBranchId = allBranches.map(b => b.CustomerBranchSid);
            const allSalesteam = await this._db.customerSalesTeam.findMany({
                where : {
                    // CustomerBranchSid : {
                    //     in : allBranchId
                    // },
                    status : statusWhereClause
                },
                orderBy : {
                    CustomerSalesSid : 'desc'
                }
            })
            return allSalesteam;
        } catch (error) {
            throw error;
        }
    }



    async saveCustomerSalesteam(customerSalesteam:any){
        try {
            return await this._db.$transaction(async (prisma)=>{
                let finalSalesteam :any[] = [];
                for(const salesteam of customerSalesteam) {
                    let updatedSalesteam;
                    let createdSalesteam;
                    if(salesteam.CustomerSalesSid){
                        updatedSalesteam = await prisma.customerSalesTeam.update({
                            where : {
                                CustomerSalesSid : salesteam.CustomerSalesSid
                            },
                            data : {
                                Salesman : salesteam.Salesman,
                                // CustomerBranchSid : salesteam.CustomerBranchSid,
                                EffectiveFrom : salesteam.EffectiveFrom,
                                status : salesteam.status,
                                updatedBy : salesteam.updatedBy,
                            }
                        })
                        finalSalesteam.push(updatedSalesteam);
                    } else {
                        createdSalesteam = await prisma.customerSalesTeam.create({
                            data : {
                                Salesman : salesteam.Salesman,
                                // CustomerBranchSid : salesteam.CustomerBranchSid,
                                EffectiveFrom : salesteam.EffectiveFrom,
                                status : salesteam.status,
                                createdBy : salesteam.createdBy
                            }
                        })
                        finalSalesteam.push(createdSalesteam);
                    }
                }
                return finalSalesteam;
            })
        } catch (error) {
            throw error;
        }
    }


}
