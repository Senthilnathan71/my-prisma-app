/**
 * PdfmakeNodeService
 * Server-side PDF and Excel generation using the same logic as the frontend.
 * PDF: Uses pdfmake's Node.js PdfPrinter with the same doc definition from generateGenericReportDocument()
 * Excel: Uses XLSX (SheetJS) with the same AOA/merge logic from frontend's exportComplexReport()
 */

import { Injectable } from '@nestjs/common';
// pdfmake v0.3.x: the Printer class lives at pdfmake/js/Printer (default export)
// eslint-disable-next-line @typescript-eslint/no-var-requires
const PdfPrinter = require('pdfmake/js/Printer').default;
import * as XLSX from 'xlsx';
import { generateGenericReportDocument, GenericReportPdfData } from './generic-report-pdf.generator';
import { ComplexReportExportConfig } from './report-interfaces';

@Injectable()
export class PdfmakeNodeService {
  private printer: any;

  constructor() {
    // Helvetica is built-in to pdfmake/pdfkit — no font files needed.
    // pdfmake v0.3.x constructor: PdfPrinter(fonts, virtualfs, urlResolver)
    // urlResolver needs a resolve() method — no-op for built-in fonts.
    const noopUrlResolver = { resolve: () => {}, resolved: async () => {} };
    this.printer = new PdfPrinter(
      {
        Helvetica: {
          normal: 'Helvetica',
          bold: 'Helvetica-Bold',
          italics: 'Helvetica-Oblique',
          bolditalics: 'Helvetica-BoldOblique',
        },
      },
      undefined,
      noopUrlResolver,
    );
  }

  /**
   * Generate PDF buffer using the same pdfmake document definition as the frontend.
   * pdfmake v0.3.x: createPdfKitDocument() is async and returns a PDFDocument stream.
   */
  async generatePdfBuffer(data: GenericReportPdfData): Promise<Buffer> {
    const docDefinition = generateGenericReportDocument(data);
    // Force Helvetica font (built-in, no font files needed)
    docDefinition.defaultStyle = { ...docDefinition.defaultStyle, font: 'Helvetica' };

    const pdfDoc = await this.printer.createPdfKitDocument(docDefinition);

    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      pdfDoc.on('data', (chunk) => chunks.push(chunk));
      pdfDoc.on('end', () => resolve(Buffer.concat(chunks)));
      pdfDoc.on('error', reject);
      pdfDoc.end();
    });
  }

  /**
   * Generate Excel buffer using the same AOA/merge logic as the frontend's exportComplexReport()
   * Identical logic to ng-freight-forwarding/src/app/shared/excel-report-service.ts (lines 137-268)
   * Only difference: returns Buffer instead of saving via FileSaver
   */
  generateExcelBuffer(config: ComplexReportExportConfig): Buffer {
    const {
      fileName,
      sheetName = fileName.replace(/[^a-zA-Z0-9]/g, '').slice(0, 31),
      reportHeader,
      tableHeaders,
      includeTableHeaders = true,
      rows,
      columnWidths
    } = config;

    const aoa: any[][] = [];
    const merges: XLSX.Range[] = [];
    const totalCols = tableHeaders.length;

    // Row 1: Company Name (merged across all columns)
    aoa.push([reportHeader.companyName]);
    merges.push({ s: { r: 0, c: 0 }, e: { r: 0, c: totalCols - 1 } });

    // Row 2: Report Title (merged across all columns)
    aoa.push([reportHeader.reportTitle]);
    merges.push({ s: { r: 1, c: 0 }, e: { r: 1, c: totalCols - 1 } });

    // Row 3: Empty row
    aoa.push([]);

    // Additional info rows (Branch, Ledger, Date, etc.)
    if (reportHeader.additionalInfo && reportHeader.additionalInfo.length > 0) {
      for (const info of reportHeader.additionalInfo) {
        aoa.push([`${info.label} : ${info.value}`]);
        merges.push({
          s: { r: aoa.length - 1, c: 0 },
          e: { r: aoa.length - 1, c: totalCols - 1 }
        });
      }
    }

    // Table Header Row (optional)
    if (includeTableHeaders) {
      aoa.push(tableHeaders.map(h => h.label));
    }

    // Data Rows
    let currentRowIndex = aoa.length;
    for (const row of rows) {
      const excelRow: any[] = [];
      let colIndex = 0;

      for (const cell of row.cells) {
        excelRow.push(cell.value ?? '');

        // Handle colspan for merged cells (section headers, etc.)
        if (cell.colspan && cell.colspan > 1) {
          merges.push({
            s: { r: currentRowIndex, c: colIndex },
            e: { r: currentRowIndex, c: colIndex + cell.colspan - 1 }
          });
          // Fill remaining columns for colspan
          for (let i = 1; i < cell.colspan; i++) {
            excelRow.push('');
          }
          colIndex += cell.colspan;
        } else {
          colIndex++;
        }
      }

      // Pad remaining columns if row has fewer cells than headers
      while (excelRow.length < totalCols) {
        excelRow.push('');
      }

      aoa.push(excelRow);
      currentRowIndex++;
    }

    // Summary table (e.g., currency-wise summary in Outstanding Report)
    if (config.summaryTable) {
      // Empty separator row
      aoa.push([]);
      currentRowIndex++;

      // Summary title (optional)
      if (config.summaryTable.title) {
        aoa.push([config.summaryTable.title]);
        merges.push({ s: { r: currentRowIndex, c: 0 }, e: { r: currentRowIndex, c: totalCols - 1 } });
        currentRowIndex++;
      }

      // Summary header row
      const summaryHeaders = config.summaryTable.headers;
      aoa.push(summaryHeaders);
      currentRowIndex++;

      // Summary data rows
      for (const row of config.summaryTable.rows) {
        const summaryExcelRow: any[] = [];
        for (const cell of row.cells) {
          summaryExcelRow.push(cell.value ?? '');
        }
        while (summaryExcelRow.length < summaryHeaders.length) summaryExcelRow.push('');
        aoa.push(summaryExcelRow);
        currentRowIndex++;
      }
    }

    // Create worksheet
    const worksheet: XLSX.WorkSheet = XLSX.utils.aoa_to_sheet(aoa);
    worksheet['!merges'] = merges;

    // Set column widths if provided
    if (columnWidths && columnWidths.length > 0) {
      worksheet['!cols'] = columnWidths.map(w => ({ wch: w }));
    }

    // Create workbook and export as Buffer (instead of Blob + FileSaver)
    const workbook: XLSX.WorkBook = {
      Sheets: { [sheetName]: worksheet },
      SheetNames: [sheetName]
    };

    const excelBuffer: any = XLSX.write(workbook, {
      bookType: 'xlsx',
      type: 'buffer'
    });

    return Buffer.from(excelBuffer);
  }
}
