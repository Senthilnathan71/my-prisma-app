import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { DatabaseService } from 'src/database/database.service';

@Injectable()
export class CityService {
  constructor(private _db: DatabaseService) {}

  async getAllCity() {
    try {
      const cityList = await this._db.cityMaster.findMany({
        where: {
          status: 'A',
        },
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

  async findCityByStateId(id: any) {
    try {
      const ourCity = await this._db.cityMaster.findMany({
        where: {
          StateMasterSid: id,
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
        data: { ...cityData },
      });
      return addedData;
    } catch (error) {
      throw error;
    }
  }

  async updateCityById(
    CityMasterSid: number,
    newData: Prisma.CityMasterUpdateInput,
  ) {
    try {
      const existCity = await this._db.cityMaster.findUnique({
        where: {
          CityMasterSid,
        },
      });
      if (!existCity) throw new Error('Problem with Finding City with ID');
      const updatedData = await this._db.cityMaster.update({
        where: {
          CityMasterSid,
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
          CityMasterSid,
        },
      });
      if (!existCity) throw new Error('Problem with Finding City with ID');
      const deletedCity = await this._db.cityMaster.delete({
        where: {
          CityMasterSid,
        },
      });
      return deletedCity;
    } catch (error) {
      throw error;
    }
  }
}
