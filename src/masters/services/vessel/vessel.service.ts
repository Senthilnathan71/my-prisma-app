import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { statusWhereClause } from 'src/common/helper';
import { DatabaseService } from 'src/database/database.service';
import { SearchListDto } from 'src/masters/DTO/search-list.dto';
import { filterDto } from 'src/masters/DTO/search-vessel.dto';

@Injectable()
export class VesselService {
    constructor(private _db: DatabaseService, private logger: Logger) { }


    async createVessel(payload: any, user) {
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
                    status: 'A',
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


    async updateVessel(VesselMasterSid: number, payload: any, user) {

        const existing = await this._db.vesselMaster.findUnique({
            where: {
                VesselMasterSid: VesselMasterSid
            }
        });

        if (!existing) {
            throw new BadRequestException('Vessel is not exists');
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

        if (existingVessel.status === "D") {
            throw new Error(`Vessel with ID ${id} is already deleted`);
        }

        // Perform soft delete by updating deletedAt field
        return this._db.vesselMaster.update({
            where: { VesselMasterSid: id },
            data: { status: "D" }
        });
    }


    async searchVessel() {
        try {
            const searchResults = await this._db.vesselMaster.findMany({
                where: {

                }
            })
            return searchResults;
        } catch (error) {
            throw error;
        }
    }

    async searchVesselNew(params: filterDto) {
        const { search = '', page = 1, pageSize = 15 } = params;
        const skip = (page - 1) * pageSize;

        const where: Prisma.VesselMasterWhereInput = {

            status: statusWhereClause,
            ...(search
                ? {
                    OR: [
                        { VesselName: { contains: search, mode: 'insensitive' } },
                        { VesselType: { contains: search, mode: 'insensitive' } },
                        { status: { contains: search, mode: 'insensitive' } },
                        { CallSignIn: { contains: search, mode: 'insensitive' } },
                        { VesselOperator: { contains: search, mode: 'insensitive' } },
                    ],
                }
                : {}),
        };

        const [items, totalCount] = await this._db.$transaction([
            this._db.vesselMaster.findMany({
                where,
                skip,
                take: pageSize,
                orderBy: { VesselMasterSid: 'desc' },
            }),
            this._db.vesselMaster.count({ where }),
        ]);

        return {
            items,
            totalCount,
        };
    }
    async getAuditLogs(tableName: string, recordId?: string) {
        try {
            const whereClause: any = { tableName };
            if (recordId) whereClause.recordId = recordId;

            const logs = await this._db.auditLog.findMany({
                where: whereClause,
                orderBy: { changedAt: 'desc' },
            });

            return logs;
        } catch (error) {
            this.logger.warn(`getAuditLogsError: ${error}`);
            throw new Error(`Error fetching audit logs: ${error.message}`);
        }
    }
}
