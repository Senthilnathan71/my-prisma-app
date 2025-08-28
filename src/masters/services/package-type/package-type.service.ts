import { BadRequestException, Injectable,Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { DatabaseService } from 'src/database/database.service';
import { SearchListDto } from 'src/masters/DTO/search-list.dto';
import { SearchVesselDto } from 'src/masters/DTO/search-vessel.dto';

@Injectable()
export class PackageTypeService {
  constructor(private _db: DatabaseService, private logger: Logger) {}

  async createPackageType(newData: any) {
    try {
      const newlyAddedPackageType = await this._db.packageTypeMaster.create({
        data: { ...newData,  },
      });
      return newlyAddedPackageType;
    } catch (error) {
      throw error;
    }
  }

  async getAllPackageType(CompanyMasterSid: number) {
    try {
      const allPackageTypes = await this._db.packageTypeMaster.findMany({
        where: {
          CompanyMasterSid: CompanyMasterSid,
          status:"A"
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
    newData: any,
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
      if (existing.status==="D") {
        throw new BadRequestException(
          `Package Type with id : ${id} is already deleted`,
        );
      }
      const deletedData = await this._db.packageTypeMaster.update({
        where: {
          PackageTypeMasterSid: id,
        },
        data: {
          status:"D",
        },
      });
      return deletedData;
    } catch (error) {
      throw error;
    }
  }

  async searchPackageType(data: SearchListDto) {
    const { searchType, filterValue } = data;
    const acceptedType = ['PackageName', 'PackageCode', 'status'];
    if (!acceptedType.includes(searchType)) {
      throw new BadRequestException('Invalid Search Type');
    }
    const searchResults = await this._db.packageTypeMaster
      .findMany({
        where: {
          [searchType]: {
            contains: filterValue,
            mode: 'insensitive',
          },
          status:"A"
        },
      })
      .catch((err) => {
        throw new Error(`Error Occured: ${err}`);
      });
    return searchResults;
  }

  async searchPackageTypeNew(params:SearchVesselDto) {
    const {search='',page=1,pageSize=15,activeCompanyId}=params;
    const skip = (page-1)*pageSize;

    const where: Prisma.PackageTypeMasterWhereInput = {
     
      status: 'A',
     CompanyMasterSid : activeCompanyId,
      ...(search
        ? {
          OR:[
            { PackageName: { contains: search, mode:'insensitive'}},
            { PackageCode: { contains: search, mode:'insensitive'}},
          ],
        }
        : {}
      ),
    };

    const [items,totalCount ] = await this._db.$transaction([
      this._db.packageTypeMaster.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { PackageTypeMasterSid: 'desc'},
      }),
      this._db.packageTypeMaster.count({where}),
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
