import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsNumber,
  IsDateString,
  IsArray,
  IsNotEmpty,
  IsBoolean,
} from 'class-validator';
import { Type } from 'class-transformer';

export class TrialBalanceQueryDto {
  @ApiProperty({ description: 'Company Master Sid - Mandatory' })
  @IsNotEmpty()
  @IsNumber()
  @Type(() => Number)
  companyId: number;

  @ApiProperty({ required: false, description: 'Branch Master Sid(s) - Optional, supports multi-select' })
  @IsOptional()
  @IsArray()
  @Type(() => Number)
  Branch?: number[];

  @ApiProperty({ description: 'From Date - Mandatory' })
  @IsNotEmpty()
  @IsDateString()
  FromDate: string;

  @ApiProperty({ description: 'To Date - Mandatory (must be >= fromDate)' })
  @IsNotEmpty()
  @IsDateString()
  ToDate: string;

  @ApiProperty({ required: false, description: 'Group Name - Optional filter' })
  @IsOptional()
  @IsString()
  GroupName?: string;

  @ApiProperty({ required: false, description: 'Sub Group Name - Optional filter' })
  @IsOptional()
  @IsString()
  SubGroupName?: string;

  @ApiProperty({ required: false, description: 'Show subtotals for groups and subgroups', default: true })
  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  showSubtotals?: boolean;

  @ApiProperty({ required: false, description: 'Financial Year Master Sid - Optional' })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  YearMasterSid?: number;

  @ApiProperty()
  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  SubTotal?: boolean;

  @ApiProperty()
  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  Subledger?: boolean;
}

export class TrialBalanceItemDto {
  @ApiProperty({ description: 'Chart of Account Master Sid' })
  COAMasterSid: number;

  @ApiProperty({ description: 'Account/Ledger Code' })
  LedgerCode: string;

  @ApiProperty({ description: 'Account/Ledger Name' })
  LedgerName: string;

  @ApiProperty({ description: 'Category (Asset, Liability, Income, Expense)' })
  Category: string;

  @ApiProperty({ description: 'Group Name' })
  GroupName: string;

  @ApiProperty({ required: false, description: 'Sub Group Name' })
  SubGroupName?: string;

  @ApiProperty({ description: 'Opening Balance - Debit' })
  OpeningDebit: number;

  @ApiProperty({ description: 'Opening Balance - Credit' })
  OpeningCredit: number;

  @ApiProperty({ description: 'Current Period - Debit' })
  CurrentDebit: number;

  @ApiProperty({ description: 'Current Period - Credit' })
  CurrentCredit: number;

  @ApiProperty({ description: 'Closing Balance - Debit' })
  ClosingDebit: number;

  @ApiProperty({ description: 'Closing Balance - Credit' })
  ClosingCredit: number;

  @ApiProperty({ description: 'Closing Net Balance (Debit - Credit)' })
  ClosingNet: number;

  @ApiProperty({ description: 'Ledger Type' })
  LedgerType: string;
}

export class TrialBalanceSubtotalDto {
  @ApiProperty({ description: 'Subtotal type: Group or SubGroup' })
  type: 'Group' | 'SubGroup';

  @ApiProperty({ description: 'Name of the group/subgroup' })
  name: string;

  @ApiProperty({ description: 'Opening Balance - Debit' })
  OpeningDebit: number;

  @ApiProperty({ description: 'Opening Balance - Credit' })
  OpeningCredit: number;

  @ApiProperty({ description: 'Current Period - Debit' })
  CurrentDebit: number;

  @ApiProperty({ description: 'Current Period - Credit' })
  CurrentCredit: number;

  @ApiProperty({ description: 'Closing Balance - Debit' })
  ClosingDebit: number;

  @ApiProperty({ description: 'Closing Balance - Credit' })
  ClosingCredit: number;

  @ApiProperty({ description: 'Closing Net Balance (Debit - Credit)' })
  ClosingNet: number;
}

export class TrialBalanceGrandTotalDto {
  @ApiProperty({ description: 'Total Opening Debit' })
  TotalOpeningDebit: number;

  @ApiProperty({ description: 'Total Opening Credit' })
  TotalOpeningCredit: number;

  @ApiProperty({ description: 'Total Current Debit' })
  TotalCurrentDebit: number;

  @ApiProperty({ description: 'Total Current Credit' })
  TotalCurrentCredit: number;

  @ApiProperty({ description: 'Total Closing Debit' })
  TotalClosingDebit: number;

  @ApiProperty({ description: 'Total Closing Credit' })
  TotalClosingCredit: number;

  @ApiProperty({ description: 'Is report balanced (Debit = Credit)' })
  IsBalanced: boolean;

  @ApiProperty({ description: 'Difference (should be 0 if balanced)' })
  Difference: number;
}

export class TrialBalanceResponseDto {
  @ApiProperty({ description: 'Report generated successfully' })
  success: boolean;

  @ApiProperty({ required: false, description: 'Error message if any' })
  message?: string;

  @ApiProperty({ description: 'Report parameters used' })
  parameters: {
    CompanyMasterSid: number;
    BranchInvolved : string;
    BranchMasterSid?: number[];
    fromDate: string;
    toDate: string;
    GroupName?: string;
    SubGroupName?: string;
    showSubtotals: boolean;
    SubTotal?: boolean;
    Subledger?:boolean;
  };

  @ApiProperty({ type: [TrialBalanceItemDto], description: 'Trial balance ledger items' })
  items: TrialBalanceItemDto[];

  @ApiProperty({ required: false, type: [TrialBalanceSubtotalDto], description: 'Subtotals by group/subgroup' })
  subtotals?: TrialBalanceSubtotalDto[];

  @ApiProperty({ description: 'Grand totals' })
  grandTotal: TrialBalanceGrandTotalDto;

  @ApiProperty({ description: 'Total number of ledgers in report' })
  totalLedgers: number;

  @ApiProperty({ description: 'Report generation timestamp' })
  generatedAt: Date;
}
