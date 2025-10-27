import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { GlobalConfigService } from 'src/common/config/master-config.service';
import { statusWhereClause } from 'src/common/helper';
import { DatabaseService } from 'src/database/database.service';
import { filterDto } from 'src/masters/DTO/search-vessel.dto';

@Injectable()
export class CreditRequestService {
    constructor(private _db: DatabaseService, private logger: Logger,private globalConfigService: GlobalConfigService) { }

    async searchCreditCustomer(params: filterDto) {
        const { search = '', page =1, pageSize = 15, activeCompanyId } = params;
        const skip = (page - 1) * pageSize;

        const where: Prisma.CustomerMasterWhereInput = {
            status: statusWhereClause,
            CashCredit: 'Credit',
            CompanyMasterSid: activeCompanyId,
            ...(search
                ? {
                    OR: [
                        { CustomerName: { contains: search, mode: 'insensitive'}},
                        { PanType: { contains: search, mode: 'insensitive'}},
                        { countryMaster: { countryName: { contains: search, mode: 'insensitive'}}},
                    ],
                } : {}
            ),

        };

        const [items, totalCount] = await this._db.$transaction([
            this._db.customerMaster.findMany({
                where,
                skip,
                take: pageSize,
                orderBy: { CustomerMasterSid: 'desc' },
            }),
            this._db.customerMaster.count({ where }),
        ])
        return {items, totalCount};
    }

    async getDepartment(dept) {
        try {
            const allSalesman = await this._db.customerSalesTeam.findMany({
                where: {
                    CompanyMasterSid: dept.CompanyMasterSid,
                    EffectiveFrom: { lte: dept.EffectiveFrom},
                    status: 'A',
                    CustomerMasterSid: dept.CustomerMasterSid,
                    CustomerBranchSid: dept.CustomerBranchSid
                },
                select : {
                    DepartmentMasterSid: true,
                },
                orderBy: {
                    CustomerSalesSid: 'desc'
                }
            });
            const uniqueDeptIds = new Set<number>()
            allSalesman.map(salesman =>{
                const deptArr =salesman.DepartmentMasterSid;
                if(deptArr.length > 0){
                    deptArr.forEach(deptId => {
                        if(!uniqueDeptIds.has(parseInt(deptId))){
                            uniqueDeptIds.add(parseInt(deptId));
                        }
                    })
                }
            })
            let enrichedDept = await Promise.all(
                Array.from(uniqueDeptIds).map(async (item) => {
                    const [depart] = await Promise.all([
                        this.globalConfigService.getMasterData('department_master', item,dept.CompanyMasterSid),
                    ])
                    return {
                        ...depart,
                    }
                })
            )
            return enrichedDept;
        } catch (error) {
            throw error
        }
    }

    async getSalesperson(salesman){
        try { 
            const salesPerson = await this._db.customerSalesTeam.findMany({
                where:{
                    CompanyMasterSid: salesman.CompanyMasterSid,
                    EffectiveFrom:{ lte : salesman.EffectiveFrom},
                    status: 'A',
                    CustomerMasterSid: salesman.CustomerMasterSid,
                    DepartmentMasterSid: {
                        has: salesman.DepartmentMasterSid
                    },
                    CustomerBranchSid: salesman.CustomerBranchSid
                },
                orderBy: {
                    CustomerSalesSid: 'desc'
                }
            });
            
            let enrichedSalesperson = await Promise.all(
            salesPerson.map(async (item) => {
                const [salesman] = await Promise.all([
                    item.Salesman !== null ?
                        this.globalConfigService.getMasterData('user_master', item.Salesman) :
                        { UserMasterSid: null, userName: '' },
                ])
                return {
                    ...item,
                    salesman
                }
            })
        )
            return enrichedSalesperson;
        } catch (error) {
            throw error
        }
    }

    async createCreditRequest(payload: any, user) {
        try {
            const credit = await this._db.customerCreditRequest.create({
                data: {
                   ...payload, 
                }
            });
            return credit;
        } catch (error) {
            throw new Error(`Error creating credit request: ${error.message}`);
        }
    }

    async updateCreditRequest(CustomerCreditRequestSid: number, payload: any, user) {
        try {
            const credit = await this._db.customerCreditRequest.update({
                where: {
                  CustomerCreditRequestSid: CustomerCreditRequestSid  
                },
                data: {
                    ...payload,
                }
            });
            return credit;
        } catch (error) {
            throw new Error(`Error updating credit request: ${error.message}`);
        }
    }

    async deleteCreditRequest(CustomerCreditRequestSid: number) {
        try {
            const existing = await this._db.customerCreditRequest.findUnique({
                where: {
                    CustomerCreditRequestSid: CustomerCreditRequestSid
                }
            })
            if (!existing) {
                throw new BadRequestException(`Credit Request with  id: ${CustomerCreditRequestSid} not exists`);
            }
            if (existing.Status === 'D') {
                throw new BadRequestException(`Credit Request with  id: ${CustomerCreditRequestSid} is already deleted`);
            }
            const deletedCreditRequest = await this._db.customerCreditRequest.update({
                where: {
                    CustomerCreditRequestSid: CustomerCreditRequestSid
                },
                data: {
                    Status: 'D'
                }
            })
            return deletedCreditRequest;
        } catch (error) {
            throw error;
        }
    }
}
