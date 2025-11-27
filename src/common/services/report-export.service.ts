import { Injectable, Logger } from '@nestjs/common';
import * as ExcelJS from 'exceljs';
import * as PDFDocument from 'pdfkit';

export interface ExcelExportConfig {
  reportName: string;
  data: any[];
  columns: ExcelColumnConfig[];
  title?: string;
  subtitle?: string;
  companyInfo?: CompanyInfo;
}

export interface ExcelColumnConfig {
  header: string;
  key: string;
  width?: number;
  style?: any;
}

export interface CompanyInfo {
  name: string;
  address?: string;
  phone?: string;
  email?: string;
}

export interface PDFExportConfig {
  reportName: string;
  data: any[];
  columns: PDFColumnConfig[];
  title?: string;
  subtitle?: string;
  companyInfo?: CompanyInfo;
  orientation?: 'portrait' | 'landscape';
}

export interface PDFColumnConfig {
  header: string;
  key: string;
  width?: number;
}

@Injectable()
export class ReportExportService {
  constructor(private logger: Logger) {}

  /**
   * Export data to Excel format
   */
  async exportToExcel(config: ExcelExportConfig): Promise<Buffer> {
    try {
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet(config.reportName);

      let currentRow = 1;

      // Add company info if provided
      if (config.companyInfo) {
        const companyCell = worksheet.getCell(`A${currentRow}`);
        companyCell.value = config.companyInfo.name;
        companyCell.font = { size: 16, bold: true };
        currentRow += 1;

        if (config.companyInfo.address) {
          worksheet.getCell(`A${currentRow}`).value = config.companyInfo.address;
          currentRow += 1;
        }
        currentRow += 1; // Empty row
      }

      // Add title if provided
      if (config.title) {
        const titleCell = worksheet.getCell(`A${currentRow}`);
        titleCell.value = config.title;
        titleCell.font = { size: 14, bold: true };
        currentRow += 1;
      }

      // Add subtitle if provided
      if (config.subtitle) {
        const subtitleCell = worksheet.getCell(`A${currentRow}`);
        subtitleCell.value = config.subtitle;
        subtitleCell.font = { size: 12, italic: true };
        currentRow += 1;
      }

      currentRow += 1; // Empty row before headers

      // Add headers
      const headerRow = worksheet.getRow(currentRow);
      config.columns.forEach((col, index) => {
        const cell = headerRow.getCell(index + 1);
        cell.value = col.header;
        cell.font = { bold: true };
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFD3D3D3' }
        };
        cell.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' }
        };
      });
      currentRow += 1;

      // Add data rows
      config.data.forEach((row) => {
        const dataRow = worksheet.getRow(currentRow);
        config.columns.forEach((col, index) => {
          const cell = dataRow.getCell(index + 1);
          cell.value = row[col.key];
          cell.border = {
            top: { style: 'thin' },
            left: { style: 'thin' },
            bottom: { style: 'thin' },
            right: { style: 'thin' }
          };
        });
        currentRow += 1;
      });

      // Set column widths
      config.columns.forEach((col, index) => {
        worksheet.getColumn(index + 1).width = col.width || 15;
      });

      // Auto-filter
      worksheet.autoFilter = {
        from: { row: config.title ? 5 : 1, column: 1 },
        to: { row: currentRow - 1, column: config.columns.length }
      };

