import { ApiOperation, ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber, IsString, IsArray, IsOptional, IsDateString, IsIn,  IsInt,
  MaxLength,
  Length,
  IsDate, } from 'class-validator';
import {

} from 'class-validator';
import { Type } from 'class-transformer';
import { Decimal } from '@prisma/client/runtime/library';
/**
 * DTO for individual voucher line item in posting payload
 */
export class VoucherLineDto {
  @ApiProperty({ description: 'Serial number of the line', example: 1 })
  @IsNumber()
  sno: number;

  @ApiProperty({ description: 'Voucher Detail Sid', example: 123 })
  @IsNumber()
  voucherDetailSid: number;

  @ApiProperty({ description: 'Chart of Account Master Sid', example: 45 })
  @IsNumber()
  coaMasterSid: number;

  @ApiProperty({ description: 'Ledger/Subledger Master Sid', required: false })
  @IsOptional()
  @IsNumber()
  ledgerMasterSid?: number;

  @ApiProperty({ description: 'Debit or Credit indicator', enum: ['D', 'C'], example: 'D' })
  @IsIn(['D', 'C'])
  drCr: string;

  @ApiProperty({ description: 'Charge description', required: false })
  @IsOptional()
  @IsString()
  chargeDescription?: string;

  @ApiProperty({ description: 'Taxable amount before tax', example: 1000.00 })
  @IsNumber()
  taxableAmount: number;

  @ApiProperty({ description: 'Total amount including tax', example: 1180.00 })
  @IsNumber()
  amount: number;

  @ApiProperty({ description: 'Amount in local currency', example: 1180.00 })
  @IsNumber()
  localAmount: number;

  @ApiProperty({ description: 'GST/VAT code', required: false })
  @IsOptional()
  @IsString()
  gstVatCode?: string;

  @ApiProperty({ description: 'HS/SAC Master Sid for tax categorization', required: false })
  @IsOptional()
  @IsNumber()
  hsSacMasterSid?: number;

  @ApiProperty({ description: 'Number of units', required: false })
  @IsOptional()
  @IsNumber()
  numberOfUnit?: number;

  @ApiProperty({ description: 'Rate per unit', required: false })
  @IsOptional()
  @IsNumber()
  rate?: number;

  @ApiProperty({ description: 'Narration/description', required: false })
  @IsOptional()
  @IsString()
  narration?: string;

  @ApiProperty({ description: 'Cost center', required: false })
  @IsOptional()
  @IsNumber()
  costCenter?: number;

  @ApiProperty({ description: 'Profit center', required: false })
  @IsOptional()
  @IsNumber()
  profitCenter?: number;

  @ApiProperty({ description: 'Department Master Sid', required: false })
  @IsOptional()
  @IsNumber()
  departmentMasterSid?: number;

  @ApiProperty({ description: 'House Job Sid', required: false })
  @IsOptional()
  @IsNumber()
  houseJobSid?: number;

  @ApiProperty({ description: 'Master Job Sid', required: false })
  @IsOptional()
  @IsNumber()
  masterJobSid?: number;

  @ApiProperty({ description: 'Cost or Revenue indicator', required: false })
  @IsOptional()
  @IsString()
  costRevenue?: string;

  @ApiProperty({ description: 'Tax Percentage 1 (CGST)', required: false })
  @IsOptional()
  @IsNumber()
  taxPercentage1?: number;

  @ApiProperty({ description: 'Tax Amount 1', required: false })
  @IsOptional()
  @IsNumber()
  taxAmount1?: number;

  @ApiProperty({ description: 'Tax Percentage 2 (SGST)', required: false })
  @IsOptional()
  @IsNumber()
  taxPercentage2?: number;

  @ApiProperty({ description: 'Tax Amount 2', required: false })
  @IsOptional()
  @IsNumber()
  taxAmount2?: number;

  @ApiProperty({ description: 'Year Master Sid', required: false })
  @IsOptional()
  @IsNumber()
  yearMasterSid?: number;
}

/**
 * DTO for tax summary grouped by HS/SAC code
 */
