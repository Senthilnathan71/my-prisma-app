import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { statusWhereClause } from 'src/common/helper';
import { DatabaseService } from 'src/database/database.service';
import { SearchListDto } from 'src/masters/DTO/search-list.dto';
import { filterDto } from 'src/masters/DTO/search-vessel.dto';

@Injectable()
export class ProductService {
    constructor(private _db: DatabaseService, private logger: Logger) { }

    async getAllProducts() {
        try {
            const allProducts = await this._db.productMaster.findMany({
                where: {
                    status: "A",
                    
                }
            })
            return allProducts;
        } catch (error) {
            throw error;
        }
    }

    async getAllProduct() {
        try {
            const allProducts = await this._db.productMaster.findMany({
                where: {
                    status: "A"
                }
            })
            return allProducts;
        } catch (error) {
            throw error;
        }
    }


    async createNewProduct(payload) {
        try {
            await this.ensureProductNameIsUnique(payload.ProductName);

            const createdProduct = await this._db.productMaster.create({
                data: {
                    ...payload,
                }
            })
            return createdProduct;
        } catch (error) {
            throw error;
        }
    }

    // Product master is not company-scoped in practice — the entry form never sends a
    // CompanyMasterSid, so rows land with it NULL. Matching on that column would only ever find
    // other NULL-company rows and silently miss real duplicates, so the name is checked globally.
    private async ensureProductNameIsUnique(
        ProductName: string,
        excludeProductMasterSId?: number,
    ) {
        if (!ProductName) {
            return;
        }

        const duplicate = await this._db.productMaster.findFirst({
            where: {
                ProductName: {
                    equals: ProductName.trim(),
                    mode: 'insensitive',
                },
                status: 'A',
                ...(excludeProductMasterSId
                    ? { ProductMasterSId: { not: Number(excludeProductMasterSId) } }
                    : {}),
            }
        });

        if (duplicate) {
            throw new BadRequestException('Product Name already exists');
        }
    }

    async fetchProductById(ProductMasterSid: number) {
        try {
            const ourProducts = await this._db.productMaster.findUnique({
                where: {
                    ProductMasterSId: ProductMasterSid
                }
            })
            if (!ourProducts) {
                throw new BadRequestException(`Product with Id : ${ProductMasterSid} not exists`);
            }
            return ourProducts;
        } catch (error) {
            throw error;
        }
    }

    async updateProductById(ProductMasterSid: number, payload) {
        try {
            const exist = await this._db.productMaster.findUnique({
                where: {
                    ProductMasterSId: ProductMasterSid
                }
            })
            if (!exist) {
                throw new BadRequestException(`Product with Id : ${ProductMasterSid} not exists`);
            }

            if (payload.ProductName) {
                await this.ensureProductNameIsUnique(payload.ProductName, ProductMasterSid);
            }

            const updatedProduct = this._db.productMaster.update({
                where: {
                    ProductMasterSId: ProductMasterSid
                },
                data: payload
            })
            return updatedProduct;
        } catch (error) {
            throw error;
        }
    }


    async deleteProduct(ProductMasterSid: number) {
        try {
            const exist = await this._db.productMaster.findUnique({
                where: {
                    ProductMasterSId: ProductMasterSid
                }
            })
            if (!exist) {
                throw new BadRequestException(`Product with Id : ${ProductMasterSid} not exists`);
            }
            if (exist.status === "D") {
                throw new BadRequestException(`Product with Id :${ProductMasterSid} is already deleted`)
            }
            const deletedProduct = this._db.productMaster.update({
                where: {
                    ProductMasterSId: ProductMasterSid
                },
                data: {
                    status: "D"
                }
            })
            return deletedProduct;
        } catch (error) {
            throw error;
        }
    }


    async searchProducts(data: SearchListDto) {
        const { searchType, filterValue } = data;
        const intFields = [
            "CategoryMasterSId",
            "CustomerMasterSid",
          
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
        const acceptedType = [...intFields, ...stringFields];
        if (!acceptedType.includes(searchType)) {
            throw new BadRequestException('Invalid Search Type');
        }

        const whereClause: any = {}

        if (stringFields.includes(searchType)) {
            whereClause[searchType] = {
                contains: filterValue,
                mode: 'insensitive'
            }
        } else if (intFields.includes(searchType)) {
            const numberValue = parseInt(filterValue);
            if (isNaN(numberValue)) {
                throw new BadRequestException(`${searchType} must be a valid number`);
            }
            whereClause[searchType] = numberValue;
        }

        const searchResults = await this._db.productMaster.findMany({
            where:
            {
                ...whereClause,
                status: "A"
            }
        }).catch((err) => {
            throw new Error(`Error Occured : ${JSON.stringify(err), err}`);
        })

        return searchResults;

    }

    async searchProductNew(params: filterDto) {
        const { search = '', page = 1, pageSize = 15, activeCompanyId } = params;
        const skip = (page - 1) * pageSize;

        const where: Prisma.ProductMasterWhereInput = {

            status: statusWhereClause,
            
            ...(search
                ? {
                    OR: [
                        { ProductName: { contains: search, mode: 'insensitive' } },
                        { ProductCode: { contains: search, mode: 'insensitive' } },
                        { ProductType: { contains: search, mode: 'insensitive' } },
                        { UOMCode: { contains: search, mode: 'insensitive' } },
                    ],
                }
                : {}
            ),
        };

        const [items, totalCount] = await this._db.$transaction([
            this._db.productMaster.findMany({
                where,
                skip,
                take: pageSize,
                orderBy: { ProductMasterSId: 'desc' },
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