import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { statusWhereClause } from 'src/common/helper';
import { DatabaseService } from 'src/database/database.service';
import { SearchListDto } from 'src/masters/DTO/search-list.dto';
import { filterDto } from 'src/masters/DTO/search-vessel.dto';

@Injectable()
export class ZoneService {
  constructor(private _db: DatabaseService, private logger: Logger) { }

  async createNewZone(payload: any, user) {
    this.logger.warn(`createNewZone: ${payload}`);

    try {
      // Duplicate check for ZoneName and ZoneCode (case-insensitive, trimmed)
      if (payload?.ZoneName || payload?.ZoneCode) {
        const existingZone = await this._db.zoneMaster.findFirst({
          where: {
            OR: [
              {
                ZoneName: {
                  equals: payload.ZoneName?.trim(),
                  mode: 'insensitive',
                },
                status: 'A',
              },
              {
                ZoneCode: {
                  equals: payload.ZoneCode?.trim(),
                  mode: 'insensitive',
                },
                status: 'A',
              }
            ]
          },
        });

        if (existingZone) {
          if (existingZone.ZoneName.toLowerCase() === payload.ZoneName?.trim().toLowerCase()) {
            throw new BadRequestException('Zone name already exists');
          }
          if (existingZone.ZoneCode.toLowerCase() === payload.ZoneCode?.trim().toLowerCase()) {
            throw new BadRequestException('Zone code already exists');
          }
        }
      }

      const zone = await this._db.zoneMaster.create({
        data: {
          ...payload,
        }
      });
      return zone;
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      this.logger.error(`Error creating Zone: ${error.message}`, error.stack);
      throw new Error(`Error creating Zone: ${error.message}`);
    }
  }

  async getAllZones() {
    try {
      const allZones = await this._db.zoneMaster.findMany({
        where: {
          status: 'A',
        },
      });
      return allZones;
    } catch (error) {
      throw error;
    }
  }

  async getZoneById(id: number) {
    try {
      const ourZone = await this._db.zoneMaster.findUnique({
        where: {
          ZoneMasterSid: id,
        }
      })
      if (!ourZone) {
        throw new BadRequestException(`Zone with id : ${id} not exist`);
      }
      return ourZone;
    } catch (error) {
      throw error;
    }
  }

  async editZoneById(id: number, newData: any) {
    try {
      const existing = await this._db.zoneMaster.findUnique({
        where: {
          ZoneMasterSid: id,
        }
      })
      if (!existing) {
        throw new BadRequestException(`Zone with Id : ${id} not exist`);
      }

      // Duplicate check for update (excluding current record)
      if (newData?.ZoneName || newData?.ZoneCode) {
        const otherWithSameNameOrCode = await this._db.zoneMaster.findFirst({
          where: {
            OR: [
              {
                ZoneName: {
                  equals: newData.ZoneName?.trim(),
                  mode: 'insensitive',
                },
                NOT: { ZoneMasterSid: id },
                status: 'A',
              },
              {
                ZoneCode: {
                  equals: newData.ZoneCode?.trim(),
                  mode: 'insensitive',
                },
                NOT: { ZoneMasterSid: id },
                status: 'A',
              }
            ]
          },
        });

        if (otherWithSameNameOrCode) {
          if (otherWithSameNameOrCode.ZoneName.toLowerCase() === newData.ZoneName?.trim().toLowerCase()) {
            throw new BadRequestException('Zone name already exists');
          }
          if (otherWithSameNameOrCode.ZoneCode.toLowerCase() === newData.ZoneCode?.trim().toLowerCase()) {
            throw new BadRequestException('Zone code already exists');
          }
        }
      }

      const updatedData = await this._db.zoneMaster.update({
        where: {
          ZoneMasterSid: id,
        },
        data: newData,
      });
      return updatedData;
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw error;
    }
  }

  // Delete Zone By Id
  async softDeleteZone(id: number) {
    try {
      const existing = await this._db.zoneMaster.findUnique({
        where: {
          ZoneMasterSid: id,
        }
      })
      if (!existing) {
        throw new BadRequestException(`Zone Master with id : ${id} not found`);
      }
      if (existing.status === "D") {
        throw new BadRequestException(
          `Zone Master with id:${id} is already deleted`,
        );
      }
      const deletedZone = await this._db.zoneMaster.update({
        where: {
          ZoneMasterSid: id,
        },
        data: {
          status: "D",
        },
      });
      return deletedZone;
    } catch (error) {
      throw error;
    }
  }

  async searchZone() {
    try {
      const searchResults = await this._db.zoneMaster.findMany({
        where: {
          status: "A",
        }
      })
      return searchResults;
    } catch (error) {
      throw error;
    }
  }

  async searchZoneNew(params: filterDto) {
    const { search = '', page = 1, pageSize = 15 } = params;
    const skip = (page - 1) * pageSize;

    const where: Prisma.ZoneMasterWhereInput = {
      status: statusWhereClause,
      ...(search
        ? {
          OR: [
            { ZoneName: { contains: search, mode: 'insensitive' } },
            { ZoneCode: { contains: search, mode: 'insensitive' } },
            { status: { contains: search, mode: 'insensitive' } },
          ],
        }
        : {}
      ),
    };
    const [items, totalCount] = await this._db.$transaction([
      this._db.zoneMaster.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { ZoneMasterSid: 'desc' },
      }),
      this._db.zoneMaster.count({ where }),
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