import { BadRequestException, Injectable, InternalServerErrorException, Logger, NotFoundException } from '@nestjs/common';
import { ApprovalStatus, Prisma } from '@prisma/client';
import { GlobalConfigService } from 'src/common/config/master-config.service';
import { statusWhereClause } from 'src/common/helper';
import { DatabaseService } from 'src/database/database.service';
import { filterDto } from 'src/masters/DTO/search-vessel.dto';

export interface CustomerCreditRequestInterface {
  CustomerCreditRequestSid?: number;
  CustomerMasterSid: number;
  CompanyMasterSid: number;
  DepartmentMasterSid?: number | null;
  CustomerBranchSid?: number | null;
  SalesmanSid?: number | null;
  CreditDays: number;
  CreditLimit: number;
  PublishedDays: number;
  PublishedLimit: number;
  EffectiveFrom: Date | string;
  EffectiveTo: Date | string;
  ApprovalStatus?: ApprovalStatus | null;
  CreatedBy: string;
  UpdatedBy?: string;
  Status?: string;
}
 
export interface CustomerKycInterface {
  CustomerKycSid?: number;
  CustomerMasterSid?: number | null;
  CompanyMasterSid: number;
  CustomerCreditRequestSid: number;
  CustomerBranchSid?: number | null;
  KycSno: number;
  KycDocName: string;
  KycDocNumber: string;
  AttachDocumentSid?: number | null;
  CreatedBy: string;
  UpdatedBy?: string;
}
 
export interface CustomerCreditRequestWithKycInterface extends CustomerCreditRequestInterface {
  customerKyc: CustomerKycInterface[];
}
@Injectable()
export class CreditRequestService {
    constructor(private _db: DatabaseService, private logger: Logger,private globalConfigService: GlobalConfigService) { }

