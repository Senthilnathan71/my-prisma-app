import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma, UserTypeCode } from '@prisma/client';
import { statusWhereClause } from 'src/common/helper';
import { DatabaseService } from 'src/database/database.service';
import { SearchListDto } from 'src/masters/DTO/search-list.dto';
import { filterDto } from 'src/masters/DTO/search-vessel.dto';

@Injectable()
export class CustomerService {
    constructor(private _db: DatabaseService, private logger: Logger) { }


    async createCustomer(payload: any) {
        this.logger.log(`createCustomer: ${JSON.stringify(payload)}`);

        // Step 1: Check duplicate for CustomerMaster
        const existing = await this._db.customerMaster.findFirst({
            where: {
                OR: [
                    { CustomerName: { equals: payload.customer.CustomerName.trim(), mode: 'insensitive' } },
                    { CustomerShortCode: { equals: payload.customer.CustomerShortCode?.trim(), mode: 'insensitive' } }
                ]
            }
        });

        if (existing) {
            if (existing.CustomerName.toLowerCase() === payload.customer.CustomerName.trim().toLowerCase()) {
                throw new BadRequestException('Customer name already exists');
            }
            if (
                payload.customer.CustomerShortCode &&
                existing.CustomerShortCode?.toLowerCase() === payload.customer.CustomerShortCode.trim().toLowerCase()
            ) {
                throw new BadRequestException('Customer code already exists');
            }
        }

        return this._db.$transaction(async (tx) => {
            // Step 2: Create Customer
            const customer = await tx.customerMaster.create({
                data: {
                    CompanyMasterSid: payload.customer.CompanyMasterSid,
                    CustomerName: payload.customer.CustomerName,
                    CustomerShortCode: payload.customer.CustomerShortCode,
                    CustomerAliasName: payload.customer.CustomerAliasName,
                    CustomerAddress1: payload.customer.CustomerAddress1,
                    CustomerAddress2: payload.customer.CustomerAddress2,
                    CountryMasterSid: payload.customer.CountryMasterSid,
                    CustomerType: payload.customer.CustomerType,
                    PanName: payload.customer.PanName,
                    PanType: payload.customer.PanType,
                    GroupName: payload.customer.GroupName,
                    Website: payload.customer.Website,
                    CashCredit: payload.customer.CashCredit,
                    Network: payload.customer.Network,
                    Remarks: payload.customer.Remarks,
                    IsMSME: payload.customer.IsMSME,
                    RegistrationNo: payload.customer.RegistrationNo,
                    CompanyType: payload.customer.CompanyType,
                    createdBy: payload.customer.createdBy,
                    AirlineNumber: payload.customer.AirlineNumber,
                    AirlineCode: payload.customer.AirlineCode
                }
            });
            this.logger.log(`customerCreated: ${JSON.stringify(customer)}`);


            // Step 3: Multiple Branches
            if (customer && payload.customerBranches) {
                for (const branch of payload.customerBranches) {

                    const createdBranch = await tx.customerBranch.create({
                        data: {
                            BranchName: branch.BranchName,
                            StateMasterSid: branch.StateMasterSid,
                            CityMasterSid: branch.CityMasterSid,
                            CustomerMasterSid: customer.CustomerMasterSid,
                            CompanyMasterSid: customer.CompanyMasterSid,
                            Branch_Type: branch.Branch_Type,
                            Contact_Person: branch.Contact_Person,
                            Zip_PostBox: branch.Zip_PostBox,
                            ContactNo: branch.ContactNo,
                            Email: branch.Email,
                            Address: branch.Address,
                            Registered: branch.Registered,
                            CustomerGstType: branch.CustomerGstType,
                            GSTNo: branch.GSTNo,
                            status: branch.status,
                            createdBy: branch.createdBy,
                        }
                    });

                    this.logger.log(`branch created: ${JSON.stringify(createdBranch)}`);


                    const branchId = createdBranch.CustomerBranchSid;

                    // Step 4: CusBranchContact
                    if (branch.customerBranchContacts.length > 0) {
                        for (const contact of branch.customerBranchContacts) {

                            const branchContact = await tx.cusBranchContact.create({
                                data: {
                                    ...contact,
                                    CustomerMasterSid: customer.CustomerMasterSid,
                                    CustomerBranchSid: branchId
                                }
                            });

                            this.logger.log(`branch Contact Created: ${JSON.stringify(branchContact)}`);


                        }
                    }

                }
            }

            return customer;
        });
    }