export class TaxSummaryDto {
  @ApiProperty({ description: 'HS/SAC Master Sid', example: 10 })
  @IsNumber()
  hsSacMasterSid: number;

  @ApiProperty({ description: 'HS/SAC code', example: 'SAC998599' })
  @IsString()
  hsSacCode: string;

  @ApiProperty({ description: 'Tax name', example: 'CGST IP 6%' })
  @IsString()
  taxName: string;

  @ApiProperty({ description: 'Tax type (CGST, SGST, IGST, VAT)', example: 'CGST' })
  @IsString()
  taxType: string;

  @ApiProperty({ description: 'Tax percentage', example: 9.00 })
  @IsNumber()
  taxPercentage: number;

  @ApiProperty({ description : 'Tax Master Sid', example: 123 })
  @IsNumber()
  taxMasterSid: number;

  @ApiProperty({ description: 'Total taxable amount for this tax group', example: 10000.00 })
  @IsNumber()
  taxableAmount: number;

  @ApiProperty({ description: 'Total tax amount for this group', example: 900.00 })
  @IsNumber()
  taxAmount: number;

  @ApiProperty({ description: 'COA Master Sid for tax account', example: 78 })
  @IsNumber()
  coaMasterSid: number;

  @ApiProperty({ description: 'Ledger Master Sid for tax account', example: 78 })
  @IsNumber()
  ledgerMasterSid: number;

  @ApiProperty({ description: 'Debtor / Creditor indicator', enum: ['D', 'C'], example: 'D' })
  @IsString()
  DrCr: string | null;
}

/**
 * DTO for voucher posting request
 */
export class PostVoucherRequestDto {
  @ApiProperty({ description: 'Voucher Header Sid to post', example: 100 })
  @IsNotEmpty()
  @IsNumber()
  voucherHeaderSid: number;

  @ApiProperty({ description: 'Voucher number', example: 'INV/2024/001' })
  @IsNotEmpty()
  @IsString()
  voucherNumber: string;

  @ApiProperty({ description: 'Company Master Sid', example: 1 })
  @IsNotEmpty()
  @IsNumber()
  companyMasterSid: number;

  @ApiProperty({ description: 'Branch Master Sid', example: 1 })
  @IsNotEmpty()
  @IsNumber()
  branchMasterSid: number;

  @ApiProperty({ description: 'Voucher date in YYYY-MM-DD format', example: '2024-11-01' })
  @IsNotEmpty()
  @IsDateString()
  voucherDate: string;

  @ApiProperty({ description: 'Posting date in YYYY-MM-DD format', example: '2024-11-01' })
  @IsNotEmpty()
  @IsDateString()
  postDate: string;

  @ApiProperty({ description: 'Currency code', example: 'USD' })
  @IsNotEmpty()
  @IsString()
  currencyCode: string;

  @ApiProperty({ description: 'Exchange rate', example: 1.000 })
  @IsNotEmpty()
  @IsNumber()
  exchangeRate: number;

  @ApiProperty({ description: 'Voucher type', example: 1 })
  @IsNotEmpty()
  @IsNumber()
  voucherType: number;

  @ApiProperty({ description: 'Voucher Type Master Sid', example: 5 })
  @IsNotEmpty()
  @IsNumber()
  voucherTypeMasterSid: number;

  @ApiProperty({ description: 'Year Master Sid', example: 2 })
  @IsNotEmpty()
  @IsNumber()
  yearMasterSid: number;

  @ApiProperty({ description: 'GST/VAT identifier', required: false })
  @IsOptional()
  @IsString()
  gstVat?: string;

  @ApiProperty({ description: 'Array of voucher line items', type: [VoucherLineDto] })
  @IsArray()
  lines: VoucherLineDto[];

  @ApiProperty({ description: 'Array of tax summaries grouped by HS/SAC code', type: [TaxSummaryDto] })
  @IsArray()
  taxSummaries: TaxSummaryDto[];

  @ApiProperty({ description: 'User who is posting', example: 'admin@example.com' })
  @IsNotEmpty()
  @IsString()
  createdBy: string;
}

/**
 * Validation error detail
 */
export class ValidationErrorDto {
  @ApiProperty({ description: 'Error code', example: 'UNBALANCED_ENTRY' })
  code: string;

