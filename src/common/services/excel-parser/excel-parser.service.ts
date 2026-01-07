import { Injectable, Logger, BadRequestException, Inject } from '@nestjs/common';
import * as XLSX from 'xlsx';
import * as ExcelJS from 'exceljs';
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
import { DatabaseService } from 'src/database/database.service';

@Injectable()
export class ExcelParserService {
  private readonly logger = new Logger(ExcelParserService.name);
  constructor(
     @Inject(DatabaseService) // Inject DatabaseService
        private readonly db: DatabaseService,
  ) {}
  private isExampleRowGeneric(row: any): boolean {
  if (!row) return true;

  const values = Object.values(row)
    .map(v => (v ? String(v).toUpperCase() : ''));

  const examplePatterns = [
    'SAMPLE',
    'EXAMPLE',
    'DEMO',
    'MBL123',
    'SHIP-001',
    'HBL-001',
    'TCLU1234567',
    'ELECTRONIC',
    'ABC COMPANY'
  ];

  return values.some(val =>
    examplePatterns.some(p => val.includes(p))
  );
}


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

      // Helper to find sheet with fallback names (for backward compatibility)
      const findSheet = (primaryName: string, ...fallbackNames: string[]): string | null => {
        if (workbook.SheetNames.includes(primaryName)) return primaryName;
        for (const name of fallbackNames) {
          if (workbook.SheetNames.includes(name)) return name;
        }
        return null;
      };

      // Find required sheets with backward compatibility
      const masterJobSheetName = findSheet('Master Job');
      const houseJobsSheetName = findSheet('House Job', 'House Jobs'); // New template uses "House Job"

      // Validate required sheets exist
      if (!masterJobSheetName) {
        errors.push({
          field: 'Sheet',
          message: 'Required sheet "Master Job" not found',
          sheet: 'Master Job',
        });
      }

      if (!houseJobsSheetName) {
        errors.push({
          field: 'Sheet',
          message: 'Required sheet "House Job" or "House Jobs" not found',
          sheet: 'House Job',
        });
      }

      if (errors.length > 0) {
        return { masterJob: null, containers: [], voyages: [], connections: [], others: null, houseJobs: [], errors };
      }

      // Parse Master Job sheet (TypeScript null assertion safe due to validation above)
      const masterJobSheet = workbook.Sheets[masterJobSheetName!];
      const masterJobData = XLSX.utils.sheet_to_json(masterJobSheet, {
        defval: null,
        raw: false,
      });

