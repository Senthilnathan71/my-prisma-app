import { BadRequestException, Injectable, InternalServerErrorException, Logger, NotFoundException } from '@nestjs/common';
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



    
async createCreditRequest(payload: any, user) {
  try {
    const { customerCreditRequest, ...customerData } = payload;

    if (!customerCreditRequest || customerCreditRequest.length === 0) {
      throw new BadRequestException('No credit request data provided');
    }

    const createdRecords = await this._db.$transaction(
      customerCreditRequest.map((credit) =>
        this._db.customerCreditRequest.create({
          data: {
            ...credit,
            EffectiveFrom: credit.EffectiveFrom ? new Date(credit.EffectiveFrom) : null,
            EffectiveTo: credit.EffectiveTo ? new Date(credit.EffectiveTo) : null,
            CompanyMasterSid: customerData.CompanyMasterSid,
            CustomerMasterSid: customerData.CustomerMasterSid,
            CreatedBy: customerData.CreatedBy || user?.email || 'system',
          },
        })
      )
    );

    return {
      status: true,
      message: 'Credit request(s) created successfully',
      data: createdRecords,
    };
  } catch (error) {
    this.logger.error('Error creating credit request:', error);
    throw new InternalServerErrorException(
      `Error creating credit request: ${error.message}`,
    );
  }
}

   async updateCreditRequest(CustomerCreditRequestSid: number, payload: any, user) {
  try {
    if (!CustomerCreditRequestSid) {
      throw new BadRequestException('CustomerCreditRequestSid is required');
    }

    // Check if the record exists
    const existingRecord = await this._db.customerCreditRequest.findUnique({
      where: { CustomerCreditRequestSid },
    });

    if (!existingRecord) {
      throw new NotFoundException(`Credit request with ID ${CustomerCreditRequestSid} not found`);
    }

    // Destructure and exclude relational IDs
    const {
      CustomerCreditRequestSid: _,
      CompanyMasterSid,
      CustomerMasterSid,
      CustomerBranchSid,
      DepartmentMasterSid,
      SalesmanSid,
      ...updateData
    } = payload;

    const updatedRecord = await this._db.customerCreditRequest.update({
      where: { CustomerCreditRequestSid },
      data: {
        ...updateData,

        // ✅ Convert date strings to Date objects
        EffectiveFrom: payload.EffectiveFrom
          ? new Date(payload.EffectiveFrom)
          : existingRecord.EffectiveFrom,
        EffectiveTo: payload.EffectiveTo
          ? new Date(payload.EffectiveTo)
          : existingRecord.EffectiveTo,

        // ✅ Prisma-managed updated fields
        UpdatedBy: user?.email || 'system', // correct field name
        // UpdatedOn is automatically handled by Prisma @updatedAt

        // ✅ Relation connects
        ...(CompanyMasterSid && {
          company: { connect: { CompanyMasterSid } },
        }),
        ...(CustomerMasterSid && {
          customerMaster: { connect: { CustomerMasterSid } },
        }),
        ...(CustomerBranchSid && {
          customerBranch: { connect: { CustomerBranchSid } },
        }),
        ...(DepartmentMasterSid && {
          department: { connect: { DepartmentMasterSid } },
        }),
        ...(SalesmanSid && {
          salesman: { connect: { UserMasterSid: SalesmanSid } },
        }),
      },
    });

    return {
      status: true,
      message: 'Credit request updated successfully',
      data: updatedRecord,
    };
  } catch (error) {
    this.logger.error('Error updating credit request:', error);
    throw new InternalServerErrorException(
      `Error updating credit request: ${error.message}`,
    );
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

    async getCustomerById(CustomerMasterSid: number) {
  try {
    const customer = await this._db.customerMaster.findUnique({
      where: { CustomerMasterSid },
      include: {
        countryMaster: {
          select: { countryName: true },
        },
        CustomerBranch: true,
        customerCreditRequest: {
          include: {
            company: { select: { companyName: true } },
            department: { select: { departmentName: true } },
            salesman: { select: { userName: true } },
          },
        },
        customerKyc: true,
      },
    });

    if (!customer) {
      throw new BadRequestException(`Customer with id ${CustomerMasterSid} not found`);
    }

    // Patch additional fields
    return {
      ...customer,
      CustomerName: customer.CustomerName,
      Country: customer.countryMaster?.countryName || null,
      Status: customer.status,
    };
  } catch (err) {
    this.logger.warn(`Credit Request Service: findOne failed`);
    throw new InternalServerErrorException('Credit Request Service error: Something went wrong.');
  }
}

}
