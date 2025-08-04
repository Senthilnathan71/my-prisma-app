import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { DatabaseService } from 'src/database/database.service';
import { SearchListDto } from 'src/masters/DTO/search-list.dto';
import { SearchVesselDto } from 'src/masters/DTO/search-vessel.dto';

@Injectable()
export class CustomerService {
    constructor(private _db: DatabaseService, private logger: Logger) { }


    async createCustomer(payload: any, user) {
        this.logger.warn(`createDepartment: ${payload}`);


        const existing = await this._db.customerMaster.findFirst({
            where: {
                OR: [
                    {
                        CustomerName: {
                            equals: payload.CustomerName.trim(),
                            mode: 'insensitive',
                        }
                    },
                    {
                        CustomerShortCode: {
                            equals: payload.CustomerShortCode.trim(),
                            mode: 'insensitive',
                        }
                    }
                ]
            },
        });

        if (existing) {
            if (existing.CustomerName === payload.CustomerName) {
                throw new BadRequestException('Customer name already exists');
            }
            if (existing.CustomerShortCode === payload.CustomerShortCode) {
                throw new BadRequestException('Customer code already exists');
            }
        }

        try {
            const customer = await this._db.customerMaster.create({
                data: {
                    ...payload,
                }
            });

            return customer;
        } catch (error) {
            throw new Error(`Error creating customer: ${error.message}`);
        }
    }


    async getAllCustomers() {
        try {
            const customerList = await this._db.customerMaster.findMany({
                where: {
                    deletedAt: null,
                    status: 'A'
                }
            })
            return customerList;
        } catch (error) {
            throw error
        }
    }



    async findOne(customerMasterSid: any) {
        try {
            return await this._db.customerMaster.findUnique({
                where: {
                    CustomerMasterSid: customerMasterSid
                },
            });
        } catch (error) {
            throw error;
        }
    }


    async updateCustomer(CustomerMasterSid: number, payload: any, user) {

        const existing = await this._db.customerMaster.findUnique({
            where: {
                CustomerMasterSid: CustomerMasterSid
            }
        });

        if (!existing) {
            throw new Error('Customer is not exists');
        }

        try {
            const Customer = await this._db.customerMaster.update({
                where: {
                    CustomerMasterSid: CustomerMasterSid
                }, data: payload
            });
            return Customer;
        } catch (error) {
            throw new Error(`Error updating Customer: ${error.message}`);
        }
    }




    async softDelete(CustomerMasterSid: number) {
        try {
            const existingCustomer = await this._db.customerMaster.findUnique({
                where: { CustomerMasterSid: CustomerMasterSid }
            });

            if (!existingCustomer) {
                throw new NotFoundException(`Customer with ID ${CustomerMasterSid} not found`);
            }

            if (existingCustomer.deletedAt) {
                throw new Error(`Customer with ID ${CustomerMasterSid} is already deleted`);
            }

            const result = await this._db.$transaction(async (prisma) => {
                const deletedCustomer = await prisma.customerMaster.update({
                    where: {
                        CustomerMasterSid: CustomerMasterSid,
                        deletedAt: null
                    },
                    data: {
                        deletedAt: new Date()
                    }
                })
                const allCustomerBranches = await prisma.customerBranch.findMany({
                    where: {
                        CustomerMasterSid: CustomerMasterSid,
                        deletedAt: null
                    }
                })

                const allCusBranchesWithChild = await Promise.all(
                    allCustomerBranches.map(async branch => {
                        const deletedCusBranch = await prisma.customerBranch.update({
                            where: {
                                CustomerBranchSid: branch.CustomerBranchSid,
                                deletedAt: null
                            },
                            data: {
                                deletedAt: new Date()
                            }
                        })
                        const deleteCusBranchContact = await prisma.cusBranchContact.updateManyAndReturn({
                            where: {
                                CustomerBranchSid: deletedCusBranch.CustomerBranchSid,
                                deletedAt: null
                            },
                            data: {
                                deletedAt: new Date()
                            }
                        })
                        const deleteCusBranchEmail = await prisma.customerBrEmail.updateManyAndReturn({
                            where: {
                                CustomerBranchSid: branch.CustomerBranchSid,
                                deletedAt: null
                            },
                            data: {
                                deletedAt: new Date()
                            }
                        })
                        const deleteCusBranchLogin = await prisma.customerLogin.updateManyAndReturn({
                            where: {
                                CustomerBranchSid: branch.CustomerBranchSid,
                                deletedAt: null
                            },
                            data: {
                                deletedAt: new Date()
                            }
                        })
                        return {
                            ...deletedCusBranch,
                            CustomerBranchContact: deleteCusBranchContact,
                            CustomerBranchEmail: deleteCusBranchEmail,
                            CustomerBranchLogin: deleteCusBranchLogin
                        }
                    }))

                return {
                    deletedCustomer,
                    deletedCustomerBranch: allCusBranchesWithChild
                }
            })
            return result
        } catch (error) {
            throw error;
        }
    }


