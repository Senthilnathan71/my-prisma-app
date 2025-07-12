import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { DatabaseService } from 'src/database/database.service';
import { SearchListDto } from 'src/masters/DTO/search-list.dto';
import { SearchVesselDto } from 'src/masters/DTO/search-vessel.dto';

@Injectable()
export class BlclauseService {
    constructor(private _db:DatabaseService){}

    async getAllBlclause(){
        try {
            const allBlclause = await this._db.bLClauseMaster.findMany({
                where : {
                    deletedAt:null
                }
            })
            return allBlclause;
        } catch (error) {
            throw error;
        }
    }

    async createNewBlclause(payload){
        try {
            const createdBlclause = await this._db.bLClauseMaster.create({
                data :{
                    ...payload,
                }
            })
            return createdBlclause;
        } catch (error) {
            throw error;
        }
    }

    async fetchBlclauseById(BLClauseMasterSid:number){
        try {
            const ourBlclause =await this._db.bLClauseMaster.findUnique({
                where : {
                    BLClauseMasterSid:BLClauseMasterSid
                }
            })
            if(!ourBlclause){
                throw new BadRequestException(`Blclause with Id : ${BLClauseMasterSid} not exists`);
            }
            return ourBlclause;
        } catch (error) {
            throw error;
        }
    }

    async updateBlclauseById(BLClauseMasterSid:number,payload){
        try {
             const exist =await this._db.bLClauseMaster.findUnique({
                where : {
                    BLClauseMasterSid:BLClauseMasterSid
                }
            })
            if(!exist){
                throw new BadRequestException(`Blclause with Id : ${BLClauseMasterSid} not exists`);
            }
            const updatedBlclause = this._db.bLClauseMaster.update({
                where : {
                    BLClauseMasterSid : BLClauseMasterSid
                },
                data : payload
            })
            return updatedBlclause;
        } catch (error) {
            throw error;
        }
    }


    async deleteBlClause(BLClauseMasterSid:number){
        try {
            const exist = await this._db.bLClauseMaster.findUnique({
                where: {
                    BLClauseMasterSid: BLClauseMasterSid
                }
            })
            if (!exist) {
                throw new BadRequestException(`Blclause with Id : ${BLClauseMasterSid} not exists`);
            }
            if (exist.deletedAt) {
                throw new BadRequestException(`Blclause with Id :${BLClauseMasterSid} is already deleted`)
            }
            const deletedBlclause = this._db.bLClauseMaster.update({
                where: {
                    BLClauseMasterSid: BLClauseMasterSid
                },
                data: {
                    deletedAt: new Date()
                }
            })
            return deletedBlclause;
        } catch(error) {
            throw error;
        }
    }


   async searchBlclause(params: SearchVesselDto) {
    const { search = '', page = 1, pageSize = 10 } = params;
    const skip = (page - 1) * pageSize;

    const where: Prisma.BLClauseMasterWhereInput = {
        deletedAt: null,
        status: 'A',
        ...(search 
            ? {
                OR: [ 
                    { ClauseDescription: { contains: search, mode: 'insensitive' } },
                    { Keyword: { contains: search, mode: 'insensitive' } },
                    { status: { contains: search, mode: 'insensitive' } },
                    // ...(!isNaN(Number(search)) 
                    //     ? [
                    //         { Sortorder: { equals: Number(search) } },
                    //         { DefaultClause: { equals: Number(search) } }
                    //       ] 
                    //     : [])
                ]
            } 
            : {})
    };

    const [items, totalCount] = await this._db.$transaction([
        this._db.bLClauseMaster.findMany({
            where,
            skip,
            take: pageSize,
            orderBy: { BLClauseMasterSid: 'desc' },
        }),
        this._db.bLClauseMaster.count({ where }),
    ]);

    return {
        items,
        totalCount,
    };
}
}
