import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { equal } from 'node:assert';
import { statusWhereClause } from 'src/common/helper';
import { DatabaseService } from 'src/database/database.service';
import { SearchListDto } from 'src/masters/DTO/search-list.dto';
import { filterDto } from 'src/masters/DTO/search-vessel.dto';

@Injectable()
export class SubledgermasterService {
    constructor(private _db: DatabaseService, private logger: Logger) { }

    async getAllSuledgermaster() {
        try {
            const allSubledgermaster = await this._db.subledgerMaster.findMany({
                where: {
                    Status: "A",
                }
            })
            return allSubledgermaster;
        } catch (error) {
            throw error;
        }
    }

    async createNewSubledgerMaster(payload) {
        try {
            const createdSubledgerMaster = await this._db.subledgerMaster.create({
                data: {
                    ...payload,
                }
            })
            return createdSubledgerMaster;
        } catch (error) {
            throw error;
        }
    }

    async fetchSubledgerMasterId(SubledgerMasterSid: number) {
        try {
            const ourSubledgerMaster = await this._db.subledgerMaster.findUnique({
                where: {
                    SubledgerMasterSid: SubledgerMasterSid
                }
            })
            if (!ourSubledgerMaster) {
                throw new BadRequestException(`SubledgerMaster with Id : ${SubledgerMasterSid} not exists`);
            }
            return ourSubledgerMaster;
        } catch (error) {
            throw error;
        }
    }

    async updateSubledgerMasterById(SubledgerMasterSid: number, payload) {
        try {
            const exist = await this._db.subledgerMaster.findUnique({
                where: {
                    SubledgerMasterSid: SubledgerMasterSid
                }
            })
            if (!exist) {
                throw new BadRequestException(`SubledgerMaster with Id : ${SubledgerMasterSid} not exists`);
            }
            const updatedSuledgerMaster = await this._db.subledgerMaster.update({
                where: {
                    SubledgerMasterSid: SubledgerMasterSid
                },
                data: payload
            })
            return updatedSuledgerMaster;
        } catch (error) {
            throw error;
        }
    }

    async deleteSudledgerMaster(SubledgerMasterSid: number) {
        try {
            const exist = await this._db.subledgerMaster.findUnique({
                where: {
                    SubledgerMasterSid: SubledgerMasterSid
                }
            })
            if (!exist) {
                throw new BadRequestException(`SubledgerMaster with Id : ${SubledgerMasterSid} not exists`);
            }
            if (exist.Status === "D") {
                throw new BadRequestException(`SubledgerMaster with Id :${SubledgerMasterSid} is already deleted`)
            }
            const deletedSuledgerMaster = await this._db.subledgerMaster.update({
                where: {
                    SubledgerMasterSid: SubledgerMasterSid
                },
                data: {
                    Status: "D"
                }
            })
            return deletedSuledgerMaster;
        } catch (error) {
            throw error;
        }
    }

    async searchSubledgerMaster(params: filterDto) {
        const { search = '', page = 1, pageSize = 10 } = params;
        const skip = (page - 1) * pageSize;

        const where: Prisma.SubledgerMasterWhereInput = {
            Status: statusWhereClause,
            ...(search.trim() ? {
                OR: [
                    { CoaMaster: { LedgerCode: { contains: search, mode: 'insensitive' } } },
                    { CoaMaster: { LedgerName: { contains: search, mode: 'insensitive' } } },
                    {
                        CoaMaster: {
                            CompanyMaster: {
                                branchMaster: {
                                    some: {
                                        branchName: { contains: search, mode: 'insensitive' }
                                    }
                                }
                            }
                        }
                    },
                    {
                        CoaMaster: {
                            CurrencyMaster: {
                                currencyName: { contains: search, mode: 'insensitive' }
                            }
                        }
                    },
                ]
            } : {})
        };

        const include = {
            CoaMaster: {
                include: {
                    CompanyMaster: {
                        include: {
                            branchMaster: {
                                select: {
                                    branchName: true
                                }
                            }
                        }
                    },
                    CurrencyMaster: {
                        select: {
                            currencyName: true
                        }
                    }
                }
            }
        };

        const [items, totalCount] = await this._db.$transaction([
            this._db.subledgerMaster.findMany({
                where,
                skip,
                take: pageSize,
                orderBy: { SubledgerMasterSid: 'desc' },
                include
            }),
            this._db.subledgerMaster.count({ where }),
        ]);

        return {
            items,
            totalCount,
            totalPages: Math.ceil(totalCount / pageSize),
            currentPage: page,
            pageSize
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

            return logs;
        } catch (error) {
            this.logger.warn(`getAuditLogsError: ${error}`);
            throw new Error(`Error fetching audit logs: ${error.message}`);
        }
    }

