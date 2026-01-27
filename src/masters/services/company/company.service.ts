import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { GlobalConfigService } from 'src/common/config/master-config.service';
import { statusWhereClause } from 'src/common/helper';
import { DatabaseService } from 'src/database/database.service';
import { SearchListDto } from 'src/masters/DTO/search-list.dto';
import { filterDto } from 'src/masters/DTO/search-vessel.dto';

@Injectable()
export class CompanyService {
    constructor(private _db: DatabaseService, private globalConfigService: GlobalConfigService, private logger: Logger) { }

    async createCompany(newData: any, user: any, files: any) {
        try {

            // Check if already name exist
            const existing = await this._db.companyMaster.findFirst({
                where: {
                    companyName: {
                        equals: newData.companyName.trim(),
                        mode: 'insensitive',
                    },
                },
            });

            if (existing?.companyName === newData.companyName) {
                throw new BadRequestException('Company name already exists.');
            }

            if (newData.Pan) {
                const existing = await this._db.companyMaster.findFirst({
                    where: {
                        Pan: {
                            equals: newData.Pan.trim(),
                            mode: 'insensitive'
                        }
                    }
                })

                if (existing?.Pan === newData.Pan) {
                    throw new BadRequestException('Provided pan number is already linked to a company.');
                }
            }

            // Extract logo filenames from uploaded files
            // Use flags to properly identify which file is which
            // Files are sent in order: company logo first (if exists), then report logo (if exists)
            let companyLogoPath: string | null = null;
            let reportLogoPath: string | null = null;

            if (files && Array.isArray(files) && files.length > 0) {
                let fileIndex = 0;

                // Check if company logo file was uploaded
                if (newData.hasNewCompanyLogo && files[fileIndex]) {
                    companyLogoPath = files[fileIndex].filename;
                    fileIndex++;
                }

                // Check if report logo file was uploaded
                if (newData.hasNewReportLogo && files[fileIndex]) {
                    reportLogoPath = files[fileIndex].filename;
                }
            }

            
            const result = await this._db.$transaction(async (prisma) => {
                // 2. Create Company
                
                const currencySync = await this.syncCompanyCurrencyWithConfig(
                    null,
                    newData.config,
                    newData.CurrencyMasterSid,
                    prisma
                );
                
                // 1. Prepare company payload
                const companyPayload = {
                    companyName: newData.companyName,
                    companyCode: newData.companyCode,
                    CountryMasterSid: newData.CountryMasterSid,
                    CurrencyMasterSid: newData.CurrencyMasterSid,
                    addressLine1: newData.addressLine1,
                    webSite: newData.webSite,
                    email: newData.email,
                    phoneNumber: newData.phoneNumber,
                    Pan: newData.Pan,
                    isHo: newData.isHo,
                    status: newData.status,
                    remarks: newData.remarks,
                    CIN: newData.CIN,
                    TAN: newData.TAN,
                    config: currencySync || {},
                    createdBy: user.userEmail,
                    companyLogo: companyLogoPath,
                    reportLogo: reportLogoPath
                };
                console.log('Creating company:', companyPayload);
                
                const createdCompany = await prisma.companyMaster.create({
                    data: companyPayload
                });
                console.log('Company created with ID:', createdCompany.CompanyMasterSid);

                // 3. Create Branches and Banks
                const createdBranches: any[] = [];

                if (newData.branches && newData.branches.length > 0) {
                    for (const branchData of newData.branches) {
                        // Prepare branch payload
                        const branchPayload = {
                            branchName: branchData.branchName,
                            branchCode: branchData.branchCode,
                            addressLine1: branchData.addressLine1,
                            addressLine2: branchData.addressLine2 || null,
                            postalCode: branchData.postalCode,
                            webSite: branchData.webSite || null,
                            phoneNumber: branchData.phoneNumber,
                            email: branchData.email,
                            timeZone: branchData.timeZone,
                            remarks: branchData.remarks || null,
                            taxRegistrationNo: branchData.taxRegistrationNo,
                            status: branchData.status,
                            CityMasterSid: parseInt(branchData.CityMasterSid),
                            StateMasterSid: parseInt(branchData.StateMasterSid),
                            CountryMasterSid: parseInt(branchData.CountryMasterSid),
                            config: branchData.config || {},
                            consolePrefix: branchData.consolePrefix,
                            consoleNoLen: branchData.consoleNoLen,
                            BookingPrefix: branchData.BookingPrefix,
                            BookingNoLen: branchData.BookingNoLen,
                            shipmentPrefix: branchData.shipmentPrefix,
                            shipmentNoLen: branchData.shipmentNoLen,
                            enquiryPrefix: branchData.enquiryPrefix,
                            enquiryNoLen: branchData.enquiryNoLen,
                            quotationPrefix: branchData.quotationPrefix,
                            quotationNoLen: branchData.quotationNoLen,
                            createdBy: user.userEmail

                        };

                        console.log('Creating branch:', branchPayload);
                        const createdBranch = await prisma.branchMaster.create({
                            data: {
                                CompanyMasterSid: createdCompany.CompanyMasterSid,
                                ...branchPayload
                            }
                        });
                        console.log('Branch created with ID:', createdBranch.BranchMasterSid);

                        // Create Banks for the branch
                        let createdBanks: any;
                        if (branchData.branchBank && branchData.branchBank.length > 0) {
                            console.log('Creating banks for branch:', branchData.branchBank);

                            const bankCreateData = branchData.branchBank.map(bank => ({
                                BankName: bank.BankName,
                                BankCode: bank.BankCode,
                                BankAddress: bank.BankAddress || null,
                                IFSCCode: bank.IFSCCode,
                                BankAccountNo: bank.BankAccountNo,
                                status: bank.status,
                                Remarks: bank.Remarks || null,
                                PrintOnInvoice : bank.PrintOnInvoice || 'N',
                                CurrencyMasterSid : bank.CurrencyMasterSid || null,
                                BranchMasterSid: createdBranch.BranchMasterSid,
                                createdBy: user.userEmail
                            }));

                            createdBanks = await prisma.branchBank.createMany({
                                data: bankCreateData
                            });
                        }

                        createdBranches.push({
                            ...createdBranch,
                            banks: createdBanks || []
                        });
                    }
                }

                return {
                    company: createdCompany,
                    branches: createdBranches
                };
            });

            return result;
        } catch (error) {
            console.error('Transaction failed:', error);
            throw error;
        }
    }

