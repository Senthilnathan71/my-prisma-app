import { Injectable } from '@nestjs/common';
import { DatabaseService } from 'src/database/database.service';

@Injectable()
export class SectorService {
    constructor(
        private _db: DatabaseService
    ) { }

    async getAllSector() {
        try {

            const sectorList = await this._db.sectorMaster.findMany({
                where: {
                    status: 'A'
                }
            })
            return sectorList;
        } catch (error) {
            throw error
        }
    }
}
