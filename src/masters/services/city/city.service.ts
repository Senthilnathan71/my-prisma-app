import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { DatabaseService } from 'src/database/database.service';
import { SearchListDto } from 'src/masters/DTO/search-list.dto';

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
          createdBy: 'admin@crm.com',
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

  async searchList(data: SearchListDto) {
    const { searchType, filterValue } = data;
    const allowedFields = ['cityCode', 'cityName', 'status'];
    if (!allowedFields.includes(searchType)) {
      throw new BadRequestException('Invalid Search Types');
    }

    const cities = await this._db.cityMaster
      .findMany({
        where: {
          [searchType]: {
            contains: filterValue,
            mode: 'insensitive',
          },
          deletedAt:null
        },
      })
      .catch((error) => {
        throw new Error(`Error on Searching City : ${error}`);
      });
    return cities;
  }
}
