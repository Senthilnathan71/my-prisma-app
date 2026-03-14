/**
 * Generic Report PDF Generator
 * Converts ComplexReportExportConfig (used by all account/operation report components)
 * into a pdfmake document definition.
 * Copied from frontend: ng-freight-forwarding/src/app/common/pdf/generators/generic-report-pdf.generator.ts
 */

import { ComplexReportExportConfig, ExcelRow } from './report-interfaces';
import { PdfCompanyInfo, PdfBranchInfo, PdfUserInfo } from './pdf-base.interface';
import { createFooterFunction } from './pdf-footer.builder';
import { getPdfStyles } from './pdf-styles';

export interface GenericReportPdfData {
  exportConfig: ComplexReportExportConfig;
  company: PdfCompanyInfo;
  branch: PdfBranchInfo;
  userData: PdfUserInfo;
  logo?: string;
  orientation?: 'portrait' | 'landscape';
}

/** Compact table layout with reduced padding to fit more columns */
const COMPACT_TABLE_LAYOUT = {
  hLineWidth: () => 0.5,
  vLineWidth: () => 0.5,
  hLineColor: () => '#000000',
  vLineColor: () => '#000000',
  paddingLeft: () => 2,
  paddingRight: () => 2,
  paddingTop: () => 2,
  paddingBottom: () => 2
};