  @ApiProperty({ description: 'Error message', example: 'Total Debit and Credit amounts do not match' })
  message: string;

  @ApiProperty({ description: 'Field name that caused the error', required: false })
  field?: string;

  @ApiProperty({ description: 'Additional context or details', required: false })
  details?: any;
}

/**
 * DTO for validation result
 */
export class ValidationResultDto {
  @ApiProperty({ description: 'Whether validation passed', example: true })
  isValid: boolean;

  @ApiProperty({ description: 'Array of validation errors', type: [ValidationErrorDto] })
  errors: ValidationErrorDto[];

  @ApiProperty({ description: 'Total debit amount', example: 10000.00 })
  totalDebit?: number;

  @ApiProperty({ description: 'Total credit amount', example: 10000.00 })
  totalCredit?: number;

  @ApiProperty({ description: 'Number of detail lines', example: 5 })
  lineCount?: number;

  @ApiProperty({ description: 'Validation timestamp' })
  validatedAt?: Date;
}

/**
 * DTO for posting response
 */
export class PostVoucherResponseDto {
  @ApiProperty({ description: 'Whether posting succeeded', example: true })
  success: boolean;

  @ApiProperty({ description: 'Voucher Header Sid that was posted', example: 100 })
  voucherHeaderSid?: number;

  @ApiProperty({ description: 'Number of VoucherTransaction records created', example: 12 })
  transactionCount?: number;

  @ApiProperty({ description: 'Array of created VoucherTransaction Sids' })
  transactionSids?: number[];

  @ApiProperty({ description: 'Posting timestamp' })
  postedAt?: Date;

  @ApiProperty({ description: 'Array of errors if posting failed', type: [ValidationErrorDto] })
  errors: ValidationErrorDto[];

  @ApiProperty({ description: 'Additional message or notes' })
  message?: string;
}

/**
 * DTO for draft voucher response (includes header and details)
 */
export class DraftVoucherResponseDto {
  @ApiProperty({ description: 'Voucher header information' })
  header: any;

  @ApiProperty({ description: 'Array of voucher detail lines' })
  details: any[];

  @ApiProperty({ description: 'Whether voucher is already posted', example: false })
  isPosted: boolean;

  @ApiProperty({ description: 'Current posting status' })
  postingStatus?: string;
}

export class VoucherDetailDto {
  @IsInt()
  VoucherDetailSid: number ;

  @IsInt()
  CompanyMasterSid: number;

  @IsInt()
  BranchMasterSid: number;

  @IsInt()
  VoucherHeaderSid: number;

  @IsInt()
  Sno: Decimal;

  @IsOptional()
  @IsInt()
  ChargeMasterSid : number | null;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  ChargeDescription : string | null;

  @IsOptional()
  @IsInt()
  LedgerMasterSid : number | null;

  @IsOptional()
  @IsInt()
  COAMasterSid : number | null;

  @IsOptional()
  @IsInt()
  HSSACMasterSid : number | null;

  @IsOptional()
  @IsInt()
  DepartmentMasterSid: number | null;

  @IsOptional()
  @IsInt()
  HouseJobSid : number | null;

  @IsOptional()
  @IsInt()
  MasterJobSid : number | null;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  CostRevenue: string | null;

  @IsInt()
  CurrencyMasterSid: number;

  @IsString()
  @Length(3, 3)
  CurrencyCode: string;

  @IsNumber({ maxDecimalPlaces: 3 })
  @Type(() => Number)
  ExchangeRate: Decimal;

