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
                    status:'A'
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

            if (existingVoyage.status==='D') {
                throw new Error(`Voyage with ID ${VoyageMasterHeaderSid} is already deleted`);
            }

            const result = await this._db.$transaction(async (prisma) => {
                const deletedVoyageHeader = await prisma.voyageMasterHeader.update({
                    where: {
                        VoyageMasterHeaderSid: VoyageMasterHeaderSid
                    },
                    data: {
                        status:'D'
                    }
                })

                const deletedVoyageDetail = await prisma.voyageMasterDetail.updateManyAndReturn({
                    where: {
                        VoyageMasterHeaderSid: VoyageMasterHeaderSid,
                        status:'D'
                    },
                    data: {
                        status:'D'
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
                status:'A'
            },
            include: {
                vesselMaster: {
                    select: {
                        VesselName: true
                    }
                },
                voyageMasterDetail: {
                    where: {
                        status:'A'
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
                        status:'A',
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
                    status:'A',
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
        status:'A',
        voyageMasterDetail: {
            some: {
                status:'A',
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

    let items;
    let totalCount;
    [items, totalCount] = await this._db.$transaction([
        this._db.voyageMasterHeader.findMany({
            where,
            skip,
            take: pageSize,
            orderBy: { VoyageMasterHeaderSid: 'desc' },
            include: {
                voyageMasterDetail: {
                    where: {
                        status:'A'
                    },
                    orderBy: {
                        VoyageMasterDetailSid: 'asc'
                    },
                }
            }
        }),
        this._db.voyageMasterHeader.count({ where })
    ]);

    items = await Promise.all(
        items.map(async (item)=>{
            const vesselMaster = item.VesselMasterSid !== null ? await this.globalConfigService.getMasterData('vessel_master', item.VesselMasterSid) : {VesselMasterSid : null , VesselName : ''};
            return {
                ...item,
                vesselMaster,
            }
        })
    )

    return {
        items,
        totalCount
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

    // Used in Booking Header
    async getAvailableVessels(
        POO: number | null,
        POL: number,
        POD: number,
        FPOD: number | null,
        MovementType: 'Air' | 'Sea' | 'Road'
    ) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const headers = await this._db.voyageMasterHeader.findMany({
            where: {
                status: 'A',
                VoyageType: MovementType,
                voyageMasterDetail: {
                    some: { status: 'A' },
                },
            },
            select: {
                VoyageMasterHeaderSid: true,
                vesselMaster: {
                    select: {
                        VesselMasterSid: true,
                        VesselName: true,
                    },
                },
                voyageMasterDetail: {
                    where: { status: 'A' },
                    orderBy: { ETD: 'asc' },
                    select: { POLSid: true, ETD: true,ETA : true },
                },
            },
        });

        const matching = headers.filter((header) => {
            const details = header.voyageMasterDetail;
            if (!details.length) return false;

            let startIndex = -1;
            if (POO) {
                const pooIndex = details.findIndex(d => d.POLSid === POO);
                if (pooIndex !== -1) {
                    startIndex = details.findIndex(
                        (d, idx) => idx >= pooIndex && d.POLSid === POL && new Date(d.ETA) >= today
                    );
                }
            }
            if (startIndex === -1) {
                startIndex = details.findIndex(
                    (d) => d.POLSid === POL && new Date(d.ETD) >= today 
                );
            }
            if (startIndex === -1) return false;

            const polIndex = startIndex;

            const hasPOD = details
                .slice(polIndex + 1)
                .some((d) => d.POLSid === POD);
            if (!hasPOD) return false;

            if (FPOD) {
                const podIndex = details.findIndex(
                    (d, idx) => idx > polIndex && d.POLSid === POD,
                );
                if (podIndex === -1) return false;

                const hasFPOD = details
                    .slice(podIndex + 1)
                    .some((d) => d.POLSid === FPOD);

                if (!hasFPOD && FPOD !== POD) return false;
            }

            return true;
        });

        const vesselsMap = new Map<number, { VesselMasterSid: number; VesselName: string }>();

        matching.forEach((h) => {
            vesselsMap.set(h.vesselMaster.VesselMasterSid, {
                VesselMasterSid: h.vesselMaster.VesselMasterSid,
                VesselName: h.vesselMaster.VesselName,
            });
        });

        return Array.from(vesselsMap.values());
    }


    // Used in Booking Header
    async getAvailableVoyagesWithPorts(
        VesselMasterSid: number,
        POL: number,
        POD: number,
        VoyageType: 'Air' | 'Sea' | 'Road',
        POO: number | null,
        FPOD: number | null,
    ) {
        const today = new Date();
        today.setHours(0, 0, 0, 0); // Set to start of today

        const headers = await this._db.voyageMasterHeader.findMany({
            where: {
                VesselMasterSid,
                status: 'A',
                VoyageType: VoyageType,
            },
            select: {
                VoyageMasterHeaderSid: true,
                VoyageNo: true,
                VoyageType: true,
                voyageMasterDetail: {
                    where: { status: 'A' },
                    orderBy: { ETD: 'asc' },
                    select: {
                        VoyageMasterDetailSid: true,
                        POLSid: true,
                        PODSid: true,
                        ETA: true,
                        ETD: true,
                    },
                },
            },
        });

        const matching = headers.filter((header) => {
            const details = header.voyageMasterDetail;
            let startIndex = -1;

            if (POO) {
                const pooIndex = details.findIndex(d => d.POLSid === POO);
                if (pooIndex !== -1) {
                    startIndex = details.findIndex(
                        (d, idx) => idx >= pooIndex && d.POLSid === POL && new Date(d.ETA) >= today
                    );
                }
            }

            if (startIndex === -1) {
                startIndex = details.findIndex(
                    (d) => d.POLSid === POL && new Date(d.ETD) >= today
                );
            }

            if (startIndex === -1) return false;

            const polIndex = startIndex;

            const hasPOD = details
                .slice(polIndex + 1)
                .some((d) => d.POLSid === POD);

            if (!hasPOD) return false;

            if (FPOD) {
                const podIndex = details.findIndex(
                    (d, idx) => idx > polIndex && d.POLSid === POD
                );
                if (podIndex === -1) return false;

                const hasFPOD = details
                    .slice(podIndex + 1)
                    .some((d) => d.POLSid === FPOD);

                if (!hasFPOD && FPOD !== POD) return false;
            }

            return true;
        });

        return matching.map((h) => ({
            VoyageMasterHeaderSid: h.VoyageMasterHeaderSid,
            VoyageNo: h.VoyageNo,
            VoyageType: h.VoyageType,
            Ports: h.voyageMasterDetail,
        }));
    }


    async getVoyagesByVesselId(VesselMasterSid: number) {
        try {
            const allVoyages = await this._db.voyageMasterHeader.findMany({
                where: {
                    VesselMasterSid: VesselMasterSid,
                    status:'A',
                    voyageMasterDetail: {
                        some: {}
                    }
                },
                include: {
                    voyageMasterDetail: {
                        where: { status:'A' },
                        orderBy: { VoyageMasterDetailSid: 'asc' }
                    }
                }
            })
            return allVoyages;
        } catch (error) {
            throw error;
        }
    }

}
