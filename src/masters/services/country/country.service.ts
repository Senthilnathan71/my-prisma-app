import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { GlobalConfigService } from 'src/common/config/master-config.service';
import { DatabaseService } from 'src/database/database.service';
import { SearchListDto } from 'src/masters/DTO/search-list.dto';
import { filterDto } from 'src/masters/DTO/search-vessel.dto';

@Injectable()
export class CountryService {
  constructor(private _db: DatabaseService, private globalConfigService: GlobalConfigService, private logger: Logger) { }

  async getAllCountry() {
    try {
      const countryList = await this._db.countryMaster.findMany({
        where: {
          status: 'A'
        },
        orderBy: {
          countryName: 'asc'
        }
      });
      return countryList;
    } catch (error) {
      throw error;
    }
  }

  async createCountry(payload) {
    const existing = await this._db.countryMaster.findFirst({
      where: {
        OR: [
          {
            countryName: {
              equals: payload.countryName.trim(),
              mode: 'insensitive',
            },
          },
          {
            countryCode: {
              equals: payload.countryCode.trim(),
              mode: 'insensitive',
            },
          },
        ],
      },
    });

    if (existing) {
      if (existing.countryName === payload.countryName) {
        throw new BadRequestException('Country name already exists');
      }
      if (existing.countryCode === payload.countryCode) {
        throw new BadRequestException('Country code already exists');
      }
    }

    try {

      const unit = await this._db.countryMaster.create({
        data: payload,
      });
      return unit;
    } catch (error) {
      throw new Error(`creation failed: ${error.message}`);
    }
  }

  async findOne(CountryMasterSid: any) {
    try {
      return await this._db.countryMaster.findUnique({
        where: {
          CountryMasterSid: CountryMasterSid,
        },
      });
    } catch (error) {
      throw error;
    }
  }

  async updateCountry(CountryMasterSid: number, payload) {
    const existing = await this._db.countryMaster.findFirst({
      where: {
        AND: [
          {
            OR: [
              {
                countryName: {
                  equals: payload.countryName.trim(),
                  mode: 'insensitive',
                },
              },
              {
                countryCode: {
                  equals: payload.countryCode.trim(),
                  mode: 'insensitive',
                },
              },
            ],
          },
          {
            NOT: {
              CountryMasterSid: CountryMasterSid,
            },
          },
        ],
      },
    });

    if (existing) {
      if (existing.countryName === payload.countryName) {
        //throw new Error('Port name already exists');
        throw new BadRequestException('Country name already exists');
      }
      if (existing.countryCode === payload.countryCode) {
        throw new BadRequestException('Country code already exists');
      }
    }

    try {
      throw Error;
      const country = await this._db.countryMaster.update({
        where: {
          CountryMasterSid: CountryMasterSid,
        },
        data: payload,
      });
      return country;
    } catch (error) {
      throw new Error(`Error updating country: ${error.message}`);
    }
  }

  async softDelete(id: number) {
    const existingCountry = await this._db.countryMaster.findUnique({
      where: { CountryMasterSid: id },
    });

    if (!existingCountry) {
      throw new NotFoundException(`UCountry with ID ${id} not found`);
    }

    if (existingCountry.status === 'D') {
      throw new Error(`Country with ID ${id} is already deleted`);
    }

    // Perform soft delete by updating deletedAt field
    return this._db.countryMaster.update({
      where: { CountryMasterSid: id },
      data: { status: 'D' },
    });
  }

  async searchCountry(params: filterDto) {
    const { search = '', page = 1, pageSize = 15

    } = params;
    const skip = (page - 1) * pageSize;

    const where: Prisma.CountryMasterWhereInput = {
      status: 'A',
      ...(search
        ? {
          OR: [
            { countryName: { contains: search, mode: 'insensitive' } },
            { countryCode: { contains: search, mode: 'insensitive' } },
            {
              zoneMaster: {
                ZoneName: { contains: search, mode: 'insensitive' },
              },
            },
            {
              currencyMaster: {
                currencyName: { contains: search, mode: 'insensitive' },
              },
            },

            { status: { contains: search, mode: 'insensitive' } },
          ],
        }
        : {}),
    };

    let items;
    let totalCount;
    [items, totalCount] = await this._db.$transaction([
      this._db.countryMaster.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { countryName: 'asc' },
      }),
      this._db.countryMaster.count({ where }),
    ]);

    items = await Promise.all(
      items.map(async (item) => {
        const [zoneMaster, currencyMaster] = await Promise.all([
          item.ZoneMasterSid !== null ?
            this.globalConfigService.getMasterData('zone_master', item.ZoneMasterSid, item.CompanyMasterSid) :
            { ZoneMasterSid: null, ZoneName: '' },

          item.CurrencyMasterSid !== null ?
            this.globalConfigService.getMasterData('currency_master', item.CurrencyMasterSid, item.CompanyMasterSid) :
            { CurrencyMasterSid: null, currencyName: '' }
        ])

        return {
          ...item,
          zoneMaster,
          currencyMaster
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