    // New methods for Party and Charge tabs
    async getSubledgerMasterByType(subledgerType: string) {
        try {
            const subledgers = await this._db.subledgerMaster.findMany({
                where: {
                    SubledgerType: subledgerType,
                    Status: { in: ["A", "S"] } // Include both Active and Suspended
                },
                include: {
                    CoaMaster: {
                        include: {
                            CurrencyMaster: {
                                select: {
                                    currencyName: true,
                                    currencyCode: true
                                }
                            }
                        }
                    },
                    departmentMaster: true
                }
            });
            return subledgers;
        } catch (error) {
            throw error;
        }
    }

    async bulkUpdateSubledgerMaster(updates: any[]) {
        try {
            const results = [];
            
            for (const update of updates) {
                const { SubledgerMasterSid, ...updateData } = update;
                
                const exist = await this._db.subledgerMaster.findUnique({
                    where: { SubledgerMasterSid }
                });
                
                if (!exist) {
                    throw new BadRequestException(`SubledgerMaster with Id: ${SubledgerMasterSid} not exists`);
                }
                
                const updated = await this._db.subledgerMaster.update({
                    where: { SubledgerMasterSid },
                    data: updateData
                });
                
                // results.push(updated);
            }
            
            return results;
        } catch (error) {
            throw error;
        }
    }

   async getAllMappedCustomerCreditors(payload : any) {
    try {
        const allCustomerCreditors = await this._db.subledgerMaster.findMany({
            where: {
                Status: "A",
                SubledgerType : "Customer",
                CrCOAMasterSid : { not : null},
                SubledgerMappingSid : {not : null},
                CompanyMasterSid : payload.CompanyMasterSid
            },
            select : {
                SubledgerMasterSid: true, // ADD THIS
                SubledgerMappingSid : true,
                CrCOAMasterSid : true
            }
        })
        const allMappedCustomerSubledgersIds = allCustomerCreditors.map(customerCreditor => customerCreditor.SubledgerMappingSid!);

        // Create a map of Customer to Ledger mapping INCLUDING SubledgerMasterSid
        const ledgerToCustomerMapping = new Map<number, { crCOAMasterSid: number, subledgerMasterSid: number }>();
        allCustomerCreditors.forEach(customerCreditor => {
            ledgerToCustomerMapping.set(customerCreditor.SubledgerMappingSid!, {
                crCOAMasterSid: customerCreditor.CrCOAMasterSid!,
                subledgerMasterSid: customerCreditor.SubledgerMasterSid // ADD THIS
            });
        });

        // Get all customers with subledger mapped
        const allCreditors = await this._db.customerMaster.findMany({
            where : {
                CustomerMasterSid : { in : allMappedCustomerSubledgersIds},
                CompanyMasterSid : payload.CompanyMasterSid
            },
            select: {
                CustomerMasterSid: true,
                CustomerName: true,
                CustomerAddress1: true,
                PanType: true,
                countryMaster: {
                    where: { status: 'A' },
                    select: {
                        CountryMasterSid: true,
                        countryName: true,
                        countryCode: true
                    }
                },
                CustomerBranch: {
                    where: { status: 'A' },
                    select: {
                        CustomerBranchSid: true,
                        BranchName: true,
                        Address: true,
                        Email: true,
                        GSTNo: true,
                        stateMaster:{
                            select:{
                                StateMasterSid : true,
                                stateName : true,
                                stateCode : true
                            }
                        }
                    }
                }
            }
        })
        
        return allCreditors.flatMap(deptor =>{
            const mapping = ledgerToCustomerMapping.get(deptor.CustomerMasterSid);
            return deptor.CustomerBranch.map(branch => {
                return {
                    CustomerMasterSid : deptor.CustomerMasterSid,
                    CustomerBranchSid : branch.CustomerBranchSid,
                    BranchName : branch.BranchName,
                    PanType: deptor.PanType,
                    countryMaster: deptor.countryMaster,
                    GSTNo : branch.GSTNo,
                    CustomerName : deptor.CustomerName,
                    Address : branch.Address,
                    Email : branch.Email,
                    stateMaster : branch.stateMaster,
                    COAMappedId : mapping?.crCOAMasterSid,
                    SubledgerMasterSid: mapping?.subledgerMasterSid // ADD THIS
                }
            })
        });
    } catch (error) {
        throw error;
    }
}

