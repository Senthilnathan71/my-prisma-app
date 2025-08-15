import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { GlobalConfigService } from 'src/common/config/master-config.service';
import { DatabaseService } from 'src/database/database.service';
import { SearchListDto } from 'src/masters/DTO/search-list.dto';
import { SearchVesselDto } from 'src/masters/DTO/search-vessel.dto';

@Injectable()
export class CityService {
  constructor(private _db: DatabaseService, private logger: Logger,private globalConfigService : GlobalConfigService) {}

  async getAllCity() {
    try {
      const cityList = await this._db.cityMaster.findMany({
        where: {
          status : 'A',
          deletedAt: null,
        },
      })
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
        }
      })
      if (!ourCity) {
        throw new BadRequestException(`City with id: ${id} not exist`);
      }
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

  async addCity(payload: any, user) {
    this.logger.warn(`addCity: ${payload}`);

    const existing = await this._db.cityMaster.findFirst({
      where: {
        deletedAt: null,
        OR: [
          {
            cityName: {
              equals: payload.cityName.trim(),
              mode: 'insensitive',
            }
          },
          {
            cityCode: {
              equals: payload.cityCode.trim(),
              mode: 'insensitive',
            }
          }
        ]
      },
    });
    if (existing) {
      if (existing.cityName === payload.cityName) {
        throw new BadRequestException('City name already exists');
      }
      if (existing.cityCode === payload.cityCode) {
        throw new BadRequestException('City code already exists');
      }
    }
    try {
      const City = await this._db.cityMaster.create({
        data: {
          ...payload,
        }
      });
      return City;
    } catch (error) {
      console.log(error.stack)
      throw new Error(`Error creating City: ${error.message}`);
    }
    }

  async updateCityById(
    CityMasterSid: number,
    newData: any,
  ) {
    try {
      const existing = await this._db.cityMaster.findUnique({
        where: {
          CityMasterSid: CityMasterSid,
        }
      })
      if (!existing) {
        throw new BadRequestException(`City with id: ${CityMasterSid} not exist`);
      }
      const updatedData = await this._db.cityMaster.update({
        where: {
          CityMasterSid: CityMasterSid,
        },
        data: newData,
      })
      return updatedData;
    } catch (error) {
      throw error;
    }
  }

  async softDeleteCity(CityMasterSid: number) {
    try {
      const existing = await this._db.cityMaster.findUnique({
        where: {
          CityMasterSid: CityMasterSid
        }
      })
      if (!existing) {
        throw new BadRequestException(`City with id: ${CityMasterSid} not exist`);
      }
      if (existing.deletedAt) {
        throw new BadRequestException(`City with id: ${CityMasterSid} is already deleted`);
      }
      // Perform soft delete by updating deletedAt field
      const deletedCity = await this._db.cityMaster.update({
        where: { CityMasterSid: CityMasterSid },
        data: { deletedAt: new Date() },
      })
      return deletedCity;
    } catch (error) {
      throw error;
    }
  }

  async searchCityList(params: SearchVesselDto) {
    const { search = '', page = 1, pageSize = 15 } = params;
    const skip = (page - 1) * pageSize;

    const where: Prisma.CityMasterWhereInput = {
        deletedAt: null,
        status: 'A',
        OR: search ? [
            { cityCode: { contains: search, mode: 'insensitive' } },
            { cityName: { contains: search, mode: 'insensitive' } },
            { status: { contains: search, mode: 'insensitive' } },
            ...(!isNaN(Number(search)) ? [
                { CityMasterSid: Number(search) },
                { StateMasterSid: Number(search) }
            ] : [])
        ] : undefined
    };

    let items;
    let totalCount;
    [items, totalCount] = await this._db.$transaction([
        this._db.cityMaster.findMany({
            where,
            skip,
            take: pageSize,
            orderBy: { cityName: 'asc' }
        }),
        this._db.cityMaster.count({ where }),
    ]);

    items = await Promise.all(
      items.map(async (item)=>{
        const [countryMaster,stateMaster] = await Promise.all([
          item.CountryMasterSid !== null ?
          this.globalConfigService.getMasterData('country_master',item.CountryMasterSid, item.CompanyMasterSid) : 
          { CountryMasterSid: null, countryName: '' },

          item.StateMasterSid !== null ?
          this.globalConfigService.getMasterData('state_master',item.StateMasterSid, item.CompanyMasterSid) :
          {StateMasterSid : null , stateName : ''}
        ])

        return {
          ...item,
          stateMaster,
          countryMaster
        }
      })
    )

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
