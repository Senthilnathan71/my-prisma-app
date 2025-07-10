import { Prisma } from '.prisma/client/default';
import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { DatabaseService } from 'src/database/database.service';
import { SearchListDto } from 'src/masters/DTO/search-list.dto';
import { SearchVesselDto } from 'src/masters/DTO/search-vessel.dto';

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

        const duplicate = await this._db.chargeMaster.findFirst({
            where: {
                AND:[
                    {
                ChargeMasterSid: {
                    not: ChargeMasterSid,
            },
        },
        {
            OR:[
                {
                    chargeName: {
                            equals: payload.chargeName.trim(),
                            mode: 'insensitive',
                        },
                },
                {
                    chargeCode: {
                            equals: payload.chargeCode.trim(),
                            mode: 'insensitive',
                        },
                },
            ]
        },
    ],
},
        });
        if (duplicate) {
  if (duplicate.chargeName === payload.chargeName) {
    throw new BadRequestException('Sector name already exists');
  }
  if (duplicate.chargeCode === payload.chargeCode) {
    throw new BadRequestException('Sector code already exists');
  }
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


    async searchList(params: SearchVesselDto) {
    const { search = '', page = 1, pageSize = 10 } = params;
    const skip = (page - 1) * pageSize;

    const where: Prisma.ChargeMasterWhereInput = {
        deletedAt: null,
        Status: 'A',
    };

    if (search) {
        where.OR = [
            { chargeName: { contains: search, mode: 'insensitive' } },
            { chargeCode: { contains: search, mode: 'insensitive' } },
            { Status: { contains: search, mode: 'insensitive' } },
        ];
    }

    const [items, totalCount] = await this._db.$transaction([
        this._db.chargeMaster.findMany({
            where,
            skip,
            take: pageSize,
            orderBy: { ChargeMasterSid: 'desc' },
        }),
        this._db.chargeMaster.count({ where }),
    ]);

    return {
        items,
        totalCount,
    };
}
}
