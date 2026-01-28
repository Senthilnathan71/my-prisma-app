import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsInt, IsNotEmpty, IsDateString, IsEnum, IsNumber, IsBoolean, IsArray, Validate, ValidateNested } from 'class-validator';

export enum ExportFormatEnum {
  EXCEL = 'EXCEL',
  PDF = 'PDF',
  CSV = 'CSV'
}

export enum AgeingTypeEnum {
  DAYS_30_60_90 = '30_60_90',
  DAYS_15_30_45_60 = '15_30_45_60',
  CUSTOM = 'custom'
}

export enum OutstandingTypeEnum {
  RECEIVABLE = 'receivable',
  PAYABLE = 'payable',
  BOTH = 'both'
}

export enum ReportFormatTypeEnum {
  DETAILED = 'detailed',
  SUMMARY = 'summary'
}

export enum TaxPeriodEnum {
  Q1 = 'Q1',
  Q2 = 'Q2',
  Q3 = 'Q3',
  Q4 = 'Q4',
  CUSTOM = 'custom'
}

export enum GroupByEnum {
  GROUP = 'group',
  SUBGROUP = 'subgroup',
  BOTH = 'both'
}

// Ageing Report DTOs
export class AgeingReportQueryDto {

  @ApiProperty()
  @IsNotEmpty()
  @IsDateString()
  ToDate: string;

  @ApiProperty({ enum: AgeingTypeEnum })
  @IsNotEmpty()
  @IsEnum(AgeingTypeEnum)
  ageingType: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  Ledger?: number;

  @IsOptional()
  @IsBoolean()
  CurrencyWise : boolean;

  @ApiProperty()
  @IsNotEmpty()
  @IsInt()
  companyId: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  Branch?: number[];
}

// Outstanding Report DTOs
export class OutstandingReportQueryDto {

  @ApiProperty()
  @IsNotEmpty()
  @IsDateString()
  ToDate: string;

  @IsNotEmpty()
  @IsInt()
  Ledger : number;

  @ApiPropertyOptional()
  @IsNotEmpty()
  @IsInt()
  Subledger?: number;


  @ApiProperty()
  @IsNotEmpty()
  @IsInt()
  companyId: number;

  @ApiPropertyOptional()
  @IsNotEmpty()
  @IsArray()
  Branch?: number[];
}

// Statement/Ledger Report DTOs
export class StatementLedgerReportQueryDto {
  @ApiProperty()
  @IsNotEmpty()
  @IsDateString()
  FromDate: string;

  @ApiProperty()
  @IsNotEmpty()
  @IsDateString()
  ToDate: string;

  @ApiProperty()
  @IsNotEmpty()
  @IsInt()
  Ledger: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  Subledger?: number;

  @ApiProperty()
  @IsNotEmpty()
  @IsInt()
  companyId: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  Branch?: number[];
}

// ledger Report

export class LedgerReportQueryDto {
  @ApiProperty()
  @IsNotEmpty()
  @IsDateString()
  FromDate: string;

  @ApiProperty()
  @IsNotEmpty()
  @IsDateString()
  ToDate: string;

  @ApiProperty()
  @IsOptional()
  @IsInt()
  Ledger: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  Subledger?: number;

  @ApiProperty()
  @IsNotEmpty()
  @IsInt()
  companyId: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  Branch?: number[];

  @ApiProperty()
  @IsNotEmpty()
  @IsInt()
  VoucherType: number;
}

// Trial Balance DTOs (already exists, just import reference)
export class TrialBalanceReportQueryDto {
  @ApiProperty()
  @IsNotEmpty()
  @IsInt()
  financialYear: number;

  @ApiProperty()
  @IsNotEmpty()
  @IsDateString()
  FromDate: string;

  @ApiProperty()
  @IsNotEmpty()
  @IsDateString()
  ToDate: string;

  @ApiProperty({ enum: GroupByEnum })
  @IsNotEmpty()
  @IsEnum(GroupByEnum)
  groupBy: string;

  @ApiProperty()
  @IsNotEmpty()
  @IsInt()
  companyId: number;

  @ApiProperty()
  @IsNotEmpty()
  @IsDateString()
  GroupName: string;

  
  @ApiProperty()
  @IsNotEmpty()
  @IsDateString()
  SubGroupName: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  Branch?: number[];

  @IsOptional()
  @IsBoolean()
  SubTotal : boolean;
}

// Profit & Loss DTOs
export class ProfitLossReportQueryDto {
  @ApiProperty()
  @IsNotEmpty()
  @IsInt()
  financialYear: number;

  @ApiProperty()
  @IsNotEmpty()
  @IsDateString()
  FromDate: string;

  @ApiProperty()
  @IsNotEmpty()
  @IsDateString()
  ToDate: string;

  @ApiProperty({ enum: ReportFormatTypeEnum })
  @IsNotEmpty()
  @IsEnum(ReportFormatTypeEnum)
  reportFormat: string;

  @ApiProperty()
  @IsNotEmpty()
  @IsInt()
  companyId: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  Branch?: number[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  COAMasterSid?: number[];
}

// Balance Sheet DTOs
export class BalanceSheetReportQueryDto {
  @ApiProperty()
  @IsNotEmpty()
  @IsDateString()
  FromDate: string;

