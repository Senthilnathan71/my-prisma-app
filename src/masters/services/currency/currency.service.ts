import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { statusWhereClause } from 'src/common/helper';
import { DatabaseService } from 'src/database/database.service';
import { SearchListDto } from 'src/masters/DTO/search-list.dto';
import { filterDto } from 'src/masters/DTO/search-vessel.dto';

@Injectable()
export class CurrencyService {
  constructor(
    private _db: DatabaseService,
    private logger: Logger,
  ) { }

  async createCurrency(payload: any) {
    this.logger.warn(`createCurrency: ${payload}`);

    const existing = await this._db.currencyMaster.findFirst({
      where: {
        status: 'A',
        OR: [
          {
            currencyName: {
              equals: payload.currencyName.trim(),
              mode: 'insensitive',
            },
          },
          {
            currencyCode: {
              equals: payload.currencyCode.trim(),
              mode: 'insensitive',
            },
          },
        ],
      },
    });

    if (existing) {
      if (existing.currencyName === payload.currencyName) {
        throw new BadRequestException('Currency name already exists');
      }
      if (existing.currencyCode === payload.currencyCode) {
        throw new BadRequestException('Currency code already exists');
      }
    }

    try {
      const currency = await this._db.currencyMaster.create({
        data: {
          ...payload,
        },
      });

      return currency;
    } catch (error) {
      throw new Error(`Error creating Currency: ${error.message}`);
    }
  }

  async getAllCurrencys() {
    try {
      const currencyList = await this._db.currencyMaster.findMany({
        where: {
          status: 'A',
        },
        select:{
          CurrencyMasterSid:true,
          CountryMasterSid:true,
          countryMaster:{
            select:{
              CountryMasterSid:true,
              countryName: true,
              countryCode: true
            }
          },
         currencyName: true,
          currencyCode: true,
          amountDecimal:true,
          exchangeDecimal:true,
          CurrencySubUnit:true,
          CurrencyUnit: true,
          Symbol:true,
          ShortCode: true,
          RoundOf:true,
          SubUnitIn: true,
          status:true
        }
      });
      return currencyList;
    } catch (error) {
      throw error;
    }
  }

  async findOne(CurrencyMasterSid: any) {
    try {
      return await this._db.currencyMaster.findUnique({
        where: {
          CurrencyMasterSid: CurrencyMasterSid,
        },
        select:{
          CurrencyMasterSid:true,
          CountryMasterSid:true,
          countryMaster:{
            select:{
              countryName: true,
              countryCode: true
            }
          },
          currencyName: true,
          currencyCode: true,
          amountDecimal:true,
          exchangeDecimal:true,
          CurrencySubUnit:true,
          CurrencyUnit: true,
          Symbol:true,
          ShortCode: true,
          RoundOf:true,
          SubUnitIn: true,
          status:true
        }
      });
    } catch (error) {
      throw error;
    }
  }

  async updateCurrency(
    CurrencyMasterSid: number,
    payload: any,


  ) {

    const existing = await this._db.currencyMaster.findUnique({
      where: {
        CurrencyMasterSid: CurrencyMasterSid,
      },
    });

    if (!existing) {
      throw new Error('Currency is not exists');
    }

    try {
      const currency = await this._db.currencyMaster.update({

        where: {
          CurrencyMasterSid: CurrencyMasterSid,
        },
        data: payload,
      });
      return currency;
    } catch (error) {
      throw new Error(`Error updating Currency: ${error.message}`);
    }
  }

  async softDelete(id: number) {
    const existingCurrency = await this._db.currencyMaster.findUnique({
      where: { CurrencyMasterSid: id },
    });

    if (!existingCurrency) {
      throw new NotFoundException(`Currency with ID ${id} not found`);
    }

    if (existingCurrency.status === 'D') {
      throw new Error(`Currency with ID ${id} is already deleted`);
    }

    // Perform soft delete by updating deletedAt field
    return this._db.currencyMaster.update({
      where: { CurrencyMasterSid: id },
      data: { status: 'D' },
    });
  }

  async searchCurrency(params: filterDto) {
    const { search = '', page = 1, pageSize = 15 } = params;
    const skip = (page - 1) * pageSize;

    const where: Prisma.CurrencyMasterWhereInput = {
      status: statusWhereClause,
      ...(search
        ? {
          OR: [
            { currencyName: { contains: search, mode: 'insensitive' } },
            { currencyCode: { contains: search, mode: 'insensitive' } },
            { CurrencyUnit: { contains: search, mode: 'insensitive' } },
            { CurrencySubUnit: { contains: search, mode: 'insensitive' } },
            { ShortCode: { contains: search, mode: 'insensitive' } },
            { status: { contains: search, mode: 'insensitive' } },
          ],
        }
        : {}
      ),
    };

    const [items, totalCount] = await this._db.$transaction([
      this._db.currencyMaster.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { CurrencyMasterSid: 'desc' },
      }),
      this._db.currencyMaster.count({ where }),
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
