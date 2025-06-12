import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { DatabaseService } from 'src/database/database.service';
import { SearchListDto } from 'src/masters/DTO/search-list.dto';

@Injectable()
export class SectorService {
  constructor(
    private _db: DatabaseService,
    private logger: Logger,
  ) {}

  async createSector(payload: any, user) {
    this.logger.warn(`createSector: ${payload}`);

    const existing = await this._db.sectorMaster.findFirst({
      where: {
        OR: [
          {
            sectorName: {
              equals: payload.sectorName.trim(),
              mode: 'insensitive',
            },
          },
        ],
      },
    });

    if (existing) {
      if (existing.sectorName === payload.sectorName) {
        throw new BadRequestException('Sector name already exists');
      }
    }

    try {
      const Sector = await this._db.sectorMaster.create({
        data: {
          ...payload,
        },
      });

      return Sector;
    } catch (error) {
      throw new Error(`Error creating Sector: ${error.message}`);
    }
  }

  async getAllSector() {
    try {
      const sectorList = await this._db.sectorMaster.findMany({
        where: {
          status: 'A',
        },
      });
      return sectorList;
    } catch (error) {
      throw error;
    }
  }

  async findOne(SectorMasterSid: any) {
    try {
      return await this._db.sectorMaster.findUnique({
        where: {
          SectorMasterSid: SectorMasterSid,
        },
      });
    } catch (error) {
      throw error;
    }
  }

  async updateSector(
    SectorMasterSid: number,
    payload: any,
    user,
  ) {
    const existing = await this._db.sectorMaster.findUnique({
      where: {
        SectorMasterSid: SectorMasterSid,
      },
    });

    if (!existing) {
      throw new Error('Sector is not exists');
    }

    try {
      const Sector = await this._db.sectorMaster.update({
        where: {
          SectorMasterSid: SectorMasterSid,
        },
        data: payload,
      });
      return Sector;
    } catch (error) {
      throw new Error(`Error updating Sector: ${error.message}`);
    }
  }

  async softDelete(id: number) {
    const existingSector = await this._db.sectorMaster.findUnique({
      where: { SectorMasterSid: id },
    });

    if (!existingSector) {
      throw new NotFoundException(`Sector with ID ${id} not found`);
    }

    if (existingSector.deletedAt) {
      throw new Error(`Sector with ID ${id} is already deleted`);
    }

    // Perform soft delete by updating deletedAt field
    return this._db.sectorMaster.update({
      where: { SectorMasterSid: id },
      data: { deletedAt: new Date() },
    });
  }

  async searchSector(data: SearchListDto) {
    const { searchType, filterValue } = data;
    const acceptedType = ['sectorName', 'status'];
    if (!acceptedType.includes(searchType)) {
      throw new BadRequestException('Invalid Search Type');
    }
    const searchResult = await this._db.sectorMaster
      .findMany({
        where: {
          [searchType]: {
            contains: filterValue,
            mode: 'insensitive',
          },
          deletedAt:null,
        },
      })
      .catch((err) => {
        throw new Error(`Error Occured: ${err}`);
      });
    return searchResult;
  }
}
