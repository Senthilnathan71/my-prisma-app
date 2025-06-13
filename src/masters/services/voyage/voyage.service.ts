import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { DatabaseService } from 'src/database/database.service';
import { SearchListDto } from 'src/masters/DTO/search-list.dto';

@Injectable()
export class VoyageService {
    constructor(private _db: DatabaseService, private logger: Logger) { }


    async createVoyage(payload: any, user) {
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
                    deletedAt:null
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
            where:{
                ... whereClause,
                deletedAt:null,
            },
            orderBy: {
                voyageMasterDetail: {
                    _count: 'desc', 
                },
            },
            include : {
                vesselMaster:{
                    select :{
                        VesselName:true
                    }
                },
                voyageMasterDetail : {
                    where : {
                      deletedAt : null  
                    },
                    select : {
                        portMasterPOL:{
                            select : {
                                PortCode : true
                            }
                        },
                        portMasterPOD : {
                            select : {
                                PortCode : true
                            }
                        },
                        ETA : true,
                        ETD : true
                    }
                },
            }
        }).catch((err) => {
            throw new Error(`Error Occurred: ${err}`);
        });

        return searchResults;
    }


    async specialSearch(payload){
        const {POLSid,PODSid} = payload;
        const searchResults = await this._db.voyageMasterHeader.findMany({
            where : {
                voyageMasterDetail : {
                    some : {
                        PODSid : PODSid,
                        POLSid : POLSid,
                        deletedAt : null
                    },
                },
            },
            include : {
                vesselMaster : {
                    select : {
                        VesselName : true
                    }
                },
                voyageMasterDetail : {
                    where : {
                        AND : {
                            POLSid :{
                                equals : POLSid
                            },
                            PODSid : {
                                equals : PODSid
                            },
                            deletedAt : {
                                equals : null
                            }
                        },
                    },
                    include : {
                        portMasterPOL : {
                            select : {
                                PortCode : true
                            }
                        },
                        portMasterPOD : {
                            select : {
                                PortCode : true
                            }
                        }
                    }
                }
            }
        }).catch((error)=>{
            throw new Error(`Error Occured : ${error}`);
        })

        return searchResults;
    }
}
