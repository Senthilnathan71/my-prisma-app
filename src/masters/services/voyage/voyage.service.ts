import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { DatabaseService } from 'src/database/database.service';

@Injectable()
export class VoyageService {
    constructor(private _db: DatabaseService, private logger: Logger) { }


    async createVoyage(payload: Prisma.VoyageMasterHeaderCreateInput, user) {
        this.logger.warn(`createVoyage: ${payload}`);


        const existing = await this._db.voyageMasterHeader.findFirst({
            where: {
                OR: [
                    {
                        VoyageNo: {
                            equals: payload.VoyageNo.trim(),
                            mode: 'insensitive',
                        }
                    },
                ]
            },
        });

        if (existing) {
            if (existing.VoyageNo === payload.VoyageNo) {
                throw new BadRequestException('Voyage no already exists');
            }
        }

        try {
            const voyage = await this._db.voyageMasterHeader.create({
                data: {
                    ...payload,
                    createdBy: "admin@crm.com"
                }
            });

            return voyage;
        } catch (error) {
            throw new Error(`Error creating Voyage: ${error.message}`);
        }
    }


    async getAllVoyages() {
        try {
            const voyageList = await this._db.voyageMasterHeader.findMany({
                where: {
                    status: 'A'
                }
            })
            return voyageList;
        } catch (error) {
            throw error
        }
    }



    async findOne(VoyageMasterSid: any) {
        try {
            return await this._db.voyageMasterHeader.findUnique({
                where: {
                    VoyageMasterHeaderSid: VoyageMasterSid
                },
            });
        } catch (error) {
            throw error;
        }
    }


    async updateVoyage(VoyageMasterSid: number, payload: Prisma.VoyageMasterHeaderUpdateInput, user) {

        const existing = await this._db.voyageMasterHeader.findUnique({
            where: {
                VoyageMasterHeaderSid: VoyageMasterSid
            }
        });

        if (!existing) {
            throw new Error('Voyage is not exists');
        }

        try {
            const voyage = await this._db.voyageMasterHeader.update({
                where: {
                    VoyageMasterHeaderSid: VoyageMasterSid
                }, data: payload
            });
            return voyage;
        } catch (error) {
            throw new Error(`Error updating Voyage: ${error.message}`);
        }
    }




    async softDelete(id: number) {
        const existingVoyage = await this._db.voyageMasterHeader.findUnique({
            where: { VoyageMasterHeaderSid: id }
        });

        if (!existingVoyage) {
            throw new NotFoundException(`Voyage with ID ${id} not found`);
        }

        if (existingVoyage.deletedAt) {
            throw new Error(`Voyage with ID ${id} is already deleted`);
        }

        // Perform soft delete by updating deletedAt field
        return this._db.voyageMasterHeader.update({
            where: { VoyageMasterHeaderSid: id },
            data: { deletedAt: new Date() }
        });
    }

}
