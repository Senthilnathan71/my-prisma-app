import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { DatabaseService } from 'src/database/database.service';
import * as moment from 'moment-timezone';

@Injectable()
export class EDIManifestService {
  constructor(
    private _db: DatabaseService,
    private logger: Logger,
  ) {}

  /**
   * Generate EDI Manifest for Master Job
   */
  async generateMasterJobManifest(masterJobSid: number): Promise<string> {
    const masterJob = await this._db.masterJob.findUnique({
      where: { MasterJobSid: masterJobSid, Status: 'A' },
      include: {
        voyages: { where: { Status: 'A' } },
        containers: { where: { Status: 'A' } },
        others: { where: { Status: 'A' } },
        houseJob: {
          where: { status: 'A' },
          include: {
            Cargo: { where: { status: 'A' } },
            Products: { where: { status: 'A' } },
            Others: { where: { status: 'A' } },
            houseJobCustoms: { where: { Status: 'A' } },
          },
        },
      },
    });

    if (!masterJob) {
      throw new NotFoundException(`Master Job with ID ${masterJobSid} not found`);
    }

    return this.generateManifestText(masterJob);
  }

  /**
   * Generate EDI Manifest for House Job
   */
  async generateHouseJobManifest(houseJobSid: number): Promise<string> {
    const houseJob = await this._db.houseJob.findUnique({
      where: { HouseJobSid: houseJobSid, status: 'A' },
      include: {
        Cargo: { where: { status: 'A' } },
        Products: { where: { status: 'A' } },
        Others: { where: { status: 'A' } },
        houseJobCustoms: { where: { Status: 'A' } },
        masterJob: {
          where: { Status: 'A' },
          include: {
            voyages: { where: { Status: 'A' } },
            containers: { where: { Status: 'A' } },
          },
        },
      },
    });

    if (!houseJob) {
      throw new NotFoundException(`House Job with ID ${houseJobSid} not found`);
    }

    // Create a master job structure with single house job
    const masterJobData = {
      ...houseJob.masterJob,
      houseJob: [houseJob],
    };

    return this.generateManifestText(masterJobData);
  }

  /**
   * Generate complete manifest text from master job data
   */
  private generateManifestText(masterJob: any): string {
    const lines: string[] = [];

    // VOY Record - Voyage Details
    lines.push(this.generateVOYRecord(masterJob));

    // BOL, CTR, CON Records for each House Job
    for (const houseJob of masterJob.houseJob || []) {
      // BOL Record - Bill of Lading
      lines.push(this.generateBOLRecord(masterJob, houseJob));

      // CTR Records - Container Details (if containerized)
      if (this.isContainerized(houseJob)) {
        const ctrRecords = this.generateCTRRecords(masterJob, houseJob);
        lines.push(...ctrRecords);
      }

      // CON Records - Consignment Details
      const conRecords = this.generateCONRecords(houseJob);
      lines.push(...conRecords);
    }

    // END Record - Summary
    lines.push(this.generateENDRecord(masterJob));

    return lines.join('\n');
  }

  /**
   * Generate VOY Record (Voyage Details)
   * Format: "VOY","LineCode","AgentCode","VesselName","VoyageNo","PortCode","ETADate","RotationNo","MessageType","InstallmentNo"
   */
  private generateVOYRecord(masterJob: any): string {
    const voyage = masterJob.voyages?.[0] || {};
    const houseJob = masterJob.houseJob?.[0] || {};
    const customs = houseJob.houseJobCustoms?.[0] || {};

    const fields = [
      'VOY',
      this.escapeField(customs.LineCode || 'FRX'),
      this.escapeField(customs.VoyageAgentCode || 'M0001'),
      this.escapeField(voyage.VesselName || masterJob.VesselName || ''),
      this.escapeField(voyage.VoyageNo || masterJob.VoyageNo || ''),
      this.escapeField(masterJob.POD || ''),
      this.formatDate(voyage.ETA || masterJob.ETA),
      this.escapeField(customs.RotationNumber || ''),
      this.escapeField('MFI'),
      this.escapeField('1'),
    ];

    return fields.map(f => `"${f}"`).join(',');
  }

