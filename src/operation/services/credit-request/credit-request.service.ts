import { BadRequestException, Injectable, InternalServerErrorException, Logger, NotFoundException } from '@nestjs/common';
import { ApprovalStatus, Prisma, PrismaClient } from '@prisma/client';
import { OutstandingReportQueryDto } from 'src/accounts/dto/accounts-reports.dto';
import { OutstandingService } from 'src/accounts/services/outstanding/outstanding.service';
import { AccountsReportsService } from 'src/accounts/services/accounts-reports/accounts-reports.service';
import { CustomerOutstandingResponseDto } from 'src/accounts/dto/outstanding.dto';
import { GlobalConfigService } from 'src/common/config/master-config.service';
import { DOC_TYPE_CODE } from 'src/common/config/voucher-type.config';
import { addDaysCalendar, statusWhereClause } from 'src/common/helper';
import { DatabaseService } from 'src/database/database.service';
import { CreditLimitDto, CreditSummaryDto, OutstandingDto, ValidateBLDODto, ValidateCreditDto } from 'src/masters/DTO/credit-limit.dto';
import { filterDto } from 'src/masters/DTO/search-vessel.dto';
enum CustomerType {
  CASH = 'CASH',
  CREDIT = 'CREDIT',
}

interface CreditLimitResult {
  creditLimit: number;
  creditDays: number;
  publishedLimit: number;
  publishedDays: number;
  departmentMasterSid?: number;
  branchMasterSid: number;
  effectiveFrom: Date;
  effectiveTo: Date;
  approvalStatus: string;
}

interface OutstandingInvoice {
  voucherHeaderSid: number;
  voucherNo: string;
  voucherDate: Date;
  invoiceAmount: number;
  paidAmount: number;
  outstandingAmount: number;
  ageDays: number;
  masterJobSid?: number;
  houseJobSid?: number;
}

interface OutstandingResult {
  totalOutstanding: number;
  oldestOutstandingDays: number;
  outstandingInvoices: OutstandingInvoice[];
}

interface OutstandingComputationOptions {
  customerMasterSid: number;
  companyMasterSid: number;
  branchMasterSid?: number;
  masterJobSid?: number;
  houseJobSid?: number;
  scopeByJob?: boolean;
}

interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  creditInfo: {
    creditLimit: number;
    creditDays: number;
    totalOutstanding: number;
    oldestOutstandingDays: number;
    availableCredit: number;
    utilizationPercentage: number;
  };
}

interface BLDOViolatingVoucher {
  VoucherNumber: string;
  VoucherDate: Date;
  OutstandingLocalAmount: number;
  AgeingDays: number;
}