    async findOne(customerMasterSid: any) {
        try {
            const customerData: any = await this._db.customerMaster.findUnique({
                where: {
                    CustomerMasterSid: customerMasterSid,
                    status: 'A',
                },
                select: {
                    CustomerMasterSid: true,
                    countryMaster: {
                        select: {
                            countryName: true,
                            countryCode: true,
                            CountryMasterSid: true
                        }
                    },
                    CustomerName: true,
                    CustomerShortCode: true,
                    CustomerType: true,
                    CustomerAliasName: true,
                    GroupName: true,
                    CustomerAddress1: true,
                    CustomerAddress2: true,
                    Website: true,
                    CashCredit: true,
                    Network: true,
                    Remarks: true,
                    IsMSME: true,
                    RegistrationNo: true,
                    CompanyType: true,
                    PanName: true,
                    PanType: true,
                    status: true,
                    CustomerBranch: {
                        select: {
                            CustomerBranchSid: true,
                            customerMaster: {
                                select: {
                                    CustomerMasterSid: true,
                                    CustomerName: true
                                }
                            },
                            stateMaster: {
                                select: {
                                    stateName: true,
                                    stateCode: true,
                                    StateMasterSid: true
                                }
                            },
                            cityMaster: {
                                select: {
                                    cityName: true,
                                    cityCode: true,
                                    CityMasterSid: true,
                                }
                            },
                            BranchName: true,
                            Branch_Type: true,
                            Branch_Code: true,
                            Contact_Person: true,
                            ContactNo: true,
                            Email: true,
                            Address: true,
                            Zip_PostBox: true,
                            CustomerGstType: true,
                            VendorGstType: true,
                            GSTNo: true,
                            status: true,
                            cusBranchContact: {
                                select: {
                                    customerBranch: {
                                        select: {
                                            BranchName: true,
                                            CustomerBranchSid: true
                                        }
                                    },
                                    customerMaster: {
                                        select: {
                                            CustomerMasterSid: true,
                                            CustomerName: true
                                        }
                                    },
                                    CusBranchContactSid: true,
                                    ContactType: true,
                                    ContactNo: true,
                                    ContactName: true,
                                    Email: true,
                                    status: true
                                }
                            }
                        }
                    },
                    CustomerBrEmail: {
                        select: {
                            customerBranch: {
                                select: {
                                    BranchName: true,
                                    CustomerBranchSid: true
                                }
                            },
                            CustomerMaster: {
                                select: {
                                    CustomerMasterSid: true,
                                    CustomerName: true
                                }
                            },
                            CCemail: true,
                            Toemail: true,
                            status: true,
                            CustomerBrEmailSid: true,
                            DepartmentMasterSid: true
                        }
                    },
                    CustomerLogin: {
                        select: {
                            customerBranch: {
                                select: {
                                    BranchName: true,
                                    CustomerBranchSid: true
                                }
                            },
                            customerMaster: {
                                select: {
                                    CustomerMasterSid: true,
                                    CustomerName: true
                                }
                            },
                            CustomerLoginSid: true,
                            LoginEmail: true,
                            LoginName: true,
                            LoginPassword: true,
                            status: true
                        }
                    },
                    CustomerSalesTeam: {
                        select: {
                            customerBranch: {
                                select: {
                                    CustomerBranchSid: true,
                                    BranchName: true,
                                    Branch_Code: true
                                }
                            },
                            customerMaster: {
                                select: {
                                    CustomerMasterSid: true,
                                    CustomerName: true
                                }
                            },
                            salesManUser: {
                                where: { isSalesperson: '1' },
                                select: {
                                    UserMasterSid: true,
                                    userName: true,
                                    userCode: true
                                }
                            },
                            DocPersonUser: {
                                where: { userType: { code: UserTypeCode.docPerson } },
                                select: {
                                    UserMasterSid: true,
                                    userName: true,
                                    userType: {
                                        select: {
                                            UserTypeSid: true,

                                        }
                                    }
                                }
                            },
                            CSPersonUser: {
                                where: { userType: { code: UserTypeCode.csPerson } },
                                select: {
                                    UserMasterSid: true,
                                    userName: true,
                                    userType: {
                                        select: {
                                            UserTypeSid: true
                                        }
                                    }
                                }
                            },
                            CustomerSalesSid: true,
                            EffectiveFrom: true,
                            DepartmentMasterSid: true,
                            status: true
                        }
                    },
                    CustomerMilestone: {
                        select: {
                            CustomerMilestoneSid: true,
                            customerBranch: {
                                select: {
                                    BranchName: true,
                                    CustomerBranchSid: true
                                }
                            },
                            customerMaster: {
                                select: {
                                    CustomerMasterSid: true,
                                    CustomerName: true
                                }
                            },
                            MilestoneMasterSid: true,
                            ContactInfo: true,
                            EffectiveFrom: true,
                            Status: true,
                            UpdateType: true
                        }
                    }
                }
            });
            // fetch department reference data
            const departments = await this._db.departmentMaster.findMany({
                where: { Status: 'A' },
                select: { DepartmentMasterSid: true, departmentName: true, departmentCode: true, departmentType: true }
            });

            const enrichDepartments = (ids: string[] | number[]) => {
                if (!ids || !Array.isArray(ids)) return [];
                return ids.map(id => departments.find(d => d.DepartmentMasterSid === Number(id)))
                    .filter(Boolean);
            };

            // Attach departments
            customerData.CustomerBrEmail = customerData?.CustomerBrEmail.map(email => ({
                ...email,
                Departments: enrichDepartments(email.DepartmentMasterSid)
            }));

            customerData.CustomerSalesTeam = customerData?.CustomerSalesTeam.map(sales => ({
                ...sales,
                Departments: enrichDepartments(sales.DepartmentMasterSid)
            }));


            return customerData
        } catch (error) {
            console.log(error.stack)
            throw error;
        }
    }



