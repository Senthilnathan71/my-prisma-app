import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { DatabaseService } from 'src/database/database.service';
import { SearchListDto } from 'src/masters/DTO/search-list.dto';

@Injectable()
export class HssacService {
    constructor(private _db: DatabaseService, private logger: Logger) { }


    async createHssac(payload: any, user) {
        this.logger.warn(`createHssac: ${payload}`);


        const existing = await this._db.hSSACMaster.findFirst({
            where: {
                OR: [
                    {
                        HSSACName: {
                            equals: payload.HSSACName.trim(),
                            mode: 'insensitive',
                        }
                    },
                    {
                        HSSACCode: {
                            equals: payload.HSSACCode.trim(),
                            mode: 'insensitive',
                        }
                    }
                ]
            },
        });

        if (existing) {
            if (existing.HSSACName === payload.HSSACName) {
                throw new BadRequestException('Hssac name already exists');
            }
            if (existing.HSSACCode === payload.HSSACCode) {
                throw new BadRequestException('Hssac code already exists');
            }
        }

        try {
            const Hssac = await this._db.hSSACMaster.create({
                data: {
                    ...payload,
                }
            });

            return Hssac;
        } catch (error) {
            console.log(error.stack)
            throw new Error(`Error creating Hssac: ${error.message}`);
        }
    }


    async getAllHssac() {
        try {
            const HssacList = await this._db.hSSACMaster.findMany({
                where: {
                    status: 'A'
                }
            })
            return HssacList;
        } catch (error) {
            throw error
        }
    }





    async findOne(HssacMasterSid: any) {
        try {
            return await this._db.hSSACMaster.findUnique({
                where: {
                    HSSACMasterSid: HssacMasterSid
                },
            });
        } catch (error) {
            throw error;
        }
    }


    async updateHssac(HssacMasterSid: number, payload: any, user) {

        const existing = await this._db.hSSACMaster.findUnique({
            where: {
                HSSACMasterSid: HssacMasterSid
            }
        });

        if (!existing) {
            throw new Error('Hssac is not exists');
        }

        try {
            const Hssac = await this._db.hSSACMaster.update({
                where: {
                    HSSACMasterSid: HssacMasterSid
                }, data: payload
            });
            return Hssac;
        } catch (error) {
            throw new Error(`Error updating Hssac: ${error.message}`);
        }
    }




    async softDelete(id: number) {
        const existingHssac = await this._db.hSSACMaster.findUnique({
            where: { HSSACMasterSid: id }
        });

        if (!existingHssac) {
            throw new NotFoundException(`Hssac with ID ${id} not found`);
        }

        if (existingHssac.deletedAt) {
            throw new Error(`Hssac with ID ${id} is already deleted`);
        }

        // Perform soft delete by updating deletedAt field
        return this._db.hSSACMaster.update({
            where: { HSSACMasterSid: id },
            data: { deletedAt: new Date() }
        });
    }


    async searchList(dto: SearchListDto) {
        const { searchType, filterValue } = dto;

        // Whitelist allowed fields to prevent SQL injection or invalid column access
        //write column names
        const allowedFields = [
            'HSSACName',
            'HSSACCode',
            'ServiceName',
            'TaxRate',
            'TaxType',
            'Status',
        ];

        if (!allowedFields.includes(searchType)) {
            throw new BadRequestException('Invalid search type');
        }

        // Dynamically build query
        const Hssacs = await this._db.hSSACMaster.findMany({
            where: {
                [searchType]: {
                    contains: filterValue,
                    mode: 'insensitive',
                },
                deletedAt: null,
            },
        }).catch(err => {
            throw new Error(`Error Search Hssac: ${err}`);
        });
        return Hssacs;


    }
}
