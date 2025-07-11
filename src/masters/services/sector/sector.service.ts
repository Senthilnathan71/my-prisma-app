import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { DatabaseService } from 'src/database/database.service';
import { SearchListDto } from 'src/masters/DTO/search-list.dto';
import { SearchVesselDto } from 'src/masters/DTO/search-vessel.dto';

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
          {
       sectorCode: {
      equals: payload.sectorCode.trim(),
      mode: 'insensitive',
    },
  }
        ],
      },
    });

    if (existing) {
      if (existing.sectorName === payload.sectorName) {
        throw new BadRequestException('Sector name already exists');
      }
      if (existing.sectorCode === payload.sectorCode) {
        throw new BadRequestException('Sector code already exists');
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
    const duplicate = await this._db.sectorMaster.findFirst({
  where: {
    AND: [
      {
        SectorMasterSid: {
          not: SectorMasterSid,
        },
      },
      {
        OR: [
          {
            sectorName: {
              equals: payload.sectorName.trim(),
              mode: 'insensitive',
            },
          },
          {
            sectorCode: {
              equals: payload.sectorCode.trim(),
              mode: 'insensitive',
            },
          },
        ],
      },
    ],
  },
});


      if (duplicate) {
  if (duplicate.sectorName === payload.sectorName) {
    throw new BadRequestException('Sector name already exists');
  }
  if (duplicate.sectorCode === payload.sectorCode) {
    throw new BadRequestException('Sector code already exists');
  }
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

  async searchSectorNew(params: SearchVesselDto) {
    const { search = '', page = 1, pageSize = 10 } = params;
    const skip = (page - 1) * pageSize;

    const where: Prisma.SectorMasterWhereInput = {
      deletedAt: null,
      status: 'A',
      ...(search
        ? {
          OR: [
            { sectorName: { contains: search, mode: 'insensitive'} },
            { sectorCode: { contains: search, mode: 'insensitive'} },
            { RegionName: { contains: search, mode: 'insensitive'} },
            { RegionCode: { contains: search, mode: 'insensitive'} },
          ],
        }
        : {}
      ),
    };

    const [ items, totalCount] = await this._db.$transaction([
      this._db.sectorMaster.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { SectorMasterSid: 'desc'},
      }),
      this._db.sectorMaster.count({ where }),
    ]);

    return {
      items,
      totalCount
    };
  }
}
