import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { GlobalConfigService } from 'src/common/config/master-config.service';
import { DatabaseService } from 'src/database/database.service';
import { SearchListDto } from 'src/masters/DTO/search-list.dto';
import { filterDto } from 'src/masters/DTO/search-vessel.dto';

@Injectable()
export class VoyageService {
    constructor(private _db: DatabaseService, private logger: Logger, private globalConfigService: GlobalConfigService) { }

    async createVoyage(payload: any, user: any) {
        this.logger.log(`createVoyage: ${JSON.stringify(payload)}`);

        // Validate required fields
        if (!payload.VoyageNo || !payload.VesselMasterSid) {
            throw new BadRequestException('VoyageNo and VesselMasterSid are required');
        }

        // Check for existing voyage with same number and vessel
        const existing = await this._db.voyageMasterHeader.findFirst({
            where: {
                AND: [
                    {
                        VoyageNo: {
                            equals: payload.VoyageNo.trim(),
                            mode: 'insensitive',
                        }
                    },
                    {
                        VesselMasterSid: payload.VesselMasterSid
                    },
                    {
                        status: 'A'
                    }
                ]
            },
        });

        if (existing) {
            throw new BadRequestException('This vessel is already scheduled with this voyage number.');
        }

        try {
            const voyage = await this._db.voyageMasterHeader.create({
                data: {
                    ...payload,
                    createdBy: user?.username || 'system'
                },
                include: {
                    vesselMaster: {
                        select: {
                            VesselName: true
                        }
                    },
                    portMasterPOL: {
                        select: {
                            PortCode: true,
                            PortName: true
                        }
                    },
                    portMasterPOD: {
                        select: {
                            PortCode: true,
                            PortName: true
                        }
                    }
                }
            });

            return voyage;
        } catch (error) {
            this.logger.error(`Error creating Voyage: ${error.message}`);
            throw new BadRequestException(`Error creating Voyage: ${error.message}`);
        }
    }

    async getAllVoyages() {
        try {
            const voyageList = await this._db.voyageMasterHeader.findMany({
                where: {
                    status: 'A'
                },
                include: {
                    vesselMaster: {
                        select: {
                            VesselName: true
                        }
                    },
                    portMasterPOL: {
                        select: {
                            PortCode: true,
                            PortName: true
                        }
                    },
                    portMasterPOD: {
                        select: {
                            PortCode: true,
                            PortName: true
                        }
                    }
                },
                orderBy: {
                    VoyageMasterHeaderSid: 'desc'
                }
            });
            return voyageList;
        } catch (error) {
            this.logger.error(`Error getting all voyages: ${error.message}`);
            throw new BadRequestException('Error fetching voyages');
        }
    }

    async findOne(VoyageMasterHeaderSid: number) {
        try {
            const voyage = await this._db.voyageMasterHeader.findUnique({
                where: {
                    VoyageMasterHeaderSid: VoyageMasterHeaderSid,
                    status: 'A'
                },
                include: {
                    vesselMaster: {
                        select: {
                            VesselName: true
                        }
                    },
                    portMasterPOL: {
                        select: {
                            PortCode: true,
                            PortName: true
                        }
                    },
                    portMasterPOD: {
                        select: {
                            PortCode: true,
                            PortName: true
                        }
                    }
                }
            });

            if (!voyage) {
                throw new NotFoundException(`Voyage with ID ${VoyageMasterHeaderSid} not found`);
            }

            return voyage;
        } catch (error) {
            if (error instanceof NotFoundException) {
                throw error;
            }
            this.logger.error(`Error finding voyage: ${error.message}`);
            throw new BadRequestException('Error fetching voyage');
        }
    }

