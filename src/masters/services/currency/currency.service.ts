import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { DatabaseService } from 'src/database/database.service';
import { SearchListDto } from 'src/masters/DTO/search-list.dto';

@Injectable()
export class CurrencyService {
  constructor(
    private _db: DatabaseService,
    private logger: Logger,
  ) {}

  async createCurrency(payload:any, user) {
    this.logger.warn(`createCurrency: ${payload}`);

    const existing = await this._db.currencyMaster.findFirst({
      where: {
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
          createdBy: 'admin@crm.com',
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
      });
    } catch (error) {
      throw error;
    }
  }

  async updateCurrency(
    CurrencyMasterSid: number,
    payload: any,
    user,
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

    if (existingCurrency.deletedAt) {
      throw new Error(`Currency with ID ${id} is already deleted`);
    }

    // Perform soft delete by updating deletedAt field
    return this._db.currencyMaster.update({
      where: { CurrencyMasterSid: id },
      data: { deletedAt: new Date() },
    });
  }

  async searchCurrency(data: SearchListDto) {
    const { searchType, filterValue } = data;
    const acceptedType = [
      'currencyCode',
      'currencyName',
      'currencyID',
      'CurrencyUnit',
      'CurrencySubUnit',
      'ShortCode',
      'Symbol',
      'currencyFirstName',
      'currencyLastName',
      'currencyRatio',
      'amountDecimal',
      'exchangeDecimal',
      'status',
    ];
    if (!acceptedType.includes(searchType)) {
      throw new BadRequestException('Invalid Search Type');
    }
    const searchResult = await this._db.currencyMaster
      .findMany({
        where: {
          [searchType]: {
            contains: filterValue,
            mode: 'insensitive',
          },
        },
      })
      .catch((err) => {
        throw new Error(`Currency Search Error : ${err}`);
      });
    return searchResult;
  }
}
