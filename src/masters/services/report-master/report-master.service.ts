import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { statusWhereClause } from 'src/common/helper';
import { DatabaseService } from 'src/database/database.service';
import { SearchListDto } from 'src/masters/DTO/search-list.dto';
import { filterDto } from 'src/masters/DTO/search-vessel.dto';

@Injectable()
export class ReportMasterService {
  constructor(private _db: DatabaseService, private logger: Logger) { }

  async createReportMaster(payload: any) {
    try {
      const createdReport = await this._db.$transaction(async (prisma) => {
        return await prisma.reportMaster.create({
          data: {
            CreatedBy: payload.CreatedBy,
            Status: payload.Status,
            ReportName: payload.ReportName,
            ReportDisplayName: payload.ReportDisplayName,
            ReportMenuSid: payload.ReportMenuSid,
            ReportType: payload.ReportType,
            ReportFormat: payload.ReportFormat,
            ReportExcludedCompany: payload.ReportExcludedCompany,

          }
        })
      })
      const allDetails = payload.reportDetails || [];
      const allFormattedDetails = allDetails.map(detail => {
        const enrichedDetail = {
          CreatedBy: payload.createdBy,
          Status: detail.Status,
          ParameterName: detail.ParameterName,
          ParameterFieldType: detail.ParameterFieldType,
          DropDownValue: detail.DropDownValue,
          ParameterQuery: detail.ParameterQuery,
          ReportMasterSid: createdReport.ReportMasterSid
        }
        return enrichedDetail;
      })
      await this._db.reportMasterDetail.createMany({
        data: allFormattedDetails
      })

      return createdReport;
    } catch (error) {
      throw error;
    }
  }

  async getAllReportMaster() {
    try {
      const allPackageTypes = await this._db.reportMaster.findMany({
        where: {
          Status: "A"
        },
      });
      return allPackageTypes;
    } catch (error) {
      throw error;
    }
  }

  async getReportMasterById(id: number) {
    try {
      const ourPackageType = await this._db.reportMaster.findUnique({
        where: {
          ReportMasterSid: id,
        },
      });
      if (!ourPackageType) {
        throw new BadRequestException(`Report Master with Id: ${id} not found`);
      }
      return ourPackageType;
    } catch (error) {
      throw error;
    }
  }

 async editReportMasterById(id: number, newData: any) {
  try {
    const existing = await this._db.reportMaster.findUnique({
      where: { ReportMasterSid: id },
    });

    if (!existing) {
      throw new BadRequestException(`Report Master with id : ${id} does not exist`);
    }

    // Use a transaction for safe update
    const updatedReport = await this._db.$transaction(async (prisma) => {
      // 1. Update main reportMaster
      const updatedMaster = await prisma.reportMaster.update({
        where: { ReportMasterSid: id },
        data: {
          CreatedBy: newData.CreatedBy,
          Status: newData.Status,
          ReportName: newData.ReportName,
          ReportDisplayName: newData.ReportDisplayName,
          ReportMenuSid: newData.ReportMenuSid,
          ReportType: newData.ReportType,
          ReportFormat: newData.ReportFormat,
          ReportExcludedCompany: newData.ReportExcludedCompany,
        },
      });

      // 2. Handle detail records if passed
      if (newData.reportDetails && Array.isArray(newData.reportDetails)) {
        // Optionally delete old details before inserting new ones
        await prisma.reportMasterDetail.deleteMany({
          where: { ReportMasterSid: id },
        });

        const enrichedDetails = newData.reportDetails.map((detail) => ({
          CreatedBy: newData.CreatedBy,
          Status: detail.Status,
          ParameterName: detail.ParameterName,
          ParameterFieldType: detail.ParameterFieldType,
          DropDownValue: detail.DropDownValue,
          ParameterQuery: detail.ParameterQuery,
          ReportMasterSid: id
        }));

        await prisma.reportMasterDetail.createMany({
          data: enrichedDetails,
        });
      }

      return updatedMaster;
    });

    return updatedReport;
  } catch (error) {
    throw error;
  }
}


  async softDeleteReportMaster(id: number) {
    try {
      const existing = await this._db.reportMaster.findUnique({
        where: {
          ReportMasterSid: id,
        },
      });
      if (!existing) {
        throw new BadRequestException(`Report Master with id : ${id} not exist`);
      }
      if (existing.Status === "D") {
        throw new BadRequestException(
          `Report Master with id : ${id} is already deleted`,
        );
      }
      const deletedData = await this._db.reportMaster.update({
        where: {
          ReportMasterSid: id,
        },
        data: {
          Status: "D",
        },
      });
      return deletedData;
    } catch (error) {
      throw error;
    }
  }

  // async searchReportMaster(data: SearchListDto) {
  //   const { searchType, filterValue } = data;
  //   const acceptedType = ['PackageName', 'PackageCode', 'status'];
  //   if (!acceptedType.includes(searchType)) {
  //     throw new BadRequestException('Invalid Search Type');
  //   }
  //   const searchResults = await this._db.reportMaster
  //     .findMany({
  //       where: {
  //         [searchType]: {
  //           contains: filterValue,
  //           mode: 'insensitive',
  //         },
  //         Status: "A"
  //       },
  //     })
  //     .catch((err) => {
  //       throw new Error(`Error Occured: ${err}`);
  //     });
  //   return searchResults;
  // }

  async searchReportMasterNew(params: filterDto) {
    const { search = '', page = 1, pageSize = 15, activeCompanyId } = params;
    const skip = (page - 1) * pageSize;

    const where: Prisma.ReportMasterWhereInput = {

      Status: statusWhereClause,
      //   CompanyMasterSid: activeCompanyId,
      ...(search
        ? {
          OR: [
            { ReportName: { contains: search, mode: 'insensitive' } },
            { ReportDisplayName: { contains: search, mode: 'insensitive' } }
          ],
        }
        : {}
      ),
    };

    const [items, totalCount] = await this._db.$transaction([
      this._db.reportMaster.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { ReportMasterSid: 'desc' },
      }),
      this._db.reportMaster.count({ where }),
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
