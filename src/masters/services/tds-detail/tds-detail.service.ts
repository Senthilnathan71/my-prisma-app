import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { DatabaseService } from 'src/database/database.service';
import { SearchVesselDto } from 'src/masters/DTO/search-vessel.dto';

@Injectable()
export class TdsDetailService {
    constructor(private _db:DatabaseService){}

    async getAllTdsDetail(){
        try {
            const allTdsDetail = await this._db.tDSSetRate.findMany({
                where : {
                    status : 'A',
                    deletedAt : null
                }
            })
            return allTdsDetail;
        } catch (error) {
            throw error;
        }
    }

    async createNewTdsDetail(payload) {
        try {
            const createdTdsDetail = await this._db.tDSSetRate.create({
                data: {
                    ...payload,
                }
            });
            return createdTdsDetail;
        } catch (error) {
            throw error;
        }
    }


    async fetchTdsDetailById(TDSSetRateSid:number){
        try {
            const ourTdsDetail =await this._db.tDSSetRate.findUnique({
                where : {
                    TDSSetRateSid:TDSSetRateSid
                }
            })
            if(!ourTdsDetail){
                throw new BadRequestException(`TdsDetail with Id : ${TDSSetRateSid} not exists`);
            }
            return ourTdsDetail;
        } catch (error) {
            throw error;
        }
    }
    async fetchTdsDetailByHeaderId(TDSSetHeaderSid:number){
        try {
            const ourTdsDetail =await this._db.tDSSetRate.findMany({
                where : {
                    TDSSetHeaderSid:TDSSetHeaderSid,
                    deletedAt : null
                },
                include : {
                    countryMaster : {
                        select : {
                            countryName : true
                        }
                    }
                },
                orderBy : {
                    Sno : 'asc'
                }
            })
            if(!ourTdsDetail){
                throw new BadRequestException(`TdsDetail with Id : ${TDSSetHeaderSid} not exists`);
            }
            return ourTdsDetail;
        } catch (error) {
            throw error;
        }
    }

    async updateTdsDetailById(TDSSetRateSid: number, payload) {

        try {
            const exist = await this._db.tDSSetRate.findUnique({
                where: {
                    TDSSetRateSid: TDSSetRateSid
                }
            });
            if (!exist) {
                throw new BadRequestException(`TdsDetail with Id : ${TDSSetRateSid} not exists`);
            }
            const updatedTdsDetail = await this._db.tDSSetRate.update({
                where: {
                    TDSSetRateSid: TDSSetRateSid
                },
                data: payload
            });
            return updatedTdsDetail;
        } catch (error) {
            throw error;
        }
    }


    async deleteTdsDetail(TDSSetRateSid:number){
        try {
            const exist = await this._db.tDSSetRate.findUnique({
                where: {
                    TDSSetRateSid: TDSSetRateSid
                }
            })
            if (!exist) {
                throw new BadRequestException(`TdsDetail with Id : ${TDSSetRateSid} not exists`);
            }
            if (exist.deletedAt) {
                throw new BadRequestException(`TdsDetail with Id :${TDSSetRateSid} is already deleted`)
            }
            const deletedTdsDetail = this._db.tDSSetRate.update({
                where: {
                    TDSSetRateSid: TDSSetRateSid
                },
                data: {
                    deletedAt: new Date()
                }
            })
            return deletedTdsDetail;
        } catch(error) {
            throw error;
        }
    }


   async searchTdsDetail(params: SearchVesselDto) {
    const { search = '', page = 1, pageSize = 15 } = params;
    const skip = (page - 1) * pageSize;
    const where : Prisma.TDSSetRateWhereInput = {
        deletedAt: null,
        status: 'A',
    };

    const [items, totalCount] = await this._db.$transaction([
        this._db.tDSSetRate.findMany({
            where,
            skip,
            take: pageSize,
            orderBy: { TDSSetRateSid: 'desc' },
        }),
        this._db.tDSSetRate.count({ where }),
    ]);

    return {
        items,
        totalCount,
        currentPage: page,
        totalPages: Math.ceil(totalCount / pageSize),
    };
}
}
