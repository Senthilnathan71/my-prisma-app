import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { statusWhereClause } from 'src/common/helper';
import { DatabaseService } from 'src/database/database.service';
import { SearchListDto } from 'src/masters/DTO/search-list.dto';
import { filterDto } from 'src/masters/DTO/search-vessel.dto';

@Injectable()
export class NetworkMasterService {
    constructor(private _db: DatabaseService, private logger: Logger) { }

    async createNetwork(payload: any) {
        this.logger.warn(`createNetwork: ${payload}`);

        const existing = await this._db.networkMaster.findFirst({
            where: {
                OR: [
                    {
                        NetworkName: {
                            equals: payload.NetworkName,
                            mode: 'insensitive',
                        }
                    }
                ]
            },
        });

        if (existing) {
            if (existing.NetworkName === payload.NetworkName) {
                throw new BadRequestException('Network name already exists');
            }
        }

        try {
            const network = await this._db.networkMaster.create({
                data: {
                    ...payload,
                }
            });

            return network;
        } catch (error) {
            throw new Error(`Error creating network: ${error.message}`);
        }
    }

    async getAllNetworks() {
        try {
            const networkList = await this._db.networkMaster.findMany({
                where: {
                    Status: 'A',
                },
                include: {
                    countryMaster: true
                }
            })
            return networkList;
        } catch (error) {
            throw error
        }
    }

    async getNetworkByType(type: string) {
        try {
            const network = await this._db.networkMaster.findMany({
                where: {
                    NetworkType: type,
                    Status: "A"
                },
                include: {
                    countryMaster: true
                }
            });
            return network;
        } catch (error) {
            throw error;
        }
    }

    async findOne(NetworkMasterSid: any) {
        try {
            return await this._db.networkMaster.findUnique({
                where: {
                    NetworkMasterSid: NetworkMasterSid
                },
                include: {
                    countryMaster: true
                }
            });
        } catch (error) {
            throw error;
        }
    }

    async updateNetwork(NetworkMasterSid: number, payload: any) {
        const existing = await this._db.networkMaster.findUnique({
            where: {
                NetworkMasterSid: NetworkMasterSid
            }
        });

        if (!existing) {
            throw new NotFoundException('Network does not exist');
        }

        const duplicate = await this._db.networkMaster.findFirst({
            where: {
                AND: [
                    {
                        NetworkMasterSid: {
                            not: NetworkMasterSid
                        }
                    },
                    {
                        NetworkName: {
                            equals: payload.NetworkName,
                            mode: 'insensitive'
                        }
                    }
                ]
            }
        });

        if (duplicate) {
            if (duplicate.NetworkName === payload.NetworkName) {
                throw new BadRequestException('Network name already exists');
            }
        }

        try {
            const Network = await this._db.networkMaster.update({
                where: {
                    NetworkMasterSid: NetworkMasterSid
                },
                data: payload
            });
            return Network;
        } catch (error) {
            throw new Error(`Error updating Network: ${error.message}`);
        }
    }

    async softDelete(id: number) {
        const existingNetwork = await this._db.networkMaster.findUnique({
            where: { NetworkMasterSid: id }
        });

        if (!existingNetwork) {
            throw new NotFoundException(`Network with ID ${id} not found`);
        }

        if (existingNetwork.Status === "D") {
            throw new Error(`Network with ID ${id} is already deleted`);
        }

        return this._db.networkMaster.update({
            where: { NetworkMasterSid: id },
            data: { Status: "D" }
        });
    }

    async searchList(params: filterDto) {
        const { search = '', page = 1, pageSize = 15, activeCompanyId } = params;
        const skip = (page - 1) * pageSize;

        const where: Prisma.NetworkMasterWhereInput = {
            Status: statusWhereClause,
            ...(search
                ? {
                    OR: [
                        { NetworkName: { contains: search, mode: 'insensitive' } },
                        { NetworkType: { contains: search, mode: 'insensitive' } },
                        { Status: { contains: search, mode: 'insensitive' } },
                        { countryMaster: { countryName: { contains: search, mode: 'insensitive' } } },
                    ],
                }
                : {}
            ),
        };

        const [items, totalCount] = await this._db.$transaction([
            this._db.networkMaster.findMany({
                where,
                skip,
                take: pageSize,
                orderBy: { NetworkMasterSid: 'desc' },
                include: {
                    countryMaster: true
                }
            }),
            this._db.networkMaster.count({ where }),
        ]);

        return {
            items,
            totalCount,
        };
    }

    async searchListUsingView(params: filterDto) {
        const { search = '', page = 1, pageSize = 15 } = params;
        const skip = (page - 1) * pageSize;

        // Assuming you have a view for network similar to department
        const where: any = {
            Status: statusWhereClause,
            ...(search
                ? {
                    OR: [
                        { NetworkName: { contains: search, mode: 'insensitive' } },
                        { NetworkType: { contains: search, mode: 'insensitive' } },
                        { Status: { contains: search, mode: 'insensitive' } },
                        { countryName: { contains: search, mode: 'insensitive' } },
                    ],
                }
                : {}
            ),
        };

        // If you have a vNetworkIndexPage view, use it, otherwise fallback to regular search
        try {
            const [items, totalCount] = await this._db.$transaction([
                this._db.networkMaster.findMany({
                    where,
                    skip,
                    take: pageSize,
                    orderBy: { NetworkMasterSid: 'desc' },
                    include: {
                        countryMaster: true
                    }
                }),
                this._db.networkMaster.count({ where }),
            ]);

            return {
                items,
                totalCount,
            };
        } catch (error) {
            // Fallback to regular search if view doesn't exist
            return this.searchList(params);
        }
    }

    async getAuditLogs(tableName: string, recordId?: string) {
        try {
            const whereClause: any = { tableName };
            if (recordId) whereClause.recordId = recordId;

            const logs = await this._db.auditLog.findMany({
                where: whereClause,
                orderBy: { changedAt: 'desc' },
            });

            return logs.filter(log => log.oldVal !== log.newVal);
        } catch (error) {
            this.logger.warn(`getAuditLogsError: ${error}`);
            throw new Error(`Error fetching audit logs: ${error.message}`);
        }
    }

    // async blkUpdateNetworkMaster(updates: any[]) {
    //     try{
    //         const results = [];
    //         for (const update of updates) {
    //             const { NetworkMasterSid, ...updatedData} = update;
    //             const exist = await this._db.networkMaster.findUnique({
    //                 where: { NetworkMasterSid}
    //             });
    //             if (!exist) {
    //                 throw new BadRequestException(`NetworkMaster with Id: ${NetworkMasterSid} not exists`);
    //             }
    //             const updated = await this._db.networkMaster.update({
    //                 where: {
    //                     NetworkMasterSid
    //                 },
    //                 data: updatedData
    //             });
    //         }
    //         return results;
    //     } catch (error) {
    //         throw error;
    //     }
    // }

    async blkUpdateNetworkMaster(updates: any[]) {
  try {
    const results: any[] = [];

    for (const update of updates) {
      const { NetworkMasterSid, ...updatedData } = update;

      if (NetworkMasterSid) {
        const exist = await this._db.networkMaster.findUnique({
          where: { NetworkMasterSid }
        });

        if (exist) {
          const updated = await this._db.networkMaster.update({
            where: { NetworkMasterSid },
            data: updatedData
          });
          results.push(updated);
          continue;
        }
      }

      const created = await this._db.networkMaster.create({
        data: updatedData
      });
      results.push(created);
    }

    return results;

  } catch (error) {
    throw error;
  }
}


}