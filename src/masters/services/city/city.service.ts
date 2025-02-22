import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { DatabaseService } from 'src/database/database.service';
import { CityMaster } from 'src/masters/models/city-master.model';

@Injectable()
export class CityService {
    constructor(
        // @InjectModel(CityMaster)
        // private readonly cityMaster : typeof CityMaster
        private _db:DatabaseService
    ){}

    async getAllCity(){
        try {

            // const cityList = await this.cityMaster.findAll({
            //         where:{
            //             Status : 'A'
            //         }
            //     })
            const cityList = await this._db.cityMaster.findMany({
                where:{
                    status : 'A'
                }
            })
            return cityList;
        } catch (error) {
            console.log("cutomerError", error) 
            throw error
        }
    }
}