  /**
   * Generate BOL Record (Bill of Lading)
   * Format: "BOL","BLNo","LineCode","AgentCode","OriginPort","LoadPort","DischargePort","DestPort","LoadDate",
   *         "ManifestRegNo","TradeCode","TransMode","BLOwner","BLOwnerAddress","CargoCode",
   *         "ConsolidatedIndicator","StorageRequest","ServiceType","CountryOrigin","OrigConsigneeName",
   *         "OrigConsigneeAddr","OrigVessel","OrigVoyage","OrigBLNo","OrigShipperName","OrigShipperAddr",
   *         "ShipperName","ShipperAddress","ShipperCountry","ConsigneeCode","ConsigneeName","ConsigneeAddress",
   *         "Notify1Code","Notify1Name","Notify1Address","Notify2Code","Notify2Name","Notify2Address",
   *         "Notify3Code","Notify3Name","Notify3Address","MarksNumbers","CommodityCode","CommodityDesc",
   *         "Packages","PackageType","PackageCode","ContainerNo","CheckDigit","NoContainers","NoTEUs",
   *         "TareWeight","CargoWeight","GrossWeight","Volume","TotalQty","FreightTonne","Pallets","SLACIndicator",
   *         "ContractCarriage","Remarks"
   */
  private generateBOLRecord(masterJob: any, houseJob: any): string {
    const cargo = houseJob.Cargo?.[0] || {};
    const others = houseJob.Others?.[0] || {};
    const customs = houseJob.houseJobCustoms?.[0] || {};
    const voyage = masterJob.voyages?.[0] || {};

    const fields = [
      'BOL',
      this.escapeField(houseJob.HBLNo || masterJob.MBLNo || ''),
      this.escapeField(customs.LineCode || 'FRX'),
      this.escapeField(customs.VoyageAgentCode || 'M0001'),
      this.escapeField(houseJob.POO || masterJob.POO || ''),
      this.escapeField(houseJob.POL || masterJob.POL || ''),
      this.escapeField(houseJob.POD || masterJob.POD || ''),
      this.escapeField(houseJob.FPD || masterJob.FPD || ''),
      this.formatDate(voyage.ETD || houseJob.ETD),
      this.escapeField(''),
      this.escapeField('I'),
      this.escapeField(''),
      this.escapeField(''),
      this.escapeField(''),
      this.escapeField(customs.CargoCode || this.getCargoCode(cargo)),
      this.escapeField('N'),
      this.escapeField(customs.StorageRequest || ''),
      this.escapeField(cargo.CargoType || 'FCL/FCL'),
      this.escapeField(houseJob.CountryOfOrigin || 'QA'),
      this.escapeField(''),
      this.escapeField(''),
      this.escapeField(''),
      this.escapeField(''),
      this.escapeField(''),
      this.escapeField(''),
      this.escapeField(''),
      this.escapeField(houseJob.ShipperName || ''),
      this.escapeField(houseJob.ShipperAddress || ''),
      this.escapeField(''),
      this.escapeField(customs.ImporterCode || ''),
      this.escapeField(houseJob.ConsigneeName || ''),
      this.escapeField(houseJob.ConsigneeAddress || ''),
      this.escapeField(''),
      this.escapeField(houseJob.Notify || others.NotifyParty || ''),
      this.escapeField(houseJob.NotifyAddress || others.NotifyPartyAddress || ''),
      this.escapeField(''),
      this.escapeField(''),
      this.escapeField(''),
      this.escapeField(''),
      this.escapeField(''),
      this.escapeField(''),
      this.escapeField(cargo.MarksAndNumber || 'n/m'),
      this.escapeField(''),
      this.escapeField(cargo.CommodityDescription || 'GENERAL CARGO'),
      this.escapeField(cargo.NoOfPackage?.toString() || '1'),
      this.escapeField(this.getPackageTypeName(cargo.PackageType)),
      this.escapeField(customs.PackageTypeCode || 'CTN'),
      this.escapeField(''),
      this.escapeField(''),
      this.escapeField(cargo.NoofContainers?.toString() || '0'),
      this.escapeField('0'),
      this.escapeField('0'),
      this.escapeField(cargo.GrossWeight?.toString() || '0'),
      this.escapeField(cargo.GrossWeight?.toString() || '0'),
      this.escapeField(cargo.Volume?.toString() || '0'),
      this.escapeField('0'),
      this.escapeField(customs.FreightTonne?.toString() || '0'),
      this.escapeField(customs.NoOfPallets?.toString() || '0'),
      this.escapeField(customs.SLACIndicator || ''),
      this.escapeField(''),
      this.escapeField(''),
    ];

    return fields.map(f => `"${f}"`).join(',');
  }

