import { BadRequestException, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { GlobalConfigService } from 'src/common/config/master-config.service';
import { statusWhereClause } from 'src/common/helper';
import { DatabaseService } from 'src/database/database.service';
import { SearchListDto } from 'src/masters/DTO/search-list.dto';
import { filterDto } from 'src/masters/DTO/search-vessel.dto';

@Injectable()
export class HawbStockService {
    constructor(private _db: DatabaseService, private globalConfigService: GlobalConfigService, private logger: Logger) { }

    async getAllHawbStocks(CompanyMasterSid: number, BranchMasterSid: number) {
        try {
            const allHawbStocks = await this._db.hawbStock.findMany({
                where: {
                    status: "A",
                    CompanyMasterSid: CompanyMasterSid,
                    BranchMasterSid: BranchMasterSid
                },
                include: {
                    branchMaster: true,
                    companyMaster: true,
                    customerMaster: true
                }
            });
            return allHawbStocks;
        } catch (error) {
            throw error;
        }
    }

    // async createNewHawbStock(payload) {
    //     try {
    //         const createdHawbStock = await this._db.hawbStock.create({
    //             data: {
    //                 ...payload,
    //             },
    //             include: {
    //                 branchMaster: true,
    //                 companyMaster: true,
    //                 customerMaster: true
    //             }
    //         });
    //         return createdHawbStock;
    //     } catch (error) {
    //         throw error;
    //     }
    // }

    async createNewHawbStock(payload: any) {
        try {
          // Parse AWBList from frontend payload
        //   const awbList = payload.AWBList ? JSON.parse(payload.AWBList) : [];
            const awbList = payload.AWBList || [];
          if (!Array.isArray(awbList) || awbList.length === 0) {
            throw new BadRequestException(
              'AWB list is required to create HAWB stocks',
            );
          }
    
          const createdRecords: any[] = [];
    
          // Loop through each AWB item to create separate HAWB stock records
          let i = 1;
          for (const formattedAWB of awbList) {
            const record = await this._db.hawbStock.create({
              data: {
                CompanyMasterSid: payload.CompanyMasterSid,
                BranchMasterSid: payload.BranchMasterSid,
                AirwayBillType: payload.AirwayBillType || 'Airline',
                AirwayBillNumber: formattedAWB,
                Agent: payload.Agent ? Number(payload.Agent) : null,
                HAWBSerial: payload.HAWBSerial || '',
                NumberofHAWB: i++, // each record = 1 HAWB
                ReceivedDate: payload.ReceivedDate
                  ? new Date(payload.ReceivedDate)
                  : new Date(),
                StockStatus: 'Free',
                Remarks: payload.Remarks || payload.Remarks || null,
                createdBy: payload.createdBy,
                updatedBy: payload.updatedBy,
                updatedOn: new Date(),
                status: payload.status || 'A',
              },
            //   include: {
            //     branchMaster: true,
            //     companyMaster: true,
            //     customerMaster: true,
            //   },
            });
    
            createdRecords.push(record);
          }
    
          return {
            message: `${createdRecords.length} HAWB stock record(s) created successfully.`,
            data: createdRecords,
          };
        } catch (error) {
          console.error('Error creating HAWB Stock:', error);
          throw new BadRequestException(
            error.message || 'Failed to create HAWB Stocks',
          );
        }
      }



    async fetchHawbStockById(HawbStockSid: number, CompanyMasterSid: number, BranchMasterSid: number) {
        try {
            const hawbStock = await this._db.hawbStock.findUnique({
                where: {
                    HawbStockSid: HawbStockSid,
                    CompanyMasterSid: CompanyMasterSid,
                    BranchMasterSid: BranchMasterSid
                },
                include: {
                    branchMaster: true,
                    companyMaster: true,
                    customerMaster: true
                }
            });
            if (!hawbStock) {
                throw new UnauthorizedException(`Access denied.`);
            }
            return hawbStock;
        } catch (error) {
            throw error;
        }
    }

    async updateHawbStockById(HawbStockSid: number, payload) {
    try {
        const exist = await this._db.hawbStock.findUnique({
            where: { HawbStockSid }
        });

        if (!exist) {
            throw new BadRequestException(`HAWB Stock with Id : ${HawbStockSid} not exists`);
        }

        // Remove AWBList from payload if not provided (edit mode)
        const { AWBList, ...dataToUpdate } = payload;

        const updatedHawbStock = await this._db.hawbStock.update({
            where: { HawbStockSid },
            data: dataToUpdate,  // AWBList is omitted
            include: {
                branchMaster: true,
                companyMaster: true,
                customerMaster: true
            }
        });

        return updatedHawbStock;

    } catch (error) {
        throw error;
    }
}


    async deleteHawbStock(HawbStockSid: number) {
        try {
            const exist = await this._db.hawbStock.findUnique({
                where: {
                    HawbStockSid: HawbStockSid
                }
            });
            if (!exist) {
                throw new BadRequestException(`HAWB Stock with Id : ${HawbStockSid} not exists`);
            }
            if (exist.status === "D") {
                throw new BadRequestException(`HAWB Stock with Id :${HawbStockSid} is already deleted`)
            }
            const deletedHawbStock = await this._db.hawbStock.update({
                where: {
                    HawbStockSid: HawbStockSid
                },
                data: {
                    status: "D"
                },
                include: {
                    branchMaster: true,
                    companyMaster: true,
                    customerMaster: true
                }
            });
            return deletedHawbStock;
        } catch (error) {
            throw error;
        }
    }

    async searchHawbStock(params: filterDto) {
        const { search = '', page = 1, pageSize = 15, activeCompanyId, activeBranchId } = params;
        const skip = (page - 1) * pageSize;

        const where: Prisma.HawbStockWhereInput = {

            status: statusWhereClause,
            CompanyMasterSid: activeCompanyId,
            BranchMasterSid: activeBranchId,
            ...(search
                ? {
                    OR: [
                        { AirwayBillType: { contains: search, mode: 'insensitive' } },
                        { AirwayBillNumber: { contains: search, mode: 'insensitive' } },
                        { HAWBSerial: { contains: search, mode: 'insensitive' } },
                        { StockStatus: { contains: search, mode: 'insensitive' } },
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
            this._db.hawbStock.findMany({
                where,
                skip,
                take: pageSize,
                orderBy: { HawbStockSid: 'desc' },
            }),
            this._db.hawbStock.count({ where }),
        ]);


        // Enrich each item with master data
        items = await Promise.all(
            items.map(async (item) => {
                const [branch, company, customer] = await Promise.all([
                    item.BranchMasterSid !== null ?
                        this.globalConfigService.getMasterData('branch_master', item.BranchMasterSid, item.CompanyMasterSid) :
                        { BranchMasterSid: null, branchName: '', branchCode: '' },

                    item.CompanyMasterSid !== null ?
                        this.globalConfigService.getMasterData('company_master', item.CompanyMasterSid, item.CompanyMasterSid) :
                        { CompanyMasterSid: null, companyName: '', companyCode: '' },

                    item.CustomerMasterSid !== null ?
                        this.globalConfigService.getMasterData('customer_master', Number(item.Agent), item.CompanyMasterSid) :
                        { CustomerMasterSid: null, CustomerName: '', CustomerShortCode: '', PanName: '', CountryMasterSid: '' },
                ]);

                return {
                    ...item,
                    branch,
                    company,
                    customer,
                };
            })
        );

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