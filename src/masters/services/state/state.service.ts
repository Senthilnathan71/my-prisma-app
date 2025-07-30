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
import { SearchVesselDto } from 'src/masters/DTO/search-vessel.dto';

@Injectable()
export class StateService {
  constructor(
    private _db: DatabaseService,
    private logger: Logger,
    private globalConfigService : GlobalConfigService
  ) {}

  async createState(payload: any, user) {
    this.logger.warn(`createStateUser: ${payload}`);

    const existing = await this._db.stateMaster.findFirst({
      where: {
        OR: [
          {
            stateName: {
              equals: payload.stateName.trim(),
              mode: 'insensitive',
            },
          },
          {
            stateCode: {
              equals: payload.stateCode.trim(),
              mode: 'insensitive',
            },
          },
        ],
      },
    });

    if (existing) {
      if (existing.stateName === payload.stateName) {
        throw new BadRequestException('State name already exists');
      }
      if (existing.stateCode === payload.stateCode) {
        throw new BadRequestException('State code already exists');
      }
    }

    try {
      const state = await this._db.stateMaster.create({
        data: {
          ...payload,
        },
      });

      return state;
    } catch (error) {
      throw new Error(`Error creating state: ${error.message}`);
    }
  }

  async getAllStateByCountry(CountryMasterSid: any) {
    try {
      const stateList = await this._db.stateMaster.findMany({
        where: {
          CountryMasterSid: CountryMasterSid,
          deletedAt:null
        },
      });
      return stateList;
    } catch (error) {
      throw error;
    }
  }

  async getAllStates() {
    try {
      const stateList = await this._db.stateMaster.findMany({
        include: {
          countryMaster: {
            select: {
              countryName: true,
            },
          },
          zoneMaster: {
            select: {
              ZoneName: true,
            }
          }
        },
        where: {
          status: 'A',
        },
        orderBy:{
          stateName:'asc'
        }
      });
      return stateList;
    } catch (error) {
      throw error;
    }
  }

  async findOne(StateMasterSid: any) {
    try {
      return await this._db.stateMaster.findUnique({
        where: {
          StateMasterSid: StateMasterSid,
        },
        include: {
          countryMaster: true,
        },
      });
    } catch (error) {
      throw error;
    }
  }

  async updateState(StateMasterSid: number, payload: any, user) {
    const existing = await this._db.stateMaster.findUnique({
      where: {
        StateMasterSid: StateMasterSid,
      },
    });

    if (!existing) {
      throw new Error('State is not exists');
    }

    try {
      const state = await this._db.stateMaster.update({
        where: {
          StateMasterSid: StateMasterSid,
        },
        data: payload,
      });
      return state;
    } catch (error) {
      throw new Error(`Error updating state: ${error.message}`);
    }
  }

  async softDelete(id: number) {
    const existingState = await this._db.stateMaster.findUnique({
      where: { StateMasterSid: id },
    });

    if (!existingState) {
      throw new NotFoundException(`State with ID ${id} not found`);
    }

    if (existingState.deletedAt) {
      throw new Error(`State with ID ${id} is already deleted`);
    }

    // Perform soft delete by updating deletedAt field
    return this._db.stateMaster.update({
      where: { StateMasterSid: id },
      data: { deletedAt: new Date() },
    });
  }

   async searchStateNew(params: SearchVesselDto) {
  const { search = '', page = 1, pageSize = 10 } = params;
  const skip = (page - 1) * pageSize;

  const where: Prisma.StateMasterWhereInput = {
    deletedAt: null,
    status: 'A',
    ...(search
      ? {
        OR: [
          { stateName: { contains: search, mode: 'insensitive'} },
          { stateCode: { contains: search, mode: 'insensitive'} },
          { countryMaster: { countryName: { contains: search, mode: 'insensitive' } } },
          { zoneMaster: { ZoneName: { contains: search, mode: 'insensitive' } } },
        ],
      }
      : {}
    ),
  };

  let items;
  let totalCount;
  [ items, totalCount] = await this._db.$transaction([
    this._db.stateMaster.findMany({
      where,
      skip,
      take: pageSize,
      orderBy: { StateMasterSid: 'desc'},
    }),
    this._db.stateMaster.count({ where }),
  ]);

  items = await Promise.all(
    items.map(async (item) => {
      const [countryMaster,zoneMaster] = await Promise.all([
        item.CountryMasterSid !== null ?
        this.globalConfigService.getMasterData('country_master',item.CountryMasterSid) :
        {CountryMasterSid : null , countryName : ''} ,

        item.ZoneMasterSid !== null ? 
        this.globalConfigService.getMasterData('zone_master',item.ZoneMasterSid) :
        {ZoneMasterSid : null , ZoneName : ''}
      ])

      return {
        ...item,
        countryMaster,
        zoneMaster
      }
    })
  )

  const flattenedItems = items.map((state) => ({
    ...state,
    countryName: state.countryMaster?.countryName ?? 'N/A',
    zoneName: state.zoneMaster?.ZoneName ?? 'N/A',
  }));

  return {
    items: flattenedItems,
    totalCount,
  };
 }
}
