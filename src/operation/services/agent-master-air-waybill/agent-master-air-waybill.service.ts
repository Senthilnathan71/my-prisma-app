import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import * as moment from 'moment-timezone';
import { statusWhereClause } from 'src/common/helper';
import { DatabaseService } from 'src/database/database.service';
import { MenuService } from 'src/masters/services/menu/menu.service';
import { NumberSeriesService } from 'src/settings/services/number-series/number-series.service';
import { HouseJobService } from '../house-job/house-job.service';

@Injectable()
export class AgentMasterAirWaybillService {
  constructor(
    private readonly _db: DatabaseService,
    private readonly houseJobService: HouseJobService,
    private readonly menuService: MenuService,
    private readonly numberSeriesService: NumberSeriesService,
  ) {}

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
      select: { departmentType: true },
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

    // const masterJobNumber =
    //   (payload.MasterJobNumber && String(payload.MasterJobNumber).trim()) ||
    //   (payload.MBLNo && String(payload.MBLNo).trim()) ||
    //   generatedMasterJobNumber;
    // const mblNo = (payload.MBLNo && String(payload.MBLNo).trim()) || masterJobNumber;

    const masterJob = await this._db.masterJob.create({
      data: {
        MasterJobNumber: generatedMasterJobNumber,
        MBLNo: payload.MBLNo,
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

    const housePayload = {
      ...payload,
      MasterJobSid: masterJob.MasterJobSid,
      MBLNo: payload.MBLNo,
      MBLDate: payload.MBLDate || null,
      HBLNo: null,
      JobType: 'Agent',
      MenuMasterSid: masterMenuId || null,
    };

    const houseJob = await this.houseJobService.createHouseJob(housePayload);
    return { masterJob, ...houseJob };
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

    const where: Prisma.HouseJobWhereInput = {
      CompanyMasterSid: activeCompanyId,
      BranchMasterSid: activeBranchId,
      JobType: { equals: 'Agent', mode: 'insensitive' },
      status: statusWhereClause,
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
}
