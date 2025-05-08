import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { DatabaseService } from 'src/database/database.service';

@Injectable()
export class PackageTypeService {
  constructor(private _db: DatabaseService) {}

  async createPackageType(newData: Prisma.PackageTypeMasterCreateInput) {
    try {
      const newlyAddedPackageType = await this._db.packageTypeMaster.create({
        data: { ...newData, createdBy: 'admin@crm.com' },
      });
      return newlyAddedPackageType;
    } catch (error) {
      throw error;
    }
  }

  async getAllPackageType() {
    try {
      const allPackageTypes = await this._db.packageTypeMaster.findMany({
        where: {
          deletedAt: {
            equals: null,
          },
        },
      });
      return allPackageTypes;
    } catch (error) {
      throw error;
    }
  }

  async getPackageTypeById(id: number) {
    try {
      const ourPackageType = await this._db.packageTypeMaster.findUnique({
        where: {
          PackageTypeMasterSid: id,
        },
      });
      if (!ourPackageType) {
        throw new BadRequestException(`Package Type with Id: ${id} not found`);
      }
      return ourPackageType;
    } catch (error) {
      throw error;
    }
  }

  async editPackageTypeById(
    id: number,
    newData: Prisma.PackageTypeMasterUpdateInput,
  ) {
    try {
      const existing = await this._db.packageTypeMaster.findUnique({
        where: {
          PackageTypeMasterSid: id,
        },
      });
      if (!existing) {
        throw new BadRequestException(`Package Type with id : ${id} not exist`);
      }
      const updatedData = await this._db.packageTypeMaster.update({
        where: {
          PackageTypeMasterSid: id,
        },
        data: newData,
      });
      return updatedData;
    } catch (error) {
      throw error;
    }
  }

  async softDeletePackageType(id: number) {
    try {
      const existing = await this._db.packageTypeMaster.findUnique({
        where: {
          PackageTypeMasterSid: id,
        },
      });
      if (!existing) {
        throw new BadRequestException(`Package Type with id : ${id} not exist`);
      }
      if (existing.deletedAt) {
        throw new BadRequestException(
          `Package Type with id : ${id} is already deleted`,
        );
      }
      const deletedData = await this._db.packageTypeMaster.update({
        where: {
          PackageTypeMasterSid: id,
        },
        data: {
          deletedAt: new Date(),
        },
      });
      return deletedData;
    } catch (error) {
      throw error;
    }
  }
}
