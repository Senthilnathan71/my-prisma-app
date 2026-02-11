import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { GlobalConfigService } from 'src/common/config/master-config.service';
import { statusWhereClause } from 'src/common/helper';
import { DatabaseService } from 'src/database/database.service';
import { filterDto } from 'src/masters/DTO/search-vessel.dto';

@Injectable()
export class MawbStockService {
    constructor(private _db: DatabaseService, private globalConfigService: GlobalConfigService, private logger: Logger) { }
    
        async getAllMawbStocks(CompanyMasterSid: number, BranchMasterSid: number) {
            try {
                const allMawbStocks = await this._db.mawbStock.findMany({
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
                return allMawbStocks;
            } catch (error) {
                throw error;
            }
        }
    
        async createNewMawbStock(payload: any) {
        try {
          // Parse AWBList from frontend payload
        //   const awbList = payload.AWBList ? JSON.parse(payload.AWBList) : [];
            const awbList = payload.AWBList || [];
          if (!Array.isArray(awbList) || awbList.length === 0) {
            throw new BadRequestException(
              'AWB list is required to create MAWB stocks',
            );
          }
    
          const createdRecords: any[] = [];
    
          // Loop through each AWB item to create separate MAWB stock records
          let i = 1;
          for (const formattedAWB  of awbList) {
            const record = await this._db.mawbStock.create({
              data: {
                CompanyMasterSid: payload.CompanyMasterSid,
                BranchMasterSid: payload.BranchMasterSid,
                AirwayBillType: payload.AirwayBillType || 'Airline',
                MasterBillNumber: formattedAWB,
                Agent: payload.Agent ? Number(payload.Agent) : null,
                MAWBSerial: payload.MAWBSerial || '',
                NumberofMAWB: i++, // each record = 1 MAWB
                ReceivedDate: payload.ReceivedDate
                  ? new Date(payload.ReceivedDate)
                  : new Date(),
                StockStatus: 'Free',
                AvailableStatus: 'Available',
                Remarks: payload.Remarks || payload.Remarks || null,
                createdBy: payload.createdBy,
                updatedBy: payload.updatedBy,
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
            message: `${createdRecords.length} MAWB stock record(s) created successfully.`,
            data: createdRecords,
          };
        } catch (error) {
          console.error('Error creating MAWB Stock:', error);
          throw new BadRequestException(
            error.message || 'Failed to create MAWB Stocks',
          );
        }
      }
    
        async fetchMawbStockById(MawbStockSid: number) {
            try {
                const mawbStock = await this._db.mawbStock.findUnique({
                    where: {
                        MawbStockSid: MawbStockSid
                    },
                    include: {
                        branchMaster: true,
                        companyMaster: true,
                        customerMaster: true
                    }
                });
                if (!mawbStock) {
                    throw new BadRequestException(`MAWB Stock with Id : ${MawbStockSid} not exists`);
                }
                return mawbStock;
            } catch (error) {
                throw error;
            }
        }
    
         async updateMawbStockById(MawbStockSid: number, payload) {
    try {
        const exist = await this._db.mawbStock.findUnique({
            where: { MawbStockSid }
        });

        if (!exist) {
            throw new BadRequestException(`MAWB Stock with Id : ${MawbStockSid} not exists`);
        }

        // Remove AWBList from payload if not provided (edit mode)
        const { AWBList, ...dataToUpdate } = payload;

        const updatedMawbStock = await this._db.mawbStock.update({
            where: { MawbStockSid },
            data: dataToUpdate,  // AWBList is omitted
            include: {
                branchMaster: true,
                companyMaster: true,
                customerMaster: true
            }
        });

        return updatedMawbStock;

    } catch (error) {
        throw error;
    }
}
    
        async deleteMawbStock(MawbStockSid: number) {
            try {
                const exist = await this._db.mawbStock.findUnique({
                    where: {
                        MawbStockSid: MawbStockSid
                    }
                });
                if (!exist) {
                    throw new BadRequestException(`MAWB Stock with Id : ${MawbStockSid} not exists`);
                }
                if (exist.status === "D") {
                    throw new BadRequestException(`MAWB Stock with Id :${MawbStockSid} is already deleted`)
                }
                const deletedMawbStock = await this._db.mawbStock.update({
                    where: {
                        MawbStockSid: MawbStockSid
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
                return deletedMawbStock;
            } catch (error) {
                throw error;
            }
        }
    
        async searchMawbStock(params: filterDto) {
            const { search = '', page = 1, pageSize = 15, activeCompanyId, activeBranchId } = params;
            const skip = (page - 1) * pageSize;
    
            const where: Prisma.MawbStockWhereInput = {
    
                status: statusWhereClause,
                CompanyMasterSid: activeCompanyId,
                BranchMasterSid: activeBranchId,
                ...(search
                    ? {
                        OR: [
                            { AirwayBillType: { contains: search, mode: 'insensitive' } },
                            { MasterBillNumber: { contains: search, mode: 'insensitive' } },
                            { MAWBSerial: { contains: search, mode: 'insensitive' } },
                            { StockStatus: { contains: search, mode: 'insensitive' } },
                            { status: { contains: search, mode: 'insensitive' } },
                            { AvailableStatus: {contains: search, mode: 'insensitive'}},
                            { Remarks: { contains: search, mode: 'insensitive' } },
    
                        ],
                    }
                    : {}
                ),
            };
    
            let items;
            let totalCount;
            [items, totalCount] = await this._db.$transaction([
                this._db.mawbStock.findMany({
                    where,
                    skip,
                    take: pageSize,
                    orderBy: { MawbStockSid: 'desc' },
                }),
                this._db.mawbStock.count({ where }),
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
    
                        item.Agent  !== null ?
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
    async allocateStock(payload: {
        stockIds: number[],
        customerId: number,
        companyId: number,
        branchId: number
    }) {

        return await this._db.mawbStock.updateMany({
            where: {
                MawbStockSid: { in: payload.stockIds },
                CompanyMasterSid: payload.companyId,
                BranchMasterSid: payload.branchId,
                AirwayBillType: 'Airline',
                StockStatus: 'Free',
                AvailableStatus: 'Available',
                status: 'A'
            },
            data: {
                Agent: payload.customerId,
                AvailableStatus: 'Allocated'
            }
        });
    }


    async deallocateStock(payload: {
        stockIds: number[],
        customerId: number,
        companyId: number,
        branchId: number
    }) {

        if (!payload.stockIds?.length) {
            throw new BadRequestException('No stock selected');
        }

        return await this._db.mawbStock.updateMany({
            where: {
                MawbStockSid: { in: payload.stockIds },
                CompanyMasterSid: payload.companyId,
                BranchMasterSid: payload.branchId,
                AirwayBillType: 'Airline',
                StockStatus: 'Free',
                AvailableStatus: 'Allocated',
                Agent: payload.customerId,
                status: 'A'
            },
            data: {
                Agent: null,
                AvailableStatus: 'Available',
                updatedOn: new Date()
            }
        });
    }


    async getFreeStock(payload: {
        airlineId: number,
        companyId: number,
        branchId: number
    }) {

        return await this._db.mawbStock.findMany({
            where: {
                CompanyMasterSid: payload.companyId,
                BranchMasterSid: payload.branchId,
                AirwayBillType: 'Airline',
                Agent: payload.airlineId,
                StockStatus: 'Free',
                AvailableStatus: 'Available',
                status: 'A'
            },
            orderBy: {
                MawbStockSid: 'desc'
            }
        });
    }

    async getAllocatedStock(payload: {
        customerId: number,
        companyId: number,
        branchId: number
    }) {

        return await this._db.mawbStock.findMany({
            where: {
                CompanyMasterSid: payload.companyId,
                BranchMasterSid: payload.branchId,
                AirwayBillType: 'Airline',
                StockStatus: 'Free',
                AvailableStatus: 'Allocated',
                Agent: payload.customerId,
                status: 'A'
            },
            orderBy: {
                MawbStockSid: 'desc'
            }
        });
    }

}
