import { Type } from 'class-transformer';
import { IsArray, IsDateString, IsIn, IsNotEmpty, IsNumber, IsOptional, IsString, ValidateNested } from 'class-validator';

export type ReconciliationClearanceFilter = 'ALL' | 'WITH' | 'WITHOUT';

export class BankStatementRowDto {
  @IsOptional()
  @IsString()
  ReferenceNumber?: string;

  @IsNotEmpty()
  @IsDateString()
  TransactionDate: string;

  @IsOptional()
  @IsDateString()
  ValueDate?: string;

  @IsOptional()
  @IsString()
  Narration?: string;

  @IsNotEmpty()
  @IsNumber()
  Amount: number;

  @IsOptional()
  @IsString()
  @IsIn(['D', 'C'])
  DrCr?: string;
}

export class BankReconciliationFilterDto {
  @IsNotEmpty()
  @IsNumber()
  CompanyMasterSid: number;

  @IsNotEmpty()
  @IsNumber()
  BranchMasterSid: number;

  @IsNotEmpty()
  @IsNumber()
  BankCOAMasterSid: number;

  @IsOptional()
  @IsDateString()
  FromDate?: string;

  @IsOptional()
  @IsDateString()
  ToDate?: string;

  @IsOptional()
  @IsIn(['ALL', 'WITH', 'WITHOUT'])
  ClearanceFilter?: ReconciliationClearanceFilter;

  @IsOptional()
  @IsString()
  Search?: string;
}

export class AutoMatchBankReconciliationDto extends BankReconciliationFilterDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BankStatementRowDto)
  BankTransactions: BankStatementRowDto[];

  @IsOptional()
  @IsString()
  CreatedBy?: string;
}

export class ManualMatchBankReconciliationDto extends BankReconciliationFilterDto {
  @IsNotEmpty()
  @ValidateNested()
  @Type(() => BankStatementRowDto)
  BankTransaction: BankStatementRowDto;

  @IsNotEmpty()
  @IsNumber()
  VoucherHeaderSid: number;

  @IsOptional()
  @IsNumber()
  VoucherTransactionSid?: number;

  @IsOptional()
  @IsString()
  CreatedBy?: string;
}

export class UnmatchBankReconciliationDto extends BankReconciliationFilterDto {
  @IsNotEmpty()
  @IsNumber()
  VoucherHeaderSid: number;

  @IsOptional()
  @IsNumber()
  VoucherTransactionSid?: number;

  @IsOptional()
  @IsString()
  CreatedBy?: string;
}

export class UpdateClearanceBankReconciliationDto extends BankReconciliationFilterDto {
  @IsArray()
  @IsNumber({}, { each: true })
  VoucherHeaderSids: number[];

  @IsOptional()
  @IsNumber()
  VoucherTransactionSid?: number;

  @IsNotEmpty()
  @IsDateString()
  ClearanceDate: string;

  @IsOptional()
  @IsString()
  CreatedBy?: string;
}

export class BankReconciliationReportDto extends BankReconciliationFilterDto {
  @IsOptional()
  @IsNumber()
  BankStatementBalance?: number;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BankStatementRowDto)
  BankTransactions?: BankStatementRowDto[];
}