      // Generate buffer
      const buffer = await workbook.xlsx.writeBuffer();
      return Buffer.from(buffer);
    } catch (error) {
      this.logger.error(`exportToExcel error: ${error}`);
      throw error;
    }
  }

  /**
   * Export data to CSV format
   */
  async exportToCSV(config: ExcelExportConfig): Promise<Buffer> {
    try {
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet(config.reportName);

      // Add headers
      const headerRow = worksheet.addRow(config.columns.map(col => col.header));

      // Add data rows
      config.data.forEach((row) => {
        const values = config.columns.map(col => row[col.key]);
        worksheet.addRow(values);
      });

      // Generate CSV buffer
      const buffer = await workbook.csv.writeBuffer();
      return Buffer.from(buffer);
    } catch (error) {
      this.logger.error(`exportToCSV error: ${error}`);
      throw error;
    }
  }

  /**
   * Export data to PDF format
   */
  async exportToPDF(config: PDFExportConfig): Promise<Buffer> {
    try {
      return new Promise((resolve, reject) => {
        const chunks: Buffer[] = [];
        const doc = new PDFDocument({
          size: 'A4',
          layout: config.orientation || 'portrait',
          margins: { top: 50, bottom: 50, left: 50, right: 50 }
        });

        // Collect PDF chunks
        doc.on('data', (chunk) => chunks.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', reject);

        // Add company info
        if (config.companyInfo) {
          doc.fontSize(16).font('Helvetica-Bold').text(config.companyInfo.name, { align: 'center' });
          if (config.companyInfo.address) {
            doc.fontSize(10).font('Helvetica').text(config.companyInfo.address, { align: 'center' });
          }
          doc.moveDown(1);
        }

        // Add title
        if (config.title) {
          doc.fontSize(14).font('Helvetica-Bold').text(config.title, { align: 'center' });
          doc.moveDown(0.5);
        }

        // Add subtitle
        if (config.subtitle) {
          doc.fontSize(12).font('Helvetica-Oblique').text(config.subtitle, { align: 'center' });
          doc.moveDown(1);
        }

        // Calculate column widths
        const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
        const totalWidth = config.columns.reduce((sum, col) => sum + (col.width || 100), 0);
        const scaleFactor = pageWidth / totalWidth;

        // Draw table headers
        let yPosition = doc.y;
        let xPosition = doc.page.margins.left;

        // Header background
        doc.rect(xPosition, yPosition, pageWidth, 20).fill('#D3D3D3');

        // Header text
        doc.fillColor('black').fontSize(10).font('Helvetica-Bold');
        xPosition = doc.page.margins.left;
        config.columns.forEach((col) => {
          const colWidth = (col.width || 100) * scaleFactor;
          doc.text(col.header, xPosition + 5, yPosition + 5, { width: colWidth - 10 });
          xPosition += colWidth;
        });

        yPosition += 25;

        // Draw data rows
        doc.font('Helvetica').fontSize(9);
        config.data.forEach((row, rowIndex) => {
          // Check if we need a new page
          if (yPosition > doc.page.height - doc.page.margins.bottom - 20) {
            doc.addPage();
            yPosition = doc.page.margins.top;

            // Redraw headers on new page
            xPosition = doc.page.margins.left;
            doc.rect(xPosition, yPosition, pageWidth, 20).fill('#D3D3D3');
            doc.fillColor('black').fontSize(10).font('Helvetica-Bold');
            xPosition = doc.page.margins.left;
            config.columns.forEach((col) => {
              const colWidth = (col.width || 100) * scaleFactor;
              doc.text(col.header, xPosition + 5, yPosition + 5, { width: colWidth - 10 });
              xPosition += colWidth;
            });
            yPosition += 25;
            doc.font('Helvetica').fontSize(9);
          }

          // Alternate row colors
          if (rowIndex % 2 === 1) {
            doc.rect(doc.page.margins.left, yPosition, pageWidth, 20).fill('#F5F5F5');
          }

          // Draw row data
          doc.fillColor('black');
          xPosition = doc.page.margins.left;
          config.columns.forEach((col) => {
            const colWidth = (col.width || 100) * scaleFactor;
            const value = row[col.key]?.toString() || '';
            doc.text(value, xPosition + 5, yPosition + 5, { width: colWidth - 10, height: 15, ellipsis: true });
            xPosition += colWidth;
          });

          yPosition += 20;
        });

        // Finalize PDF
        doc.end();
      });
    } catch (error) {
      this.logger.error(`exportToPDF error: ${error}`);
      throw error;
    }
  }

  /**
   * Main export function that routes to appropriate format
   */
  async export(format: 'EXCEL' | 'CSV' | 'PDF', config: ExcelExportConfig | PDFExportConfig): Promise<Buffer> {
    try {
      switch (format) {
        case 'EXCEL':
          return await this.exportToExcel(config as ExcelExportConfig);
        case 'CSV':
          return await this.exportToCSV(config as ExcelExportConfig);
        case 'PDF':
          return await this.exportToPDF(config as PDFExportConfig);
        default:
          throw new Error(`Unsupported export format: ${format}`);
      }
    } catch (error) {
      this.logger.error(`export error: ${error}`);
      throw error;
    }
  }
}
