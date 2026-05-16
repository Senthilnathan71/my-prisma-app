import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { statusWhereClause } from 'src/common/helper';
import { DatabaseService } from 'src/database/database.service';
import { SearchListDto } from 'src/masters/DTO/search-list.dto';
import { filterDto } from 'src/masters/DTO/search-vessel.dto';

@Injectable()
export class ReportMasterService {
  constructor(private _db: DatabaseService, private logger: Logger) { }

  private getAuditUser(payload: any, fallback?: string | null) {
    return payload?.UpdatedBy || payload?.CreatedBy || payload?.updatedBy || payload?.createdBy || fallback || null;
  }

  private sanitizeReportDetail(detail: any) {
    return {
      ReportMasterDetailSid: detail?.ReportMasterDetailSid || null,
      Status: detail?.Status || 'A',
      ParameterName: detail?.ParameterName?.trim(),
      ParameterFieldType: detail?.ParameterFieldType || null,
      DropDownValue: detail?.DropDownValue ?? null,
      ParameterQuery: detail?.ParameterQuery?.trim() || null,
    };
  }

  private validateDuplicateDetails(details: any[]) {
    const seen = new Set<string>();

    for (const detail of details) {
      const key = [
        (detail.ParameterName || '').toLowerCase(),
        detail.ParameterFieldType || '',
        JSON.stringify(detail.DropDownValue ?? null),
        detail.ParameterQuery || '',
      ].join('|');

      if (seen.has(key)) {
        throw new BadRequestException(`Duplicate parameter found for "${detail.ParameterName}"`);
      }

      seen.add(key);
    }
  }

  private async syncReportDetails(prisma: any, reportId: number, reportDetails: any[], auditUser: string) {
    const sanitizedDetails = (reportDetails || [])
      .map((detail) => this.sanitizeReportDetail(detail))
      .filter((detail) => detail.ParameterName && detail.ParameterFieldType);

    this.validateDuplicateDetails(sanitizedDetails);

    const existingDetails = await prisma.reportMasterDetail.findMany({
      where: { ReportMasterSid: reportId },
      orderBy: { ReportMasterDetailSid: 'asc' },
    });

    const existingById = new Map(
      existingDetails.map((detail) => [detail.ReportMasterDetailSid, detail]),
    );

    const retainedIds = new Set<number>();

    for (const detail of sanitizedDetails) {
      const detailData = {
        Status: detail.Status,
        ParameterName: detail.ParameterName,
        ParameterFieldType: detail.ParameterFieldType,
        DropDownValue: detail.DropDownValue,
        ParameterQuery: detail.ParameterQuery,
      };

      if (detail.ReportMasterDetailSid && existingById.has(detail.ReportMasterDetailSid)) {
        retainedIds.add(detail.ReportMasterDetailSid);

        await prisma.reportMasterDetail.update({
          where: { ReportMasterDetailSid: detail.ReportMasterDetailSid },
          data: {
            ...detailData,
            UpdatedBy: auditUser,
            UpdatedOn: new Date(),
          },
        });
        continue;
      }

      const alreadyExisting = existingDetails.find((existingDetail) =>
        !retainedIds.has(existingDetail.ReportMasterDetailSid)
        && existingDetail.ParameterName === detail.ParameterName
        && existingDetail.ParameterFieldType === detail.ParameterFieldType
        && JSON.stringify(existingDetail.DropDownValue ?? null) === JSON.stringify(detail.DropDownValue ?? null)
        && (existingDetail.ParameterQuery || null) === detail.ParameterQuery,
      );

      if (alreadyExisting) {
        retainedIds.add(alreadyExisting.ReportMasterDetailSid);

        await prisma.reportMasterDetail.update({
          where: { ReportMasterDetailSid: alreadyExisting.ReportMasterDetailSid },
          data: {
            ...detailData,
            UpdatedBy: auditUser,
            UpdatedOn: new Date(),
            Status: detail.Status || alreadyExisting.Status,
          },
        });
        continue;
      }

      const createdDetail = await prisma.reportMasterDetail.create({
        data: {
          ...detailData,
          CreatedBy: auditUser,
          ReportMasterSid: reportId,
        },
      });

      retainedIds.add(createdDetail.ReportMasterDetailSid);
    }

    await prisma.reportMasterDetail.deleteMany({
      where: {
        ReportMasterSid: reportId,
        ...(retainedIds.size
          ? { ReportMasterDetailSid: { notIn: Array.from(retainedIds) } }
          : {}),
      },
    });
  }

