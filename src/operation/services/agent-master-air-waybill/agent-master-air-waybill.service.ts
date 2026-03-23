import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { MawbStock, Prisma } from '@prisma/client';
import * as moment from 'moment-timezone';
import { statusWhereClause } from 'src/common/helper';
import { DatabaseService } from 'src/database/database.service';
import { MenuService } from 'src/masters/services/menu/menu.service';
import { CompanyConfigService } from 'src/masters/services/company/company-config.service';
import { NumberSeriesService } from 'src/settings/services/number-series/number-series.service';
import { HouseJobService } from '../house-job/house-job.service';

@Injectable()
export class AgentMasterAirWaybillService {
  constructor(
    private readonly _db: DatabaseService,
    private readonly houseJobService: HouseJobService,
    private readonly menuService: MenuService,
    private readonly numberSeriesService: NumberSeriesService,
    private readonly companyConfigService: CompanyConfigService,
    private logger: Logger
  ) {}

  private parseConfigBoolean(value: any): boolean {
    if (value === true || value === false) {
      return value;
    }

    const normalized = String(value ?? '').trim().toUpperCase();
    return ['Y', 'YES', 'TRUE', '1'].includes(normalized);
  }

  private async allocateMawbFromStock(
    prisma: Prisma.TransactionClient,
    payload: any,
    generatedMasterJobNumber: string,
  ): Promise<string> {
    const customerId = payload.CustomerMasterSid || null;
    const customerName = String(payload.CustomerName ?? '').trim();
    const selectedCarrierName = String(payload.CarrierName ?? '').trim();
    const selectedAirlineName = String(payload.VesselName ?? '').trim();
    const airlineLookupName = selectedAirlineName || selectedCarrierName;
    let airlineId: number | null = null;

    if (airlineLookupName) {
      const airline = await prisma.customerMaster.findFirst({
        where: {
          CustomerName: {
            equals: airlineLookupName,
            mode: 'insensitive'
          },
          CompanyMasterSid: payload.CompanyMasterSid,
          status: 'A'
        },
        select: {
          CustomerMasterSid: true,
          CustomerName: true,
        }
      });

      airlineId = airline?.CustomerMasterSid || null;
    }

    let availableMawb: MawbStock | null = null;

    if (customerId) {
      availableMawb = await prisma.mawbStock.findFirst({
        where: {
          CompanyMasterSid: payload.CompanyMasterSid,
          BranchMasterSid: payload.BranchMasterSid,
          AirwayBillType: 'Airline',
          StockStatus: 'Free',
          AvailableStatus: 'Allocated',
          Customer: customerId,
          status: 'A'
        },
        orderBy: { MasterBillNumber: 'asc' }
      });
    }

    if (!availableMawb && airlineId) {
      availableMawb = await prisma.mawbStock.findFirst({
        where: {
          CompanyMasterSid: payload.CompanyMasterSid,
          BranchMasterSid: payload.BranchMasterSid,
          AirwayBillType: 'Airline',
          Agent: airlineId,
          StockStatus: 'Free',
          AvailableStatus: 'Available',
          status: 'A'
        },
        orderBy: { MasterBillNumber: 'asc' }
      });
    }

    if (!availableMawb && airlineId) {
      availableMawb = await prisma.mawbStock.findFirst({
        where: {
          CompanyMasterSid: payload.CompanyMasterSid,
          BranchMasterSid: payload.BranchMasterSid,
          AirwayBillType: 'Other',
          Agent: airlineId,
          StockStatus: 'Free',
          AvailableStatus: 'Available',
          status: 'A'
        },
        orderBy: { MasterBillNumber: 'asc' }
      });
    }

    if (!availableMawb) {
      const stockContext: string[] = [];
      if (customerName) {
        stockContext.push(`Customer: ${customerName}`);
      }
      if (selectedCarrierName || airlineLookupName) {
        stockContext.push(`Carrier: ${selectedCarrierName || airlineLookupName}`);
      }

      const contextMessage = stockContext.length > 0
        ? ` for ${stockContext.join(', ')}`
        : '';

      throw new BadRequestException(`No MAWB stock available for auto allocation${contextMessage}. Please enter MAWB manually.`);
    }

    await prisma.mawbStock.update({
      where: { MawbStockSid: availableMawb.MawbStockSid },
      data: {
        StockStatus: 'Utilised',
        updatedBy: payload.createdBy,
        updatedOn: new Date()
      }
    });

    return availableMawb.MasterBillNumber;
  }