    // async createCompany(newData: any, user, files) {
    //     try {
    //         const createdCompany = await this._db.companyMaster.create({
    //             data: {
    //                 ...newData,
    //             }
    //         })
    //         return createdCompany;
    //     } catch (error) {
    //         throw error;
    //     }
    // }


    async getAllCompany() {
        try {
            const allCompanies = await this._db.companyMaster.findMany({
                where: {
                    status: 'A',
                },
                orderBy: {
                    companyName: 'asc'
                },
                include: {
                    countryMaster:{
                        select:{
                            countryName:true
                        }
                    },
                    branchMaster: {
                        include: {
                            branchBank: {
                                where: {
                                    status: 'A'
                                }
                            }
                        },
                        where: {
                            status: 'A'
                        },
                        orderBy: {
                            branchName: 'asc'
                        }
                    },

                }
            })
            return allCompanies;
        } catch (error) {
            throw error;
        }
    }

    async newSearch() {
        try {
            const allData = await this._db.companyMaster.findMany({
                where: {
                    status: 'A',
                },
                include: {
                    branchMaster: {
                        where: {
                            status: 'A',
                        },
                        include: {
                            branchBank: {
                                where: {
                                    status: 'A'
                                }
                            },
                            countryMaster: true,
                            stateMaster: true,
                            cityMaster: true
                        }
                    }
                }
            });
            return allData;
        } catch (error) {
            throw error;
        }
    }

