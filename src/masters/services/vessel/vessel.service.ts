import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { DatabaseService } from 'src/database/database.service';

@Injectable()
export class VesselService {
    constructor(private _db: DatabaseService, private logger: Logger) { }


    async createVessel(payload: Prisma.VesselMasterCreateInput, user) {
        this.logger.warn(`createVessel: ${payload}`);
        const existing = await this._db.vesselMaster.findFirst({
            where: {
                OR: [
                    {
                        VesselName: {
                            equals: payload.VesselName.trim(),
                            mode: 'insensitive',
                        }
                    },
                    {
                        VesselShortCode: {
                            equals: payload.VesselShortCode.trim(),
                            mode: 'insensitive',
                        }
                    }
                ]
            },
        });

        if (existing) {
            if (existing.VesselName === payload.VesselName) {
                throw new BadRequestException('Vessel name already exists');
            }
            if (existing.VesselShortCode === payload.VesselShortCode) {
                throw new BadRequestException('Vessel code already exists');
            }
        }

        try {
            const vessel = await this._db.vesselMaster.create({
                data: {
                    ...payload,
                    createdBy: "admin@crm.com"
                }
            });

            return vessel;
        } catch (error) {
            throw new Error(`Error creating Vessel: ${error.message}`);
        }
    }


    async getAllVessels() {
        try {
            const vesselList = await this._db.vesselMaster.findMany({
                where: {
                    status: 'A'
                }
            })
            return vesselList;
        } catch (error) {
            throw error
        }
    }



    async findOne(VesselMasterSid: any) {
        try {
            return await this._db.vesselMaster.findUnique({
                where: {
                    VesselMasterSid: VesselMasterSid
                },
            });
        } catch (error) {
            throw error;
        }
    }


    async updateVessel(VesselMasterSid: number, payload: Prisma.VesselMasterUpdateInput, user) {

        const existing = await this._db.vesselMaster.findUnique({
            where: {
                VesselMasterSid: VesselMasterSid
            }
        });

        if (!existing) {
            throw new Error('Vessel is not exists');
        }

        try {
            const vessel = await this._db.vesselMaster.update({
                where: {
                    VesselMasterSid: VesselMasterSid
                }, data: payload
            });
            return vessel;
        } catch (error) {
            throw new Error(`Error updating Vessel: ${error.message}`);
        }
    }




    async softDelete(id: number) {
        const existingVessel = await this._db.vesselMaster.findUnique({
            where: { VesselMasterSid: id }
        });

        if (!existingVessel) {
            throw new NotFoundException(`Vessel with ID ${id} not found`);
        }

        if (existingVessel.deletedAt) {
            throw new Error(`Vessel with ID ${id} is already deleted`);
        }

        // Perform soft delete by updating deletedAt field
        return this._db.vesselMaster.update({
            where: { VesselMasterSid: id },
            data: { deletedAt: new Date() }
        });
    }

}
