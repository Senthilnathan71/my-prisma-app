/**
 * Centralized styles for PDF generation using pdfmake
 * Copied from frontend: ng-freight-forwarding/src/app/common/pdf/styles/pdf-styles.ts
 * NOTE: Removed unused browser import (html2canvas)
 */

export const PDF_COLORS = {
  primary: '#333333',
  secondary: '#666666',
  light: '#f5f5f5',
  border: '#000000',
  headerBg: '#f0f0f0',
  tableBorder: '#000000',
  white: '#ffffff'
};

export const PDF_FONTS = {
  default: '',
  sizes: {
    tiny: 7,
    small: 8,
    normal: 9,
    medium: 10,
    large: 11,
    xlarge: 12,
    title: 14,
    header: 16,
    companyName: 18
  }
};

export const PDF_STYLES = {
  // Company Header Styles
  companyName: {
    fontSize: PDF_FONTS.sizes.header,
    bold: true,
    color: PDF_COLORS.primary
  },
  branchName: {
    fontSize: PDF_FONTS.sizes.xlarge,
    bold: true,
    color: PDF_COLORS.primary
  },
  addressText: {
    fontSize: PDF_FONTS.sizes.normal,
    color: PDF_COLORS.secondary
  },

  // Document Title Styles
  documentTitle: {
    fontSize: PDF_FONTS.sizes.title,
    bold: true,
    color: PDF_COLORS.primary
  },
  sectionTitle: {
    fontSize: PDF_FONTS.sizes.xlarge,
    bold: true,
    color: PDF_COLORS.primary
  },
  subSectionTitle: {
    fontSize: PDF_FONTS.sizes.medium,
    bold: true,
    color: PDF_COLORS.primary
  },

  // Label Styles
  labelBold: {
    fontSize: PDF_FONTS.sizes.medium,
    bold: true,
    color: PDF_COLORS.primary
  },
  label: {
    fontSize: PDF_FONTS.sizes.normal,
    color: PDF_COLORS.secondary
  },
  value: {
    fontSize: PDF_FONTS.sizes.normal,
    color: PDF_COLORS.primary
  },

  // Customer/Party Info Styles
  customerName: {
    fontSize: PDF_FONTS.sizes.medium,
    bold: true,
    color: PDF_COLORS.primary
  },
  customerText: {
    fontSize: PDF_FONTS.sizes.normal,
    color: PDF_COLORS.primary
  },

  // Table Styles
  tableHeader: {
    fontSize: PDF_FONTS.sizes.normal,
    bold: true,
    color: PDF_COLORS.primary
  },
  tableCell: {
    fontSize: PDF_FONTS.sizes.normal,
    color: PDF_COLORS.primary
  },
  tableCellBold: {
    fontSize: PDF_FONTS.sizes.normal,
    bold: true,
    color: PDF_COLORS.primary
  },
  tableFooter: {
    fontSize: PDF_FONTS.sizes.normal,
    bold: true,
    fillColor: PDF_COLORS.light,
    color: PDF_COLORS.primary
  },

  // Table Styles
  tableHeaderSmall: {
    fontSize: PDF_FONTS.sizes.small,
    bold: true,
  },

  tableCellSmall: {
    fontSize: PDF_FONTS.sizes.small,
  },
  tableCellBoldSmall: {
    fontSize: PDF_FONTS.sizes.small,
    bold: true,
  },
  tableFooterSmall: {
    fontSize: PDF_FONTS.sizes.small,
    bold: true,
    fillColor: PDF_COLORS.light,
    color: PDF_COLORS.primary
  },


  // Route Header Styles
  routeHeader: {
    fontSize: PDF_FONTS.sizes.large,
    bold: true,
    color: PDF_COLORS.primary
  },

  // Footer Styles
  footerText: {
    fontSize: PDF_FONTS.sizes.small,
    color: PDF_COLORS.secondary
  },
  disclaimer: {
    fontSize: PDF_FONTS.sizes.small,
    italics: true,
    color: PDF_COLORS.secondary
  },

  // Special Styles
  highlight: {
    fontSize: PDF_FONTS.sizes.medium,
    bold: true,
    color: '#0066cc'
  },
  muted: {
    fontSize: PDF_FONTS.sizes.small,
    color: PDF_COLORS.secondary
  },
  error: {
    fontSize: PDF_FONTS.sizes.normal,
    color: '#cc0000'
  },
  success: {
    fontSize: PDF_FONTS.sizes.normal,
    color: '#006600'
  }
};