  async createReportMaster(payload: any) {
    try {
      const auditUser = this.getAuditUser(payload);

      if (!auditUser) {
        throw new BadRequestException('CreatedBy is required');
      }

      const createdReport = await this._db.$transaction(async (prisma) => {
        const report = await prisma.reportMaster.create({
          data: {
            CreatedBy: auditUser,
            Status: payload.Status,
            ReportName: payload.ReportName,
            ReportDisplayName: payload.ReportDisplayName,
            ReportMenuSid: payload.ReportMenuSid,
            ReportType: payload.ReportType,
            ReportFormat: payload.ReportFormat,
            ReportExcludedCompany: payload.ReportExcludedCompany,
          }
        });

        await this.syncReportDetails(prisma, report.ReportMasterSid, payload.reportDetails || [], auditUser);

        return report;
      });

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

      const auditUser = this.getAuditUser(newData, existing.UpdatedBy || existing.CreatedBy);

      const updatedReport = await this._db.$transaction(async (prisma) => {
        const updatedMaster = await prisma.reportMaster.update({
          where: { ReportMasterSid: id },
          data: {
            UpdatedBy: auditUser,
            UpdatedOn: new Date(),
            Status: newData.Status,
            ReportName: newData.ReportName,
            ReportDisplayName: newData.ReportDisplayName,
            ReportMenuSid: newData.ReportMenuSid,
            ReportType: newData.ReportType,
            ReportFormat: newData.ReportFormat,
            ReportExcludedCompany: newData.ReportExcludedCompany,
          },
        });

        if (Array.isArray(newData.reportDetails)) {
          await this.syncReportDetails(prisma, id, newData.reportDetails, auditUser);
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
  async getByMenu(menuId: number, companyId?: number) {
    try {
      const reports = await this._db.reportMaster.findMany({
        where: { ReportMenuSid: menuId, Status: 'A' },
        select: {
          ReportMasterSid: true,
          ReportName: true,
          ReportDisplayName: true,
          ReportType: true,
          ReportFormat: true,
          Orientation: true,
          ReportExcludedCompany: true,
        },
        orderBy: { ReportDisplayName: 'asc' },
      });

      if (!companyId) return reports;

      return reports.filter((r) => {
        const excluded = r.ReportExcludedCompany as number[] | null;
        if (!excluded || !Array.isArray(excluded)) return true;
        return !excluded.includes(companyId);
      });
    } catch (error) {
      throw error;
    }
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

  async getReportParameters(reportId: number) {
    try {
      const parameters = await this._db.reportMasterDetail.findMany({
        where: {
          ReportMasterSid: reportId,
          Status: "A"
        },
        orderBy: { ReportMasterDetailSid: 'asc' }
      });
      return parameters;
    } catch (error) {
      throw error;
    }
  }

  async addReportParameter(reportId: number, parameterData: any) {
    try {
      // Verify report exists
      const report = await this._db.reportMaster.findUnique({
        where: { ReportMasterSid: reportId }
      });

      if (!report) {
        throw new BadRequestException(`Report with id: ${reportId} not found`);
      }

      const auditUser = this.getAuditUser(parameterData, report.CreatedBy);

      const parameter = await this._db.reportMasterDetail.create({
        data: {
          CreatedBy: auditUser,
          Status: parameterData.Status || "A",
          ParameterName: parameterData.ParameterName,
          ParameterFieldType: parameterData.ParameterFieldType,
          DropDownValue: parameterData.DropDownValue,
          ParameterQuery: parameterData.ParameterQuery,
          ReportMasterSid: reportId
        }
      });

      return parameter;
    } catch (error) {
      throw error;
    }
  }

  async updateReportParameter(parameterId: number, parameterData: any) {
    try {
      const existing = await this._db.reportMasterDetail.findUnique({
        where: { ReportMasterDetailSid: parameterId }
      });

      if (!existing) {
        throw new BadRequestException(`Parameter with id: ${parameterId} not found`);
      }

      const updated = await this._db.reportMasterDetail.update({
        where: { ReportMasterDetailSid: parameterId },
        data: {
          UpdatedBy: this.getAuditUser(parameterData, existing.UpdatedBy || existing.CreatedBy),
          Status: parameterData.Status,
          UpdatedOn: new Date(),
          ParameterName: parameterData.ParameterName,
          ParameterFieldType: parameterData.ParameterFieldType,
          DropDownValue: parameterData.DropDownValue,
          ParameterQuery: parameterData.ParameterQuery,
        }
      });

      return updated;
    } catch (error) {
      throw error;
    }
  }

  async deleteReportParameter(parameterId: number) {
    try {
      const existing = await this._db.reportMasterDetail.findUnique({
        where: { ReportMasterDetailSid: parameterId }
      });

      if (!existing) {
        throw new BadRequestException(`Parameter with id: ${parameterId} not found`);
      }

      if (existing.Status === "D") {
        throw new BadRequestException(`Parameter with id: ${parameterId} is already deleted`);
      }

      const deleted = await this._db.reportMasterDetail.update({
        where: { ReportMasterDetailSid: parameterId },
        data: { Status: "D" }
      });

      return deleted;
    } catch (error) {
      throw error;
    }
  }

  async getReportsByCompany(companyId: number) {
    try {
      const allReports = await this._db.reportMaster.findMany({
        where: {
          Status: "A"
        },
        include: {
          ReportMasterDetail: {
            where: { Status: "A" },
            orderBy: { ReportMasterDetailSid: 'asc' }
          }
        }
      });

      // Filter reports based on ReportExcludedCompany
      const filteredReports = allReports.filter(report => {
        if (!report.ReportExcludedCompany) return true;

        // Check if ReportExcludedCompany is an array
        const excludedCompanies = Array.isArray(report.ReportExcludedCompany)
          ? report.ReportExcludedCompany
          : [];

        // Return true if company is NOT in excluded list
        return !excludedCompanies.includes(companyId);
      });

      return filteredReports;
    } catch (error) {
      throw error;
    }
  }
}
