import { Injectable, Logger } from '@nestjs/common';
import { DatabaseService } from 'src/database/database.service';
import { MenuService } from 'src/masters/services/menu/menu.service';
import { toNumber, roundAmount } from 'src/common/helper';
import { ProRateCalculateDto } from '../../DTO/pro-rate.dto';

interface CargoAgg {
  totalPkg: number;
  grossWeight: number;
  netWeight: number;
  cbm: number;
  chargeableWeight: number;
  noOfContainers: number;
}

@Injectable()
export class ProRateService {
  private readonly logger = new Logger(ProRateService.name);

  constructor(
    private readonly _db: DatabaseService,
    private readonly menuService: MenuService,
  ) {}

  async calculateProRate(payload: ProRateCalculateDto) {
    const { CompanyMasterSid, BranchMasterSid, MasterJobSid } = payload;
    const warnings: string[] = [];

    // 1. Fetch MasterJob with containers
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

    // 2. Fetch DepartmentMaster
    const department = await this._db.departmentMaster.findUnique({
      where: { DepartmentMasterSid: masterJob.DepartmentMasterSid },
    });

    if (!department) {
      throw new Error('Department not found');
    }

    // 3. Resolve MenuMasterSids
    const isAir = department.departmentType?.toUpperCase() === 'AIR';
    const masterMenuSid = await this.menuService.getMenuSidByName(
      isAir ? 'Master Air Waybill' : 'Master Job',
    );
    const houseMenuSid = await this.menuService.getMenuSidByName(
      isAir ? 'House Air Waybill' : 'House Job',
    );

    // 4. Fetch HouseJobs with Cargo
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

    if (houseJobs.length === 0) {
      warnings.push('No active house jobs found for this master job');
      return {
        masterJob: {
          MasterJobSid: masterJob.MasterJobSid,
          MasterJobNumber: masterJob.MasterJobNumber,
          MasterJobDate: masterJob.MasterJobDate,
          JobStatus: masterJob.JobStatus,
          department: {
            departmentName: department.departmentName,
            departmentType: department.departmentType,
          },
        },
        containers: masterJob.containers.map((c) => ({
          ContainerNumber: c.ContainerNumber,
          containerTypeName: c.containerType?.ContainerName || '',
          GrossWeight: toNumber(c.GrossWeight),
          Volume: toNumber(c.Volume),
        })),
        totalHouses: 0,
        masterCharges: [],
        houses: [],
        currencies: [],
        warnings,
      };
    }

    // 5. Aggregate cargo per house
    const houseCargoMap = new Map<number, CargoAgg>();
    for (const house of houseJobs) {
      const agg: CargoAgg = {
        totalPkg: 0,
        grossWeight: 0,
        netWeight: 0,
        cbm: 0,
        chargeableWeight: 0,
        noOfContainers: 0,
      };
      for (const cargo of house.Cargo) {
        agg.totalPkg += toNumber(cargo.NoOfPackage);
        agg.grossWeight += toNumber(cargo.GrossWeight);
        agg.netWeight += toNumber(cargo.NetWeight);
        agg.cbm += toNumber(cargo.Volume);
        agg.chargeableWeight += toNumber(cargo.ChargeableWeight);
        agg.noOfContainers += toNumber(cargo.NoofContainers);
      }
      houseCargoMap.set(house.HouseJobSid, agg);
    }

    // 6. Fetch master-level CostRevenueCharges
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

    // 7. Fetch house-level CostRevenueCharges
    const houseJobSids = houseJobs.map((h) => h.HouseJobSid);
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

    // Group house charges by TransactionSid (HouseJobSid)
    const houseChargesMap = new Map<number, any[]>();
    for (const charge of houseChargesAll) {
      const sid = charge.TransactionSid;
      if (sid == null) continue;
      if (!houseChargesMap.has(sid)) {
        houseChargesMap.set(sid, []);
      }
      houseChargesMap.get(sid)!.push(charge);
    }

    // 8. Pro-rate algorithm
    const currencySet = new Map<number, { CurrencyMasterSid: number; currencyCode: string; amountDecimal: number }>();

    const houses = houseJobs.map((house) => {
      const cargo = houseCargoMap.get(house.HouseJobSid);
      return {
        houseJob: {
          HouseJobSid: house.HouseJobSid,
          HBLNo: house.HBLNo,
          ShipmentNo: house.ShipmentNo,
        },
        cargo,
        existingCharges: houseChargesMap.get(house.HouseJobSid) || [],
        proratedCharges: [] as any[],
      };
    });

    for (const masterCharge of masterCharges) {
      if (!masterCharge.chargeMaster) {
        warnings.push(
          `Charge SID ${masterCharge.CostRevenueChargesSid} has no ChargeMaster — skipped proration`,
        );
        continue;
      }

      const unitQty = masterCharge.chargeMaster.UnitQty || 'Per Shipment';
      const costDecimal = masterCharge.costCurrencyMaster?.amountDecimal ?? 2;
      const revenueDecimal = masterCharge.revenueCurrencyMaster?.amountDecimal ?? 2;

      // Collect currencies
      if (masterCharge.CostCurrencyMasterSid && masterCharge.costCurrencyMaster) {
        currencySet.set(masterCharge.CostCurrencyMasterSid, {
          CurrencyMasterSid: masterCharge.CostCurrencyMasterSid,
          currencyCode: masterCharge.costCurrencyMaster.currencyCode,
          amountDecimal: costDecimal,
        });
      }
      if (masterCharge.RevenueCurrencyMasterSid && masterCharge.revenueCurrencyMaster) {
        currencySet.set(masterCharge.RevenueCurrencyMasterSid, {
          CurrencyMasterSid: masterCharge.RevenueCurrencyMasterSid,
          currencyCode: masterCharge.revenueCurrencyMaster.currencyCode,
          amountDecimal: revenueDecimal,
        });
      }

      // Get basis values for each house
      const defaultCargo: CargoAgg = { totalPkg: 0, grossWeight: 0, netWeight: 0, cbm: 0, chargeableWeight: 0, noOfContainers: 0 };
      const basisValues = houses.map((h) => ({
        house: h,
        basis: this.getHouseBasisValue(h.cargo || defaultCargo, unitQty),
      }));

      const totalBasis = basisValues.reduce((sum, b) => sum + b.basis, 0);

      if (totalBasis === 0) {
        warnings.push(
          `Charge "${masterCharge.chargeMaster.chargeName}" (${unitQty}): total basis is 0 — skipped`,
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

      for (let i = 0; i < basisValues.length; i++) {
        const { house, basis } = basisValues[i];
        const isLast = i === basisValues.length - 1;

        let costAmount: number;
        let costLocalAmount: number;
        let revenueAmount: number;
        let revenueLocalAmount: number;

        if (isLast) {
          // Last house absorbs remainder
          costAmount = roundAmount(masterCostAmount - sumCostAmount, costDecimal);
          costLocalAmount = roundAmount(masterCostLocalAmount - sumCostLocalAmount, costDecimal);
          revenueAmount = roundAmount(masterRevenueAmount - sumRevenueAmount, revenueDecimal);
          revenueLocalAmount = roundAmount(masterRevenueLocalAmount - sumRevenueLocalAmount, revenueDecimal);
        } else {
          const proportion = basis / totalBasis;
          costAmount = roundAmount(masterCostAmount * proportion, costDecimal);
          costLocalAmount = roundAmount(masterCostLocalAmount * proportion, costDecimal);
          revenueAmount = roundAmount(masterRevenueAmount * proportion, revenueDecimal);
          revenueLocalAmount = roundAmount(masterRevenueLocalAmount * proportion, revenueDecimal);

          sumCostAmount += costAmount;
          sumCostLocalAmount += costLocalAmount;
          sumRevenueAmount += revenueAmount;
          sumRevenueLocalAmount += revenueLocalAmount;
        }

        house.proratedCharges.push({
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
          revenueCurrencyCode: masterCharge.revenueCurrencyMaster?.currencyCode || '',
          revenueRate: toNumber(masterCharge.RevenueRate),
          revenueAmount,
          revenueLocalAmount,
          revenueExchangeRate: toNumber(masterCharge.RevenueExchangeRate),
          revenueDrCr: masterCharge.RevenueDrCr,
        });
      }
    }

    return {
      masterJob: {
        MasterJobSid: masterJob.MasterJobSid,
        MasterJobNumber: masterJob.MasterJobNumber,
        MasterJobDate: masterJob.MasterJobDate,
        JobStatus: masterJob.JobStatus,
        department: {
          departmentName: department.departmentName,
          departmentType: department.departmentType,
        },
      },
      containers: masterJob.containers.map((c) => ({
        ContainerNumber: c.ContainerNumber,
        containerTypeName: c.containerType?.ContainerName || '',
        GrossWeight: toNumber(c.GrossWeight),
        Volume: toNumber(c.Volume),
      })),
      totalHouses: houseJobs.length,
      masterCharges,
      houses,
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
