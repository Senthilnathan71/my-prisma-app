import { Injectable } from '@nestjs/common';
import { DatabaseService } from 'src/database/database.service';

@Injectable()
export class StateService {
    constructor(
        private _db: DatabaseService
    ) { }

    async getAllState(CountryMasterSid: any) {
        try {

            const stateList = await this._db.stateMaster.findMany({
                where: {
                    CountryMasterSid: CountryMasterSid,
                    status: 'A'
                }
            })
            return stateList;
        } catch (error) {
            console.log("stateError", error)
            throw error
        }
    }
}
