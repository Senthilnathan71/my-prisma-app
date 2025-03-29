import { Injectable, Logger } from '@nestjs/common';
import { DatabaseService } from 'src/database/database.service';

@Injectable()
export class CityService {
    constructor(
        private _db: DatabaseService,
    ) { }

    async getAllCity() {
        try {
            const cityList = await this._db.cityMaster.findMany({
                where: {
                    status: 'A'
                }
            })
            return cityList;
        } catch (error) {
            throw error
        }
    }
}
