import { BadRequestException, Injectable } from '@nestjs/common';
import { DatabaseService } from 'src/database/database.service';
import { SearchListDto } from 'src/masters/DTO/search-list.dto';

@Injectable()
export class CompanyService {
    constructor(private _db: DatabaseService) { }

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
                StateMasterSid: newData.StateMasterSid,
                createdBy: user.userEmail
            };

            const result = await this._db.$transaction(async (prisma) => {
                // 2. Create Company
                console.log('Creating company:', companyPayload);
                const createdCompany = await prisma.companyMaster.create({
                    data: companyPayload
                });
                console.log('Company created with ID:', createdCompany.CompanyMasterSid);

                // 3. Create Branches and Banks
                const createdBranches: BranchWithBanks[] = [];

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
                        let createdBanks : any;
                        if (branchData.branchBank && branchData.branchBank.length > 0) {
                            console.log('Creating banks for branch:', branchData.branchBank);

                            const bankCreateData = branchData.branchBank.map(bank => ({
                                BankName: bank.BankName,
                                BankCode: bank.BankCode,
                                BankAddress: bank.BankAddress || null,
                                IFSCCode: bank.IFSCCode,
                                BankAccountNo: bank.BankAccountNo,
                                BeneficiaryName: bank.BeneficiaryName,
                                status: bank.status,
                                Remarks: bank.Remarks || null,
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
                    status : 'A'
                },
                include: {
                    branchMaster: {
                        include: {
                            branchBank: {
                                where: {
                                    status : 'A'
                                }
                            }
                        },
                        where: {
                            status : 'A'
                        }
                    },

                }
            })
            return allCompanies;
        } catch (error) {
            throw error;
        }
    }

    async newSearch(){
        try {
            const allData = await this._db.companyMaster.findMany({
                where : {
                    deletedAt : null,
                },
                include :{
                    branchMaster : {
                        where : {
                            deletedAt : null,
                        },
                        include : {
                            branchBank : {
                                where : {
                                    deletedAt : null
                                }
                            },
                            countryMaster : true,
                            stateMaster : true,
                            cityMaster : true
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
                        where : {
                            deletedAt : null,
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
                                where : {
                                    deletedAt : null
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

            // Check if already name exist
            const existing = await this._db.companyMaster.findFirst({
                where: {
                    AND : [
                        {
                            CompanyMasterSid : {
                                not : companySid
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
                StateMasterSid: updateData.StateMasterSid,
                updatedBy: user.userEmail
            };

            const result = await this._db.$transaction(async (prisma) => {
                // 2. Update Company
                const updatedCompany = await prisma.companyMaster.update({
                    where: { CompanyMasterSid: companySid },
                    data: companyPayload
                });

                // 3. Get existing branches
                const existingBranches = await prisma.branchMaster.findMany({
                    where: { CompanyMasterSid: companySid, deletedAt: null },
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
                                BeneficiaryName: bank.BeneficiaryName,
                                status: bank.status,
                                Remarks: bank.Remarks || null,
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
                            deletedAt: new Date(),
                            updatedBy: user.userEmail
                        }
                    });

                    await prisma.branchMaster.updateMany({
                        where: {
                            BranchMasterSid: { in: branchesToDelete },
                            CompanyMasterSid: companySid
                        },
                        data: {
                            deletedAt: new Date(),
                            updatedBy: user.userEmail,
                            status: 'I'
                        }
                    });
                }

                return {
                    company: updatedCompany,
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
        if (existing.deletedAt) {
            throw new BadRequestException(`Company with id : ${CompanyMasterSid} is already deleted.`);
        }

        const result = await this._db.$transaction(async (prisma) => {
            // Soft delete the company
            const company = await prisma.companyMaster.update({
                where: {
                    CompanyMasterSid: CompanyMasterSid
                },
                data: {
                    deletedAt: new Date()
                }
            });

            // Find all branches for this company
            const existingBranches = await prisma.branchMaster.findMany({
                where: {
                    CompanyMasterSid: CompanyMasterSid,
                    deletedAt: null
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
                            deletedAt: new Date()
                        }
                    });

                    const deletedBanks = await prisma.branchBank.updateManyAndReturn({
                        where: {
                            BranchMasterSid: branch.BranchMasterSid,
                            deletedAt: null
                        },
                        data: {
                            deletedAt: new Date()
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

    async searchCompany(data: SearchListDto) {
        const { searchType, filterValue } = data;
        const acceptedType = [
            "companyName",
            "companyCode",
            "addressLine1",
            "addressLine2",
            "postal_code",
            "webSite",
            "phoneNumber",
            "email",
            "isHo",
            "companyLogo",
            "reportLogo",
            "status"
        ];
        if (!acceptedType.includes(searchType)) {
            throw new BadRequestException(`Invalid Search Type`);
        }
        const searchResults = await this._db.companyMaster.findMany({
            where: {
                [searchType]: {
                    contains: filterValue,
                    mode: 'insensitive'
                }, deletedAt: null
            }, 
            include: {
                branchMaster: {
                    where: {
                        deletedAt: null
                    },
                    include: {
                        branchBank: {
                            where: {
                                deletedAt: null
                            }
                        },
                        cityMaster: {
                            select: {
                                cityName: true
                            }
                        },
                        stateMaster: {
                            select: {
                                stateName: true
                            }
                        },
                        countryMaster: {
                            select: {
                                countryName: true
                            }
                        }
                    },
                },
            },
            orderBy : {
                branchMaster : {
                    _count : 'desc'
                }
            }
        }
        ).catch((err) => {
            throw new Error(`Error Occured : ${JSON.stringify(err), err}`);
        })
        return searchResults;
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
  deletedAt: Date | null;
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
    BeneficiaryName: string;
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
  BeneficiaryName: string;
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
  BeneficiaryName: string;
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
