import {
  IsNotEmpty,
  IsNumber,
  IsString,
  IsOptional,
  IsArray,
  ValidateNested,
  IsDate,
  Min,
  IsBoolean,
} from 'class-validator';
import { Type } from 'class-transformer';
import { VoucherDetailDto } from './voucher-posting.dto';

/**
 * DTO for creating a receipt voucher
 * Supports: Receipt against invoice, Advance receipt, Multi-branch, TDS
 */
export class CreateReceiptDto {
  @IsNotEmpty()
  @IsNumber()
  CompanyMasterSid: number;

  @IsNotEmpty()
  @IsNumber()
  BranchMasterSid: number;

  @IsNotEmpty()
  @IsNumber()
  YearMasterSid: number;

  @IsNotEmpty()
  @IsNumber()
  LedgerMasterSid: number; // Customer

  @IsNotEmpty()
  @IsString()
  VoucherDate: string; // YYYY-MM-DD format

  @IsOptional()
  @IsString()
  Narration?: string;

  @IsNotEmpty()
  @IsString()
  PaymentMode: string; // Cash, Cheque, NEFT, RTGS, etc.

  @IsOptional()
  @IsString()
  ChequeNumber?: string;

  @IsOptional()
  @IsString()
  ChequeDate?: string;

  @IsOptional()
  @IsString()
  BankName?: string;

  @IsNotEmpty()
  @IsNumber()
  @Min(0)
  TotalAmount: number; // Total receipt amount in local currency

  @IsOptional()
  @IsNumber()
  CurrencyMasterSid?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  ExchangeRate?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  CurrencyAmount?: number;

  // TDS Deduction
  @IsOptional()
  @IsBoolean()
  HasTDS?: boolean;

  @IsOptional()
  @IsNumber()
  TDSLedgerMasterSid?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  TDSAmount?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  TDSPercentage?: number;

  // Receipt details (invoice matching or advance)
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReceiptDetailDto)
  Details: ReceiptDetailDto[];

  // Inter-branch receipt
  @IsOptional()
  @IsBoolean()
  IsInterBranch?: boolean;

  @IsOptional()
  @IsNumber()
  ReceivingBranchMasterSid?: number; // Branch that actually received payment

  @IsOptional()
  @IsString()
  CreatedBy?: string;
}

/**
 * Receipt detail line - either matched to invoice or advance
 */
export class ReceiptDetailDto {
  @IsOptional()
  @IsNumber()
  VoucherTransactionSid?: number; // If matching to existing invoice

  @IsNotEmpty()
  @IsNumber()
  @Min(0)
  Amount: number; // Amount being received/matched

  @IsOptional()
  @IsNumber()
  @Min(0)
  CurrencyAmount?: number;

  @IsOptional()
  @IsString()
  Narration?: string;

  @IsNotEmpty()
  @IsBoolean()
  IsAdvance: boolean; // true = advance receipt, false = invoice matching

  // For advance receipts
  @IsOptional()
  @IsNumber()
  COAMasterSid?: number; // Advance ledger account

  @IsOptional()
  @IsString()
  Description?: string;
}

/**
 * Search criteria for outstanding invoices
 */
export class SearchOutstandingDto {
  @IsNotEmpty()
  @IsNumber()
  CompanyMasterSid: number;

  @IsOptional()
  @IsNumber()
  LedgerMasterSid?: number; // Customer

  @IsOptional()
  @IsString()
  CustomerName?: string;

  @IsOptional()
  @IsString()
  InvoiceNumber?: string;

  @IsOptional()
  @IsString()
  VendorInvoiceNumber?: string;

  @IsOptional()
  @IsString()
  HouseNumber?: string;

  @IsOptional()
  @IsString()
  HBLNumber?: string;

  @IsOptional()
  @IsString()
  MasterNumber?: string;

  @IsOptional()
  @IsString()
  MBLNumber?: string;

  @IsOptional()
  @IsString()
  HAWB?: string;

  @IsOptional()
  @IsString()
  MAWB?: string;

  @IsOptional()
  @IsBoolean()
  IncludeFullyPaid?: boolean; // Default: false
}

/**
 * Response DTO for created receipt
 */
export class ReceiptResponseDto {
  VoucherHeaderSid: number;
  VoucherNumber: string;
  VoucherDate: string;
  CompanyMasterSid: number;
  BranchMasterSid: number;
  LedgerMasterSid: number;
  CustomerName: string;
  TotalAmount: number;
  TDSAmount?: number;
  NetAmount: number;
  MatchedInvoices: MatchedInvoiceDto[];
  InterBranchJV?: InterBranchJVDto;
  CreatedAt: Date;
  Status: string;
}

/**
 * Matched invoice details in response
 */
export class MatchedInvoiceDto {
  VoucherTransactionSid: number;
  InvoiceNumber: string;
  InvoiceDate: string;
  OriginalAmount: number;
  PreviouslyMatched: number;
  MatchedAmount: number;
  OutstandingAmount: number;
}

/**
 * Inter-branch journal voucher details
 */
