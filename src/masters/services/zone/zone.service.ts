import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { DatabaseService } from 'src/database/database.service';
import { SearchListDto } from 'src/masters/DTO/search-list.dto';
import { SearchVesselDto } from 'src/masters/DTO/search-vessel.dto';

@Injectable()
export class ZoneService {
  constructor(private _db: DatabaseService) { }

  async createNewZone(newData: any) {
    try {
      const newlyAddedData = await this._db.zoneMaster.create({
        data: {
          ...newData,
        },
      });
      return newlyAddedData;
    } catch (error) {
      throw error;
    }
  }

  async getAllZones() {
    try {
      const allZones = await this._db.zoneMaster.findMany({
        where: {
          deletedAt: {
            equals: null,
          },
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
        },
      });
      if (!ourZone)
        throw new BadRequestException(`Zone with id : ${id} not exist`);
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
        },
      });
      if (!existing) {
        throw new BadRequestException(`Zone with Id : ${id} not exist`);
      }
      const updatedData = await this._db.zoneMaster.update({
        where: {
          ZoneMasterSid: id,
        },
        data: newData,
      });
      return updatedData;
    } catch (error) {
      throw error;
    }
  }

  // Delete Zone By Id
  async softDeleteZone(id: number) {
    try {
      const existing = await this._db.zoneMaster.findUnique({
        where: {
          ZoneMasterSid: id,
        },
      });
      if (!existing) {
        throw new BadRequestException(`Zone Master with id : ${id} not found`);
      }
      if (existing.deletedAt) {
        throw new BadRequestException(
          `Zone Master with id:${id} is already deleted`,
        );
      }
      const deletedZone = await this._db.zoneMaster.update({
        where: {
          ZoneMasterSid: id,
        },
        data: {
          deletedAt: new Date(),
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
          deletedAt: null
        }
      })
      return searchResults;
    } catch (error) {
      throw error;
    }
  }

  async searchZoneNew(params: SearchVesselDto) {
    const { search = '', page = 1, pageSize = 10 } = params;
    const skip = (page - 1) * pageSize;

    const where: Prisma.ZoneMasterWhereInput = {
      deletedAt: null,
      status: 'A',
      ...(search
        ? {
          OR: [
            { ZoneName: { contains: search, mode: 'insensitive'} },
            { ZoneCode: { contains: search, mode: 'insensitive'} },
            { status: { contains: search, mode: 'insensitive'} },
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
}