    async updateVoyage(VoyageMasterHeaderSid: number, payload: any, user: any) {
        const existing = await this._db.voyageMasterHeader.findUnique({
            where: {
                VoyageMasterHeaderSid: VoyageMasterHeaderSid,
                status: 'A'
            }
        });

        if (!existing) {
            throw new NotFoundException('Voyage not found');
        }

        // Check for duplicate voyage number with different ID
        if (payload.VoyageNo) {
            const duplicate = await this._db.voyageMasterHeader.findFirst({
                where: {
                    AND: [
                        {
                            VoyageMasterHeaderSid: { not: VoyageMasterHeaderSid }
                        },
                        {
                            VoyageNo: {
                                equals: payload.VoyageNo.trim(),
                                mode: 'insensitive',
                            }
                        },
                        {
                            VesselMasterSid: payload.VesselMasterSid || existing.VesselMasterSid
                        },
                        {
                            status: 'A'
                        }
                    ]
                },
            });

            if (duplicate) {
                throw new BadRequestException('This vessel is already scheduled with this voyage number.');
            }
        }

        try {
            const voyage = await this._db.voyageMasterHeader.update({
                where: {
                    VoyageMasterHeaderSid: VoyageMasterHeaderSid
                },
                data: {
                    ...payload,
                    updatedBy: user?.username || 'system',
                    updatedOn: new Date()
                },
                include: {
                    vesselMaster: {
                        select: {
                            VesselName: true
                        }
                    },
                    portMasterPOL: {
                        select: {
                            PortCode: true,
                            PortName: true
                        }
                    },
                    portMasterPOD: {
                        select: {
                            PortCode: true,
                            PortName: true
                        }
                    }
                }
            });
            return voyage;
        } catch (error) {
            this.logger.error(`Error updating Voyage: ${error.message}`);
            throw new BadRequestException(`Error updating Voyage: ${error.message}`);
        }
    }

    async softDelete(VoyageMasterHeaderSid: number) {
        try {
            const existingVoyage = await this._db.voyageMasterHeader.findUnique({
                where: { 
                    VoyageMasterHeaderSid: VoyageMasterHeaderSid,
                    status: 'A'
                }
            });

            if (!existingVoyage) {
                throw new NotFoundException(`Voyage with ID ${VoyageMasterHeaderSid} not found`);
            }

            const deletedVoyage = await this._db.voyageMasterHeader.update({
                where: {
                    VoyageMasterHeaderSid: VoyageMasterHeaderSid
                },
                data: {
                    status: 'D',
                    deletedAt: new Date()
                }
            });

            return {
                deletedVoyage
            };
        } catch (error) {
            this.logger.error(`Error soft deleting voyage: ${error.message}`);
            if (error instanceof NotFoundException) {
                throw error;
            }
            throw new BadRequestException('Error deleting voyage');
        }
    }

    async searchVoyage(data: SearchListDto) {
        const { searchType, filterValue } = data;

        const stringFields = [
            "VoyageNo",
            "ViaNumber",
            "CoLoad",
            "VoyageType",
            "RotationNumber",
            "Remarks",
            "SCMTCargoDescription",
            "ShipIRN",
            "CrewIRN"
        ];

        const intFields = [
            "VesselMasterSid",
            "Carrier",
            "POLSid",
            "PODSid"
        ];

        const acceptedType = [...stringFields, ...intFields];

        if (!acceptedType.includes(searchType)) {
            throw new BadRequestException('Invalid Search Type');
        }

        let whereClause: any = { status: 'A' };

        if (stringFields.includes(searchType)) {
            whereClause[searchType] = {
                contains: filterValue,
                mode: "insensitive"
            };
        } else if (intFields.includes(searchType)) {
            const numberValue = parseInt(filterValue);
            if (isNaN(numberValue)) {
                throw new BadRequestException(`${searchType} must be a valid number`);
            }
            whereClause[searchType] = numberValue;
        }

        try {
            const searchResults = await this._db.voyageMasterHeader.findMany({
                where: whereClause,
                include: {
                    vesselMaster: {
                        select: {
                            VesselName: true
                        }
                    },
                    portMasterPOL: {
                        select: {
                            PortCode: true,
                            PortName: true
                        }
                    },
                    portMasterPOD: {
                        select: {
                            PortCode: true,
                            PortName: true
                        }
                    }
                },
                orderBy: {
                    VoyageMasterHeaderSid: 'desc'
                }
            });

            return searchResults;
        } catch (error) {
            this.logger.error(`Error searching voyage: ${error.message}`);
            throw new BadRequestException('Error searching voyages');
        }
    }