    // Used in Cost - Revenue
    async getAllMappedCustomerDebtors(payload:any){
        try {
            const allCustomerDebtors = await this._db.subledgerMaster.findMany({
                where: {
                    Status: "A",
                    SubledgerType : "Customer",
                    DrCOAMasterSid : { not : null},
                    SubledgerMappingSid : {not : null},
                    CompanyMasterSid : payload.CompanyMasterSid
                },
                select : {
                    SubledgerMappingSid : true,
                    DrCOAMasterSid : true
                }
            })
            const allMappedCustomerSubledgersIds = allCustomerDebtors.map(customerDebtor => customerDebtor.SubledgerMappingSid!);

            // Create a map of Customer to Ledger mapping
            const ledgerToCustomerMapping = new Map<number, number>();
            allCustomerDebtors.forEach(customerDebtor => {
                ledgerToCustomerMapping.set(customerDebtor.SubledgerMappingSid!, customerDebtor.DrCOAMasterSid!);
            });

            // Get all customers with subleder mapped
            const allDebtors = await this._db.customerMaster.findMany({
                where : {
                    CustomerMasterSid : { in : allMappedCustomerSubledgersIds},
                    CompanyMasterSid : payload.CompanyMasterSid
                },
                select : {
                    CustomerMasterSid : true,
                    CustomerName : true,
                    CustomerAddress1 : true,
                    PanType: true,
                    countryMaster:{
                        where : {status : 'A'},
                        select : {
                            CountryMasterSid : true,
                            countryName : true,
                            countryCode : true
                        }
                    },
                    CustomerBranch : {
                        where : {status : 'A'},
                        select : {
                            CustomerBranchSid : true,
                            BranchName : true,
                            Address : true,
                            Email : true,
                            GSTNo : true
                        }
                    }
                }
            })
            return allDebtors.flatMap(deptor =>{
                const COAMappedId = ledgerToCustomerMapping.get(deptor.CustomerMasterSid);
                return deptor.CustomerBranch.map(branch => {
                    return {
                        CustomerMasterSid : deptor.CustomerMasterSid,
                        CustomerBranchSid : branch.CustomerBranchSid,
                        BranchName : branch.BranchName,
                        PanType : deptor.PanType,
                        countryMaster: deptor.countryMaster,
                        GSTNo : branch.GSTNo,
                        CustomerName : deptor.CustomerName,
                        Address : branch.Address,
                        Email : branch.Email,
                        COAMappedId : COAMappedId
                    }
                })
            });
        } catch (error) {
            throw error;
        }
    }
    async getAllMappedChargeDebtors(payload: any) {
    try {
        const allChargeDebtors = await this._db.subledgerMaster.findMany({
            where: {
                Status: "A",
                SubledgerType: "Charge",
                DrCOAMasterSid: { not: null },
                SubledgerMappingSid: { not: null },
                CompanyMasterSid: payload.CompanyMasterSid,
            },
            select: {
                
                SubledgerMasterSid: true,
                SubledgerMappingSid: true,
                DrCOAMasterSid: true
            }
        });

        const allMappedChargeSubledgersIds = allChargeDebtors.map(chargeDebtor => chargeDebtor.SubledgerMappingSid!);

        // Create a map of Charge to Ledger mapping INCLUDING SubledgerMasterSid
        const ledgerToChargeMapping = new Map<number, { DrCOAMasterSid: number, subledgerMasterSid: number  }>();
        allChargeDebtors.forEach(chargeDebtor => {
            ledgerToChargeMapping.set(chargeDebtor.SubledgerMappingSid!, {
                DrCOAMasterSid: chargeDebtor.DrCOAMasterSid!,
                subledgerMasterSid: chargeDebtor.SubledgerMasterSid                                                    
            });
        });

        // Get all charges with subledger mapped
        const allDebtors = await this._db.chargeMaster.findMany({
            where: {
                ChargeMasterSid: { in: allMappedChargeSubledgersIds },
                CompanyMasterSid: payload.CompanyMasterSid
            },
            select: {
                ChargeMasterSid: true,
                chargeCode: true,
                chargeName: true,  
                UOM: true,
                chargeTaxMaster: {
                    where: {
                        Status: "A"
                    },
                    select: {
                        HSNCode: true,
                        description: true,
                        TaxRate: true,
                        ChargeTaxMasterSid: true,
                        CompanyMasterSid: true,
                        Status: true
                    }
                },
                chargeTds: {
                    where: {
                        status: "A"
                    },
                    select: {
                        ChargeTdsSid: true,
                        TDSSet: true,
                        EffectiveFrom: true,
                    }
                }
            }
        });

        return allDebtors.map(charge => {
            const mapping = ledgerToChargeMapping.get(charge.ChargeMasterSid);
            return {
                ChargeMasterSid: charge.ChargeMasterSid,
                chargeCode: charge.chargeCode,
                chargeName: charge.chargeName,
                UOM: charge.UOM,
                ChargeTaxMaster: charge.chargeTaxMaster,
                ChargeTds: charge.chargeTds,
                DrCOAMappedId: mapping?.DrCOAMasterSid,
                SubledgerMasterSid: mapping?.subledgerMasterSid,
            };
        });

    } catch (error) {
        throw error;
    }
}
    
}