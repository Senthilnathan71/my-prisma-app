import { BadRequestException, Injectable } from '@nestjs/common';
import { DatabaseService } from 'src/database/database.service';
import { SearchListDto } from 'src/masters/DTO/search-list.dto';

@Injectable()
export class YearService {
    constructor(private _db: DatabaseService) { }

    async getAllYears() {
        try {
            const allYears = await this._db.yearMaster.findMany({
                where: {
                    deletedAt: null
                },
                include: {
                    companyMaster: true
                }
            });
            return allYears;
        } catch (error) {
            throw error;
        }
    }

    async createNewYear(payload: any) {
        try {
            const createdYear = await this._db.yearMaster.create({
                data: {
                    ...payload,
                },
                include: {
                    companyMaster: true
                }
            });
            return createdYear;
        } catch (error) {
            throw error;
        }
    }

    async fetchYearById(YearMasterSid: number) {
        try {
            const year = await this._db.yearMaster.findUnique({
                where: {
                    YearMasterSid: YearMasterSid
                },
                include: {
                    companyMaster: true
                }
            });
            if (!year) {
                throw new BadRequestException(`Year with Id : ${YearMasterSid} not exists`);
            }
            return year;
        } catch (error) {
            throw error;
        }
    }

    async updateYearById(YearMasterSid: number, payload: any) {
        try {
            const exist = await this._db.yearMaster.findUnique({
                where: {
                    YearMasterSid: YearMasterSid
                }
            });
            if (!exist) {
                throw new BadRequestException(`Year with Id : ${YearMasterSid} not exists`);
            }
            const updatedYear = await this._db.yearMaster.update({
                where: {
                    YearMasterSid: YearMasterSid
                },
                data: payload,
                include: {
                    companyMaster: true
                }
            });
            return updatedYear;
        } catch (error) {
            throw error;
        }
    }

    async deleteYear(YearMasterSid: number) {
        try {
            const exist = await this._db.yearMaster.findUnique({
                where: {
                    YearMasterSid: YearMasterSid
                }
            });
            if (!exist) {
                throw new BadRequestException(`Year with Id : ${YearMasterSid} not exists`);
            }
            if (exist.deletedAt) {
                throw new BadRequestException(`Year with Id :${YearMasterSid} is already deleted`);
            }
            const deletedYear = await this._db.yearMaster.update({
                where: {
                    YearMasterSid: YearMasterSid
                },
                data: {
                    deletedAt: new Date()
                },
                include: {
                    companyMaster: true
                }
            });
            return deletedYear;
        } catch (error) {
            throw error;
        }
    }

    async searchYear() {
    try {
      const searchResults = await this._db.yearMaster.findMany({
        where: {
          deletedAt: null
        },
        include: {
                companyMaster: true
            }
      })
      return searchResults;
    } catch (error) {
      throw error;
    }
  }
}