    async searchCreditCustomer(params: filterDto) {
        const { search = '', page =1, pageSize = 15, activeCompanyId } = params;
        const skip = (page - 1) * pageSize;

        const where: Prisma.CustomerMasterWhereInput = {
            status: 'A',
            CashCredit: 'Credit',
            CustomerType: {
                path: ['customer'], equals: 'isTrue'
            },
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
                include : {
                    countryMaster: {
                        select: {
                            countryName: true,
                        }
                    }
                }
            }),
            this._db.customerMaster.count({ where }),
        ])
        const enrichedItems = items.map((item) => ({
    ...item,
    CountryName: item.countryMaster?.countryName || null,
  }));

        return {items: enrichedItems, totalCount};
    }

    async getDepartment(dept) {
        try {
            const allSalesman = await this._db.customerSalesTeam.findMany({
                where: {
                    CompanyMasterSid: dept.CompanyMasterSid,
                    EffectiveFrom: { lte: new Date() },
                    status: 'A',
                    CustomerMasterSid: dept.CustomerMasterSid,
                     CustomerBranchSid: typeof dept.CustomerBranchSid === 'object'
          ? dept.CustomerBranchSid.id
          : dept.CustomerBranchSid,
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
                        const id = parseInt(deptId);
          if (!uniqueDeptIds.has(id)) uniqueDeptIds.add(id);
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

   async getSalesperson(salesman) {
  try {
    const deptValue = salesman.DepartmentMasterSid;

    const salesPerson = await this._db.customerSalesTeam.findMany({
      where: {
        CompanyMasterSid: salesman.CompanyMasterSid,
        EffectiveFrom: { lte: new Date() },
        status: 'A',
        CustomerMasterSid: salesman.CustomerMasterSid,
        CustomerBranchSid: salesman.CustomerBranchSid,
        ...(deptValue && {
          DepartmentMasterSid: Array.isArray(deptValue)
            ? { hasSome: deptValue.map(String) } // if you have multiple department SIDs
            : { has: String(deptValue) }         // if only one
        }),
      },
      orderBy: { CustomerSalesSid: 'desc' },
    });

    const enrichedSalesperson = await Promise.all(
      salesPerson.map(async (item) => {
        const salesmanData = item.Salesman
          ? await this.globalConfigService.getMasterData('user_master', item.Salesman)
          : { UserMasterSid: null, userName: '' };
        return { ...item, salesman: salesmanData };
      })
    );

    return enrichedSalesperson;
  } catch (error) {
    throw error;
  }
}


    /**
   * Get all credit requests for a customer with KYC details
   * @param CustomerMasterSid - Customer Master SID
   * @returns Array of credit requests with related KYC records
   */
  async getCreditRequestOfCustomer(CustomerMasterSid: number) {
    try {
      const creditRequests = await this._db.customerMaster.findMany({
        where: {
          CustomerMasterSid: CustomerMasterSid,
        },
        include: {
            countryMaster: {
                select: {
                    countryName: true,
                }
            },
            CustomerBranch: true,
          customerCreditRequest : {
            where : {Status : 'A'},
            include : {
                company: {
                    select: {
                        companyName: true
                    }
                },
                department: {
                    select: {
                        departmentName: true
                    }
                },
                salesman: {
                    select: {
                        userName: true
                    }
                },
              customerKyc : true
            },
            orderBy : { CustomerCreditRequestSid : 'asc'}
          },
        },
       
      });
 
      return creditRequests;
    } catch (error) {
      this.logger.error(
        `Error fetching credit requests for customer ${CustomerMasterSid}: ${error.message}`,
      );
      throw error;
    }
  }

     /**
   * Create a single credit request without KYC
   * @param payload - Credit request data
   * @returns Created credit request
   */
  async createSingleCustomerCreditReq(payload: CustomerCreditRequestInterface) {
    try {
      const creditRequest = await this._db.customerCreditRequest.create({
        data: {
          CustomerMasterSid: payload.CustomerMasterSid,
          CompanyMasterSid: payload.CompanyMasterSid,
          DepartmentMasterSid: payload.DepartmentMasterSid || null,
          CustomerBranchSid: payload.CustomerBranchSid || null,
          SalesmanSid: payload.SalesmanSid || null,
          CreditDays: payload.CreditDays,
          CreditLimit: payload.CreditLimit,
          PublishedDays: payload.PublishedDays,
          PublishedLimit: payload.PublishedLimit,
          EffectiveFrom: new Date(payload.EffectiveFrom),
          EffectiveTo: new Date(payload.EffectiveTo),
          ApprovalStatus: payload.ApprovalStatus || ApprovalStatus.Pending,
          CreatedBy: payload.CreatedBy,
          Status: 'A',
        },
      });
 
      return creditRequest;
    } catch (error) {
      this.logger.error(
        `Error creating credit request: ${error.message}`,
      );
      throw error;
    }
  }

      /**
   * Create a single customer KYC record
   * @param payload - KYC data
   * @returns Created KYC record
   */
  async createSingleCustomerKyc(payload: CustomerKycInterface) {
    try {
      const kyc = await this._db.customerKyc.create({
        data: {
          CustomerMasterSid: payload.CustomerMasterSid || null,
          CompanyMasterSid: payload.CompanyMasterSid,
          CustomerCreditRequestSid: payload.CustomerCreditRequestSid,
          CustomerBranchSid: payload.CustomerBranchSid || null,
          KycSno: payload.KycSno,
          KycDocName: payload.KycDocName,
          KycDocNumber: payload.KycDocNumber,
          AttachDocumentSid: payload.AttachDocumentSid || null,
          CreatedBy: payload.CreatedBy,
        }
      });
 
      return kyc;
    } catch (error) {
      this.logger.error(`Error creating customer KYC: ${error.message}`);
      throw error;
    }
  }

    /**
   * Create credit requests with KYC documents in a transaction
   * @param payload - Array of credit requests with nested KYC documents
   * @returns Array of created credit requests with their KYC records
   */
  async createCustomerCreditReqWithKyc(
    payload: CustomerCreditRequestWithKycInterface[],
  ) {
    try {
      const result = await this._db.$transaction(async (prisma) => {
        const createdRecords : any[] = [];
 
        for (const item of payload) {
          // Create credit request
          const creditRequest = await this.createSingleCustomerCreditReq({
              CustomerMasterSid: item.CustomerMasterSid,
              CompanyMasterSid: item.CompanyMasterSid,
              DepartmentMasterSid: item.DepartmentMasterSid || null,
              CustomerBranchSid: item.CustomerBranchSid || null,
              SalesmanSid: item.SalesmanSid || null,
              CreditDays: item.CreditDays ,
              CreditLimit: item.CreditLimit,
              PublishedDays: item.PublishedDays,
              PublishedLimit: item.PublishedLimit,
              EffectiveFrom: new Date(item.EffectiveFrom),
              EffectiveTo: new Date(item.EffectiveTo),
              ApprovalStatus: item.ApprovalStatus,
              CreatedBy: item.CreatedBy,
              Status: 'A',
            })
 
          const kycRecords : any[] = [];
 
          // Create KYC records if provided
          if (item.customerKyc && item.customerKyc.length > 0) {
            for (const kycItem of item.customerKyc) {
              const kyc = await this.createSingleCustomerKyc({
                  CustomerMasterSid: kycItem.CustomerMasterSid || null,
                  CompanyMasterSid: kycItem.CompanyMasterSid,
                  CustomerCreditRequestSid:
                    creditRequest.CustomerCreditRequestSid,
                  CustomerBranchSid: kycItem.CustomerBranchSid || null,
                  KycSno: kycItem.KycSno,
                  KycDocName: kycItem.KycDocName,
                  KycDocNumber: kycItem.KycDocNumber,
                  AttachDocumentSid: kycItem.AttachDocumentSid || null,
                  CreatedBy: kycItem.CreatedBy || 'system',
              })
 
              kycRecords.push(kyc);
            }
          }
 
          createdRecords.push({
            ...creditRequest,
            kycRecords,
          });
        }
 
        return createdRecords;
      });
 
      return result;
    } catch (error) {
      this.logger.error(
        `Error creating credit request with KYC: ${error.message}`,
      );
      throw error;
    }
  }

/**
   * Update or create credit requests with KYC documents in a transaction
   * @param payload - Array of credit requests with nested KYC documents
   * @returns Array of updated/created credit requests with their KYC records
   */
  async updateCustomerCreditReqWithKyc(
    payload: any[]
  ) {
    try {
      const result = await this._db.$transaction(async (prisma) => {
        const processedRecords : any[] = [];
 
        for (const item of payload) {
          let creditRequest;
 
          // Update or create credit request
          if (item.CustomerCreditRequestSid) {
            // Update existing credit request
            creditRequest = await prisma.customerCreditRequest.update({
              where: {
                CustomerCreditRequestSid: item.CustomerCreditRequestSid,
              },
              data: {
                CustomerMasterSid: item.CustomerMasterSid,
                CompanyMasterSid: item.CompanyMasterSid,
                DepartmentMasterSid: item.DepartmentMasterSid || null,
                CustomerBranchSid: item.CustomerBranchSid || null,
                SalesmanSid: item.SalesmanSid || null,
                CreditDays: item.CreditDays,
                CreditLimit: item.CreditLimit,
                PublishedDays: item.PublishedDays,
                PublishedLimit: item.PublishedLimit,
                EffectiveFrom: new Date(item.EffectiveFrom),
                EffectiveTo: new Date(item.EffectiveTo),
                ApprovalStatus: item.ApprovalStatus,
                UpdatedBy: item.UpdatedBy || item.CreatedBy,
                UpdatedOn: new Date(),
              },
            });
          } else {
            // Create new credit request
            creditRequest = await this.createSingleCustomerCreditReq({
                CustomerMasterSid: item.CustomerMasterSid,
                CompanyMasterSid: item.CompanyMasterSid,
                DepartmentMasterSid: item.DepartmentMasterSid || null,
                CustomerBranchSid: item.CustomerBranchSid || null,
                SalesmanSid: item.SalesmanSid || null,
                CreditDays: item.CreditDays,
                CreditLimit: item.CreditLimit,
                PublishedDays: item.PublishedDays,
                PublishedLimit: item.PublishedLimit,
                EffectiveFrom: new Date(item.EffectiveFrom),
                EffectiveTo: new Date(item.EffectiveTo),
                ApprovalStatus: item.ApprovalStatus,
                CreatedBy: item.CreatedBy,
                Status: 'A',
            });
          }
 
          const kycRecords : any[] = [];
 
          // Update or create KYC records if provided
          if (item.customerKyc && item.customerKyc.length > 0) {
            for (const kycItem of item.customerKyc) {
              let kyc;
 
              if (kycItem.CustomerKycSid) {
                // Update existing KYC record
                kyc = await prisma.customerKyc.update({
                  where: {
                    CustomerKycSid: kycItem.CustomerKycSid,
                  },
                  data: {
                    CustomerMasterSid: kycItem.CustomerMasterSid || null,
                    CompanyMasterSid: kycItem.CompanyMasterSid,
                    CustomerCreditRequestSid:
                      creditRequest.CustomerCreditRequestSid,
                    CustomerBranchSid: kycItem.CustomerBranchSid || null,
                    KycSno: kycItem.KycSno,
                    KycDocName: kycItem.KycDocName,
                    KycDocNumber: kycItem.KycDocNumber,
                    AttachDocumentSid: kycItem.AttachDocumentSid || null,
                    UpdatedBy: kycItem.UpdatedBy || kycItem.CreatedBy,
                    UpdatedOn: new Date(),
                  },
                });
              } else {
                // Create new KYC record
                kyc = await this.createSingleCustomerKyc({
                    CustomerMasterSid: kycItem.CustomerMasterSid || null,
                    CompanyMasterSid: kycItem.CompanyMasterSid,
                    CustomerCreditRequestSid:
                      creditRequest.CustomerCreditRequestSid,
                    CustomerBranchSid: kycItem.CustomerBranchSid || null,
                    KycSno: kycItem.KycSno,
                    KycDocName: kycItem.KycDocName,
                    KycDocNumber: kycItem.KycDocNumber,
                    AttachDocumentSid: kycItem.AttachDocumentSid || null,
                    CreatedBy: kycItem.CreatedBy,
                });
              }
 
              kycRecords.push(kyc);
            }
          }
 
          processedRecords.push({
            ...creditRequest,
            kycRecords,
          });
        }
 
        return processedRecords;
      });
 
      return result;
    } catch (error) {
      this.logger.error(
        `Error updating credit request with KYC: ${error.message}`,
      );
      throw error;
    }
  }

}