  private async getAgentMasterAirWaybillMenuSid() {
    try {
      return await this.menuService.getMenuSidByName('Agent Master Air Waybill');
    } catch {
      return await this.menuService.getMenuSidByName('AgentMaster Air Waybill');
    }
  }

  async createAgentMasterAirWaybill(payload: any) {
    if (!payload.CompanyMasterSid) throw new BadRequestException('CompanyMasterSid is required');
    if (!payload.BranchMasterSid) throw new BadRequestException('BranchMasterSid is required');
    if (!payload.DepartmentMasterSid) throw new BadRequestException('DepartmentMasterSid is required');
    if (!payload.CustomerMasterSid) throw new BadRequestException('CustomerMasterSid is required');
    if (!payload.createdBy) throw new BadRequestException('createdBy is required');

    const department = await this._db.departmentMaster.findUnique({
      where: { DepartmentMasterSid: payload.DepartmentMasterSid },
      select: { departmentType: true, ExportImport: true },
    });
    if (!department) throw new BadRequestException('Department not found.');

    const masterMenuId = await this.getAgentMasterAirWaybillMenuSid();
    const resolvedJobDate = payload.MBLDate ? new Date(payload.MBLDate) : new Date();

    let generatedMasterJobNumber = await this.numberSeriesService.generateNextNumber(
      payload.CompanyMasterSid,
      payload.BranchMasterSid,
      masterMenuId,
      payload.DepartmentMasterSid,
      resolvedJobDate,
    );

    if (!generatedMasterJobNumber) {
      const dateString = moment().format('YYYYMMDD');
      const count = await this._db.masterJob.count({
        where: { MasterJobNumber: { contains: dateString } },
      });
      generatedMasterJobNumber = `MASTER-${dateString}-${(count + 1).toString().padStart(3, '0')}`;
    }

    const transactionResult = await this._db.$transaction(async (prisma) => {
      const isAirExport =
        String(department.departmentType ?? '').toUpperCase() === 'AIR' &&
        String(department.ExportImport ?? '').toUpperCase() === 'EXPORT';

      const isMawbAutoAllocationEnabled = isAirExport && this.parseConfigBoolean(
        await this.companyConfigService.getConfigurationValue(
          payload.CompanyMasterSid,
          'MawbStockAllocation',
          prisma,
        )
      );

      const manualMblNo = String(payload.MBLNo ?? '').trim();
      let assignedMBLNo = '';
      let allocatedFromStock = false;

      if (manualMblNo) {
        assignedMBLNo = manualMblNo;
      } else if (isMawbAutoAllocationEnabled) {
        assignedMBLNo = await this.allocateMawbFromStock(prisma, payload, generatedMasterJobNumber);
        allocatedFromStock = true;
      }

      const masterJob = await prisma.masterJob.create({
        data: {
          MasterJobNumber: generatedMasterJobNumber,
          MBLNo: assignedMBLNo,
          MasterJobDate: resolvedJobDate,
          MBLDate: resolvedJobDate,
          FreightPPCC: payload.FreightPPCC || 'Prepaid',
          CompanyMasterSid: payload.CompanyMasterSid,
          BranchMasterSid: payload.BranchMasterSid,
          DepartmentMasterSid: payload.DepartmentMasterSid,
          MenuMasterSid: masterMenuId || null,
          POO: payload.POO || '',
          POL: payload.POL || '',
          POD: payload.POD || '',
          FPD: payload.FPD || '',
          Status: payload.status || 'A',
          CreatedBy: payload.createdBy,
        },
      });

      return {
        masterJob,
        assignedMBLNo,
        allocatedFromStock,
      };
    });

    const housePayload = {
      ...payload,
      MasterJobSid: transactionResult.masterJob.MasterJobSid,
      MBLNo: transactionResult.assignedMBLNo,
      MBLDate: payload.MBLDate || null,
      HBLNo: null,
      JobType: 'Agent',
      MenuMasterSid: masterMenuId || null,
    };

    try {
      const houseJob = await this.houseJobService.createHouseJob(housePayload);
      return { masterJob: transactionResult.masterJob, ...houseJob };
    } catch (error) {
      if (transactionResult.allocatedFromStock && transactionResult.assignedMBLNo) {
        await this._db.mawbStock.updateMany({
          where: {
            MasterBillNumber: transactionResult.assignedMBLNo,
            CompanyMasterSid: payload.CompanyMasterSid,
            BranchMasterSid: payload.BranchMasterSid,
            status: 'A',
          },
          data: {
            StockStatus: 'Free',
            updatedBy: payload.createdBy,
            updatedOn: new Date(),
          },
        });
      }

      await this._db.masterJob.delete({
        where: { MasterJobSid: transactionResult.masterJob.MasterJobSid },
      });

      throw error;
    }
  }

