import { Injectable } from '@nestjs/common';
import { DatabaseService } from 'src/database/database.service';

@Injectable()
export class EnquiryHeaderService {
    constructor(
        // @InjectModel(CityMaster)
        // private readonly cityMaster : typeof CityMaster
        private _db: DatabaseService
    ) { }


    async createEnquiry(payload, user) {
        try {
            const result = await this._db.$transaction([
                this._db.enquiryHeader.create({
                    data: {
                        ...payload
                    }
                }),

                this._db.enquiryRoute.create({
                    data: {
                        ...payload
                    }
                }),

                this._db.enquiryCargo.create({
                    data: {
                        ...payload
                    }
                })
            ])
            return { message: 'Enquiry created successfully', data: result }
        } catch (error) {
            throw error
        }
    }
}