    async getCompanyById(CompanyMasterSid: number) {
        try {
            const ourCompany = await this._db.companyMaster.findUnique({
                where: {
                    CompanyMasterSid: CompanyMasterSid
                },
                include: {
                    branchMaster: {
                        where: {
                            status: 'A',
                        },
                        include: {
                            cityMaster: {
                                select: {
                                    cityName: true
                                }
                            },
                            company: {
                                select: {
                                    companyName: true
                                }
                            },
                            branchBank: {
                                where: {
                                    status: 'A'
                                }
                            }
                        }
                    }
                }
            })
            if (!ourCompany) {
                throw new BadRequestException(`Company with id : ${CompanyMasterSid} not exists`);
            }
            return ourCompany;
        } catch (error) {
            throw error;
        }
    }


    // Main Update Function
    async updateCompany(companySid: number, updateData: any, user: any, files?: any) {
        try {
            if (updateData.companyName) {

                // Check if already name exist
                const existing = await this._db.companyMaster.findFirst({
                    where: {
                        AND: [
                            {
                                CompanyMasterSid: {
                                    not: companySid
                                },
                            },
                            {
                                companyName: {
                                    equals: updateData.companyName.trim(),
                                    mode: 'insensitive',
                                },
                            }
                        ]
                    },
                });

                if (existing?.companyName === updateData.companyName) {
                    throw new BadRequestException('Company name already exists.');
                }
            }

            if (updateData.Pan) {
                const existing = await this._db.companyMaster.findFirst({
                    where: {
                        AND: [
                            {
                                Pan: {
                                    equals: updateData.Pan.trim(),
                                    mode: 'insensitive'
                                }
                            },
                            {
                                CompanyMasterSid: {
                                    not: companySid
                                }
                            }
                        ]
                    }
                })

                if (existing?.Pan === updateData.Pan) {
                    throw new BadRequestException('Provided pan number is already linked to a company.');
                }
            }

            // Build logo update logic
            // undefined = don't change, null = remove, string = new file
            let companyLogoUpdate: string | null | undefined = undefined;
            let reportLogoUpdate: string | null | undefined = undefined;

            // Use flags to properly identify which file is which
            // Files are sent in order: company logo first (if exists), then report logo (if exists)
            if (files && Array.isArray(files) && files.length > 0) {
                let fileIndex = 0;

                // Check if company logo file was uploaded
                if (updateData.hasNewCompanyLogo && files[fileIndex]) {
                    companyLogoUpdate = files[fileIndex].filename;
                    fileIndex++;
                }

                // Check if report logo file was uploaded
                if (updateData.hasNewReportLogo && files[fileIndex]) {
                    reportLogoUpdate = files[fileIndex].filename;
                }
            }

            // If removal flags are set (and no new file), set to null to remove
            if (updateData.removeCompanyLogo && companyLogoUpdate === undefined) {
                companyLogoUpdate = null;
            }
            if (updateData.removeReportLogo && reportLogoUpdate === undefined) {
                reportLogoUpdate = null;
            }

            // 1. Prepare company payload without destructuring
            const companyPayload = {
                companyName: updateData.companyName,
                companyCode: updateData.companyCode,
                CountryMasterSid: updateData.CountryMasterSid,
                CurrencyMasterSid: updateData.CurrencyMasterSid,
                addressLine1: updateData.addressLine1,
                webSite: updateData.webSite,
                email: updateData.email,
                phoneNumber: updateData.phoneNumber,
                Pan: updateData.Pan,
                isHo: updateData.isHo,
                status: updateData.status,
                remarks: updateData.remarks,
                CIN: updateData.CIN,
                TAN: updateData.TAN,
                // Only include logo fields if they need to change (new file or removal)
                ...(companyLogoUpdate !== undefined && { companyLogo: companyLogoUpdate }),
                ...(reportLogoUpdate !== undefined && { reportLogo: reportLogoUpdate }),
                config: updateData.config,
                updatedBy: user.userEmail
            };

            const result = await this._db.$transaction(async (prisma) => {
                // 2. Update Company
                const updatedCompany = await prisma.companyMaster.update({
                    where: { CompanyMasterSid: companySid },
                    data: companyPayload
                });

                const updateCompanyWithConfig = await this.syncCompanyCurrencyWithConfig(
                    companySid,
                    updatedCompany.config,
                    updateData.CurrencyMasterSid,
                    prisma
                );

                // 3. Get existing branches
                const existingBranches = await prisma.branchMaster.findMany({
                    where: { CompanyMasterSid: companySid, status: 'A' },
                    select: { BranchMasterSid: true }
                });
                const existingBranchIds = existingBranches.map(branch => branch.BranchMasterSid);
                const updatedBranchIds: number[] = [];

                // 4. Process branches
                const updatedBranches: BranchWithBanks[] = [];

                if (updateData.branches && updateData.branches.length > 0) {
                    for (const branchData of updateData.branches) {
                        // Prepare branch payload without destructuring
                        const branchPayload = {
                            branchName: branchData.branchName,
                            branchCode: branchData.branchCode,
                            addressLine1: branchData.addressLine1,
                            addressLine2: branchData.addressLine2 || null,
                            postalCode: branchData.postalCode,
                            webSite: branchData.webSite || null,
                            phoneNumber: branchData.phoneNumber || null,
                            email: branchData.email || null,
                            timeZone: branchData.timeZone || null,
                            remarks: branchData.remarks || null,
                            taxRegistrationNo: branchData.taxRegistrationNo || null,
                            status: branchData.status,
                            CityMasterSid: Number(branchData.CityMasterSid),
                            StateMasterSid: Number(branchData.StateMasterSid),
                            CountryMasterSid: Number(branchData.CountryMasterSid),
                            config: branchData.config,
                            consolePrefix: branchData.consolePrefix,
                            consoleNoLen: branchData.consoleNoLen,
                            BookingPrefix: branchData.BookingPrefix,
                            BookingNoLen: branchData.BookingNoLen,
                            shipmentPrefix: branchData.shipmentPrefix,
                            shipmentNoLen: branchData.shipmentNoLen,
                            enquiryPrefix: branchData.enquiryPrefix,
                            enquiryNoLen: branchData.enquiryNoLen,
                            quotationPrefix: branchData.quotationPrefix,
                            quotationNoLen: branchData.quotationNoLen,
                            updatedBy: user.userEmail

                        };

                        let branchOperation;
                        if (branchData.BranchMasterSid) {
                            branchOperation = await prisma.branchMaster.update({
                                where: { BranchMasterSid: branchData.BranchMasterSid },
                                data: branchPayload
                            });
                            updatedBranchIds.push(branchData.BranchMasterSid);
                        } else {
                            branchOperation = await prisma.branchMaster.create({
                                data: {
                                    CompanyMasterSid: companySid,
                                    createdBy: user.userEmail,
                                    ...branchPayload
                                }
                            });
                            updatedBranchIds.push(branchOperation.BranchMasterSid);
                        }

                        // Process banks without destructuring
                        if (branchData.branchBank && branchData.branchBank.length > 0) {
                            await prisma.branchBank.deleteMany({
                                where: { BranchMasterSid: branchOperation.BranchMasterSid }
                            });

                            const bankCreateData = branchData.branchBank.map(bank => ({
                                BankName: bank.BankName,
                                BankCode: bank.BankCode,
                                BankAddress: bank.BankAddress || null,
                                IFSCCode: bank.IFSCCode,
                                BankAccountNo: bank.BankAccountNo,
                                status: bank.status,
                                Remarks: bank.Remarks || null,
                                PrintOnInvoice : bank.PrintOnInvoice || 'N',
                                CurrencyMasterSid : bank.CurrencyMasterSid || null,
                                BranchMasterSid: branchOperation.BranchMasterSid,
                                createdBy: user.userEmail
                            }));

                            await prisma.branchBank.createMany({
                                data: bankCreateData
                            });
                        }

                        updatedBranches.push({
                            ...branchOperation,
                            banks: branchData.branchBank || []
                        });
                    }
                }

                // 5. Handle branch deletions
                const branchesToDelete = existingBranchIds.filter(
                    id => !updatedBranchIds.includes(id)
                );

                if (branchesToDelete.length > 0) {
                    await prisma.branchBank.updateMany({
                        where: { BranchMasterSid: { in: branchesToDelete } },
                        data: {
                            status: 'A',
                            updatedBy: user.userEmail
                        }
                    });

                    await prisma.branchMaster.updateMany({
                        where: {
                            BranchMasterSid: { in: branchesToDelete },
                            CompanyMasterSid: companySid
                        },
                        data: {
                            updatedBy: user.userEmail,
                            status: 'D'
                        }
                    });
                }

                return {
                    company: updateCompanyWithConfig,
                    branches: updatedBranches
                };
            });

            return result;
        } catch (error) {
            throw error;
        }
    }

