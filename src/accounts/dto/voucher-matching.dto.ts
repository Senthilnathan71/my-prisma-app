import {
  IsNotEmpty,
  IsNumber,
  IsString,
  IsOptional,
  IsArray,
  ValidateNested,
  IsDate,
  IsBoolean,
  IsInt,
  Length,
  IsIn,
} from 'class-validator';
import { Type } from 'class-transformer';

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
 * Source side detail (the receipt/payment voucher detail line being matched)
 */
export class StandaloneMatchSourceDto {
  @IsNotEmpty()
  @IsNumber()
  VoucherDetailSid: number;

  @IsNotEmpty()
  @IsNumber()
  VoucherTransactionSid: number;

  @IsNotEmpty()
  @IsNumber()
  COAMasterSid: number;

  @IsOptional()
  @IsNumber()
  LedgerMasterSid?: number;

  @IsNotEmpty()
  @IsString()
  CurrencyCode: string;

  @IsNotEmpty()
  @IsNumber()
  ExchangeRate: number;

  @IsOptional()
  @IsString()
  DrCr?: string;

  @IsNotEmpty()
  @IsNumber()
  PartyAmount: number;

  @IsNotEmpty()
  @IsNumber()
  LocalAmount: number;

  @IsOptional()
  @IsNumber()
  Sno?: number;
}

/**
 * Object side detail (outstanding invoices being matched against)
 */
export class StandaloneMatchObjectDto {
  @IsNotEmpty()
  @IsNumber()
  VoucherHeaderSid: number;

  @IsNotEmpty()
  @IsNumber()
  VoucherDetailSid: number;

  @IsNotEmpty()
  @IsNumber()
  VoucherTransactionSid: number;

  @IsOptional()
  @IsNumber()
  VoucherTypeMasterSid?: number;

  @IsNotEmpty()
  @IsNumber()
  COAMasterSid: number;

  @IsOptional()
  @IsNumber()
  LedgerMasterSid?: number;

  @IsNotEmpty()
  @IsString()
  CurrencyCode: string;

  @IsNotEmpty()
  @IsNumber()
  ExchangeRate: number;

  @IsOptional()
  @IsString()
  DrCr?: string;

  @IsNotEmpty()
  @IsNumber()
  PartyAmount: number;

  @IsNotEmpty()
  @IsNumber()
  LocalAmount: number;
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
  @IsArray({ each: true })
  @ValidateNested({ each: true })
  @Type(() => MatchingDetailDto)
  MatchingDetail: MatchingDetailDto[];
}

export class UpdateStandaloneVoucherMatchingDto extends CreateStandaloneVoucherMatchingDto {
  @IsNotEmpty({ message: 'VoucherMatchingHeaderSid is required' })
  @IsInt()
  VoucherMatchingHeaderSid: number;
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

  @IsNotEmpty({ message: "Amount is required" })
  @IsNumber({}, { message: "Amount must be a number" })
  Amount: number;

  @IsNotEmpty({ message: "LocalAmount is required" })
  @IsNumber({}, { message: "LocalAmount must be a number" })
  LocalAmount: number;

  @IsOptional()
  @IsNumber({}, { message: "MatchingAmount must be a number" })
  MatchingAmount?: number;

  @IsNotEmpty({ message: "MatchingLocalAmount is required" })
  @IsNumber({}, { message: "MatchingLocalAmount must be a number" })
  MatchingLocalAmount: number;

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
  SubledgerName: string | null;
  Status: string;
  MatchingDetail: any[];
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
  VoucherMatching: any[];
}

export interface VoucherMatchingResponse {
  VoucherMatchingHeaderSid: number;
  CreatedOn: Date;
  CreatedBy: string;
  UpdatedOn: Date;
  UpdatedBy: string;
  Status: string;
  CompanyMasterSid: number;
  BranchMasterSid: number;
  VoucherMatchingNo: string;
  VoucherMatchingDate: Date;
  Narration: string;
  Remarks: string;
  VoucherHeaderSid: number;
  LedgerName: string;
  SubledgerName: string;
  voucherMatchings: OutstandingForTransactionDto[]
}

export class OutstandingForTransactionDto {
  VoucherMatchingSid: number;
  MatchingDetailSid: number;
  Sno: number;
  VoucherMatchingHeaderSid: number;
  VoucherHeaderSid: number;
  VoucherDetailSid: number;
  VoucherTransactionSid: number;
  VoucherNumber: string;
  VoucherType: string;
  VoucherDate: Date;
  DrCr: string;
  CurrencyMasterSid: number;
  CurrencyCode: string;
  ExchangeRate: number;
  OriginalCurrencyAmount: number;
  OriginalLocalAmount: number;
  OutstandingCurrencyAmount: number;
  OutstandingLocalAmount: number;
  MatchingCurrencyAmount: number;
  MatchingLocalAmount: number;
  MatchingType: string;
}