export function generateGenericReportDocument(data: GenericReportPdfData): any {
  const { exportConfig, company, branch, userData, logo, orientation } = data;
  const isLandscape = orientation === 'landscape';
  const logoHeight = 80;
  const colCount = exportConfig.tableHeaders.length;

  // --- A) Fix column widths: scale proportionally, accounting for border+padding overhead ---
  const pageWidth = isLandscape ? 842 : 595;
  const availableWidth = pageWidth - 30 - 30; // left + right margins
  let widths: any[];
  if (exportConfig.columnWidths?.length === colCount) {
    const totalWeight = exportConfig.columnWidths.reduce((a, b) => a + b, 0);
    // Subtract border and padding overhead so the table fits within the page
    const borderOverhead = (colCount + 1) * 0.5;   // 0.5pt per border line
    const paddingOverhead = colCount * (2 + 2);     // left(2) + right(2) per cell
    const availableContentWidth = availableWidth - borderOverhead - paddingOverhead;
    widths = exportConfig.columnWidths.map(w => (w / totalWeight) * availableContentWidth);
  } else {
    widths = Array(colCount).fill('*');
  }

  // --- B) Build repeating header function ---
  const infoContent: any[] = [];
  if (exportConfig.reportHeader.additionalInfo?.length) {
    const items = exportConfig.reportHeader.additionalInfo;
    const numCols = 2;
    const numRows = Math.ceil(items.length / numCols);
    const tableBody: any[][] = [];
    for (let r = 0; r < numRows; r++) {
      const leftIdx = r;
      const rightIdx = r + numRows;
      const leftItem = leftIdx < items.length ? items[leftIdx] : null;
      const rightItem = rightIdx < items.length ? items[rightIdx] : null;
      tableBody.push([
        { text: leftItem?.label || '', bold: true, fontSize: 8 },
        { text: leftItem ? `: ${leftItem.value || ''}` : '', fontSize: 8 },
        { text: rightItem?.label || '', bold: true, fontSize: 8 },
        { text: rightItem ? `: ${rightItem.value || ''}` : '', fontSize: 8 }
      ]);
    }
    infoContent.push({
      table: { widths: ['auto', '*', 'auto', 'auto'], body: tableBody },
      layout: 'noBorders',
      margin: [0, 0, 0, 20]
    });
  }

  const reportTitle = exportConfig.reportHeader.reportTitle || '';
  const lineWidth = isLandscape ? 782 : 535;

  function portraitHeader(data: GenericReportPdfData): any {
    const { company, branch, logo, exportConfig } = data;
    const stack: any[] = [];

    // Company info stack
    const companyStack: any[] = [];
    if (company?.companyName)
      companyStack.push({
        text: company.companyName,
        bold: true,
        fontSize: 12,
        alignment: 'center',
      });
    if (branch?.branchName)
      companyStack.push({
        text: branch.branchName,
        fontSize: 9,
        alignment: 'center',
        color: '#666666',
      });
    const addressLine = branch?.addressLine1 || company?.addressLine1 || '';
    if (addressLine)
      companyStack.push({
        text: addressLine,
        fontSize: 8,
        alignment: 'center',
        color: '#666666',
      });

    const addressParts: string[] = [];
    if (branch?.addressLine2) addressParts.push(branch.addressLine2);
    if (branch?.cityMaster?.cityName)
      addressParts.push(branch.cityMaster.cityName);
    if (branch?.postalCode) addressParts.push(branch.postalCode);
    if (branch?.phoneNumber) addressParts.push(branch.phoneNumber);
    if (addressParts.length)
      companyStack.push({
        text: addressParts.join(', '),
        fontSize: 8,
        alignment: 'center',
        color: '#666666',
      });

    // Logo on top in portrait
    if (logo)
      stack.push({
        image: logo,
        height: logoHeight,
        alignment: 'center',
        margin: [0, 0, 0, 4],
      });

    stack.push(...companyStack);

    // Report title
    if (exportConfig.reportHeader.reportTitle) {
      stack.push({
        text: exportConfig.reportHeader.reportTitle,
        bold: true,
        fontSize: 11,
        alignment: 'center',
        margin: [0, 6, 0, 4],
      });
    }

    // Additional info (parameters)
    if (exportConfig.reportHeader.additionalInfo?.length) {
      const items = exportConfig.reportHeader.additionalInfo;
      const tableBody: any[][] = [];
      items.forEach((item) =>
        tableBody.push([
          { text: item.label, bold: true, fontSize: 8 },
          { text: `: ${item.value || ''}`, fontSize: 8 },
        ]),
      );

      stack.push({
        table: { widths: ['auto', '*'], body: tableBody },
        layout: 'noBorders',
        margin: [0, 4, 0, 4],
      });
    }

    return { margin: [30, 15, 30, 0], stack };
  }
  const headerFunction = (_currentPage: number, _pageCount: number, _pageSize: any) => {
    const stack: any[] = [];
    const printableWidth = (_pageSize?.width || pageWidth) - 60; // page width - left/right margins
    const sideColumnWidth = isLandscape
      ? 170
      : Math.min(120, Math.max(90, Math.floor(printableWidth * 0.22)));

    // Build company info stack (center column)
    const companyStack: any[] = [];

    // Company name
    if (company?.companyName) {
      companyStack.push({
        text: company.companyName,
        bold: true,
        fontSize: 12,
        alignment: 'center'
      });
    }

    // Branch name
    if (branch?.branchName) {
      companyStack.push({
        text: branch.branchName,
        fontSize: 9,
        alignment: 'center',
        color: '#666666'
      });
    }

    // Address line 1
    const addressLine = branch?.addressLine1 || company?.addressLine1 || '';
    if (addressLine) {
      companyStack.push({
        text: addressLine,
        fontSize: 8,
        alignment: 'center',
        color: '#666666'
      });
    }

    // Address line 2 (addressLine2, city, postalCode, phone)
    const addressParts: string[] = [];
    if (branch?.addressLine2) addressParts.push(branch.addressLine2.trim());
    const cityName = branch?.cityMaster?.cityName || branch?.cityName || '';
    if (cityName) addressParts.push(cityName);
    if (branch?.postalCode) addressParts.push(branch.postalCode);
    if (branch?.phoneNumber) addressParts.push(branch.phoneNumber);
    if (addressParts.length) {
      companyStack.push({
        text: addressParts.join(', '),
        fontSize: 8,
        alignment: 'center',
        color: '#666666'
      });
    }

    // Header with logo | company info | spacer
    stack.push({
      columns: [
        logo
          ? {
              width: sideColumnWidth,
              stack: [{ image: logo, height: logoHeight, alignment: 'left' }]
            }
          : { text: '', width: sideColumnWidth },
        { stack: companyStack, width: '*' },
        { text: '', width: sideColumnWidth } // spacer for balance
      ],
      margin: [0, 2, 0, 2]
    });

    // Report title
    if (reportTitle) {
      stack.push({
        text: reportTitle,
        bold: true,
        fontSize: 11,
        alignment: 'center',
        margin: [0, 4, 0, 3]
      });
    }

    // Parameters
    if (infoContent.length) {
      stack.push(...infoContent);
    }

    return {
      margin: [30, 15, 30, 0],
      stack
    };
  };

  // --- C) Table header with #116897 background, white text ---
  const headerRow = exportConfig.tableHeaders.map(h => ({
    text: h.label,
    bold: true,
    fontSize: 7,
    color: '#ffffff',
    fillColor: '#116897',
    alignment: 'center' as const
  }));

  // --- D) Data rows with right-aligned numeric values ---
  const hasDataRows = exportConfig.rows.some(r => r.style !== 'total' && r.style !== 'grandTotal' && r.style !== 'section');
  let bodyRows: any[][];
  if (hasDataRows) {
    bodyRows = exportConfig.rows.map(row => buildPdfRow(row, colCount));
  } else {
    // No actual data — show "No Record Found" spanning all columns
    const noRecordRow: any[] = [
      { text: 'No Record Found', colSpan: colCount, alignment: 'center', fontSize: 8, bold: true, margin: [0, 4, 0, 4] }
    ];
    for (let i = 1; i < colCount; i++) noRecordRow.push({ text: '' });
    bodyRows = [noRecordRow];
  }

  // Build content array
  const content: any[] = [
    // Main data table
    {
      table: {
        headerRows: 1,
        widths: widths,
        body: [headerRow, ...bodyRows]
      },
      layout: COMPACT_TABLE_LAYOUT,
      fontSize: 7,
      margin: [0, 0, 0, 10]
    }
  ];

  // Notes section
  if (exportConfig.notes?.length) {
    const noteItems = exportConfig.notes.map(n => ({ text: n, fontSize: 8, margin: [0, 1, 0, 1] as [number, number, number, number] }));
    content.push({
      stack: [
        { text: 'Note :', bold: true, fontSize: 9, margin: [0, 6, 0, 2] },
        { ul: noteItems, fontSize: 8, margin: [10, 0, 0, 0] }
      ],
      margin: [0, 0, 0, 6]
    });
  }

  // Summary table (e.g., currency-wise summary in Outstanding Report)
  if (exportConfig.summaryTable) {
    const st = exportConfig.summaryTable;
    const stColCount = st.headers.length;

    // Calculate summary table widths
    let stWidths: any[];
    if (st.columnWidths?.length === stColCount) {
      const stTotalWeight = st.columnWidths.reduce((a, b) => a + b, 0);
      const stBorderOverhead = (stColCount + 1) * 0.5;
      const stPaddingOverhead = stColCount * (2 + 2);
      const stAvailable = availableWidth - stBorderOverhead - stPaddingOverhead;
      stWidths = st.columnWidths.map(w => (w / stTotalWeight) * stAvailable);
    } else {
      stWidths = Array(stColCount).fill('*');
    }

    // Summary header row with teal background
    const stHeaderRow = st.headers.map(label => ({
      text: label,
      bold: true, fontSize: 7, color: '#ffffff', fillColor: '#116897', alignment: 'left' as const
    }));

    // Summary data rows
    const stBodyRows = st.rows.map(row => {
      const cells: any[] = [];
      for (const cell of row.cells) {
        const cellText = cell.value != null ? String(cell.value) : '';
        const isNumeric = cellText !== '' && !isNaN(Number(cellText.replace(/,/g, '')));
        cells.push({ text: cellText, fontSize: 7, alignment: isNumeric ? 'right' as const : 'left' as const });
      }
      while (cells.length < stColCount) cells.push({ text: '' });
      return cells;
    });

    // Wrap title + table in unbreakable block so it stays together;
    // if it doesn't fit on the current page, pdfmake moves the whole block to the next page.
    const summaryStack: any[] = [];
    if (st.title) {
      summaryStack.push({
        text: st.title, bold: true, fontSize: 9, margin: [0, 10, 0, 4]
      });
    } else {
      summaryStack.push({ text: '', margin: [0, 6, 0, 0] });
    }
    summaryStack.push({
      table: { headerRows: 1, widths: stWidths, body: [stHeaderRow, ...stBodyRows] },
      layout: COMPACT_TABLE_LAYOUT,
      fontSize: 7,
      margin: [0, 0, 0, 10]
    });
    content.push({ stack: summaryStack, unbreakable: true });
  }

  // Keep a visible gap between header parameter info and table content.
  const paramCount = exportConfig.reportHeader.additionalInfo?.length || 0;
  const paramRows = Math.ceil(paramCount / 2);
  const topMargin = 155 + (paramRows * 10) + 10;

  return {
    pageSize: 'A4',
    pageOrientation: orientation || 'portrait',
    pageMargins: [30, topMargin, 30, 60] as [number, number, number, number],
    background: (_currentPage: number, pageSize: any) => ({
      canvas: [{
        type: 'rect',
        x: 14,
        y: 14,
        w: pageSize.width - 28,
        h: pageSize.height - 28,
        lineWidth: 0.7,
        lineColor: '#000000'
      }]
    }),
    header: (_currentPage: number, _pageCount: number, _pageSize: any) =>
      headerFunction(_currentPage, _pageCount, _pageSize),
    content,
    footer: createFooterFunction(userData, {showPageNumbers: true}),
    styles: getPdfStyles(),
    defaultStyle: { fontSize: 8, lineHeight: 1.2, color: '#333333' }
  };
}