    async searchList(params: SearchVesselDto) {
    const { search = '', page = 1, pageSize = 15 } = params;
    const skip = (page - 1) * pageSize;

    const where: Prisma.CustomerMasterWhereInput = {
        deletedAt: null,
        status: 'A',
        ...(search
            ? {
                OR: [
                    { CustomerName: { contains: search, mode: 'insensitive' } },
                    { CustomerShortCode: { contains: search, mode: 'insensitive' } },
                    { CustomerAliasName: { contains: search, mode: 'insensitive' } },
                    { Website: { contains: search, mode: 'insensitive' } },
                    { LocalLanguage: { contains: search, mode: 'insensitive' } },
                    { status: { contains: search, mode: 'insensitive' } },
                ],
            }
            : {}
        ),
    };

    const [items, totalCount] = await this._db.$transaction([
        this._db.customerMaster.findMany({
            where,
            skip,
            take: pageSize,
            orderBy: { CustomerMasterSid: 'asc' },
        }),
        this._db.customerMaster.count({ where }),
    ]);

    return {
        items,
        totalCount,
    };
}

    async getAllCarriers(){
        try {
            const allCarriers = await this._db.customerMaster.findMany({
                where: {
                    CustomerType: {
                        path: ['carrier'],
                        equals: 'isTrue'
                    },
                    deletedAt : null
                }
            })
            return allCarriers;
        } catch (error) {
            throw error;
        }
    }

    async getAllAgents(){
        try {
            const allAgents = await this._db.customerMaster.findMany({
                where : {
                    CustomerType: {
                        path: ['agent'],
                        equals: 'isTrue'
                    },
                    deletedAt : null
                }
            })
            return allAgents;
        } catch (error) {
            throw error;
        }
    }
    async getAllShippers(){
        try {
            const allAgents = await this._db.customerMaster.findMany({
                where : {
                    CustomerType: {
                        path: ['shipper'],
                        equals: 'isTrue'
                    },
                    deletedAt : null
                }
            })
            return allAgents;
        } catch (error) {
            throw error;
        }
    }
    async getAllConsignee(){
        try {
            const allAgents = await this._db.customerMaster.findMany({
                where : {
                    CustomerType: {
                        path: ['consignee'],
                        equals: 'isTrue'
                    },
                    deletedAt : null
                }
            })
            return allAgents;
        } catch (error) {
            throw error;
        }
    }
    async getAllTransporters(){
        try {
            const allAgents = await this._db.customerMaster.findMany({
                where : {
                    CustomerType: {
                        path: ['transporter'],
                        equals: 'isTrue'
                    },
                    deletedAt : null
                }
            })
            return allAgents;
        } catch (error) {
            throw error;
        }
    }

    async getAllSuppliers() {
        try {
            const suppliers = ['vendor', 'transporter', 'agent'];
            const allSuppliers = await this._db.customerMaster.findMany({
                where: {
                    OR: suppliers.map(type => ({
                        CustomerType: {
                            path: [type],
                            equals: 'isTrue',
                        },
                    })),
                    deletedAt: null,
                },
                include : {
                    countryMaster :{
                        select : {
                            countryName : true
                        }
                    }
                }
            });

            return allSuppliers;
        } catch (error) {
            throw error;
        }
    }

}
