import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { DatabaseService } from 'src/database/database.service';
import { SearchListDto } from 'src/masters/DTO/search-list.dto';
import { SearchVesselDto } from 'src/masters/DTO/search-vessel.dto';

@Injectable()
export class SubledgermasterService {
     constructor(private _db:DatabaseService){}

    async getAllSuledgermaster(){
        try {
            const allSubledgermaster = await this._db.subledgerMaster.findMany({
                where : {
                    Status:"A",
                    deletedAt:null
                }
            })
            return allSubledgermaster;
        } catch (error) {
            throw error;
        }
    }

     async createNewSubledgerMaster(payload){
        try {
            const createdSubledgerMaster = await this._db.subledgerMaster.create({
                data :{
                    ...payload,
                }
            })
            return createdSubledgerMaster;
        } catch (error) {
            throw error;
        }
    }

    async fetchSubledgerMasterId(SubledgerMasterSid:number){
        try {
            const ourSubledgerMaster =await this._db.subledgerMaster.findUnique({
                where : {
                    SubledgerMasterSid:SubledgerMasterSid
                }
            })
            if(!ourSubledgerMaster){
                throw new BadRequestException(`SubledgerMaster with Id : ${SubledgerMasterSid} not exists`);
            }
            return ourSubledgerMaster;
        } catch (error) {
            throw error;
        }
    }

     async updateSubledgerMasterById(SubledgerMasterSid:number,payload){
        try {
             const exist =await this._db.subledgerMaster.findUnique({
                where : {
                    SubledgerMasterSid:SubledgerMasterSid
                }
            })
            if(!exist){
                throw new BadRequestException(`SubledgerMaster with Id : ${SubledgerMasterSid} not exists`);
            }
            const updatedSuledgerMaster = this._db.subledgerMaster.update({
                where : {
                    SubledgerMasterSid : SubledgerMasterSid
                },
                data : payload
            })
            return updatedSuledgerMaster;
        } catch (error) {
            throw error;
        }
    }

     async deleteSudledgerMaster(SubledgerMasterSid:number){
        try {
            const exist = await this._db.subledgerMaster.findUnique({
                where: {
                    SubledgerMasterSid: SubledgerMasterSid
                }
            })
            if (!exist) {
                throw new BadRequestException(`SubledgerMaster with Id : ${SubledgerMasterSid} not exists`);
            }
            if (exist.deletedAt) {
                throw new BadRequestException(`SubledgerMaster with Id :${SubledgerMasterSid} is already deleted`)
            }
            const deletedSuledgerMaster = this._db.subledgerMaster.update({
                where: {
                    SubledgerMasterSid: SubledgerMasterSid
                },
                data: {
                    deletedAt: new Date()
                }
            })
            return deletedSuledgerMaster;
        } catch(error) {
            throw error;
        }
    }


    async searchSubledgerMaster(params: SearchVesselDto) {
    const { search = '', page = 1, pageSize = 10 } = params;
    const skip = (page - 1) * pageSize;

    const where: Prisma.SubledgerMasterWhereInput = {
        deletedAt: null,
        Status: 'A',
        ...(search 
            ? {
                OR: [ 
                    // { ClauseDescription: { contains: search, mode: 'insensitive' } },
                    // { Keyword: { contains: search, mode: 'insensitive' } },
                    // { status: { contains: search, mode: 'insensitive' } },
                    {SubledgerName:{ contains: search, mode: 'insensitive' }},
                ]
            } 
            : {})
    };

    const [items, totalCount] = await this._db.$transaction([
        this._db.subledgerMaster.findMany({
            where,
            skip,
            take: pageSize,
            orderBy: { SubledgerMasterSid: 'desc' },
        }),
        this._db.subledgerMaster.count({ where }),
    ]);

    return {
        items,
        totalCount,
    };
}
}
