import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { DatabaseService } from 'src/database/database.service';

@Injectable()
export class ContainerTypeService {
  constructor(private _db: DatabaseService) {}

  // ContainerType master create

  async createNewContainerType(newData: Prisma.ContainerTypeMasterCreateInput) {
    try {
      const newlyAddedData = await this._db.containerTypeMaster.create({
        data: {
          ...newData,
          createdBy: 'admin@crm.com',
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
    newData: Prisma.ContainerTypeMasterUpdateInput,
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
}
