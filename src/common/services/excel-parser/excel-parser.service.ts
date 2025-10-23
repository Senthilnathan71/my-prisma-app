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
        return { masterJob: null, houseJobs: [], errors };
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
        return { masterJob: null, houseJobs: [], errors };
      }

      // Parse master job (first row only)
      const masterJob = this.parseMasterJobRow(masterJobData[0], errors);

      // Parse house jobs (all rows)
      const houseJobs = houseJobsData.map((row, index) =>
        this.parseHouseJobRow(row, index + 2, errors)
      );

      return { masterJob, houseJobs, errors };
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
        MasterJobNumber: this.getStringValue(row['Master Job Number']),
        MasterJobDate: this.parseDateValue(row['Master Job Date']),
        FreightPPCC: this.getStringValue(row['Freight PP/CC']),
        POO: this.getStringValue(row['POO (Port of Origin)']),
        POL: this.getStringValue(row['POL (Port of Loading)']),
        POD: this.getStringValue(row['POD (Port of Discharge)']),
        FPD: this.getStringValue(row['FPD (Final Place of Delivery)']),
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

      // Parse containers if provided (could be in separate rows or as JSON)
      masterJob.containers = this.parseContainerData(row);

      // Parse voyage information
      masterJob.voyages = this.parseVoyageData(row);

      // Parse connection information
      masterJob.connections = this.parseConnectionData(row);

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
        BookingNo: this.getStringValue(row['Booking Number']),
        HBLNo: this.getStringValue(row['HBL Number']),
        ShipmentNo: this.getStringValue(row['Shipment Number']),
        CustomerName: this.getStringValue(row['Customer Name']),
        CustomerAddress: this.getStringValue(row['Customer Address']),
        IncoTerms: this.getStringValue(row['Inco Terms']),
        ShipperName: this.getStringValue(row['Shipper Name']),
        ShipperAddress: this.getStringValue(row['Shipper Address']),
        ConsigneeName: this.getStringValue(row['Consignee Name']),
        ConsigneeAddress: this.getStringValue(row['Consignee Address']),
        POL: this.getStringValue(row['POL']),
        POD: this.getStringValue(row['POD']),
        FPD: this.getStringValue(row['FPD']),
        POO: this.getStringValue(row['POO']),
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

      // Parse cargo information
      houseJob.cargo = this.parseCargoData(row);

      // Parse product information
      houseJob.products = this.parseProductData(row);

      // Parse connection information for house job
      houseJob.connections = this.parseHouseConnectionData(row);

      // Parse others information
      houseJob.others = this.parseHouseOthersData(row);

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
   * Parse container data from row
   */
  private parseContainerData(row: any): MasterJobContainerBulkDto[] {
    const containers: MasterJobContainerBulkDto[] = [];

    // Check if container data exists
    const containerNumber = this.getStringValue(row['Container Number']);
    const containerType = this.getNumberValue(row['Container Type']);

    if (containerNumber && containerType) {
      containers.push({
        ContainerNumber: containerNumber,
        ContainerType: containerType,
        LineSeal: this.getStringValue(row['Line Seal']),
        CustomsSeal: this.getStringValue(row['Customs Seal']),
        HsCode: this.getStringValue(row['HS Code']),
        CommodityDescription: this.getStringValue(row['Container Commodity']),
        PkgType: this.getNumberValue(row['Container Package Type']),
        NoOfPkg: this.getNumberValue(row['Container No of Packages']),
        GrossWeight: this.getDecimalValue(row['Container Gross Weight']),
        NetWeight: this.getDecimalValue(row['Container Net Weight']),
        ChargeableWeight: this.getDecimalValue(row['Container Chargeable Weight']),
        Volume: this.getDecimalValue(row['Container Volume']),
        IsSoc: this.getBooleanValue(row['Is SOC (Y/N)']),
      });
    }

    return containers;
  }

  /**
   * Parse voyage data from row
   */
  private parseVoyageData(row: any): MasterJobVoyageBulkDto[] {
    const voyages: MasterJobVoyageBulkDto[] = [];

    const vesselName = this.getStringValue(row['Vessel Name']);
    if (vesselName) {
      voyages.push({
        VesselName: vesselName,
        VoyageNo: this.getStringValue(row['Voyage Number']),
        ETD: this.parseDateValue(row['Vessel ETD']),
        ETA: this.parseDateValue(row['Vessel ETA']),
        ATA: this.parseDateValue(row['Vessel ATA']),
        ATD: this.parseDateValue(row['Vessel ATD']),
        CarrierName: this.getStringValue(row['Carrier Name']),
      });
    }

    return voyages;
  }

  /**
   * Parse connection data from row
   */
  private parseConnectionData(row: any): MasterJobConnectionBulkDto[] {
    const connections: MasterJobConnectionBulkDto[] = [];

    const connectionPOL = this.getStringValue(row['Connection POL']);
    const connectionPOD = this.getStringValue(row['Connection POD']);

    if (connectionPOL && connectionPOD) {
      connections.push({
        POL: connectionPOL,
        POD: connectionPOD,
        VesselName: this.getStringValue(row['Connection Vessel']),
        VoyageNo: this.getStringValue(row['Connection Voyage']),
        Mode: this.getStringValue(row['Connection Mode']),
        ETD: this.parseDateValue(row['Connection ETD']),
        ETA: this.parseDateValue(row['Connection ETA']),
        Remarks: this.getStringValue(row['Connection Remarks']),
      });
    }

    return connections;
  }

  /**
   * Parse cargo data for house job
   */
  private parseCargoData(row: any): HouseJobCargoBulkDto[] {
    const cargo: HouseJobCargoBulkDto[] = [];

    const cargoType = this.getStringValue(row['Cargo Type']);
    const grossWeight = this.getDecimalValue(row['Cargo Gross Weight']);

    if (cargoType && grossWeight !== undefined) {
      cargo.push({
        CargoType: cargoType,
        GrossWeight: grossWeight,
        NetWeight: this.getDecimalValue(row['Cargo Net Weight']),
        Volume: this.getDecimalValue(row['Cargo Volume']),
        ChargeableWeight: this.getDecimalValue(row['Cargo Chargeable Weight']),
        NoOfPackage: this.getNumberValue(row['Cargo No of Packages']),
        PackageType: this.getNumberValue(row['Cargo Package Type']),
        FreightAmount: this.getStringValue(row['Freight Amount']),
        ShipmentTerms: this.getStringValue(row['Cargo Shipment Terms']),
        FreightTerms: this.getStringValue(row['Freight Terms']),
        ModeOfTransport: this.getStringValue(row['Mode of Transport']),
        MovementType: this.getStringValue(row['Cargo Movement Type']),
        NoofContainers: this.getNumberValue(row['No of Containers']),
        StuffingAt: this.getStringValue(row['Stuffing At']),
        CommodityDescription: this.getStringValue(row['Cargo Commodity']),
        MarksAndNumber: this.getStringValue(row['Cargo Marks']),
      });
    }

    return cargo;
  }

  /**
   * Parse product data for house job
   */
  private parseProductData(row: any): HouseJobProductBulkDto[] {
    const products: HouseJobProductBulkDto[] = [];

    const productName = this.getStringValue(row['Product Name']);
    const shippingBillNo = this.getStringValue(row['Shipping Bill Number']);
    const grossWeight = this.getDecimalValue(row['Product Gross Weight']);

    if (productName && shippingBillNo && grossWeight !== undefined) {
      products.push({
        ProductName: productName,
        ProductDescription: this.getStringValue(row['Product Description']),
        ShippingBillNo: shippingBillNo,
        ShippingBillDate: this.parseDateValue(row['Shipping Bill Date']),
        GrossWeight: grossWeight,
        NetWeight: this.getDecimalValue(row['Product Net Weight']),
        Volume: this.getDecimalValue(row['Product Volume']),
        IsHaz: this.getBooleanValue(row['Product Hazardous (Y/N)']),
        UnNo: this.getStringValue(row['UN Number']),
        ImcoClass: this.getStringValue(row['IMCO Class']),
        PkgGroup: this.getStringValue(row['Package Group']),
        MarksAndNumber: this.getStringValue(row['Product Marks']),
        ContainerNo: this.getStringValue(row['Product Container Number']),
      });
    }

    return products;
  }

  /**
   * Parse house job connection data
   */
  private parseHouseConnectionData(row: any): HouseJobConnectionBulkDto[] {
    const connections: HouseJobConnectionBulkDto[] = [];

    const vesselName = this.getStringValue(row['House Vessel Name']);
    const voyageNo = this.getStringValue(row['House Voyage Number']);
    const pol = this.getStringValue(row['House Connection POL']) || this.getStringValue(row['POL']);
    const pod = this.getStringValue(row['House Connection POD']) || this.getStringValue(row['POD']);

    if (vesselName && voyageNo && pol && pod) {
      connections.push({
        POL: pol,
        POD: pod,
        VesselName: vesselName,
        VoyageNo: voyageNo,
        Mode: this.getStringValue(row['House Connection Mode']),
        ETD: this.parseDateValue(row['House Connection ETD']),
        ETA: this.parseDateValue(row['House Connection ETA']),
        Remarks: this.getStringValue(row['House Connection Remarks']),
      });
    }

    return connections;
  }

  /**
   * Parse house job others data
   */
  private parseHouseOthersData(row: any): any {
    const customerRefNo = this.getStringValue(row['Customer Reference Number']);

    if (!customerRefNo) {
      return null;
    }

    return {
      CustomerRefNo: customerRefNo,
      NotifyParty: this.getStringValue(row['Notify Party']),
      NotifyPartyAddress: this.getStringValue(row['Notify Address']),
      CHAName: this.getStringValue(row['CHA Name']),
      YardCFS: this.getStringValue(row['Yard/CFS']),
      PickupPlace: this.getStringValue(row['Pickup Place']),
      PickupDate: this.parseDateValue(row['Pickup Date']),
      PickupAddress: this.getStringValue(row['Pickup Address']),
      DeliveryPlace: this.getStringValue(row['Delivery Place']),
      DeliveryDate: this.getStringValue(row['Delivery Date']),
      DeliveryAddress: this.getStringValue(row['Delivery Address']),
      CargoCurrency: this.getStringValue(row['Cargo Currency']),
      CargoValue: this.getDecimalValue(row['Cargo Value']),
      LocalTransport: this.getBooleanValue(row['Local Transport (Y/N)']),
      OverseasTransport: this.getBooleanValue(row['Overseas Transport (Y/N)']),
      TransporterName: this.getStringValue(row['Transporter Name']),
    };
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
      'Master Job Number',
      'Master Job Date',
      'Freight PP/CC',
      'POO (Port of Origin)',
      'POL (Port of Loading)',
      'POD (Port of Discharge)',
      'FPD (Final Place of Delivery)',
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
      'MJ-2025-001',
      '2025-01-15',
      'Prepaid',
      'Chennai',
      'INMAA1',
      'USNYC1',
      'New York',
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
      'Booking Number',
      'HBL Number',
      'Shipment Number',
      'Customer Name',
      'Customer Address',
      'Inco Terms',
      'Shipper Name',
      'Shipper Address',
      'Consignee Name',
      'Consignee Address',
      'POL',
      'POD',
      'FPD',
      'POO',
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
      'BK-2025-001',
      'HBL-123456',
      'SHIP-001',
      'ABC Company',
      '456 Customer St',
      'FOB',
      'Shipper Inc',
      '789 Shipper Ave',
      'Consignee Ltd',
      '321 Consignee Rd',
      'INMAA1',
      'USNYC1',
      'New York',
      'Chennai',
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

    // Generate buffer
    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
    return buffer;
  }
}
