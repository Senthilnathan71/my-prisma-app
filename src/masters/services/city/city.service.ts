import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { CityMaster } from 'src/masters/models/city-master.model';

@Injectable()
export class CityService {
    constructor(
        @InjectModel(CityMaster)
        private readonly cityMaster : typeof CityMaster
    ){}

    async getAllCity(){
        try {
            const cityList = await this.cityMaster.findAll({
                where:{
                    Status : 'A'
                }
            })
            return cityList;
        } catch (error) {
            console.log("cutomerError", error) 
            throw error
        }
    }
}
