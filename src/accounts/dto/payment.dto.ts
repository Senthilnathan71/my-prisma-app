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
  IsEnum,
  MaxLength,
  IsDefined,
} from 'class-validator';
import { Type } from 'class-transformer';

/**
 * Payment Voucher DTOs
 *
 * Supports 4 types of payments:
 * 1. Advance Payment to Vendor
 * 2. Payment against Vendor Invoice with TDS deduction
 * 3. Multi-branch Payment with Auto Inter-branch JV
 * 4. Direct Expense Payment (no vendor)
 */

/**
 * DTO for creating a payment voucher
 */
export class CreatePaymentDto {
  @IsNotEmpty()
  @IsNumber()
  CompanyMasterSid: number;

  @IsNotEmpty()
  @IsNumber()
  BranchMasterSid: number;

  @IsNotEmpty()
  @IsString()
  VoucherDate: string; // YYYY-MM-DD format

  @IsNotEmpty()
  @IsString()
  PaymentMode: string; // Cash, Bank

  @IsNotEmpty()
  @IsNumber()
  BankLedgerMasterSid: number; // Cash or Bank account from COA

  @IsNotEmpty()
  @IsNumber()
  CurrencyMasterSid: number;

  @IsNotEmpty()
  @IsNumber()
  @Min(0)
  ExchangeRate: number;

  // Optional vendor for advance/invoice payments
  // Not required for direct expense payments
  @IsOptional()
  @IsNumber()
  VendorLedgerMasterSid?: number;

  @IsNotEmpty()
  @IsString()
  @MaxLength(200)
  PaidTo: string; // Party name (can be different from vendor name)

  @IsOptional()
  @IsString()
  @MaxLength(500)
  Address?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  GSTNumber?: string; // GST for India, VAT for Dubai

  @IsOptional()
  @IsString()
  @MaxLength(200)
  Narration?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  Remarks?: string;

  // Instrument details (not required for cash payments)
  @IsOptional()
  @IsString()
  InstrumentMode?: string; // Cheque, DD, IMPS, NEFT, RTGS, Others

  @IsOptional()
  @IsString()
  InstrumentNumber?: string;

  @IsOptional()
  @IsString()
  InstrumentDate?: string; // YYYY-MM-DD

  @IsOptional()
  @IsString()
  ClearanceDate?: string; // YYYY-MM-DD

  // Multi-branch support
  @IsOptional()
  @IsBoolean()
  IsMultiBranch?: boolean;

  // Payment details (ledger allocations, expenses, etc.)
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PaymentDetailDto)
  Details: PaymentDetailDto[];

  // TDS deductions
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PaymentTDSDto)
  TDSDetails?: PaymentTDSDto[];

  // Voucher matching (invoice payments)
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PaymentVoucherMatchingDto)
  VoucherMatchings?: PaymentVoucherMatchingDto[];

  // Inter-branch allocation
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PaymentInterBranchDto)
  InterBranch?: PaymentInterBranchDto[];

  @IsOptional()
  @IsString()
  CreatedBy?: string;
}

/**
 * Payment detail line - ledger allocation
 * Used for expense allocation, multi-ledger payments
 */
export class PaymentDetailDto {
  @IsOptional()
  @IsNumber()
  ChargeMasterSid?: number; // Optional charge code

  @IsOptional()
  @IsString()
  SACHSCode?: string; // SAC/HS code for tax

  @IsNotEmpty()
  @IsNumber()
  LedgerMasterSid: number; // Subledger for this line item

  @IsNotEmpty()
  @IsNumber()
  BranchMasterSid: number; // Branch for this allocation

  @IsNotEmpty()
  @IsString()
  DrCr: string; // 'D' or 'C'

  @IsNotEmpty()
  @IsNumber()
  CurrencyMasterSid: number;

  @IsNotEmpty()
  @IsNumber()
  @Min(0)
  ExchangeRate: number;

  @IsNotEmpty()
  @IsNumber()
  @Min(0)
  CurrencyAmount: number;

  @IsNotEmpty()
  @IsNumber()
  @Min(0)
  TaxableAmount: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  TaxPercentage?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  TaxAmount?: number;

  @IsNotEmpty()
  @IsNumber()
  @Min(0)
  LocalAmount: number; // ExchangeRate * CurrencyAmount

  @IsOptional()
  @IsString()
  @MaxLength(200)
  Narration?: string;

  @IsOptional()
  @IsNumber()
  CostCenterSid?: number;

  @IsOptional()
  @IsNumber()
  ProfitCenterSid?: number;

  @IsOptional()
  @IsNumber()
  MasterJobSid?: number;

  @IsOptional()
  @IsNumber()
  HouseJobSid?: number;
}

/**
 * TDS deduction details
 * Stores in VoucherTDS table for TDS reporting
 */
export class PaymentTDSDto {
  @IsNotEmpty()
  @IsNumber()
  TDSSetRateSid: number; // From TDS master

  @IsNotEmpty()
  @IsString()
  TDSCompanyType: string; // Company, Individual, etc.

  @IsNotEmpty()
  @IsString()
  ITSectionCode: string; // 194C, 194J, 194H, etc.

  @IsOptional()
  @IsString()
  CertificateNumber?: string; // TDS certificate number

  @IsNotEmpty()
  @IsNumber()
  @Min(0)
  TDSPercentage: number;

  @IsNotEmpty()
  @IsNumber()
  @Min(0)
  TaxableAmount: number;

  @IsNotEmpty()
  @IsNumber()
  @Min(0)
  TDSAmount: number; // TaxableAmount * TDSPercentage / 100

  @IsOptional()
  @IsString()
  @MaxLength(200)
  Reason?: string; // Reason for lower/NIL deduction
}