export class InterBranchJVDto {
  JVHeaderSid: number;
  JVNumber: string;
  PayingBranchSid: number;
  ReceivingBranchSid: number;
  Amount: number;
  CreatedAt: Date;
}

/**
 * Outstanding invoice search result
 */
export class OutstandingInvoiceDto {
  VoucherTransactionSid: number;
  VoucherHeaderSid: number;
  VoucherDetailSid: number;
  VoucherNumber: string;
  VoucherDate: string;
  VoucherTypeMasterSid: number;
  VoucherType: string | number;
  LedgerMasterSid: number | null;
  COAMasterSid : number | null;
  CustomerName: string;
  OriginalCurrencyAmount: number;
  OriginalLocalAmount: number;
  MatchedAmount: number;
  MatchedCurrencyAmount: number;
  OutstandingLocalAmount: number;
  OutstandingCurrencyAmount: number;
  CurrencyCode: string;
  DrCr: string;

  // Additional search fields
  HouseNumber?: string;
  HBLNumber?: string;
  MasterNumber?: string;
  MBLNumber?: string;
  HAWB?: string;
  MAWB?: string;
  ChargeDescription?: string;
}

/**
 * Voucher matching DTO (for creating VoucherMatching records)
 */
export class VoucherMatchingDto {
  @IsNotEmpty()
  @IsNumber()
  CompanyMasterSid: number;

  @IsNotEmpty()
  @IsNumber()
  VoucherTransactionSid1: number; // Receipt transaction

  @IsNotEmpty()
  @IsNumber()
  VoucherTransactionSid2: number; // Invoice transaction

  @IsNotEmpty()
  @IsNumber()
  @Min(0)
  Amount: number; // Matched amount in local currency

  @IsOptional()
  @IsNumber()
  @Min(0)
  CurrencyAmount?: number;

  @IsOptional()
  @IsString()
  Narration?: string;

  @IsOptional()
  @IsString()
  CreatedBy?: string;
}

/**
 * Receipt summary DTO
 */
export class ReceiptSummaryDto {
  TotalReceipts: number;
  TotalAmount: number;
  TotalTDS: number;
  NetAmount: number;
  MatchedInvoicesCount: number;
  AdvanceReceiptsCount: number;
}

/**
 * Receipt filter options
 */
export class ReceiptFilterDto {
  @IsOptional()
  @IsNumber()
  CompanyMasterSid?: number;

  @IsOptional()
  @IsNumber()
  BranchMasterSid?: number;

  @IsOptional()
  @IsNumber()
  LedgerMasterSid?: number;

  @IsOptional()
  @IsString()
  DateFrom?: string;

  @IsOptional()
  @IsString()
  DateTo?: string;

  @IsOptional()
  @IsString()
  PaymentMode?: string;

  @IsOptional()
  @IsString()
  VoucherNumber?: string;

  @IsOptional()
  @IsBoolean()
  IncludeInterBranch?: boolean;
}

/**
 * Update receipt DTO
 */
export class UpdateReceiptDto {
  @IsOptional()
  @IsString()
  Narration?: string;

  @IsOptional()
  @IsString()
  Status?: string;

  @IsOptional()
  @IsString()
  UpdatedBy?: string;
}

/**
 * Reverse receipt DTO
 */
export class ReverseReceiptDto {
  @IsNotEmpty()
  @IsNumber()
  VoucherHeaderSid: number;

  @IsNotEmpty()
  @IsString()
  ReversalDate: string;

  @IsOptional()
  @IsString()
  Reason?: string;

  @IsOptional()
  @IsString()
  ReversedBy?: string;
}

export class VoucherMatchingPayload {
  @IsNotEmpty()
  @IsNumber()
  CompanyMasterSid: number;

  @IsNotEmpty()
  @IsNumber()
  BranchMasterSid: number;

  @IsNotEmpty()
  @IsNumber()
  VoucherHeaderSid : number;

  @IsString()
  voucherTypeInName : string;

  @IsNotEmpty()
  @IsNumber()
  VoucherTypeMasterSid : number;

  @IsOptional()
  @IsString()
  SubledgerName : string;

  @IsNotEmpty()
  @IsDate()
  PostDate : Date;
  
  @IsNotEmpty()
  @IsString()
  Narration : string;
  
  @IsNotEmpty()
  @IsString()
  createdBy : string;
  
  @IsNotEmpty()
  voucherMatching : any;
  
  @IsNotEmpty()
  @Type(()=>VoucherDetailDto)
  partyVoucherDetail: VoucherDetailDto;

  @IsNotEmpty()
  @IsNumber()
  /**
   * Bill Matching Currency Amount
   * 
   * It is the sum of currency amount that user provided against this receipt
   * In receipt case , it is the sum of currency amount in voucherMatching's Matching Part (right part)
   */
  BillMatchingCurrencyAmount : number;

  @IsNotEmpty()
  @IsNumber()
  /**
   * Bill Matching Local Amount
   * 
   * It is the sum of local amount that user provided against this receipt
   * In receipt case , it is the sum of local amount in voucherMatching's Matching Part (right part)
   */
  BillMatchingLocalAmount : number;

}
