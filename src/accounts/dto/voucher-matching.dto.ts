import {
  IsNotEmpty,
  IsNumber,
  IsString,
  IsOptional,
  IsArray,
  ValidateNested,
  IsDate,
  IsInt,
  Length,
  IsIn,
} from 'class-validator';
import { Type } from 'class-transformer';
import { Decimal } from '@prisma/client/runtime/library';

/**
 * DTO for searching posted vouchers (Receipts / Payments) for standalone matching
 */
export class SearchPostedVouchersDto {
  @IsNotEmpty()
  @IsNumber()
  CompanyMasterSid: number;

  @IsNotEmpty()
  @IsNumber()
  BranchMasterSid: number;

  @IsNotEmpty()
  @IsString()
  VoucherType: string; // 'Receipt Voucher' or 'Payment Voucher'

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  VoucherMatchingDate?: Date;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsNumber()
  page?: number;

  @IsOptional()
  @IsNumber()
  pageSize?: number;
}

/**
 * DTO for creating standalone voucher matching
 */
export class CreateStandaloneVoucherMatchingDto {
  @IsNotEmpty({ message: 'CompanyMasterSid is required' })
  @IsInt({ message: 'CompanyMasterSid must be an integer' })
  CompanyMasterSid: number;

  @IsNotEmpty({ message: 'BranchMasterSid is required' })
  @IsInt({ message: 'BranchMasterSid must be an integer' })
  BranchMasterSid: number;

  @IsNotEmpty()
  @Type(() => Date)
  @IsDate({ message: 'Voucher matching date is required' })
  VoucherMatchingDate: Date;

  @IsOptional()
  @IsInt()
  VoucherHeaderSid: number | null;

  @IsOptional()
  @IsIn(['U', 'P'], { message: 'PostStatus must be either U or P' })
  @Length(0, 1)
  PostStatus: string;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  PostDate: Date;

  @IsOptional()
  @IsString()
  @Length(0, 100)
  Narration: string;

  @IsOptional()
  @IsString()
  @Length(0, 100)
  Remarks: string;

  @IsOptional()
  @IsString()
  @Length(0, 100)
  SubledgerName: string;

  @IsNotEmpty()
  @IsInt()
  YearMasterSid: number;

  @IsNotEmpty()
  @IsInt()
  LocalCurrencyMasterSid: number;

  @IsNotEmpty()
  @IsString()
  LocalCurrencyCode: string;

  @IsNotEmpty()
  @Type(() => Date)
  @IsDate()
  current_date: Date;

  @IsNotEmpty()
  @IsString()
  userEmail: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MatchingDetailDto)
  MatchingDetail: MatchingDetailDto[];
}

export class UpdateStandaloneVoucherMatchingDto extends CreateStandaloneVoucherMatchingDto {
  @IsNotEmpty({ message: 'VoucherMatchingHeaderSid is required' })
  @IsInt()
  VoucherMatchingHeaderSid: number;
}

export class FetchOutstandingVouchers {
  @IsNotEmpty({ message: 'CompanyMasterSid is required' })
  @IsInt()
  CompanyMasterSid: number;

  @IsNotEmpty({ message: 'BranchMasterSid is required' })
  @IsInt()
  BranchMasterSid: number;

  @IsNotEmpty({ message: 'LedgerMasterSid is required' })
  @IsInt()
  LedgerMasterSid: number;

  @IsNotEmpty({ message: 'DrCr is required' })
  @IsIn(['D', 'C'], { message: 'DrCr must be specified as "D" or "C"' })
  @Length(1, 1)
  DrCr: string;

  @IsOptional()
  @IsNumber()
  Skip: number;

  @IsOptional()
  @IsNumber()
  Take: number;

  @IsOptional()
  @IsNumber()
  COAMasterSid?: number;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  VoucherMatchingDate?: Date;
}

export class FetchVoucherMatchingByIdDto {
  @IsNotEmpty({ message: 'VoucherMatchingHeaderSid is required' })
  @IsInt()
  VoucherMatchingHeaderSid: number;

