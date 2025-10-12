
import { Injectable } from '@nestjs/common';
import { DatabaseService } from 'src/database/database.service';

interface CostRevenueDTO {
    MenuMasterSid ?: number,
    CompanyMasterSid ?: number,
    BranchMasterSid ?: number,
    TransactionSid ?: number,
    ShipmentNo ?: string  
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

    async getAllCostRevenueCharges(payload:CostRevenueDTO){
        try {
            const { MenuMasterSid , CompanyMasterSid , BranchMasterSid , ShipmentNo , TransactionSid } = payload;
            const allCostRevenueCharges = await this._db.costRevenueCharges.findMany({
                where : {
                    MenuMasterSid,
                    CompanyMasterSid,
                    BranchMasterSid,
                    ShipmentNo,
                    TransactionSid,
                    status : 'A'
                }
            })
            return allCostRevenueCharges;
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