      // Parse House Jobs sheet (TypeScript null assertion safe due to validation above)
      const houseJobsSheet = workbook.Sheets[houseJobsSheetName!];
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
          message: 'House Job sheet contains no data (at least one house job required)',
          sheet: houseJobsSheetName!,
        });
      }

      if (errors.length > 0) {
        return { masterJob: null, containers: [], voyages: [], connections: [], others: null, houseJobs: [], errors };
      }

      // Parse master job (first row only)
      const masterJob = this.parseMasterJobRow(masterJobData[0], errors);

      // Parse Containers sheet (optional) - supports both "Container" and "Containers"
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
        // NoOfPkg: this.getNumberValue(row['Number of Packages']),
        // GrossWeight: this.getDecimalValue(row['Gross Weight']),
        // NetWeight: this.getDecimalValue(row['Net Weight']),
        // Volume: this.getDecimalValue(row['Volume (CBM)']),
        // ChargeableWeight: this.getDecimalValue(row['Chargeable Weight']),
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
        // POL: this.getStringValue(row['POL (Port Code)']),
        // POD: this.getStringValue(row['POD (Port Code)']),
        // FPD: this.getStringValue(row['FPD (Port Code)']),
        // POO: this.getStringValue(row['POO (Port Code)']),
        // ETD: this.parseDateValue(row['ETD']),
        // ETA: this.parseDateValue(row['ETA']),
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
   * Parse Containers sheet (supports both "Container" and "Containers" sheet names)
   */
  private parseContainersSheet(workbook: XLSX.WorkBook, errors: BulkUploadValidationError[]): any[] {
    // Support both new ("Container") and old ("Containers") sheet names
    const sheetName = workbook.SheetNames.includes('Container') ? 'Container' :
                      workbook.SheetNames.includes('Containers') ? 'Containers' : null;
    if (!sheetName) {
      return [];
    }

  try {
    const containersSheet = workbook.Sheets[sheetName];

    const containersData = XLSX.utils.sheet_to_json(containersSheet, {
      defval: null,
      raw: false
    });

    // ✅ ADD THIS FILTER HERE (THIS IS THE EXACT LINE)
    const validContainers = containersData.filter(
      (row: any) => !this.isExampleRowGeneric(row)
    );

    // ✅ MAP ONLY VALID ROWS
    return validContainers.map((row: any) => ({
      ContainerNumber: this.getStringValue(row['Container Number']),
      ContainerType: this.getNumberValue(row['Container Type']),
      LineSeal: this.getStringValue(row['Line Seal']),
      CustomsSeal: this.getStringValue(row['Customs Seal']),
      HsCode: this.getStringValue(row['HS Code']),
      CommodityDescription: this.getStringValue(row['Commodity Description']),
      PkgType: this.getNumberValue(row['Package Type']),
      // NoOfPkg: this.getNumberValue(row['No of Packages']),
      // GrossWeight: this.getDecimalValue(row['Gross Weight']),
      // NetWeight: this.getDecimalValue(row['Net Weight']),
      ChargeableWeight: this.getDecimalValue(row['Chargeable Weight']),
      // Volume: this.getDecimalValue(row['Volume (CBM)']),
      IsSoc: this.getBooleanValue(row['Is SOC (Y/N)']),
    }));

  } catch (error) {
    errors.push({
      field: 'Sheet',
      message: `Error parsing Containers sheet: ${error.message}`,
      sheet: sheetName,
    });
    return [];
  }
}


  /**
   * Parse Master Voyages sheet
   */
 private parseMasterVoyagesSheet(
  workbook: XLSX.WorkBook,
  errors: BulkUploadValidationError[]
): any[] {

  if (!workbook.SheetNames.includes('Master Voyages')) {
    return [];
  }

  try {
    const voyagesSheet = workbook.Sheets['Master Voyages'];

    const voyagesData = XLSX.utils.sheet_to_json(voyagesSheet, {
      defval: null,
      raw: false
    });

    // ✅ FILTER EXAMPLE ROW HERE
    const validVoyages = voyagesData.filter(
      (row: any) => !this.isExampleRowGeneric(row)
    );

    return validVoyages.map((row: any) => ({
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
      const connectionsData = XLSX.utils.sheet_to_json(connectionsSheet, {
  defval: null,
  raw: false
});

// ✅ FILTER EXAMPLE ROW HERE
const validConnections = connectionsData.filter(
  (row: any) => !this.isExampleRowGeneric(row)
);

return validConnections.map((row: any) => ({
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
   * Parse Master Others sheet (handles typo "Maser Others" for backward compatibility)
   */
  private parseMasterOthersSheet(workbook: XLSX.WorkBook, errors: BulkUploadValidationError[]): any {
    // Support both correct ("Master Others") and typo ("Maser Others") sheet names
    const sheetName = workbook.SheetNames.includes('Master Others') ? 'Master Others' :
                      workbook.SheetNames.includes('Maser Others') ? 'Maser Others' : null;
    if (!sheetName) {
      return null;
    }

    try {
      const othersSheet = workbook.Sheets[sheetName];
     const othersData = XLSX.utils.sheet_to_json(othersSheet, {
  defval: null,
  raw: false
});

// ✅ REMOVE EXAMPLE ROW
const validRow = othersData.find(
  (row: any) => !this.isExampleRowGeneric(row)
);

if (!validRow) {
  return null;
}

return {
  // Yard: this.getStringValue(validRow['Yard']),
  // YardAddress: this.getStringValue(validRow['Yard Address']),
  Transporter: this.getStringValue(validRow['Transporter']),
  HandlingInformation: this.getStringValue(validRow['Handling Information']),
  InternalNote: this.getStringValue(validRow['Internal Note']),
  // CFS: this.getStringValue(validRow['CFS']),
  // CFSAddress: this.getStringValue(validRow['CFS Address']),
  StuffingStartDate: this.parseDateValue(validRow['Stuffing Start Date']),
  StuffingEndDate: this.parseDateValue(validRow['Stuffing End Date']),
  CurrencyCode: this.getStringValue(validRow['Currency Code']),
  SellExchangeRate: this.getDecimalValue(validRow['Sell Exchange Rate']),
  AgentExchangeRate: this.getDecimalValue(validRow['Agent Exchange Rate']),
  Coload: this.getBooleanValue(validRow['Coload (Y/N)']),
  CoLoader: this.getStringValue(validRow['Co Loader']),
  ExportDoNo: this.getStringValue(validRow['Export DO Number']),
  ExportDoDate: this.parseDateValue(validRow['Export DO Date']),
  SOBDate: this.parseDateValue(validRow['SOB Date']),
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
    if (!shipmentNo) {
      return [];
    }
    // Sheet name is the same in both old and new templates
    if (!workbook.SheetNames.includes('House Cargo')) {
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
   * Parse House Products sheet for specific shipment (supports both "House Product" and "House Products")
   */
  private parseHouseProductsForShipment(workbook: XLSX.WorkBook, shipmentNo: string, errors: BulkUploadValidationError[]): any[] {
    if (!shipmentNo) {
      return [];
    }
    // Support both new ("House Product") and old ("House Products") sheet names
    const sheetName = workbook.SheetNames.includes('House Product') ? 'House Product' :
                      workbook.SheetNames.includes('House Products') ? 'House Products' : null;
    if (!sheetName) {
      return [];
    }

    try {
      const productsSheet = workbook.Sheets[sheetName];
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
   * Generate Excel template for download with dropdown support
   */
  async generateTemplate(): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    const DROPDOWN_ROWS = 100; // Apply dropdown validation to rows 2-100

    // ===== CREATE MAIN DATA SHEETS FIRST =====

    // 1. Master Job Sheet
    const masterJobSheet = workbook.addWorksheet('Master Job');
    const masterJobHeaders = [
      'MBL Number', 'MBL Date', 'Master Job Date', 'Department', 'Freight PP/CC',
      'Destination Agent', 'Agent Address', 'POO (Port Code)', 'POL (Port Code)',
      'POD (Port Code)', 'FPD (Port Code)', 'POL Terminal', 'POD Terminal',
      'Movement Type', 'Shipment Terms', 'BL Release Type', 
      // 'Number of Packages','Gross Weight', 'Net Weight', 'Volume (CBM)', 'Chargeable Weight',
      'Commodity Description', 'Marks and Number', 'Haz'
    ];
    masterJobSheet.addRow(masterJobHeaders);
    // Sample row
    masterJobSheet.addRow([
      'MBL123456', '2025-01-20', '2025-01-15', 'FCL Export', 'Prepaid',
      'ABC Logistics', '123 Main St', 'INCCU', 'INCCU', 'AEJEA', 'AEJEA',
      'DP World', 'Sical', 'FCL', 'FCL/FCL', 'Original',
      //  10, 5000, 4800,
      // 25.5, 5000, 
      'Electronic Goods', 'Sample Marks', 'N'
    ]);
    this.styleHeaderRow(masterJobSheet);
    this.setColumnWidths(masterJobSheet, masterJobHeaders.length, 15);
    // Apply dropdowns to Master Job
    this.applyDropdownValidation(masterJobSheet, 'D', 2, DROPDOWN_ROWS, "'Master Data'!$A$2:$A$5"); // Department
    this.applyDropdownValidation(masterJobSheet, 'E', 2, DROPDOWN_ROWS, "'Master Data'!$B$2:$B$3"); // Freight PP/CC
    this.applyDropdownValidation(masterJobSheet, 'O', 2, DROPDOWN_ROWS, "'Master Data'!$G$2:$G$8"); // Shipment Terms
    this.applyDropdownValidation(masterJobSheet, 'P', 2, DROPDOWN_ROWS, "'Master Data'!$C$2:$C$5"); // BL Release Type
    this.applyDropdownValidation(masterJobSheet, 'X', 2, DROPDOWN_ROWS, "'Master Data'!$E$2:$E$3"); // Haz

    // 2. Master Voyages Sheet
    const masterVoyagesSheet = workbook.addWorksheet('Master Voyages');
    const masterVoyagesHeaders = [
      'MBL Number', 'Vessel', 'Voyage', 'ETD', 'ETA', 'ATA', 'ATD', 'Carrier'
    ];
    masterVoyagesSheet.addRow(masterVoyagesHeaders);
    masterVoyagesSheet.addRow(['MBL123456', 'MSC EMMA', 'V123', '2025-01-25', '2025-02-15', '2025-02-16', '2025-01-26', 'MSC']);
    this.styleHeaderRow(masterVoyagesSheet);
    this.setColumnWidths(masterVoyagesSheet, masterVoyagesHeaders.length, 15);

    // 3. Master Others Sheet
    const masterOthersSheet = workbook.addWorksheet('Master Others');
    const masterOthersHeaders = [
      'MBL Number', 
      // 'Yard', 'Yard Address', 
      'Transporter', 'Handling Information',
      'Internal Note', 'Carrier Ref', 'Agent Ref', 'Origin Agent', 
      // 'CFS', 'CFS Address',
      'Stuffing Start Date', 'Stuffing End Date', 'Currency Code', 'Sell Exchange Rate',
      'Agent Exchange Rate', 'Coload (Y/N)', 'Co Loader', 'Export DO Number',
      'Export DO Date', 'SOB Date', 'CHA Name'
    ];
    masterOthersSheet.addRow(masterOthersHeaders);
    masterOthersSheet.addRow([
      'MBL123456', 
      // 'Chennai Yard', '123 Yard St',
       'ABC Transport', 'Handle with care',
      'Priority shipment', 'CR001', 'AR001', 'Origin Agent Co',
      //  'Chennai CFS', '456 CFS Ave',
      '2025-01-20', '2025-01-22', 'USD', 83.50, 83.00, 'N', '', 'DO123456',
      '2025-01-18', '2025-01-15', 'CHA Company'
    ]);
    this.styleHeaderRow(masterOthersSheet);
    this.setColumnWidths(masterOthersSheet, masterOthersHeaders.length, 15);
    // Apply dropdown for Coload
    this.applyDropdownValidation(masterOthersSheet, 'Q', 2, DROPDOWN_ROWS, "'Master Data'!$F$2:$F$3"); // Coload

    // 4. Container Sheet
    const containerSheet = workbook.addWorksheet('Container');
    const containerHeaders = [
      'MBL Number', 'Container Type', 'Container Number', 'Line Seal', 'Custom Seal',
      'HS Code', 'Commodity Description', 'Package Type', 
      // 'No of Packages',
      // 'Gross Weight', 'Net Weight', 
      'Chargeable Weight', 'Is SOC (Y/N)'
    ];
    containerSheet.addRow(containerHeaders);
    containerSheet.addRow([
      'MBL123456', '40ft Container', 'TCLU1234567', 'MSC001', 'CUST001',
      '8471.30', 'Electronic Equipment', 'Pallet',
      //  100, 5000, 4800,
        5000, 
       'N'
    ]);
    this.styleHeaderRow(containerSheet);
    this.setColumnWidths(containerSheet, containerHeaders.length, 15);
    // Apply dropdowns
    this.applyDropdownValidation(containerSheet, 'B', 2, DROPDOWN_ROWS, "'Container Data'!$A$2:$A$9"); // Container Type
    this.applyDropdownValidation(containerSheet, 'H', 2, DROPDOWN_ROWS, "'Container Data'!$B$2:$B$4"); // Package Type

    // 5. House Job Sheet
    const houseJobSheet = workbook.addWorksheet('House Job');
    const houseJobHeaders = [
      'MBL Number', 'HBL No', 'HBL Date', 'Shipment Number', 'Customer Name',
      'Customer Address', 'Shipper Name', 'Shipper Address', 'Consignee Name',
      'Consignee Address',
      //  'POO (Port Code)', 'POL (Port Code)', 'POD (Port Code)',
      // 'FPD (Port Code)', 'ETD', 'ETA', 
      'DeliveryAgent', 'Origin Agent', 'Inco Terms',
      'Freight PP/CC', 'Notify Party', 'Notify Address', 'Carrier', 'Salesperson',
      'Shipment(Job) type', 'Customer Ref No.', 'CFS', 'Release Type', 'Forwarder',
      'Forwarder Address', 'Cargo Currency', 'Cargo Value', 'Values for Insurance',
      'Insurance Amount', 'Handling Information', 'Carrier Booking Ref',
      'Carrier Booking Date', 'Internal Note', 'External Note'
    ];
    houseJobSheet.addRow(houseJobHeaders);
    houseJobSheet.addRow([
      'MBL123456', 'HBL001', '2025-01-15', 'SHIP-001', 'ABC Company', '456 Customer St',
      'Shipper Inc', '789 Shipper Ave', 'Consignee Ltd', '321 Consignee Rd',
      // 'INCCU', 'INCCU', 'AEJEA', 'AEJEA', '2025-01-25', '2025-02-15',
      'Delivery Agent Co', 'Origin Agent Co', 'FOB', 'Prepaid', 'Notify Party Name',
      'Notify Address', 'MSC', 'John Doe', 'Export', 'CREF-001', 'Chennai CFS',
      'Original', 'Forwarder Co', 'Forwarder Address', 'USD', 50000, 50000, 500,
      'Handle with care', 'BKG001', '2025-01-10', 'Internal note', 'External note'
    ]);
    this.styleHeaderRow(houseJobSheet);
    this.setColumnWidths(houseJobSheet, houseJobHeaders.length, 15);
    // Apply dropdowns
    this.applyDropdownValidation(houseJobSheet, 'S', 2, DROPDOWN_ROWS, "'House Data'!$H$2:$H$12"); // Inco Terms
    this.applyDropdownValidation(houseJobSheet, 'T', 2, DROPDOWN_ROWS, "'House Data'!$D$2:$D$3"); // Freight PP/CC
    this.applyDropdownValidation(houseJobSheet, 'AB', 2, DROPDOWN_ROWS, "'House Data'!$B$2:$B$5"); // Release Type

    // 6. House Cargo Sheet
    const houseCargoSheet = workbook.addWorksheet('House Cargo');
    const houseCargoHeaders = [
      'Shipment Number', 'Cargo Type', 'Container Type', 'Container No', 'Gr Weight',
      'Net Weight', 'Volume(CBM)', 'Chargeable Weight', 'No of Pkg', 'Movement Type',
      'Mode of Transport', 'Stuffing At', 'Shipment Terms', 'Goods Description',
      'Marks and Number'
    ];
    houseCargoSheet.addRow(houseCargoHeaders);
    houseCargoSheet.addRow([
      'SHIP-001', 'General', '40ft Container', 'TCLU1234567', 2500, 2400, 12.5,
      2500, 50, 'CY-CFS', 'Vessel', 'Dock', 'FCL/FCL', 'Electronic Goods', 'Sample Marks'
    ]);
    this.styleHeaderRow(houseCargoSheet);
    this.setColumnWidths(houseCargoSheet, houseCargoHeaders.length, 15);
    // Apply dropdowns
    this.applyDropdownValidation(houseCargoSheet, 'B', 2, DROPDOWN_ROWS, "'House Data'!$J$2:$J$6"); // Cargo Type
    this.applyDropdownValidation(houseCargoSheet, 'C', 2, DROPDOWN_ROWS, "'Container Data'!$A$2:$A$9"); // Container Type
    this.applyDropdownValidation(houseCargoSheet, 'J', 2, DROPDOWN_ROWS, "'House Data'!$E$2:$E$9"); // Movement Type
    this.applyDropdownValidation(houseCargoSheet, 'K', 2, DROPDOWN_ROWS, "'House Data'!$A$2:$A$5"); // Mode of Transport
    this.applyDropdownValidation(houseCargoSheet, 'L', 2, DROPDOWN_ROWS, "'House Data'!$F$2:$F$3"); // Stuffing At
    this.applyDropdownValidation(houseCargoSheet, 'M', 2, DROPDOWN_ROWS, "'House Data'!$C$2:$C$8"); // Shipment Terms

    // 7. House Product Sheet
    const houseProductSheet = workbook.addWorksheet('House Product');
    const houseProductHeaders = [
      'Shipment Number', 'Commodity', 'Shipping Bill No', 'Date', 'External Pkg',
      'No. of Pkg', 'Uom', 'Length', 'Width', 'Height', 'Gross Weight', 'Net Wt',
      'Volume', 'Cargo Received Date', 'Container No'
    ];
    houseProductSheet.addRow(houseProductHeaders);
    houseProductSheet.addRow([
      'SHIP-001', 'Electronic Goods', 'SB123456', '2025-01-15', 'Carton',
      20, 'KG', 100, 50, 50, 1000, 950, 5.0, '2025-01-10', 'TCLU1234567'
    ]);
    this.styleHeaderRow(houseProductSheet);
    this.setColumnWidths(houseProductSheet, houseProductHeaders.length, 15);
    // Apply dropdown
    this.applyDropdownValidation(houseProductSheet, 'E', 2, DROPDOWN_ROWS, "'House Data'!$K$2:$K$5"); // External Pkg

    // ===== CREATE REFERENCE SHEETS AT THE END =====

    // Master Data Reference Sheet
    const masterDataSheet = workbook.addWorksheet('Master Data');
    this.createMasterDataSheet(masterDataSheet);

    // Container Data Reference Sheet
    const containerDataSheet = workbook.addWorksheet('Container Data');
    this.createContainerDataSheet(containerDataSheet);

    // House Data Reference Sheet
    const houseDataSheet = workbook.addWorksheet('House Data');
    this.createHouseDataSheet(houseDataSheet);

    // Generate buffer
    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }

  /**
   * Create Master Data reference sheet with dropdown values
   */
  private createMasterDataSheet(sheet: ExcelJS.Worksheet): void {
    const headers = ['Department', 'Freight PP/CC', 'BL Release Type', 'Weight in', 'Haz', 'Coload', 'Shipment Terms'];
    sheet.addRow(headers);

    const data = {
      department: ['FCL Import', 'LCL Import', 'FCL Export', 'LCL Export'],
      freightPPCC: ['Prepaid', 'Collect'],
      blReleaseType: ['Original', 'Express', 'Surrender', 'Sea WayBill'],
      weightIn: ['Kg(s)', 'LB(s)', 'Tonne(s)'],
      haz: ['Y', 'N'],
      coload: ['Yes', 'No'],
      shipmentTerms: ['FCL/FCL', 'FCL/LCL', 'LCL/FCL', 'LCL/LCL', 'LTL', 'FTL', 'FLT HH']
    };

    const maxRows = Math.max(
      data.department.length,
      data.freightPPCC.length,
      data.blReleaseType.length,
      data.weightIn.length,
      data.haz.length,
      data.coload.length,
      data.shipmentTerms.length
    );

    for (let i = 0; i < maxRows; i++) {
      sheet.addRow([
        data.department[i] || '',
        data.freightPPCC[i] || '',
        data.blReleaseType[i] || '',
        data.weightIn[i] || '',
        data.haz[i] || '',
        data.coload[i] || '',
        data.shipmentTerms[i] || ''
      ]);
    }

    this.styleReferenceSheet(sheet);
  }

  /**
   * Create Container Data reference sheet with dropdown values
   */
  private createContainerDataSheet(sheet: ExcelJS.Worksheet): void {
    const headers = ['Container Type', 'Pkg Type'];
    sheet.addRow(headers);

    const data = {
      containerType: ['20ft Standard', '40ft Container', '40 RF', '40 Flat Rack', '20ft Container', '45ft High Cube', '20ft Reefer', '40Ft Open Top'],
      pkgType: ['Pallet', 'Per KG', 'Box']
    };

    const maxRows = Math.max(data.containerType.length, data.pkgType.length);

    for (let i = 0; i < maxRows; i++) {
      sheet.addRow([
        data.containerType[i] || '',
        data.pkgType[i] || ''
      ]);
    }

    this.styleReferenceSheet(sheet);
  }

  /**
   * Create House Data reference sheet with dropdown values
   */
  private createHouseDataSheet(sheet: ExcelJS.Worksheet): void {
    const headers = [
      'Mode of Transport', 'BL Release Type', 'Shipment Terms', 'Freight PP/CC',
      'Movement Type', 'Stuffing At', 'Coload', 'Inco', 'Nominated By', 'Cargo Type', 'External Pkg'
    ];
    sheet.addRow(headers);

    const data = {
      modeOfTransport: ['Vessel', 'Rail', 'Road', 'Flight'],
      blReleaseType: ['Original', 'Express', 'Surrender', 'Sea WayBill'],
      shipmentTerms: ['FCL/FCL', 'FCL/LCL', 'LCL/FCL', 'LCL/LCL', 'LTL', 'FTL', 'FLT HH'],
      freightPPCC: ['Prepaid', 'Collect'],
      movementType: ['CY-CFS', 'CFS-FO', 'CFS-CY', 'CFS-CFS', 'FO-FI', 'Door-Door', 'CY-Door', 'CY-FO'],
      stuffingAt: ['Dock', 'Factory'],
      coload: ['Yes', 'No'],
      inco: ['FAS', 'FOB', 'CIF', 'EXW', 'FCA', 'CPT', 'CIP', 'DAP', 'DDP', 'CFR', 'DPU'],
      nominatedBy: ['Self', 'Nomination'],
      cargoType: ['General', 'Reefer', 'Haz', 'Tanker', 'OOG'],
      externalPkg: ['Box', 'PC', 'Pallet', 'Carton']
    };

    const maxRows = Math.max(
      data.modeOfTransport.length,
      data.blReleaseType.length,
      data.shipmentTerms.length,
      data.freightPPCC.length,
      data.movementType.length,
      data.stuffingAt.length,
      data.coload.length,
      data.inco.length,
      data.nominatedBy.length,
      data.cargoType.length,
      data.externalPkg.length
    );

    for (let i = 0; i < maxRows; i++) {
      sheet.addRow([
        data.modeOfTransport[i] || '',
        data.blReleaseType[i] || '',
        data.shipmentTerms[i] || '',
        data.freightPPCC[i] || '',
        data.movementType[i] || '',
        data.stuffingAt[i] || '',
        data.coload[i] || '',
        data.inco[i] || '',
        data.nominatedBy[i] || '',
        data.cargoType[i] || '',
        data.externalPkg[i] || ''
      ]);
    }

    this.styleReferenceSheet(sheet);
  }

  /**
 * Apply dropdown data validation to a column range
 */
private applyDropdownValidation(
    worksheet: ExcelJS.Worksheet,
    columnLetter: string,
    startRow: number,
    endRow: number,
    formula: string
): void {
    for (let row = startRow; row <= endRow; row++) {
        worksheet.getCell(`${columnLetter}${row}`).dataValidation = {
            type: 'list',
            allowBlank: true,
            formulae: [formula],
            showErrorMessage: true,
            errorStyle: 'error',
            errorTitle: 'Invalid Selection',
            error: 'Please select a value from the dropdown list'
        };
    }
}

  /**
   * Style the header row of a worksheet
   */
  private styleHeaderRow(worksheet: ExcelJS.Worksheet): void {
    const headerRow = worksheet.getRow(1);
    headerRow.font = { bold: true };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFD3D3D3' }
    };
    headerRow.eachCell((cell) => {
      cell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' }
      };
    });
  }

  /**
   * Style reference sheet with header formatting
   */
  private styleReferenceSheet(worksheet: ExcelJS.Worksheet): void {
    const headerRow = worksheet.getRow(1);
    headerRow.font = { bold: true };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE0E0E0' }
    };
    // Auto-fit column widths
    worksheet.columns.forEach((column) => {
      column.width = 18;
    });
  }

  /**
   * Set column widths for a worksheet
   */
  private setColumnWidths(worksheet: ExcelJS.Worksheet, columnCount: number, defaultWidth: number): void {
    for (let i = 1; i <= columnCount; i++) {
      worksheet.getColumn(i).width = defaultWidth;
    }
  }

  async generateContainerTemplate(): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();

  // ===============================
  // Container Sheet
  // ===============================
  const containerSheet = workbook.addWorksheet('Containers');

  const headers = [
    'Container Type',
    'Container Number',
    'Line Seal',
    'Customs Seal',
    'HS Code',
    'Commodity Description',
    'Package Type',
    'Chargeable Weight',
    'Is SOC (Y/N)'
  ];

  // Add header
  containerSheet.addRow(headers);

  // ===============================
  // STYLE HEADER (DEFAULT)
  // ===============================
  const headerRow = containerSheet.getRow(1);
  headerRow.font = { bold: true };
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFE0E0E0' } // Grey
  };

  // ===============================
  // MARK MANDATORY COLUMNS (RED)
  // ===============================
  const mandatoryColumns = ['A', 'B']; // Container Type, Container Number

  mandatoryColumns.forEach(col => {
    const cell = containerSheet.getCell(`${col}1`);
    cell.font = {
      bold: true,
      color: { argb: 'FFFF0000' } // Red text
    };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFFFE5E5' } // Light red bg
    };
  });

  // ===============================
  // SAMPLE / EXAMPLE ROW (ROW 2)
  // ===============================
  containerSheet.addRow([
    '20ft Reefer',
    'ABCD1234567',
    'LINE001',
    'CUST001',
    '251299',
    'Electronic Equipment',
    'Pallet',
    0.0,
    'N'
  ]);

  const exampleRow = containerSheet.getRow(2);
  exampleRow.eachCell(cell => {
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFEAF2FB' } // Light blue
    };
    cell.font = {
      italic: true,
      color: { argb: 'FF555555' }
    };
  });
  exampleRow.commit();

  // ===============================
  // FETCH DROPDOWN DATA
  // ===============================
  const containerTypes = await this.db.containerTypeMaster.findMany({
    where: { status: 'A' },
    select: { ContainerTypeMasterSid: true, ContainerName: true }
  });

  const packageTypes = await this.db.uOMMaster.findMany({
    where: { UOMType: 'P', status: 'A' },
    select: { UOMMasterSid: true, UOMName: true }
  });

  // ===============================
  // REFERENCE SHEETS
  // ===============================
  const containerRefSheet = workbook.addWorksheet('Container Types');
  containerRefSheet.addRow(['ID', 'Container Type Name']);
  containerTypes.forEach(t =>
    containerRefSheet.addRow([t.ContainerTypeMasterSid, t.ContainerName])
  );

  const packageRefSheet = workbook.addWorksheet('Package Types');
  packageRefSheet.addRow(['ID', 'Package Type Name']);
  packageTypes.forEach(p =>
    packageRefSheet.addRow([p.UOMMasterSid, p.UOMName])
  );

  // ===============================
  // APPLY DROPDOWNS
  // ===============================
  const containerTypeFormula =
    `'Container Types'!$B$2:$B$${containerTypes.length + 1}`;
  const packageTypeFormula =
    `'Package Types'!$B$2:$B$${packageTypes.length + 1}`;

  this.applyDropdownValidation(containerSheet, 'A', 2, 1000, containerTypeFormula);
  this.applyDropdownValidation(containerSheet, 'G', 2, 1000, packageTypeFormula);
  this.applyDropdownValidation(containerSheet, 'I', 2, 1000, '"Y,N"');
// ===============================
// APPLY DROPDOWNS
// ===============================
this.applyDropdownValidation(containerSheet, 'A', 2, 1000, containerTypeFormula);
this.applyDropdownValidation(containerSheet, 'G', 2, 1000, packageTypeFormula);
this.applyDropdownValidation(containerSheet, 'I', 2, 1000, '"Y,N"');

// ==================================================
// CONTAINER NUMBER VALIDATION (Column B | Row 3+)
// ==================================================
for (let row = 3; row <= 1000; row++) {
  containerSheet.getCell(`B${row}`).dataValidation = {
    type: 'custom',
    allowBlank: true,
    formulae: [
      'AND(' +
        'LEN(B' + row + ')=11,' +
        'ISNUMBER(--RIGHT(B' + row + ',7)),' +
        'CODE(LEFT(B' + row + ',1))>=65,' +
        'CODE(LEFT(B' + row + ',1))<=90,' +
        'CODE(MID(B' + row + ',2,1))>=65,' +
        'CODE(MID(B' + row + ',2,1))<=90,' +
        'CODE(MID(B' + row + ',3,1))>=65,' +
        'CODE(MID(B' + row + ',3,1))<=90,' +
        'CODE(MID(B' + row + ',4,1))>=65,' +
        'CODE(MID(B' + row + ',4,1))<=90' +
      ')'
    ],
    showErrorMessage: true,
    errorTitle: 'Invalid Container Number',
    error: 'Container No must be 11 characters (4 letters + 7 digits). Example: ABCD1234567'
  };
}

  // ===============================
  // COLUMN WIDTHS
  // ===============================
  const columnWidths = [20, 22, 15, 15, 15, 30, 20, 18, 15];
  columnWidths.forEach((w, i) => {
    containerSheet.getColumn(i + 1).width = w;
  });

  // ===============================
  // INSTRUCTIONS SHEET
  // ===============================
  const instructionsSheet = workbook.addWorksheet('Instructions');

instructionsSheet.addRow(['Container Upload Template - Instructions']);
instructionsSheet.addRow([]);

instructionsSheet.addRow(['MANDATORY FIELDS']);
instructionsSheet.addRow(['• Columns highlighted in RED are mandatory']);
instructionsSheet.addRow(['• Container Type and Container Number are required']);
instructionsSheet.addRow([]);

instructionsSheet.addRow(['CONTAINER NUMBER FORMAT']);
instructionsSheet.addRow(['• Must be exactly 11 characters']);
instructionsSheet.addRow(['• First 4 characters must be letters (A–Z)']);
instructionsSheet.addRow(['• Last 7 characters must be numbers (0–9)']);
instructionsSheet.addRow(['• Example: ABCD1234567']);
instructionsSheet.addRow([]);

instructionsSheet.addRow(['DATA ENTRY RULES']);
instructionsSheet.addRow(['• Row 2 is an example – DO NOT EDIT']);
instructionsSheet.addRow(['• Start entering data from row 3']);
instructionsSheet.addRow(['• Use dropdowns where available']);
instructionsSheet.addRow(['• Excel will show an error for invalid Container Numbers']);
instructionsSheet.addRow([]);

instructionsSheet.addRow(['NOTE']);
instructionsSheet.addRow(['• Reference sheets are hidden and used only for dropdowns']);
instructionsSheet.addRow(['• Excel file is NOT protected']);

instructionsSheet.columns.forEach(col => (col.width = 80));


  // ===============================
  // HIDE REFERENCE SHEETS
  // ===============================
  containerRefSheet.state = 'hidden';
  packageRefSheet.state = 'hidden';

  // ===============================
  // RETURN FILE
  // ===============================
  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

  /**
   * Parse Excel file specifically for containers
   */

  async parseContainerExcelFile(buffer: Buffer): Promise<{
    containers: any[];
    errors: any[];
  }> {
    try {
      const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true });
      const errors: any[] = [];

      // Find container sheet (case-insensitive)
      const sheetNames = workbook.SheetNames;
      const containerSheetName = sheetNames.find(name =>
        name.toLowerCase().includes('container')
      );

      if (!containerSheetName) {
        errors.push({
          field: 'Sheet',
          message: 'Container sheet not found in Excel file',
          sheet: 'Containers'
        });
        return { containers: [], errors };
      }

      const containerSheet = workbook.Sheets[containerSheetName];
      const containerData = XLSX.utils.sheet_to_json(containerSheet, {
        defval: null,
        raw: false,
        header: 1 // Get raw data
      });

      // Remove header row (first row)
      containerData.shift();

      // Fetch container types to map names to IDs
      const containerTypes = await this.db.containerTypeMaster.findMany({
        where: { status: 'A' },
        select: { ContainerTypeMasterSid: true, ContainerName: true }
      });

      // Fetch package types to map names to IDs
      const packageTypes = await this.db.uOMMaster.findMany({
        where: { UOMType: 'P', status: 'A' },
        select: { UOMMasterSid: true, UOMName: true }
      });

      // Parse container data, skipping empty rows
      const containers = containerData
        .filter((row: any, index) => {
          // Skip empty rows or rows with no container number
          const containerNumber = row[1]; // Container Number is at index 1
          return containerNumber && containerNumber.toString().trim() !== '';
        })
        .map((row: any, index) => {
          try {
            const containerTypeName = this.getStringValue(row[0]); // Container Type Name
            const packageTypeName = this.getStringValue(row[6]); // Package Type Name

            // Convert container type name to ID
            let containerTypeId: number | null = null;
            if (containerTypeName) {
              const containerType = containerTypes.find(
                ct => ct.ContainerName === containerTypeName
              );
              containerTypeId = containerType ? containerType.ContainerTypeMasterSid : null;
            }

            // Convert package type name to ID
            let packageTypeId: number | null = null;
            if (packageTypeName) {
              const packageType = packageTypes.find(
                pt => pt.UOMName === packageTypeName
              );
              packageTypeId = packageType ? packageType.UOMMasterSid : null;
            }

            return {
              ContainerType: containerTypeId, // Container Type ID
              ContainerNumber: this.getStringValue(row[1]), // Container Number
              LineSeal: this.getStringValue(row[2]), // Line Seal
              CustomsSeal: this.getStringValue(row[3]), // Customs Seal
              HsCode: this.getStringValue(row[4]), // HS Code
              CommodityDescription: this.getStringValue(row[5]), // Commodity Description
              PkgType: packageTypeId, // Package Type ID
              // NoOfPkg: this.getNumberValue(row[7]), 
              // GrossWeight: this.getDecimalValue(row[8]), 
              // NetWeight: this.getDecimalValue(row[9]), 
              ChargeableWeight: this.getDecimalValue(row[7]), // Chargeable Weight
              // Volume: this.getDecimalValue(row[11]),
              IsSoc: this.getBooleanValue(row[8]) // Is SOC
            };
          } catch (error) {
            errors.push({
              field: 'Row',
              message: `Error parsing row ${index + 2}: ${error.message}`,
              row: index + 2,
              containerNumber: row[1] || 'N/A'
            });
            return null;
          }
        })
        .filter(container => container !== null);

      return { containers, errors };

    } catch (error) {
      this.logger.error(`Error parsing container Excel file: ${error.message}`, error.stack);
      throw new BadRequestException('Invalid Excel file format for containers');
    }
  }

  /**
   * Generate Product Excel template for Master Job
   */
async generateProductTemplate(masterJobSid: number): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();

  // ===============================
  // PRODUCT SHEET
  // ===============================
  const productSheet = workbook.addWorksheet('Products');

  const headers = [
    'HBL Number',
    'Product Name',
    'HS Code',
    'Shipping Bill No',
    'Shipping Bill Date',
    'Package Type',
    'No of Pkg',
    'UOM',
    'Length',
    'Width',
    'Height',
    'Volumetric',
    'Volume (CBM)',
    'Gross Weight',
    'Net Weight',
    'Cargo Received Date',
    'Received Qty',
    'Damage Qty',
    'Damage Remarks',
    'Container ID',
    'Delivery Date',
    'Delivered Qty',
    'Is Haz (Y/N)',
    'IMCO Class',
    'UN Number',
    'Package Group'
  ];

  productSheet.addRow(headers);

  // ===============================
  // HEADER STYLE (SAME AS CONTAINER)
  // ===============================
  const headerRow = productSheet.getRow(1);
  headerRow.font = { bold: true };
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFE0E0E0' } // Grey
  };

  // ===============================
  // MARK MANDATORY COLUMNS (RED)
  // A = HBL, G = No of Pkg, N = Gross Wt, O = Net Wt
  // ===============================
  const mandatoryColumns = ['A', 'G', 'N', 'O'];

  mandatoryColumns.forEach(col => {
    const cell = productSheet.getCell(`${col}1`);
    cell.font = {
      bold: true,
      color: { argb: 'FFFF0000' }
    };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFFFE5E5' }
    };
  });

  // ===============================
  // FETCH DROPDOWN DATA
  // ===============================
  const hblNumbers = await this.db.houseJob.findMany({
    where: { MasterJobSid: masterJobSid, status: 'A' },
    select: { HBLNo: true }
  });

  const products = await this.db.productMaster.findMany({
    where: { status: 'A' },
    select: { ProductName: true }
  });

  const packageTypes = await this.db.uOMMaster.findMany({
    where: { UOMType: 'P', status: 'A' },
    select: { UOMName: true }
  });

  const imcoClasses = await this.db.imcoMaster.findMany({
    where: { status: 'A' },
    select: { ImcoName: true }
  });

  const containers = await this.db.masterJobContainer.findMany({
    where: { MasterJobSid: masterJobSid, Status: 'A' },
    select: { ContainerNumber: true }
  });

  // ===============================
  // SAMPLE / EXAMPLE ROW (ROW 2)
  // ===============================
  productSheet.addRow([
    hblNumbers[0]?.HBLNo || 'HBL-001',
    products[0]?.ProductName || 'Electronics',
    '85171200',
    'SB-2024-001',
    '2024-01-15',
    packageTypes[0]?.UOMName || 'Carton',
    10,
    'CM',
    50,
    40,
    30,
    0.6,
    0.06,
    500,
    480,
    '2024-01-20',
    10,
    0,
    'None',
    containers[0]?.ContainerNumber || '',
    '2024-02-01',
    10,
    'N',
    imcoClasses[0]?.ImcoName || 'Class 9',
    'UN3077',
    'Group II'
  ]);

  const exampleRow = productSheet.getRow(2);
  exampleRow.eachCell(cell => {
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFEAF2FB' } // Light blue
    };
    cell.font = {
      italic: true,
      color: { argb: 'FF555555' }
    };
  });
  exampleRow.commit();

  // ===============================
  // REFERENCE SHEETS
  // ===============================
  const hblRef = workbook.addWorksheet('HBL Numbers');
  hblRef.addRow(['HBL Number']);
  hblNumbers.forEach(h => hblRef.addRow([h.HBLNo]));

  const productRef = workbook.addWorksheet('Product Names');
  productRef.addRow(['Product Name']);
  products.forEach(p => productRef.addRow([p.ProductName]));

  const pkgRef = workbook.addWorksheet('Package Types');
  pkgRef.addRow(['Package Type']);
  packageTypes.forEach(p => pkgRef.addRow([p.UOMName]));

  const imcoRef = workbook.addWorksheet('IMCO Classes');
  imcoRef.addRow(['IMCO Class']);
  imcoClasses.forEach(i => imcoRef.addRow([i.ImcoName]));

  const containerRef = workbook.addWorksheet('Containers');
  containerRef.addRow(['Container Number']);
  containers.forEach(c => containerRef.addRow([c.ContainerNumber]));

  // ===============================
  // APPLY DROPDOWNS
  // ===============================
  this.applyDropdownValidation(productSheet, 'A', 2, 1000, `'HBL Numbers'!$A$2:$A$${hblNumbers.length + 1}`);
  this.applyDropdownValidation(productSheet, 'B', 2, 1000, `'Product Names'!$A$2:$A$${products.length + 1}`);
  this.applyDropdownValidation(productSheet, 'F', 2, 1000, `'Package Types'!$A$2:$A$${packageTypes.length + 1}`);
  this.applyDropdownValidation(productSheet, 'X', 2, 1000, `'IMCO Classes'!$A$2:$A$${imcoClasses.length + 1}`);
  this.applyDropdownValidation(productSheet, 'T', 2, 1000, `'Containers'!$A$2:$A$${containers.length + 1}`);
  this.applyDropdownValidation(productSheet, 'W', 2, 1000, '"Y,N"');

  // ===============================
  // COLUMN WIDTHS
  // ===============================
  const widths = [20,25,15,20,15,15,12,10,10,10,10,12,12,12,12,15,12,12,20,15,15,12,10,15,15,15];
  widths.forEach((w, i) => productSheet.getColumn(i + 1).width = w);
// ===============================
// INSTRUCTIONS SHEET
// ===============================
const instructionsSheet = workbook.addWorksheet('Instructions');

instructionsSheet.addRow(['Product Upload Template - Instructions']);
instructionsSheet.addRow([]);

instructionsSheet.addRow(['MANDATORY FIELDS']);
instructionsSheet.addRow(['• Columns highlighted in RED are mandatory']);
instructionsSheet.addRow(['• HBL Number is mandatory']);
instructionsSheet.addRow(['• No of Pkg is mandatory']);
instructionsSheet.addRow(['• Gross Weight is mandatory']);
instructionsSheet.addRow(['• Net Weight is mandatory']);
instructionsSheet.addRow([]);

instructionsSheet.addRow(['DATA ENTRY RULES']);
instructionsSheet.addRow(['• Row 2 is an example – DO NOT EDIT']);
instructionsSheet.addRow(['• Start entering data from row 3']);
instructionsSheet.addRow(['• Use dropdowns wherever available']);
instructionsSheet.addRow(['• Numeric fields must contain numbers only']);
instructionsSheet.addRow([]);

instructionsSheet.addRow(['WEIGHT RULES']);
instructionsSheet.addRow(['• Gross Weight must be greater than or equal to Net Weight']);
instructionsSheet.addRow(['• All weights must be positive values']);
instructionsSheet.addRow([]);

instructionsSheet.addRow(['DATE FORMAT']);
instructionsSheet.addRow(['• Use date format: YYYY-MM-DD']);
instructionsSheet.addRow(['• Invalid date formats may cause upload failure']);
instructionsSheet.addRow([]);

instructionsSheet.addRow(['HAZARDOUS CARGO']);
instructionsSheet.addRow(['• If Is Haz = Y, IMCO Class and UN Number should be filled']);
instructionsSheet.addRow(['• If Is Haz = N, IMCO Class and UN Number can be empty']);
instructionsSheet.addRow([]);

instructionsSheet.addRow(['NOTE']);
instructionsSheet.addRow(['• Reference sheets are hidden and used only for dropdowns']);
instructionsSheet.addRow(['• Only fill data in the "Products" sheet']);
instructionsSheet.addRow(['• Excel file is NOT protected']);

instructionsSheet.columns.forEach(col => (col.width = 80));

  // ===============================
  // HIDE REFERENCE SHEETS
  // ===============================
  [hblRef, productRef, pkgRef, imcoRef, containerRef].forEach(s => s.state = 'hidden');

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}


  /**
   * Parse Excel file for products
   */
async parseProductExcelFile(buffer: Buffer): Promise<{
  products: any[];
  errors: any[];
}> {
  try {
    const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true });
    const errors: any[] = [];

    // Find product sheet (case-insensitive)
    const sheetNames = workbook.SheetNames;
    const productSheetName = sheetNames.find(name =>
      name.toLowerCase().includes('product')
    );

    if (!productSheetName) {
      errors.push({
        field: 'Sheet',
        message: 'Product sheet not found in Excel file',
        sheet: 'Products'
      });
      return { products: [], errors };
    }

    const productSheet = workbook.Sheets[productSheetName];
    const productData = XLSX.utils.sheet_to_json(productSheet, {
      defval: null,
      raw: false,
      header: 1
    });

    // Remove header row (first row)
    productData.shift();

    // Get containers mapping from database
    const containers = await this.db.masterJobContainer.findMany({
      where: {Status: 'A' },
      select: {
        MasterJobContainerSid: true,
        ContainerNumber: true
      }
    });

    // Create a map for quick lookup
    const containerMap = new Map();
    containers.forEach(container => {
      containerMap.set(container.ContainerNumber, container.MasterJobContainerSid);
    });

    // Parse product data, skipping empty rows AND the example row
    const products = productData
      .filter((row: any, index) => {
        // Skip empty rows or rows with no HBL number
        const hblNo = row[0];
        const hasHblNo = hblNo && hblNo.toString().trim() !== '';
        
        // Skip the example row (usually first data row after header)
        // Check if this is likely an example row by checking multiple fields
        const isExampleRow = this.isExampleRow(row);
        
        return hasHblNo && !isExampleRow;
      })
      .map((row: any, index) => {
        try {
          const containerNumber = this.getStringValue(row[19]);
          const masterJobContainerSid = containerMap.get(containerNumber) || null;

          if (containerNumber && !masterJobContainerSid) {
            errors.push({
              field: 'Container ID',
              message: `Invalid container number: ${containerNumber}`,
              row: index + 2,
              hblNo: row[0] || 'N/A'
            });
          }

          return {
            HBLNo: this.getStringValue(row[0]),
            ProductName: this.getStringValue(row[1]),
            HSCode: this.getStringValue(row[2]),
            ShippingBillNo: this.getStringValue(row[3]),
            ShippingBillDate: this.getDateValue(row[4]),
            ExternalPkg: this.getStringValue(row[5]),
            ExternalQty: this.getNumberValue(row[6]),
            UomMasterSid: this.getStringValue(row[7]),
            Length: this.getNumberValue(row[8]),
            Width: this.getNumberValue(row[9]),
            Height: this.getNumberValue(row[10]),
            Volumetric: this.getNumberValue(row[11]),
            Volume: this.getNumberValue(row[12]),
            GrossWeight: this.getNumberValue(row[13]),
            NetWeight: this.getNumberValue(row[14]),
            CargoRecDate: this.getDateValue(row[15]),
            ReceivedQty: this.getNumberValue(row[16]),
            DamageQty: this.getNumberValue(row[17]),
            DamageRemarks: this.getStringValue(row[18]),
            ContainerNo: containerNumber,
            MasterJobContainerSid: masterJobContainerSid, // Map from Container Number
            DeliveryDate: this.getDateValue(row[20]),
            DeliveredQty: this.getNumberValue(row[21]),
            IsHaz: this.getStringValue(row[22]),
            ImcoClass: this.getStringValue(row[23]),
            UnNo: this.getStringValue(row[24]),
            PkgGroup: this.getStringValue(row[25])
          };
        } catch (error) {
          errors.push({
            field: 'Row',
            message: `Error parsing row ${index + 2}: ${error.message}`,
            row: index + 2,
            hblNo: row[0] || 'N/A'
          });
          return null;
        }
      })
      .filter(product => product !== null);

    return { products, errors };

  } catch (error) {
    this.logger.error(`Error parsing product Excel file: ${error.message}`, error.stack);
    throw new BadRequestException('Invalid Excel file format for products');
  }
}