  @IsNotEmpty({ message: 'CompanyMasterSid is required' })
  @IsInt()
  CompanyMasterSid: number;

  @IsNotEmpty({ message: 'BranchMasterSid is required' })
  @IsInt()
  BranchMasterSid: number;
}

export class PostVoucherMatchingDto {
  @IsNotEmpty({ message: 'VoucherMatchingHeaderSid is required' })
  @IsInt()
  VoucherMatchingHeaderSid: number;

  @IsNotEmpty({ message: 'CompanyMasterSid is required' })
  @IsInt()
  CompanyMasterSid: number;

  @IsNotEmpty({ message: 'BranchMasterSid is required' })
  @IsInt()
  BranchMasterSid: number;

  @IsNotEmpty()
  @IsInt()
  YearMasterSid: number;

  @IsNotEmpty()
  @IsInt()
  LocalCurrencyMasterSid: number;

  @IsNotEmpty()
  @IsString()
  LocalCurrencyCode: string;

  @IsNotEmpty()
  @Type(() => Date)
  @IsDate()
  current_date: Date;

  @IsNotEmpty()
  @IsString()
  postedBy: string;
}


export class MatchingDetailDto {
  @IsOptional()
  @IsInt({ message: "MatchingDetailSid must be an integer" })
  MatchingDetailSid?: number;

  @IsNotEmpty({ message: "VoucherHeaderSid is required" })
  @IsInt({ message: "VoucherHeaderSid must be an integer" })
  VoucherHeaderSid: number;

  @IsNotEmpty({ message: "VoucherDetailSid is required" })
  @IsInt({ message: "VoucherDetailSid must be an integer" })
  VoucherDetailSid: number;

  @IsNotEmpty({ message: "VoucherTransactionSid is required" })
  @IsInt({ message: "VoucherTransactionSid must be an integer" })
  VoucherTransactionSid: number;

  @IsNotEmpty({ message: "VoucherType is required" })
  @IsString({ message: "VoucherType must be a string" })
  @Length(2, 4)
  VoucherType: string;

  @IsNotEmpty({ message: "CurrencyCode is required" })
  @IsString({ message: "CurrencyCode must be a string" })
  @Length(1, 3)
  CurrencyCode: string;

  @IsNotEmpty({ message: "ExchangeRate is required" })
  @IsNumber({}, { message: "ExchangeRate must be a number" })
  ExchangeRate: number;

  @IsNotEmpty({ message: "DrCr is required" })
  @IsString({ message: "DrCr must be a string" })
  @Length(1, 1)
  DrCr: string;

  @IsNotEmpty({ message: "OriginalCurrencyAmount is required" })
  @IsNumber({}, { message: "OriginalCurrencyAmount must be a number" })
  OriginalCurrencyAmount: number;

  @IsNotEmpty({ message: "OriginalLocalAmount is required" })
  @IsNumber({}, { message: "OriginalLocalAmount must be a number" })
  OriginalLocalAmount: number;

  @IsOptional()
  @IsNumber({}, { message: "MatchedCurrencyAmount must be a number" })
  MatchedCurrencyAmount?: number;

  @IsNotEmpty({ message: "MatchedLocalAmount is required" })
  @IsNumber({}, { message: "MatchedLocalAmount must be a number" })
  MatchedLocalAmount: number;

  @IsOptional()
  @IsNumber({}, { message: "PartyAmount must be a number" })
  PartyAmount?: number;

  @IsOptional()
  @IsInt({ message: "MatchingCurrency must be an integer" })
  MatchingCurrency?: number;

  @IsOptional()
  @IsNumber({}, { message: "MatchingExRate must be a number" })
  MatchingExRate?: number;

  @IsOptional()
  @IsNumber({}, { message: "MatchingTDSAmount must be a number" })
  MatchingTDSAmount?: number;

  @IsOptional()
  @IsString({ message: "BranchName must be a string" })
  @Length(0, 20)
  BranchName?: string;

