
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
                            DocumentTypeCode: true,
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
                            DocumentTypeCode: true,
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
                    },
                    voucherDetail : {
                        where : {
                            Status : 'A',
                             VoucherHeader:{
                                Status:"A"
                            }
                        },
                        select : {
                            VoucherHeader : { 
                                select : {
                                    voucherTypeMaster : 
                                    { 
                                    select : {
                                        DocumentTypeCode : true
                                         }
                                        }
                                    }},
                            LocalAmount : true
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
    async   getCostRevenueChargesWithDetails(payload:{TransactionSid:number,menuName:string}){
        try {
            let { TransactionSid ,menuName } = payload;
            if(!TransactionSid){
                throw new BadRequestException("Transaction SID is required");
            }
            if(!menuName){
                throw new BadRequestException("Menu Name is required");
            }
            const menu = await this._db.menuMaster.findFirst({
                where : {
                    MenuName : menuName
                },
                select : {
                    MenuMasterSid : true
                }
            })
            if(!menu || !menu.MenuMasterSid){
                throw new BadRequestException("Menu Master SID is required");
            }
            const allCostRevenueCharges = await this._db.costRevenueCharges.findMany({
                where : {
                    MenuMasterSid : menu.MenuMasterSid,
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
                                where : {
                                    Status : 'A'
                                },
                                select: {
                                    ChargeTaxMasterSid: true,
                                    hssacMaster : {
                                        select : {
                                            HSSACMasterSid : true,
                                            HSSACCode : true,
                                            TaxRate : true,
                                            TaxType : true,
                                            TaxGroupSid : true,
                                        }
                                    }
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
                                select : { StateMasterSid: true, stateName : true, IsUnionTerritory: true },
                            },
                            cityMaster : {select : {cityName : true}},
                            Zip_PostBox : true,
                            GSTNo : true,
                            Registered : true,
                            CustomerGstType : true,
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
                            CustomerGstType : true,
                            stateMaster : {
                                select : {
                                    StateMasterSid : true,
                                    stateName : true,
                                    IsUnionTerritory: true,
                                }
                            }
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
                            DocumentTypeCode: true,
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
                            DocumentTypeCode: true,
                            VoucherTypeMasterSid: true
                        }
                    },
                        VoucherDetail : {
                                            where : {
                                                Status : 'A',
                                                 VoucherHeader:{
                                                    Status:"A"
                                                }
                                            },
                                            select : {
                                                VoucherHeader : { 
                                                    select : {
                                                        voucherTypeMaster : 
                                                        { 
                                                        select : {
                                                            DocumentTypeCode : true
                                                             }
                                                            }
                                                        }},
                                                LocalAmount : true
                                            }
                                        }
                },
                orderBy : {
                    SerialNumber : 'asc'
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

    softDeleteCostRevenueCharges(CostRevenueChargesSid:number,updatedBy:string){
        try {
            return this._db.costRevenueCharges.update({
                where : {
                    CostRevenueChargesSid,
                    status : 'A'
                },
                data : {
                    status : 'D',
                    updatedBy: updatedBy,
                    updatedOn: new Date()
                }
            })
        } catch (error) {
            throw error;
        }
    }

}