    // async updateCompanyById(CompanyMasterSid: number, updateData: any) {
    //     try {
    //         const existing = await this._db.companyMaster.findUnique({
    //             where: {
    //                 CompanyMasterSid: CompanyMasterSid
    //             }
    //         })
    //         if (!existing) {
    //             throw new BadRequestException(`Company with id : ${CompanyMasterSid} not exists`);
    //         }
    //         const updatedCompany = await this._db.companyMaster.update({
    //             where: {
    //                 CompanyMasterSid: CompanyMasterSid
    //             }, data: updateData
    //         })
    //         return updatedCompany;
    //     } catch (error) {
    //         throw error;
    //     }
    // }


    async softDeleteCompanyById(CompanyMasterSid: number) {
        try {
            const existing = await this._db.companyMaster.findUnique({
                where: {
                    CompanyMasterSid: CompanyMasterSid
                }
            });

            if (!existing) {
                throw new BadRequestException(`Company with id : ${CompanyMasterSid} not exists.`);
            }
            if (existing.status === 'D') {
                throw new BadRequestException(`Company with id : ${CompanyMasterSid} is already deleted.`);
            }

            const result = await this._db.$transaction(async (prisma) => {
                // Soft delete the company
                const company = await prisma.companyMaster.update({
                    where: {
                        CompanyMasterSid: CompanyMasterSid
                    },
                    data: {
                        status: 'D'
                    }
                });

                // Find all branches for this company
                const existingBranches = await prisma.branchMaster.findMany({
                    where: {
                        CompanyMasterSid: CompanyMasterSid,
                        status: 'D'
                    }
                });

                // Soft delete all branches and their associated banks
                const deletedBranchesWithBanks = await Promise.all(
                    existingBranches.map(async (branch) => {
                        const deletedBranch = await prisma.branchMaster.update({
                            where: {
                                BranchMasterSid: branch.BranchMasterSid
                            },
                            data: {
                                status: 'D'
                            }
                        });

                        const deletedBanks = await prisma.branchBank.updateManyAndReturn({
                            where: {
                                BranchMasterSid: branch.BranchMasterSid,
                                status: 'D'
                            },
                            data: {
                                status: 'D'
                            }
                        });

                        return {
                            ...deletedBranch,
                            deletedBanks: deletedBanks
                        };
                    })
                );

                return {
                    company,
                    deletedBranchesWithBanks
                };
            });

            return result;
        } catch (error) {
            throw error;
        }
    }

