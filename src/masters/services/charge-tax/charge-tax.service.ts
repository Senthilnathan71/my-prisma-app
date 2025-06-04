import { Injectable } from '@nestjs/common';
import { DatabaseService } from 'src/database/database.service';

@Injectable()
export class ChargeTaxService {
    constructor(private _db:DatabaseService){}

    async getAllChargeTax(){
        try {
            const allChargeTax = await this._db.chargeTaxMaster.findMany({
                where:{
                    deletedAt:null
                }
            })
            return allChargeTax;
        } catch (error) {
            throw error;
        }
    }
}