/**
 * Voucher matching - links payment to vendor invoices
 */
export class PaymentVoucherMatchingDto {
  @IsNotEmpty()
  @IsNumber()
  VoucherTransactionSid: number; // Vendor invoice transaction

  @IsNotEmpty()
  @IsNumber()
  @Min(0)
  CurrencyAmount: number; // Amount being matched in currency

  @IsNotEmpty()
  @IsNumber()
  @Min(0)
  LocalAmount: number; // Amount being matched in local currency

  @IsOptional()
  @IsNumber()
  @Min(0)
  TDSAmount?: number; // TDS deducted for this invoice

  @IsOptional()
  @IsString()
  @MaxLength(200)
  Narration?: string;
}

/**
 * Inter-branch allocation
 * Used when payment is for multiple branches
 */
export class PaymentInterBranchDto {
  @IsNotEmpty()
  @IsNumber()
  BranchMasterSid: number; // Receiving branch

  @IsNotEmpty()
  @IsNumber()
  @Min(0)
  CurrencyAmount: number; // Amount allocated to this branch

  @IsOptional()
  @IsString()
  @MaxLength(200)
  Narration?: string;
}

/**
 * Search criteria for vendor outstanding invoices
 */
export class SearchVendorOutstandingDto {
  @IsNotEmpty()
  @IsNumber()
  CompanyMasterSid: number;

  @IsOptional()
  @IsNumber()
  BranchMasterSid?: number;

  @IsOptional()
  @IsNumber()
  LedgerMasterSid?: number; // Vendor

  @IsOptional()
  @IsString()
  VendorName?: string;

  @IsOptional()
  @IsString()
  InvoiceNumber?: string;

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
 * Response DTO for created payment
 */
export class PaymentResponseDto {
  VoucherHeaderSid: number;
  VoucherNumber: string;
  VoucherDate: string;
  CompanyMasterSid: number;
  BranchMasterSid: number;
  VendorLedgerMasterSid?: number;
  VendorName?: string;
  TotalAmount: number;
  TDSAmount?: number;
  NetAmount: number;
  PaymentMode: string;
  MatchedInvoices: MatchedInvoiceDto[];
  TDSDetails?: PaymentTDSResponseDto[];
  InterBranchJVs?: InterBranchJVDto[];
  ExchangeJV?: ExchangeJVDto;
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
  TDSAmount?: number;
  OutstandingAmount: number;
}

/**
 * TDS details in response
 */
export class PaymentTDSResponseDto {
  VoucherTDSSid: number;
  ITSectionCode: string;
  TDSPercentage: number;
  TaxableAmount: number;
  TDSAmount: number;
  CertificateNumber?: string;
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
 * Exchange gain/loss journal voucher details
 */
export class ExchangeJVDto {
  JVHeaderSid: number;
  JVNumber: string;
  ExchangeDifference: number;
  IsGain: boolean; // true = Gain, false = Loss
  CreatedAt: Date;
}

/**
 * Vendor outstanding invoice search result
 */
export class VendorOutstandingInvoiceDto {
  VoucherTransactionSid: number;
  VoucherHeaderSid: number;
  VoucherNumber: string;
  VoucherDate: string;
  VoucherType: number;
  LedgerMasterSid: number;
  VendorName: string;
  BranchName?: string;
  OriginalAmount: number;
  OriginalCurrencyAmount: number;
  MatchedAmount: number;
  MatchedCurrencyAmount: number;
  OutstandingAmount: number;
  OutstandingCurrencyAmount: number;
  CurrencyCode: string;
  ExchangeRate: number;
  DrCr: string;
  ChargeDescription?: string;
  HouseNumber?: string;
  MasterNumber?: string;
}

/**
 * Filter DTO for listing payments
 */
export class PaymentFilterDto {
  @IsOptional()
  @IsNumber()
  CompanyMasterSid?: number;

  @IsOptional()
  @IsNumber()
  BranchMasterSid?: number;

  @IsOptional()
  @IsString()
  VoucherNumber?: string;

  @IsOptional()
  @IsNumber()
  VendorLedgerMasterSid?: number;

  @IsOptional()
  @IsString()
  DateFrom?: string; // YYYY-MM-DD

  @IsOptional()
  @IsString()
  DateTo?: string; // YYYY-MM-DD

  @IsOptional()
  @IsString()
  PaymentMode?: string; // Cash, Bank

  @IsOptional()
  @IsNumber()
  Limit?: number;

  @IsOptional()
  @IsNumber()
  Offset?: number;
}

/**
 * Update payment DTO
 */
export class UpdatePaymentDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  Narration?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  Remarks?: string;

  @IsOptional()
  @IsString()
  Status?: string;

  @IsOptional()
  @IsString()
  UpdatedBy?: string;
}

/**
 * Search payments DTO
 */
export class SearchPaymentDto {
  @IsDefined({ message: 'Company master is required' })
  @IsNumber()
  CompanyMasterSid: number;

  @IsDefined({ message: 'Branch master is required' })
  @IsNumber()
  BranchMasterSid: number;

  @IsOptional()
  @IsNumber()
  search : string;

  @IsOptional()
  page : number;

  @IsOptional()
  pageSize : number;

  @IsOptional()
  sortColumn : string;

  @IsOptional()
  sortDirection : string;

}

/**
 * Reverse payment DTO
 */
export class ReversePaymentDto {
  @IsNotEmpty()
  @IsNumber()
  VoucherHeaderSid: number;

  @IsNotEmpty()
  @IsString()
  ReversalDate: string; // YYYY-MM-DD

  @IsNotEmpty()
  @IsString()
  @MaxLength(200)
  ReversalReason: string;

  @IsOptional()
  @IsString()
  ReversedBy?: string;
}