    async saveCompanyConfig(companyId: number, configData: any, user: any) {
        try {
            // First verify the company exists
            const company = await this._db.companyMaster.findUnique({
                where: { CompanyMasterSid: companyId }
            });

            if (!company) {
                throw new BadRequestException(`Company with id ${companyId} not found`);
            }

            // Update the company with new config
            const updatedCompany = await this._db.companyMaster.update({
                where: { CompanyMasterSid: companyId },
                data: {
                    config: configData,
                    updatedBy: user.userEmail
                }
            });

            if(configData?.systemSettings?.currency?.currencyMasterSid){
                await this._db.companyMaster.update({
                    where: { CompanyMasterSid: companyId },
                    data: {
                        CurrencyMasterSid: configData.systemSettings.currency.currencyMasterSid,
                        updatedBy: user.userEmail
                    }
                });
            }

            return updatedCompany;
        } catch (error) {
            console.error('Error saving company config:', error);
            throw error;
        }
    }

    async getCompanyConfig(companyId: number) {
        try {
            const company = await this._db.companyMaster.findUnique({
                where: { CompanyMasterSid: companyId },
                select: {
                    CompanyMasterSid: true,
                    companyName: true,
                    config: true
                }
            });

            if (!company) {
                throw new BadRequestException(`Company with id ${companyId} not found`);
            }

            return {
                CompanyMasterSid: company.CompanyMasterSid,
                companyName: company.companyName,
                config: company.config || {}
            };
        } catch (error) {
            console.error('Error fetching company config:', error);
            throw error;
        }
    }