    // Simplified POL/POD search using only VoyageMasterHeader
    async specialSearch(payload: any) {
        const { POLSid, PODSid } = payload;
        
        if (!POLSid || !PODSid) {
            throw new BadRequestException('POLSid and PODSid are required');
        }

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        try {
            const voyages = await this._db.voyageMasterHeader.findMany({
                where: {
                    status: 'A',
                    POLSid: POLSid,
                    PODSid: PODSid,
                    ETD: {
                        gte: today // Only future voyages
                    }
                },
                include: {
                    vesselMaster: {
                        select: {
                            VesselName: true
                        }
                    },
                    portMasterPOL: {
                        select: {
                            PortCode: true,
                            PortName: true
                        }
                    },
                    portMasterPOD: {
                        select: {
                            PortCode: true,
                            PortName: true
                        }
                    }
                },
                orderBy: {
                    ETD: 'asc'
                }
            });

            return {
                items: voyages,
                totalCount: voyages.length,
            };
        } catch (error) {
            this.logger.error(`Error in special search: ${error.message}`);
            throw new BadRequestException('Error searching voyages by POL/POD');
        }
    }

    // Enhanced search with multiple POL/POD combinations
    async advancedPolPodSearch(payload: any) {
        const { POLSid, PODSid, VoyageType, dateFrom, dateTo } = payload;
        
        if (!POLSid || !PODSid) {
            throw new BadRequestException('POLSid and PODSid are required');
        }

        const whereClause: any = {
            status: 'A',
            POLSid: POLSid,
            PODSid: PODSid
        };

        // Add VoyageType filter if provided
        if (VoyageType) {
            whereClause.VoyageType = VoyageType;
        }

        // Add date range filter if provided
        if (dateFrom || dateTo) {
            whereClause.ETD = {};
            if (dateFrom) whereClause.ETD.gte = new Date(dateFrom);
            if (dateTo) whereClause.ETD.lte = new Date(dateTo);
        }

        try {
            const voyages = await this._db.voyageMasterHeader.findMany({
                where: whereClause,
                include: {
                    vesselMaster: {
                        select: {
                            VesselName: true,
                            VesselShortCode: true
                        }
                    },
                    portMasterPOL: {
                        select: {
                            PortCode: true,
                            PortName: true,
                            countryMaster: true
                        }
                    },
                    portMasterPOD: {
                        select: {
                            PortCode: true,
                            PortName: true,
                            countryMaster: true
                        }
                    },
                    customerMasterCarrier: {
                        select: {
                            CustomerName: true,
                            CustomerShortCode: true
                        }
                    }
                },
                orderBy: {
                    ETD: 'asc'
                }
            });

            return {
                items: voyages,
                totalCount: voyages.length,
            };
        } catch (error) {
            this.logger.error(`Error in advanced POL/POD search: ${error.message}`);
            throw new BadRequestException('Error searching voyages');
        }
    }