  /**
   * Generate CTR Records (Container Details)
   * Format: "CTR","ContainerNo","CheckDigit","TareWeight","SealNo"
   */
  private generateCTRRecords(masterJob: any, houseJob: any): string[] {
    const records: string[] = [];
    const containers = masterJob.containers || [];

    // If no master containers, check house job products for container numbers
    if (containers.length === 0) {
      const products = houseJob.Products || [];
      for (const product of products) {
        if (product.ContainerNo) {
          const fields = [
            'CTR',
            this.escapeField(product.ContainerNo),
            this.escapeField('0'),
            this.escapeField('0'),
            this.escapeField('NA'),
          ];
          records.push(fields.map(f => `"${f}"`).join(','));
        }
      }
    } else {
      for (const container of containers) {
        const fields = [
          'CTR',
          this.escapeField(container.ContainerNo || ''),
          this.escapeField('0'),
          this.escapeField(container.TareWeight?.toString() || '0'),
          this.escapeField(container.SealNo || 'NA'),
        ];
        records.push(fields.map(f => `"${f}"`).join(','));
      }
    }

    return records;
  }

  /**
   * Generate CON Records (Consignment Details)
   * Format: "CON","SerialNo","MarksNumbers","CargoDesc","UsedNew","CommodityCode","Packages",
   *         "PackageType","PackageCode","Pallets","Weight","Volume","DGIndicator","IMOClass","UNNumber",
   *         "FlashPoint","TempUnit","DGStorage","RefRequired","MinTemp","MaxTemp","RefTempUnit"
   */
  private generateCONRecords(houseJob: any): string[] {
    const records: string[] = [];
    const customs = houseJob.houseJobCustoms || [];
    const cargo = houseJob.Cargo?.[0] || {};
    const product = houseJob.Products?.[0] || {};

    if (customs.length > 0) {
      // Use customs data
      for (const cust of customs) {
        const fields = [
          'CON',
          this.escapeField(cust.SerialNumber?.toString() || '1'),
          this.escapeField(cargo.MarksAndNumber || 'n/m'),
          this.escapeField(cargo.CommodityDescription || 'GENERAL CARGO'),
          this.escapeField(cust.UsedOrNew || 'N'),
          this.escapeField(cust.UNHSCode || product.HSCode || ''),
          this.escapeField(cargo.NoOfPackage?.toString() || '1'),
          this.escapeField(this.getPackageTypeName(cargo.PackageType)),
          this.escapeField(cust.PackageTypeCode || 'CTN'),
          this.escapeField(cust.NoOfPallets?.toString() || '0'),
          this.escapeField(cargo.GrossWeight?.toString() || '0'),
          this.escapeField(cargo.Volume?.toString() || '0'),
          this.escapeField(cust.UNNumber ? 'Y' : 'N'),
          this.escapeField(''),
          this.escapeField(cust.UNNumber || ''),
          this.escapeField(cust.FlashPoints?.toString() || '0'),
          this.escapeField(cust.TemperatureUnit || ''),
          this.escapeField(cust.HazStorageRequest || ''),
          this.escapeField(cust.RefrigerationRequired || 'N'),
          this.escapeField(cust.MinTemperature?.toString() || '0'),
          this.escapeField(cust.MaxTemperature?.toString() || '0'),
          this.escapeField(cust.RefTemperatureUnit || ''),
        ];
        records.push(fields.map(f => `"${f}"`).join(','));
      }
    } else {
      // Generate default CON record from cargo data
      const fields = [
        'CON',
        this.escapeField('1'),
        this.escapeField(cargo.MarksAndNumber || 'n/m'),
        this.escapeField(cargo.CommodityDescription || 'GENERAL CARGO'),
        this.escapeField('N'),
        this.escapeField(product.HSCode || '770000'),
        this.escapeField(cargo.NoOfPackage?.toString() || '1'),
        this.escapeField(this.getPackageTypeName(cargo.PackageType)),
        this.escapeField('CTN'),
        this.escapeField('1'),
        this.escapeField(cargo.GrossWeight?.toString() || '0'),
        this.escapeField(cargo.Volume?.toString() || '0'),
        this.escapeField('N'),
        this.escapeField(''),
        this.escapeField(''),
        this.escapeField('0'),
        this.escapeField(''),
        this.escapeField(''),
        this.escapeField('Y'),
        this.escapeField('0'),
        this.escapeField('0'),
        this.escapeField(''),
      ];
      records.push(fields.map(f => `"${f}"`).join(','));
    }

    return records;
  }