  @ApiProperty()
  @IsNotEmpty()
  @IsDateString()
  ToDate: string;

  @ApiProperty()
  @IsNotEmpty()
  @IsInt()
  financialYear: number;

  @ApiProperty({ enum: ReportFormatTypeEnum })
  @IsNotEmpty()
  @IsEnum(ReportFormatTypeEnum)
  reportFormat: string;

  @ApiProperty()
  @IsNotEmpty()
  @IsInt()
  companyId: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  Branch?: number[];
}

// VAT Receivable/Payable DTOs
export class VATReportQueryDto {
  @ApiProperty()
  @IsNotEmpty()
  @IsDateString()
  VoucherFromDate: string;

  @ApiProperty()
  @IsNotEmpty()
  @IsDateString()
  VoucherToDate: string;

  @ApiProperty({ enum: TaxPeriodEnum })
  @IsNotEmpty()
  @IsEnum(TaxPeriodEnum)
  taxPeriod: string;

  @ApiProperty()
  @IsNotEmpty()
  @IsInt()
  companyId: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  branchId?: number;


  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  coamasterSid?: number;
}

// Profit Summary Report DTOs
export class ProfitSummaryReportQueryDto {
  @ApiProperty()
  @IsNotEmpty()
  @IsDateString()
  fromDate: string;

  @ApiProperty()
  @IsNotEmpty()
  @IsDateString()
  toDate: string;

  @ApiProperty({ enum: GroupByEnum })
  @IsNotEmpty()
  @IsEnum(GroupByEnum)
  groupBy: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  department?: number;

  @ApiProperty()
  @IsNotEmpty()
  @IsInt()
  companyId: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  branchId?: number;
}

// Matching List Report DTOs
export class MatchingListReportQueryDto {
  @ApiProperty()
  @IsNotEmpty()
  @IsDateString()
  fromDate: string;

  @ApiProperty()
  @IsNotEmpty()
  @IsDateString()
  toDate: string;

  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  voucherType: string;

  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  matchingStatus: string;

  @ApiProperty()
  @IsNotEmpty()
  @IsInt()
  companyId: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  branchId?: number;
}

// Top N Customer Report DTOs
export class TopNCustomerReportQueryDto {
  @ApiProperty()
  @IsNotEmpty()
  @IsDateString()
  FromDate: string;

  @ApiProperty()
  @IsNotEmpty()
  @IsDateString()
  ToDate: string;

  @ApiProperty()
  @IsNotEmpty()
  @IsNumber()
  TopN: number;

  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  sortBy: string;

  @ApiProperty()
  @IsNotEmpty()
  @IsInt()
  companyId: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  Branch?: number[];

  @ApiProperty()
  @IsNotEmpty()
  @IsInt()
  Dept: number[];

  @IsOptional()
  @IsBoolean()
  Volume : boolean;

  @IsOptional()
  @IsBoolean()
  Gp : boolean;

  @IsOptional()
  @IsBoolean()
 CalculationType: 'GP' | 'VOLUME';

}


export class Vat210ReportQueryDto {
  @ApiProperty()
  @IsNotEmpty()
  @IsDateString()
  FromDate: string;

  @ApiProperty()
  @IsNotEmpty()
  @IsDateString()
  ToDate: string;


  @ApiProperty()
  @IsNotEmpty()
  @IsInt()
  companyId: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  branchId?: number;

  @ApiProperty()
  @IsNotEmpty()
  @IsInt()
  Dept: number[];

  @IsOptional()
  @IsBoolean()
  Volume : boolean;

  @IsOptional()
  @IsBoolean()
  GP : boolean;
}

// Export DTOs
export class ExportReportDto {
  @ApiProperty()
  @IsNotEmpty()
  parameters: any;

  @ApiProperty({ enum: ExportFormatEnum })
  @IsNotEmpty()
  @IsEnum(ExportFormatEnum)
  format: string;
}

// Email DTOs
export class EmailReportDto {
  @ApiProperty()
  @IsNotEmpty()
  parameters: any;

  @ApiProperty({ enum: ExportFormatEnum })
  @IsNotEmpty()
  @IsEnum(ExportFormatEnum)
  format: string;

  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  email: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  cc?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  subject?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  message?: string;
}

// Unposted Voucher List

export class UnpostedVoucherListReportQueryDto {
  @ApiProperty()
  @IsNotEmpty()
  @IsDateString()
  VoucherFromDate: string;

  @ApiProperty()
  @IsNotEmpty()
  @IsDateString()
  VoucherToDate: string;

  @ApiProperty({ enum: TaxPeriodEnum })
  @IsNotEmpty()
  @IsEnum(TaxPeriodEnum)
  taxPeriod: string;

  @ApiProperty()
  @IsNotEmpty()
  @IsInt()
  companyId: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  Branch?: number[];


  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  coamasterSid?: number;
}
export interface ReportGenerateResponse {
  success: boolean;
  data: any[];
  reportName: string;
  reportDisplayName: string;
  columns?: string[];
  totalRecords?: number;
}