  @IsNumber({ maxDecimalPlaces: 3 })
  @Type(() => Number)
  Rate: Decimal;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 3 })
  @Type(() => Number)
  NumberOfUnit: Decimal | null;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  Narration?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  DrCr: string | null;

  @IsNumber({ maxDecimalPlaces: 3 })
  @Type(() => Number)
  TaxableAmount: Decimal;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  TaxPercentage1?: Decimal | null;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 3 })
  TaxAmount1?:  Decimal | null;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  TaxPercentage2?:  Decimal | null;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 3 })
  TaxAmount2?:  Decimal | null;

  @IsNumber({ maxDecimalPlaces: 3 })
  @Type(() => Number)
  Amount: Decimal;

  @IsNumber({ maxDecimalPlaces: 3 })
  @Type(() => Number)
  LocalAmount: Decimal;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  InvoiceType?: string | null;

  @IsOptional()
  @IsInt()
  CostCenter?: number | null;

  @IsOptional()
  @IsInt()
  ProfitCenter?: number | null;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  Remarks?: string | null;

  @IsOptional()
  @IsInt()
  ChargeUOMSid?: number | null;

  @IsOptional()
  @IsInt()
  YearMasterSid?: number | null;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 3 })
  @Type(() => Number)
  PartyAmount?: Decimal | null;

  @IsOptional()
  @IsInt()
  VoucherTransactionSid?: number | null;

  @IsOptional()
  hSSACMaster ?: any | null;

  @IsOptional()
  IsAutoGenerated ?: string | null;

}
export class HSSACMasterDto {
  @IsString()
  @MaxLength(200)
  HSSACCode: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  HSSACName?: string;

  @IsString()
  @MaxLength(100)
  ServiceName: string;

  @IsNumber({ maxDecimalPlaces: 3 })
  @Type(() => Number)
  TaxRate: number;

  @IsString()
  @MaxLength(10)
  TaxType: string;

  @IsDate()
  @Type(() => Date)
  EffectiveFrom: Date;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  Remarks?: string;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  ClassificationType?: string;

  @IsOptional()
  @IsString()
  @MaxLength(700)
  HSNSACDescription?: string;
}

export class PostVoucherDTO {
  @ApiProperty({ description: 'Whether posting succeeded', example: true })
  success: boolean;

  @ApiProperty({ description: 'Voucher Header Sid that was posted', example: 100 })
  @IsNumber()
  voucherHeaderSid : number;

  @ApiProperty({ description: 'Company Master Sid', example: 1 })
  @IsNumber()
  companyMasterSid: number;

  @ApiProperty({ description: 'Branch Master Sid', example: 1 })
  @IsNumber()
  branchMasterSid : number;

  @ApiProperty({ description : 'Voucher Number', example: 'INV/2024/001' })
  voucherNumber?: string;

  @ApiProperty({ description: 'VoucherType', example: 1 })
  voucherType?: number;

  @ApiProperty({ description: 'Voucher date in YYYY-MM-DD format', example: '2024-11-01' })
  voucherDate?: string;

  @ApiProperty({ description: 'Posting date in YYYY-MM-DD format', example: '2024-11-01' })
  postDate?: string;

  @ApiProperty({description : 'PartyMasterSid', example: 1 })
  @IsNumber()
  partyMasterSid?: number;

  @ApiProperty({description : 'COAMasterSid', example: 1 })
  @IsNumber()
  coaMasterSid?: number;

  @ApiProperty({description : 'SubledgerMasterSid', example: 1 })
  @IsNumber()
  ledgerMasterSid?: number;

  @ApiProperty({description : 'SubledgerMasterSid', example: 1 })
  @IsNumber()
  currencyMasterSid : number;

  @ApiProperty({description : 'CurrencyCode', example: 'INR' })
  @IsString()
  currencyCode : string;

  @ApiProperty({description : 'Exchange Rate', example: 2.56 })
  @IsNumber()
  exchangeRate : string;

  @ApiProperty({description : 'VoucherTypeMasterSid', example: 1 })
  @IsNumber()
  voucherTypeMasterSid?: number;
  
  @ApiProperty({description : 'Narration', example: 'INR' })
  @IsString()
  narration : string;

  @ApiProperty({description : 'PartyAmount', example: 12000 })
  @IsNumber()
  partyAmount : number;

  @ApiProperty({description : 'PostStatus',enum:['U','P'] ,example: 'U' })
  postStatus?: string;

  @ApiProperty({description : 'Charge Line Items', type: [VoucherDetailDto] })
  @IsArray()
  chargeLineItems: VoucherDetailDto[];

  @ApiProperty({description : 'CreatedBy', example: 'System' })
  createdBy : string;
}