    async getFieldConfiguration() {
        try {
            const fieldConfig = await this._db.fieldConfiguration.findFirst({
                orderBy: { configSid: 'asc' }
            });

            if (!fieldConfig) {
                throw new BadRequestException('No field configuration found');
            }

            return fieldConfig;
        } catch (error) {
            throw error;
        }
    }



    async searchCompanyOld(params: filterDto) {
        const { search = '', page = 1, pageSize = 10 } = params;
        const skip = (page - 1) * pageSize;

        const where: Prisma.CompanyMasterWhereInput = {
            status: statusWhereClause,
            ...(search
                ? {
                    OR: [
                        { companyName: { contains: search, mode: 'insensitive' } },
                        { companyCode: { contains: search, mode: 'insensitive' } },
                        { addressLine1: { contains: search, mode: 'insensitive' } },
                        { email: { contains: search, mode: 'insensitive' } },
                        { phoneNumber: { contains: search, mode: 'insensitive' } },
                        { Pan: { contains: search, mode: 'insensitive' } },
                        { status: { contains: search, mode: 'insensitive' } },
                        {
                            stateMaster: {
                                stateName: { contains: search, mode: 'insensitive' }
                            }
                        },
                        {
                            countryMaster: {
                                countryName: { contains: search, mode: 'insensitive' }
                            }
                        },
                        {
                            branchMaster: {
                                some: {
                                    branchName: { contains: search, mode: 'insensitive' }
                                }
                            }
                        },
                        {
                            branchMaster: {
                                some: {
                                    cityMaster: {
                                        cityName: { contains: search, mode: 'insensitive' }
                                    }
                                }
                            }
                        }
                    ]
                }
                : {}
            ),
        };

        const [items, totalCount] = await this._db.$transaction([
            this._db.companyMaster.findMany({
                where,
                skip,
                take: pageSize,
                include: {
                    branchMaster: {
                        where: {
                            status: 'A'
                        },
                        include: {
                            branchBank: {
                                where: {
                                    status: 'A'
                                }
                            },
                            countryMaster: true,
                            stateMaster: true,
                            cityMaster: true
                        }
                    },
                    countryMaster: true,
                    stateMaster: true,
                    currencyMaster: true
                },
                orderBy: { CompanyMasterSid: 'desc' },
            }),
            this._db.companyMaster.count({ where }),
        ]);

        return {
            items,
            totalCount,
        };

    }