  async fetchAgentMasterAirWaybillById(houseJobSid: number) {
    const result = await this.houseJobService.getHouseJobById(houseJobSid);
    if (!result || String(result.JobType || '').toLowerCase() !== 'agent') {
      throw new NotFoundException(`Agent Master Air Waybill with ID ${houseJobSid} not found.`);
    }
    return result;
  }

  async updateAgentMasterAirWaybill(houseJobSid: number, payload: any) {
    const existing = await this._db.houseJob.findUnique({
      where: { HouseJobSid: houseJobSid },
      select: { HouseJobSid: true, MasterJobSid: true, JobType: true },
    });
    if (!existing || String(existing.JobType || '').toLowerCase() !== 'agent') {
      throw new NotFoundException(`Agent Master Air Waybill with ID ${houseJobSid} not found.`);
    }

    if (existing.MasterJobSid) {
      const mblNo = payload.MBLNo && String(payload.MBLNo).trim();
      const masterJobNumber = payload.MasterJobNumber && String(payload.MasterJobNumber).trim();
      const masterUpdateData: any = {};
      if (mblNo) masterUpdateData.MBLNo = mblNo;
      if (masterJobNumber) masterUpdateData.MasterJobNumber = masterJobNumber;
      if (Object.keys(masterUpdateData).length > 0) {
        masterUpdateData.UpdatedBy = payload.updatedBy || payload.createdBy || null;
        await this._db.masterJob.update({
          where: { MasterJobSid: existing.MasterJobSid },
          data: masterUpdateData,
        });
      }
      if (mblNo || masterJobNumber) {
        payload.MBLNo = mblNo || masterJobNumber;
      }
    }

    const housePayload = {
      ...payload,
      JobType: 'Agent',
    };
    await this.houseJobService.updateHouseJobById(houseJobSid, housePayload);
    return this.fetchAgentMasterAirWaybillById(houseJobSid);
  }

  async searchAgentMasterAirWaybill(payload: any) {
    const {
      search = '',
      page = 1,
      pageSize = 15,
      activeCompanyId,
      activeBranchId,
      departmentType,
    } = payload || {};

    if (!activeCompanyId || !activeBranchId) {
      throw new BadRequestException('activeCompanyId and activeBranchId are required');
    }

    const dateFromRaw = payload?.dateFrom ?? payload?.DateFrom;
    const dateToRaw = payload?.dateTo ?? payload?.DateTo;
    const dateFieldRaw = payload?.dateField ?? payload?.DateField ?? 'MBLDate';
    const allowedDateFields = new Set(['MBLDate', 'ETD', 'ETA', 'HBLDate']);
    const dateField = allowedDateFields.has(dateFieldRaw) ? dateFieldRaw : 'MBLDate';
    const customerMasterSid = payload?.CustomerMasterSid ?? payload?.customerMasterSid ?? null;
    const departmentMasterSid = payload?.DepartmentMasterSid ?? payload?.departmentMasterSid ?? null;
    const pol = payload?.POL ?? payload?.pol ?? null;
    const pod = payload?.POD ?? payload?.pod ?? null;
    const dateRange: Prisma.DateTimeFilter = {};
    if (dateFromRaw) {
      const parsedFrom = new Date(dateFromRaw);
      if (!Number.isNaN(parsedFrom.getTime())) {
        dateRange.gte = parsedFrom;
      }
    }
    if (dateToRaw) {
      const parsedTo = new Date(dateToRaw);
      if (!Number.isNaN(parsedTo.getTime())) {
        dateRange.lte = parsedTo;
      }
    }

    const where: Prisma.HouseJobWhereInput = {
      CompanyMasterSid: activeCompanyId,
      BranchMasterSid: activeBranchId,
      JobType: { equals: 'Agent', mode: 'insensitive' },
      status: statusWhereClause,
      ...(customerMasterSid ? { CustomerMasterSid: Number(customerMasterSid) } : {}),
      ...(departmentMasterSid ? { DepartmentMasterSid: Number(departmentMasterSid) } : {}),
      ...(pol ? { POL: String(pol) } : {}),
      ...(pod ? { POD: String(pod) } : {}),
      ...(Object.keys(dateRange).length ? { [dateField]: dateRange } : {}),
      ...(departmentType
        ? {
            departmentMaster: {
              departmentType: { equals: String(departmentType).toUpperCase(), mode: 'insensitive' },
            },
          }
        : {}),
      ...(search
        ? {
            OR: [
              { HBLNo: { contains: search, mode: 'insensitive' } },
              { MBLNo: { contains: search, mode: 'insensitive' } },
              { ShipmentNo: { contains: search, mode: 'insensitive' } },
              { CustomerName: { contains: search, mode: 'insensitive' } },
              { POL: { contains: search, mode: 'insensitive' } },
              { POD: { contains: search, mode: 'insensitive' } },
              { masterJob: { MasterJobNumber: { contains: search, mode: 'insensitive' } } },
            ],
          }
        : {}),
    };

    const skip = (Number(page) - 1) * Number(pageSize);
    const take = Number(pageSize);

    const [items, totalCount] = await this._db.$transaction([
      this._db.houseJob.findMany({
        where,
        skip,
        take,
        orderBy: { HouseJobSid: 'desc' },
        include: {
          departmentMaster: { select: { departmentType: true, departmentName: true } },
          masterJob: { select: { MasterJobNumber: true, MBLNo: true , MBLDate: true } },
        },
      }),
      this._db.houseJob.count({ where }),
    ]);

    return { items, totalCount };
  }