export const PDF_TABLE_LAYOUTS = {
  // Standard table with all borders
  bordered: {
    hLineWidth: () => 1,
    vLineWidth: () => 1,
    hLineColor: () => PDF_COLORS.tableBorder,
    vLineColor: () => PDF_COLORS.tableBorder,
    paddingLeft: () => 4,
    paddingRight: () => 4,
    paddingTop: () => 3,
    paddingBottom: () => 3
  },

  // Table with horizontal lines only
  horizontalLines: {
    hLineWidth: (i: number, node: any) => (i === 0 || i === node.table.body.length) ? 1 : 0.5,
    vLineWidth: () => 0,
    hLineColor: () => PDF_COLORS.tableBorder,
    paddingLeft: () => 4,
    paddingRight: () => 4,
    paddingTop: () => 3,
    paddingBottom: () => 3
  },

  // Table with outer border only
  outerBorder: {
    hLineWidth: (i: number, node: any) => (i === 0 || i === node.table.body.length) ? 1 : 0,
    vLineWidth: (i: number, node: any) => (i === 0 || i === node.table.widths.length) ? 1 : 0,
    hLineColor: () => PDF_COLORS.tableBorder,
    vLineColor: () => PDF_COLORS.tableBorder,
    paddingLeft: () => 4,
    paddingRight: () => 4,
    paddingTop: () => 3,
    paddingBottom: () => 3
  },

  // Clean table without vertical lines
  cleanTable: {
    hLineWidth: (i: number, node: any) => (i === 0 || i === 1 || i === node.table.body.length) ? 1 : 0,
    vLineWidth: (i: number, node: any) => (i === 0 || i === node.table.widths.length) ? 0 : 0,
    hLineColor: () => PDF_COLORS.tableBorder,
    paddingLeft: () => 4,
    paddingRight: () => 4,
    paddingTop: () => 4,
    paddingBottom: () => 4
  },

  // Light table with subtle styling
  lightTable: {
    hLineWidth: (i: number) => i === 1 ? 1 : 0.5,
    vLineWidth: () => 0,
    hLineColor: (i: number) => i === 1 ? PDF_COLORS.tableBorder : '#cccccc',
    paddingLeft: () => 4,
    paddingRight: () => 4,
    paddingTop: () => 3,
    paddingBottom: () => 3
  },

  // No lines (for layout tables)
  noBorders: {
    hLineWidth: () => 0,
    vLineWidth: () => 0,
    paddingLeft: () => 0,
    paddingRight: () => 0,
    paddingTop: () => 0,
    paddingBottom: () => 0
  }
};

export const PDF_DEFAULT_CONFIG = {
  pageSize: 'A4' as const,
  pageOrientation: 'portrait' as const,
  pageMargins: [10, 10, 10, 20] as [number, number, number, number],
  defaultStyle: {
    fontSize: PDF_FONTS.sizes.small,
    lineHeight: 0.8,
    color: PDF_COLORS.primary
  }
};

/**
 * Get complete styles object for pdfmake document definition
 */
export function getPdfStyles(): any {
  return PDF_STYLES;
}

/**
 * Get default document configuration
 */
export function getDefaultDocumentConfig(): any {
  return {
    ...PDF_DEFAULT_CONFIG,
    styles: PDF_STYLES
  };
}
