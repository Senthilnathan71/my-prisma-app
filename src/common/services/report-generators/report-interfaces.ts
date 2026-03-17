/**
 * Report interfaces extracted from frontend's excel-report-service.ts
 * These are the shared interfaces used by both PDF and Excel generators.
 */

export interface ExcelHeader {
  key: string;
  label: string;
  colspan?: number;
  rowspan?: number;
}

export interface ExcelExportConfig {
  data: any[];
  headers: ExcelHeader[];
  fileName: string;
  sheetName?: string;
  title?: string;
}

/**
 * Represents a single cell in a complex report row
 */
export interface ExcelCell {
  value: string | number;
  colspan?: number;
  alignment?: {
    horizontal?: 'left' | 'center' | 'right';
    vertical?: 'top' | 'middle' | 'bottom';
  };
}

/**
 * Represents a row in a complex report
 */
export interface ExcelRow {
  cells: ExcelCell[];
  style?: 'header' | 'data' | 'total' | 'section' | 'grandTotal';
}

/**
 * Report header configuration
 */
export interface ReportHeaderConfig {
  companyName: string;
  reportTitle: string;
  additionalInfo?: { label: string; value: string }[];
}

/**
 * Configuration for complex report exports with grouped data, sections, and totals
 */
export interface ComplexReportExportConfig {
  fileName: string;
  sheetName?: string;
  reportHeader: ReportHeaderConfig;
  tableHeaders: ExcelHeader[];
  includeTableHeaders?: boolean;
  rows: ExcelRow[];
  columnWidths?: number[];
  summaryTable?: {
    title?: string;
    headers: string[];
    rows: ExcelRow[];
    columnWidths?: number[];
  };
  notes?: string[];
}
