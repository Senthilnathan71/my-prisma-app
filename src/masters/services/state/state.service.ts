import { Injectable } from '@nestjs/common';
import { DatabaseService } from 'src/database/database.service';

@Injectable()
export class StateService {
    constructor(
        private _db: DatabaseService
    ) { }

    async getAllStateByCountry(CountryMasterSid: any) {
        try {
            const stateList = await this._db.stateMaster.findMany({
                
                where: {
                    CountryMasterSid: CountryMasterSid,
                    status: 'A'
                }
            })
            return stateList;
        } catch (error) {
            throw error
        }
    }

    async getAllStates() {
        try {
            const stateList = await this._db.stateMaster.findMany({
                include: {
                    countryMaster: {
                        select: {
                            countryName: true,
                        }
                    }
                },
                where: {
                    status: 'A'
                }
            })
            return stateList;
        } catch (error) {
            throw error
        }
    }



}
