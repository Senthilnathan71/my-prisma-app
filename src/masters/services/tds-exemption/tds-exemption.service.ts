import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { DatabaseService } from 'src/database/database.service';
import { SearchVesselDto } from 'src/masters/DTO/search-vessel.dto';

@Injectable()
export class TdsExemptionService {
    constructor(private _db:DatabaseService){}

    async getAllTdsExemption(){
        try {
            const allTdsExemption = await this._db.tDSExemption.findMany({
                where : {
                    status : 'A',
                    deletedAt : null
                }
            })
            return allTdsExemption;
        } catch (error) {
            throw error;
        }
    }

    async createNewTdsExemption(payload) {
        try {
            const createdTdsExemption = await this._db.tDSExemption.create({
                data: {
                    ...payload,
                }
            });
            return createdTdsExemption;
        } catch (error) {
            throw error;
        }
    }


    async fetchTdsExemptionById(TDSExemptionSid:number){
        try {
            const ourTdsExemption =await this._db.tDSExemption.findUnique({
                where : {
                    TDSExemptionSid:TDSExemptionSid
                }
            })
            if(!ourTdsExemption){
                throw new BadRequestException(`TdsExemption with Id : ${TDSExemptionSid} not exists`);
            }
            return ourTdsExemption;
        } catch (error) {
            throw error;
        }
    }
    async fetchTdsExemptionByHeader(TDSSetHeaderSid:number){
        try {
            const ourTdsExemption =await this._db.tDSExemption.findMany({
                where : {
                    TDSSetHeaderSid:TDSSetHeaderSid,
                    deletedAt : null,
                },
                include : {
                    vesselMaster : {
                        select : {
                            VesselName : true
                        }
                    },
                    customerCarrier : {
                        select : {
                            CustomerName : true,
                        }
                    },
                    customerTransporter : {
                        select : {
                            CustomerName : true,
                        }
                    }
                },
                orderBy : {
                    TDSExemptionSid : 'desc'
                }
            })
            if(!ourTdsExemption){
                throw new BadRequestException(`TdsExemption with Header Id : ${TDSSetHeaderSid} not exists`);
            }
            return ourTdsExemption;
        } catch (error) {
            throw error;
        }
    }

    async updateTdsExemptionById(TDSExemptionSid: number, payload) {

        try {
            const exist = await this._db.tDSExemption.findUnique({
                where: {
                    TDSExemptionSid: TDSExemptionSid
                }
            });
            if (!exist) {
                throw new BadRequestException(`TdsExemption with Id : ${TDSExemptionSid} not exists`);
            }
            const updatedTdsExemption = await this._db.tDSExemption.update({
                where: {
                    TDSExemptionSid: TDSExemptionSid
                },
                data: payload
            });
            return updatedTdsExemption;
        } catch (error) {
            throw error;
        }
    }


    async deleteTdsExemption(TDSExemptionSid:number){
        try {
            const exist = await this._db.tDSExemption.findUnique({
                where: {
                    TDSExemptionSid: TDSExemptionSid
                }
            })
            if (!exist) {
                throw new BadRequestException(`TdsExemption with Id : ${TDSExemptionSid} not exists`);
            }
            if (exist.deletedAt) {
                throw new BadRequestException(`TdsExemption with Id :${TDSExemptionSid} is already deleted`)
            }
            const deletedTdsExemption = this._db.tDSExemption.update({
                where: {
                    TDSExemptionSid: TDSExemptionSid
                },
                data: {
                    deletedAt: new Date()
                }
            })
            return deletedTdsExemption;
        } catch(error) {
            throw error;
        }
    }


   async searchTdsExemption(params: SearchVesselDto) {
    const { search = '', page = 1, pageSize = 10 } = params;
    const skip = (page - 1) * pageSize;
    const where : Prisma.TDSExemptionWhereInput = {
        deletedAt: null,
        status: 'A',
    };

    const [items, totalCount] = await this._db.$transaction([
        this._db.tDSExemption.findMany({
            where,
            skip,
            take: pageSize,
            orderBy: { TDSExemptionSid: 'desc' },
        }),
        this._db.tDSExemption.count({ where }),
    ]);

    return {
        items,
        totalCount,
        currentPage: page,
        totalPages: Math.ceil(totalCount / pageSize),
    };
}
}
