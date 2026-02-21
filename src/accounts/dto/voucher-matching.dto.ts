import {
  IsNotEmpty,
  IsNumber,
  IsString,
  IsOptional,
  IsArray,
  ValidateNested,
  IsDate,
  IsBoolean,
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
  @IsNotEmpty()
  @IsNumber()
  CompanyMasterSid: number;

  @IsNotEmpty()
  @IsNumber()
  BranchMasterSid: number;

  @IsNotEmpty()
  @IsNumber()
  VoucherHeaderSid: number;

  @IsNotEmpty()
  @IsNumber()
  VoucherTypeMasterSid: number;

  @IsNotEmpty()
  @IsString()
  voucherTypeInName: string;

  @IsOptional()
  @IsString()
  SubledgerName?: string;

  @IsNotEmpty()
  @Type(() => Date)
  @IsDate()
  PostDate: Date;

  @IsOptional()
  @IsString()
  Narration?: string;

  @IsNotEmpty()
  @IsString()
  CreatedBy: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => StandaloneMatchSourceDto)
  partyVoucherDetail: StandaloneMatchSourceDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => StandaloneMatchObjectDto)
  matchingInvoices: StandaloneMatchObjectDto[];

  @IsOptional()
  @IsBoolean()
  exchangeJvRequired?: boolean;

  @IsOptional()
  @IsNumber()
  exchangeDifference?: number;

  @IsOptional()
  @IsString()
  exchangeCurrencyCode?: string;

  @IsOptional()
  @IsNumber()
  partyLedgerSid?: number;

  @IsOptional()
  @IsNumber()
  partySubledgerSid?: number;
}
