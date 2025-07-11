import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { DatabaseService } from 'src/database/database.service';
import { SearchListDto } from 'src/masters/DTO/search-list.dto';
import { SearchVesselDto } from 'src/masters/DTO/search-vessel.dto';

@Injectable()
export class CityService {
  constructor(private _db: DatabaseService) {}

  async getAllCity() {
    try {
      const cityList = await this._db.cityMaster.findMany({
        where: {
          deletedAt:null,
        },
        orderBy :{
          cityName:'asc'
        }
      });
      return cityList;
    } catch (error) {
      throw error;
    }
  }

  async findCityByCityId(id: any) {
    try {
      const ourCity = await this._db.cityMaster.findUnique({
        where: {
          CityMasterSid: id,
        },
      });
      return ourCity;
    } catch (error) {
      throw error;
    }
  }

  async findCityByStateId(StateMasterSid: any) {
    try {
      const ourCity = await this._db.cityMaster.findMany({
        where: {
          StateMasterSid: StateMasterSid,
        },
      });
      return ourCity;
    } catch (error) {
      throw error;
    }
  }

  async addCity(cityData: any) {
    try {
      const addedData = await this._db.cityMaster.create({
        data: {
          ...cityData,
        },
      });
      return addedData;
    } catch (error) {
      throw error;
    }
  }

  async updateCityById(
    CityMasterSid: number,
    newData: any,
  ) {
    try {
      const existCity = await this._db.cityMaster.findUnique({
        where: {
          CityMasterSid: CityMasterSid,
        },
      });
      if (!existCity) throw new Error('Problem with Finding City with ID');
      const updatedData = await this._db.cityMaster.update({
        where: {
          CityMasterSid: CityMasterSid,
        },
        data: newData,
      });
      return updatedData;
    } catch (error) {
      throw error;
    }
  }

  async deleteCityById(CityMasterSid: number) {
    try {
      const existCity = await this._db.cityMaster.findUnique({
        where: {
          CityMasterSid: CityMasterSid,
        },
      });
      if (!existCity) throw new Error('Problem with Finding City with ID');

      // Perform soft delete by updating deletedAt field
      return this._db.cityMaster.update({
        where: { CityMasterSid: CityMasterSid },
        data: { deletedAt: new Date() },
      });
    } catch (error) {
      throw error;
    }
  }

  async searchCityList(params: SearchVesselDto) {
    const { search = '', page = 1, pageSize = 10 } = params;
    const skip = (page - 1) * pageSize;

    const where: Prisma.CityMasterWhereInput = {
        deletedAt: null,
        OR: search ? [
            { cityCode: { contains: search, mode: 'insensitive' } },
            { cityName: { contains: search, mode: 'insensitive' } },
            { status: { contains: search, mode: 'insensitive' } },
             {
            stateMaster: {
              stateName: { contains: search, mode: 'insensitive' },
            },
          },
          {
            countryMaster: {
              countryName: { contains: search, mode: 'insensitive' },
            },
          },
            ...(!isNaN(Number(search)) ? [
                { CityMasterSid: Number(search) },
                { StateMasterSid: Number(search) }
            ] : [])
        ] : undefined
    };

    const [items, totalCount] = await this._db.$transaction([
        this._db.cityMaster.findMany({
            where,
            skip,
            take: pageSize,
            orderBy: { cityName: 'asc' },
            include: {
                stateMaster: true,
                countryMaster: true,
            }
        }),
        this._db.cityMaster.count({ where }),
    ]);

    return {
        items,
        totalCount,
    };  
}
}
