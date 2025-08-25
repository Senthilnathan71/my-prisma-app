
import { Injectable } from '@nestjs/common';
import { DatabaseService } from 'src/database/database.service';

interface CostRevenueDTO {
    MenuMasterSid ?: number,
    CompanyMasterSid ?: number,
    BranchMasterSid ?: number,
    TransactionSid ?: number,
    ShipmentNo ?: string  
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
                    TransactionSid
                }
            })
            return allCostRevenueCharges;
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

}
