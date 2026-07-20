import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { LeadStatus, Prisma, UserTypeCode } from '@prisma/client';
import { encodePassword, statusWhereClause } from 'src/common/helper';
import { DatabaseService } from 'src/database/database.service';
import { SearchListDto } from 'src/masters/DTO/search-list.dto';
import { filterDto } from 'src/masters/DTO/search-vessel.dto';
import { CreateUpdateCustomerDto, BulkCreateUpdateCustomerDto } from 'src/masters/DTO/customer.dto';
import { assertNoDuplicateCustomerMilestones } from '../customer-milestone/customer-milestone.helper';
import * as ExcelJS from 'exceljs';
import * as XLSX from 'xlsx';

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
                            const loginEmail = login.LoginEmail?.trim();

                            // Reject duplicate login email (case-insensitive, ignoring deleted logins)
                            const duplicateLogin = await tx.customerLogin.findFirst({
                                where: {
                                    LoginEmail: { equals: loginEmail, mode: 'insensitive' },
                                    status: { not: 'D' }
                                }
                            });
                            if (duplicateLogin) {
                                throw new ConflictException(`A login with the email '${loginEmail}' already exists.`);
                            }

                            const branchLogin = await tx.customerLogin.create({
                                data: {
                                    LoginName: login.LoginName,
                                    LoginEmail: loginEmail,
                                    LoginPassword: await encodePassword(login.LoginPassword),
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
                        await assertNoDuplicateCustomerMilestones(tx, branch.customerMilestones, {
                            CustomerMasterSid: customer.CustomerMasterSid,
                            CustomerBranchSid: branchId
                        });

                        for (const milestone of branch.customerMilestones) {
                            const customerMilestone = await tx.customerMilestone.create({
                                data: {
                                    MilestoneMasterSid: milestone.MilestoneMasterSid,
                                    UpdateType: milestone.UpdateType,
                                    ContactInfo: milestone.ContactInfo,
                                    Email: milestone.Email ?? null,
                                    MobileNo: milestone.MobileNo ?? null,
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

    async findOne(CustomerMasterSid: number, CompanyMasterSid: number) {
        try {
            const customerData: any = await this._db.customerMaster.findUnique({
                where: {
                    CustomerMasterSid: CustomerMasterSid,
                    CompanyMasterSid: CompanyMasterSid,
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
                            Email: true,
                            MobileNo: true,
                            EffectiveFrom: true,
                            Status: true
                        }
                    }
                }
            });
            if (!customerData) {
                throw new UnauthorizedException('Access denied.');
            }
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

            // Never expose stored login passwords. Return a masked placeholder so the
            // edit screen keeps the existing (hashed) password unless the user types a
            // new one — same convention as userMaster's userPassword.
            customerData.CustomerLogin = (customerData?.CustomerLogin || []).map((login: any) => ({
                ...login,
                LoginPassword: login.LoginPassword ? '*******' : ''
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
                    countryMaster: {
                        select: {
                            CountryMasterSid: true,
                            countryName: true
                        }
                    }
                }
            });
            const formattedCustomerList = customerList.map(customer => ({
                CustomerMasterSid: customer.CustomerMasterSid,
                CustomerName: customer.CustomerName,
                PanType: customer.PanType,
                PanName: customer.PanName,
                CompanyType: customer.CompanyType,
                RegistrationNo: customer.RegistrationNo,
                CountryMasterSid: customer.countryMaster?.CountryMasterSid,
                CountryName: customer.countryMaster?.countryName,
            }));
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
                        const loginEmail = login.LoginEmail?.trim();
                        if (login.CustomerLoginSid) {
                            // Reject duplicate email held by a different (non-deleted) login
                            const duplicateLogin = await tx.customerLogin.findFirst({
                                where: {
                                    LoginEmail: { equals: loginEmail, mode: 'insensitive' },
                                    status: { not: 'D' },
                                    CustomerLoginSid: { not: login.CustomerLoginSid }
                                }
                            });
                            if (duplicateLogin) {
                                throw new ConflictException(`A login with the email '${loginEmail}' already exists.`);
                            }

                            await tx.customerLogin.update({
                                where: { CustomerLoginSid: login.CustomerLoginSid },
                                data: {
                                    CustomerBranchSid: branchId,
                                    LoginName: login.LoginName,
                                    LoginEmail: loginEmail,
                                    // Keep the existing password when the masked placeholder
                                    // comes back unchanged; hash any newly typed password.
                                    ...(login.LoginPassword && login.LoginPassword !== '*******'
                                        ? { LoginPassword: await encodePassword(login.LoginPassword) }
                                        : {}),
                                    status: login.status,
                                    updatedBy: userEmail,
                                    updatedOn: new Date()
                                }
                            });
                        } else {
                            // Reject duplicate email for a brand-new login
                            const duplicateLogin = await tx.customerLogin.findFirst({
                                where: {
                                    LoginEmail: { equals: loginEmail, mode: 'insensitive' },
                                    status: { not: 'D' }
                                }
                            });
                            if (duplicateLogin) {
                                throw new ConflictException(`A login with the email '${loginEmail}' already exists.`);
                            }

                            await tx.customerLogin.create({
                                data: {
                                    LoginName: login.LoginName,
                                    LoginEmail: loginEmail,
                                    LoginPassword: await encodePassword(login.LoginPassword),
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

                    await assertNoDuplicateCustomerMilestones(tx, branch.customerMilestones, {
                        CustomerMasterSid: customer.CustomerMasterSid,
                        CustomerBranchSid: branchId
                    });

                    for (const milestone of branch.customerMilestones) {
                        if (milestone.CustomerMilestoneSid) {
                            await tx.customerMilestone.update({
                                where: { CustomerMilestoneSid: milestone.CustomerMilestoneSid },
                                data: {
                                    MilestoneMasterSid: milestone.MilestoneMasterSid,
                                    UpdateType: milestone.UpdateType,
                                    ContactInfo: milestone.ContactInfo,
                                    Email: milestone.Email ?? null,
                                    MobileNo: milestone.MobileNo ?? null,
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
                                    Email: milestone.Email ?? null,
                                    MobileNo: milestone.MobileNo ?? null,
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

    async softDelete(CustomerMasterSid: number, user?: any) {
        const userEmail = user?.UserEmail || user?.email || user?.userEmail;

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
            // Delete = soft delete to 'D' (not 'S'), so the record is hidden from
            // the list and its login emails are freed for reuse. No status:'A'
            // filter here — an already-suspended customer must still be deletable.
            const deletedCustomer = await prisma.customerMaster.update({
                where: {
                    CustomerMasterSid: CustomerMasterSid
                },
                data: {
                    status: 'D',
                    updatedBy: userEmail,
                    updatedOn: new Date()
                }
            })

            const allCustomerBranches = await prisma.customerBranch.findMany({
                where: {
                    CustomerMasterSid: CustomerMasterSid,
                    status: { not: 'D' }
                }
            })

            const allCusBranchesWithChild = await Promise.all(
                allCustomerBranches.map(async branch => {
                    const deletedCusBranch = await prisma.customerBranch.update({
                        where: {
                            CustomerBranchSid: branch.CustomerBranchSid
                        },
                        data: {
                            status: 'D',
                            updatedBy: userEmail,
                            updatedOn: new Date()
                        }
                    })

                    const deleteCusBranchContact = await prisma.cusBranchContact.updateManyAndReturn({
                        where: {
                            CustomerBranchSid: deletedCusBranch.CustomerBranchSid,
                            status: { not: 'D' }
                        },
                        data: {
                            status: 'D',
                            updatedBy: userEmail,
                            updatedOn: new Date()
                        }
                    })

                    const deleteCusBranchEmail = await prisma.customerBrEmail.updateManyAndReturn({
                        where: {
                            CustomerBranchSid: branch.CustomerBranchSid,
                            status: { not: 'D' }
                        },
                        data: {
                            status: 'D',
                            updatedBy: userEmail,
                            updatedOn: new Date()
                        }
                    })

                    const deleteCusBranchLogin = await prisma.customerLogin.updateManyAndReturn({
                        where: {
                            CustomerBranchSid: branch.CustomerBranchSid,
                            status: { not: 'D' }
                        },
                        data: {
                            status: 'D',
                            updatedBy: userEmail,
                            updatedOn: new Date()
                        }
                    })

                    const deleteCusSalesTeam = await prisma.customerSalesTeam.updateManyAndReturn({
                        where: {
                            CustomerBranchSid: branch.CustomerBranchSid,
                            status: { not: 'D' }
                        },
                        data: {
                            status: 'D',
                            updatedBy: userEmail,
                            updatedOn: new Date()
                        }
                    })

                    const deleteCusMilestone = await prisma.customerMilestone.updateManyAndReturn({
                        where: {
                            CustomerBranchSid: branch.CustomerBranchSid,
                            Status: { not: 'D' }
                        },
                        data: {
                            Status: 'D',
                            UpdatedBy: userEmail,
                            UpdatedOn: new Date()
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

    /**
     * Validates that a customer has the KYC details required before a booking can be created:
     *  1. A branch is selected (CustomerBranchSid provided)
     *  2. The branch exists and is active for this customer
     *  3. The branch has a GST / VAT number on file
     *  4. A SubledgerMaster record exists for this customer
     *  5. The SubledgerMaster has DrCOAMasterSid mapped
     *
     * Returns { valid: true } when all checks pass, or { valid: false, message, errorType } describing the first failed check.
     */
    async validateCustomerForBooking(
        customerMasterSid: number,
    ): Promise<{ valid: boolean; message: string; errorType: 'branch' | 'subledger_missing' | 'subledger_no_dr_coa' | null }> {
        if (!customerMasterSid) {
            return { valid: false, message: 'Customer information is missing.', errorType: null };
        }

        const branch = await this._db.customerBranch.findFirst({
            where: { CustomerMasterSid: customerMasterSid, status: 'A' },
            select: { CustomerBranchSid: true },
        });

        if (!branch) {
            return {
                valid: false,
                message: 'Customer does not have a branch set up. Please add a branch before creating a booking.',
                errorType: 'branch',
            };
        }

        const subledger = await this._db.subledgerMaster.findFirst({
            where: {
                SubledgerMappingSid: customerMasterSid,
                SubledgerType: 'Customer',
                Status: 'A',
            },
            select: { SubledgerMasterSid: true, DrCOAMasterSid: true },
        });

        if (!subledger) {
            return {
                valid: false,
                message: 'No subledger account found for this customer. Please create a subledger mapping before proceeding.',
                errorType: 'subledger_missing',
            };
        }

        if (!subledger.DrCOAMasterSid) {
            return {
                valid: false,
                message: 'The customer subledger account does not have a Debtor COA mapped. Please map the Debtor COA before proceeding.',
                errorType: 'subledger_no_dr_coa',
            };
        }

        return { valid: true, message: '', errorType: null };
    }

    // ══════════════════════════════════════════════════════════════════════════════
// EXCEL TEMPLATE GENERATOR — Customer + Branch only
// ══════════════════════════════════════════════════════════════════════════════
async generateCustomerTemplate(CompanyMasterSid: number): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();

    // ── Fetch lookup data ──────────────────────────────────────────────────────
    const [countries, currencies, networks, states, cities] = await Promise.all([
        this._db.countryMaster.findMany({
            where: { status: 'A' },
            select: { CountryMasterSid: true, countryName: true, countryCode: true }
        }),
        this._db.currencyMaster.findMany({
            where: { status: 'A' },
            select: { CurrencyMasterSid: true, currencyCode: true }
        }),
        this._db.networkMaster.findMany({
            where: { Status: 'A' },
            select: { NetworkMasterSid: true, NetworkName: true }
        }),
        this._db.stateMaster.findMany({
            where: { status: 'A' },
            select: { StateMasterSid: true, stateName: true }
        }),
        this._db.cityMaster.findMany({
            where: { status: 'A' },
            select: { CityMasterSid: true, cityName: true, StateMasterSid: true }
        }),
    ]);

    const organizationTypeOptions = [
        'Agent', 'Air Line', 'Carrier', 'CFS', 'Consignee', 'Customer',
        'Feeder', 'Forwarder', 'NVOCC', 'Notify', 'Overseas Agent',
        'Shipper', 'Shipping Line', 'Transporter', 'Vendor', 'Warehouse', 'Yard'
    ];

    const companyTypeOptions = [
        'Artificial Juridical Person', 'Association Of Persons(AOP)', 'Body Of Individuals',
        'Company', 'Firm', 'Government Agency', 'Individual(proprietor)',
        'Limited Liability Company(LLC)', 'Limited Liability Partnership(LLP)', 'Local Authority'
    ];

    // ══════════════════════════════════════════════════════════════════════════
    // SHEET 1 — CUSTOMERS
    // ══════════════════════════════════════════════════════════════════════════
    const customerSheet = workbook.addWorksheet('Customers');

    // A  Customer Name   — mandatory
    // B  Code
    // C  Country         — mandatory, dropdown
    // D  Currency        — dropdown
    // E  Organization Type — free-text, comma-separated
    // F  Alias
    // G  Group Name
    // H  Address1        — mandatory
    // I  Address2
    // J  Website
    // K  CashCredit      — dropdown: Cash / Credit
    // L  Network         — dropdown
    // M  CIN
    // N  TAN
    // O  Remarks
    // P  Registration No
    // Q  Company Type    — dropdown
    // R  VAT Available   — Y/N
    // S  VAT No
    // T  Name as per VAT
    const customerHeaders = [
        'Customer Name',       // A — mandatory
        'Code',                // B
        'Country',             // C — mandatory, dropdown
        'Currency',            // D — dropdown
        'Organization Type',   // E — comma separated
        'Alias',               // F
        'Group Name',          // G
        'Address1',            // H — mandatory
        'Address2',            // I
        'Website',             // J
        'CashCredit',          // K — dropdown: Cash / Credit
        'Network',             // L — dropdown
        'CIN',                 // M
        'TAN',                 // N
        'Remarks',             // O
        'Registration No',     // P
        'Company Type',        // Q — dropdown
        'VAT Available',       // R — Y/N
        'VAT No',              // S
        'Name as per VAT',     // T
    ];
    customerSheet.addRow(customerHeaders);

    // Header styling — mandatory = red, optional = orange
    const custHeaderRow = customerSheet.getRow(1);
    custHeaderRow.font = { bold: true };
    custHeaderRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E0E0' } };
    custHeaderRow.height = 20;

    ['A', 'C', 'H'].forEach(col => {
        const cell = customerSheet.getCell(`${col}1`);
        cell.font = { bold: true, color: { argb: 'FFFF0000' } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFE5E5' } };
    });
    ['B', 'D', 'E', 'F', 'G', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T'].forEach(col => {
        const cell = customerSheet.getCell(`${col}1`);
        cell.font = { bold: true, color: { argb: 'FFD97706' } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF7E5' } };
    });

    // Example rows
    const customerExamples = [
        [
            'ABC Corporation',          // A Customer Name
            'ABC',                      // B Code
            'India',                    // C Country
            'INR',                      // D Currency
            'Customer,Shipper',         // E Organization Type
            'ABC Corp',                 // F Alias
            'ABC Group',                // G Group Name
            '123 Main Street',          // H Address1
            'Suite 100',                // I Address2
            'www.abc.com',              // J Website
            'Credit',                   // K CashCredit
            '',                         // L Network
            'U12345MH2020PTC123456',    // M CIN
            'ABCD12345E',               // N TAN
            'Sample customer',          // O Remarks
            'REG12345',                 // P Registration No
            'Company',                  // Q Company Type
            'Y',                        // R VAT Available
            'ABCDE1234F',               // S VAT No
            'ABC Corp',                 // T Name as per VAT
        ],
        [
            'XYZ Enterprises',          // A Customer Name
            'XYZ',                      // B Code
            'India',                    // C Country
            'INR',                      // D Currency
            'Vendor',                   // E Organization Type
            '',                         // F Alias
            '',                         // G Group Name
            '456 Park Avenue',          // H Address1
            '',                         // I Address2
            '',                         // J Website
            'Cash',                     // K CashCredit
            '',                         // L Network
            '',                         // M CIN
            '',                         // N TAN
            '',                         // O Remarks
            '',                         // P Registration No
            'Firm',                     // Q Company Type
            'N',                        // R VAT Available
            '',                         // S VAT No
            '',                         // T Name as per VAT
        ],
    ];
    customerExamples.forEach(rowData => {
        const r = customerSheet.addRow(rowData);
        r.eachCell(cell => {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEAF2FB' } };
            cell.font = { italic: true, color: { argb: 'FF555555' } };
        });
        r.commit();
    });

    // Column widths
    [28, 14, 16, 12, 32, 20, 16, 28, 20, 22, 12, 18, 26, 16, 24, 16, 28, 14, 18, 24]
        .forEach((w, i) => { customerSheet.getColumn(i + 1).width = w; });

    // ══════════════════════════════════════════════════════════════════════════
    // SHEET 2 — BRANCHES
    // ══════════════════════════════════════════════════════════════════════════
    const branchSheet = workbook.addWorksheet('Branches');

    // A  Customer Name   — mandatory, dropdown from Customers sheet
    // B  Branch Name     — mandatory
    // C  Branch Type     — mandatory, dropdown: HeadQuarters / BRANCH
    // D  Branch Code
    // E  State           — mandatory, dropdown from state master
    // F  City            — mandatory, dropdown from city master
    // G  Contact Person
    // H  Phone
    // I  Email
    // J  Address         — mandatory
    // K  Zip/Post Code
    // L  Registered      — dropdown: Y / N
    const branchHeaders = [
        'Customer Name',       // A — mandatory
        'Branch Name',         // B — mandatory
        'Branch Type',         // C — mandatory, dropdown
        'Branch Code',         // D
        'State',               // E — mandatory, dropdown
        'City',                // F — mandatory, dropdown
        'Contact Person',      // G
        'Phone',               // H
        'Email',               // I
        'Address',             // J — mandatory
        'Zip/Post Code',       // K
        'Registered',          // L — dropdown: Y / N
    ];
    branchSheet.addRow(branchHeaders);

    const branchHeaderRow = branchSheet.getRow(1);
    branchHeaderRow.font = { bold: true };
    branchHeaderRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E0E0' } };
    branchHeaderRow.height = 20;

    ['A', 'B', 'C', 'E', 'F', 'J'].forEach(col => {
        const cell = branchSheet.getCell(`${col}1`);
        cell.font = { bold: true, color: { argb: 'FFFF0000' } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFE5E5' } };
    });
    ['D', 'G', 'H', 'I', 'K', 'L'].forEach(col => {
        const cell = branchSheet.getCell(`${col}1`);
        cell.font = { bold: true, color: { argb: 'FFD97706' } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF7E5' } };
    });

    const branchExamples = [
        ['ABC Corporation', 'Head Office',   'HeadQuarters', 'HO001',  'Maharashtra', 'Mumbai',    'John Doe',   '9876543210', 'ho@abc.com',    '123 Main Street, Mumbai',    '400001', 'Y'],
        ['ABC Corporation', 'Delhi Branch',  'BRANCH',       'DEL001', 'Delhi',       'New Delhi',  'Jane Smith', '9876543211', 'delhi@abc.com', '456 Park Avenue, Delhi',     '110001', 'Y'],
        ['XYZ Enterprises', 'Main Branch',   'HeadQuarters', 'MAIN001','Karnataka',   'Bengaluru',  '',           '9876543212', 'main@xyz.com',  '789 Ring Road, Bengaluru',   '560001', 'N'],
    ];
    branchExamples.forEach(rowData => {
        const r = branchSheet.addRow(rowData);
        r.eachCell(cell => {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEAF2FB' } };
            cell.font = { italic: true, color: { argb: 'FF555555' } };
        });
        r.commit();
    });

    [28, 20, 16, 14, 18, 18, 18, 16, 28, 32, 14, 12]
        .forEach((w, i) => { branchSheet.getColumn(i + 1).width = w; });

    // ══════════════════════════════════════════════════════════════════════════
    // HIDDEN REFERENCE SHEETS
    // ══════════════════════════════════════════════════════════════════════════
    const addRef = (name: string, values: string[]) => {
        const ws = workbook.addWorksheet(name);
        ws.addRow(['Value']);
        values.forEach(v => ws.addRow([v]));
        ws.state = 'hidden';
        return ws;
    };

    addRef('_Countries',    countries.map(x => x.countryName));
    addRef('_Currencies',   currencies.map(x => x.currencyCode));
    addRef('_Networks',     networks.map(x => x.NetworkName));
    addRef('_States',       states.map(x => x.stateName));
    addRef('_Cities',       cities.map(x => x.cityName));
    addRef('_OrgTypes',     organizationTypeOptions);
    addRef('_CompanyTypes', companyTypeOptions);
    addRef('_BranchTypes',  ['HeadQuarters', 'BRANCH']);
    addRef('_CashCredit',   ['Cash', 'Credit']);
    addRef('_YesNo',        ['Y', 'N']);

    // ══════════════════════════════════════════════════════════════════════════
    // APPLY DROPDOWNS
    // ══════════════════════════════════════════════════════════════════════════
    const applyDV = (
        sheet: ExcelJS.Worksheet,
        col: string,
        refSheet: string,
        count: number,
        startRow = 4
    ) => {
        const formula = `'${refSheet}'!$A$2:$A$${count + 1}`;
        for (let r = startRow; r <= 3000; r++) {
            sheet.getCell(`${col}${r}`).dataValidation = {
                type: 'list', allowBlank: true,
                formulae: [formula],
                showErrorMessage: true,
                errorTitle: 'Invalid value',
                error: 'Please select a value from the dropdown list'
            };
        }
    };

    // ── Customer sheet dropdowns ───────────────────────────────────────────
    applyDV(customerSheet, 'C', '_Countries',    countries.length);           // Country
    applyDV(customerSheet, 'D', '_Currencies',   currencies.length);          // Currency
    applyDV(customerSheet, 'K', '_CashCredit',   2);                          // CashCredit
    applyDV(customerSheet, 'L', '_Networks',     networks.length);            // Network
    applyDV(customerSheet, 'Q', '_CompanyTypes', companyTypeOptions.length);  // Company Type
    applyDV(customerSheet, 'R', '_YesNo',        2);                          // VAT Available

    // ── Branch sheet dropdowns ─────────────────────────────────────────────
    applyDV(branchSheet, 'C', '_BranchTypes', 2);                // Branch Type
    applyDV(branchSheet, 'E', '_States',      states.length);    // State
    applyDV(branchSheet, 'F', '_Cities',      cities.length);    // City
    applyDV(branchSheet, 'L', '_YesNo',       2);                // Registered

    // Branch → Customer Name must match Customers sheet (dynamic list)
    for (let r = 4; r <= 3000; r++) {
        branchSheet.getCell(`A${r}`).dataValidation = {
            type: 'list', allowBlank: true,
            formulae: [`OFFSET(Customers!$A$4,0,0,COUNTA(Customers!$A$4:$A$3002),1)`],
            showErrorMessage: true,
            errorTitle: 'Invalid Customer Name',
            error: 'Please select a Customer Name that exists in the Customers sheet'
        };
    }

    // ══════════════════════════════════════════════════════════════════════════
    // INSTRUCTIONS SHEET
    // ══════════════════════════════════════════════════════════════════════════
    const inst = workbook.addWorksheet('Instructions');
    [
        ['Customer / Organization Bulk Upload Template — Instructions'],
        [],
        ['SHEET OVERVIEW'],
        ['  Customers  — Enter one customer per row (mandatory)'],
        ['  Branches   — Enter one branch per row, linked to a customer by Customer Name'],
        [],
        ['HOW TO USE'],
        ['  1. Fill the Customers sheet first (one row per customer)'],
        ['  2. Go to Branches — select Customer Name from dropdown, fill branch details'],
        ['  3. Multiple branches can be linked to the same customer by repeating the Customer Name'],
        ['  4. Rows 2–3 in each sheet are EXAMPLES — do not edit or delete them'],
        ['  5. Enter your data starting from Row 4'],
        ['  6. Status is automatically set to Active — no need to fill it'],
        [],
        ['CUSTOMERS SHEET — MANDATORY FIELDS (red header)'],
        ['  Customer Name   — must be unique, max 200 chars'],
        ['  Country         — select from dropdown'],
        ['  Address1        — primary address line'],
        [],
        ['CUSTOMERS SHEET — OPTIONAL FIELDS (orange header)'],
        ['  Code            — unique short code, max 20 chars'],
        ['  Currency        — select from dropdown (auto-detected from Country if blank)'],
        ['  Organization Type — comma-separated list. Valid values:'],
        ['    Agent, Air Line, Carrier, CFS, Consignee, Customer, Feeder, Forwarder,'],
        ['    NVOCC, Notify, Overseas Agent, Shipper, Shipping Line, Transporter,'],
        ['    Vendor, Warehouse, Yard'],
        ['  CashCredit      — Cash or Credit (select from dropdown)'],
        ['  Network         — select from dropdown'],
        ['  Company Type    — select from dropdown'],
        ['  VAT Available   — Y if VAT/PAN/Tax ID is available'],
        ['  VAT No          — required if VAT Available = Y'],
        ['  Name as per VAT — name registered with the tax authority'],
        [],
        ['BRANCHES SHEET — MANDATORY FIELDS (red header)'],
        ['  Customer Name   — must match a name in the Customers sheet (select from dropdown)'],
        ['  Branch Name     — name of the branch, max 50 chars'],
        ['  Branch Type     — HeadQuarters or BRANCH (select from dropdown)'],
        ['  State           — select from dropdown'],
        ['  City            — select from dropdown'],
        ['  Address         — branch address, max 300 chars'],
        [],
        ['BRANCHES SHEET — OPTIONAL FIELDS (orange header)'],
        ['  Branch Code     — unique code for the branch'],
        ['  Contact Person  — primary contact at the branch'],
        ['  Phone           — contact phone number'],
        ['  Email           — branch email address'],
        ['  Zip/Post Code   — postal code'],
        ['  Registered      — Y if branch is GST registered, N if unregistered'],
        [],
        ['RULES'],
        ['  • Duplicate Customer Name will be skipped with an error'],
        ['  • Each customer must have at least one branch'],
        ['  • Status is always imported as Active — use the application to suspend records'],
    ].forEach(r => inst.addRow(r));

    inst.getRow(1).font = { bold: true, size: 13 };
    ['A3', 'A8', 'A15', 'A21', 'A34', 'A42', 'A50'].forEach(cell => {
        inst.getCell(cell).font = { bold: true, underline: true };
    });
    inst.getColumn(1).width = 90;

    const buf = await workbook.xlsx.writeBuffer();
    return Buffer.from(buf);
}

// ══════════════════════════════════════════════════════════════════════════════
// STEP 1: PARSE ONLY — validate without DB writes
// ══════════════════════════════════════════════════════════════════════════════
async parseCustomerExcel(
    buffer: Buffer,
    CompanyMasterSid: number
): Promise<{
    validRows: any[];
    invalidRows: any[];
    summary: { total: number; valid: number; invalid: number };
}> {
    const workbook = XLSX.read(buffer, { type: 'buffer' });

    const getRows = (partialName: string, skipRows: number): any[][] => {
        const name = workbook.SheetNames.find(n =>
            n.toLowerCase().includes(partialName.toLowerCase())
        );
        if (!name) return [];
        const all: any[][] = XLSX.utils.sheet_to_json(workbook.Sheets[name], {
            header: 1, defval: null, raw: false
        });
        all.splice(0, skipRows);
        return all.filter(r => r.some(cell => cell !== null && cell !== ''));
    };

    // Skip header row (1) + 2 example rows = 3 rows
    const customerRows = getRows('customer', 3);
    const branchRows   = getRows('branch',   3);

    // ── Lookup data ──────────────────────────────────────────────────────────
    const [countries, currencies, networks, states, cities, existingCustomers] = await Promise.all([
        this._db.countryMaster.findMany({
            where: { status: 'A' },
            select: { CountryMasterSid: true, countryName: true, countryCode: true, CurrencyMasterSid: true }
        }),
        this._db.currencyMaster.findMany({
            where: { status: 'A' },
            select: { CurrencyMasterSid: true, currencyCode: true }
        }),
        this._db.networkMaster.findMany({
            where: { Status: 'A' },
            select: { NetworkMasterSid: true, NetworkName: true }
        }),
        this._db.stateMaster.findMany({
            where: { status: 'A' },
            select: { StateMasterSid: true, stateName: true }
        }),
        this._db.cityMaster.findMany({
            where: { status: 'A' },
            select: { CityMasterSid: true, cityName: true, StateMasterSid: true }
        }),
        this._db.customerMaster.findMany({
            where: { CompanyMasterSid, status: { not: 'D' } },
            select: { CustomerName: true, CustomerShortCode: true }
        }),
    ]);

    const countryMap  = new Map(countries.map(x => [x.countryName.trim().toLowerCase(), x]));
    const currencyMap = new Map(currencies.map(x => [x.currencyCode.trim().toLowerCase(), x.CurrencyMasterSid]));
    const networkMap  = new Map(networks.map(x => [x.NetworkName.trim().toLowerCase(), x.NetworkMasterSid]));
    const stateMap    = new Map(states.map(x => [x.stateName.trim().toLowerCase(), x.StateMasterSid]));
    const cityMap     = new Map(
        cities.map(x => [`${x.cityName.trim().toLowerCase()}__${x.StateMasterSid}`, x.CityMasterSid])
    );

    const existingNames = new Set(existingCustomers.map(x => x.CustomerName.toLowerCase()));
    const existingCodes = new Set(
        existingCustomers.map(x => x.CustomerShortCode?.toLowerCase()).filter(Boolean)
    );

    const customerTypeKeys: Record<string, string> = {
    'agent':          'agent',
    'air line':       'airLine',
    'carrier':        'carrier',
    'cfs':            'cFS',
    'consignee':      'consignee',
    'customer':       'customer',
    'feeder':         'feeder',
    'forwarder':      'forwarder',
    'nvocc':          'nVOCC',
    'notify':         'notify',
    'overseas agent': 'overseasAgent',
    'shipper':        'shipper',
    'shipping line':  'shippingLine',
    'transporter':    'transporter',
    'vendor':         'vendor',
    'warehouse':      'warehouse',
    'yard':           'yard'
};

    const buildCustomerTypeObject = (raw: string): Record<string, string> => {
    // Start with all keys set to 'isFalse'
    const result: Record<string, string> = Object.fromEntries(
        Object.values(customerTypeKeys).map(key => [key, 'isFalse'])
    );

    if (!raw) return result;

    raw.split(',').map(t => t.trim().toLowerCase()).forEach(t => {
        const key = customerTypeKeys[t];
        if (key) {
            result[key] = 'isTrue';
        } else {
            console.warn(`[buildCustomerTypeObject] Unrecognized type: "${t}"`);
        }
    });

    return result;
};

    // ── Group branches by customer name ──────────────────────────────────────
    const branchesByCustomer = new Map<string, any[]>();
    branchRows.forEach((row, i) => {
        const name = (row[0] || '').toString().trim().toLowerCase();
        if (!name) return;
        if (!branchesByCustomer.has(name)) branchesByCustomer.set(name, []);
        branchesByCustomer.get(name)!.push({ row, rowNum: i + 4 });
    });

    const validRows:   any[] = [];
    const invalidRows: any[] = [];

    const seenNames = new Set<string>();
    const seenCodes = new Set<string>();

    for (let i = 0; i < customerRows.length; i++) {
        const row    = customerRows[i];
        const rowNum = i + 4;
        const errors: string[] = [];

        // ── Customer sheet column mapping (0-based) ───────────────────────────
        // Matches generateCustomerTemplate column order exactly:
        // A(0)  Customer Name
        // B(1)  Code
        // C(2)  Country          ← dropdown
        // D(3)  Currency         ← dropdown
        // E(4)  Organization Type
        // F(5)  Alias
        // G(6)  Group Name
        // H(7)  Address1
        // I(8)  Address2
        // J(9)  Website
        // K(10) CashCredit       ← dropdown: Cash / Credit
        // L(11) Network          ← dropdown
        // M(12) CIN
        // N(13) TAN
        // O(14) Remarks
        // P(15) Registration No
        // Q(16) Company Type     ← dropdown
        // R(17) VAT Available    ← Y/N
        // S(18) VAT No
        // T(19) Name as per VAT
        const customerName    = (row[0]  || '').toString().trim();
        const shortCode       = (row[1]  || '').toString().trim();
        const countryRaw      = (row[2]  || '').toString().trim();
        const currencyRaw     = (row[3]  || '').toString().trim();
        const customerTypes   = (row[4]  || '').toString().trim();
        const aliasName       = (row[5]  || '').toString().trim();
        const groupName       = (row[6]  || '').toString().trim();
        const address1        = (row[7]  || '').toString().trim();
        const address2        = (row[8]  || '').toString().trim();
        const website         = (row[9]  || '').toString().trim();
        const cashCredit      = (row[10] || 'Credit').toString().trim();
        const network         = (row[11] || '').toString().trim();
        const cin             = (row[12] || '').toString().trim();
        const tan             = (row[13] || '').toString().trim();
        const remarks         = (row[14] || '').toString().trim();
        const registrationNo  = (row[15] || '').toString().trim();
        const companyType     = (row[16] || '').toString().trim();
        const vatAvailable    = (row[17] || '').toString().trim().toUpperCase() === 'Y';
        const vatNumber       = (row[18] || '').toString().trim().toUpperCase();
        const vatName         = (row[19] || '').toString().trim();

        if (!customerName && !address1) continue;

        // ── Mandatory validations ─────────────────────────────────────────────
        if (!customerName) {
            errors.push('Customer Name is required');
        } else if (customerName.length > 200) {
            errors.push('Customer Name must be ≤ 200 characters');
        }

        if (!address1) errors.push('Address1 is required');

        // ── Country ───────────────────────────────────────────────────────────
        let CountryMasterSid: number | null = null;
        let autoCurrencyId:   number | null = null;
        if (!countryRaw) {
            errors.push('Country is required');
        } else {
            const countryRec = countryMap.get(countryRaw.toLowerCase());
            if (!countryRec) {
                errors.push(`Country "${countryRaw}" not found`);
            } else {
                CountryMasterSid = countryRec.CountryMasterSid;
                autoCurrencyId   = countryRec.CurrencyMasterSid ?? null;
            }
        }

        // ── Currency (optional — auto-detected from country if blank) ─────────
        let CurrencyMasterSid: number | null = autoCurrencyId;
        if (currencyRaw) {
            const cid = currencyMap.get(currencyRaw.toLowerCase());
            if (!cid) errors.push(`Currency "${currencyRaw}" not found`);
            else CurrencyMasterSid = cid;
        }

        // ── Duplicate checks ──────────────────────────────────────────────────
        if (customerName && existingNames.has(customerName.toLowerCase())) {
            errors.push(`Customer Name "${customerName}" already exists in the system`);
        }
        if (customerName && seenNames.has(customerName.toLowerCase())) {
            errors.push(`Duplicate Customer Name "${customerName}" within the file`);
        }
        if (shortCode && existingCodes.has(shortCode.toLowerCase())) {
            errors.push(`Short Code "${shortCode}" already exists in the system`);
        }
        if (shortCode && seenCodes.has(shortCode.toLowerCase())) {
            errors.push(`Duplicate Short Code "${shortCode}" within the file`);
        }

        // ── Branches for this customer ────────────────────────────────────────
        const matchedBranches = branchesByCustomer.get(customerName.toLowerCase()) || [];
        const branchRecords:  any[] = [];
        const branchErrors:   any[] = [];

        if (matchedBranches.length === 0) {
            errors.push('At least one branch is required');
        }

        for (const { row: br, rowNum: brRowNum } of matchedBranches) {
            // ── Branch sheet column mapping (0-based) ─────────────────────────
            // Matches generateCustomerTemplate branch sheet column order exactly:
            // A(0)  Customer Name
            // B(1)  Branch Name
            // C(2)  Branch Type    ← dropdown: HeadQuarters / BRANCH
            // D(3)  Branch Code
            // E(4)  State          ← dropdown
            // F(5)  City           ← dropdown
            // G(6)  Contact Person
            // H(7)  Phone
            // I(8)  Email
            // J(9)  Address
            // K(10) Zip/Post Code
            // L(11) Registered     ← dropdown: Y / N
            const branchName    = (br[1]  || '').toString().trim();
            const branchType    = (br[2]  || '').toString().trim();
            const branchCode    = (br[3]  || '').toString().trim();
            const stateRaw      = (br[4]  || '').toString().trim();
            const cityRaw       = (br[5]  || '').toString().trim();
            const contactPerson = (br[6]  || '').toString().trim();
            const phone         = (br[7]  || '').toString().trim();
            const email         = (br[8]  || '').toString().trim();
            const address       = (br[9]  || '').toString().trim();
            const zipCode       = (br[10] || '').toString().trim();
            const registered    = (br[11] || 'Y').toString().trim().toUpperCase() === 'Y' ? 'Y' : 'N';

            const bErrors: string[] = [];

            if (!branchName) bErrors.push('Branch Name is required');
            if (!branchType) bErrors.push('Branch Type is required');
            if (!address)    bErrors.push('Branch Address is required');

            // State
            let StateMasterSid: number | null = null;
            if (!stateRaw) {
                bErrors.push('State is required');
            } else {
                const sid = stateMap.get(stateRaw.toLowerCase());
                if (!sid) bErrors.push(`State "${stateRaw}" not found`);
                else StateMasterSid = sid;
            }

            // City (resolved against state)
            let CityMasterSid: number | null = null;
            if (!cityRaw) {
                bErrors.push('City is required');
            } else if (StateMasterSid) {
                const cid = cityMap.get(`${cityRaw.toLowerCase()}__${StateMasterSid}`);
                if (!cid) bErrors.push(`City "${cityRaw}" not found in state "${stateRaw}"`);
                else CityMasterSid = cid;
            }

            if (bErrors.length) {
                branchErrors.push({ sheet: 'Branches', row: brRowNum, branchName, errors: bErrors });
            } else {
                branchRecords.push({
                    BranchName:    branchName,
                    Branch_Type:   branchType,
                    Branch_Code:   branchCode,
                    StateMasterSid,
                    CityMasterSid,
                    Contact_Person: contactPerson,
                    ContactNo:     phone,
                    Email:         email,
                    Address:       address,
                    Zip_PostBox:   zipCode,
                    Registered:    registered,
                    status:        'A',   // always Active on import
                });
            }
        }

        // ── Build result row ──────────────────────────────────────────────────
        const rowResult = {
            rowNum,
            customerName,
            shortCode,
            aliasName,
            address1,
            address2,
            countryRaw,
            CountryMasterSid,
            CurrencyMasterSid,
            companyType,
            panAvailable:  vatAvailable,
            panNumber:     vatNumber,
            panName:       vatName,
            groupName,
            website,
            paymentType:   cashCredit,
            registrationNo,
            cin,
            tan,
            remarks,
            customerTypeObject: buildCustomerTypeObject(customerTypes),
            network,
            status:        'A',   // always Active on import
            branchRecords,
            branchErrors,
        };

        const allErrors = [
            ...errors,
            ...branchErrors.map(be => `Branch "${be.branchName}": ${be.errors.join(', ')}`)
        ];

        if (allErrors.length) {
            invalidRows.push({ ...rowResult, errors: allErrors });
        } else {
            seenNames.add(customerName.toLowerCase());
            if (shortCode) seenCodes.add(shortCode.toLowerCase());
            validRows.push(rowResult);
        }
    }

    return {
        validRows,
        invalidRows,
        summary: {
            total:   validRows.length + invalidRows.length,
            valid:   validRows.length,
            invalid: invalidRows.length,
        }
    };
}

// ══════════════════════════════════════════════════════════════════════════════
// STEP 2: SAVE ONLY — receives pre-validated rows from parseCustomerExcel
// ══════════════════════════════════════════════════════════════════════════════
async saveCustomerExcel(
    validRows: any[],
    CompanyMasterSid: number,
    createdBy: string
): Promise<{ created: number; skipped: number; errors: any[] }> {

    let created = 0, skipped = 0;
    const errors: any[] = [];

    for (const row of validRows) {
        // Final duplicate guard at save time
        const dup = await this._db.customerMaster.findFirst({
            where: {
                CompanyMasterSid,
                status: { not: 'D' },
                OR: [
                    { CustomerName: { equals: row.customerName, mode: 'insensitive' } },
                    ...(row.shortCode
                        ? [{ CustomerShortCode: { equals: row.shortCode, mode: Prisma.QueryMode.insensitive } }]
                        : []),
                ]
            }
        });

        if (dup) {
            errors.push({ customerName: row.customerName, message: 'Duplicate found at save time — skipped' });
            skipped++;
            continue;
        }

        try {
            await this._db.$transaction(async (prisma) => {
                const customer = await prisma.customerMaster.create({
                    data: {
                        CompanyMasterSid,
                        CustomerName:     row.customerName,
                        CustomerShortCode: row.shortCode     || null,
                        CustomerAliasName: row.aliasName    || null,
                        CustomerAddress1:  row.address1,
                        CustomerAddress2:  row.address2     || null,
                        CountryMasterSid:  row.CountryMasterSid,
                        CurrencyMasterSid: row.CurrencyMasterSid ?? null,
                        CompanyType:       row.companyType  || null,
                        PanType:           row.panAvailable ? row.panNumber : null,
                        PanName:           row.panAvailable ? row.panName   : null,
                        GroupName:         row.groupName    || null,
                        Website:           row.website      || null,
                        CashCredit:        row.paymentType  || 'Credit',
                        IsMSME:            row.isMsme ? 'A' : 'I',
                        RegistrationNo:    row.registrationNo || null,
                        CIN:               row.cin          || null,
                        TAN:               row.tan          || null,
                        Remarks:           row.remarks      || null,
                        CustomerType:      row.customerTypeObject
    ? (row.customerTypeObject as Prisma.InputJsonValue)
    : Prisma.JsonNull,
                        Network:           row.network      || null,
                        status:            row.status,
                        createdBy,
                    }
                });

                if (row.branchRecords?.length) {
                    await prisma.customerBranch.createMany({
                        data: row.branchRecords.map((b: any) => ({
                            CustomerMasterSid: customer.CustomerMasterSid,
                            CompanyMasterSid,
                            BranchName:       b.BranchName,
                            Branch_Type:      b.Branch_Type,
                            Branch_Code:      b.Branch_Code     || null,
                            StateMasterSid:   b.StateMasterSid,
                            CityMasterSid:    b.CityMasterSid,
                            Contact_Person:   b.Contact_Person  || null,
                            ContactNo:        b.ContactNo       || null,
                            Email:            b.Email           || '',
                            Address:          b.Address,
                            Zip_PostBox:      b.Zip_PostBox     || null,
                            Registered:       b.Registered,
                            CustomerGstType:  b.CustomerGstType || null,
                            GSTNo:            b.GSTNo           || '',
                            status:           b.status,
                            createdBy,
                        }))
                    });
                }
            });

            created++;
        } catch (err: any) {
            errors.push({ customerName: row.customerName, message: err.message || 'DB insert failed' });
            skipped++;
        }
    }

    return { created, skipped, errors };
}

// ══════════════════════════════════════════════════════════════════════════════
// SINGLE-SHOT IMPORT (parse + save in one call — mirrors parseAndImportChargeExcel)
// ══════════════════════════════════════════════════════════════════════════════
async parseAndImportCustomerExcel(
    buffer: Buffer,
    CompanyMasterSid: number,
    createdBy: string
): Promise<{ created: number; skipped: number; errors: any[] }> {

    const { validRows, invalidRows } = await this.parseCustomerExcel(buffer, CompanyMasterSid);

    // Collect parse-time errors for reporting
    const errors: any[] = invalidRows.map(r => ({
        sheet: 'Customers',
        row: r.rowNum,
        customerName: r.customerName,
        message: r.errors.join('; ')
    }));

    const { created, skipped, errors: saveErrors } = await this.saveCustomerExcel(
        validRows, CompanyMasterSid, createdBy
    );

    return {
        created,
        skipped: skipped + invalidRows.length,
        errors:  [...errors, ...saveErrors]
    };
}

}