    async getAllCustomers(CompanyMasterSid: number) {
        try {
            const customerList = await this._db.customerMaster.findMany({
                where: {
                    status: 'A',
                    CompanyMasterSid: CompanyMasterSid,
                    CustomerType: {
                        path: ['customer'],
                        equals: 'isTrue'
                    }
                }
            })
            return customerList;
        } catch (error) {
            throw error
        }
    }
    async getAllExistingCustomers(CompanyMasterSid: number, PreCustomerMasterSid: number) {
        try {
            const customerList = await this._db.customerMaster.findMany({
                where: {
                    status: 'A',
                    CompanyMasterSid: CompanyMasterSid,
                    PreCustomerMasterSid: PreCustomerMasterSid
                }
            })
            return customerList;
        } catch (error) {
            throw error
        }
    }

    async checkUniqueCustomerFields(params: {
        CompanyMasterSid: number;
        customerName?: string;
        customerShortCode?: string;
        excludeCustomerMasterSid?: number;
    }) {
        const { CompanyMasterSid, customerName, customerShortCode, excludeCustomerMasterSid } = params;

        // Build OR conditions
        const orClauses: Prisma.CustomerMasterWhereInput[] = [];

        if (customerName?.trim()) {
            orClauses.push({
                CustomerName: {
                    equals: customerName.trim(),
                    mode: Prisma.QueryMode.insensitive,
                },
            });
        }

        if (customerShortCode?.trim()) {
            orClauses.push({
                CustomerShortCode: {
                    equals: customerShortCode.trim(),
                    mode: Prisma.QueryMode.insensitive,
                },
            });
        }

        if (orClauses.length === 0) {
            return { nameTaken: false, codeTaken: false, message: 'No fields provided' };
        }

        const where: Prisma.CustomerMasterWhereInput = {
            CompanyMasterSid,
            status: 'A',
            OR: orClauses,
            ...(excludeCustomerMasterSid ? { CustomerMasterSid: { not: excludeCustomerMasterSid } } : {}),
        };

        const rows = await this._db.customerMaster.findMany({
            where,
            select: { CustomerName: true, CustomerShortCode: true },
        });

        const nameTaken =
            !!customerName &&
            rows.some(
                (r) => (r.CustomerName ?? '').trim().toLowerCase() === customerName.trim().toLowerCase(),
            );

        const codeTaken =
            !!customerShortCode &&
            rows.some(
                (r) => (r.CustomerShortCode ?? '').trim().toLowerCase() === customerShortCode.trim().toLowerCase(),
            );

        // 🧠 Build friendly message
        let message = 'Checked successfully';
        if (nameTaken && codeTaken) {
            message = 'Customer name and short code already exist';
        } else if (nameTaken) {
            message = 'Customer name already exists';
        } else if (codeTaken) {
            message = 'Customer short code already exists';
        }

        return { nameTaken, codeTaken, message };
    }