/** Convert an ExcelRow to a pdfmake row (array of cells) */
function buildPdfRow(row: ExcelRow, colCount: number): any[] {
  const cells: any[] = [];
  const isBold = row.style === 'total' || row.style === 'grandTotal' || row.style === 'section';
  const fillColor = row.style === 'grandTotal' ? '#e0e0e0'
                   : row.style === 'total' ? '#f2f2f2'
                   : row.style === 'section' ? '#f7f7f7'
                   : null;

  for (const cell of row.cells) {
    const cellText = cell.value != null ? String(cell.value) : '';
    const isNumeric = cellText !== '' && !isNaN(Number(cellText.replace(/,/g, '')));

    const pdfCell: any = {
      text: cellText,
      bold: isBold,
      fontSize: 7
    };
    if (fillColor) pdfCell.fillColor = fillColor;
    if (isNumeric) pdfCell.alignment = 'right';
    if (cell.colspan && cell.colspan > 1) {
      pdfCell.colSpan = cell.colspan;
      cells.push(pdfCell);
      // push empty cells for colspan
      for (let i = 1; i < cell.colspan; i++) cells.push({ text: '' });
    } else {
      cells.push(pdfCell);
    }
  }

  // Pad if row has fewer cells than columns
  while (cells.length < colCount) cells.push({ text: '' });

  return cells;
}
