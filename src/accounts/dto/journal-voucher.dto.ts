import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsNumber,
  IsDateString,
  IsArray,
  ValidateNested,
  IsIn,
  MaxLength,
  Min,
  IsNotEmpty,
} from 'class-validator';
import { Type } from 'class-transformer';

export class JournalVoucherDetailDto {
  @ApiProperty({ required: false, description: 'Detail Sid for updates' })
  @IsOptional()
  @IsNumber()
  VoucherDetailSid?: number;

  @ApiProperty({ description: 'Chart of Account (Ledger) - Mandatory' })
  @IsNotEmpty()
  @IsNumber()
  COAMasterSid: number;

  @ApiProperty({ required: false, description: 'Subledger - Optional' })
  @IsOptional()
  @IsNumber()
  LedgerMasterSid?: number;

  @ApiProperty({ description: 'Currency - Mandatory' })
  @IsNotEmpty()
  @IsNumber()
  CurrencyMasterSid: number;

  @ApiProperty({ required: false, description: 'Currency Code' })
  @IsOptional()
  @IsString()
  CurrencyCode?: string;

  @ApiProperty({ description: 'Exchange Rate - Mandatory' })
  @IsNotEmpty()
  @IsNumber()
  @Min(0)
  ExchangeRate: number;

  @ApiProperty({ description: 'Currency Amount - Mandatory' })
  @IsNotEmpty()
  @IsNumber()
  @Min(0.01)
  Amount: number;

  @ApiProperty({ description: 'Local Amount (calculated)' })
  @IsNotEmpty()
  @IsNumber()
  @Min(0)
  LocalAmount: number;

  @ApiProperty({ description: 'Debit or Credit', enum: ['D', 'C'] })
  @IsNotEmpty()
  @IsString()
  @IsIn(['D', 'C'])
  DrCr: string;

  @ApiProperty({ required: false, maxLength: 200 })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  Narration?: string;

  @ApiProperty({ required: false, description: 'Department - Optional' })
  @IsOptional()
  @IsNumber()
  DepartmentMasterSid?: number;

  @ApiProperty({ required: false, description: 'Charge - Optional' })
  @IsOptional()
  @IsNumber()
  ChargeMasterSid?: number;

  @ApiProperty({ required: false, description: 'Charge Description' })
  @IsOptional()
  @IsString()
  ChargeDescription?: string;

  @ApiProperty({ required: false, description: 'SAC/HSN Code (auto-fetched from charge)' })
  @IsOptional()
  @IsString()
  HSNSAC?: string;

  @ApiProperty({ required: false, description: 'Master Job - Optional' })
  @IsOptional()
  @IsNumber()
  MasterJobSid?: number;

  @ApiProperty({ required: false, description: 'House Job - Optional' })
  @IsOptional()
  @IsNumber()
  HouseJobSid?: number;

  @ApiProperty({ required: false, description: 'Tax Percentage 1 (CGST/VAT)' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  TaxPercentage1?: number;

  @ApiProperty({ required: false, description: 'Tax Amount 1' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  TaxAmount1?: number;

  @ApiProperty({ required: false, description: 'Tax Percentage 2 (SGST)' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  TaxPercentage2?: number;

  @ApiProperty({ required: false, description: 'Tax Amount 2' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  TaxAmount2?: number;

  @ApiProperty({ required: false, description: 'Cost Center - Optional' })
  @IsOptional()
  @IsNumber()
  CostCenterMasterSid?: number;

  @ApiProperty({ required: false, description: 'Profit Center - Optional' })
  @IsOptional()
  @IsNumber()
  ProfitCenterMasterSid?: number;

  @ApiProperty({ required: false, description: 'Line is auto-generated tax line' })
  @IsOptional()
  isAutoTaxLine?: boolean;
}

export class CreateJournalVoucherDto {
  @ApiProperty({ description: 'Company Master Sid' })
  @IsNotEmpty()
  @IsNumber()
  CompanyMasterSid: number;

  @ApiProperty({ description: 'Branch Master Sid' })
  @IsNotEmpty()
  @IsNumber()
  BranchMasterSid: number;

  @ApiProperty({ description: 'Voucher Date - Today or past date within financial year' })
  @IsNotEmpty()
  @IsDateString()
  VoucherDate: string;

  @ApiProperty({ required: false, maxLength: 200 })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  Narration?: string;

  @ApiProperty({ required: false, maxLength: 200 })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  Remarks?: string;

  @ApiProperty({ required: false, description: 'Status: Active/Inactive', default: 'Active' })
  @IsOptional()
  @IsString()
  @IsIn(['Active', 'Inactive'])
  Status?: string;

  @ApiProperty({ type: [JournalVoucherDetailDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => JournalVoucherDetailDto)
  details: JournalVoucherDetailDto[];
}

export class UpdateJournalVoucherDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsDateString()
  VoucherDate?: string;

  @ApiProperty({ required: false, maxLength: 200 })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  Narration?: string;

  @ApiProperty({ required: false, maxLength: 200 })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  Remarks?: string;

  @ApiProperty({ required: false, description: 'Status: Active/Inactive' })
  @IsOptional()
  @IsString()
  @IsIn(['Active', 'Inactive'])
  Status?: string;

  @ApiProperty({ type: [JournalVoucherDetailDto], required: false })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => JournalVoucherDetailDto)
  details?: JournalVoucherDetailDto[];
}

export class JournalVoucherListQueryDto {
  @ApiProperty({ description: 'Company Master Sid' })
  @IsNotEmpty()
  @IsNumber()
  @Type(() => Number)
  CompanyMasterSid: number;

  @ApiProperty({ description: 'Branch Master Sid' })
  @IsNotEmpty()
  @IsNumber()
  @Type(() => Number)
  BranchMasterSid: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  page?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  limit?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  voucherNumber?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsDateString()
  fromDate?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsDateString()
  toDate?: string;

  @ApiProperty({ required: false, enum: ['U', 'P'] })
  @IsOptional()
  @IsString()
  @IsIn(['U', 'P'])
  postStatus?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  searchTerm?: string;
}

export class JournalVoucherResponseDto {
  @ApiProperty()
  VoucherHeaderSid: number;

  @ApiProperty()
  VoucherNumber: string;

  @ApiProperty()
  VoucherDate: Date;

  @ApiProperty({ required: false })
  PostDate?: Date;

  @ApiProperty()
  PostStatus: string;

  @ApiProperty({ required: false })
  Narration?: string;

  @ApiProperty({ required: false })
  Remarks?: string;

  @ApiProperty()
  Status: string;

  @ApiProperty()
  Amount: number;

  @ApiProperty()
  LocalAmount: number;

  @ApiProperty({ type: [Object] })
  details: any[];

  @ApiProperty()
  DebitTotal: number;

  @ApiProperty()
  CreditTotal: number;

  @ApiProperty()
  IsBalanced: boolean;
}
