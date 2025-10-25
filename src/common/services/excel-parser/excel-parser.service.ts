import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import * as XLSX from 'xlsx';
import {
  MasterJobBulkUploadDto,
  HouseJobBulkUploadDto,
  MasterJobContainerBulkDto,
  MasterJobVoyageBulkDto,
  MasterJobConnectionBulkDto,
  HouseJobCargoBulkDto,
  HouseJobProductBulkDto,
  HouseJobConnectionBulkDto,
  BulkUploadValidationError,
} from 'src/operation/DTO/master-job-bulk-upload.dto';

@Injectable()
export class ExcelParserService {
  private readonly logger = new Logger(ExcelParserService.name);

  /**
   * Parse Excel buffer and extract Master Job and House Jobs data
   */
  parseExcelFile(buffer: Buffer): {
    masterJob: any;
    containers: any[];
    voyages: any[];
    connections: any[];
    others: any;
    houseJobs: any[];
    errors: BulkUploadValidationError[];
  } {
    try {
      const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true });

      const errors: BulkUploadValidationError[] = [];

      // Validate required sheets exist
      if (!workbook.SheetNames.includes('Master Job')) {
        errors.push({
          field: 'Sheet',
          message: 'Required sheet "Master Job" not found',
          sheet: 'Master Job',
        });
      }

      if (!workbook.SheetNames.includes('House Jobs')) {
        errors.push({
          field: 'Sheet',
          message: 'Required sheet "House Jobs" not found',
          sheet: 'House Jobs',
        });
      }

      if (errors.length > 0) {
        return { masterJob: null, containers: [], voyages: [], connections: [], others: null, houseJobs: [], errors };
      }

      // Parse Master Job sheet
      const masterJobSheet = workbook.Sheets['Master Job'];
      const masterJobData = XLSX.utils.sheet_to_json(masterJobSheet, {
        defval: null,
        raw: false,
      });

      // Parse House Jobs sheet
      const houseJobsSheet = workbook.Sheets['House Jobs'];
      const houseJobsData = XLSX.utils.sheet_to_json(houseJobsSheet, {
        defval: null,
        raw: false,
      });

      if (masterJobData.length === 0) {
        errors.push({
          field: 'Data',
          message: 'Master Job sheet contains no data',
          sheet: 'Master Job',
        });
      }

      if (houseJobsData.length === 0) {
        errors.push({
          field: 'Data',
          message: 'House Jobs sheet contains no data (at least one house job required)',
          sheet: 'House Jobs',
        });
      }

      if (errors.length > 0) {
        return { masterJob: null, containers: [], voyages: [], connections: [], others: null, houseJobs: [], errors };
      }

      // Parse master job (first row only)
      const masterJob = this.parseMasterJobRow(masterJobData[0], errors);

      // Parse Containers sheet (optional)
      const containers = this.parseContainersSheet(workbook, errors);

      // Parse Master Voyages sheet (optional)
      const voyages = this.parseMasterVoyagesSheet(workbook, errors);

      // Parse Master Connections sheet (optional)
      const connections = this.parseMasterConnectionsSheet(workbook, errors);

      // Parse Master Others sheet (optional)
      const others = this.parseMasterOthersSheet(workbook, errors);

      // Parse House Jobs with their child data
      const houseJobs = houseJobsData.map((row: any, index) => {
        const shipmentNo = this.getStringValue(row['Shipment Number']) || '';
        return {
          ...this.parseHouseJobRow(row, index + 2, errors),
          cargo: this.parseHouseCargoForShipment(workbook, shipmentNo, errors),
          products: this.parseHouseProductsForShipment(workbook, shipmentNo, errors),
          connections: this.parseHouseConnectionsForShipment(workbook, shipmentNo, errors),
        };
      });

