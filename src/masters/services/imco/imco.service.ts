import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { DatabaseService } from 'src/database/database.service';
import { SearchListDto } from 'src/masters/DTO/search-list.dto';
import { SearchVesselDto } from 'src/masters/DTO/search-vessel.dto';

@Injectable()
export class ImcoService {
    constructor(private _db:DatabaseService){}

    async getAllIMCO(){
        try {
            const allIMCO = await this._db.imcoMaster.findMany({
                where : {
                    status : 'A',
                    deletedAt:null
                }
            })
            return allIMCO;
        } catch (error) {
            throw error;
        }
    }

    async createNewIMCO(payload){
        try {
            const createdIMCO = await this._db.imcoMaster.create({
                data :{
                    ...payload,
                }
            })
            return createdIMCO;
        } catch (error) {
            throw error;
        }
    }

    async fetchIMCOById(ImcoMasterSid:number){
        try {
            const ourimcoMaster =await this._db.imcoMaster.findUnique({
                where : {
                    ImcoMasterSid:ImcoMasterSid
                }
            })
            if(!ourimcoMaster){
                throw new BadRequestException(`IMCO with Id : ${ImcoMasterSid} not exists`);
            }
            return ourimcoMaster;
        } catch (error) {
            throw error;
        }
    }

    async updateimcoMasterById(ImcoMasterSid:number,payload){
        try {
             const exist =await this._db.imcoMaster.findUnique({
                where : {
                    ImcoMasterSid:ImcoMasterSid
                }
            })
            if(!exist){
                throw new BadRequestException(`IMCO with Id : ${ImcoMasterSid} not exists`);
            }
            const updatedimcoMaster = this._db.imcoMaster.update({
                where : {
                    ImcoMasterSid : ImcoMasterSid
                },
                data : payload
            })
            return updatedimcoMaster;
        } catch (error) {
            throw error;
        }
    }


    async deleteimcoMasters(ImcoMasterSid:number){
        try {
            const exist = await this._db.imcoMaster.findUnique({
                where: {
                    ImcoMasterSid: ImcoMasterSid
                }
            })
            if (!exist) {
                throw new BadRequestException(`IMCO with Id : ${ImcoMasterSid} not exists`);
            }
            if (exist.deletedAt) {
                throw new BadRequestException(`IMCO with Id :${ImcoMasterSid} is already deleted`)
            }
            const deletedimcoMaster = this._db.imcoMaster.update({
                where: {
                    ImcoMasterSid: ImcoMasterSid
                },
                data: {
                    deletedAt: new Date()
                }
            })
            return deletedimcoMaster;
        } catch(error) {
            throw error;
        }
    }


    async searchimcoMaster(params: SearchVesselDto) {
    const { search = '', page = 1, pageSize = 15 } = params;
    const skip = (page - 1) * pageSize;

    const where: Prisma.ImcoMasterWhereInput = {
        deletedAt: null,
        status: 'A',
        ...(search
            ? {
                OR: [
                    { ImcoClass: { contains: search, mode: 'insensitive' } },
                    { ImcoName: { contains: search, mode: 'insensitive' } },
                    { Description: { contains: search, mode: 'insensitive' } },
                    // { ImcoUn: { contains: search, mode: 'insensitive' } },
                    // { ImcoPageNo: { contains: search, mode: 'insensitive' } }, 
                    { PackingGroup: { contains: search, mode: 'insensitive' } },
                    { status: { contains: search, mode: 'insensitive' } },
                    { Remarks: { contains: search, mode: 'insensitive' } }, 
                ],
            }
            : {}
        ),
    };

    const [items, totalCount] = await this._db.$transaction([
        this._db.imcoMaster.findMany({
            where,
            skip,
            take: pageSize,
            orderBy: { ImcoMasterSid: 'desc' },
        }),
        this._db.imcoMaster.count({ where }),
    ]);

    return {
        items,
        totalCount,
    };
}
}
