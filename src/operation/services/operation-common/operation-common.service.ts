
import { BadRequestException, Injectable } from '@nestjs/common';
import { DatabaseService } from 'src/database/database.service';

interface CostRevenueDTO {
    MenuMasterSid ?: number,
    CompanyMasterSid ?: number,
    BranchMasterSid ?: number,
    TransactionSid ?: number
}


export interface RateDTO {
    CompanyMasterSid ?: number,
    BranchMasterSid ?: number,
    BookingHeaderSid?: number
}

interface ShipmentMilestoneDTO {
    CompanyMasterSid ?: number,
    BranchMasterSid ?: number,
    ShipmentNo ?: string
}

@Injectable()
export class OperationCommonService {
    constructor(private _db:DatabaseService){}

    async createCostRevenueCharges(payload:any){
        try {
            let result;

            // If it is an array , then createMany
            if(payload instanceof Array){
                result = await this._db.costRevenueCharges.createMany({
                    data : payload
                })
            }

            // if it is an Object , then create
            if(payload instanceof Object){
                result = await this._db.costRevenueCharges.create({
                    data : payload
                })
            }

            return result;
        } catch (error) {
            throw error;
        }
    }

    async getAllCostRevenueCharges(payload: CostRevenueDTO) {
        try {
            const { MenuMasterSid, CompanyMasterSid, BranchMasterSid, TransactionSid } = payload;
            const allCostRevenueCharges = await this._db.costRevenueCharges.findMany({
                where: {
                    TransactionSid,
                    MenuMasterSid,
                    CompanyMasterSid,
                    BranchMasterSid,
                    status: 'A'
                },
                include: {
                    revenueVoucherHeader: {
                        select: {
                            VoucherNumber: true,
                            VoucherHeaderSid: true
                        }
                    },
                    revenueVoucherTypeMaster: {
                        select: {
                            DocumentTypeName: true,
                            VoucherTypeMasterSid: true
                        }
                    },
                    costVoucherHeader: {
                        select: {
                            VoucherNumber: true,
                            VoucherHeaderSid: true
                        }
                    },
                    costVoucherTypeMaster: {
                        select: {
                            DocumentTypeName: true,
                            VoucherTypeMasterSid: true
                        }
                    },
                    revenueCustomerMaster : {
                        select : {
                            CustomerMasterSid : true,
                            CustomerName : true,
                        }
                    },
                    costCustomerMaster : {
                        select : {
                            CustomerMasterSid : true,
                            CustomerName : true
                        }
                    }
                },
                orderBy: {
                    SerialNumber: 'asc'
                }
            })
            return allCostRevenueCharges;
        } catch (error) {
            throw error;
        }
    }

    // Used in Cost - Revenue for Voucher Generation
    async   getCostRevenueChargesWithDetails(payload:{MenuMasterSid:number,TransactionSid:number,modelName:string}){
        try {
            let { MenuMasterSid , TransactionSid ,modelName } = payload;
            if(!TransactionSid){
                throw new BadRequestException("Transaction SID is required");
            }
            if(MenuMasterSid === -1){
                // Possiblilty for HouseJob
                if(!modelName){
                    throw new BadRequestException("Model Name is required");
                }
                const menuConfig = await this._db.menuConfig.findFirst({
                    where : {
                        ModelName : modelName
                    }
                })
                if(!menuConfig || !menuConfig.MenuMasterSid){
                    throw new BadRequestException("Menu Master SID is required");
                }
                MenuMasterSid = menuConfig.MenuMasterSid;
            }
            const allCostRevenueCharges = await this._db.costRevenueCharges.findMany({
                where : {
                    MenuMasterSid,
                    TransactionSid,
                    status : 'A'
                },
                include : {
                    companyMaster : {
                        select : {
                            CompanyMasterSid : true,
                            companyName : true,
                            CountryMasterSid : true
                        }
                    },
                    branchMaster : {
                        select : {
                            BranchMasterSid : true,
                            branchName : true,
                            StateMasterSid : true
                        }
                    },
                    chargeMaster : {
                        select : {
                            ChargeMasterSid : true,
                            chargeCode : true,
                            chargeName : true,
                            HSNSAC : true,
                            chargeTaxMaster : {
                                select : {
                                    ChargeTaxMasterSid : true,
                                    HSNCode : true,
                                    description : true,
                                    TaxGroup : true,
                                    TaxRate : true
                                }
                            }
                        }
                    },
                    revenueCurrencyMaster : {
                        select : {
                            CurrencyMasterSid : true,
                            currencyName : true,
                            currencyCode : true,
                            countryMaster : {
                                select : {
                                    CountryMasterSid : true,
                                    countryName : true,
                                    countryCode : true
                                }
                            }
                        }
                    },
                    costCurrencyMaster : {
                        select : {
                            CurrencyMasterSid : true,
                            currencyName : true,
                            currencyCode : true,
                            countryMaster : {
                                select : {
                                    CountryMasterSid : true,
                                    countryName : true,
                                    countryCode : true
                                }
                            }
                        }
                    },
                    revenueCustomerMaster : {
                        select : {
                            CustomerMasterSid : true,
                            CustomerName : true,
                            CustomerAddress1 : true,
                            CustomerAddress2 : true,
                            PanType : true,
                            CountryMasterSid : true,
                            countryMaster : {
                                select : {
                                    CountryMasterSid : true,
                                    countryName : true,
                                    countryCode : true
                                }
                            }
                        }
                    },
                    revenueCustomerBranch : {
                        select : {
                            CustomerBranchSid : true,
                            Address : true,
                            stateMaster : {
                                select : { stateName : true},
                            },
                            cityMaster : {select : {cityName : true}},
                            Zip_PostBox : true,
                            GSTNo : true,
                            Registered : true,
                        }
                    },
                    costCustomerMaster : {
                        select : {
                            CustomerMasterSid : true,
                            CustomerName : true,
                            CustomerAddress1 : true,
                            CustomerAddress2 : true,
                            PanType : true,
                            countryMaster : {
                                select : {
                                    CountryMasterSid : true,
                                    countryName : true,
                                    countryCode : true
                                }
                            }
                        }
                    },
                    costCustomerBranch : {
                        select : {
                            CustomerBranchSid : true,
                            Address : true,
                            StateMasterSid : true,
                            GSTNo : true,
                            Registered : true,
                        }
                    },
                    costVoucherHeader : {
                        select : {
                            VoucherHeaderSid : true,
                            VoucherNumber : true
                        }
                    },
                    revenueVoucherHeader : {
                        select : {
                            VoucherHeaderSid : true,
                            VoucherNumber : true
                        }
                    },
                    revenueVoucherTypeMaster : {
                        select : {
                            VoucherTypeMasterSid : true,
                            DocumentTypeName : true
                        }
                    },
                    costVoucherTypeMaster : {
                        select : {
                            VoucherTypeMasterSid : true,
                            DocumentTypeName : true
                        }
                    },
                },
                orderBy : {
                    SerialNumber : 'asc'
                }
            });

            // Formatted data
            const formattedData = allCostRevenueCharges.map(charge => {
                const {companyMaster,branchMaster,chargeMaster,revenueCurrencyMaster,costCurrencyMaster,revenueCustomerMaster,revenueCustomerBranch,costCustomerMaster,costCustomerBranch,costVoucherHeader,revenueVoucherHeader,costVoucherTypeMaster,revenueVoucherTypeMaster,...chargeData} = charge;
                return {
                    ...chargeData,
                    companyMaster,
                    BranchMaster : branchMaster,
                    ChargeMaster : chargeMaster,
                    RevenueCurrencyMaster : revenueCurrencyMaster,
                    CostCurrencyMaster : costCurrencyMaster,
                    customerMasterBP : revenueCustomerMaster,
                    customerBranch : revenueCustomerBranch,
                    AgentMaster : costCustomerMaster,
                    AgentBranch : costCustomerBranch,
                    costVoucherHeader : costVoucherHeader,
                    revenueVoucherHeader : revenueVoucherHeader,
                    costVoucherTypeMaster : costVoucherTypeMaster,
                    revenueVoucherTypeMaster : revenueVoucherTypeMaster,
                }
            });
            return formattedData;
        } catch (error) {
            throw error;
        }
    }

