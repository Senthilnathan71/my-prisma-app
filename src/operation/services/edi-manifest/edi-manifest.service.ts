import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { DatabaseService } from 'src/database/database.service';
import * as moment from 'moment-timezone';

/**
 * Interface for tracking mandatory field validation errors
 */
export interface MandatoryFieldError {
  recordType: 'VOY' | 'BOL' | 'CON' | 'CTR';
  fieldRef: string;
  fieldName: string;
  tabName: string;
  houseJobSid?: number;
  hblNo?: string;
}

/**
 * Response structure for validation errors
 */
export interface EDIValidationResponse {
  isValid: boolean;
  errors: MandatoryFieldError[];
}

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
        houseJobCustoms: { where: { Status: 'A' } },
        voyages: { where: { Status: 'A' } },
        containers: { where: { Status: 'A' }, include: { containerType: true } },
        others: { where: { Status: 'A' } },
        CompanyMaster: { include: { countryMaster: true } },
        houseJob: {
          where: { status: 'A' },
          include: {
            Cargo: { where: { status: 'A' } },
            Products: { where: { status: 'A' } },
            Others: { where: { status: 'A' } },
            houseJobCustoms: { where: { Status: 'A' } },
            companyMaster: { include: { countryMaster: true } },
          },
        },
      },
    });

    if (!masterJob) {
      throw new NotFoundException(`Master Job with ID ${masterJobSid} not found`);
    }

    // Fetch port data for origin country
    const originPortCode = masterJob.POO;
    let originCountryCode = '';
    if (originPortCode) {
      const port = await this._db.portMaster.findFirst({
        where: { PortCode: originPortCode, status: 'A' },
        include: { countryMaster: true },
      });
      originCountryCode = port?.countryMaster?.countryCode || '';
    }

    // Validate mandatory fields before generating
    const validation = this.validateMandatoryFields(masterJob, originCountryCode);
    if (!validation.isValid) {
      throw new BadRequestException({
        message: 'Mandatory fields are missing. Please fill all required fields before generating EDI Manifest.',
        errors: validation.errors,
      });
    }

    return this.generateManifestText(masterJob, originCountryCode);
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
        companyMaster: { include: { countryMaster: true } },
        masterJob: {
          where: { Status: 'A' },
          include: {
            voyages: { where: { Status: 'A' } },
            containers: { where: { Status: 'A' }, include: { containerType: true } },
            CompanyMaster: { include: { countryMaster: true } },
          },
        },
      },
    });

    if (!houseJob) {
      throw new NotFoundException(`House Job with ID ${houseJobSid} not found`);
    }

    // Fetch port data for origin country
    const originPortCode = houseJob.POO || houseJob.masterJob?.POO;
    let originCountryCode = '';
    if (originPortCode) {
      const port = await this._db.portMaster.findFirst({
        where: { PortCode: originPortCode, status: 'A' },
        include: { countryMaster: true },
      });
      originCountryCode = port?.countryMaster?.countryCode || '';
    }

    // Create a master job structure with single house job
    const masterJobData = {
      ...houseJob.masterJob,
      houseJob: [houseJob],
    };

    // Validate mandatory fields before generating
    const validation = this.validateMandatoryFields(masterJobData, originCountryCode);
    if (!validation.isValid) {
      throw new BadRequestException({
        message: 'Mandatory fields are missing. Please fill all required fields before generating EDI Manifest.',
        errors: validation.errors,
      });
    }

    return this.generateManifestText(masterJobData, originCountryCode);
  }

  /**
   * Generate complete manifest text from master job data
   */
  private generateManifestText(masterJob: any, originCountryCode: string = ''): string {
    const lines: string[] = [];

    // VOY Record - Voyage Details
    lines.push(this.generateVOYRecord(masterJob));

    // BOL, CTR, CON Records for each House Job
    for (const houseJob of masterJob.houseJob || []) {
      // BOL Record - Bill of Lading
      lines.push(this.generateBOLRecord(masterJob, houseJob, originCountryCode));

      // CTR Records - Container Details (if containerized)
      if (this.isContainerized(masterJob, houseJob)) {
        const ctrRecords = this.generateCTRRecords(masterJob, houseJob);
        lines.push(...ctrRecords);
      }

      // CON Records - Consignment Details
      const conRecords = this.generateCONRecords(masterJob, houseJob);
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
    const customs = houseJob.houseJobCustoms?.[0] || masterJob.houseJobCustoms?.[0] || {};

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
  private generateBOLRecord(masterJob: any, houseJob: any, originCountryCode: string = ''): string {
    const cargo = houseJob.Cargo?.[0] || {};
    const others = houseJob.Others?.[0] || {};
    const customs = houseJob.houseJobCustoms?.[0] || masterJob.houseJobCustoms?.[0] || {};
    const voyage = masterJob.voyages?.[0] || {};

    // Fix 2.17: Use ShipmentTerms field instead of CargoType
    const shipmentTerms = cargo.ShipmentTerms || houseJob.ShipmentTerms || masterJob.ShipmentTerms || cargo.CargoType || 'FCL/FCL';

    // Fix 2.18: Get country of origin from origin port (passed as parameter)
    const countryOfOrigin = originCountryCode || '';

    // Fix 2.28: Get shipper country from company master
    const shipperCountryCode = houseJob.companyMaster?.countryMaster?.CountryCode ||
                               masterJob.CompanyMaster?.countryMaster?.CountryCode || '';

    // Fix 2.33 & 2.34: Get notify name and address with validation logging
    const notifyName = houseJob.Notify || others.NotifyParty || '';
    const notifyAddress = houseJob.NotifyAddress || others.NotifyPartyAddress || '';
    if (!notifyName) {
      this.logger.warn(`House Job ${houseJob.HouseJobSid}: Notify Name is mandatory but missing`);
    }
    if (!notifyAddress) {
      this.logger.warn(`House Job ${houseJob.HouseJobSid}: Notify Address is mandatory but missing`);
    }

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
      this.escapeField(shipmentTerms),                    // Fix 2.17: Shipment Terms
      this.escapeField(countryOfOrigin),                  // Fix 2.18: Country of Origin
      this.escapeField(''),
      this.escapeField(''),
      this.escapeField(''),
      this.escapeField(''),
      this.escapeField(''),
      this.escapeField(''),
      this.escapeField(''),
      this.escapeField(houseJob.ShipperName || ''),
      this.escapeField(houseJob.ShipperAddress || ''),
      this.escapeField(shipperCountryCode),               // Fix 2.28: Shipper Country Code
      this.escapeField(customs.ImporterCode || ''),
      this.escapeField(houseJob.ConsigneeName || ''),
      this.escapeField(houseJob.ConsigneeAddress || ''),
      this.escapeField(''),
      this.escapeField(notifyName),                       // Fix 2.33: Notify Name
      this.escapeField(notifyAddress),                    // Fix 2.34: Notify Address
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
    const processedContainers = new Set<string>();

    // Generate CTR records from master job containers (FCL and LCL)
    for (const container of containers) {
      const containerNo = container.ContainerNumber || '';
      if (containerNo && !processedContainers.has(containerNo)) {
        processedContainers.add(containerNo);
        const TareWeight = container.containerType?.TareWeight;
        const checkDigit = containerNo.slice(-1); // Last character is check digit
        const fields = [
          'CTR',
          this.escapeField(containerNo),
          this.escapeField(checkDigit),
          this.escapeField(TareWeight?.toString() || ''),
          this.escapeField(container.LineSeal || ''),
        ];
        records.push(fields.map(f => `"${f}"`).join(','));
      }
    }

    // Also get containers from house job products (for LCL shipments)
    const products = houseJob.Products || [];
    for (const product of products) {
      const containerNo = product.ContainerNo || '';
      if (containerNo && !processedContainers.has(containerNo)) {
        processedContainers.add(containerNo);
        const checkDigit = containerNo.slice(-1); // Last character is check digit
        const fields = [
          'CTR',
          this.escapeField(containerNo),
          this.escapeField(checkDigit),
          this.escapeField(product.TareWeight?.toString() || ''),
          this.escapeField(product.SealNo || ''),
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
  private generateCONRecords(masterJob: any, houseJob: any): string[] {
    const records: string[] = [];
    const customs = (houseJob.houseJobCustoms?.length ? houseJob.houseJobCustoms : masterJob.houseJobCustoms) || [];
    const cargo = houseJob.Cargo?.[0] || {};
    const product = houseJob.Products?.[0] || {};

    if (customs.length > 0) {
      // Use customs data
      for (const cust of customs) {
        // Fix 3.5: HS Code is mandatory - log warning if missing
        const hsCode = cust.UNHSCode || product.HSCode || '';
        if (!hsCode) {
          this.logger.warn(`House Job ${houseJob.HouseJobSid}: HS Code (Commodity Code) is mandatory but missing`);
        }

        // Fix 3.12 & 3.13: Dangerous Goods Indicator and IMO Class
        // Check both customs UNNumber and product IsHaz/UnNo
        const isDangerous = !!(cust.UNNumber || product.IsHaz === 'Y' || product.UnNo);
        const dgIndicator = isDangerous ? 'Y' : 'N';

        // Fix 3.13: IMO Class is mandatory when DG is Y - use product.ImcoClass
        const imoClass = isDangerous ? (product.ImcoClass || '') : '';
        if (isDangerous && !imoClass) {
          this.logger.warn(`House Job ${houseJob.HouseJobSid}: IMO Class is mandatory when Dangerous Goods is Y`);
        }

        const fields = [
          'CON',
          this.escapeField(cust.SerialNumber?.toString() || '1'),
          this.escapeField(cargo.MarksAndNumber || 'n/m'),
          this.escapeField(cargo.CommodityDescription || 'GENERAL CARGO'),
          this.escapeField(cust.UsedOrNew || 'N'),
          this.escapeField(hsCode),                            // Fix 3.5: HS Code
          this.escapeField(cargo.NoOfPackage?.toString() || '1'),
          this.escapeField(this.getPackageTypeName(cargo.PackageType)),
          this.escapeField(cust.PackageTypeCode || 'CTN'),
          this.escapeField(cust.NoOfPallets?.toString() || '0'),
          this.escapeField(cargo.GrossWeight?.toString() || '0'),
          this.escapeField(cargo.Volume?.toString() || '0'),
          this.escapeField(dgIndicator),                       // Fix 3.12: DG Indicator
          this.escapeField(imoClass),                          // Fix 3.13: IMO Class
          this.escapeField(cust.UNNumber || product.UnNo || ''),
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
      // Check product for dangerous goods info
      const isDangerous = !!(product.IsHaz === 'Y' || product.UnNo);
      const dgIndicator = isDangerous ? 'Y' : 'N';
      const imoClass = isDangerous ? (product.ImcoClass || '') : '';
      const hsCode = product.HSCode || '';

      if (!hsCode) {
        this.logger.warn(`House Job ${houseJob.HouseJobSid}: HS Code (Commodity Code) is mandatory but missing`);
      }

      const fields = [
        'CON',
        this.escapeField('1'),
        this.escapeField(cargo.MarksAndNumber || 'n/m'),
        this.escapeField(cargo.CommodityDescription || 'GENERAL CARGO'),
        this.escapeField('N'),
        this.escapeField(hsCode),                              // Fix 3.5: HS Code
        this.escapeField(cargo.NoOfPackage?.toString() || '1'),
        this.escapeField(this.getPackageTypeName(cargo.PackageType)),
        this.escapeField('CTN'),
        this.escapeField('1'),
        this.escapeField(cargo.GrossWeight?.toString() || '0'),
        this.escapeField(cargo.Volume?.toString() || '0'),
        this.escapeField(dgIndicator),                         // Fix 3.12: DG Indicator
        this.escapeField(imoClass),                            // Fix 3.13: IMO Class
        this.escapeField(product.UnNo || ''),
        this.escapeField('0'),
        this.escapeField(''),
        this.escapeField(''),
        this.escapeField('N'),
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
    ];

    return fields.map(f => `"${f}"`).join(',');
  }

  /**
   * Validate all mandatory fields before generating EDI Manifest
   * Returns validation result with list of missing mandatory fields
   */
  private validateMandatoryFields(masterJob: any, originCountryCode: string): EDIValidationResponse {
    const errors: MandatoryFieldError[] = [];

    // VOY Record Validation
    const voyErrors = this.validateVOYRecord(masterJob);
    errors.push(...voyErrors);

    // BOL, CON, CTR Record Validation for each House Job
    for (const houseJob of masterJob.houseJob || []) {
      const bolErrors = this.validateBOLRecord(masterJob, houseJob, originCountryCode);
      errors.push(...bolErrors);

      const conErrors = this.validateCONRecord(masterJob, houseJob);
      errors.push(...conErrors);

      // CTR validation only for containerized cargo
      if (this.isContainerized(masterJob, houseJob)) {
        const ctrErrors = this.validateCTRRecords(masterJob, houseJob);
        errors.push(...ctrErrors);
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Validate VOY Record mandatory fields
   */
  private validateVOYRecord(masterJob: any): MandatoryFieldError[] {
    const errors: MandatoryFieldError[] = [];
    const voyage = masterJob.voyages?.[0] || {};
    const houseJob = masterJob.houseJob?.[0] || {};
    const customs = houseJob.houseJobCustoms?.[0] || masterJob.houseJobCustoms?.[0] || {};

    // 1.1 LINE CODE (M)
    if (!customs.LineCode) {
      errors.push({ recordType: 'VOY', fieldRef: '1.1', fieldName: 'Line Code', tabName: 'Customs' });
    }

    // 1.2 VOYAGE AGENT CODE (M)
    if (!customs.VoyageAgentCode) {
      errors.push({ recordType: 'VOY', fieldRef: '1.2', fieldName: 'Voyage Agent Code', tabName: 'Customs' });
    }

    // 1.3 VESSEL NAME (M)
    if (!(voyage.VesselName || masterJob.VesselName)) {
      errors.push({ recordType: 'VOY', fieldRef: '1.3', fieldName: 'Vessel Name', tabName: 'Master' });
    }

    // 1.4 AGENT'S VOYAGE NUMBER (M)
    if (!(voyage.VoyageNo || masterJob.VoyageNo)) {
      errors.push({ recordType: 'VOY', fieldRef: '1.4', fieldName: 'Voyage Number', tabName: 'Master' });
    }

    // 1.5 PORT CODE OF DISCHARGE (M)
    if (!masterJob.POD) {
      errors.push({ recordType: 'VOY', fieldRef: '1.5', fieldName: 'Port of Discharge (POD)', tabName: 'Master' });
    }

    // 1.6 EXPECTED TO ARRIVE DATE (M)
    if (!(voyage.ETA || masterJob.ETA)) {
      errors.push({ recordType: 'VOY', fieldRef: '1.6', fieldName: 'Expected Arrival Date (ETA)', tabName: 'Master' });
    }

    // 1.10 AGENT'S MANIFEST SEQUENCE NUMBER (M)
    if (!customs.ManifestSequence) {
      errors.push({ recordType: 'VOY', fieldRef: '1.10', fieldName: 'Manifest Sequence Number', tabName: 'Customs' });
    }

    return errors;
  }

  /**
   * Validate BOL Record mandatory fields
   */
  private validateBOLRecord(masterJob: any, houseJob: any, originCountryCode: string): MandatoryFieldError[] {
    const errors: MandatoryFieldError[] = [];
    const cargo = houseJob.Cargo?.[0] || {};
    const others = houseJob.Others?.[0] || {};
    const customs = houseJob.houseJobCustoms?.[0] || masterJob.houseJobCustoms?.[0] || {};
    const hblNo = houseJob.HBLNo || masterJob.MBLNo || '';
    const houseJobSid = houseJob.HouseJobSid;

    // 2.1 BILL OF LADING NO (M)
    if (!(houseJob.HBLNo || masterJob.MBLNo)) {
      errors.push({ recordType: 'BOL', fieldRef: '2.1', fieldName: 'Bill of Lading Number', tabName: 'Shipment', houseJobSid, hblNo });
    }

    // 2.2 BOX/PARTNERING LINE CODE (M)
    if (!customs.LineCode) {
      errors.push({ recordType: 'BOL', fieldRef: '2.2', fieldName: 'Line Code', tabName: 'Customs', houseJobSid, hblNo });
    }

    // 2.3 BOX/PARTNERING AGENT CODE (M)
    if (!customs.VoyageAgentCode) {
      errors.push({ recordType: 'BOL', fieldRef: '2.3', fieldName: 'Voyage Agent Code', tabName: 'Customs', houseJobSid, hblNo });
    }

    // 2.4 PORT CODE OF ORIGIN (M)
    if (!(houseJob.POO || masterJob.POO)) {
      errors.push({ recordType: 'BOL', fieldRef: '2.4', fieldName: 'Port of Origin (POO)', tabName: 'Shipment', houseJobSid, hblNo });
    }

    // 2.5 PORT CODE OF LOADING (M)
    if (!(houseJob.POL || masterJob.POL)) {
      errors.push({ recordType: 'BOL', fieldRef: '2.5', fieldName: 'Port of Loading (POL)', tabName: 'Shipment', houseJobSid, hblNo });
    }

    // 2.6 PORT CODE OF DISCHARGE (M)
    if (!(houseJob.POD || masterJob.POD)) {
      errors.push({ recordType: 'BOL', fieldRef: '2.6', fieldName: 'Port of Discharge (POD)', tabName: 'Shipment', houseJobSid, hblNo });
    }

    // 2.7 PORT CODE OF DESTINATION (M)
    if (!(houseJob.FPD || masterJob.FPD)) {
      errors.push({ recordType: 'BOL', fieldRef: '2.7', fieldName: 'Final Place of Delivery (FPD)', tabName: 'Shipment', houseJobSid, hblNo });
    }

    // 2.14 CARGO CODE (M)
    if (!(customs.CargoCode || cargo.CargoType)) {
      errors.push({ recordType: 'BOL', fieldRef: '2.14', fieldName: 'Cargo Code', tabName: 'Cargo', houseJobSid, hblNo });
    }

    // 2.18 COUNTRY OF ORIGIN (M)
    if (!originCountryCode) {
      errors.push({ recordType: 'BOL', fieldRef: '2.18', fieldName: 'Country of Origin', tabName: 'Shipment', houseJobSid, hblNo });
    }

    // 2.26 SHIPPER NAME (M)
    if (!houseJob.ShipperName) {
      errors.push({ recordType: 'BOL', fieldRef: '2.26', fieldName: 'Shipper Name', tabName: 'Shipment', houseJobSid, hblNo });
    }

    // 2.27 SHIPPER ADDRESS (M)
    if (!houseJob.ShipperAddress) {
      errors.push({ recordType: 'BOL', fieldRef: '2.27', fieldName: 'Shipper Address', tabName: 'Shipment', houseJobSid, hblNo });
    }

    // 2.28 SHIPPER COUNTRY CODE (M)
    const shipperCountryCode = houseJob.companyMaster?.countryMaster?.CountryCode ||
                               masterJob.CompanyMaster?.countryMaster?.CountryCode;
    if (!shipperCountryCode) {
      errors.push({ recordType: 'BOL', fieldRef: '2.28', fieldName: 'Shipper Country Code', tabName: 'Shipment', houseJobSid, hblNo });
    }

    // 2.29 CONSIGNEE CODE (M)
    if (!customs.ImporterCode) {
      errors.push({ recordType: 'BOL', fieldRef: '2.29', fieldName: 'Consignee Code (Importer Code)', tabName: 'Customs', houseJobSid, hblNo });
    }

    // 2.30 CONSIGNEE NAME (M)
    if (!houseJob.ConsigneeName) {
      errors.push({ recordType: 'BOL', fieldRef: '2.30', fieldName: 'Consignee Name', tabName: 'Shipment', houseJobSid, hblNo });
    }

    // 2.31 CONSIGNEE ADDRESS (M)
    if (!houseJob.ConsigneeAddress) {
      errors.push({ recordType: 'BOL', fieldRef: '2.31', fieldName: 'Consignee Address', tabName: 'Shipment', houseJobSid, hblNo });
    }

    // 2.33 NOTIFY1 NAME (M)
    const notifyName = houseJob.Notify || others.NotifyParty;
    if (!notifyName) {
      errors.push({ recordType: 'BOL', fieldRef: '2.33', fieldName: 'Notify Party Name', tabName: 'Others', houseJobSid, hblNo });
    }

    // 2.34 NOTIFY1 ADDRESS (M)
    const notifyAddress = houseJob.NotifyAddress || others.NotifyPartyAddress;
    if (!notifyAddress) {
      errors.push({ recordType: 'BOL', fieldRef: '2.34', fieldName: 'Notify Party Address', tabName: 'Others', houseJobSid, hblNo });
    }

    // 2.41 MARKS & NUMBERS (M)
    if (!cargo.MarksAndNumber) {
      errors.push({ recordType: 'BOL', fieldRef: '2.41', fieldName: 'Marks & Numbers', tabName: 'Cargo', houseJobSid, hblNo });
    }

    // 2.42 COMMODITY CODE (M) - HS Code
    const hsCode = customs.UNHSCode || houseJob.Products?.[0]?.HSCode;
    if (!hsCode) {
      errors.push({ recordType: 'BOL', fieldRef: '2.42', fieldName: 'Commodity Code (HS Code)', tabName: 'Customs', houseJobSid, hblNo });
    }

    // 2.43 COMMODITY DESCRIPTION (M)
    if (!cargo.CommodityDescription) {
      errors.push({ recordType: 'BOL', fieldRef: '2.43', fieldName: 'Commodity Description', tabName: 'Cargo', houseJobSid, hblNo });
    }

    // 2.44 PACKAGES (M)
    if (!cargo.NoOfPackage) {
      errors.push({ recordType: 'BOL', fieldRef: '2.44', fieldName: 'Number of Packages', tabName: 'Cargo', houseJobSid, hblNo });
    }

    // 2.45 PACKAGE TYPE (M)
    if (!cargo.PackageType) {
      errors.push({ recordType: 'BOL', fieldRef: '2.45', fieldName: 'Package Type', tabName: 'Cargo', houseJobSid, hblNo });
    }

    // 2.46 PACKAGE TYPE CODE (M)
    if (!customs.PackageTypeCode) {
      errors.push({ recordType: 'BOL', fieldRef: '2.46', fieldName: 'Package Type Code', tabName: 'Customs', houseJobSid, hblNo });
    }

    // 2.52 CARGO WEIGHT IN KG (M)
    if (!cargo.GrossWeight && cargo.GrossWeight !== 0) {
      errors.push({ recordType: 'BOL', fieldRef: '2.52', fieldName: 'Cargo Weight (KG)', tabName: 'Cargo', houseJobSid, hblNo });
    }

    // 2.53 GROSS WEIGHT IN KG (M)
    if (!cargo.GrossWeight && cargo.GrossWeight !== 0) {
      errors.push({ recordType: 'BOL', fieldRef: '2.53', fieldName: 'Gross Weight (KG)', tabName: 'Cargo', houseJobSid, hblNo });
    }

    // Conditional: 2.17 CONTAINER SERVICE TYPE - Mandatory for containerized cargo (F/L/M)
    const cargoCode = customs.CargoCode || this.getCargoCode(cargo);
    if (['F', 'L', 'M'].includes(cargoCode)) {
      const shipmentTerms = cargo.ShipmentTerms || houseJob.ShipmentTerms || masterJob.ShipmentTerms;
      if (!shipmentTerms) {
        errors.push({ recordType: 'BOL', fieldRef: '2.17', fieldName: 'Container Service Type (Shipment Terms)', tabName: 'Cargo', houseJobSid, hblNo });
      }
    }

    // Conditional: 2.49 NO OF CONTAINERS - Mandatory for FCL containers
    if (cargoCode === 'F') {
      if (!cargo.NoofContainers && cargo.NoofContainers !== 0) {
        errors.push({ recordType: 'BOL', fieldRef: '2.49', fieldName: 'Number of Containers', tabName: 'Cargo', houseJobSid, hblNo });
      }
    }

    // Conditional: 2.54 CARGO VOLUME - Mandatory for LCL & General Cargo
    if (['L', 'G'].includes(cargoCode)) {
      if (!cargo.Volume && cargo.Volume !== 0) {
        errors.push({ recordType: 'BOL', fieldRef: '2.54', fieldName: 'Cargo Volume (CBM)', tabName: 'Cargo', houseJobSid, hblNo });
      }
    }

    // Conditional: 2.56 FREIGHT TONNE - Mandatory for LCL & General Cargo
    if (['L', 'G'].includes(cargoCode)) {
      if (!customs.FreightTonne && customs.FreightTonne !== 0) {
        errors.push({ recordType: 'BOL', fieldRef: '2.56', fieldName: 'Freight Tonne', tabName: 'Customs', houseJobSid, hblNo });
      }
    }

    // Conditional: 2.57 NO OF PALLETS - Mandatory for LCL & General Cargo
    if (['L', 'G'].includes(cargoCode)) {
      if (!customs.NoOfPallets && customs.NoOfPallets !== 0) {
        errors.push({ recordType: 'BOL', fieldRef: '2.57', fieldName: 'Number of Pallets', tabName: 'Customs', houseJobSid, hblNo });
      }
    }

    return errors;
  }

  /**
   * Validate CON Record mandatory fields
   */
  private validateCONRecord(masterJob: any, houseJob: any): MandatoryFieldError[] {
    const errors: MandatoryFieldError[] = [];
    const customs = houseJob.houseJobCustoms?.[0] || masterJob.houseJobCustoms?.[0] || {};
    const cargo = houseJob.Cargo?.[0] || {};
    const product = houseJob.Products?.[0] || {};
    const hblNo = houseJob.HBLNo || '';
    const houseJobSid = houseJob.HouseJobSid;

    // 3.1 SERIAL NUMBER (M)
    if (!customs.SerialNumber) {
      errors.push({ recordType: 'CON', fieldRef: '3.1', fieldName: 'Serial Number', tabName: 'Customs', houseJobSid, hblNo });
    }

    // 3.2 MARKS & NUMBERS (M)
    if (!cargo.MarksAndNumber) {
      errors.push({ recordType: 'CON', fieldRef: '3.2', fieldName: 'Marks & Numbers', tabName: 'Cargo', houseJobSid, hblNo });
    }

    // 3.3 CARGO DESCRIPTION (M)
    if (!cargo.CommodityDescription) {
      errors.push({ recordType: 'CON', fieldRef: '3.3', fieldName: 'Cargo Description', tabName: 'Cargo', houseJobSid, hblNo });
    }

    // 3.5 COMMODITY CODE / HS CODE (M)
    const hsCode = customs.UNHSCode || product.HSCode;
    if (!hsCode) {
      errors.push({ recordType: 'CON', fieldRef: '3.5', fieldName: 'Commodity Code (HS Code)', tabName: 'Customs', houseJobSid, hblNo });
    }

    // 3.6 CONSIGNMENT PACKAGES (M)
    if (!cargo.NoOfPackage) {
      errors.push({ recordType: 'CON', fieldRef: '3.6', fieldName: 'Consignment Packages', tabName: 'Cargo', houseJobSid, hblNo });
    }

    // 3.7 PACKAGE TYPE (M)
    if (!cargo.PackageType) {
      errors.push({ recordType: 'CON', fieldRef: '3.7', fieldName: 'Package Type', tabName: 'Cargo', houseJobSid, hblNo });
    }

    // 3.8 PACKAGE TYPE CODE (M)
    if (!customs.PackageTypeCode) {
      errors.push({ recordType: 'CON', fieldRef: '3.8', fieldName: 'Package Type Code', tabName: 'Customs', houseJobSid, hblNo });
    }

    // 3.9 NO OF PALLETS (M)
    if (!customs.NoOfPallets && customs.NoOfPallets !== 0) {
      errors.push({ recordType: 'CON', fieldRef: '3.9', fieldName: 'Number of Pallets', tabName: 'Customs', houseJobSid, hblNo });
    }

    // 3.10 CONSIGNMENT WEIGHT IN KG (M)
    if (!cargo.GrossWeight && cargo.GrossWeight !== 0) {
      errors.push({ recordType: 'CON', fieldRef: '3.10', fieldName: 'Consignment Weight (KG)', tabName: 'Cargo', houseJobSid, hblNo });
    }

    // 3.11 CONSIGNMENT VOLUME IN CUBIC METRES (M)
    if (!cargo.Volume && cargo.Volume !== 0) {
      errors.push({ recordType: 'CON', fieldRef: '3.11', fieldName: 'Consignment Volume (CBM)', tabName: 'Cargo', houseJobSid, hblNo });
    }

    // 3.12 DANGEROUS GOODS INDICATOR (M) - always required, default is 'N'
    // This is handled by default in generation, so no validation needed

    // 3.18 REFRIGERATION REQUIRED (M) - always required, default is 'N'
    // This is handled by default in generation, so no validation needed

    // Conditional: 3.13 IMO CLASS NUMBER - Mandatory if DG Indicator = 'Y'
    const isDangerous = !!(customs.UNNumber || product.IsHaz === 'Y' || product.UnNo);
    if (isDangerous) {
      const imoClass = product.ImcoClass;
      if (!imoClass) {
        errors.push({ recordType: 'CON', fieldRef: '3.13', fieldName: 'IMO Class Number (required for Dangerous Goods)', tabName: 'Cargo', houseJobSid, hblNo });
      }

      // 3.14 UN NUMBER OF DANGEROUS GOODS - Conditional
      if (!(customs.UNNumber || product.UnNo)) {
        errors.push({ recordType: 'CON', fieldRef: '3.14', fieldName: 'UN Number (required for Dangerous Goods)', tabName: 'Customs', houseJobSid, hblNo });
      }

      // 3.17 STORAGE REQUESTED FOR DANGEROUS GOODS - Conditional
      if (!customs.HazStorageRequest) {
        errors.push({ recordType: 'CON', fieldRef: '3.17', fieldName: 'Hazardous Storage Request (required for Dangerous Goods)', tabName: 'Customs', houseJobSid, hblNo });
      }
    }

    // Conditional: 3.16 UNIT OF TEMPERATURE - Mandatory if Flash Point is given
    if (customs.FlashPoints && !customs.TemperatureUnit) {
      errors.push({ recordType: 'CON', fieldRef: '3.16', fieldName: 'Temperature Unit (required when Flash Point is given)', tabName: 'Customs', houseJobSid, hblNo });
    }

    // Conditional: 3.19-3.21 REFRIGERATION TEMPS - Mandatory if Refrigeration Required = 'Y'
    if (customs.RefrigerationRequired === 'Y') {
      if (!customs.MinTemperature && customs.MinTemperature !== 0) {
        errors.push({ recordType: 'CON', fieldRef: '3.19', fieldName: 'Minimum Temperature (required for Refrigeration)', tabName: 'Customs', houseJobSid, hblNo });
      }
      if (!customs.MaxTemperature && customs.MaxTemperature !== 0) {
        errors.push({ recordType: 'CON', fieldRef: '3.20', fieldName: 'Maximum Temperature (required for Refrigeration)', tabName: 'Customs', houseJobSid, hblNo });
      }
      if (!customs.RefTemperatureUnit) {
        errors.push({ recordType: 'CON', fieldRef: '3.21', fieldName: 'Refrigeration Temperature Unit', tabName: 'Customs', houseJobSid, hblNo });
      }
    }

    return errors;
  }

  /**
   * Validate CTR Record mandatory fields (for containerized cargo)
   */
  private validateCTRRecords(masterJob: any, houseJob: any): MandatoryFieldError[] {
    const errors: MandatoryFieldError[] = [];
    const containers = masterJob.containers || [];
    const products = houseJob.Products || [];
    const hblNo = houseJob.HBLNo || '';
    const houseJobSid = houseJob.HouseJobSid;

    // Check master job containers
    for (const container of containers) {
      // 4.1 CONTAINER NUMBER (M)
      if (!container.ContainerNumber) {
        errors.push({ recordType: 'CTR', fieldRef: '4.1', fieldName: 'Container Number', tabName: 'Container', houseJobSid, hblNo });
      }

      // 4.3 TARE WEIGHT IN MT (M)
      const tareWeight = container.containerType?.TareWeight;
      if (!tareWeight && tareWeight !== 0) {
        errors.push({ recordType: 'CTR', fieldRef: '4.3', fieldName: `Tare Weight for Container ${container.ContainerNumber || 'Unknown'}`, tabName: 'Container', houseJobSid, hblNo });
      }

      // 4.4 SEAL NO (M)
      if (!container.LineSeal) {
        errors.push({ recordType: 'CTR', fieldRef: '4.4', fieldName: `Seal Number for Container ${container.ContainerNumber || 'Unknown'}`, tabName: 'Container', houseJobSid, hblNo });
      }
    }

    // Check product containers (for LCL)
    for (const product of products) {
      if (product.ContainerNo) {
        // 4.4 SEAL NO (M)
        if (!product.SealNo) {
          errors.push({ recordType: 'CTR', fieldRef: '4.4', fieldName: `Seal Number for Container ${product.ContainerNo}`, tabName: 'Container', houseJobSid, hblNo });
        }
      }
    }

    return errors;
  }

  /**
   * Helper: Check if cargo is containerized
   */
  private isContainerized(masterJob: any, houseJob: any): boolean {
    // Check if master job has containers
    if (masterJob.containers && masterJob.containers.length > 0) {
      return true;
    }

    const cargo = houseJob.Cargo?.[0];
    if (!cargo) return false;

    const cargoType = (cargo.CargoType || '').toUpperCase();
    return (
      cargoType.includes('FCL') ||
      cargoType.includes('LCL') ||
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