  @IsOptional()
  @IsInt({ message: "SourceVoucherHeaderSid must be an integer" })
  SourceVoucherHeaderSid: number;

  @IsNotEmpty({ message: "MatchingType is required" })
  @IsIn(['Source', 'Object'], { message: "MatchingType must be Source, Object" })
  @IsString()
  MatchingType: 'Source' | 'Object';
}

export interface CreateVoucherMatchingResponse {
  VoucherMatchingHeaderSid: number;
  CompanyMasterSid: number;
  BranchMasterSid: number;
  VoucherMatchingNo: string;
  VoucherMatchingDate: Date;
  Remarks: string | null;
  VoucherHeaderSid: number | null;
  SubledgerName: string | null;
  Status: string;
  CreatedBy: string;
  CreatedOn: Date;
  UpdatedBy: string | null;
  UpdatedOn: Date | null;
  PostStatus: string;
  PostDate: Date | null;
  MatchingDetail?: any[];
}

export interface FetchVoucherMatchingResponse {
  VoucherMatchingHeaderSid: number;
  CompanyMasterSid: number;
  BranchMasterSid: number;
  VoucherMatchingNo: string;
  VoucherMatchingDate: Date;
  Remarks: string | null;
  VoucherHeaderSid: number | null;
  COAMasterSid: number | null;
  LedgerName: string | null;
  LedgerType: string | null;
  SubledgerMasterSid: number | null,
  SubledgerName: string | null;
  PostDate: Date | null;
  PostStatus: string;
  Status: string;
  MatchingDetail: MatchingDetail[];
}

export interface MatchingDetail {
  MatchingDetailSid: number;
  Sno: string | number,
  VoucherMatchingHeaderSid: number;
  VoucherHeaderSid: number;
  VoucherDetailSid: number;
  VoucherTransactionSid: number;
  VoucherNumber: string;
  VoucherType: string;
  VoucherDate: Date;
  DrCr: string;
  CurrencyMasterSid: number | null;
  CurrencyCode: string;
  ExchangeRate: Decimal | number;
  OriginalCurrencyAmount: Decimal | number;
  OriginalLocalAmount: Decimal | number;
  OutstandingCurrencyAmount: Decimal | number;
  OutstandingLocalAmount: Decimal | number;
  MatchingCurrency: number | null;
  MatchingExRate: Decimal | number;
  MatchedCurrencyAmount: Decimal | number;
  MatchedLocalAmount: Decimal | number;
  MatchingTDSAmount: Decimal | number;
  MatchingType: string;
}

export class CancelVoucherMatchingDto {
  @IsNotEmpty()
  @IsInt()
  VoucherMatchingHeaderSid: number;

  @IsNotEmpty()
  @IsInt()
  CompanyMasterSid: number;

  @IsNotEmpty()
  @IsInt()
  BranchMasterSid: number;

  @IsNotEmpty()
  @IsInt()
  YearMasterSid: number;

  @IsNotEmpty()
  @IsInt()
  LocalCurrencyMasterSid: number;

  @IsNotEmpty()
  @IsString()
  LocalCurrencyCode: string;

  @IsNotEmpty()
  @IsString()
  cancelledBy: string;

  @IsOptional()
  taxDetails?: {
    CountryMasterSid: number;
    countryCode: string;
    TaxCategory: 'Inter' | 'Intra';
    EffectiveFrom: Date;
    TaxType: 'Input' | 'Output';
  };
}

export interface PostVoucherMatchingResponse {
  VoucherMatchingHeaderSid: number;
  CompanyMasterSid: number;
  BranchMasterSid: number;
  VoucherMatchingNo: string;
  VoucherMatchingDate: Date;
  Remarks: string | null;
  VoucherHeaderSid: number | null;
  SubledgerName: string | null;
  Status: string;
  PostStatus: string;
  PostDate: Date | null;
  VoucherMatching: any[];
  ExchangeJV?: any;
}