  async deleteAgentMasterAirWaybill(houseJobSid: number, payload: any) {
    const existing = await this._db.houseJob.findUnique({
      where: { HouseJobSid: houseJobSid },
      select: { HouseJobSid: true, MasterJobSid: true, JobType: true },
    });
    if (!existing || String(existing.JobType || '').toLowerCase() !== 'agent') {
      throw new NotFoundException(`Agent Master Air Waybill with ID ${houseJobSid} not found.`);
    }

    const updatedBy = payload?.updatedBy || payload?.createdBy || 'system';

    return this._db.$transaction(async (prisma) => {
      const deleted = await prisma.houseJob.update({
        where: { HouseJobSid: houseJobSid },
        data: { status: 'D', updatedBy },
      });

      await prisma.houseJobCargo.updateMany({
        where: { HouseJobSid: houseJobSid, status: 'A' },
        data: { status: 'D', updatedBy },
      });
      await prisma.houseJobProduct.updateMany({
        where: { HouseJobSid: houseJobSid, status: 'A' },
        data: { status: 'D', updatedBy },
      });
      await prisma.houseJobConnection.updateMany({
        where: { HouseJobSid: houseJobSid, status: 'A' },
        data: { status: 'D', updatedBy },
      });
      await prisma.houseJobOthers.updateMany({
        where: { HouseJobSid: houseJobSid, status: 'A' },
        data: { status: 'D', updatedBy },
      });
      await prisma.houseJobBOE.updateMany({
        where: { HouseJobSid: houseJobSid, Status: 'A' },
        data: { Status: 'D', UpdatedBy: updatedBy },
      });
      await prisma.houseJobVehicle.updateMany({
        where: { HouseJobSid: houseJobSid, Status: 'A' },
        data: { Status: 'D', UpdatedBy: updatedBy },
      });
      await prisma.houseJobCustoms.updateMany({
        where: { HouseJobSid: houseJobSid, Status: 'A' },
        data: { Status: 'D', UpdatedBy: updatedBy },
      });

      await prisma.costRevenueCharges.updateMany({
        where: { TransactionSid: houseJobSid, status: 'A' },
        data: { status: 'D', updatedBy },
      });

      if (existing.MasterJobSid) {
        const activeChildren = await prisma.houseJob.count({
          where: { MasterJobSid: existing.MasterJobSid, status: 'A' },
        });
        if (activeChildren === 0) {
          await prisma.masterJob.update({
            where: { MasterJobSid: existing.MasterJobSid },
            data: { Status: 'D', UpdatedBy: updatedBy },
          });
        }
      }

      return deleted;
    });
  }

