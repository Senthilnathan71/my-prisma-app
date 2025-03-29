import { Injectable, Logger } from '@nestjs/common';
import { DatabaseService } from 'src/database/database.service';

@Injectable()
export class CityService {
    constructor(
        private _db: DatabaseService,
        private logger: Logger
    ) { }

    async getAllCity() {
        try {
            const cityList = await this._db.cityMaster.findMany({
                where: {
                    status: 'A'
                }
            })
            this.logger.debug(`getAllCity: ${JSON.stringify(cityList)}`)
            return cityList;
        } catch (error) {
            this.logger.warn(`getAllCity: ${JSON.stringify(error)}`)
            throw error
        }
    }
}
