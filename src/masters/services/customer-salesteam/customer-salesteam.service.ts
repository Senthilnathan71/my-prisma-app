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

    async getAllSalesteamOfCustomer(CustomerMasterSid: number) {
        try {
            const allBranches = await this._db.customerBranch.findMany({
                where: {
                    CustomerMasterSid,
                    status: statusWhereClause,
                },
                select: {
                    CustomerBranchSid: true,
                },
            });

            const allCustomerBranchId = allBranches.map(b => Number(b.CustomerBranchSid));
            console.log(allCustomerBranchId);
            console.log(allCustomerBranchId, typeof allCustomerBranchId[0]);

            const allSaleBranch = await this._db.customerSalesTeam.findMany({
                where: {
                    CustomerBranchSid: { in: allCustomerBranchId }
                },
            });

            const allSaleBranchId = allSaleBranch.map(b => Number(b.CustomerSalesSid));
            console.log(allSaleBranchId);

            const allSalesteam = await this._db.customerSalesTeam.findMany({
                where: {
                    status: statusWhereClause,
                    CustomerSalesSid: { in: allSaleBranchId },
                },
                include: {
                    customerMaster: {
                        include:{
                            CustomerBranch:true
                        }
                    },
                },
                orderBy: {
                    CustomerSalesSid: 'desc',
                },
            });


            // const allSalesteam = await this._db.customerSalesTeam.findMany({
            //     where: {
            //         status: statusWhereClause,
            //         branches: {
            //             some: {
            //                 customerBranch : {
            //                     CustomerBranchSid : { in: allBranchId },
            //                 }
            //             },
            //         },
            //     },
            //     include: {
            //         branches: true,
            //     },
            //     orderBy: {
            //         CustomerSalesSid: 'desc',
            //     },
            // });

            const formattedSalesteam = allSalesteam.map(salesteam => ({
                CustomerSalesSid: salesteam.CustomerSalesSid,
                Salesman: salesteam.Salesman,
                CompanyMasterSid: salesteam.CompanyMasterSid,
                EffectiveFrom: salesteam.EffectiveFrom,
                DepartmentMasterSid: salesteam.DepartmentMasterSid,
                CSPerson: salesteam.CSPerson,
                DocPerson: salesteam.DocPerson,
                status: salesteam.status,
                // branches: (salesteam.cus || []).map(b => ({
                //     id: b.id,
                //     customerBranchSid: b.customerBranchSid,
                // })),
            }));

            return formattedSalesteam;
        } catch (error) {
            throw error;
        }
    }




async saveCustomerSalesteam(customerSalesteam: any[]) {
    // try {
    //     const finalSalesteam: any[] = [];
    //     for (const salesteam of customerSalesteam) {
    //         const result = await this._db.$transaction(async (tx) => {
    //             let updatedSalesteam;
    //             let createdSalesteam;

    //             if (salesteam.CustomerSalesSid) {
    //                 updatedSalesteam = await tx.customerSalesTeam.update({
    //                     where: { CustomerSalesSid: salesteam.CustomerSalesSid },
    //                     data: {
    //                         Salesman: salesteam.Salesman,
    //                         EffectiveFrom: salesteam.EffectiveFrom,
    //                         DepartmentMasterSid: salesteam.DepartmentMasterSid,
    //                         status: salesteam.status,
    //                         updatedBy: salesteam.updatedBy,
    //                         CSPerson: salesteam.CSPerson,
    //                         DocPerson: salesteam.DocPerson,
    //                     },
    //                 });

    //                 const customerSalesBranch = salesteam.branches || [];
    //                 for (const branch of customerSalesBranch) {
    //                     if (branch.id) {
    //                         await tx.customerSalesBranch.update({
    //                             where: { id: branch.id },
    //                             data: { customerBranchSid: branch.customerBranchSid },
    //                         });
    //                     } else {
    //                         await tx.customerSalesBranch.create({
    //                             data: {
    //                                 customerSalesSid: updatedSalesteam.CustomerSalesSid,
    //                                 customerBranchSid: branch.customerBranchSid,
    //                             },
    //                         });
    //                     }
    //                 }
    //                 return updatedSalesteam;
    //             } else {
    //                 createdSalesteam = await tx.customerSalesTeam.create({
    //                     data: {
    //                         Salesman: salesteam.Salesman,
    //                         CompanyMasterSid: salesteam.CompanyMasterSid,
    //                         EffectiveFrom: salesteam.EffectiveFrom,
    //                         createdBy: salesteam.createdBy,
    //                         status: salesteam.status,
    //                         DepartmentMasterSid: salesteam.DepartmentMasterSid,
    //                         CSPerson: salesteam.CSPerson,
    //                         DocPerson: salesteam.DocPerson,
    //                     },
    //                 });

    //                 const createdBranches = await Promise.all(
    //                     (salesteam.branches || []).map(branch =>
    //                         tx.customerSalesBranch.create({
    //                             data: {
    //                                 customerSalesSid: createdSalesteam.CustomerSalesSid,
    //                                 customerBranchSid: branch.customerBranchSid,
    //                             },
    //                         })
    //                     )
    //                 );
    //                 console.log(createdBranches);

    //                 return createdSalesteam;
    //             }
    //         });
    //         finalSalesteam.push(result);
    //     }
    //     return finalSalesteam;
    // } catch (error) {
    //     throw error;
    // }
}



}
