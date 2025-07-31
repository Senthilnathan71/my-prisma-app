import { Prisma } from '.prisma/client/default';
import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { GlobalConfigService } from 'src/common/config/master-config.service';
import { DatabaseService } from 'src/database/database.service';
import { SearchListDto } from 'src/masters/DTO/search-list.dto';
import { SearchVesselDto } from 'src/masters/DTO/search-vessel.dto';

@Injectable()
export class ChargeService {
    constructor(private _db: DatabaseService, private logger: Logger,private globalConfigService:GlobalConfigService) { }


    async createCharge(payload: any, user) {
        const { chargeTaxMaster, chargeTds, ...chargeData } = payload;
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
        


        return this._db.$transaction(async (prisma) => {
            // 1. Create ChargeMaster
            const charge = await prisma.chargeMaster.create({
                data: {
                    ...chargeData,
                    createdBy: payload.createdBy,
                    updatedBy: payload.createdBy, // Add updatedBy
                    CompanyMasterSid: user.userBranchMaster[0].CompanyMasterSid, // Add CompanyMasterSid
                    Status: 'A',
                },
            });

            // 2. Create ChargeTaxMaster if provided
            const createdChargeTaxes: any[] = [];
            if (payload.chargeTaxMaster) {
                const chargeTaxPayload = payload.chargeTaxMaster.map(chargeTax => ({
                    HSNCode: chargeTax.HSNCode,
                    description: chargeTax.description,
                    TaxGroup: chargeTax.TaxGroup,
                    TaxRate: chargeTax.TaxRate,
                    CreatedBy: payload.createdBy,
                    UpdatedBy: payload.createdBy, // Ensure updatedBy is set
                    Status: chargeTax.Status,
                    CompanyMasterSid: user.userBranchMaster[0].CompanyMasterSid,
                    chargeTaxMasterSid: charge.ChargeMasterSid,
                    
                }));
                const newlyCreated = await prisma.chargeTaxMaster.createManyAndReturn({
                    data: chargeTaxPayload,
                });
                createdChargeTaxes.push(...newlyCreated);
            }

            // 3. Create ChargeTds if provided
            const createdChargeTds: any[] = [];
            if (payload.chargeTds) {
                const chargeTdsPayload = payload.chargeTds.map(chargeTds => ({
                    ChargeMasterSid: charge.ChargeMasterSid,
                    TDSSet: chargeTds.TDSSet,
                    EffectiveFrom: chargeTds.EffectiveFrom,
                    createdBy: payload.createdBy,
                    updatedBy: payload.createdBy, // Add updatedBy
                
                }));
                const newlyCreated = await prisma.chargeTds.createManyAndReturn({
                    data: chargeTdsPayload,
                });
                createdChargeTds.push(...newlyCreated);
            }

            return {
                charge,
                chargeTaxMaster: createdChargeTaxes,
                chargeTds: createdChargeTds,
            };
        });
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
                    ChargeMasterSid: ChargeMasterSid,
                    
                },
                include : {
                    chargeTaxMaster : {
                        where : {
                            deletedAt : null
                        }
                    },
                    chargeTds : {
                        where : {
                            deletedAt : null
                        }
                    }
                }
            });
        } catch (error) {
            throw error;
        }
    }


    async updateCharge(ChargeMasterSid: number, payload: any, user) {
        const { chargeTaxMaster, chargeTds, ...chargeData } = payload;

        // Check for duplicates
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


        return this._db.$transaction(async (prisma) => {
            // 1. Update ChargeMaster
            const charge = await prisma.chargeMaster.update({
                where: { ChargeMasterSid: ChargeMasterSid },
                data: {
                    ...chargeData,
                    updatedBy: payload.updatedBy || user.userId,
                },
            });

            // 2. Handle ChargeTaxMaster updates
            const updatedChargeTaxes: any[] = [];
            if (chargeTaxMaster && chargeTaxMaster.length > 0) {
                // Delete existing tax records
                await prisma.chargeTaxMaster.deleteMany({
                    where: { chargeTaxMasterSid: ChargeMasterSid }
                });

                // Create new tax records
                const chargeTaxPayload = chargeTaxMaster.map(chargeTax => ({
                    HSNCode: chargeTax.HSNCode,
                    description: chargeTax.description,
                    TaxGroup: chargeTax.TaxGroup,
                    TaxRate: chargeTax.TaxRate,
                    CreatedBy: payload.updatedBy || user.userId,
                    UpdatedBy: payload.updatedBy || user.userId,
                    Status: chargeTax.Status,
                    CompanyMasterSid: user.userBranchMaster[0].CompanyMasterSid,
                    chargeTaxMasterSid: ChargeMasterSid,
                }));
                const newlyCreated = await prisma.chargeTaxMaster.createManyAndReturn({
                    data: chargeTaxPayload,
                });
                updatedChargeTaxes.push(...newlyCreated);
            }

            // 3. Handle ChargeTds updates
            const updatedChargeTds: any[] = [];
            if (chargeTds && chargeTds.length > 0) {
                // Delete existing TDS records
                await prisma.chargeTds.deleteMany({
                    where: { ChargeMasterSid: ChargeMasterSid }
                });

                // Create new TDS records
                const chargeTdsPayload = chargeTds.map(chargeTds => ({
                    ChargeMasterSid: ChargeMasterSid,
                    TDSSet: chargeTds.TDSSet,
                    EffectiveFrom: chargeTds.EffectiveFrom,
                    createdBy: payload.updatedBy || user.userId,
                    updatedBy: payload.updatedBy || user.userId,
                }));
                const newlyCreated = await prisma.chargeTds.createManyAndReturn({
                    data: chargeTdsPayload,
                });
                updatedChargeTds.push(...newlyCreated);
            }

            return {
                charge,
                chargeTaxMaster: updatedChargeTaxes,
                chargeTds: updatedChargeTds,
            };
        });
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
    const { search = '', page = 1, pageSize = 15 } = params;
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
            {
                chargeTaxMaster: {
                    some: {
                        HSNCode: { contains: search, mode: 'insensitive' }
                    }
                }
            },
             { 
                chargeTds: {
                    some: {
                        tdsSetHeader: {
                            TDSSetName: { contains: search, mode: 'insensitive' }
                        }
                    }
                }
            }
        ];
    }

    const [items, totalCount] = await this._db.$transaction([
        this._db.chargeMaster.findMany({
            where,
            skip,
            take: pageSize,
            select: {
                ChargeMasterSid: true,
                chargeName: true,
                chargeCode: true,
                UOM : true,
                Status : true,
                chargeTaxMaster: {
                    where: { deletedAt: null },
                    select: { ChargeTaxMasterSid: true },
                    take: 1,
                },
                chargeTds: {
                    where: { deletedAt: null },
                    select: { TDSSet: true },
                    take: 1,
                },
            },
            orderBy: { ChargeMasterSid: 'desc' },
        }),
        this._db.chargeMaster.count({ where }),
    ]);

    const formattedItems = await Promise.all(
        items.map(async (item) => {
        const ChargeTaxMasterSid = item.chargeTaxMaster?.[0]?.ChargeTaxMasterSid;
        const TDSSet = item.chargeTds?.[0]?.TDSSet;

        const [hsn, tdsSet] = await Promise.all([
            ChargeTaxMasterSid ? 
            this.globalConfigService.getMasterData('charge_tax_master',ChargeTaxMasterSid) : null, 
            
            TDSSet ? 
            this.globalConfigService.getMasterData('tds_set_header',TDSSet ): null,
            ]);

            return {
            ...item,
            chargeTaxMaster: hsn ? [hsn] : [],
            chargeTds: tdsSet ? [{ tdsSetHeader: tdsSet }] : []
            };
        }),
    );

 
    return {
        items: formattedItems,
        totalCount,
    };
}
}