      return { masterJob, containers, voyages, connections, others, houseJobs, errors };
    } catch (error) {
      this.logger.error(`Error parsing Excel file: ${error.message}`, error.stack);
      throw new BadRequestException('Invalid Excel file format');
    }
  }

  /**
   * Parse Master Job row from Excel
   */
  private parseMasterJobRow(row: any, errors: BulkUploadValidationError[]): any {
    try {
      const masterJob: any = {
        MasterJobDate: this.parseDateValue(row['Master Job Date']),
        Department: this.getStringValue(row['Department']),
        FreightPPCC: this.getStringValue(row['Freight PP/CC']),
        POO: this.getStringValue(row['POO (Port Code)']),
        POL: this.getStringValue(row['POL (Port Code)']),
        POD: this.getStringValue(row['POD (Port Code)']),
        FPD: this.getStringValue(row['FPD (Port Code)']),
        POLTerminal: this.getStringValue(row['POL Terminal']),
        PODTerminal: this.getStringValue(row['POD Terminal']),
        MovementType: this.getStringValue(row['Movement Type']),
        ShipmentTerms: this.getStringValue(row['Shipment Terms']),
        MBLNo: this.getStringValue(row['MBL Number']),
        MBLDate: this.parseDateValue(row['MBL Date']),
        BLReleaseType: this.getStringValue(row['BL Release Type']),
        NoOfPkg: this.getNumberValue(row['Number of Packages']),
        GrossWeight: this.getDecimalValue(row['Gross Weight']),
        NetWeight: this.getDecimalValue(row['Net Weight']),
        Volume: this.getDecimalValue(row['Volume (CBM)']),
        ChargeableWeight: this.getDecimalValue(row['Chargeable Weight']),
        CommodityDescription: this.getStringValue(row['Commodity Description']),
        MarksandNumber: this.getStringValue(row['Marks and Number']),
        Haz: this.getBooleanValue(row['Hazardous (Y/N)']),
        DestinationAgentName: this.getStringValue(row['Destination Agent Name']),
        DestinationAgentAddress: this.getStringValue(row['Destination Agent Address']),
        DGBookingDate: this.parseDateValue(row['DG Booking Date']),
        DGApprovedDate: this.parseDateValue(row['DG Approved Date']),
      };

      return masterJob;
    } catch (error) {
      errors.push({
        field: 'Master Job',
        message: `Error parsing Master Job data: ${error.message}`,
        sheet: 'Master Job',
        row: 2,
      });
      return null;
    }
  }

  /**
   * Parse House Job row from Excel
   */
  private parseHouseJobRow(
    row: any,
    rowNumber: number,
    errors: BulkUploadValidationError[]
  ): any {
    try {
      const houseJob: any = {
        ShipmentNo: this.getStringValue(row['Shipment Number']),
        CustomerName: this.getStringValue(row['Customer Name']),
        CustomerAddress: this.getStringValue(row['Customer Address']),
        IncoTerms: this.getStringValue(row['Inco Terms']),
        ShipperName: this.getStringValue(row['Shipper Name']),
        ShipperAddress: this.getStringValue(row['Shipper Address']),
        ConsigneeName: this.getStringValue(row['Consignee Name']),
        ConsigneeAddress: this.getStringValue(row['Consignee Address']),
        POL: this.getStringValue(row['POL (Port Code)']),
        POD: this.getStringValue(row['POD (Port Code)']),
        FPD: this.getStringValue(row['FPD (Port Code)']),
        POO: this.getStringValue(row['POO (Port Code)']),
        ETD: this.parseDateValue(row['ETD']),
        ETA: this.parseDateValue(row['ETA']),
        MovementType: this.getStringValue(row['Movement Type']),
        Notify: this.getStringValue(row['Notify Party']),
        NotifyAddress: this.getStringValue(row['Notify Address']),
        NominatedBy: this.getStringValue(row['Nominated By']),
        AgentName: this.getStringValue(row['Agent Name']),
        AgentAddress: this.getStringValue(row['Agent Address']),
        ShipmentType: this.getStringValue(row['Shipment Type']),
      };

      return houseJob;
    } catch (error) {
      errors.push({
        field: 'House Job',
        message: `Error parsing House Job data: ${error.message}`,
        sheet: 'House Jobs',
        row: rowNumber,
      });
      return null;
    }
  }

  /**
   * Parse Containers sheet
   */
  private parseContainersSheet(workbook: XLSX.WorkBook, errors: BulkUploadValidationError[]): any[] {
    if (!workbook.SheetNames.includes('Containers')) {
      return [];
    }

    try {
      const containersSheet = workbook.Sheets['Containers'];
      const containersData = XLSX.utils.sheet_to_json(containersSheet, { defval: null, raw: false });

      return containersData.map((row: any, index) => ({
        ContainerNumber: this.getStringValue(row['Container Number']),
        ContainerType: this.getNumberValue(row['Container Type']),
        LineSeal: this.getStringValue(row['Line Seal']),
        CustomsSeal: this.getStringValue(row['Customs Seal']),
        HsCode: this.getStringValue(row['HS Code']),
        CommodityDescription: this.getStringValue(row['Commodity Description']),
        PkgType: this.getNumberValue(row['Package Type']),
        NoOfPkg: this.getNumberValue(row['No of Packages']),
        GrossWeight: this.getDecimalValue(row['Gross Weight']),
        NetWeight: this.getDecimalValue(row['Net Weight']),
        ChargeableWeight: this.getDecimalValue(row['Chargeable Weight']),
        Volume: this.getDecimalValue(row['Volume (CBM)']),
        IsSoc: this.getBooleanValue(row['Is SOC (Y/N)']),
      }));
    } catch (error) {
      errors.push({
        field: 'Sheet',
        message: `Error parsing Containers sheet: ${error.message}`,
        sheet: 'Containers',
      });
      return [];
    }
  }

  /**
   * Parse Master Voyages sheet
   */
  private parseMasterVoyagesSheet(workbook: XLSX.WorkBook, errors: BulkUploadValidationError[]): any[] {
    if (!workbook.SheetNames.includes('Master Voyages')) {
      return [];
    }

    try {
      const voyagesSheet = workbook.Sheets['Master Voyages'];
      const voyagesData = XLSX.utils.sheet_to_json(voyagesSheet, { defval: null, raw: false });

      return voyagesData.map((row: any, index) => ({
        VesselName: this.getStringValue(row['Vessel Name']),
        VoyageNo: this.getStringValue(row['Voyage Number']),
        ETD: this.parseDateValue(row['ETD']),
        ETA: this.parseDateValue(row['ETA']),
        ATA: this.parseDateValue(row['ATA']),
        ATD: this.parseDateValue(row['ATD']),
        DestinationATA: this.parseDateValue(row['Destination ATA']),
        CarrierName: this.getStringValue(row['Carrier Name']),
      }));
    } catch (error) {
      errors.push({
        field: 'Sheet',
        message: `Error parsing Master Voyages sheet: ${error.message}`,
        sheet: 'Master Voyages',
      });
      return [];
    }
  }

  /**
   * Parse Master Connections sheet
   */
  private parseMasterConnectionsSheet(workbook: XLSX.WorkBook, errors: BulkUploadValidationError[]): any[] {
    if (!workbook.SheetNames.includes('Master Connections')) {
      return [];
    }

    try {
      const connectionsSheet = workbook.Sheets['Master Connections'];
      const connectionsData = XLSX.utils.sheet_to_json(connectionsSheet, { defval: null, raw: false });

      return connectionsData.map((row: any, index) => ({
        Mode: this.getStringValue(row['Mode']),
        POL: this.getStringValue(row['POL (Port Code)']),
        POD: this.getStringValue(row['POD (Port Code)']),
        VesselName: this.getStringValue(row['Vessel Name']),
        VoyageNo: this.getStringValue(row['Voyage Number']),
        ETD: this.parseDateValue(row['ETD']),
        ETA: this.parseDateValue(row['ETA']),
        ATD: this.parseDateValue(row['ATD']),
        ATA: this.parseDateValue(row['ATA']),
        Remarks: this.getStringValue(row['Remarks']),
      }));
    } catch (error) {
      errors.push({
        field: 'Sheet',
        message: `Error parsing Master Connections sheet: ${error.message}`,
        sheet: 'Master Connections',
      });
      return [];
    }
  }

  /**
   * Parse Master Others sheet
   */
  private parseMasterOthersSheet(workbook: XLSX.WorkBook, errors: BulkUploadValidationError[]): any {
    if (!workbook.SheetNames.includes('Master Others')) {
      return null;
    }

    try {
      const othersSheet = workbook.Sheets['Master Others'];
      const othersData = XLSX.utils.sheet_to_json(othersSheet, { defval: null, raw: false });

      if (othersData.length === 0) {
        return null;
      }

      const row: any = othersData[0];
      return {
        Yard: this.getStringValue(row['Yard']),
        YardAddress: this.getStringValue(row['Yard Address']),
        Transporter: this.getStringValue(row['Transporter']),
        HandlingInformation: this.getStringValue(row['Handling Information']),
        InternalNote: this.getStringValue(row['Internal Note']),
        CFS: this.getStringValue(row['CFS']),
        CFSAddress: this.getStringValue(row['CFS Address']),
        StuffingStartDate: this.parseDateValue(row['Stuffing Start Date']),
        StuffingEndDate: this.parseDateValue(row['Stuffing End Date']),
        CurrencyCode: this.getStringValue(row['Currency Code']),
        SellExchangeRate: this.getDecimalValue(row['Sell Exchange Rate']),
        AgentExchangeRate: this.getDecimalValue(row['Agent Exchange Rate']),
        Coload: this.getBooleanValue(row['Coload (Y/N)']),
        CoLoader: this.getStringValue(row['Co Loader']),
        ExportDoNo: this.getStringValue(row['Export DO Number']),
        ExportDoDate: this.parseDateValue(row['Export DO Date']),
        SOBDate: this.parseDateValue(row['SOB Date']),
      };
    } catch (error) {
      errors.push({
        field: 'Sheet',
        message: `Error parsing Master Others sheet: ${error.message}`,
        sheet: 'Master Others',
      });
      return null;
    }
  }

  /**
   * Parse House Cargo sheet for specific shipment
   */
  private parseHouseCargoForShipment(workbook: XLSX.WorkBook, shipmentNo: string, errors: BulkUploadValidationError[]): any[] {
    if (!workbook.SheetNames.includes('House Cargo') || !shipmentNo) {
      return [];
    }

    try {
      const cargoSheet = workbook.Sheets['House Cargo'];
      const cargoData = XLSX.utils.sheet_to_json(cargoSheet, { defval: null, raw: false });

      return cargoData
        .filter((row: any) => this.getStringValue(row['Shipment Number']) === shipmentNo)
        .map((row: any) => ({
          CargoType: this.getStringValue(row['Cargo Type']),
          GrossWeight: this.getDecimalValue(row['Gross Weight']),
          NetWeight: this.getDecimalValue(row['Net Weight']),
          Volume: this.getDecimalValue(row['Volume (CBM)']),
          ChargeableWeight: this.getDecimalValue(row['Chargeable Weight']),
          NoOfPackage: this.getNumberValue(row['No of Packages']),
          PackageType: this.getNumberValue(row['Package Type']),
          ContainerNumber: this.getStringValue(row['Container Number']),
          ContainerType: this.getNumberValue(row['Container Type']),
          CommodityDescription: this.getStringValue(row['Commodity Description']),
          MarksAndNumber: this.getStringValue(row['Marks and Number']),
          FreightAmount: this.getStringValue(row['Freight Amount']),
        }));
    } catch (error) {
      errors.push({
        field: 'Sheet',
        message: `Error parsing House Cargo sheet: ${error.message}`,
        sheet: 'House Cargo',
      });
      return [];
    }
  }

  /**
   * Parse House Products sheet for specific shipment
   */
  private parseHouseProductsForShipment(workbook: XLSX.WorkBook, shipmentNo: string, errors: BulkUploadValidationError[]): any[] {
    if (!workbook.SheetNames.includes('House Products') || !shipmentNo) {
      return [];
    }

    try {
      const productsSheet = workbook.Sheets['House Products'];
      const productsData = XLSX.utils.sheet_to_json(productsSheet, { defval: null, raw: false });

      return productsData
        .filter((row: any) => this.getStringValue(row['Shipment Number']) === shipmentNo)
        .map((row: any) => ({
          ProductName: this.getStringValue(row['Product Name']),
          ProductDescription: this.getStringValue(row['Product Description']),
          ShippingBillNo: this.getStringValue(row['Shipping Bill Number']),
          ShippingBillDate: this.parseDateValue(row['Shipping Bill Date']),
          GrossWeight: this.getDecimalValue(row['Gross Weight']),
          NetWeight: this.getDecimalValue(row['Net Weight']),
          Volume: this.getDecimalValue(row['Volume (CBM)']),
          PkgType: this.getNumberValue(row['Package Type']),
          NoOfPkg: this.getNumberValue(row['No of Packages']),
          ChargeableWeight: this.getDecimalValue(row['Chargeable Weight']),
          IsHaz: this.getBooleanValue(row['Hazardous (Y/N)']),
          UnNo: this.getStringValue(row['UN Number']),
          ImcoClass: this.getStringValue(row['IMCO Class']),
          HsCode: this.getStringValue(row['HS Code']),
        }));
    } catch (error) {
      errors.push({
        field: 'Sheet',
        message: `Error parsing House Products sheet: ${error.message}`,
        sheet: 'House Products',
      });
      return [];
    }
  }

  /**
   * Parse House Connections sheet for specific shipment
   */
  private parseHouseConnectionsForShipment(workbook: XLSX.WorkBook, shipmentNo: string, errors: BulkUploadValidationError[]): any[] {
    if (!workbook.SheetNames.includes('House Connections') || !shipmentNo) {
      return [];
    }

    try {
      const connectionsSheet = workbook.Sheets['House Connections'];
      const connectionsData = XLSX.utils.sheet_to_json(connectionsSheet, { defval: null, raw: false });

      return connectionsData
        .filter((row: any) => this.getStringValue(row['Shipment Number']) === shipmentNo)
        .map((row: any) => ({
          Mode: this.getStringValue(row['Mode']),
          POL: this.getStringValue(row['POL (Port Code)']),
          POD: this.getStringValue(row['POD (Port Code)']),
          VesselName: this.getStringValue(row['Vessel Name']),
          VoyageNo: this.getStringValue(row['Voyage Number']),
          ETD: this.parseDateValue(row['ETD']),
          ETA: this.parseDateValue(row['ETA']),
          ATD: this.parseDateValue(row['ATD']),
          ATA: this.parseDateValue(row['ATA']),
          Remarks: this.getStringValue(row['Remarks']),
        }));
    } catch (error) {
      errors.push({
        field: 'Sheet',
        message: `Error parsing House Connections sheet: ${error.message}`,
        sheet: 'House Connections',
      });
      return [];
    }
  }

  /**
   * Utility methods for data parsing
   */
  private getStringValue(value: any): string | undefined {
    if (value === null || value === undefined || value === '') return undefined;
    return String(value).trim();
  }

  private getNumberValue(value: any): number | undefined {
    if (value === null || value === undefined || value === '') return undefined;
    const num = Number(value);
    return isNaN(num) ? undefined : Math.floor(num);
  }

  private getDecimalValue(value: any): number | undefined {
    if (value === null || value === undefined || value === '') return undefined;
    const num = Number(value);
    return isNaN(num) ? undefined : num;
  }

  private parseDateValue(value: any): Date | undefined {
    if (!value) return undefined;

    // If already a Date object
    if (value instanceof Date) {
      return value;
    }

    // Try to parse string dates
    const date = new Date(value);
    return isNaN(date.getTime()) ? undefined : date;
  }

  private getBooleanValue(value: any): string | undefined {
    if (!value) return undefined;
    const strValue = String(value).toUpperCase().trim();
    if (strValue === 'Y' || strValue === 'YES' || strValue === '1' || strValue === 'TRUE') {
      return 'Y';
    }
    if (strValue === 'N' || strValue === 'NO' || strValue === '0' || strValue === 'FALSE') {
      return 'N';
    }
    return undefined;
  }

  /**
   * Generate Excel template for download
   */
  generateTemplate(): Buffer {
    const workbook = XLSX.utils.book_new();

    // Create Master Job sheet
    const masterJobHeaders = [
      'Master Job Date',
      'Department',
      'Freight PP/CC',
      'POO (Port Code)',
      'POL (Port Code)',
      'POD (Port Code)',
      'FPD (Port Code)',
      'POL Terminal',
      'POD Terminal',
      'Movement Type',
      'Shipment Terms',
      'MBL Number',
      'MBL Date',
      'BL Release Type',
      'Number of Packages',
      'Gross Weight',
      'Net Weight',
      'Volume (CBM)',
      'Chargeable Weight',
      'Commodity Description',
      'Marks and Number',
      'Hazardous (Y/N)',
      'Destination Agent Name',
      'Destination Agent Address',
      'Vessel Name',
      'Voyage Number',
      'Carrier Name',
      'Container Number',
      'Container Type',
      'Line Seal',
      'Customs Seal',
    ];

    const masterJobSample = [
      '2025-01-15',
      'LCL EXPORT',
      'Prepaid',
      'INCCU',
      'INCCU',
      'AEJEA',
      'AEJEA',
      'Terminal 1',
      'Terminal 2',
      'FCL',
      'CY/CY',
      'MBL123456',
      '2025-01-20',
      'Seaway Bill',
      '10',
      '5000',
      '4800',
      '25.5',
      '5000',
      'Electronic Goods',
      'Sample Marks',
      'N',
      'ABC Logistics',
      '123 Main St, New York',
      'MSC EMMA',
      'V123',
      'MSC',
      'TCLU1234567',
      '40HC',
      'MSC001',
      'CUST001',
    ];

    const masterJobWs = XLSX.utils.aoa_to_sheet([masterJobHeaders, masterJobSample]);
    XLSX.utils.book_append_sheet(workbook, masterJobWs, 'Master Job');

    // Create House Jobs sheet
    const houseJobHeaders = [
      'Shipment Number',
      'Customer Name',
      'Customer Address',
      'Inco Terms',
      'Shipper Name',
      'Shipper Address',
      'Consignee Name',
      'Consignee Address',
      'POL (Port Code)',
      'POD (Port Code)',
      'FPD (Port Code)',
      'POO (Port Code)',
      'ETD',
      'ETA',
      'Movement Type',
      'Notify Party',
      'Notify Address',
      'Nominated By',
      'Agent Name',
      'Agent Address',
      'Shipment Type',
      'Cargo Type',
      'Cargo Gross Weight',
      'Cargo Net Weight',
      'Cargo Volume',
      'Cargo No of Packages',
      'Product Name',
      'Shipping Bill Number',
      'Customer Reference Number',
      'CHA Name',
      'Yard/CFS',
      'Pickup Place',
      'Delivery Place',
      'Cargo Currency',
      'Cargo Value',
    ];

    const houseJobSample = [
      'SHIP-001',
      'ABC Company',
      '456 Customer St',
      'FOB',
      'Shipper Inc',
      '789 Shipper Ave',
      'Consignee Ltd',
      '321 Consignee Rd',
      'INCCU',
      'AEJEA',
      'AEJEA',
      'INCCU',
      '2025-01-25',
      '2025-02-15',
      'FCL',
      'Notify Party Name',
      'Notify Address',
      'Customer',
      'Agent Company',
      'Agent Address',
      'Export',
      'General',
      '2500',
      '2400',
      '12.5',
      '5',
      'Electronics',
      'SB123456',
      'CREF-001',
      'CHA Company',
      'Chennai Port',
      'Factory Gate',
      'Warehouse A',
      'USD',
      '50000',
    ];

    const houseJobWs = XLSX.utils.aoa_to_sheet([houseJobHeaders, houseJobSample]);
    XLSX.utils.book_append_sheet(workbook, houseJobWs, 'House Jobs');

    // Create Containers sheet
    const containersHeaders = [
      'Container Number',
      'Container Type',
      'Line Seal',
      'Customs Seal',
      'HS Code',
      'Commodity Description',
      'Package Type',
      'No of Packages',
      'Gross Weight',
      'Net Weight',
      'Chargeable Weight',
      'Volume (CBM)',
      'Is SOC (Y/N)',
    ];

    const containersSample = [
      'TCLU1234567',
      '40',
      'MSC001',
      'CUST001',
      '8471.30',
      'Electronic Equipment',
      '10',
      '100',
      '5000',
      '4800',
      '5000',
      '25.5',
      'N',
    ];

    const containersWs = XLSX.utils.aoa_to_sheet([containersHeaders, containersSample]);
    XLSX.utils.book_append_sheet(workbook, containersWs, 'Containers');

    // Create Master Voyages sheet
    const masterVoyagesHeaders = [
      'Vessel Name',
      'Voyage Number',
      'ETD',
      'ETA',
      'ATA',
      'ATD',
      'Destination ATA',
      'Carrier Name',
    ];

    const masterVoyagesSample = [
      'MSC EMMA',
      'V123',
      '2025-01-25',
      '2025-02-15',
      '2025-02-16',
      '2025-01-26',
      '2025-02-20',
      'MSC',
    ];

    const masterVoyagesWs = XLSX.utils.aoa_to_sheet([masterVoyagesHeaders, masterVoyagesSample]);
    XLSX.utils.book_append_sheet(workbook, masterVoyagesWs, 'Master Voyages');

    // Create Master Connections sheet
    const masterConnectionsHeaders = [
      'Mode',
      'POL (Port Code)',
      'POD (Port Code)',
      'Vessel Name',
      'Voyage Number',
      'ETD',
      'ETA',
      'ATD',
      'ATA',
      'Remarks',
    ];

    const masterConnectionsSample = [
      'Sea',
      'INCCU',
      'AEJEA',
      'MSC EMMA',
      'V123',
      '2025-01-25',
      '2025-02-15',
      '2025-01-26',
      '2025-02-16',
      'Direct connection',
    ];

    const masterConnectionsWs = XLSX.utils.aoa_to_sheet([masterConnectionsHeaders, masterConnectionsSample]);
    XLSX.utils.book_append_sheet(workbook, masterConnectionsWs, 'Master Connections');

    // Create Master Others sheet
    const masterOthersHeaders = [
      'Yard',
      'Yard Address',
      'Transporter',
      'Handling Information',
      'Internal Note',
      'CFS',
      'CFS Address',
      'Stuffing Start Date',
      'Stuffing End Date',
      'Currency Code',
      'Sell Exchange Rate',
      'Agent Exchange Rate',
      'Coload (Y/N)',
      'Co Loader',
      'Export DO Number',
      'Export DO Date',
      'SOB Date',
    ];

    const masterOthersSample = [
      'Chennai Yard',
      '123 Yard St, Chennai',
      'ABC Transport',
      'Handle with care',
      'Priority shipment',
      'Chennai CFS',
      '456 CFS Ave, Chennai',
      '2025-01-20',
      '2025-01-22',
      'USD',
      '83.50',
      '83.00',
      'N',
      '',
      'DO123456',
      '2025-01-18',
      '2025-01-15',
    ];

    const masterOthersWs = XLSX.utils.aoa_to_sheet([masterOthersHeaders, masterOthersSample]);
    XLSX.utils.book_append_sheet(workbook, masterOthersWs, 'Master Others');

    // Create House Cargo sheet
    const houseCargoHeaders = [
      'Shipment Number',
      'Cargo Type',
      'Gross Weight',
      'Net Weight',
      'Volume (CBM)',
      'Chargeable Weight',
      'No of Packages',
      'Package Type',
      'Container Number',
      'Container Type',
      'Commodity Description',
      'Marks and Number',
      'Freight Amount',
    ];

    const houseCargoSample = [
      'SHIP-001',
      'General',
      '2500',
      '2400',
      '12.5',
      '2500',
      '50',
      '10',
      'TCLU1234567',
      '40',
      'Electronic Goods',
      'Sample Marks',
      '5000',
    ];

    const houseCargoWs = XLSX.utils.aoa_to_sheet([houseCargoHeaders, houseCargoSample]);
    XLSX.utils.book_append_sheet(workbook, houseCargoWs, 'House Cargo');

    // Create House Products sheet
    const houseProductsHeaders = [
      'Shipment Number',
      'Product Name',
      'Product Description',
      'Shipping Bill Number',
      'Shipping Bill Date',
      'Gross Weight',
      'Net Weight',
      'Volume (CBM)',
      'Package Type',
      'No of Packages',
      'Chargeable Weight',
      'Hazardous (Y/N)',
      'UN Number',
      'IMCO Class',
      'HS Code',
    ];

    const houseProductsSample = [
      'SHIP-001',
      'Laptops',
      'Dell Laptops',
      'SB123456',
      '2025-01-15',
      '1000',
      '950',
      '5.0',
      '10',
      '20',
      '1000',
      'N',
      '',
      '',
      '8471.30',
    ];

    const houseProductsWs = XLSX.utils.aoa_to_sheet([houseProductsHeaders, houseProductsSample]);
    XLSX.utils.book_append_sheet(workbook, houseProductsWs, 'House Products');

    // Create House Connections sheet
    const houseConnectionsHeaders = [
      'Shipment Number',
      'Mode',
      'POL (Port Code)',
      'POD (Port Code)',
      'Vessel Name',
      'Voyage Number',
      'ETD',
      'ETA',
      'ATD',
      'ATA',
      'Remarks',
    ];

    const houseConnectionsSample = [
      'SHIP-001',
      'Sea',
      'INCCU',
      'AEJEA',
      'MSC EMMA',
      'V123',
      '2025-01-25',
      '2025-02-15',
      '2025-01-26',
      '2025-02-16',
      'Direct route',
    ];

    const houseConnectionsWs = XLSX.utils.aoa_to_sheet([houseConnectionsHeaders, houseConnectionsSample]);
    XLSX.utils.book_append_sheet(workbook, houseConnectionsWs, 'House Connections');

    // Generate buffer
    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
    return buffer;
  }
}
