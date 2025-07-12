import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { DatabaseService } from 'src/database/database.service';
import { SearchListDto } from 'src/masters/DTO/search-list.dto';
import { SearchVesselDto } from 'src/masters/DTO/search-vessel.dto';

@Injectable()
export class ContainerTypeService {
  constructor(private _db: DatabaseService) { }

  // ContainerType master create

  async createNewContainerType(newData: any) {
    try {
      const newlyAddedData = await this._db.containerTypeMaster.create({
        data: {
          ...newData,
        },
      });
      return newlyAddedData;
    } catch (error) {
      throw error;
    }
  }

  async listAllContainerTypes() {
    try {
      const containerTypes = await this._db.containerTypeMaster.findMany({
        where: {
          deletedAt: {
            equals: null,
          },
        },
      });
      return containerTypes;
    } catch (error) {
      throw error;
    }
  }

  async findContainerTypeById(ContainerTypeMasterSid: number) {
    try {
      const ourContainerType = await this._db.containerTypeMaster.findUnique({
        where: {
          ContainerTypeMasterSid: ContainerTypeMasterSid,
        },
      });
      if (!ourContainerType)
        throw new BadRequestException(
          `Container Type with Id : ${ContainerTypeMasterSid} not found`,
        );
      return ourContainerType;
    } catch (error) {
      throw error;
    }
  }

  async updateContainerTypeById(
    ContainerTypeMasterSid: number,
    newData: any,
  ) {
    try {
      const ourContainerType = await this._db.containerTypeMaster.findUnique({
        where: {
          ContainerTypeMasterSid: ContainerTypeMasterSid,
        },
      });
      if (!ourContainerType)
        throw new BadRequestException(
          `Container Type with Id : ${ContainerTypeMasterSid} not found`,
        );
      const updatedContainerType = await this._db.containerTypeMaster.update({
        where: {
          ContainerTypeMasterSid: ContainerTypeMasterSid,
        },
        data: newData,
      });
      return updatedContainerType;
    } catch (error) {
      throw error;
    }
  }
  async softDeleteContainerType(ContainerTypeMasterSid: number) {
    try {
      const ourContainerType = await this._db.containerTypeMaster.findUnique({
        where: {
          ContainerTypeMasterSid: ContainerTypeMasterSid,
        },
      });
      if (!ourContainerType)
        throw new BadRequestException(
          `Container Type with Id : ${ContainerTypeMasterSid} not found`,
        );
      if (ourContainerType.deletedAt)
        throw new BadRequestException(
          `Container Type with Id : ${ContainerTypeMasterSid} is already deleted`,
        );

      const deletedContainerType = await this._db.containerTypeMaster.update({
        where: {
          ContainerTypeMasterSid: ContainerTypeMasterSid,
        },
        data: {
          deletedAt: new Date(),
        },
      });
      return deletedContainerType;
    } catch (error) {
      throw error;
    }
  }

  async searchContainerType(params: SearchVesselDto) {
    const { search = '', page = 1, pageSize = 10 } = params;
    const skip = (page - 1) * pageSize;

    const where: Prisma.ContainerTypeMasterWhereInput  = {
        deletedAt: null,
        status: 'A',
        ...(search
            ? {
                OR: [
                    { ContainerCode: { contains: search, mode: 'insensitive' } },
                    { ContainerSize: { contains: search, mode: 'insensitive' } },
                    { ContainerIsoCode: { contains: search, mode: 'insensitive' } },
                    { ContainerName: { contains: search, mode: 'insensitive' } },
                    { ContainerCategory: { contains: search, mode: 'insensitive' } },
                    // { MaxVolume: { contains: search, mode: 'insensitive' } },
                    // { TareWeight: { contains: search, mode: 'insensitive' } },
                    // { GrossWeight: { contains: search, mode: 'insensitive' } },
                    // { NoofTeu: { contains: search, mode: 'insensitive' } },
                    { status: { contains: search, mode: 'insensitive' } },
                ],
            }
            : {}
        ),
    };

    const [items, totalCount] = await this._db.$transaction([
        this._db.containerTypeMaster.findMany({
            where,
            skip,
            take: pageSize,
            orderBy: { ContainerTypeMasterSid: 'desc' },
        }),
        this._db.containerTypeMaster.count({ where }),
    ]);

    return {
        items,
        totalCount,
    };
}
}
