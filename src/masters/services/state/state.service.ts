import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { DatabaseService } from 'src/database/database.service';
import { SearchListDto } from 'src/masters/DTO/search-list.dto';

@Injectable()
export class StateService {
  constructor(
    private _db: DatabaseService,
    private logger: Logger,
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

  async searchState(data: SearchListDto) {
    const { searchType, filterValue } = data;
    const acceptedType = [
      'stateCode',
      'stateName',
      'stateGSTCode',
      'region',
      'zone',
      'status',
    ];
    if (!acceptedType.includes(searchType)) {
      throw new BadRequestException('Invalid Search Type');
    }
    const searchResult = await this._db.stateMaster
      .findMany({
        where: {
          [searchType]: {
            contains: filterValue,
            mode: 'insensitive',
          },
          deletedAt:null
        },
      })
      .catch((err) => {
        throw new Error(`Error Occured : ${err}`);
      });
    return searchResult;
  }
}
