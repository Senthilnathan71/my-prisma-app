import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { DatabaseService } from 'src/database/database.service';
import { SearchListDto } from 'src/masters/DTO/search-list.dto';

@Injectable()
export class ChargeService {
    constructor(private _db: DatabaseService, private logger: Logger) { }


    async createCharge(payload: any, user) {
        this.logger.warn(`createCharge: ${payload}`);


        const existing = await this._db.chargeMaster.findFirst({
            where: {
                OR: [
                    {
                        chargeName: {
                            equals: payload.chargeName.trim(),
                            mode: 'insensitive',
                        }
                    },
                    {
                        chargeCode: {
                            equals: payload.chargeCode.trim(),
                            mode: 'insensitive',
                        }
                    }
                ]
            },
        });

        if (existing) {
            if (existing.chargeName === payload.chargeName) {
                throw new BadRequestException('Charge name already exists');
            }
            if (existing.chargeCode === payload.chargeCode) {
                throw new BadRequestException('Charge code already exists');
            }
        }

        try {
            const Charge = await this._db.chargeMaster.create({
                data: {
                    ...payload,
                    createdBy: "admin@crm.com"
                }
            });

            return Charge;
        } catch (error) {
            throw new Error(`Error creating Charge: ${error.message}`);
        }
    }


    async getAllCharges() {
        try {
            const ChargeList = await this._db.chargeMaster.findMany({
                where: {
                    Status: 'A'
                }
            })
            return ChargeList;
        } catch (error) {
            throw error
        }
    }

    async getAllChargeGroups() {
        try {
            const ChargeGroupList = await this._db.chargeGroup.findMany({
                where: {
                    status: 'A'
                }
            })
            return ChargeGroupList;
        } catch (error) {
            throw error
        }
    }



    async findOne(ChargeMasterSid: any) {
        try {
            return await this._db.chargeMaster.findUnique({
                where: {
                    ChargeMasterSid: ChargeMasterSid
                },
            });
        } catch (error) {
            throw error;
        }
    }


    async updateCharge(ChargeMasterSid: number, payload: any, user) {

        const existing = await this._db.chargeMaster.findUnique({
            where: {
                ChargeMasterSid: ChargeMasterSid
            }
        });

        if (!existing) {
            throw new Error('Charge is not exists');
        }

        try {
            const Charge = await this._db.chargeMaster.update({
                where: {
                    ChargeMasterSid: ChargeMasterSid
                }, data: payload
            });
            return Charge;
        } catch (error) {
            throw new Error(`Error updating Charge: ${error.message}`);
        }
    }




    async softDelete(id: number) {
        const existingCharge = await this._db.chargeMaster.findUnique({
            where: { ChargeMasterSid: id }
        });

        if (!existingCharge) {
            throw new NotFoundException(`Charge with ID ${id} not found`);
        }

        if (existingCharge.deletedAt) {
            throw new Error(`Charge with ID ${id} is already deleted`);
        }

        // Perform soft delete by updating deletedAt field
        return this._db.chargeMaster.update({
            where: { ChargeMasterSid: id },
            data: { deletedAt: new Date() }
        });
    }


    async searchList(dto: SearchListDto) {
        const { searchType, filterValue } = dto;

        // Whitelist allowed fields to prevent SQL injection or invalid column access
        //write column names
        const allowedFields = [
            'chargeName',
            'chargeCode',
            'Status',
        ];

        if (!allowedFields.includes(searchType)) {
            throw new BadRequestException('Invalid search type');
        }

        // Dynamically build query
        const Charges = await this._db.chargeMaster.findMany({
            where: {
                [searchType]: {
                    contains: filterValue,
                    mode: 'insensitive',
                },
                deletedAt: null,
            },
        }).catch(err => {
            throw new Error(`Error Search Charge: ${err}`);
        });
        return Charges;


    }
}