/**
 * Helper method to identify example rows
 */
private isExampleRow(row: any[]): boolean {
  // Check if the row contains example data
  // Common example indicators:
  
  // 1. Check for example HBL number patterns
  const hblNo = this.getStringValue(row[0]);
  const exampleHblPatterns = ['HBL-001', 'HBL-', 'SAMPLE', 'EXAMPLE', 'DEMO'];
  if (hblNo && exampleHblPatterns.some(pattern => hblNo.toUpperCase().includes(pattern))) {
    return true;
  }
  
  // 2. Check for example product name patterns
  const productName = this.getStringValue(row[1]);
  const exampleProductPatterns = ['ELECTRONICS', 'SAMPLE', 'EXAMPLE', 'DEMO'];
  if (productName && exampleProductPatterns.some(pattern => productName.toUpperCase().includes(pattern))) {
    return true;
  }
  
  // 3. Check for common HS Code examples
  const hsCode = this.getStringValue(row[2]);
  const exampleHsCodes = ['85171200', '00000000'];
  if (hsCode && exampleHsCodes.includes(hsCode)) {
    return true;
  }
  
  // 4. Check for placeholder text
  const hasPlaceholderText = row.some(cell => {
    if (typeof cell === 'string') {
      return cell.includes('SB-2024-001') || cell.includes('Example') || cell.includes('Sample');
    }
    return false;
  });
  
  return hasPlaceholderText;
}

  /**
   * Helper method to get date value
   */
  private getDateValue(value: any): Date | null {
    if (!value) return null;
    if (value instanceof Date) return value;
    if (typeof value === 'string') {
      const date = new Date(value);
      return isNaN(date.getTime()) ? null : date;
    }
    if (typeof value === 'number') {
      // Excel date serial number
      const date = XLSX.SSF.parse_date_code(value);
      if (date) {
        return new Date(date.y, date.m - 1, date.d);
      }
    }
    return null;
  }


}
