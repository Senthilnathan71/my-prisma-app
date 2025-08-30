import { Injectable } from '@nestjs/common';
import { DatabaseService } from 'src/database/database.service';

@Injectable()
export class LookupsService {
    constructor(private _db:DatabaseService) { }

    async getAllDepartments(payload: any) {
        try {
            const { CompanyMasterSid } = payload;
            const allDepartments = await this._db.vDepartmentLookup.findMany({
                where: {
                    CompanyMasterSid: CompanyMasterSid,
                }
            });
            return allDepartments;
        } catch (error) {
            throw error;
        }
    }
}
