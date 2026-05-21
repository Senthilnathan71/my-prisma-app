import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { LeadStatus, Prisma, UserTypeCode } from '@prisma/client';
import { statusWhereClause } from 'src/common/helper';
import { DatabaseService } from 'src/database/database.service';
import { SearchListDto } from 'src/masters/DTO/search-list.dto';
import { filterDto } from 'src/masters/DTO/search-vessel.dto';
import { CreateUpdateCustomerDto, BulkCreateUpdateCustomerDto } from 'src/masters/DTO/customer.dto';

@Injectable()
export class CustomerService {
    constructor(private _db: DatabaseService, private logger: Logger) { }


    async createCustomer(payload: CreateUpdateCustomerDto, user: any) {
        this.logger.log(`createCustomer: ${JSON.stringify(payload)}`);
        this.logger.log(`User from JWT: ${JSON.stringify(user)}`);

        // Extract user email from JWT token
        const userEmail = user?.UserEmail || user?.email || user?.userEmail;
         
        // Step 1: Check duplicate for CustomerMaster
        const existing = await this._db.customerMaster.findFirst({
            where: {
                  CompanyMasterSid: payload.customer.CompanyMasterSid,
                OR: [
                    { CustomerName: { equals: payload.customer.CustomerName.trim(), mode: 'insensitive' } },
                  
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
                    CurrencyMasterSid: payload.customer.CurrencyMasterSid,
                    CustomerType: payload.customer.CustomerType,
                    PanName: payload.customer.PanName,
                    PanType: payload.customer.PanType,
                    GroupName: payload.customer.GroupName,
                    Website: payload.customer.Website,
                    CashCredit: payload.customer.CashCredit,
                    Network: payload.customer.Network,
                    Remarks: payload.customer.Remarks,
                    CIN: payload.customer.CIN,
                    TAN: payload.customer.TAN,
                    IsMSME: payload.customer.IsMSME,
                    RegistrationNo: payload.customer.RegistrationNo,
                    CompanyType: payload.customer.CompanyType,
                    createdBy: userEmail,
                    AirlineNumber: payload.customer.AirlineNumber,
                    AirlineCode: payload.customer.AirlineCode,
                    status: payload.customer.status
                }
            });
            this.logger.log(`customerCreated: ${JSON.stringify(customer)}`);


            // Step 3: Validate at least one branch
            if (!payload.customerBranches || payload.customerBranches.length === 0) {
                throw new BadRequestException('At least one branch is required');
            }

            // Step 4: Multiple Branches
            if (customer && payload.customerBranches) {
                for (const branch of payload.customerBranches) {

                    const createdBranch = await tx.customerBranch.create({
                        data: {
                            BranchName: branch.BranchName,
                            Branch_Code: branch.Branch_Code,
                            StateMasterSid: branch.StateMasterSid,
                            CityMasterSid: branch.CityMasterSid,
                            CustomerMasterSid: customer.CustomerMasterSid,
                            CompanyMasterSid: customer.CompanyMasterSid,
                            Branch_Type: branch.Branch_Type,
                            Contact_Person: branch.Contact_Person,
                            Zip_PostBox: branch.Zip_PostBox,
                            ContactNo: branch.ContactNo,
                            Email: branch.Email ?? '',
                            Address: branch.Address,
                            Registered: branch.Registered,
                            CustomerGstType: branch.CustomerGstType,
                            GSTNo: branch.GSTNo || '',
                            status: branch.status,
                            createdBy: userEmail,
                        }
                    });

                    this.logger.log(`branch created: ${JSON.stringify(createdBranch)}`);


                    const branchId = createdBranch.CustomerBranchSid;

                    // Step 5: CusBranchContact
                    if (branch.customerBranchContacts && branch.customerBranchContacts.length > 0) {
                        for (const contact of branch.customerBranchContacts) {

                            const branchContact = await tx.cusBranchContact.create({
                                data: {
                                    ContactType: contact.ContactType,
                                    ContactName: contact.ContactName,
                                    ContactNo: contact.ContactNo,
                                    MobileNo: contact.MobileNo,
                                    Email: contact.Email,
                                    status: contact.status,
                                    createdBy: userEmail,
                                    CustomerMasterSid: customer.CustomerMasterSid,
                                    CustomerBranchSid: branchId
                                }
                            });

                            this.logger.log(`branch Contact Created: ${JSON.stringify(branchContact)}`);
                        }
                    }

                    // Step 6: CustomerBrEmail
                    if (branch.customerBranchEmails && branch.customerBranchEmails.length > 0) {
                        for (const email of branch.customerBranchEmails) {
                            const branchEmail = await tx.customerBrEmail.create({
                                data: {
                                    Toemail: email.Toemail,
                                    CCemail: email.CCemail,
                                    DepartmentMasterSid: email.DepartmentMasterSid,
                                    MenuMasterSid: email.MenuMasterSid,
                                    status: email.status,
                                    createdBy: userEmail,
                                    CustomerMasterSid: customer.CustomerMasterSid,
                                    CustomerBranchSid: branchId,
                                    CompanyMasterSid: customer.CompanyMasterSid
                                }
                            });

                            this.logger.log(`branch Email Created: ${JSON.stringify(branchEmail)}`);
                        }
                    }

                    // Step 7: CustomerLogin
                    if (branch.customerBranchLogins && branch.customerBranchLogins.length > 0) {
                        for (const login of branch.customerBranchLogins) {
                            const branchLogin = await tx.customerLogin.create({
                                data: {
                                    LoginName: login.LoginName,
                                    LoginEmail: login.LoginEmail,
                                    LoginPassword: login.LoginPassword,
                                    status: login.status,
                                    createdBy: userEmail,
                                    CustomerMasterSid: customer.CustomerMasterSid,
                                    CustomerBranchSid: branchId,
                                    CompanyMasterSid: customer.CompanyMasterSid
                                }
                            });

                            this.logger.log(`branch Login Created: ${JSON.stringify(branchLogin)}`);
                        }
                    }

                    // Step 8: CustomerSalesTeam
                    if (branch.customerSalesTeams && branch.customerSalesTeams.length > 0) {
                        for (const sales of branch.customerSalesTeams) {
                            const salesTeam = await tx.customerSalesTeam.create({
                                data: {
                                    Salesman: sales.Salesman,
                                    DocPerson: sales.DocPerson,
                                    CSPerson: sales.CSPerson,
                                    DepartmentMasterSid: sales.DepartmentMasterSid, // Array of integers
                                    EffectiveFrom: sales.EffectiveFrom,
                                    status: sales.status,
                                    createdBy: userEmail,
                                    CustomerMasterSid: customer.CustomerMasterSid,
                                    CustomerBranchSid: branchId,
                                    CompanyMasterSid: customer.CompanyMasterSid
                                }
                            });

                            this.logger.log(`Sales Team Created: ${JSON.stringify(salesTeam)}`);
                        }
                    }

                    // Step 9: CustomerMilestone
                    if (branch.customerMilestones && branch.customerMilestones.length > 0) {
                        for (const milestone of branch.customerMilestones) {
                            const customerMilestone = await tx.customerMilestone.create({
                                data: {
                                    MilestoneMasterSid: milestone.MilestoneMasterSid,
                                    UpdateType: milestone.UpdateType,
                                    ContactInfo: milestone.ContactInfo,
                                    EffectiveFrom: milestone.EffectiveFrom,
                                    Status: milestone.Status,
                                    CreatedBy: userEmail,
                                    CustomerMasterSid: customer.CustomerMasterSid,
                                    CustomerBranchSid: branchId
                                }
                            });

                            this.logger.log(`Milestone Created: ${JSON.stringify(customerMilestone)}`);
                        }
                    }

                }
            }

            return customer;
        });
    }

    private async resolveStateMasterSid(stateName: string): Promise<number | null> {
        const state = await this._db.stateMaster.findFirst({
            where: {
                stateName: { equals: stateName.trim(), mode: 'insensitive' },
                status: 'A'
            },
            select: { StateMasterSid: true }
        });
        return state?.StateMasterSid ?? null;
    }

    private async resolveCityMasterSid(cityName: string, stateMasterSid: number): Promise<number | null> {
        const city = await this._db.cityMaster.findFirst({
            where: {
                cityName: { equals: cityName.trim(), mode: 'insensitive' },
                StateMasterSid: stateMasterSid,
                status: 'A'
            },
            select: { CityMasterSid: true }
        });
        return city?.CityMasterSid ?? null;
    }

    async createBulkCustomers(payload: { customers: BulkCreateUpdateCustomerDto[] }, user: any) {
        this.logger.log(`createBulkCustomers: ${payload.customers.length} customers`);

        const results: { success: any[]; failed: any[] } = {
            success: [],
            failed: []
        };

        for (const customerPayload of payload.customers) {
            try {
                // Resolve state/city names to IDs for each branch
                const resolvedBranches: any[] = [];
                let resolutionError: string | null = null;

                for (const branch of customerPayload.customerBranches) {
                    const branchName = branch.BranchName || 'Unknown';

                    // Resolve StateMasterSid from StateName if not provided
                    let stateSid:any = branch.StateMasterSid;
                    if (!stateSid && branch.StateName) {
                        stateSid = await this.resolveStateMasterSid(branch.StateName);
                        if (!stateSid) {
                            resolutionError = `State '${branch.StateName}' not found (Branch: ${branchName})`;
                            break;
                        }
                    }
                    if (!stateSid) {
                        resolutionError = `State is required (Branch: ${branchName})`;
                        break;
                    }

                    // Resolve CityMasterSid from CityName if not provided
                    let citySid:any = branch.CityMasterSid;
                    if (!citySid && branch.CityName) {
                        citySid = await this.resolveCityMasterSid(branch.CityName, stateSid);
                        if (!citySid) {
                            resolutionError = `City '${branch.CityName}' not found in state '${branch.StateName || stateSid}' (Branch: ${branchName})`;
                            break;
                        }
                    }
                    if (!citySid) {
                        resolutionError = `City is required (Branch: ${branchName})`;
                        break;
                    }

                    // Build resolved branch (strip StateName/CityName, set resolved IDs)
                    const { StateName, CityName, ...branchFields } = branch as any;
                    resolvedBranches.push({
                        ...branchFields,
                        StateMasterSid: stateSid,
                        CityMasterSid: citySid,
                    });
                }

                if (resolutionError) {
                    // Get original names from first branch for error display
                    const firstBranch = customerPayload.customerBranches[0];
                    results.failed.push({
                        CustomerName: customerPayload.customer.CustomerName,
                        BranchName: firstBranch?.BranchName || '',
                        StateName: firstBranch?.StateName || '',
                        CityName: firstBranch?.CityName || '',
                        error: resolutionError
                    });
                    continue;
                }

                // Build a proper CreateUpdateCustomerDto-shaped object with resolved IDs
                const resolvedPayload: CreateUpdateCustomerDto = {
                    customer: customerPayload.customer,
                    customerBranches: resolvedBranches
                };

                const customer = await this.createCustomer(resolvedPayload, user);
                results.success.push({
                    CustomerName: customerPayload.customer.CustomerName,
                    CustomerMasterSid: customer.CustomerMasterSid
                });
            } catch (error: any) {
                const firstBranch = customerPayload.customerBranches[0];
                results.failed.push({
                    CustomerName: customerPayload.customer.CustomerName,
                    BranchName: firstBranch?.BranchName || '',
                    StateName: firstBranch?.StateName || '',
                    CityName: firstBranch?.CityName || '',
                    error: error.message || 'Failed to create'
                });
            }
        }

        return results;
    }

    async findOne(customerMasterSid: any) {
        try {
            const customerData: any = await this._db.customerMaster.findUnique({
                where: {
                    CustomerMasterSid: customerMasterSid,
                    status: statusWhereClause,
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
                    CurrencyMasterSid: true,
                    CustomerName: true,
                    CompanyMasterSid: true,
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
                    CIN: true,
                    TAN: true,
                    IsMSME: true,
                    RegistrationNo: true,
                    CompanyType: true,
                    PanName: true,
                    PanType: true,
                    AirlineCode: true,
                    AirlineNumber: true,
                    status: true,
                    createdBy: true,
                    updatedBy: true,
                    createdOn: true,
                    updatedOn: true,
                    CustomerBranch: {
                        where: { status: statusWhereClause },
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
                            CompanyMasterSid: true,
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
                            Registered: true,
                            status: true,
                            createdBy: true,
                            updatedBy: true,
                            createdOn: true,
                            updatedOn: true,
                            cusBranchContact: {
                                where: { status: statusWhereClause },
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
                                    MobileNo: true,
                                    Email: true,
                                    status: true,
                                    createdBy: true,
                                    updatedBy: true,
                                    createdOn: true,
                                    updatedOn: true
                                }
                            }
                        }
                    },
                    CustomerBrEmail: {
                        where: { status:{in: ['A', 'S']}},
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
                            CustomerBrEmailSid: true,
                            MenuMasterSid: true,
                            Toemail: true,
                            CCemail: true,
                            DepartmentMasterSid: true,
                            status: true,
                            createdBy: true,
                            updatedBy: true,
                            createdOn: true,
                            updatedOn: true
                        }
                    },
                    CustomerLogin: {
                        where: { status: {in: ['A', 'S']} },
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
                            LoginName: true,
                            LoginEmail: true,
                            LoginPassword: true,
                            status: true,
                            createdBy: true,
                            updatedBy: true,
                            createdOn: true,
                            updatedOn: true
                        }
                    },
                    CustomerSalesTeam: {
                        where: { status:{in: ['A', 'S']} },
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
                            CustomerSalesSid: true,
                            Salesman: true,
                            DocPerson: true,
                            CSPerson: true,
                            CompanyMasterSid: true,
                            CustomerBranchSid: true,
                            EffectiveFrom: true,
                            DepartmentMasterSid: true,
                            status: true,
                            createdBy: true,
                            updatedBy: true,
                            createdOn: true,
                            updatedOn: true,
                            salesManUser: {
                                select: {
                                    UserMasterSid: true,
                                    userName: true,
                                    userCode: true
                                }
                            },
                            DocPersonUser: {
                                select: {
                                    UserMasterSid: true,
                                    userName: true,
                                    userType: {
                                        select: {
                                            UserTypeSid: true,
                                            code: true
                                        }
                                    }
                                }
                            },
                            CSPersonUser: {
                                select: {
                                    UserMasterSid: true,
                                    userName: true,
                                    userType: {
                                        select: {
                                            UserTypeSid: true,
                                            code: true
                                        }
                                    }
                                }
                            }
                        }
                    },
                    CustomerMilestone: {
                        where: { Status: {in: ['A', 'S']} },
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
                            UpdateType: true,
                            ContactInfo: true,
                            EffectiveFrom: true,
                            Status: true
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
    async  getAllExistingCustomers(CompanyMasterSid: number, PreCustomerMasterSid: number) {
        try {
            const customerList = await this._db.customerMaster.findMany({
                where: {
                    status: 'A',
                    preCustomerMaster: {
                        leadStatus: LeadStatus.DealWon
                    },
                    CompanyMasterSid: CompanyMasterSid,
                }
            })
            return customerList;
        } catch (error) {
            throw error
        }
    }

    async searchExistingCustomers(params: filterDto) {
        const { search = '',page = 1, pageSize = 10, activeCompanyId} = params;
        const skip = (page - 1) * pageSize;

        const where: Prisma.CustomerMasterWhereInput = {
            status: statusWhereClause,
            preCustomerMaster: {
                        leadStatus: LeadStatus.DealWon
                    },
            CompanyMasterSid: activeCompanyId,
            ...(search
                ? {
                    OR: [
                        { CustomerName: {contains: search, mode: 'insensitive'}},
                        { CustomerAddress1: {contains: search,  mode: 'insensitive'}},
                    ],
                } : {}
            ),
        };
        const [items, totalCount] = await this._db.$transaction([
            this._db.customerMaster.findMany({
                where,
                skip,
                take: pageSize,
                orderBy: { CustomerMasterSid: 'desc'},
                include: {
                    preCustomerMaster: true, // Include if needed for debugging, otherwise remove,
                }
            }),
            this._db.customerMaster.count({where}),
        ]);

        return { items, totalCount}
    }

    async checkUniqueCustomerFields(params: {
        CompanyMasterSid: number;
        customerName?: string;
        customerShortCode?: string;
        excludeCustomerMasterSid?: number;
    }) {
        const { CompanyMasterSid, customerName, customerShortCode, excludeCustomerMasterSid } = params;
        const normalizedName = customerName?.trim().toLowerCase();
        const normalizedShortCode = customerShortCode?.trim().toLowerCase();

        if (!normalizedName && !normalizedShortCode) {
            return { nameTaken: false, codeTaken: false, message: 'No fields provided' };
        }

        const rows = await this._db.customerMaster.findMany({
            where: {
                CompanyMasterSid,
                status: 'A',
                ...(excludeCustomerMasterSid ? { CustomerMasterSid: { not: excludeCustomerMasterSid } } : {}),
            },
            select: { CustomerName: true, CustomerShortCode: true },
        });

        const nameTaken = !!normalizedName && rows.some(
            (r) => (r.CustomerName ?? '').trim().toLowerCase() === normalizedName,
        );

        const codeTaken = !!normalizedShortCode && rows.some(
            (r) => (r.CustomerShortCode ?? '').trim().toLowerCase() === normalizedShortCode,
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
                    CustomerType : { 
                        path : ['customer'],
                        equals : 'isTrue'
                    },
                    CustomerBranch: { some: {} }
                },
                select: {
                    CustomerMasterSid: true,
                    CustomerName: true,
                    CurrencyMasterSid: true,
                    CustomerBranch: {
                        where: {
                            status: 'A'
                        },
                        select: {
                            CustomerBranchSid: true,
                            BranchName: true,
                            Address: true,
                            Email: true,
                            Contact_Person : true,
                            ContactNo : true
                        }
                    }
                }
            });
            const currencyMasterSids = Array.from(
                new Set(
                    customerList
                        .map(customer => customer.CurrencyMasterSid)
                        .filter((currencyMasterSid): currencyMasterSid is number => Boolean(currencyMasterSid))
                )
            );
            const currencies = currencyMasterSids.length
                ? await this._db.currencyMaster.findMany({
                    where: {
                        CurrencyMasterSid: {
                            in: currencyMasterSids,
                        },
                    },
                    select: {
                        CurrencyMasterSid: true,
                        currencyCode: true,
                    },
                })
                : [];
            const currencyCodeMap = new Map(
                currencies.map(currency => [currency.CurrencyMasterSid, currency.currencyCode ?? ''])
            );
            const formattedCustomerList = customerList.flatMap(customer => {
                const cusBranches = customer.CustomerBranch.map(branch => ({
                    CustomerMasterSid: customer.CustomerMasterSid,
                    CustomerBranchSid: branch.CustomerBranchSid,
                    CustomerName: customer.CustomerName,
                    BranchName: branch.BranchName,
                    Address: branch.Address,
                    Email: branch.Email,
                    ContactPerson : branch.Contact_Person,
                    ContactNumber : branch.ContactNo,
                    CurrencyMasterSid: customer.CurrencyMasterSid,
                    CurrencyCode: customer.CurrencyMasterSid
                        ? currencyCodeMap.get(customer.CurrencyMasterSid) ?? ''
                        : ''
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
                    CustomerBranch: true,
                    countryMaster : {
                        select:{
                            countryName : true
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
                    Email: branch.Email,
                    PanType: customer.PanType,
                    CompanyType: customer.CompanyType,
                    CountryName: customer.countryMaster?.countryName,
                }));
                return cusBranches;
            })
            return formattedCustomerList;
        } catch (error) {
            throw error;
        }
    }


    async updateCustomer(CustomerMasterSid: number, payload: any, user: any) {
        this.logger.log(`updateCustomer: ${JSON.stringify(payload)}`);
        this.logger.log(`User from JWT: ${JSON.stringify(user)}`);

        // Extract user email from JWT token
        const userEmail = user?.UserEmail || user?.email || user?.userEmail;

        const existing = await this._db.customerMaster.findUnique({
            where: { CustomerMasterSid }
        });

        if (!existing) {
            throw new NotFoundException(`Customer with ID ${CustomerMasterSid} not found`);
        }

        const normalizedExistingName = (existing.CustomerName ?? '').trim();
        const normalizedIncomingName = (payload?.customer?.CustomerName ?? '').trim();
        const isCustomerNameChanged = normalizedExistingName !== normalizedIncomingName;

        // Validate duplicate name/code (excluding current customer)
        const duplicateCheck = await this.checkUniqueCustomerFields({
            CompanyMasterSid: payload.customer.CompanyMasterSid,
            customerName: payload.customer.CustomerName,
            excludeCustomerMasterSid: CustomerMasterSid
        });

        if (duplicateCheck.nameTaken || duplicateCheck.codeTaken) {
            throw new BadRequestException(duplicateCheck.message);
        }

        // Validate at least one branch
        if (!payload.customerBranches || payload.customerBranches.length === 0) {
            throw new BadRequestException('At least one branch is required');
        }

        return this._db.$transaction(async (tx) => {
            // 1️⃣ Update main customer
            const customer = await tx.customerMaster.update({
                where: { CustomerMasterSid },
                data: {
                    CompanyMasterSid: payload.customer.CompanyMasterSid,
                    CustomerName: payload.customer.CustomerName,
                    CustomerShortCode: payload.customer.CustomerShortCode,
                    CustomerAliasName: payload.customer.CustomerAliasName,
                    CustomerAddress1: payload.customer.CustomerAddress1,
                    CustomerAddress2: payload.customer.CustomerAddress2,
                    CountryMasterSid: payload.customer.CountryMasterSid,
                    CurrencyMasterSid: payload.customer.CurrencyMasterSid,
                    CustomerType: payload.customer.CustomerType,
                    PanName: payload.customer.PanName,
                    PanType: payload.customer.PanType,
                    GroupName: payload.customer.GroupName,
                    Website: payload.customer.Website,
                    CashCredit: payload.customer.CashCredit,
                    Network: payload.customer.Network,
                    Remarks: payload.customer.Remarks,
                    CIN: payload.customer.CIN,
                    TAN: payload.customer.TAN,
                    IsMSME: payload.customer.IsMSME,
                    RegistrationNo: payload.customer.RegistrationNo,
                    CompanyType: payload.customer.CompanyType,
                    AirlineNumber: payload.customer.AirlineNumber,
                    AirlineCode: payload.customer.AirlineCode,
                    status: payload.customer.status,
                    updatedBy: userEmail,
                    updatedOn: new Date()
                }
            });

            // 2️⃣ Get existing branches to identify deletions
            if (isCustomerNameChanged) {
                await tx.subledgerMaster.updateMany({
                    where: {
                        SubledgerMappingSid: CustomerMasterSid,
                        SubledgerType: 'Customer',
                        Status: { not: 'D' }
                    },
                    data: {
                        SubledgerName: customer.CustomerName,
                        UpdatedBy: userEmail,
                        UpdatedOn: new Date()
                    }
                });
            }

            const existingBranches = await tx.customerBranch.findMany({
                where: { CustomerMasterSid, status: 'A' },
                select: { CustomerBranchSid: true }
            });

            const incomingBranchIds = payload.customerBranches
                .filter(b => b.CustomerBranchSid)
                .map(b => b.CustomerBranchSid);

            const branchIdsToDelete = existingBranches
                .filter(eb => !incomingBranchIds.includes(eb.CustomerBranchSid))
                .map(eb => eb.CustomerBranchSid);

            // Soft delete removed branches and their children
            if (branchIdsToDelete.length > 0) {
                await tx.customerBranch.updateMany({
                    where: { CustomerBranchSid: { in: branchIdsToDelete } },
                    data: { status: 'D' ,updatedBy: userEmail,updatedOn: new Date()}
                });

                await tx.cusBranchContact.updateMany({
                    where: { CustomerBranchSid: { in: branchIdsToDelete } },
                    data: { status: 'D' ,updatedBy: userEmail,updatedOn: new Date()}
                });

                await tx.customerBrEmail.updateMany({
                    where: { CustomerBranchSid: { in: branchIdsToDelete } },
                    data: { status: 'D' ,updatedBy: userEmail,updatedOn: new Date()}
                });

                await tx.customerLogin.updateMany({
                    where: { CustomerBranchSid: { in: branchIdsToDelete } },
                    data: { status: 'D' ,updatedBy: userEmail,updatedOn: new Date()}
                });

                await tx.customerSalesTeam.updateMany({
                    where: { CustomerBranchSid: { in: branchIdsToDelete } },
                    data: { status: 'D' ,updatedBy: userEmail, updatedOn: new Date()}
                });

                await tx.customerMilestone.updateMany({
                    where: { CustomerBranchSid: { in: branchIdsToDelete } },
                    data: { Status: 'D' ,UpdatedBy: userEmail, UpdatedOn: new Date()}
                });
            }

            // 3️⃣ Handle branches
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
                            Branch_Code: branch.Branch_Code,
                            CityMasterSid: branch.CityMasterSid,
                            Branch_Type: branch.Branch_Type,
                            Contact_Person: branch.Contact_Person,
                            Zip_PostBox: branch.Zip_PostBox,
                            ContactNo: branch.ContactNo,
                            Email: branch.Email ?? '',
                            Address: branch.Address,
                            Registered: branch.Registered,
                            CustomerGstType: branch.CustomerGstType,
                            GSTNo: branch.GSTNo || '',
                            status: branch.status,
                            updatedBy: userEmail,
                            updatedOn: new Date()
                        }
                    });
                    branchId = updatedBranch.CustomerBranchSid;
                } else {
                    // Create new branch
                    const createdBranch = await tx.customerBranch.create({
                        data: {
                            BranchName: branch.BranchName,
                            StateMasterSid: branch.StateMasterSid,
                            Branch_Code: branch.Branch_Code,
                            CityMasterSid: branch.CityMasterSid,
                            CustomerMasterSid: customer.CustomerMasterSid,
                            CompanyMasterSid: customer.CompanyMasterSid,
                            Branch_Type: branch.Branch_Type,
                            Contact_Person: branch.Contact_Person,
                            Zip_PostBox: branch.Zip_PostBox,
                            ContactNo: branch.ContactNo,
                            Email: branch.Email ?? '',
                            Address: branch.Address,
                            Registered: branch.Registered,
                            CustomerGstType: branch.CustomerGstType,
                            GSTNo: branch.GSTNo || '',
                            status: branch.status,
                            createdBy: userEmail
                        }
                    });
                    branchId = createdBranch.CustomerBranchSid;
                }

                // 4️⃣ Handle CusBranchContact
                if (branch.customerBranchContacts && branch.customerBranchContacts.length > 0) {
                    const existingContacts = await tx.cusBranchContact.findMany({
                        where: { CustomerBranchSid: branchId, status: 'A' },
                        select: { CusBranchContactSid: true }
                    });

                    const incomingContactIds = branch.customerBranchContacts
                        .filter(c => c.CusBranchContactSid)
                        .map(c => c.CusBranchContactSid);

                    const contactIdsToDelete = existingContacts
                        .filter(ec => !incomingContactIds.includes(ec.CusBranchContactSid))
                        .map(ec => ec.CusBranchContactSid);

                    if (contactIdsToDelete.length > 0) {
                        await tx.cusBranchContact.updateMany({
                            where: { CusBranchContactSid: { in: contactIdsToDelete } },
                            data: { status: 'D' ,updatedBy: userEmail,updatedOn: new Date()}
                        });
                    }

                    for (const contact of branch.customerBranchContacts) {
                        if (contact.CusBranchContactSid) {
                            await tx.cusBranchContact.update({
                                where: { CusBranchContactSid: contact.CusBranchContactSid },
                                data: {
                                    ContactType: contact.ContactType,
                                    ContactName: contact.ContactName,
                                    ContactNo: contact.ContactNo,
                                    MobileNo: contact.MobileNo,
                                    Email: contact.Email,
                                    status: contact.status,
                                    updatedBy: userEmail,
                                    updatedOn: new Date()
                                }
                            });
                        } else {
                            await tx.cusBranchContact.create({
                                data: {
                                    ContactType: contact.ContactType,
                                    ContactName: contact.ContactName,
                                    ContactNo: contact.ContactNo,
                                    MobileNo: contact.MobileNo,
                                    Email: contact.Email,
                                    status: contact.status,
                                    createdBy: userEmail,
                                    CustomerMasterSid: customer.CustomerMasterSid,
                                    CustomerBranchSid: branchId
                                }
                            });
                        }
                    }
                } else {
                    // Delete all existing contacts if none provided
                    await tx.cusBranchContact.updateMany({
                        where: { CustomerBranchSid: branchId, status: 'A' },
                        data: { status: 'D' ,updatedBy: userEmail,updatedOn: new Date()}
                    });
                }

                // 5️⃣ Handle CustomerBrEmail
                if (branch.customerBranchEmails && branch.customerBranchEmails.length > 0) {
                    const existingEmails = await tx.customerBrEmail.findMany({
                        where: { CustomerBranchSid: branchId, status: 'A' },
                        select: { CustomerBrEmailSid: true }
                    });

                    const incomingEmailIds = branch.customerBranchEmails
                        .filter(e => e.CustomerBrEmailSid)
                        .map(e => e.CustomerBrEmailSid);

                    const emailIdsToDelete = existingEmails
                        .filter(ee => !incomingEmailIds.includes(ee.CustomerBrEmailSid))
                        .map(ee => ee.CustomerBrEmailSid);

                    if (emailIdsToDelete.length > 0) {
                        await tx.customerBrEmail.updateMany({
                            where: { CustomerBrEmailSid: { in: emailIdsToDelete } },
                            data: { status: 'D' ,updatedBy: userEmail,updatedOn: new Date()}
                        });
                    }

                    for (const email of branch.customerBranchEmails) {
                        if (email.CustomerBrEmailSid) {
                            await tx.customerBrEmail.update({
                                where: { CustomerBrEmailSid: email.CustomerBrEmailSid },
                                data: {
                                    CustomerBranchSid: branchId,
                                    Toemail: email.Toemail,
                                    CCemail: email.CCemail,
                                    DepartmentMasterSid: email.DepartmentMasterSid,
                                    MenuMasterSid: email.MenuMasterSid,
                                    status: email.status,
                                    updatedBy: userEmail,
                                    updatedOn: new Date()
                                }
                            });
                        } else {
                            await tx.customerBrEmail.create({
                                data: {
                                    Toemail: email.Toemail,
                                    CCemail: email.CCemail,
                                    DepartmentMasterSid: email.DepartmentMasterSid,
                                    MenuMasterSid: email.MenuMasterSid,
                                    status: email.status,
                                    createdBy: userEmail,
                                    CustomerMasterSid: customer.CustomerMasterSid,
                                    CustomerBranchSid: branchId,
                                    CompanyMasterSid: customer.CompanyMasterSid
                                }
                            });
                        }
                    }
                } else {
                    await tx.customerBrEmail.updateMany({
                        where: { CustomerBranchSid: branchId, status: 'A' },
                        data: { status: 'D' }
                    });
                }

                // 6️⃣ Handle CustomerLogin
                if (branch.customerBranchLogins && branch.customerBranchLogins.length > 0) {
                    const existingLogins = await tx.customerLogin.findMany({
                        where: { CustomerBranchSid: branchId, status: 'A' },
                        select: { CustomerLoginSid: true }
                    });

                    const incomingLoginIds = branch.customerBranchLogins
                        .filter(l => l.CustomerLoginSid)
                        .map(l => l.CustomerLoginSid);

                    const loginIdsToDelete = existingLogins
                        .filter(el => !incomingLoginIds.includes(el.CustomerLoginSid))
                        .map(el => el.CustomerLoginSid);

                    if (loginIdsToDelete.length > 0) {
                        await tx.customerLogin.updateMany({
                            where: { CustomerLoginSid: { in: loginIdsToDelete } },
                            data: { status: 'D' ,updatedBy: userEmail,updatedOn: new Date()}
                        });
                    }

                    for (const login of branch.customerBranchLogins) {
                        if (login.CustomerLoginSid) {
                            await tx.customerLogin.update({
                                where: { CustomerLoginSid: login.CustomerLoginSid },
                                data: {
                                    CustomerBranchSid: branchId,
                                    LoginName: login.LoginName,
                                    LoginEmail: login.LoginEmail,
                                    LoginPassword: login.LoginPassword,
                                    status: login.status,
                                    updatedBy: userEmail,
                                    updatedOn: new Date()
                                }
                            });
                        } else {
                            await tx.customerLogin.create({
                                data: {
                                    LoginName: login.LoginName,
                                    LoginEmail: login.LoginEmail,
                                    LoginPassword: login.LoginPassword,
                                    status: login.status,
                                    createdBy: userEmail,
                                    CustomerMasterSid: customer.CustomerMasterSid,
                                    CustomerBranchSid: branchId,
                                    CompanyMasterSid: customer.CompanyMasterSid
                                }
                            });
                        }
                    }
                } else {
                    await tx.customerLogin.updateMany({
                        where: { CustomerBranchSid: branchId, status: 'A' },
                        data: { status: 'D' }
                    });
                }

                // 7️⃣ Handle CustomerSalesTeam
                if (branch.customerSalesTeams && branch.customerSalesTeams.length > 0) {
                    const existingSalesTeams = await tx.customerSalesTeam.findMany({
                        where: { CustomerBranchSid: branchId, status: 'A' },
                        select: { CustomerSalesSid: true }
                    });

                    const incomingSalesIds = branch.customerSalesTeams
                        .filter(s => s.CustomerSalesSid)
                        .map(s => s.CustomerSalesSid);

                    const salesIdsToDelete = existingSalesTeams
                        .filter(es => !incomingSalesIds.includes(es.CustomerSalesSid))
                        .map(es => es.CustomerSalesSid);

                    if (salesIdsToDelete.length > 0) {
                        await tx.customerSalesTeam.updateMany({
                            where: { CustomerSalesSid: { in: salesIdsToDelete } },
                            data: { status: 'D',updatedBy: userEmail ,updatedOn: new Date()}
                        });
                    }

                    for (const sales of branch.customerSalesTeams) {
                        if (sales.CustomerSalesSid) {
                            await tx.customerSalesTeam.update({
                                where: { CustomerSalesSid: sales.CustomerSalesSid },
                                data: {
                                    CustomerBranchSid: branchId,
                                    DepartmentMasterSid: sales.DepartmentMasterSid, // Array of integers
                                    Salesman: sales.Salesman,
                                    CSPerson: sales.CSPerson,
                                    DocPerson: sales.DocPerson,
                                    EffectiveFrom: sales.EffectiveFrom,
                                    status: sales.status,
                                    updatedBy: userEmail,
                                    updatedOn: new Date()
                                }
                            });
                        } else {
                            await tx.customerSalesTeam.create({
                                data: {
                                    DepartmentMasterSid: sales.DepartmentMasterSid, // Array of integers
                                    Salesman: sales.Salesman,
                                    CSPerson: sales.CSPerson,
                                    DocPerson: sales.DocPerson,
                                    EffectiveFrom: sales.EffectiveFrom,
                                    status: sales.status,
                                    createdBy: userEmail,
                                    CustomerMasterSid: customer.CustomerMasterSid,
                                    CustomerBranchSid: branchId,
                                    CompanyMasterSid: customer.CompanyMasterSid
                                }
                            });
                        }
                    }
                } else {
                    await tx.customerSalesTeam.updateMany({
                        where: { CustomerBranchSid: branchId, status: 'A' },
                        data: { status: 'D' }
                    });
                }

                // 8️⃣ Handle CustomerMilestone
                if (branch.customerMilestones && branch.customerMilestones.length > 0) {
                    const existingMilestones = await tx.customerMilestone.findMany({
                        where: { CustomerBranchSid: branchId, Status: 'A' },
                        select: { CustomerMilestoneSid: true }
                    });

                    const incomingMilestoneIds = branch.customerMilestones
                        .filter(m => m.CustomerMilestoneSid)
                        .map(m => m.CustomerMilestoneSid);

                    const milestoneIdsToDelete = existingMilestones
                        .filter(em => !incomingMilestoneIds.includes(em.CustomerMilestoneSid))
                        .map(em => em.CustomerMilestoneSid);

                    if (milestoneIdsToDelete.length > 0) {
                        await tx.customerMilestone.updateMany({
                            where: { CustomerMilestoneSid: { in: milestoneIdsToDelete } },
                            data: { Status: 'D' ,UpdatedBy: userEmail, UpdatedOn: new Date()}
                        });
                    }

                    for (const milestone of branch.customerMilestones) {
                        if (milestone.CustomerMilestoneSid) {
                            await tx.customerMilestone.update({
                                where: { CustomerMilestoneSid: milestone.CustomerMilestoneSid },
                                data: {
                                    MilestoneMasterSid: milestone.MilestoneMasterSid,
                                    UpdateType: milestone.UpdateType,
                                    ContactInfo: milestone.ContactInfo,
                                    EffectiveFrom: milestone.EffectiveFrom,
                                    Status: milestone.Status,
                                    UpdatedBy: userEmail,
                                    UpdatedOn: new Date()
                                }
                            });
                        } else {
                            await tx.customerMilestone.create({
                                data: {
                                    MilestoneMasterSid: milestone.MilestoneMasterSid,
                                    UpdateType: milestone.UpdateType,
                                    ContactInfo: milestone.ContactInfo,
                                    EffectiveFrom: milestone.EffectiveFrom,
                                    Status: milestone.Status,
                                    CreatedBy: userEmail,
                                    CustomerMasterSid: customer.CustomerMasterSid,
                                    CustomerBranchSid: branchId
                                }
                            });
                        }
                    }
                } else {
                    await tx.customerMilestone.updateMany({
                        where: { CustomerBranchSid: branchId, Status: 'A' },
                        data: { Status: 'D' }
                    });
                }

                if(branch.status === "S"){
                    await Promise.all([
                    tx.cusBranchContact.updateMany({
                        where: { CustomerBranchSid: branch.CustomerBranchSid },
                        data: { status: 'S' },
                    }),
                    tx.customerBrEmail.updateMany({
                        where: { CustomerBranchSid: branch.CustomerBranchSid },
                        data: { status: 'S' },
                    }),
                    tx.customerLogin.updateMany({
                        where: { CustomerBranchSid: branch.CustomerBranchSid },
                        data: { status: 'S' },
                    }),
                    tx.customerSalesTeam.updateMany({
                        where: { CustomerBranchSid: branch.CustomerBranchSid },
                        data: { status: 'S' },
                    }),
                    tx.customerMilestone.updateMany({
                        where: { CustomerBranchSid: branch.CustomerBranchSid },
                        data: { Status: 'S' },
                    }),
                ]);
                } 
            }


            return customer;
        });
    }

    async softDelete(CustomerMasterSid: number) {
        const existingCustomer = await this._db.customerMaster.findUnique({
            where: { CustomerMasterSid: CustomerMasterSid }
        });

        if (!existingCustomer) {
            throw new NotFoundException(`Customer with ID ${CustomerMasterSid} not found`);
        }

        if (existingCustomer.status === 'D') {
            throw new BadRequestException(`Customer with ID ${CustomerMasterSid} is already deleted`);
        }

        const result = await this._db.$transaction(async (prisma) => {
            const deletedCustomer = await prisma.customerMaster.update({
                where: {
                    CustomerMasterSid: CustomerMasterSid,
                    status: 'A'
                },
                data: {
                    status: 'S',
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
                            status: 'S'
                        }
                    })

                    const deleteCusBranchContact = await prisma.cusBranchContact.updateManyAndReturn({
                        where: {
                            CustomerBranchSid: deletedCusBranch.CustomerBranchSid,
                            status: 'A'
                        },
                        data: {
                            status: 'S'
                        }
                    })

                    const deleteCusBranchEmail = await prisma.customerBrEmail.updateManyAndReturn({
                        where: {
                            CustomerBranchSid: branch.CustomerBranchSid,
                            status: 'A'
                        },
                        data: {
                            status: 'S'
                        }
                    })

                    const deleteCusBranchLogin = await prisma.customerLogin.updateManyAndReturn({
                        where: {
                            CustomerBranchSid: branch.CustomerBranchSid,
                            status: 'A'
                        },
                        data: {
                            status: 'S'
                        }
                    })

                    const deleteCusSalesTeam = await prisma.customerSalesTeam.updateManyAndReturn({
                        where: {
                            CustomerBranchSid: branch.CustomerBranchSid,
                            status: 'A'
                        },
                        data: {
                            status: 'S'
                        }
                    })

                    const deleteCusMilestone = await prisma.customerMilestone.updateManyAndReturn({
                        where: {
                            CustomerBranchSid: branch.CustomerBranchSid,
                            Status: 'A'
                        },
                        data: {
                            Status: 'S'
                        }
                    })

                    return {
                        ...deletedCusBranch,
                        CustomerBranchContact: deleteCusBranchContact,
                        CustomerBranchEmail: deleteCusBranchEmail,
                        CustomerBranchLogin: deleteCusBranchLogin,
                        CustomerSalesTeam: deleteCusSalesTeam,
                        CustomerMilestone: deleteCusMilestone
                    }
                }))

            return {
                deletedCustomer,
                deletedCustomerBranch: allCusBranchesWithChild
            }
        })

        return result
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
                orderBy: { CustomerMasterSid: 'desc' },
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
    async searchCustomersByName(
        CompanyMasterSid: number,
        searchTerm: string,
        excludeCustomerMasterSids: number[] = []
    ) {
        try {
            this.logger.log(`searchCustomersByName service called: ${CompanyMasterSid}, ${searchTerm}, ${excludeCustomerMasterSids}`);

            if (!searchTerm || searchTerm.trim().length === 0) {
                return [];
            }

            const searchText = searchTerm.trim();

            const where: Prisma.CustomerMasterWhereInput = {
                CompanyMasterSid: CompanyMasterSid,
                status: 'A',
                CustomerName: {
                    contains: searchText,
                    mode: 'insensitive'
                }
            };

            // Exclude already selected customers if provided
            if (excludeCustomerMasterSids && excludeCustomerMasterSids.length > 0) {
                where.CustomerMasterSid = {
                    notIn: excludeCustomerMasterSids
                };
            }

            const customers = await this._db.customerMaster.findMany({
                where,
                select: {
                    CustomerMasterSid: true,
                    CustomerName: true,
                    CustomerShortCode: true
                },
                take: 50, // Limit results
                orderBy: {
                    CustomerName: 'asc'
                }
            });

            this.logger.log(`searchCustomersByName found ${customers.length} customers`);
            return customers;
        } catch (error) {
            this.logger.error(`searchCustomersByName service error: ${error}`);
            throw new BadRequestException('Error searching customers by name');
        }
    }
    // async getAllShippers(CompanyMasterSid: number) {
    //     try {
    //         const allAgents = await this._db.customerMaster.findMany({
    //             where: {
    //                 CustomerType: {
    //                     path: ['shipper'],
    //                     equals: 'isTrue'
    //                 },
    //                 status: 'A',
    //                 CompanyMasterSid: CompanyMasterSid
    //             }
    //         })
    //         return allAgents;
    //     } catch (error) {
    //         throw error;
    //     }
    // }
    // async getAllConsignee(CompanyMasterSid: number) {
    //     try {
    //         const allAgents = await this._db.customerMaster.findMany({
    //             where: {
    //                 CustomerType: {
    //                     path: ['consignee'],
    //                     equals: 'isTrue'
    //                 },
    //                 status: 'A',
    //                 CompanyMasterSid: CompanyMasterSid
    //             }
    //         })
    //         return allAgents;
    //     } catch (error) {
    //         throw error;
    //     }
    // }
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
    // async getAllCFS(CompanyMasterSid: number) {
    //     try {
    //         const allAgents = await this._db.customerMaster.findMany({
    //             where: {
    //                 CustomerType: {
    //                     path: ['cFS'],
    //                     equals: 'isTrue'
    //                 },
    //                 status: 'A',
    //                 CompanyMasterSid: CompanyMasterSid
    //             }
    //         })
    //         return allAgents;
    //     } catch (error) {
    //         throw error;
    //     }
    // }

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


    async getCustomerByType(CompanyMasterSid: number, types?: string[]) {
        try {
            if (!types || types.length === 0) {
                // If no types provided, return all active customers for the company
                return this._db.customerMaster.findMany({
                    where: {
                        status: 'A',
                        CompanyMasterSid,
                    },
                });
            }

            // If types provided, build OR conditions dynamically
            const jsonFilters = types.map(type => ({
                CustomerType: { path: [type], equals: 'isTrue' }
            }));

            const customers = await this._db.customerMaster.findMany({
                where: {
                    status: 'A',
                    CompanyMasterSid,
                    OR: jsonFilters
                },
                include: {
                    CustomerBranch : true,
                    countryMaster: {
                        select: {
                            countryName: true,
                            countryCode: true
                        }
                    }
                }
            });

            const formattedCustomerList = customers.flatMap(cus =>{
                return cus.CustomerBranch.map(branch => ({
                    CustomerMasterSid: cus.CustomerMasterSid,
                    CustomerName: cus.CustomerName,
                    CustomerType : cus.CustomerType,
                    CustomerAddress1 : cus.CustomerAddress1,
                    CustomerBranchSid: branch.CustomerBranchSid,
                    BranchName: branch.BranchName,
                    Address: branch.Address,
                    Email: branch.Email,
                    AirlineCode: cus.AirlineCode,
                    AirlineNumber: cus.AirlineNumber,
                    countryName: cus.countryMaster?.countryName,
                   Countrycode: cus.countryMaster?.countryCode
                    
                }))
            })

            return formattedCustomerList;
        } catch (error) {
            throw error;
        }
    }

}

