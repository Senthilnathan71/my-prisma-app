import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { DatabaseService } from 'src/database/database.service';
import { SearchListDto } from 'src/masters/DTO/search-list.dto';
import { SearchVesselDto } from 'src/masters/DTO/search-vessel.dto';

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


  async searchYearNew(params: SearchVesselDto) {
    const { search = '', page = 1, pageSize = 15 } = params;
    const skip = (page - 1) * pageSize;

    const where: Prisma.YearMasterWhereInput = {
        deletedAt: null,
        status: 'A',
        ...(search
            ? {
                OR: [
                    { YearName: { contains: search, mode: 'insensitive'} },
                    { CurrentYear: { contains: search,mode: 'insensitive'} },
                    { YearEndCompleted: { contains: search,mode: 'insensitive'} },
                    { status: { contains: search,mode: 'insensitive'} },
                ],
            }
            : {}
        ),
    };

    const [items, totalCount] = await this._db.$transaction([
        this._db.yearMaster.findMany({
            where,
            skip,
            take: pageSize,
            include: {
                companyMaster: true,
            },
            orderBy: { YearMasterSid: 'desc'},
        }),
        this._db.yearMaster.count({ where }),
    ]);

    return {
        items,
        totalCount,
    };
  }
}