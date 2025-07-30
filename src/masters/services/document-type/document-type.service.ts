import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { GlobalConfigService } from 'src/common/config/master-config.service';
import { DatabaseService } from 'src/database/database.service';
import { SearchListDto } from 'src/masters/DTO/search-list.dto';
import { SearchVesselDto } from 'src/masters/DTO/search-vessel.dto';

@Injectable()
export class DocumentTypeService {
    constructor(private _db:DatabaseService,private globalConfigService:GlobalConfigService){}

    async getAllDocType(){
        try {
            const allDocType = await this._db.documentTypeMaster.findMany({
                where : {
                    deletedAt:null
                }
            })
            return allDocType;
        } catch (error) {
            throw error;
        }
    }

    async createNewDocType(payload){
        try {
            const createdDocType = await this._db.documentTypeMaster.create({
                data :{
                    ...payload,
                }
            })
            return createdDocType;
        } catch (error) {
            throw error;
        }
    }

    async fetchDocTypeById(DocumentTypeMasterSid:number){
        try {
            const ourDocType =await this._db.documentTypeMaster.findUnique({
                where : {
                    DocumentTypeMasterSid:DocumentTypeMasterSid
                }
            })
            if(!ourDocType){
                throw new BadRequestException(`DocType with Id : ${DocumentTypeMasterSid} not exists`);
            }
            return ourDocType;
        } catch (error) {
            throw error;
        }
    }

    async updateDocTypeById(DocumentTypeMasterSid:number,payload){
        try {
             const exist =await this._db.documentTypeMaster.findUnique({
                where : {
                    DocumentTypeMasterSid:DocumentTypeMasterSid
                }
            })
            if(!exist){
                throw new BadRequestException(`DocType with Id : ${DocumentTypeMasterSid} not exists`);
            }
            const updatedDocType = this._db.documentTypeMaster.update({
                where : {
                    DocumentTypeMasterSid : DocumentTypeMasterSid
                },
                data : payload
            })
            return updatedDocType;
        } catch (error) {
            throw error;
        }
    }


    async deleteDocType(DocumentTypeMasterSid:number){
        try {
            const exist = await this._db.documentTypeMaster.findUnique({
                where: {
                    DocumentTypeMasterSid: DocumentTypeMasterSid
                }
            })
            if (!exist) {
                throw new BadRequestException(`DocType with Id : ${DocumentTypeMasterSid} not exists`);
            }
            if (exist.deletedAt) {
                throw new BadRequestException(`DocType with Id :${DocumentTypeMasterSid} is already deleted`)
            }
            const deletedDocType = this._db.documentTypeMaster.update({
                where: {
                    DocumentTypeMasterSid: DocumentTypeMasterSid
                },
                data: {
                    deletedAt: new Date()
                }
            })
            return deletedDocType;
        } catch(error) {
            throw error;
        }
    }


    async searchDocType(params: SearchVesselDto) {
    const { search = '', page = 1, pageSize = 10 } = params;
    const skip = (page - 1) * pageSize;

    const where: Prisma.DocumentTypeMasterWhereInput = {
        deletedAt: null,
        status: 'A',
        ...(search
            ? {
                OR: [
                    { DocumentTypeName: { contains: search, mode: 'insensitive' } },
                    { DocumentTypeCode: { contains: search, mode: 'insensitive' } },
                    { status: { contains: search, mode: 'insensitive' } },
                    { Remarks: { contains: search, mode: 'insensitive' } },
                ],
            }
            : {}
        ),
    };

    let items;
    let totalCount;
    [items, totalCount] = await this._db.$transaction([
        this._db.documentTypeMaster.findMany({
            where,
            skip,
            take: pageSize,
            orderBy: { DocumentTypeMasterSid: 'desc' },
        }),
        this._db.documentTypeMaster.count({ where }),
    ]);

    items = await Promise.all(
        items.map(async (item)=> {
            const [branchMaster] = await Promise.all([
                this.globalConfigService.getMasterData('branch_master',item.BranchMasterSid, item.CompanyMasterSid)
            ])
            return {
                ...item,
                branchMaster
            }
        })
    )

    return {
        items,
        totalCount,
    };
}

}
