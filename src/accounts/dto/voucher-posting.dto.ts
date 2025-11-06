import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber, IsString, IsArray, IsOptional, IsDateString, IsIn } from 'class-validator';

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

  @ApiProperty({ description: 'Tax type (CGST, SGST, IGST, VAT)', example: 'CGST' })
  @IsString()
  taxType: string;

  @ApiProperty({ description: 'Tax percentage', example: 9.00 })
  @IsNumber()
  taxPercentage: number;

  @ApiProperty({ description: 'Total taxable amount for this tax group', example: 10000.00 })
  @IsNumber()
  taxableAmount: number;

  @ApiProperty({ description: 'Total tax amount for this group', example: 900.00 })
  @IsNumber()
  taxAmount: number;

  @ApiProperty({ description: 'COA Master Sid for tax account', example: 78 })
  @IsNumber()
  coaMasterSid: number;
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