    async searchCompany(params: filterDto) {
        const { search = '', page = 1, pageSize = 10 } = params;
        const skip = (page - 1) * pageSize;

        const branchWhere: Prisma.BranchMasterWhereInput = {
            status: statusWhereClause,
            company: {
                status: 'A'
            },
            ...(search
                ? {
                    OR: [
                        { branchName: { contains: search, mode: 'insensitive' } },
                        { branchCode: { contains: search, mode: 'insensitive' } },
                        { taxRegistrationNo: { contains: search, mode: 'insensitive' } },
                        { cityMaster: { cityName: { contains: search, mode: 'insensitive' } } },
                        { stateMaster: { stateName: { contains: search, mode: 'insensitive' } } },
                        { countryMaster: { countryName: { contains: search, mode: 'insensitive' } } },
                        {
                            company: {
                                OR: [
                                    { companyName: { contains: search, mode: 'insensitive' } },
                                    { companyCode: { contains: search, mode: 'insensitive' } }
                                ]
                            }
                        }
                    ]
                }
                : {}),
        };

        let branches;
        let totalCount;
        [branches, totalCount] = await this._db.$transaction([
            this._db.branchMaster.findMany({
                where: branchWhere,
                orderBy: { company: { CompanyMasterSid: 'desc' } },
                skip,
                take: pageSize,
            }),
            this._db.branchMaster.count({
                where: branchWhere,
            }),
        ]);

        branches = await Promise.all(
            branches.map(async (branch) => {
                const [company, countryMaster, stateMaster, cityMaster] = await Promise.all([

                    branch.CompanyMasterSid !== null ?
                        this.globalConfigService.getMasterData('company_master', branch.CompanyMasterSid, branch.CompanyMasterSid) :
                        { CompanyMasterSid: null, companyName: '', companyCode: '' },

                    branch.CountryMasterSid !== null ?
                        this.globalConfigService.getMasterData('country_master', branch.CountryMasterSid) :
                        { CountryMasterSid: null, countryName: '' },

                    branch.StateMasterSid !== null ?
                        this.globalConfigService.getMasterData('state_master', branch.StateMasterSid) :
                        { StateMasterSid: null, stateName: '' },

                    branch.CityMasterSid !== null ?
                        this.globalConfigService.getMasterData('city_master', branch.CityMasterSid) :
                        { CityMasterSid: null, cityName: '' }
                ])

                return {
                    CompanyMasterSid: company.CompanyMasterSid,
                    companyName: company.companyName,
                    companyCode: company.companyCode,
                    branchName: branch.branchName,
                    city: cityMaster.cityName || '',
                    state: stateMaster.stateName || '',
                    country: countryMaster.countryName || '',
                    gst: branch.taxRegistrationNo,
                    status: branch.status === 'A' ? 'Active' : 'Suspended',
                }
            })
        )

        return {
            items: branches,
            totalCount,
        };
    }

    async getAuditLogs(tableName: string, recordId?: string) {
        try {
            const whereClause: any = { tableName };
            if (recordId) whereClause.recordId = recordId;

            const logs = await this._db.auditLog.findMany({
                where: whereClause,
                orderBy: { changedAt: 'desc' },
            });

            return logs.filter(log => log.oldVal !== log.newVal);
        } catch (error) {
            this.logger.warn(`getAuditLogsError: ${error}`);
            throw new Error(`Error fetching audit logs: ${error.message}`);
        }
    }

    async getBankDetails(payload: any) {
        try {
            const bankDetails = await this._db.branchBank.findFirst({
                where: {
                    BranchMasterSid: payload.BranchMasterSid,
                    CurrencyMasterSid : payload.CurrencyMasterSid,
                    status: 'A'
                }
            });
            return bankDetails;
        } catch (error) {
            throw error;
        }
    }