  async getAuditLogs(tableName: string, recordId?: string) {
  try {
    let conditions: any[] = [];

    // HOUSE JOB LOG
    if (tableName === 'HouseJob' && recordId) {
      const houseJobSid = Number(recordId);

      const houseJob = await this._db.houseJob.findUnique({
        where: { HouseJobSid: houseJobSid },
        select: {
          HouseJobSid: true,
          MasterJobSid: true,
          JobType: true,
        },
      });

      if (!houseJob || String(houseJob.JobType || '').toLowerCase() !== 'agent') {
        throw new NotFoundException(`Agent Master Air Waybill with ID ${houseJobSid} not found.`);
      }

      const [
        cargo,
        product,
        connection,
        others,
        boe,
        vehicle,
        customs,
        charges,
      ] = await Promise.all([
        this._db.houseJobCargo.findMany({
          where: { HouseJobSid: houseJobSid },
          select: { HouseJobCargoSid: true }
        }),

        this._db.houseJobProduct.findMany({
          where: { HouseJobSid: houseJobSid },
          select: { HouseJobProductSid: true }
        }),

        this._db.houseJobConnection.findMany({
          where: { HouseJobSid: houseJobSid },
          select: { HouseJobConnectionSid: true }
        }),

        this._db.houseJobOthers.findMany({
          where: { HouseJobSid: houseJobSid },
          select: { HouseJobOthersSid: true }
        }),

        this._db.houseJobBOE.findMany({
          where: { HouseJobSid: houseJobSid },
          select: { HouseJobBOESid: true }
        }),

        this._db.houseJobVehicle.findMany({
          where: { HouseJobSid: houseJobSid },
          select: { HouseJobVehicleSid: true }
        }),

        this._db.houseJobCustoms.findMany({
          where: { HouseJobSid: houseJobSid },
          select: { HouseJobCustomsSid: true }
        }),

        this._db.costRevenueCharges.findMany({
          where: { TransactionSid: houseJobSid },
          select: { CostRevenueChargesSid: true }
        })
      ]);

      conditions = [
        {
          tableName: 'HouseJob',
          recordId: recordId
        },

        ...(houseJob.MasterJobSid
          ? [{
              tableName: 'MasterJob',
              recordId: houseJob.MasterJobSid.toString()
            }]
          : []),

        ...(cargo.length
          ? [{
              tableName: 'HouseJobCargo',
              recordId: { in: cargo.map(x => x.HouseJobCargoSid.toString()) }
            }]
          : []),

        ...(product.length
          ? [{
              tableName: 'HouseJobProduct',
              recordId: { in: product.map(x => x.HouseJobProductSid.toString()) }
            }]
          : []),
        ...(connection.length
          ? [{
              tableName: 'HouseJobConnection',
              recordId: { in: connection.map(x => x.HouseJobConnectionSid.toString()) }
            }]
          : []),
        ...(others.length
          ? [{
              tableName: 'HouseJobOthers',
              recordId: { in: others.map(x => x.HouseJobOthersSid.toString()) }
            }]
          : []),
        ...(boe.length
          ? [{
              tableName: 'HouseJobBOE',
              recordId: { in: boe.map(x => x.HouseJobBOESid.toString()) }
            }]
          : []),
        ...(vehicle.length
          ? [{
              tableName: 'HouseJobVehicle',
              recordId: { in: vehicle.map(x => x.HouseJobVehicleSid.toString()) }
            }]
          : []),
        ...(customs.length
          ? [{
              tableName: 'HouseJobCustoms',
              recordId: { in: customs.map(x => x.HouseJobCustomsSid.toString()) }
            }]
          : []),
        ...(charges.length
          ? [{
              tableName: 'CostRevenueCharges',
              recordId: { in: charges.map(x => x.CostRevenueChargesSid.toString()) }
            }]
          : [])
      ];
    } else {
      conditions = [{
        tableName,
        ...(recordId && { recordId })
      }];
    }
    const logs = await this._db.auditLog.findMany({
      where: {
        OR: conditions
      },
      orderBy: {
        changedAt: 'desc'
      }
    });
    return logs;
  } catch (error) {
    this.logger.warn(`getAuditLogsError: ${error}`);
    throw new Error(`Error fetching audit logs: ${error.message}`);
  }
}
}