    // For Dropdowns
    async getAllCustomersWithCustomerBranch(CompanyMasterSid: number) {
        try {
            const customerList = await this._db.customerMaster.findMany({
                where: {
                    CompanyMasterSid: CompanyMasterSid,
                    status: "A",
                    CustomerBranch: { some: {} }
                },
                select: {
                    CustomerMasterSid: true,
                    CustomerName: true,
                    CustomerBranch: {
                        where: {
                            status: 'A'
                        },
                        select: {
                            CustomerBranchSid: true,
                            BranchName: true,
                            Address: true,
                            Email: true,
                        }
                    }
                }
            });
            const formattedCustomerList = customerList.flatMap(customer => {
                const cusBranches = customer.CustomerBranch.map(branch => ({
                    CustomerMasterSid: customer.CustomerMasterSid,
                    CustomerBranchSid: branch.CustomerBranchSid,
                    CustomerName: customer.CustomerName,
                    BranchName: branch.BranchName,
                    Address: branch.Address,
                    Email: branch.Email
                }))
                return cusBranches;
            })
            return formattedCustomerList;
        } catch (error) {
            throw error;
        }
    }

    async getAllVendorSuppliersWithBranch(CompanyMasterSid: number) {
        try {
            const suppliers = ['vendor', 'agent'];
            const customerList = await this._db.customerMaster.findMany({
                where: {
                    OR: suppliers.map(type => ({
                        CustomerType: {
                            path: [type],
                            equals: 'isTrue',
                        },
                    })),
                    status: 'A',
                    CompanyMasterSid: CompanyMasterSid
                },
                include: {
                    CustomerBranch: true
                }
            });
            const formattedCustomerList = customerList.flatMap(customer => {
                const cusBranches = customer.CustomerBranch.map(branch => ({
                    CustomerMasterSid: customer.CustomerMasterSid,
                    CustomerBranchSid: branch.CustomerBranchSid,
                    CustomerName: customer.CustomerName,
                    BranchName: branch.BranchName,
                    Address: branch.Address,
                    Email: branch.Email
                }))
                return cusBranches;
            })
            return formattedCustomerList;
        } catch (error) {
            throw error;
        }
    }


