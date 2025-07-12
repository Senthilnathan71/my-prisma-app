import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { DatabaseService } from 'src/database/database.service';
import { SearchListDto } from 'src/masters/DTO/search-list.dto';
import { SearchVesselDto } from 'src/masters/DTO/search-vessel.dto';

@Injectable()
export class CountryService {
  constructor(private _db: DatabaseService) {}

  async getAllCountry() {
    try {
      const countryList = await this._db.countryMaster.findMany({
        where: {
          deletedAt: {
            equals: null,
          },
        },
        orderBy :{
          countryName:'asc'
        }
      });
      return countryList;
    } catch (error) {
      throw error;
    }
  }

  async createCountry(payload, user) {
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

  async updateCountry(CountryMasterSid: number, payload, user) {
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

    if (existingCountry.deletedAt) {
      throw new Error(`Country with ID ${id} is already deleted`);
    }

    // Perform soft delete by updating deletedAt field
    return this._db.countryMaster.update({
      where: { CountryMasterSid: id },
      data: { deletedAt: new Date() },
    });
  }

  async searchCountry(params: SearchVesselDto) {
  const { search = '', page = 1, pageSize = 10
    
   } = params;
  const skip = (page - 1) * pageSize;

  const where: Prisma.CountryMasterWhereInput = {
    deletedAt: null, 
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

  const [items, totalCount] = await this._db.$transaction([
    this._db.countryMaster.findMany({
      where,
      skip,
      take: pageSize,
      orderBy: { countryName: 'asc' },
      include: {
        zoneMaster: true,
        currencyMaster: true,
      },
    }),
    this._db.countryMaster.count({ where }),
  ]);

  return {
    items,
    totalCount,
  };
}

}
