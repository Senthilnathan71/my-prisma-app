import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { GlobalConfigService } from 'src/common/config/master-config.service';
import { DatabaseService } from 'src/database/database.service';
import { SearchListDto } from 'src/masters/DTO/search-list.dto';
import { SearchVesselDto } from 'src/masters/DTO/search-vessel.dto';

@Injectable()
export class VoyageService {
    constructor(private _db: DatabaseService, private logger: Logger, private globalConfigService: GlobalConfigService) { }


    async createVoyage(payload: any, user) {
        this.logger.warn(`createVoyage: ${payload}`);


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
                        VesselMasterSid: {
                            equals: payload.VesselMasterSid
                        }
                    }
                ]
            },
        });

        if (existing) {
            if (existing.VoyageNo.toLowerCase() === payload.VoyageNo.trim().toLowerCase() && existing.VesselMasterSid === payload.VesselMasterSid) {
                throw new BadRequestException('This vessel is already scheduled with this voyage number.');
            }
        }

        try {
            const voyage = await this._db.voyageMasterHeader.create({
                data: {
                    ...payload,
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
                    deletedAt: null
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


    async updateVoyage(VoyageMasterSid: number, payload: any, user) {

        const exists = await this._db.voyageMasterHeader.findFirst({
            where: {
                AND: [
                    {
                        VoyageMasterHeaderSid: { not: VoyageMasterSid }
                    },
                    {
                        VoyageNo: {
                            equals: payload.VoyageNo.trim(),
                            mode: 'insensitive',
                        }
                    },
                    {
                        VesselMasterSid: {
                            equals: payload.VesselMasterSid
                        }
                    }
                ]
            },
        });

        if (exists) {
            if (exists.VoyageNo.toLowerCase() === payload.VoyageNo.trim().toLowerCase() && exists.VesselMasterSid === payload.VesselMasterSid) {
                throw new BadRequestException('This vessel is already scheduled with this voyage number.');
            }
        }

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




    async softDelete(VoyageMasterHeaderSid: number) {

        try {
            const existingVoyage = await this._db.voyageMasterHeader.findUnique({
                where: { VoyageMasterHeaderSid: VoyageMasterHeaderSid }
            });

            if (!existingVoyage) {
                throw new NotFoundException(`Voyage with ID ${VoyageMasterHeaderSid} not found`);
            }

            if (existingVoyage.deletedAt) {
                throw new Error(`Voyage with ID ${VoyageMasterHeaderSid} is already deleted`);
            }

            const result = await this._db.$transaction(async (prisma) => {
                const deletedVoyageHeader = await prisma.voyageMasterHeader.update({
                    where: {
                        VoyageMasterHeaderSid: VoyageMasterHeaderSid
                    },
                    data: {
                        deletedAt: new Date()
                    }
                })

                const deletedVoyageDetail = await prisma.voyageMasterDetail.updateManyAndReturn({
                    where: {
                        VoyageMasterHeaderSid: VoyageMasterHeaderSid,
                        deletedAt: null
                    },
                    data: {
                        deletedAt: new Date()
                    }
                })

                return {
                    deletedVoyageHeader,
                    voyageDetail: deletedVoyageDetail
                }
            })
            return result;
        } catch (error) {
            throw error;
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
            "CrewIRN",
            "status"
        ];

        const intFields = [
            "VesselMasterSid",
            "Carrier",
        ];

        const acceptedType = [...stringFields, ...intFields];

        if (!acceptedType.includes(searchType)) {
            throw new BadRequestException('Invalid Search Type');
        }

        let whereClause: any = {};

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

        const searchResults = await this._db.voyageMasterHeader.findMany({
            where: {
                ...whereClause,
                deletedAt: null
            },
            include: {
                vesselMaster: {
                    select: {
                        VesselName: true
                    }
                },
                voyageMasterDetail: {
                    where: {
                        deletedAt: null
                    },
                    orderBy: {
                        VoyageMasterDetailSid: 'asc'
                    },
                    select: {
                        VoyageMasterDetailSid: true,
                        POLSid: true,
                        PODSid: true,
                        ETA: true,
                        ETD: true,
                        portMasterPOL: {
                            select: {
                                PortCode: true
                            }
                        },
                        portMasterPOD: {
                            select: {
                                PortCode: true
                            }
                        }
                    }
                }
            }
        }).catch((err) => {
            throw new Error(`Error Occurred: ${err}`);
        });

        return searchResults;
    }


    //     async specialSearch(payload) {
    //     const { POLSid, PODSid } = payload;
    //     const today = new Date().toISOString().split('T')[0];

    //     const searchResults = await this._db.voyageMasterHeader.findMany({
    //         where: {
    //             voyageMasterDetail: {
    //                 some: {
    //                     deletedAt: null
    //                 }
    //             }
    //         },
    //         include: {
    //             vesselMaster: {
    //                 select: {
    //                     VesselName: true
    //                 }
    //             },
    //             voyageMasterDetail: {
    //                 where: {
    //                     deletedAt: null
    //                 },
    //                 orderBy: {
    //                     VoyageMasterDetailSid: 'asc'
    //                 },
    //                 include: {
    //                     portMasterPOL: {
    //                         select: {
    //                             PortCode: true
    //                         }
    //                     },
    //                     portMasterPOD: {
    //                         select: {
    //                             PortCode: true
    //                         }
    //                     }
    //                 }
    //             }
    //         }
    //     }).catch((error) => {
    //         throw new Error(`Error Occurred: ${error}`);
    //     });
    //     const filteredResults = searchResults.filter(header => {
    //         const details = header.voyageMasterDetail;

    //         // Must have at least one detail
    //         if (details.length === 0) return false;

    //         // Get first and last details (ordered by VoyageMasterDetailSid)
    //         const firstDetail = details[0];
    //         const lastDetail = details[details.length - 1];

    //         // Check POL/POD conditions
    //         const validPol = firstDetail.POLSid === POLSid;
    //         const validPod = lastDetail.POLSid === PODSid;

    //         if (!validPol || !validPod) return false;

    //         // Check POD's ETD date is in future
    //         const podDate = lastDetail.ETD ? new Date(lastDetail.ETD).toISOString().split('T')[0] : new Date(0);
    //         return podDate >= today;
    //     });

    //     return filteredResults;
    // }


    async specialSearch(payload) {
        const { POLSid, PODSid } = payload;
        const today = new Date().toISOString().split('T')[0];

        const headers = await this._db.voyageMasterHeader.findMany({
            where: {
                voyageMasterDetail: {
                    some: {
                        deletedAt: null,
                    },
                },
            },
            orderBy: {
                VoyageMasterHeaderSid: 'asc',
            },
        });

        const validHeaders: any = [];

        for (const header of headers) {
            const details = await this._db.voyageMasterDetail.findMany({
                where: {
                    VoyageMasterHeaderSid: header.VoyageMasterHeaderSid,
                    deletedAt: null,
                },
                orderBy: {
                    VoyageMasterDetailSid: 'asc',
                },
            });

            if (details.length === 0) continue;

            const firstDetail = details[0];
            const lastDetail = details[details.length - 1];

            const validPol = firstDetail.POLSid === POLSid;
            const validPod = lastDetail.POLSid === PODSid;

            const podDate = lastDetail.ETD
                ? new Date(lastDetail.ETD).toISOString().split('T')[0]
                : new Date(0).toISOString().split('T')[0];

            if (validPol && validPod && podDate >= today) {
                validHeaders.push({ ...header, details });
            }
        }

        // Enrich results with vessel name using getMasterData
        const enrichedResults = await Promise.all(
            validHeaders.map(async (header) => {
                const vessel = await this.globalConfigService.getMasterData(
                    'vessel_master', // Assuming this key exists in MASTER_CONFIG
                    header.VesselMasterSid,
                    header.CompanyMasterSid,
                );

                return {
                    ...header,
                    vesselName: vessel?.VesselName || null,
                    voyageMasterDetail: header.details,
                };
            })
        );

        return {
            items: enrichedResults,
            totalCount: validHeaders.length,
        };
    }

   async searchList(params: SearchVesselDto) {
    const { search = '', page = 1, pageSize = 15 } = params;
    const skip = (page - 1) * pageSize;
    const today = new Date().toISOString(); // Use full ISO-8601 DateTime format

    const where: Prisma.VoyageMasterHeaderWhereInput = {
        deletedAt: null,
        voyageMasterDetail: {
            some: {
                deletedAt: null,
                ETD: {
                    gte: today
                }
            }
        },
        ...(search
            ? {
                OR: [
                    { VoyageNo: { contains: search, mode: 'insensitive' } },
                    { vesselMaster: { VesselName: { contains: search, mode: 'insensitive' } } },
                    { voyageMasterDetail: { some: { portMasterPOL: { PortCode: { contains: search, mode: 'insensitive' } } } } },
                    { voyageMasterDetail: { some: { portMasterPOL: { PortName: { contains: search, mode: 'insensitive' } } } } },
                ]
            }
            : {}
        )
    };

    const [items, totalCount] = await this._db.$transaction([
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
                voyageMasterDetail: {
                    where: {
                        deletedAt: null
                    },
                    orderBy: {
                        VoyageMasterDetailSid: 'asc'
                    },
                    include: {
                        portMasterPOL: {
                            select: {
                                PortCode: true
                            }
                        },
                        portMasterPOD: {
                            select: {
                                PortCode: true
                            }
                        }
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
}

}