    async updateCustomer(CustomerMasterSid: number, payload: any) {
    const existing = await this._db.customerMaster.findUnique({
        where: { CustomerMasterSid }
    });

    if (!existing) throw new Error('Customer does not exist');

    return this._db.$transaction(async (tx) => {
        // 1️⃣ Update main customer
        const customer = await tx.customerMaster.update({
            where: { CustomerMasterSid },
            data: payload.customer
        });

        // 2️⃣ Handle branches
        if (payload.customerBranches) {
            for (const branch of payload.customerBranches) {
                let branchId: number;

                // Handle branch create/update
                if (branch.CustomerBranchSid) {
                    // Update existing branch
                    const updatedBranch = await tx.customerBranch.update({
                        where: { CustomerBranchSid: branch.CustomerBranchSid },
                        data: {
                            BranchName: branch.BranchName,
                            StateMasterSid: branch.StateMasterSid,
                            CityMasterSid: branch.CityMasterSid,
                            Branch_Type: branch.Branch_Type,
                            Contact_Person: branch.Contact_Person,
                            Zip_PostBox: branch.Zip_PostBox,
                            ContactNo: branch.ContactNo,
                            Email: branch.Email,
                            Address: branch.Address,
                            Registered: branch.Registered,
                            CustomerGstType: branch.CustomerGstType,
                            GSTNo: branch.GSTNo,
                            status: branch.status,
                            updatedBy: branch.updatedBy,
                          
                        }
                    });
                    branchId = updatedBranch.CustomerBranchSid;
                } else {
                    // Create new branch
                    const createdBranch = await tx.customerBranch.create({
                        data: {
                            BranchName: branch.BranchName,
                            StateMasterSid: branch.StateMasterSid,
                            CityMasterSid: branch.CityMasterSid,
                            CustomerMasterSid: customer.CustomerMasterSid,
                            CompanyMasterSid: customer.CompanyMasterSid,
                            Branch_Type: branch.Branch_Type,
                            Contact_Person: branch.Contact_Person,
                            Zip_PostBox: branch.Zip_PostBox,
                            ContactNo: branch.ContactNo,
                            Email: branch.Email,
                            Address: branch.Address,
                            Registered: branch.Registered,
                            CustomerGstType: branch.CustomerGstType,
                            GSTNo: branch.GSTNo,
                            status: branch.status,
                            createdBy: branch.createdBy,
                            
                        }
                    });
                    branchId = createdBranch.CustomerBranchSid;
                }

                // 3️⃣ Handle cusBranchContact
                if (branch.customerBranchContacts && branch.customerBranchContacts) {
                    for (const contact of branch.customerBranchContacts) {
                        if (contact.CusBranchContactSid) {
                            // Update existing contact
                            await tx.cusBranchContact.update({
                                where: { CusBranchContactSid: contact.CusBranchContactSid },
                                data: {
                                    ...contact,
                                    CustomerMasterSid: customer.CustomerMasterSid,
                                    CustomerBranchSid: branchId,
                                    updatedAt: new Date()
                                }
                            });
                        } else {
                            // Create new contact
                            await tx.cusBranchContact.create({
                                data: {
                                    ...contact,
                                    CustomerMasterSid: customer.CustomerMasterSid,
                                    CustomerBranchSid: branchId,
                                    createdAt: new Date()
                                }
                            });
                        }
                    }
                }

                // 4️⃣ Handle CustomerBrEmail
                if (branch.customerBranchEmails && branch.customerBranchEmails) {
                    for (const email of branch.customerBranchEmails) {
                        if (email.CustomerBrEmailSid) {
                            // Update existing email
                            await tx.customerBrEmail.update({
                                where: { CustomerBrEmailSid: email.CustomerBrEmailSid },
                                data: {
                                    ...email,
                                    CustomerMasterSid: customer.CustomerMasterSid,
                                    CustomerBranchSid: branchId,
                                    updatedAt: new Date()
                                }
                            });
                        } else {
                            // Create new email
                            await tx.customerBrEmail.create({
                                data: {
                                    ...email,
                                    CustomerMasterSid: customer.CustomerMasterSid,
                                    CustomerBranchSid: branchId,
                                    createdAt: new Date()
                                }
                            });
                        }
                    }
                }

                // 5️⃣ Handle CustomerLogin
                if (branch.customerBranchLogins && branch.customerBranchLogins) {
                    for (const login of branch.customerBranchLogins) {
                        if (login.CustomerLoginSid) {
                            // Update existing login
                            await tx.customerLogin.update({
                                where: { CustomerLoginSid: login.CustomerLoginSid },
                                data: {
                                    ...login,
                                    CustomerMasterSid: customer.CustomerMasterSid,
                                    CustomerBranchSid: branchId,
                                    updatedAt: new Date()
                                }
                            });
                        } else {
                            // Create new login
                            await tx.customerLogin.create({
                                data: {
                                    ...login,
                                    CustomerMasterSid: customer.CustomerMasterSid,
                                    CustomerBranchSid: branchId,
                                    createdAt: new Date()
                                }
                            });
                        }
                    }
                }

                // 6️⃣ Handle CustomerSalesTeam
                if (branch.customerSalesTeams && branch.customerSalesTeams) {
                    for (const sales of branch.customerSalesTeams) {
                        if (sales.CustomerSalesSid) {
                            // Update existing sales team
                            await tx.customerSalesTeam.update({
                                where: { CustomerSalesSid: sales.CustomerSalesSid },
                                data: {
                                    DepartmentMasterSid: sales.DepartmentMasterSid,
                                    CompanyMasterSid: sales.CompanyMasterSid,
                                    Salesman: sales.Salesman,
                                    CSPerson: sales.CSPerson,
                                    DocPerson: sales.DocPerson,
                                    EffectiveFrom: sales.EffectiveFrom,
                                    status: sales.status,
                                    updatedBy: sales.updatedBy,
                                   
                                }
                            });
                        } else {
                            // Create new sales team
                            const salesTeam = await tx.customerSalesTeam.create({
                                data: {
                                    DepartmentMasterSid: sales.DepartmentMasterSid,
                                    CompanyMasterSid: sales.CompanyMasterSid,
                                    Salesman: sales.Salesman,
                                    CSPerson: sales.CSPerson,
                                    DocPerson: sales.DocPerson,
                                    EffectiveFrom: sales.EffectiveFrom,
                                    status: sales.status,
                                    createdBy: sales.createdBy,
                                    CustomerMasterSid: customer.CustomerMasterSid,
                                    
                                }
                            });


                            
                        }
                    }
                }

                // 7️⃣ Handle CustomerMilestone
                if (branch.customerMilestones && branch.customerMilestones.length > 0) {
                    for (const milestone of branch.customerMilestones) {
                        if (milestone.CustomerMilestoneSid) {
                            // Update existing milestone
                            await tx.customerMilestone.update({
                                where: { CustomerMilestoneSid: milestone.CustomerMilestoneSid },
                                data: {
                                    ...milestone,
                                    CustomerMasterSid: customer.CustomerMasterSid,
                                    CustomerBranchSid: branchId,
                                    updatedAt: new Date()
                                }
                            });
                        } else {
                            // Create new milestone
                            await tx.customerMilestone.create({
                                data: {
                                    ...milestone,
                                    CustomerMasterSid: customer.CustomerMasterSid,
                                    CustomerBranchSid: branchId,
                                    createdAt: new Date()
                                }
                            });
                        }
                    }
                }
            }
        }

        return customer;
    });
}