  /**
   * Generate END Record (Summary)
   * Format: "END","TotalBOLs","TotalOtherBOLs","Remarks"
   */
  private generateENDRecord(masterJob: any): string {
    const totalBOLs = masterJob.houseJob?.length || 0;
    const totalOtherBOLs = 0;

    const fields = [
      'END',
      this.escapeField(totalBOLs.toString()),
      this.escapeField(totalOtherBOLs.toString()),
      this.escapeField('Version no: 1,Product sr. no: DPAMAN/107'),
    ];

    return fields.map(f => `"${f}"`).join(',');
  }

  /**
   * Helper: Check if cargo is containerized
   */
  private isContainerized(houseJob: any): boolean {
    const cargo = houseJob.Cargo?.[0];
    if (!cargo) return false;

    return (
      cargo.CargoType === 'FCL' ||
      cargo.CargoType === 'LCL' ||
      (cargo.NoofContainers && cargo.NoofContainers > 0) ||
      houseJob.Products?.some((p) => p.ContainerNo)
    );
  }

  /**
   * Helper: Get cargo code from cargo type
   */
  private getCargoCode(cargo: any): string {
    if (!cargo || !cargo.CargoType) return 'F';

    const type = cargo.CargoType.toUpperCase();
    if (type.includes('FCL')) return 'F';
    if (type.includes('LCL')) return 'L';
    if (type.includes('EMPTY')) return 'M';
    if (type.includes('BULK SOLID')) return 'B';
    if (type.includes('BULK LIQUID')) return 'Q';
    if (type.includes('RO-RO')) return 'R';
    if (type.includes('PASSENGER')) return 'P';
    if (type.includes('BREAK BULK')) return 'G';

    return 'F'; // Default to FCL
  }

  /**
   * Helper: Get package type name from package type ID
   */
  private getPackageTypeName(packageTypeId: any): string {
    // This should ideally fetch from package type master table
    // For now, return default
    if (!packageTypeId) return 'Cartons';
    return 'Cartons';
  }

  /**
   * Helper: Format date to DD-MMM-CCYY
   */
  private formatDate(date: any): string {
    if (!date) return '';
    return moment(date).format('DD-MMM-YYYY').toUpperCase();
  }

  /**
   * Helper: Escape field for CSV (handle commas, quotes)
   */
  private escapeField(value: any): string {
    if (value === null || value === undefined) return '';

    const strValue = value.toString();

    // Remove any existing quotes and escape internal quotes
    const cleaned = strValue.replace(/"/g, '""');

    return cleaned;
  }
}
