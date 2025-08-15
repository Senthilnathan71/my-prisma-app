import { BadRequestException, Injectable,Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { DatabaseService } from 'src/database/database.service';
import { SearchListDto } from 'src/masters/DTO/search-list.dto';
import { SearchVesselDto } from 'src/masters/DTO/search-vessel.dto';

@Injectable()
export class ProductService {
    constructor(private _db:DatabaseService,  private logger: Logger){}

    async getAllProducts(){
        try {
            const allProducts = await this._db.productMaster.findMany({
                where : {
                    deletedAt:null
                }
            })
            return allProducts;
        } catch (error) {
            throw error;
        }
    }

    async createNewProduct(payload){
        try {
            const createdProduct = await this._db.productMaster.create({
                data :{
                    ...payload,
                }
            })
            return createdProduct;
        } catch (error) {
            throw error;
        }
    }

    async fetchProductById(ProductMasterSid:number){
        try {
            const ourProducts =await this._db.productMaster.findUnique({
                where : {
                    ProductMasterSId:ProductMasterSid
                }
            })
            if(!ourProducts){
                throw new BadRequestException(`Product with Id : ${ProductMasterSid} not exists`);
            }
            return ourProducts;
        } catch (error) {
            throw error;
        }
    }

    async updateProductById(ProductMasterSid:number,payload){
        try {
             const exist =await this._db.productMaster.findUnique({
                where : {
                    ProductMasterSId:ProductMasterSid
                }
            })
            if(!exist){
                throw new BadRequestException(`Product with Id : ${ProductMasterSid} not exists`);
            }
            const updatedProduct = this._db.productMaster.update({
                where : {
                    ProductMasterSId : ProductMasterSid
                },
                data : payload
            })
            return updatedProduct;
        } catch (error) {
            throw error;
        }
    }


    async deleteProduct(ProductMasterSid:number){
        try {
            const exist = await this._db.productMaster.findUnique({
                where: {
                    ProductMasterSId: ProductMasterSid
                }
            })
            if (!exist) {
                throw new BadRequestException(`Product with Id : ${ProductMasterSid} not exists`);
            }
            if (exist.deletedAt) {
                throw new BadRequestException(`Product with Id :${ProductMasterSid} is already deleted`)
            }
            const deletedProduct = this._db.productMaster.update({
                where: {
                    ProductMasterSId: ProductMasterSid
                },
                data: {
                    deletedAt: new Date()
                }
            })
            return deletedProduct;
        } catch(error) {
            throw error;
        }
    }


    async searchProducts(data:SearchListDto){
        const {searchType,filterValue}=data;
        const intFields=[
            "CategoryMasterSId",
            "CustomerMasterSid",
            "CompanyMasterSid",
            "UNNo",
        ];
        const stringFields = [
            "ProductCode",
            "ProductName",
            "Product_LL",
            "HSNCode",
            "UOMCode",
            "ProductId",
            "ImcoName",
            "UNo",
            "PackingGroup",
            "ProductType",
            "IMOClass",
            "IMOSubClass",
            "UNPackingCode",
            "FlashPoint",
            "Status"
        ];
        const acceptedType = [...intFields,...stringFields];
        if(!acceptedType.includes(searchType)){
            throw new BadRequestException('Invalid Search Type');
        }

        const whereClause:any ={}

        if(stringFields.includes(searchType)){
            whereClause[searchType]={
                contains:filterValue,
                mode:'insensitive'
            }
        } else if(intFields.includes(searchType)){
            const numberValue=parseInt(filterValue);
            if (isNaN(numberValue)) {
                throw new BadRequestException(`${searchType} must be a valid number`);
            }
            whereClause[searchType]=numberValue;
        }

        const searchResults = await this._db.productMaster.findMany({
            where : 
            {
                ...whereClause,
                deletedAt:null
            }
        }).catch((err) => {
            throw new Error(`Error Occured : ${JSON.stringify(err), err}`);
        })

        return searchResults;

    }

    async searchProductNew(params: SearchVesselDto) {
        const { search = '', page = 1, pageSize = 15 } = params;
        const skip = (page - 1) * pageSize;

        const where: Prisma.ProductMasterWhereInput = {
            deletedAt: null,
            status: 'A',
            ...(search
                ? {
                    OR: [
                        { ProductName: { contains: search, mode: 'insensitive'}},
                        { ProductCode: { contains: search, mode: 'insensitive'}},
                        { ProductType: { contains: search, mode: 'insensitive'}},
                        { UOMCode: { contains: search, mode: 'insensitive'}},
                    ],
                }
                :{}
            ),
        };

        const [ items, totalCount] = await this._db.$transaction([
            this._db.productMaster.findMany({
                where,
                skip,
                take: pageSize,
                orderBy: { ProductMasterSId: 'desc'},
            }),
            this._db.productMaster.count({ where }),
        ]);

        return {
            items,
            totalCount,
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
}