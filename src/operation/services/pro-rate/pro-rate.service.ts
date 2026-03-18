import { Injectable, Logger } from '@nestjs/common';
import { DatabaseService } from 'src/database/database.service';
import { MenuService } from 'src/masters/services/menu/menu.service';
import { roundAmount, toNumber } from 'src/common/helper';
import {
  ProRateApplyDto,
  ProRateCalculateDto,
  ProRateHouseDto,
} from '../../DTO/pro-rate.dto';

interface CargoAgg {
  totalPkg: number;
  grossWeight: number;
  netWeight: number;
  cbm: number;
  chargeableWeight: number;
  noOfContainers: number;
}

interface ProRateChargeRow {
  chargeMasterSid: number | null;
  chargeCode: string;
  chargeName: string;
  unitQty: string;
  noOfUnit: number;
  costCurrencyMasterSid: number | null;
  costCurrencyCode: string;
  costRate: number;
  costAmount: number;
  costLocalAmount: number;
  costExchangeRate: number;
  costDrCr: string | null;
  revenueCurrencyMasterSid: number | null;
  revenueCurrencyCode: string;
  revenueRate: number;
  revenueAmount: number;
  revenueLocalAmount: number;
  revenueExchangeRate: number;
  revenueDrCr: string | null;
}

@Injectable()
export class ProRateService {
  private readonly logger = new Logger(ProRateService.name);

  constructor(
    private readonly _db: DatabaseService,
    private readonly menuService: MenuService,
  ) {}

  async calculateProRate(payload: ProRateCalculateDto) {
    return this.buildProRateResponse(payload);
  }

  async applyProRate(payload: ProRateApplyDto) {
    const proRateData = await this.buildProRateResponse(payload);

    if (proRateData.totalHouses === 0) {
      throw new Error('No active house jobs found for this master job');
    }

    if (proRateData.masterCharges.length === 0) {
      throw new Error('No master-level charges found for this master job');
    }

    const masterJobOthers = await this._db.masterJobOthers.findFirst({
      where: {
        MasterJobSid: payload.MasterJobSid,
        Status: 'A',
      },
    });

    if (!masterJobOthers) {
      throw new Error('Master Job Others record not found');
    }

    const updatedOthers = await this._db.masterJobOthers.update({
      where: { MasterJobOthersSid: masterJobOthers.MasterJobOthersSid },
      data: {
        JobtoSubjob: 'Y',
      },
      select: {
        MasterJobSid: true,
        JobtoSubjob: true,
      },
    });

    return updatedOthers;
  }

  async getHouseProratedCharges(payload: ProRateHouseDto) {
    const houseJob = await this._db.houseJob.findUnique({
      where: { HouseJobSid: payload.HouseJobSid },
      select: {
        HouseJobSid: true,
        MasterJobSid: true,
        CompanyMasterSid: true,
        BranchMasterSid: true,
        HBLNo: true,
        ShipmentNo: true,
      },
    });

    if (!houseJob) {
      throw new Error('House Job not found');
    }

    if (
      houseJob.CompanyMasterSid == null ||
      houseJob.BranchMasterSid == null ||
      houseJob.MasterJobSid == null
    ) {
      throw new Error('House Job is missing company, branch, or master job details');
    }

    const proRateData = await this.buildProRateResponse(
      {
        CompanyMasterSid: houseJob.CompanyMasterSid,
        BranchMasterSid: houseJob.BranchMasterSid,
        MasterJobSid: houseJob.MasterJobSid,
      },
      houseJob.HouseJobSid,
    );

    return (
      proRateData.houses[0] || {
        houseJob: {
          HouseJobSid: houseJob.HouseJobSid,
          HBLNo: houseJob.HBLNo,
          ShipmentNo: houseJob.ShipmentNo,
        },
        proratedCharges: [],
      }
    );
  }

  async getHouseProrateStatus(payload: ProRateHouseDto) {
    const houseJob = await this._db.houseJob.findUnique({
      where: { HouseJobSid: payload.HouseJobSid },
      select: {
        HouseJobSid: true,
        MasterJobSid: true,
        masterJob: {
          select: {
            others: {
              where: { Status: 'A' },
              select: {
                JobtoSubjob: true,
              },
              take: 1,
            },
          },
        },
      },
    });

    if (!houseJob) {
      throw new Error('House Job not found');
    }

    return {
      HouseJobSid: houseJob.HouseJobSid,
      MasterJobSid: houseJob.MasterJobSid,
      JobtoSubjob: houseJob.masterJob?.others?.[0]?.JobtoSubjob || 'N',
    };
  }