    async softDelete(CustomerMasterSid: number) {
        try {
            const existingCustomer = await this._db.customerMaster.findUnique({
                where: { CustomerMasterSid: CustomerMasterSid }
            });

            if (!existingCustomer) {
                throw new NotFoundException(`Customer with ID ${CustomerMasterSid} not found`);
            }

            if (existingCustomer.status === 'D') {
                throw new Error(`Customer with ID ${CustomerMasterSid} is already deleted`);
            }

            const result = await this._db.$transaction(async (prisma) => {
                const deletedCustomer = await prisma.customerMaster.update({
                    where: {
                        CustomerMasterSid: CustomerMasterSid,
                        status: 'A'
                    },
                    data: {
                        status: 'D'
                    }
                })
                const allCustomerBranches = await prisma.customerBranch.findMany({
                    where: {
                        CustomerMasterSid: CustomerMasterSid,
                        status: 'A'
                    }
                })

                const allCusBranchesWithChild = await Promise.all(
                    allCustomerBranches.map(async branch => {
                        const deletedCusBranch = await prisma.customerBranch.update({
                            where: {
                                CustomerBranchSid: branch.CustomerBranchSid,
                                status: 'A'
                            },
                            data: {
                                status: 'D'
                            }
                        })
                        const deleteCusBranchContact = await prisma.cusBranchContact.updateManyAndReturn({
                            where: {
                                CustomerBranchSid: deletedCusBranch.CustomerBranchSid,
                                status: 'A'
                            },
                            data: {
                                status: 'D'
                            }
                        })
                        const deleteCusBranchEmail = await prisma.customerBrEmail.updateManyAndReturn({
                            where: {
                                CustomerBranchSid: branch.CustomerBranchSid,
                                status: 'A'
                            },
                            data: {
                                status: 'D'
                            }
                        })
                        const deleteCusBranchLogin = await prisma.customerLogin.updateManyAndReturn({
                            where: {
                                CustomerBranchSid: branch.CustomerBranchSid,
                                status: 'A'
                            },
                            data: {
                                status: 'D'
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


    async searchList(params: filterDto) {
        const { search = '', page = 1, pageSize = 15, activeCompanyId } = params;
        const skip = (page - 1) * pageSize;

        const where: Prisma.CustomerMasterWhereInput = {
            status: statusWhereClause,
            CompanyMasterSid: activeCompanyId,
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

    async getAllCarriers(CompanyMasterSid: number) {
        try {
            const allCarriers = await this._db.customerMaster.findMany({
                where: {
                    CustomerType: {
                        path: ['carrier'],
                        equals: 'isTrue'
                    },
                    status: 'A',
                    CompanyMasterSid: CompanyMasterSid
                }
            })
            return allCarriers;
        } catch (error) {
            throw error;
        }
    }

    async getAllAgents(CompanyMasterSid) {
        try {
            const allAgents = await this._db.customerMaster.findMany({
                where: {
                    CustomerType: {
                        path: ['agent'],
                        equals: 'isTrue'
                    },
                    status: 'A',
                    CompanyMasterSid: CompanyMasterSid
                }
            })
            return allAgents;
        } catch (error) {
            throw error;
        }
    }
    async getAllShippers(CompanyMasterSid: number) {
        try {
            const allAgents = await this._db.customerMaster.findMany({
                where: {
                    CustomerType: {
                        path: ['shipper'],
                        equals: 'isTrue'
                    },
                    status: 'A',
                    CompanyMasterSid: CompanyMasterSid
                }
            })
            return allAgents;
        } catch (error) {
            throw error;
        }
    }
    async getAllConsignee(CompanyMasterSid: number) {
        try {
            const allAgents = await this._db.customerMaster.findMany({
                where: {
                    CustomerType: {
                        path: ['consignee'],
                        equals: 'isTrue'
                    },
                    status: 'A',
                    CompanyMasterSid: CompanyMasterSid
                }
            })
            return allAgents;
        } catch (error) {
            throw error;
        }
    }
    async getAllTransporters(CompanyMasterSid: number) {
        try {
            const allAgents = await this._db.customerMaster.findMany({
                where: {
                    CustomerType: {
                        path: ['transporter'],
                        equals: 'isTrue'
                    },
                    status: 'A',
                    CompanyMasterSid: CompanyMasterSid
                }
            })
            return allAgents;
        } catch (error) {
            throw error;
        }
    }
    async getAllCFS(CompanyMasterSid: number) {
        try {
            const allAgents = await this._db.customerMaster.findMany({
                where: {
                    CustomerType: {
                        path: ['cFS'],
                        equals: 'isTrue'
                    },
                    status: 'A',
                    CompanyMasterSid: CompanyMasterSid
                }
            })
            return allAgents;
        } catch (error) {
            throw error;
        }
    }

    async getAllSuppliers(CompanyMasterSid: number) {
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
                    status: 'A',
                    CompanyMasterSid: CompanyMasterSid
                },
                include: {
                    countryMaster: {
                        select: {
                            countryName: true
                        }
                    }
                }
            });

            return allSuppliers;
        } catch (error) {
            throw error;
        }
    }
    async getAuditLogs(tableName: string, recordId?: string) {
        try {
            const whereClause: any = { tableName };
            if (recordId) whereClause.recordId = recordId;

            const logs = await this._db.auditLog.findMany({
                where: whereClause,
                orderBy: { changedAt: 'desc' },
            });

            return logs;
        } catch (error) {
            this.logger.warn(`getAuditLogsError: ${error}`);
            throw new Error(`Error fetching audit logs: ${error.message}`);
        }
    }


}