    async searchList(params: filterDto) {
        const { search = '', page = 1, pageSize = 15 } = params;
        const skip = (page - 1) * pageSize;

        const where: Prisma.VoyageMasterHeaderWhereInput = {
            status: 'A',
            ...(search
                ? {
                    OR: [
                        { VoyageNo: { contains: search, mode: 'insensitive' } },
                        { vesselMaster: { VesselName: { contains: search, mode: 'insensitive' } } },
                        { portMasterPOL: { PortCode: { contains: search, mode: 'insensitive' } } },
                        { portMasterPOL: { PortName: { contains: search, mode: 'insensitive' } } },
                        { portMasterPOD: { PortCode: { contains: search, mode: 'insensitive' } } },
                        { portMasterPOD: { PortName: { contains: search, mode: 'insensitive' } } },
                    ]
                }
                : {}
            )
        };

        try {
            let [items, totalCount] = await this._db.$transaction([
                this._db.voyageMasterHeader.findMany({
                    where,
                    skip,
                    take: pageSize,
                    orderBy: { VoyageMasterHeaderSid: 'desc' },
                    include: {
                        vesselMaster: {
                            select: {
                                VesselName: true
                            }
                        },
                        portMasterPOL: {
                            select: {
                                PortCode: true,
                                PortName: true
                            }
                        },
                        portMasterPOD: {
                            select: {
                                PortCode: true,
                                PortName: true
                            }
                        }
                    }
                }),
                this._db.voyageMasterHeader.count({ where })
            ]);

            return {
                items,
                totalCount
            };
        } catch (error) {
            this.logger.error(`Error in search list: ${error.message}`);
            throw new BadRequestException('Error searching voyages');
        }
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
            this.logger.error(`Error fetching audit logs: ${error.message}`);
            throw new BadRequestException('Error fetching audit logs');
        }
    }

    // Simplified vessel search using only VoyageMasterHeader
    async getAvailableVessels(
        POL: number,
        POD: number,
        MovementType?: 'Air' | 'Sea' | 'Road'
    ) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        try {
            const whereClause: any = {
                status: 'A',
                POLSid: POL,
                PODSid: POD,
                ETD: {
                    gte: today
                }
            };

            if (MovementType) {
                whereClause.VoyageType = MovementType;
            }

            const voyages = await this._db.voyageMasterHeader.findMany({
                where: whereClause,
                include: {
                    vesselMaster: {
                        select: {
                            VesselMasterSid: true,
                            VesselName: true,
                            VesselShortCode: true
                        }
                    }
                },
                distinct: ['VesselMasterSid'] // Get unique vessels
            });

            // Extract unique vessels
            const vesselsMap = new Map();
            voyages.forEach(voyage => {
                if (voyage.vesselMaster) {
                    vesselsMap.set(voyage.vesselMaster.VesselMasterSid, {
                        VesselMasterSid: voyage.vesselMaster.VesselMasterSid,
                        VesselName: voyage.vesselMaster.VesselName,
                        VesselCode: voyage.vesselMaster.VesselShortCode
                    });
                }
            });

            return Array.from(vesselsMap.values());
        } catch (error) {
            this.logger.error(`Error getting available vessels: ${error.message}`);
            throw new BadRequestException('Error fetching available vessels');
        }
    }

    // Get voyages by vessel and ports
    async getAvailableVoyagesWithPorts(
        VesselMasterSid: number,
        POL: number,
        POD: number,
        VoyageType?: 'Air' | 'Sea' | 'Road'
    ) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        try {
            const whereClause: any = {
                status: 'A',
                VesselMasterSid: VesselMasterSid,
                POLSid: POL,
                PODSid: POD,
                ETD: {
                    gte: today
                }
            };

            if (VoyageType) {
                whereClause.VoyageType = VoyageType;
            }

            const voyages = await this._db.voyageMasterHeader.findMany({
                where: whereClause,
                include: {
                    vesselMaster: {
                        select: {
                            VesselName: true
                        }
                    },
                    portMasterPOL: {
                        select: {
                            PortCode: true,
                            PortName: true
                        }
                    },
                    portMasterPOD: {
                        select: {
                            PortCode: true,
                            PortName: true
                        }
                    }
                },
                orderBy: {
                    ETD: 'asc'
                }
            });

            return voyages;
        } catch (error) {
            this.logger.error(`Error getting available voyages: ${error.message}`);
            throw new BadRequestException('Error fetching available voyages');
        }
    }

    async getVoyagesByVesselId(VesselMasterSid: number) {
        try {
            const voyages = await this._db.voyageMasterHeader.findMany({
                where: {
                    VesselMasterSid: VesselMasterSid,
                    status: 'A',
                },
                include: {
                    vesselMaster: {
                        select: {
                            VesselName: true
                        }
                    },
                    portMasterPOL: {
                        select: {
                            PortCode: true,
                            PortName: true
                        }
                    },
                    portMasterPOD: {
                        select: {
                            PortCode: true,
                            PortName: true
                        }
                    }
                },
                orderBy: {
                    VoyageMasterHeaderSid: 'desc'
                }
            });
            return voyages;
        } catch (error) {
            this.logger.error(`Error getting voyages by vessel: ${error.message}`);
            throw new BadRequestException('Error fetching voyages by vessel');
        }
    }

    // Additional helper method to get voyages by multiple POL/POD combinations
    async getVoyagesByMultiplePolPod(polPodList: Array<{POLSid: number, PODSid: number}>) {
        try {
            const whereClause: any = {
                status: 'A',
                OR: polPodList.map(polPod => ({
                    AND: [
                        { POLSid: polPod.POLSid },
                        { PODSid: polPod.PODSid }
                    ]
                }))
            };

            const voyages = await this._db.voyageMasterHeader.findMany({
                where: whereClause,
                include: {
                    vesselMaster: {
                        select: {
                            VesselName: true
                        }
                    },
                    portMasterPOL: {
                        select: {
                            PortCode: true,
                            PortName: true
                        }
                    },
                    portMasterPOD: {
                        select: {
                            PortCode: true,
                            PortName: true
                        }
                    }
                },
                orderBy: {
                    ETD: 'asc'
                }
            });

            return voyages;
        } catch (error) {
            this.logger.error(`Error getting voyages by multiple POL/POD: ${error.message}`);
            throw new BadRequestException('Error fetching voyages');
        }
    }
}