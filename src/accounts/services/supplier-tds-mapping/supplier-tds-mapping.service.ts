import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { DatabaseService } from 'src/database/database.service';
import { SearchVesselDto } from 'src/masters/DTO/search-vessel.dto';
@Injectable()
export class SupplierTdsMappingService {
    constructor(private _db:DatabaseService){}

    async getAllSupptdsMapping(){
        try {
            const allsupptdsmapp = await this._db.supplierTdsMapping.findMany({
                where : {
                    deletedAt : null,
                    Status : 'A'
                }
            })
            return allsupptdsmapp;
        } catch (error) {
            throw error;
        }
    }

     async createNewSupptdsMapping(payload){
        try {
            const createdSupptdsMapping = await this._db.supplierTdsMapping.create({
                data :{
                    ...payload,
                }
            })
            return createdSupptdsMapping;
        } catch (error) {
            throw error;
        }
    }

    async fetchSuppliertdsMappingById(SupplierTdsMappingSid:number){
        try {
            const ourSupplierTDSMapping =await this._db.supplierTdsMapping.findUnique({
                where : {
                    SupplierTdsMappingSid:SupplierTdsMappingSid
                }
            })
            if(!ourSupplierTDSMapping){
                throw new BadRequestException(`Supplier TDS Mapping with Id : ${SupplierTdsMappingSid} not exists`);
            }
            return ourSupplierTDSMapping;
        } catch (error) {
            throw error;
        }
    }


     async updateSuppliertdsMappingById(SupplierTdsMappingSid:number,payload){
        try {
             const exist =await this._db.supplierTdsMapping.findUnique({
                where : {
                    SupplierTdsMappingSid:SupplierTdsMappingSid
                }
            })
            if(!exist){
                throw new BadRequestException(`Supplier TDS Mapping with Id : ${SupplierTdsMappingSid} not exists`);
            }
            const updatedSupplierTdsMappingSid = this._db.supplierTdsMapping.update({
                where : {
                    SupplierTdsMappingSid : SupplierTdsMappingSid
                },
                data : payload
            })
            return updatedSupplierTdsMappingSid;
        } catch (error) {
            throw error;
        }
    }

     async deleteSuppliertdsMapping(SupplierTdsMappingSid:number){
        try {
            const exist = await this._db.supplierTdsMapping.findUnique({
                where: {
                    SupplierTdsMappingSid: SupplierTdsMappingSid
                }
            })
            if (!exist) {
                throw new BadRequestException(`Supplier TDS Mapping with Id : ${SupplierTdsMappingSid} not exists`);
            }
            if (exist.deletedAt) {
                throw new BadRequestException(`Supplier TDS Mapping with Id :${SupplierTdsMappingSid} is already deleted`)
            }
            const deletedSupplierTDSMapping = this._db.supplierTdsMapping.update({
                where: {
                    SupplierTdsMappingSid: SupplierTdsMappingSid
                },
                data: {
                    deletedAt: new Date()
                }
            })
            return deletedSupplierTDSMapping;
        } catch(error) {
            throw error;
        }
    }

      async searchSuppliertdsMapping(params: SearchVesselDto) {
    const { search = '', page = 1, pageSize = 10 } = params;
    const skip = (page - 1) * pageSize;

    const where: Prisma.SupplierTdsMappingWhereInput = {
        deletedAt: null,
        Status: 'A',
        ...(search 
            ? {
                OR: [ 
                    // { ClauseDescription: { contains: search, mode: 'insensitive' } },
                    // { Keyword: { contains: search, mode: 'insensitive' } },
                    // { status: { contains: search, mode: 'insensitive' } },
                 
                ]
            } 
            : {})
    };

    const [items, totalCount] = await this._db.$transaction([
        this._db.supplierTdsMapping.findMany({
            where,
            skip,
            take: pageSize,
            orderBy: { SupplierTdsMappingSid: 'desc' },
        }),
        this._db.supplierTdsMapping.count({ where }),
    ]);

    return {
        items,
        totalCount,
    };
}

 
}