  private async buildProRateResponse(
    payload: ProRateCalculateDto,
    selectedHouseJobSid?: number,
  ) {
    const { CompanyMasterSid, BranchMasterSid, MasterJobSid } = payload;
    const warnings: string[] = [];

    const masterJob = await this._db.masterJob.findUnique({
      where: { MasterJobSid },
      include: {
        containers: {
          where: { Status: 'A' },
          include: { containerType: true },
        },
      },
    });

    if (!masterJob) {
      throw new Error('Master Job not found');
    }

    if (
      masterJob.CompanyMasterSid !== CompanyMasterSid ||
      masterJob.BranchMasterSid !== BranchMasterSid
    ) {
      throw new Error('Master Job does not belong to the selected company and branch');
    }

    const department = await this._db.departmentMaster.findUnique({
      where: { DepartmentMasterSid: masterJob.DepartmentMasterSid },
    });

    if (!department) {
      throw new Error('Department not found');
    }

    const masterJobOthers = await this._db.masterJobOthers.findFirst({
      where: {
        MasterJobSid,
        Status: 'A',
      },
      select: {
        JobtoSubjob: true,
      },
    });

    const isAir = department.departmentType?.toUpperCase() === 'AIR';
    const masterMenuSid = await this.menuService.getMenuSidByName(
      isAir ? 'Master Air Waybill' : 'Master Job',
    );
    const houseMenuSid = await this.menuService.getMenuSidByName(
      isAir ? 'House Air Waybill' : 'House Job',
    );

    const houseJobs = await this._db.houseJob.findMany({
      where: {
        MasterJobSid,
        status: 'A',
        CompanyMasterSid,
        BranchMasterSid,
      },
      include: {
        Cargo: { where: { status: 'A' } },
      },
    });

    if (
      selectedHouseJobSid &&
      !houseJobs.some((house) => house.HouseJobSid === selectedHouseJobSid)
    ) {
      throw new Error('House Job not found for this master job');
    }

    const containers = masterJob.containers.map((container) => ({
      ContainerNumber: container.ContainerNumber,
      containerTypeName: container.containerType?.ContainerName || '',
      GrossWeight: toNumber(container.GrossWeight),
      Volume: toNumber(container.Volume),
    }));

    if (houseJobs.length === 0) {
      warnings.push('No active house jobs found for this master job');
      return {
        masterJob: {
          MasterJobSid: masterJob.MasterJobSid,
          MasterJobNumber: masterJob.MasterJobNumber,
          MasterJobDate: masterJob.MasterJobDate,
          JobStatus: masterJob.JobStatus,
          JobtoSubjob: masterJobOthers?.JobtoSubjob || 'N',
          department: {
            departmentName: department.departmentName,
            departmentType: department.departmentType,
          },
        },
        containers,
        totalHouses: 0,
        masterCharges: [],
        houses: [],
        currencies: [],
        warnings,
      };
    }

    const houseCargoMap = new Map<number, CargoAgg>();
    for (const house of houseJobs) {
      const aggregate: CargoAgg = {
        totalPkg: 0,
        grossWeight: 0,
        netWeight: 0,
        cbm: 0,
        chargeableWeight: 0,
        noOfContainers: 0,
      };

      for (const cargo of house.Cargo) {
        aggregate.totalPkg += toNumber(cargo.NoOfPackage);
        aggregate.grossWeight += toNumber(cargo.GrossWeight);
        aggregate.netWeight += toNumber(cargo.NetWeight);
        aggregate.cbm += toNumber(cargo.Volume);
        aggregate.chargeableWeight += toNumber(cargo.ChargeableWeight);
        aggregate.noOfContainers += toNumber(cargo.NoofContainers);
      }

      houseCargoMap.set(house.HouseJobSid, aggregate);
    }

    const masterCharges = await this._db.costRevenueCharges.findMany({
      where: {
        TransactionSid: MasterJobSid,
        MenuMasterSid: masterMenuSid,
        CompanyMasterSid,
        BranchMasterSid,
        status: 'A',
      },
      include: {
        chargeMaster: true,
        costCurrencyMaster: true,
        revenueCurrencyMaster: true,
        costVoucherHeader: true,
        revenueVoucherHeader: true,
        costChargeUOMMaster: true,
        revenueChargeUOMMaster: true,
      },
      orderBy: { SerialNumber: 'asc' },
    });

    const houseJobSids = houseJobs.map((house) => house.HouseJobSid);
    const houseChargesAll = await this._db.costRevenueCharges.findMany({
      where: {
        TransactionSid: { in: houseJobSids },
        MenuMasterSid: houseMenuSid,
        CompanyMasterSid,
        BranchMasterSid,
        status: 'A',
      },
      include: {
        chargeMaster: true,
        costCurrencyMaster: true,
        revenueCurrencyMaster: true,
        costChargeUOMMaster: true,
        revenueChargeUOMMaster: true,
      },
      orderBy: { SerialNumber: 'asc' },
    });

    const houseChargesMap = new Map<number, any[]>();
    for (const charge of houseChargesAll) {
      const sid = charge.TransactionSid;
      if (sid == null) {
        continue;
      }

      if (!houseChargesMap.has(sid)) {
        houseChargesMap.set(sid, []);
      }

      houseChargesMap.get(sid)!.push(charge);
    }

    const currencySet = new Map<
      number,
      { CurrencyMasterSid: number; currencyCode: string; amountDecimal: number }
    >();

    const addCurrency = (
      currencyMasterSid: number | null | undefined,
      currency: { currencyCode: string; amountDecimal: number } | null | undefined,
    ) => {
      if (!currencyMasterSid || !currency) {
        return;
      }

      currencySet.set(currencyMasterSid, {
        CurrencyMasterSid: currencyMasterSid,
        currencyCode: currency.currencyCode,
        amountDecimal: currency.amountDecimal,
      });
    };

    for (const masterCharge of masterCharges) {
      addCurrency(
        masterCharge.CostCurrencyMasterSid,
        masterCharge.costCurrencyMaster,
      );
      addCurrency(
        masterCharge.RevenueCurrencyMasterSid,
        masterCharge.revenueCurrencyMaster,
      );
    }

    for (const houseCharge of houseChargesAll) {
      addCurrency(
        houseCharge.CostCurrencyMasterSid,
        houseCharge.costCurrencyMaster,
      );
      addCurrency(
        houseCharge.RevenueCurrencyMasterSid,
        houseCharge.revenueCurrencyMaster,
      );
    }

    const houses = houseJobs.map((house) => ({
      houseJob: {
        HouseJobSid: house.HouseJobSid,
        HBLNo: house.HBLNo,
        ShipmentNo: house.ShipmentNo,
      },
      cargo: houseCargoMap.get(house.HouseJobSid),
      existingCharges: houseChargesMap.get(house.HouseJobSid) || [],
      proratedCharges: [] as ProRateChargeRow[],
    }));

    const defaultCargo: CargoAgg = {
      totalPkg: 0,
      grossWeight: 0,
      netWeight: 0,
      cbm: 0,
      chargeableWeight: 0,
      noOfContainers: 0,
    };

    for (const masterCharge of masterCharges) {
      if (!masterCharge.chargeMaster) {
        warnings.push(
          `Charge SID ${masterCharge.CostRevenueChargesSid} has no ChargeMaster - skipped proration`,
        );
        continue;
      }

      const unitQty = masterCharge.chargeMaster.UnitQty || 'Per Shipment';
      const costDecimal = masterCharge.costCurrencyMaster?.amountDecimal ?? 2;
      const revenueDecimal = masterCharge.revenueCurrencyMaster?.amountDecimal ?? 2;
      const basisValues = houses.map((house) => ({
        house,
        basis: this.getHouseBasisValue(house.cargo || defaultCargo, unitQty),
      }));
      const totalBasis = basisValues.reduce((sum, current) => sum + current.basis, 0);

      if (totalBasis === 0) {
        warnings.push(
          `Charge "${masterCharge.chargeMaster.chargeName}" (${unitQty}): total basis is 0 - skipped`,
        );
        continue;
      }

      const masterCostAmount = toNumber(masterCharge.CostAmount);
      const masterCostLocalAmount = toNumber(masterCharge.CostLocalAmount);
      const masterRevenueAmount = toNumber(masterCharge.RevenueAmount);
      const masterRevenueLocalAmount = toNumber(masterCharge.RevenueLocalAmount);

      let sumCostAmount = 0;
      let sumCostLocalAmount = 0;
      let sumRevenueAmount = 0;
      let sumRevenueLocalAmount = 0;

      for (let index = 0; index < basisValues.length; index++) {
        const { house, basis } = basisValues[index];
        const isLast = index === basisValues.length - 1;

        let costAmount: number;
        let costLocalAmount: number;
        let revenueAmount: number;
        let revenueLocalAmount: number;

        if (isLast) {
          costAmount = roundAmount(masterCostAmount - sumCostAmount, costDecimal);
          costLocalAmount = roundAmount(
            masterCostLocalAmount - sumCostLocalAmount,
            costDecimal,
          );
          revenueAmount = roundAmount(
            masterRevenueAmount - sumRevenueAmount,
            revenueDecimal,
          );
          revenueLocalAmount = roundAmount(
            masterRevenueLocalAmount - sumRevenueLocalAmount,
            revenueDecimal,
          );
        } else {
          const proportion = basis / totalBasis;
          costAmount = roundAmount(masterCostAmount * proportion, costDecimal);
          costLocalAmount = roundAmount(
            masterCostLocalAmount * proportion,
            costDecimal,
          );
          revenueAmount = roundAmount(
            masterRevenueAmount * proportion,
            revenueDecimal,
          );
          revenueLocalAmount = roundAmount(
            masterRevenueLocalAmount * proportion,
            revenueDecimal,
          );

          sumCostAmount += costAmount;
          sumCostLocalAmount += costLocalAmount;
          sumRevenueAmount += revenueAmount;
          sumRevenueLocalAmount += revenueLocalAmount;
        }

        house.proratedCharges.push({
          chargeMasterSid: masterCharge.ChargeMasterSid,
          chargeCode: masterCharge.chargeMaster.chargeCode,
          chargeName: masterCharge.chargeMaster.chargeName,
          unitQty,
          noOfUnit: basis,
          costCurrencyMasterSid: masterCharge.CostCurrencyMasterSid,
          costCurrencyCode: masterCharge.costCurrencyMaster?.currencyCode || '',
          costRate: toNumber(masterCharge.CostRate),
          costAmount,
          costLocalAmount,
          costExchangeRate: toNumber(masterCharge.CostExchangeRate),
          costDrCr: masterCharge.CostDrCr,
          revenueCurrencyMasterSid: masterCharge.RevenueCurrencyMasterSid,
          revenueCurrencyCode:
            masterCharge.revenueCurrencyMaster?.currencyCode || '',
          revenueRate: toNumber(masterCharge.RevenueRate),
          revenueAmount,
          revenueLocalAmount,
          revenueExchangeRate: toNumber(masterCharge.RevenueExchangeRate),
          revenueDrCr: masterCharge.RevenueDrCr,
        });
      }
    }

    const outputHouses = selectedHouseJobSid
      ? houses.filter((house) => house.houseJob.HouseJobSid === selectedHouseJobSid)
      : houses;

    return {
      masterJob: {
        MasterJobSid: masterJob.MasterJobSid,
        MasterJobNumber: masterJob.MasterJobNumber,
        MasterJobDate: masterJob.MasterJobDate,
        JobStatus: masterJob.JobStatus,
        JobtoSubjob: masterJobOthers?.JobtoSubjob || 'N',
        department: {
          departmentName: department.departmentName,
          departmentType: department.departmentType,
        },
      },
      containers,
      totalHouses: houseJobs.length,
      masterCharges,
      houses: outputHouses,
      currencies: Array.from(currencySet.values()),
      warnings,
    };
  }

  private getHouseBasisValue(cargoAgg: CargoAgg, unitQty: string): number {
    switch (unitQty) {
      case 'Per Shipment':
      case 'Per BL':
        return 1;
      case 'Per CBM':
        return cargoAgg.cbm;
      case 'Per GrossWeight':
        return cargoAgg.grossWeight;
      case 'Per Cont':
        return cargoAgg.noOfContainers;
      case 'ChargeableWeight':
        return cargoAgg.chargeableWeight;
      default:
        return 1;
    }
  }
}
