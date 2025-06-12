import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { DatabaseService } from 'src/database/database.service';
import { SearchListDto } from 'src/masters/DTO/search-list.dto';

@Injectable()
export class VoyageDetailService {
    constructor(private _db: DatabaseService) { }


    async createVoyageDetail(payload: any) {
        try {
            const voyageDetail = await this._db.voyageMasterDetail.create({
                data: {
                    ...payload,
                }
            });

            return voyageDetail;
        } catch (error) {
            throw error;
        }
    }


    async getAllVoyageDetails() {
        try {
            const voyageDetailList = await this._db.voyageMasterDetail.findMany({
                where: {
                    deletedAt: null
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
                    },
                }
            })
            return voyageDetailList;
        } catch (error) {
            throw error
        }
    }



    async findOne(VoyageMasterDetailSid: number) {
        try {
            const ourVoyageDetail = await this._db.voyageMasterDetail.findUnique({
                where : {
                    VoyageMasterDetailSid: VoyageMasterDetailSid
                }
            })
            if(!ourVoyageDetail){
                throw new BadRequestException(`Voyage Detail with id : ${VoyageMasterDetailSid} not exists`);
            }
            return ourVoyageDetail;
        } catch (error) {
            throw error;
        }
    }


    async updateVoyageDetail(VoyageMasterDetailSid: number, payload: any) {
        try {
            const ourVoyageDetail = await this._db.voyageMasterDetail.findUnique({
                where: {
                    VoyageMasterDetailSid: VoyageMasterDetailSid
                }
            })
            if (!ourVoyageDetail) {
                throw new BadRequestException(`Voyage Detail with id : ${VoyageMasterDetailSid} not exists`);
            }
            const updatedVoyageDetail = await this._db.voyageMasterDetail.update({
                where : {
                    VoyageMasterDetailSid:VoyageMasterDetailSid,
                },
                data:{
                    ...payload
                }
            })
            return updatedVoyageDetail;
        } catch (error) {
            throw error;
        }
    }




    async softDelete(VoyageMasterDetailSid: number) {
        try {
            const ourVoyageDetail = await this._db.voyageMasterDetail.findUnique({
                where: {
                    VoyageMasterDetailSid: VoyageMasterDetailSid
                }
            })
            if (!ourVoyageDetail) {
                throw new BadRequestException(`Voyage Detail with id : ${VoyageMasterDetailSid} not exists`);
            }
            if (ourVoyageDetail.deletedAt) {
                throw new BadRequestException(`Voyage Detail with id : ${VoyageMasterDetailSid} is already deleted`);
            }
            const deletedVoyageDetail = await this._db.voyageMasterDetail.update({
                where : {
                    VoyageMasterDetailSid:VoyageMasterDetailSid,
                },
                data:{
                    deletedAt : new Date()
                }
            })
            return deletedVoyageDetail;
        } catch (error) {
            throw error;
        }
    }

     async searchVoyageDetail(data: SearchListDto) {
        const { searchType, filterValue } = data;

        const stringFields = [
            "RotationNo",
            "IGMNo",
            "EGMNo",
            "Coloader",
            "Remarks",
            "status"
        ];

        const intFields = [
            "POLSid",
            "PODSid",
            "TransitDays",
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

        const searchResults = await this._db.voyageMasterDetail.findMany({
            where:{
                ... whereClause,
                deletedAt:null
            },
            include :{
                portMasterPOL : {
                    select : {
                        PortCode: true
                    }
                },
                portMasterPOD : {
                    select:{
                        PortCode:true
                    }
                },
            }
        }).catch((err) => {
            throw new Error(`Error Occurred: ${err}`);
        });

        return searchResults;
    }

}