    async syncCompanyCurrencyWithConfig(
        CompanyMasterSid: number | null,   // null during CREATE
        config: any,
        CurrencyMasterSid: number,
        txn?: Prisma.TransactionClient
    ) {
        try {
            const prisma = txn ?? this._db;

            // 1. Validate currency
            const currency = await prisma.currencyMaster.findUnique({
                where: { CurrencyMasterSid }
            });

            if (!currency) {
                throw new BadRequestException('Currency not found');
            }

            // 2. Read existing config only during UPDATE
            let existingConfig: any = {};

            if (CompanyMasterSid) {
                const company = await prisma.companyMaster.findUnique({
                    where: { CompanyMasterSid },
                    select: { config: true }
                });

                existingConfig = company?.config || {};
            }

            // 3. Merge config safely (only currency)
            const finalConfig = {
                ...existingConfig,
                ...config,
                systemSettings: {
                    ...(existingConfig?.systemSettings || {}),
                    ...(config?.systemSettings || {}),
                    currency: {
                        currencyMasterSid: currency.CurrencyMasterSid,
                        code: currency.currencyCode,
                        symbol: currency.Symbol,
                        position: 'before',
                        decimalPlaces: currency.amountDecimal ?? 2
                    }
                }
            };

            // 4. Update company only when CompanyMasterSid exists (UPDATE flow)
            if (CompanyMasterSid) {
                return await prisma.companyMaster.update({
                    where: { CompanyMasterSid },
                    data: {
                        CurrencyMasterSid: currency.CurrencyMasterSid,
                        config: finalConfig
                    }
                });
            }

            // 5. Return values for CREATE flow
            return {
                CurrencyMasterSid: currency.CurrencyMasterSid,
                config: finalConfig
            };

        } catch (error) {
            throw error;
        }
    }
}
interface Company {
    CompanyMasterSid: number;
}

interface Branch {
    BranchMasterSid: number;
    branchName: string;
    branchCode: string;
    createdOn: Date;
    updatedOn: Date;
    //   deletedAt: Date | null;
    createdBy: string;
    updatedBy: string | null;
    taxRegistrationNo: string | null;
    CISN: string | null;
    addressLine1: string;
    addressLine2: string | null;
    postalCode: string;
    webSite: string | null;
    phoneNumber: string | null;
    email: string | null;
    timeZone: string | null;
    remarks: string | null;
    companyLogo: string | null;
    reportLogo: string | null;
    status: string;
    CityMasterSid: number;
    CompanyMasterSid: number;
    CountryMasterSid: number;
    CurrencyMasterSid: number | null;
    LoginSid: number | null;
    StateMasterSid: number;

    branchBank?: any[];
}

interface Bank {

}
interface BankCreateInput {
    BranchBankSid: number;
    createdOn: Date;
    updatedOn: Date | null;
    BankName: string;
    BankCode: string;
    BankAddress?: string | null;
    IFSCCode: string;
    BankAccountNo: string;
    status: string;
    Remarks?: string | null;
    BranchMasterSid: number;
    createdBy: string;
    // Add other required fields from your Prisma schema
}
// Define interfaces at the top level of your file or in a separate types file
interface BankCreateInput {
    BankName: string;
    BankCode: string;
    BankAddress?: string | null;
    IFSCCode: string;
    BankAccountNo: string;
    status: string;
    Remarks?: string | null;
    BranchMasterSid: number;
    createdBy: string;
}

interface BranchWithBanks extends Omit<Branch, 'branchBank'> {
    banks: BankCreateInput[];
}

interface CompanyCreationResult {
    company: Company;
    branches: BranchWithBanks[];
}


// Interfaces
interface BankCreateInput {
    BankName: string;
    BankCode: string;
    BankAddress?: string | null;
    IFSCCode: string;
    BankAccountNo: string;
    status: string;
    Remarks?: string | null;
    BranchMasterSid: number;
    createdBy: string;
}

interface BranchWithBanks extends Omit<Branch, 'branchBank'> {
    banks: BankCreateInput[];
}

interface CompanyUpdateInput {
    companyName?: string;
    companyCode?: string;
    CountryMasterSid?: number;
    CurrencyMasterSid?: number;
    addressLine1?: string;
    webSite?: string | null;
    email?: string | null;
    phoneNumber?: string | null;
    Pan?: string | null;
    isHo?: boolean;
    status?: string;
    remarks?: string | null;
    StateMasterSid?: number;
    updatedBy?: string;
}

interface CompanyCreationResult {
    company: Company;
    branches: BranchWithBanks[];
}
