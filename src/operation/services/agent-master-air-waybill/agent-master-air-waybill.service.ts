import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { MawbStock, Prisma } from '@prisma/client';
import * as moment from 'moment-timezone';
import { statusWhereClause } from 'src/common/helper';
import { DatabaseService } from 'src/database/database.service';
import { MenuService } from 'src/settings/services/menu/menu.service';
import { CompanyConfigService } from 'src/masters/services/company/company-config.service';
import { NumberSeriesService } from 'src/settings/services/number-series/number-series.service';
import { HouseJobService } from '../house-job/house-job.service';
import { MenuUserConfigService } from 'src/settings/services/menu-user-config/menu-user-config.service';

@Injectable()
export class AgentMasterAirWaybillService {
  constructor(
    private readonly _db: DatabaseService,
    private readonly houseJobService: HouseJobService,
    private readonly menuService: MenuService,
    private readonly numberSeriesService: NumberSeriesService,
    private readonly companyConfigService: CompanyConfigService,
    private logger: Logger,
    private menuUserConfigService: MenuUserConfigService
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
        updatedBy: payload.createdBy || payload.updatedBy,
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

    // Resolve POL/POD port Sids for number series counter key
    const [polPortAMW, podPortAMW] = await Promise.all([
      payload.POL ? this._db.portMaster.findFirst({ where: { PortCode: payload.POL }, select: { PortMasterSid: true } }) : null,
      payload.POD ? this._db.portMaster.findFirst({ where: { PortCode: payload.POD }, select: { PortMasterSid: true } }) : null,
    ]);
    const transactionResult = await this._db.$transaction(async (prisma) => {
      // Consume the number series INSIDE this transaction: the counter rolls
      // back with a failed save, so no sequence number is burned.
      let generatedMasterJobNumber = await this.numberSeriesService.generateNextNumber(
        payload.CompanyMasterSid,
        payload.BranchMasterSid,
        masterMenuId,
        payload.DepartmentMasterSid,
        resolvedJobDate,
        polPortAMW?.PortMasterSid,
        podPortAMW?.PortMasterSid,
        prisma,
      );

      if (!generatedMasterJobNumber) {
        const dateString = moment().format('YYYYMMDD');
        const count = await prisma.masterJob.count({
          where: { MasterJobNumber: { contains: dateString } },
        });
        generatedMasterJobNumber = `MASTER-${dateString}-${(count + 1).toString().padStart(3, '0')}`;
      }

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

    const resourcePerson =
        (await this.menuUserConfigService.getConfiguredUser(
          payload.CompanyMasterSid,
          payload.BranchMasterSid,
          masterMenuId,
        ));

    const housePayload = {
      ...payload,
      MasterJobSid: transactionResult.masterJob.MasterJobSid,
      MBLNo: transactionResult.assignedMBLNo,
      MBLDate: payload.MBLDate || null,
      HBLNo: null,
      JobType: 'Agent',
      MenuMasterSid: masterMenuId || null,
      ResourcePerson: resourcePerson,
    };

    try {
      const houseJob = await this.houseJobService.createHouseJob(housePayload);
      const createdHouseJobSid = houseJob?.houseJob?.HouseJobSid;

      if (createdHouseJobSid && !houseJob.houseJob.HBLNo) {
        await this._db.houseJob.update({
          where: { HouseJobSid: createdHouseJobSid },
          data: {
            HBLNo: String(createdHouseJobSid),
            updatedBy: payload.createdBy || payload.updatedBy || 'system',
            updatedOn: new Date(),
          },
        });

        houseJob.houseJob.HBLNo = String(createdHouseJobSid);
      }

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
            updatedBy: payload.createdBy || payload.updatedBy,
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

  async fetchAgentMasterAirWaybillById(houseJobSid: number,CompanyMasterSid: number,BranchMasterSid: number) {
    const result = await this.houseJobService.getHouseJobById(houseJobSid,CompanyMasterSid,BranchMasterSid);
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
    return this.fetchAgentMasterAirWaybillById(houseJobSid,payload.CompanyMasterSid,payload.BranchMasterSid);
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
        data: { status: 'D', updatedBy, updatedOn: new Date() },
      });

      await prisma.houseJobCargo.updateMany({
        where: { HouseJobSid: houseJobSid, status: 'A' },
        data: { status: 'D', updatedBy , updatedOn: new Date() },
      });
      await prisma.houseJobProduct.updateMany({
        where: { HouseJobSid: houseJobSid, status: 'A' },
        data: { status: 'D', updatedBy, updatedOn: new Date() },
      });
      await prisma.houseJobConnection.updateMany({
        where: { HouseJobSid: houseJobSid, status: 'A' },
        data: { status: 'D', updatedBy , updatedOn: new Date() },
      });
      await prisma.houseJobOthers.updateMany({
        where: { HouseJobSid: houseJobSid, status: 'A' },
        data: { status: 'D', updatedBy, updatedOn: new Date() },
      });
      await prisma.houseJobBOE.updateMany({
        where: { HouseJobSid: houseJobSid, Status: 'A' },
        data: { Status: 'D', UpdatedBy: updatedBy , UpdatedOn: new Date() },
      });
      await prisma.houseJobVehicle.updateMany({
        where: { HouseJobSid: houseJobSid, Status: 'A' },
        data: { Status: 'D', UpdatedBy: updatedBy , UpdatedOn: new Date() },
      });
      await prisma.houseJobCustoms.updateMany({
        where: { HouseJobSid: houseJobSid, Status: 'A' },
        data: { Status: 'D', UpdatedBy: updatedBy , UpdatedOn: new Date() },
      });

      await prisma.costRevenueCharges.updateMany({
        where: { TransactionSid: houseJobSid, status: 'A' },
        data: { status: 'D', updatedBy , updatedOn: new Date() },
      });

      if (existing.MasterJobSid) {
        const activeChildren = await prisma.houseJob.count({
          where: { MasterJobSid: existing.MasterJobSid, status: 'A' },
        });
        if (activeChildren === 0) {
          await prisma.masterJob.update({
            where: { MasterJobSid: existing.MasterJobSid },
            data: { Status: 'D', UpdatedBy: updatedBy , UpdatedOn: new Date() },
          });
        }
      }

      return deleted;
    });
  }

}









