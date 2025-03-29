import { Injectable } from '@nestjs/common';
import { DatabaseService } from 'src/database/database.service';

@Injectable()
export class CountryService {
    constructor(
        private _db: DatabaseService
    ) { }

    async getAllCountry() {
        try {

            const countryList = await this._db.countryMaster.findMany({
                where: {
                    status: 'A'
                }
            })
            return countryList;
        } catch (error) {
            console.log("countryError", error)
            throw error
        }
    }
}
