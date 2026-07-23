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

export class TrialBalanceLevelQueryDto {
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

  @ApiProperty({
    required: false,
    enum: ['Ledger', 'Subledger', 'Category', 'Group', 'Subgroup'],
    description: 'Report level - controls row aggregation',
  })
  @IsOptional()
  @IsString()
  Level?: string;

  @ApiProperty()
  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  Subledger?: boolean;

  @ApiProperty({ required: false, description: 'Aggregate into one row per Category' })
  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  CategoryWise?: boolean;

  @ApiProperty({ required: false, description: 'Aggregate into one row per Category + Group' })
  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  GroupWise?: boolean;

  @ApiProperty({ required: false, description: 'Aggregate into one row per Category + Group + SubGroup' })
  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  SubgroupWise?: boolean;
}

export class TrialBalanceLevelItemDto {
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

  @ApiProperty({ required: false, description: 'Subledger Name' })
  SubledgerName?: string;

}

export class TrialBalanceLevelSubtotalDto {
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

export class TrialBalanceLevelGrandTotalDto {
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

export class TrialBalanceLevelResponseDto {
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
    CategoryWise?:boolean;
    GroupWise?:boolean;
    SubgroupWise?:boolean;
    Level?:string;
    GroupNameResolved?:string;
    SubGroupNameResolved?:string;
  };

  @ApiProperty({ type: [TrialBalanceLevelItemDto], description: 'Trial balance ledger items' })
  items: TrialBalanceLevelItemDto[];

  @ApiProperty({ required: false, type: [TrialBalanceLevelSubtotalDto], description: 'Subtotals by group/subgroup' })
  subtotals?: TrialBalanceLevelSubtotalDto[];

  @ApiProperty({ description: 'Grand totals' })
  grandTotal: TrialBalanceLevelGrandTotalDto;

  @ApiProperty({ description: 'Total number of ledgers in report' })
  totalLedgers: number;

  @ApiProperty({ description: 'Report generation timestamp' })
  generatedAt: Date;
}
