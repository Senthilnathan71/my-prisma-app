import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { DatabaseService } from 'src/database/database.service';
import { SearchListDto } from 'src/masters/DTO/search-list.dto';

@Injectable()
export class ZoneService {
  constructor(private _db: DatabaseService) { }

  async createNewZone(newData: Prisma.ZoneMasterCreateInput) {
    try {
      const newlyAddedData = await this._db.zoneMaster.create({
        data: {
          ...newData,
          createdBy: 'admin@crm.com',
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

  async editZoneById(id: number, newData: Prisma.ZoneMasterUpdateInput) {
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

  async searchZone(data: SearchListDto) {
    const { searchType, filterValue } = data;
    const acceptedType = [
      "ZoneCode",
      "ZoneName",
      "status"
    ];
    if (!acceptedType.includes(searchType)) {
      throw new BadRequestException('Invalid Search Type');
    }
    const searchResults = await this._db.zoneMaster.findMany({
      where: {
        [searchType]: {
          contains: filterValue,
          mode: 'insensitive'
        }
      }
    }).catch((err) => {
      throw new Error(`Error Occurred : ${err}`);
    })
    return searchResults
  }
}