interface BLDOValidationResult {
  IsValid: boolean;
  Errors: string[];
  CustomerType: CustomerType;
  CreditLimit: number;
  CreditDays: number;
  RemainingCreditLimit: number | null;
  TotalOutstandingLocal: number;
  SelectedCreditRequestSid: number | null;
  ViolatingVouchers: BLDOViolatingVoucher[];
}

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
    constructor(
      private _db: DatabaseService,
      private logger: Logger,
      private globalConfigService: GlobalConfigService,
      private outstandingService: OutstandingService,
      private accountsReportsService: AccountsReportsService,
    ) { }

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
            CustomerBranch: {
                where: {
                    status: 'A',
                },
                include:{
                  CustomerSalesTeam:true
                }
            },
          customerCreditRequest : {
            where : {Status : statusWhereClause},
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
   * Soft delete a customer credit request
   * @param CustomerCreditRequestSid - Credit request SID
   * @returns Updated credit request
   */
  async deleteCustomerCreditRequest(CustomerCreditRequestSid: number) {
    const existing = await this._db.customerCreditRequest.findUnique({
      where: { CustomerCreditRequestSid },
    });

    if (!existing) {
      throw new NotFoundException(
        `Credit request with ID ${CustomerCreditRequestSid} not found`,
      );
    }

    if (existing.Status === 'D') {
      throw new BadRequestException(
        `Credit request with ID ${CustomerCreditRequestSid} is already deleted`,
      );
    }

    return this._db.customerCreditRequest.update({
      where: { CustomerCreditRequestSid },
      data: { Status: 'D' },
    });
  }

  /**
   * Delete a single customer KYC record
   * @param CustomerKycSid - Customer KYC SID
   * @returns Deleted KYC record
   */
  async deleteCustomerKyc(CustomerKycSid: number) {
    const existing = await this._db.customerKyc.findUnique({
      where: { CustomerKycSid },
    });

    if (!existing) {
      throw new NotFoundException(
        `Customer KYC with ID ${CustomerKycSid} not found`,
      );
    }

    return this._db.customerKyc.delete({
      where: { CustomerKycSid },
      
    });
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
                Status : String(item.Status).charAt(0),
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

  async getDueDate(payload: {
    CompanyMasterSid: number;
    CustomerMasterSid: number;
    CustomerBranchSid: number | null;
    DepartmentMasterSid: number | null;
    VoucherDate: Date;
  }): Promise<any> {
    const result = await this._db.$transaction(async (prisma) => {
      const customerMaster = await prisma.customerMaster.findUnique({
        where: { CustomerMasterSid: payload.CustomerMasterSid },
        select: { CashCredit: true },
      });

      if (!customerMaster) {
        throw new BadRequestException('Customer not found');
      }

      if (customerMaster.CashCredit === 'Cash') {
        // Business rule: cash = 1 day
        return {
          creditDays : 1,
          dueDate : addDaysCalendar(payload.VoucherDate, 2),
        }
      }

      const baseWhere: Prisma.CustomerCreditRequestWhereInput = {
        CompanyMasterSid: payload.CompanyMasterSid,
        CustomerMasterSid: payload.CustomerMasterSid,
        ApprovalStatus: ApprovalStatus.Approved,
        EffectiveFrom: { lte: new Date(payload.VoucherDate) },
        EffectiveTo: { gte: new Date(payload.VoucherDate) },
        Status: 'A',
      };

      // 1. Department specific
      const departmentSpecific = await this.getCreditRequest(
        {
          ...baseWhere,
          CustomerBranchSid: payload.CustomerBranchSid ?? undefined,
          DepartmentMasterSid: payload.DepartmentMasterSid ?? undefined,
        },
        prisma,
      );

      if (departmentSpecific?.CreditDays != null) {
        return {
          creditDays : departmentSpecific?.CreditDays,
          dueDate : addDaysCalendar(payload.VoucherDate,  departmentSpecific?.CreditDays + 1),
        }
      }

      // 2. Branch specific (no department)
      const branchSpecific = await this.getCreditRequest(
        {
          ...baseWhere,
          CustomerBranchSid: payload.CustomerBranchSid ?? undefined,
          DepartmentMasterSid: null,
        },
        prisma,
      );

      if (branchSpecific?.CreditDays != null) {
        return {
          creditDays : branchSpecific?.CreditDays,
          dueDate : addDaysCalendar(payload.VoucherDate,  branchSpecific?.CreditDays + 1),
        }
      }

      // 3. Party specific (no branch, no department)
      const partySpecific = await this.getCreditRequest(
        {
          ...baseWhere,
          CustomerBranchSid: null,
          DepartmentMasterSid: null,
        },
        prisma,
      );

      if (partySpecific?.CreditDays != null) {
        return {
          creditDays : partySpecific?.CreditDays,
          dueDate : addDaysCalendar(payload.VoucherDate, partySpecific?.CreditDays + 1),
        }
      }

      throw new BadRequestException('No credit request found');
    });

    return result;
  }

  async getCreditRequest(
    where: Prisma.CustomerCreditRequestWhereInput,
    tx?: PrismaClient | Prisma.TransactionClient,
  ) {
    const prisma = tx ?? this._db;
    return prisma.customerCreditRequest.findFirst({ where });
  }


  /**
   * Get credit limit for a customer
   * Priority:
   * 1) Customer + Branch + Department (if both provided)
   * 2) Customer + Branch (if branch provided)
   * 3) Customer-only (if branch not provided)
   */
  async getCreditLimit(dto: CreditLimitDto): Promise<CreditLimitResult> {
    try {
      const currentDate = new Date(); 
      
      // Base where clause
      const baseWhere: any = {
        CustomerMasterSid: dto.customerMasterSid,
        CompanyMasterSid: dto.companyMasterSid,
        Status: 'A',
        ApprovalStatus: ApprovalStatus.Approved,
        EffectiveFrom: { lte: currentDate },
        EffectiveTo: { gte: currentDate },
      };
      const hasBranch = !!dto.customerBranchSid;
      const hasDept = !!dto.departmentMasterSid;

      // 1) Customer + Branch + Department
      if (hasBranch && hasDept) {
        const deptCredit = await this._db.customerCreditRequest.findFirst({
          where: {
            ...baseWhere,
            CustomerBranchSid: dto.customerBranchSid,
            DepartmentMasterSid: dto.departmentMasterSid,
          },
          orderBy: { CustomerCreditRequestSid: 'desc' },
        });

        if (deptCredit) {
          return this.mapCreditLimitResponse(deptCredit);
        }
      }

      // 2) Customer + Branch only
      if (hasBranch) {
        const branchCredit = await this._db.customerCreditRequest.findFirst({
          where: {
            ...baseWhere,
            CustomerBranchSid: dto.customerBranchSid,
            DepartmentMasterSid: null,
          },
          orderBy: { CustomerCreditRequestSid: 'desc' },
        });

        if (branchCredit) {
          return this.mapCreditLimitResponse(branchCredit);
        }
      }

      // 3) Customer only (fallback for any case)
      const customerCredit = await this._db.customerCreditRequest.findFirst({
        where: {
          ...baseWhere,
          CustomerBranchSid: null,
          DepartmentMasterSid: null,
        },
        orderBy: { CustomerCreditRequestSid: 'desc' },
      });

      if (customerCredit) {
        return this.mapCreditLimitResponse(customerCredit);
      }

      throw new NotFoundException(
        'No approved credit limit found for this customer',
      );
    } catch (error) {
      this.logger.error(`Error fetching credit limit: ${error.message}`);
      throw error;
    }
  }

  /**
   * Calculate outstanding for a customer
   * Note: Since there's no VoucherMatching table, we need to get payment vouchers separately
   */
  async getOutstanding(dto: OutstandingDto): Promise<OutstandingResult> {
    try {
      return this.computeOutstanding({
        customerMasterSid: dto.customerMasterSid,
        companyMasterSid: dto.companyMasterSid,
        branchMasterSid: dto.branchMasterSid,
        masterJobSid: dto.masterJobSid,
        houseJobSid: dto.houseJobSid,
        scopeByJob: Boolean(dto.masterJobSid || dto.houseJobSid),
      });
    } catch (error) {
      this.logger.error(`Error calculating outstanding: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get outstanding breakdown by job
   */
  async getOutstandingByJob(
    customerMasterSid: number,
    companyMasterSid: number,
  ) {
    try {
      const customerLedgerMasterSid = await this.resolveCustomerLedgerMasterSid(
        companyMasterSid,
        customerMasterSid,
      );

      // Get invoice voucher type
      const invoiceType = await this._db.voucherTypeMaster.findFirst({
        where: {
          CompanyMasterSid: companyMasterSid,
          Type: { contains: 'Invoice', mode: 'insensitive' },
          status: 'A',
        },
        select: { VoucherTypeMasterSid: true },
      });

      if (!invoiceType) {
        throw new NotFoundException('Invoice voucher type not found');
      }

      const invoices:any = await this._db.voucherHeader.findMany({
        where: {
          PartyMasterSid: customerLedgerMasterSid,
          CompanyMasterSid: companyMasterSid,
          Status: 'A',
          VoucherTypeMasterSid: invoiceType.VoucherTypeMasterSid,
        },
        include: {
          VoucherTransaction: {
            where: { Status: 'A' },
            select: { Amount: true, DrCr: true },
          },
          masterJob: {
            select: {
              MasterJobSid: true,
              MasterJobNumber: true,
            },
          },
          houseJob: {
            select: {
              HouseJobSid: true,
              BookingNo: true,
            },
          },
        },
      });

      // Get payments
      const paymentType = await this._db.voucherTypeMaster.findFirst({
        where: {
          CompanyMasterSid: companyMasterSid,
          Type: { contains: 'Receipt', mode: 'insensitive' },
          status: 'A',
        },
        select: { VoucherTypeMasterSid: true },
      });

      let payments: any[] = [];
        if (paymentType) {
          payments = await this._db.voucherHeader.findMany({
            where: {
              PartyMasterSid: customerLedgerMasterSid,
              CompanyMasterSid: companyMasterSid,
              Status: 'A',
              VoucherTypeMasterSid: paymentType.VoucherTypeMasterSid,
            },
          include: {
            VoucherTransaction: {
              where: { Status: 'A' },
              select: {
                Amount: true,
                DrCr: true,
                HouseJobSid: true,
                MasterJobSid: true,
              },
            },
          },
        });
      }

      const groupedInvoices = new Map<any, any[]>();
      for (const invoice of invoices) {
        const key = invoice.MasterJobSid || invoice.HouseJobSid || 'no-job';
        if (!groupedInvoices.has(key)) {
          groupedInvoices.set(key, []);
        }
        const grouped = groupedInvoices.get(key);
        if (grouped) {
          grouped.push(invoice);
        }
      }

      const jobGroups: any[] = [];
      for (const [jobKey, jobInvoices] of groupedInvoices.entries()) {
        const sampleInvoice = jobInvoices[0];
        const jobPayments = payments.filter((payment) =>
          payment.VoucherTransaction.some((txn: any) => {
            if (sampleInvoice.MasterJobSid && txn.MasterJobSid === sampleInvoice.MasterJobSid) return true;
            if (sampleInvoice.HouseJobSid && txn.HouseJobSid === sampleInvoice.HouseJobSid) return true;
            return false;
          }),
        );

        let availablePayment = jobPayments.reduce((sum, payment) => {
          return sum + this.calculatePaymentAmount(payment.VoucherTransaction || []);
        }, 0);

        const sortedJobInvoices = [...jobInvoices].sort(
          (a, b) => new Date(a.VoucherDate).getTime() - new Date(b.VoucherDate).getTime(),
        );

        const invoiceBreakdown: any[] = [];
        let totalOutstanding = 0;
        for (const invoice of sortedJobInvoices) {
          const invoiceAmount = this.calculateInvoiceAmount(invoice.VoucherTransaction || []);
          if (invoiceAmount <= 0) {
            continue;
          }

          const paidAmount = Math.min(availablePayment, invoiceAmount);
          const outstanding = Math.max(invoiceAmount - paidAmount, 0);
          availablePayment = Math.max(availablePayment - paidAmount, 0);

          if (outstanding > 0) {
            totalOutstanding += outstanding;
            invoiceBreakdown.push({
              voucherNumber: invoice.VoucherNumber,
              voucherDate: invoice.VoucherDate,
              invoiceAmount,
              paidAmount,
              outstanding,
            });
          }
        }

        if (totalOutstanding > 0) {
          jobGroups.push({
            jobType: sampleInvoice.MasterJobSid
              ? 'Master'
              : sampleInvoice.HouseJobSid
              ? 'House'
              : 'None',
            jobSid: sampleInvoice.MasterJobSid || sampleInvoice.HouseJobSid,
            jobNumber:
              sampleInvoice.masterJob?.MasterJobNumber || sampleInvoice.houseJob?.BookingNo,
            totalOutstanding,
            invoiceCount: invoiceBreakdown.length,
            invoices: invoiceBreakdown,
          });
        }
      }

      return jobGroups;
    } catch (error) {
      this.logger.error(`Error getting outstanding by job: ${error.message}`);
      throw error;
    }
  }

  /**
   * Main validation method for BL/DO issuance
   */
  async validateCreditForDocument(
    dto: ValidateCreditDto,
  ): Promise<ValidationResult> {
    try {
      // Step 1: Check customer type
      const customerType = await this.getCustomerType(dto.customerMasterSid);

      if (customerType === CustomerType.CASH) {
        return this.getCashCustomerValidation(dto);
      }

      // Step 2: Get credit limit
      let creditLimit: CreditLimitResult | null = null;
      try {
        creditLimit = await this.getCreditLimit({
          companyMasterSid: dto.companyMasterSid,
          customerMasterSid: dto.customerMasterSid,
          branchMasterSid: dto.branchMasterSid,
          departmentMasterSid: dto.departmentMasterSid,
          customerBranchSid: dto.customerBranchSid,
        });
      } catch (error) {
        if (!(error instanceof NotFoundException)) {
          throw error;
        }
      }

      // Credit customer with no active approved credit request is treated as CASH.
      if (!creditLimit) {
        return {
          isValid: false,
          errors: ['Credit request is not approved. Payment required before BL/DO/MAWB/HAWB release.'],
          warnings: [],
          creditInfo: {
            creditLimit: 0,
            creditDays: 0,
            totalOutstanding: 0,
            oldestOutstandingDays: 0,
            availableCredit: 0,
            utilizationPercentage: 0,
          },
        };
      }

      // Step 3: Get outstanding
      // For credit control we check customer-level outstanding, not only current job.
      const customerLedgerMasterSid = await this.resolveCustomerLedgerMasterSid(
        dto.companyMasterSid,
        dto.customerMasterSid,
      );

      const customerOutstanding = await this.outstandingService.getCustomerOutstanding(
        dto.companyMasterSid,
        customerLedgerMasterSid,
        undefined,
        dto.branchMasterSid,
      );

      const outstanding = this.mapCustomerOutstandingToResult(customerOutstanding);

      // Step 4: Perform validation
      return this.performValidation(creditLimit, outstanding);
    } catch (error) {
      this.logger.error(`Credit validation error: ${error.message}`);
      
      if (error instanceof NotFoundException) {
        return {
          isValid: false,
          errors: [error.message],
          warnings: [],
          creditInfo: {
            creditLimit: 0,
            creditDays: 0,
            totalOutstanding: 0,
            oldestOutstandingDays: 0,
            availableCredit: 0,
            utilizationPercentage: 0,
          },
        };
      }

      throw error;
    }
  }

  /**
   * Get credit summary for dashboard
   */
  async getCreditSummary(dto: CreditSummaryDto) {
    try {
      const [creditLimit, outstanding] = await Promise.all([
        this.getCreditLimit({
          companyMasterSid: dto.companyMasterSid,
          customerMasterSid: dto.customerMasterSid,
          branchMasterSid: dto.branchMasterSid,
          departmentMasterSid: dto.departmentMasterSid,
        }),
        this.getOutstanding({
          customerMasterSid: dto.customerMasterSid,
          companyMasterSid: dto.companyMasterSid,
          branchMasterSid: dto.branchMasterSid,
        }),
      ]);

      const availableCredit = creditLimit.creditLimit - outstanding.totalOutstanding;
      const utilizationPercentage =
        (outstanding.totalOutstanding / creditLimit.creditLimit) * 100;

      return {
        creditLimit: creditLimit.creditLimit,
        creditDays: creditLimit.creditDays,
        totalOutstanding: outstanding.totalOutstanding,
        availableCredit,
        utilizationPercentage,
        oldestOutstandingDays: outstanding.oldestOutstandingDays,
        effectiveFrom: creditLimit.effectiveFrom,
        effectiveTo: creditLimit.effectiveTo,
        approvalStatus: creditLimit.approvalStatus,
        invoiceCount: outstanding.outstandingInvoices.length,
      };
    } catch (error) {
      this.logger.error(`Error getting credit summary: ${error.message}`);
      throw error;
    }
  }

  async validateBLDORelease(
    dto: ValidateBLDODto,
  ): Promise<BLDOValidationResult> {
    try {
      const customerType = await this.getCustomerType(dto.CustomerMasterSid);
      const currentDate = new Date();
      const errors: string[] = [];
      let creditLimit = 0;
      let creditDays = 0;
      let selectedCreditRequestSid: number | null = null;

      if (customerType === CustomerType.CREDIT) {
        const creditRequest = await this.getBLDOCreditRequest(dto);

        if (!creditRequest) {
          return {
            IsValid: false,
            Errors: ['No credit request found'],
            CustomerType: customerType,
            CreditLimit: 0,
            CreditDays: 0,
            RemainingCreditLimit: null,
            TotalOutstandingLocal: 0,
            SelectedCreditRequestSid: null,
            ViolatingVouchers: [],
          };
        }

        creditLimit = Number(creditRequest.CreditLimit || 0);
        creditDays = Number(creditRequest.CreditDays || 0);
        selectedCreditRequestSid = creditRequest.CustomerCreditRequestSid;
      }

      const outstandingReport = await this.getBLDOOutstandingReport(dto, currentDate);
      console.log(dto , outstandingReport);
      const totalOutstandingLocal = Number(outstandingReport.totalOutstandingLocal || 0);
      const remainingCreditLimit = creditLimit - totalOutstandingLocal;

      if (totalOutstandingLocal > creditLimit) {
        errors.push(
          `Outstanding amount (${totalOutstandingLocal.toFixed(2)}) exceeds credit limit (${creditLimit.toFixed(2)}). Remaining credit limit: ${remainingCreditLimit.toFixed(2)}`,
        );
      }

      const violatingVouchers =
        customerType === CustomerType.CREDIT
          ? (outstandingReport.transactions || [])
              .filter((transaction) => Number(transaction.outstandingLocalAmount || 0) > 0)
              .map((transaction) => {
                const voucherDate = new Date(transaction.voucherDate);
                const ageingDays = this.calculateDaysDifference(voucherDate, currentDate);

                return {
                  VoucherNumber: transaction.voucherNumber,
                  VoucherDate: voucherDate,
                  OutstandingLocalAmount: Number(transaction.outstandingLocalAmount || 0),
                  AgeingDays: ageingDays,
                };
              })
              .filter((transaction) => transaction.AgeingDays > creditDays)
          : [];

      violatingVouchers.forEach((voucher) => {
        errors.push(
          `Voucher ${voucher.VoucherNumber} is ${voucher.AgeingDays} days old, exceeding allowed credit days of ${creditDays}`,
        );
      });

      return {
        IsValid: errors.length === 0,
        Errors: errors,
        CustomerType: customerType,
        CreditLimit: creditLimit,
        CreditDays: creditDays,
        RemainingCreditLimit: remainingCreditLimit,
        TotalOutstandingLocal: totalOutstandingLocal,
        SelectedCreditRequestSid: selectedCreditRequestSid,
        ViolatingVouchers: violatingVouchers,
      };
    } catch (error) {
      this.logger.error(`BL/DO credit validation error: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get customer type (CASH or CREDIT)
   */
  async getCustomerType(customerMasterSid: number): Promise<CustomerType> {
    try {
      const customer = await this._db.customerMaster.findUnique({
        where: { CustomerMasterSid: customerMasterSid },
        select: { CashCredit: true },
      });

      if (!customer) {
        throw new NotFoundException('Customer not found');
      }

      return customer.CashCredit?.toUpperCase() === 'CREDIT'
        ? CustomerType.CREDIT
        : CustomerType.CASH;
    } catch (error) {
      this.logger.error(`Error getting customer type: ${error.message}`);
      throw error;
    }
  }

  /**
   * Check if invoice is paid for Master/House Job
   */
  async checkInvoicePaymentStatus(
    masterJobSid?: number,
    houseJobSid?: number,
  ): Promise<boolean> {
    try {
      if (!masterJobSid && !houseJobSid) {
        return false;
      }

      const invoice = await this._db.voucherHeader.findFirst({
        where: {
          Status: 'A',
          ...(masterJobSid ? { MasterJobSid: masterJobSid } : {}),
          ...(houseJobSid ? { HouseJobSid: houseJobSid } : {}),
          voucherTypeMaster: {
            status: 'A',
            OR: [
              { DocumentTypeCode: DOC_TYPE_CODE.INVOICE },
              { Type: { contains: 'Invoice', mode: 'insensitive' } },
            ],
          },
        },
        select: {
          PartyMasterSid: true,
          CompanyMasterSid: true,
          BranchMasterSid: true,
        },
      });

      if (!invoice) {
        return true;
      }
      if (invoice.PartyMasterSid == null) {
        return false;
      }

      const outstanding = await this.computeOutstanding({
        customerMasterSid: invoice.PartyMasterSid,
        companyMasterSid: invoice.CompanyMasterSid,
        branchMasterSid: invoice.BranchMasterSid ?? undefined,
        masterJobSid,
        houseJobSid,
        scopeByJob: true,
      });

      return outstanding.totalOutstanding <= 0;
    } catch (error) {
      this.logger.error(`Error checking payment status: ${error.message}`);
      return false;
    }
  }

  // ============================================
  // PRIVATE HELPER METHODS
  // ============================================

  private mapCreditLimitResponse(credit: any): CreditLimitResult {
    return {
      creditLimit: credit.CreditLimit,
      creditDays: credit.CreditDays,
      publishedLimit: credit.PublishedLimit,
      publishedDays: credit.PublishedDays,
      departmentMasterSid: credit.DepartmentMasterSid,
      branchMasterSid: credit.CustomerBranchSid,
      effectiveFrom: credit.EffectiveFrom,
      effectiveTo: credit.EffectiveTo,
      approvalStatus: credit.ApprovalStatus,
    };
  }

  private processInvoicesWithPayments(invoices: any[], payments: any[]): OutstandingInvoice[] {
    const sortedInvoices = [...invoices].sort(
      (a, b) => new Date(a.VoucherDate).getTime() - new Date(b.VoucherDate).getTime(),
    );
    let availablePayment = payments.reduce((sum, payment) => {
      return sum + this.calculatePaymentAmount(payment.VoucherTransaction || []);
    }, 0);

    const outstandingInvoices: OutstandingInvoice[] = [];
    for (const invoice of sortedInvoices) {
      const invoiceAmount = this.calculateInvoiceAmount(invoice.VoucherTransaction || []);
      if (invoiceAmount <= 0) {
        continue;
      }

      const paidAmount = Math.min(availablePayment, invoiceAmount);
      const outstandingAmount = Math.max(invoiceAmount - paidAmount, 0);
      availablePayment = Math.max(availablePayment - paidAmount, 0);

      if (outstandingAmount > 0) {
        outstandingInvoices.push({
          voucherHeaderSid: invoice.VoucherHeaderSid,
          voucherNo: invoice.VoucherNumber,
          voucherDate: invoice.VoucherDate,
          invoiceAmount,
          paidAmount,
          outstandingAmount,
          ageDays: this.calculateDaysDifference(invoice.VoucherDate, new Date()),
          masterJobSid: invoice.MasterJobSid,
          houseJobSid: invoice.HouseJobSid,
        });
      }
    }

    return outstandingInvoices;
  }

  private calculateInvoiceAmount(transactions: any[]): number {
    return transactions.reduce((sum, txn) => {
      // Debit transactions are invoice amounts (customer owes us)
      if (txn.DrCr === 'D') {
        return sum + Number(txn.Amount || 0);
      }
      // Credit transactions reduce invoice amount (credit notes)
      if (txn.DrCr === 'C') {
        return sum - Number(txn.Amount || 0);
      }
      return sum;
    }, 0);
  }

  private calculatePaymentAmount(transactions: any[]): number {
    return transactions.reduce((sum, txn) => {
      // Credit transactions are payment receipts (we received money)
      if (txn.DrCr === 'C') {
        return sum + Number(txn.Amount || 0);
      }
      // Debit transactions reduce payment (payment reversals)
      if (txn.DrCr === 'D') {
        return sum - Number(txn.Amount || 0);
      }
      return sum;
    }, 0);
  }

  private calculateOldestDays(invoices: OutstandingInvoice[]): number {
    if (invoices.length === 0) return 0;
    return Math.max(...invoices.map((inv) => inv.ageDays));
  }

  private calculateDaysDifference(startDate: Date, endDate: Date): number {
    const diffTime = Math.abs(endDate.getTime() - new Date(startDate).getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }

  private async getBLDOCreditRequest(dto: ValidateBLDODto) {
    const documentDate = new Date(dto.DocumentDate);
    const baseWhere: Prisma.CustomerCreditRequestWhereInput = {
      CompanyMasterSid: dto.CompanyMasterSid,
      CustomerMasterSid: dto.CustomerMasterSid,
      Status: 'A',
      ApprovalStatus: ApprovalStatus.Approved,
      EffectiveFrom: { lte: documentDate },
      EffectiveTo: { gte: documentDate },
    };

    const branchCreditRequest = await this._db.customerCreditRequest.findFirst({
      where: {
        ...baseWhere,
        CustomerBranchSid: dto.CustomerBranchSid,
      },
      orderBy: {
        CustomerCreditRequestSid: 'desc',
      },
    });

    if (branchCreditRequest) {
      return branchCreditRequest;
    }

    const commonCreditRequest = await this._db.customerCreditRequest.findFirst({
      where: {
        ...baseWhere,
        CustomerBranchSid: null,
      },
      orderBy: {
        CustomerCreditRequestSid: 'desc',
      },
    });

    if (commonCreditRequest) {
      return commonCreditRequest;
    }

    throw new BadRequestException(
      await this.buildBLDOCreditRequestMessage(dto, documentDate),
    );
  }

  private async buildBLDOCreditRequestMessage(
    dto: ValidateBLDODto,
    documentDate: Date,
  ): Promise<string> {
    const scopedRequests = await this._db.customerCreditRequest.findMany({
      where: {
        CompanyMasterSid: dto.CompanyMasterSid,
        CustomerMasterSid: dto.CustomerMasterSid,
        Status: 'A',
        OR: [
          { CustomerBranchSid: dto.CustomerBranchSid ?? null },
          { CustomerBranchSid: null },
        ],
      },
      select: {
        CustomerCreditRequestSid: true,
        ApprovalStatus: true,
        EffectiveFrom: true,
        EffectiveTo: true,
      },
      orderBy: {
        CustomerCreditRequestSid: 'desc',
      },
      take: 10,
    });

    if (!scopedRequests.length) {
      return 'No credit request is configured for this customer.';
    }

    const matchingDateRequest = scopedRequests.find(
      (item) =>
        new Date(item.EffectiveFrom) <= documentDate &&
        new Date(item.EffectiveTo) >= documentDate,
    );

    if (matchingDateRequest && matchingDateRequest.ApprovalStatus !== ApprovalStatus.Approved) {
      return `Credit request is ${matchingDateRequest.ApprovalStatus} for this customer. Approval is required before BL/DO validation can pass.`;
    }

    const approvedRequest = scopedRequests.find(
      (item) => item.ApprovalStatus === ApprovalStatus.Approved,
    );

    if (approvedRequest) {
      return 'No approved credit request is active for this customer on the selected document date.';
    }

    return 'Credit request exists for this customer, but it is not approved yet.';
  }

  private async getBLDOOutstandingReport(
    dto: ValidateBLDODto,
    currentDate: Date,
  ) {
    const customerDebtorMapping = await this.resolveCustomerDebtorMapping(
      dto.CompanyMasterSid,
      dto.CustomerMasterSid,
    );

    const reportPayload: OutstandingReportQueryDto = {
      ToDate: currentDate.toISOString(),
      Ledger: customerDebtorMapping.COAMasterSid,
      Subledger: customerDebtorMapping.SubledgerMasterSid,
      companyId: dto.CompanyMasterSid,
      Branch: [dto.BranchMasterSid],
    };

    return this.accountsReportsService.generateOutstandingReport(reportPayload);
  }

  private async resolveCustomerDebtorMapping(
    companyMasterSid: number,
    customerMasterSid: number,
  ): Promise<{ COAMasterSid: number; SubledgerMasterSid: number }> {
    const customerDebtorMapping = await this._db.subledgerMaster.findFirst({
      where: {
        CompanyMasterSid: companyMasterSid,
        Status: 'A',
        SubledgerType: 'Customer',
        SubledgerMappingSid: customerMasterSid,
        DrCOAMasterSid: { not: null },
      },
      select: {
        DrCOAMasterSid: true,
        SubledgerMasterSid: true,
      },
      orderBy: {
        SubledgerMasterSid: 'desc',
      },
    });

    if (!customerDebtorMapping?.DrCOAMasterSid) {
      throw new NotFoundException(
        `Customer debtor mapping not found for customer ${customerMasterSid}`,
      );
    }

    return {
      COAMasterSid: customerDebtorMapping.DrCOAMasterSid,
      SubledgerMasterSid: customerDebtorMapping.SubledgerMasterSid,
    };
  }

  private performValidation(
    creditLimit: CreditLimitResult,
    outstanding: OutstandingResult
  ): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    const availableCredit = creditLimit.creditLimit - outstanding.totalOutstanding;
    const utilizationPercentage =
      (outstanding.totalOutstanding / creditLimit.creditLimit) * 100;

    // Validation 1: Check outstanding vs limit
    if (outstanding.totalOutstanding > creditLimit.creditLimit) {
      errors.push(
        `Outstanding amount (Rs ${outstanding.totalOutstanding.toLocaleString('en-IN', {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })}) exceeds credit limit (Rs ${creditLimit.creditLimit.toLocaleString('en-IN', {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })})`,
      );
    }

    // Validation 2: Check outstanding days vs allowed credit days
    if (outstanding.oldestOutstandingDays > creditLimit.creditDays) {
      errors.push(
        `Oldest outstanding invoice is ${outstanding.oldestOutstandingDays} days old, ` +
        `exceeding allowed credit period of ${creditLimit.creditDays} days`,
      );
    }

    // Warning 1: Credit utilization > 80%
    if (utilizationPercentage > 80 && utilizationPercentage <= 100) {
      warnings.push(
        `Credit utilization is at ${utilizationPercentage.toFixed(1)}%. ` +
        `Available credit: Rs ${availableCredit.toLocaleString('en-IN', {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })}`,
      );
    }

    // Warning 2: Days utilization > 80%
    const daysUtilization = (outstanding.oldestOutstandingDays / creditLimit.creditDays) * 100;
    if (daysUtilization > 80 && daysUtilization <= 100) {
      warnings.push(
        `Oldest invoice is ${outstanding.oldestOutstandingDays} days old ` +
        `(${daysUtilization.toFixed(1)}% of allowed ${creditLimit.creditDays} days)`,
      );
    }

    // Warning 3: Credit expiring soon (within 7 days)
    const daysUntilExpiry = Math.ceil(
      (creditLimit.effectiveTo.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24),
    );
    if (daysUntilExpiry > 0 && daysUntilExpiry <= 7) {
      warnings.push(
        `Credit limit expires in ${daysUntilExpiry} day(s) on ${creditLimit.effectiveTo.toLocaleDateString('en-IN')}`,
      );
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      creditInfo: {
        creditLimit: creditLimit.creditLimit,
        creditDays: creditLimit.creditDays,
        totalOutstanding: outstanding.totalOutstanding,
        oldestOutstandingDays: outstanding.oldestOutstandingDays,
        availableCredit,
        utilizationPercentage,
      },
    };
  }

  private createSuccessResult(): ValidationResult {
    return {
      isValid: true,
      errors: [],
      warnings: [],
      creditInfo: {
        creditLimit: 0,
        creditDays: 0,
        totalOutstanding: 0,
        oldestOutstandingDays: 0,
        availableCredit: 0,
        utilizationPercentage: 0,
      },
    };
  }

  private async getCashCustomerValidation(dto: ValidateCreditDto): Promise<ValidationResult> {
    const jobOutstanding = await this.computeOutstanding({
      customerMasterSid: dto.customerMasterSid,
      companyMasterSid: dto.companyMasterSid,
      branchMasterSid: dto.branchMasterSid,
      masterJobSid: dto.masterJobSid,
      houseJobSid: dto.houseJobSid,
      scopeByJob: true,
    });

    if (jobOutstanding.outstandingInvoices.length === 0) {
      return this.createSuccessResult();
    }

    if (jobOutstanding.totalOutstanding > 0) {
      return {
        isValid: false,
        errors: [
          `Outstanding amount (Rs ${jobOutstanding.totalOutstanding.toLocaleString('en-IN', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}) pending for this job invoice. Payment required before issuing BL/DO/MAWB/HAWB.`,
        ],
        warnings: [],
        creditInfo: {
          creditLimit: 0,
          creditDays: 0,
          totalOutstanding: jobOutstanding.totalOutstanding,
          oldestOutstandingDays: jobOutstanding.oldestOutstandingDays,
          availableCredit: -jobOutstanding.totalOutstanding,
          utilizationPercentage: 0,
        },
      };
    }

    return this.createSuccessResult();
  }

  private async computeOutstanding(
    options: OutstandingComputationOptions,
  ): Promise<OutstandingResult> {
    const customerLedgerMasterSid = await this.resolveCustomerLedgerMasterSid(
      options.companyMasterSid,
      options.customerMasterSid,
    );

    if (!options.scopeByJob) {
      const outstanding = await this.outstandingService.getCustomerOutstanding(
        options.companyMasterSid,
        customerLedgerMasterSid,
        undefined,
        options.branchMasterSid,
      );

      return this.mapCustomerOutstandingToResult(outstanding);
    }

    const voucherTransactions = await this._db.voucherTransaction.findMany({
      where: {
        CompanyMasterSid: options.companyMasterSid,
        ...(options.branchMasterSid ? { BranchMasterSid: options.branchMasterSid } : {}),
        LedgerMasterSid: customerLedgerMasterSid,
        Status: 'A',
        DrCr: 'D',
        ...(options.masterJobSid ? { MasterJobSid: options.masterJobSid } : {}),
        ...(options.houseJobSid ? { HouseJobSid: options.houseJobSid } : {}),
        VoucherHeader: { PostStatus: 'P', Status: 'A' },
        subledgerMaster: {
          SubledgerType: 'Customer',
        },
        voucherTypeMaster: {
          DocumentTypeCode: DOC_TYPE_CODE.INVOICE,
        },
      },
      include: {
        VoucherHeader: true,
        voucherMatchings: {
          where: {
            Status: 'A',
          },
        },
      },
      orderBy: {
        VoucherDate: 'asc',
      },
    });

    const outstandingInvoices: OutstandingInvoice[] = voucherTransactions
      .map((vt) => {
        const invoiceAmount = Number(vt.LocalAmount || 0);
        const paidAmount = vt.voucherMatchings.reduce(
          (sum, match) => sum + Number(match.LocalAmount || 0),
          0,
        );
        const outstandingAmount = Math.max(invoiceAmount - paidAmount, 0);

        return {
          voucherHeaderSid: vt.VoucherHeaderSid,
          voucherNo: vt.VoucherNumber,
          voucherDate: vt.VoucherDate,
          invoiceAmount,
          paidAmount,
          outstandingAmount,
          ageDays: this.calculateDaysDifference(vt.VoucherDate, new Date()),
          masterJobSid: vt.MasterJobSid ?? undefined,
          houseJobSid: vt.HouseJobSid ?? undefined,
        };
      })
      .filter((invoice) => invoice.outstandingAmount > 0);

    const totalOutstanding = outstandingInvoices.reduce(
      (sum, invoice) => sum + invoice.outstandingAmount,
      0,
    );

    return {
      totalOutstanding,
      oldestOutstandingDays: this.calculateOldestDays(outstandingInvoices),
      outstandingInvoices,
    };
  }

  private async resolveCustomerLedgerMasterSid(
    companyMasterSid: number,
    customerMasterSid: number,
  ): Promise<number> {
    const customerSubledger = await this._db.subledgerMaster.findFirst({
      where: {
        CompanyMasterSid: companyMasterSid,
        Status: 'A',
        SubledgerType: 'Customer',
        SubledgerMappingSid: customerMasterSid,
      },
      select: {
        SubledgerMasterSid: true,
      },
      orderBy: {
        SubledgerMasterSid: 'desc',
      },
    });

    if (!customerSubledger) {
      throw new NotFoundException(
        `Customer subledger not found for customer ${customerMasterSid}`,
      );
    }

    return customerSubledger.SubledgerMasterSid;
  }

  private mapCustomerOutstandingToResult(
    outstanding: CustomerOutstandingResponseDto,
  ): OutstandingResult {
    const outstandingInvoices = outstanding.transactions
      .filter(
        (transaction) =>
          transaction.voucherTypeCode === DOC_TYPE_CODE.INVOICE &&
          transaction.drCr === 'D' &&
          transaction.outstandingLocalAmount > 0,
      )
      .map((transaction) => ({
        voucherHeaderSid: transaction.voucherHeaderSid,
        voucherNo: transaction.voucherNumber,
        voucherDate: transaction.voucherDate,
        invoiceAmount: transaction.originalLocalAmount,
        paidAmount: transaction.matchedLocalAmount,
        outstandingAmount: transaction.outstandingLocalAmount,
        ageDays: this.calculateDaysDifference(transaction.voucherDate, new Date()),
      }));

    return {
      totalOutstanding: outstanding.totalOutstandingLocal,
      oldestOutstandingDays: this.calculateOldestDays(outstandingInvoices),
      outstandingInvoices,
    };
  }

}


