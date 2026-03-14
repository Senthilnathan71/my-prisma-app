/**
 * Base interfaces for PDF generation
 * Copied from frontend: ng-freight-forwarding/src/app/common/pdf/interfaces/pdf-base.interface.ts
 */

export interface PdfCompanyInfo {
  companyName: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  postalCode?: string;
  phoneNumber?: string;
  email?: string;
}

export interface PdfBranchInfo {
  branchName: string;
  addressLine1?: string;
  addressLine2?: string;
  cityName?: string;
  postalCode?: string;
  phoneNumber?: string;
  cityMaster?: {
    cityName?: string;
  };
}

export interface PdfUserInfo {
  userName: string;
  email?: string;
}

export interface PdfDocumentConfig {
  pageSize?: 'A4' | 'LETTER';
  pageOrientation?: 'portrait' | 'landscape';
  pageMargins?: [number, number, number, number];
}

export interface PdfDocumentBase {
  company: PdfCompanyInfo;
  branch: PdfBranchInfo;
  userData: PdfUserInfo;
  logo?: string;
  config?: PdfDocumentConfig;
}

export interface PdfChargeItem {
  chargeName: string;
  unit: string;
  qty: number;
  currency: string;
  rate: number;
  amount: number;
  exchangeRate?: number;
  localAmount?: number;
}

export interface PdfCargoItem {
  cargoType?: string;
  containerType?: string;
  noOfContainers?: number;
  noOfPackage?: number;
  grossWeight?: number;
  netWeight?: number;
  volume?: number;
  chargeableWeight?: number;
  packageType?: string;
  length?: number;
  width?: number;
  height?: number;
  dimensions?: string;
}

export interface PdfPortInfo {
  portName: string;
  portCode: string;
}

export interface PdfRouteInfo {
  poo?: PdfPortInfo;
  pol?: PdfPortInfo;
  pod?: PdfPortInfo;
  fpd?: PdfPortInfo;
}

export interface PdfTermItem {
  content: string;
}

export interface PdfProductItem {
  productName: string;
  hsCode?: string;
  description?: string;
  quantity?: number;
  unit?: string;
  grossWeight?: number;
  netWeight?: number;
  volume?: number;
}

export interface PdfContainerItem {
  containerNo: string;
  containerType?: string;
  sealNo?: string;
  grossWeight?: number;
  tareWeight?: number;
  netWeight?: number;
  volume?: number;
  packageQty?: number;
}

export interface PdfTableColumn {
  header: string;
  field: string;
  width?: number | string;
  alignment?: 'left' | 'center' | 'right';
  format?: 'text' | 'number' | 'currency' | 'date';
  decimals?: number;
}