    async getAllRateCharges(payload:RateDTO){
        try {
            const { CompanyMasterSid , BranchMasterSid, BookingHeaderSid } = payload;
            const allCostRevenueCharges = await this._db.bookingRates.findMany({
                where : {
                    CompanyMasterSid,
                    BranchMasterSid,
                    BookingHeaderSid,
                    Status : 'A'
                },
                include: {
                    revenueVoucherHeader: {
                        select: {
                            VoucherNumber: true,
                            VoucherHeaderSid: true
                        }
                    },
                    revenueVoucherTypeMaster: {
                        select: {
                            DocumentTypeName: true,
                            VoucherTypeMasterSid: true
                        }
                    },
                    costVoucherHeader: {
                        select: {
                            VoucherNumber: true,
                            VoucherHeaderSid: true
                        }
                    },
                    costVoucherTypeMaster: {
                        select: {
                            DocumentTypeName: true,
                            VoucherTypeMasterSid: true
                        }
                    }
                }
            });

            // Enrich with ChargeMaster and chargeTaxMaster data
            const enrichedRates = await Promise.all(allCostRevenueCharges.map(async (rate) => {
                let chargeMasterData: any = null;

                if (rate.ChargeMasterSid) {
                    chargeMasterData = await this._db.chargeMaster.findUnique({
                        where: { ChargeMasterSid: rate.ChargeMasterSid },
                        select: {
                            ChargeMasterSid: true,
                            chargeCode: true,
                            chargeName: true,
                            HSNSAC: true,
                            chargeTaxMaster: {
                                select: {
                                    ChargeTaxMasterSid: true,
                                    HSNCode: true,
                                    description: true,
                                    TaxGroup: true,
                                    TaxRate: true
                                }
                            }
                        }
                    });
                }

                return {
                    ...rate,
                    ChargeMaster: chargeMasterData
                };
            }));

            return enrichedRates;
        } catch (error) {
            throw error;
        }
    }

    async createShipmentMilestone(payload){
        try {
            let result;
            if(result instanceof Array){
                result = await this._db.shipmentMilestone.createMany({
                    data : payload
                })
            } 
            if(result instanceof Object){
                result = await this._db.shipmentMilestone.create({
                    data:payload
                })
            }
            return result;
        } catch (error) {
            throw error;
        }
    }

    async getAllShipmentMilestones(payload:ShipmentMilestoneDTO){
        try {
            const { CompanyMasterSid , BranchMasterSid , ShipmentNo } = payload;
            const allShipentMilestones = await this._db.shipmentMilestone.findMany({
                where : {
                    CompanyMasterSid,
                    BranchMasterSid,
                    ShipmentNo
                }
            })
            return allShipentMilestones;
        } catch (error) {
            throw error;
        }
    }

    softDeleteCostRevenueCharges(CostRevenueChargesSid:number){
        try {
            return this._db.costRevenueCharges.update({
                where : {
                    CostRevenueChargesSid,
                    status : 'A'
                },
                data : {
                    status : 'D'
                }
            })
        } catch (error) {
            throw error;
        }
    }

}
