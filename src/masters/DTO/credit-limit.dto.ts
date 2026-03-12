import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsInt, IsOptional, IsPositive } from 'class-validator';
import { Type } from 'class-transformer';

export class CreditLimitDto {
  @ApiProperty({ example: 1, description: 'Company Master SID' })
  @IsInt()
  @IsPositive()
  @Type(() => Number)
  companyMasterSid: number;

  @ApiProperty({ example: 123, description: 'Customer Master SID' })
  @IsInt()
  @IsPositive()
  @Type(() => Number)
  customerMasterSid: number;

  @ApiProperty({ example: 5, description: 'Branch Master SID' })
  @IsInt()
  @IsPositive()
  @Type(() => Number)
  branchMasterSid: number;

  @ApiPropertyOptional({ example: 10, description: 'Department Master SID' })
  @IsOptional()
  @IsInt()
  @IsPositive()
  @Type(() => Number)
  departmentMasterSid?: number;

  @ApiPropertyOptional({ example: 2, description: 'Customer Branch SID' })
  @IsOptional()
  @IsInt()
  @IsPositive()
  @Type(() => Number)
  customerBranchSid?: number;
}

export class OutstandingDto {
  @ApiProperty({ example: 123, description: 'Customer Master SID' })
  @IsInt()
  @IsPositive()
  @Type(() => Number)
  customerMasterSid: number;

  @ApiProperty({ example: 1, description: 'Company Master SID' })
  @IsInt()
  @IsPositive()
  @Type(() => Number)
  companyMasterSid: number;

  @ApiPropertyOptional({ example: 5, description: 'Branch Master SID' })
  @IsOptional()
  @IsInt()
  @IsPositive()
  @Type(() => Number)
  branchMasterSid?: number;

  @ApiPropertyOptional({ example: 456, description: 'Master Job SID' })
  @IsOptional()
  @IsInt()
  @IsPositive()
  @Type(() => Number)
  masterJobSid?: number;

  @ApiPropertyOptional({ example: 789, description: 'House Job SID' })
  @IsOptional()
  @IsInt()
  @IsPositive()
  @Type(() => Number)
  houseJobSid?: number;
}

export class OutstandingByJobDto {
  @ApiProperty({ example: 123, description: 'Customer Master SID' })
  @IsInt()
  @IsPositive()
  @Type(() => Number)
  customerMasterSid: number;

  @ApiProperty({ example: 1, description: 'Company Master SID' })
  @IsInt()
  @IsPositive()
  @Type(() => Number)
  companyMasterSid: number;
}

export class ValidateCreditDto {
  @ApiProperty({ example: 1, description: 'Company Master SID' })
  @IsInt()
  @IsPositive()
  companyMasterSid: number;

  @ApiProperty({ example: 123, description: 'Customer Master SID' })
  @IsInt()
  @IsPositive()
  customerMasterSid: number;

  @ApiProperty({ example: 5, description: 'Branch Master SID' })
  @IsInt()
  @IsPositive()
  branchMasterSid: number;

  @ApiPropertyOptional({ example: 10, description: 'Department Master SID' })
  @IsOptional()
  @IsInt()
  @IsPositive()
  departmentMasterSid?: number;

  @ApiPropertyOptional({ example: 2, description: 'Customer Branch SID' })
  @IsOptional()
  @IsInt()
  @IsPositive()
  @Type(() => Number)
  customerBranchSid?: number;

  @ApiPropertyOptional({ example: 456, description: 'Master Job SID' })
  @IsOptional()
  @IsInt()
  @IsPositive()
  masterJobSid?: number;

  @ApiPropertyOptional({ example: 789, description: 'House Job SID' })
  @IsOptional()
  @IsInt()
  @IsPositive()
  houseJobSid?: number;

  // @ApiPropertyOptional({ example: '2026-03-30', description: 'Document/Job date for credit request period lookup' })
  // @IsOptional()
  // @Type(() => Date)
  // documentDate?: Date;
}

export class CreditSummaryDto {
  @ApiProperty({ example: 1, description: 'Company Master SID' })
  @IsInt()
  @IsPositive()
  companyMasterSid: number;

  @ApiProperty({ example: 123, description: 'Customer Master SID' })
  @IsInt()
  @IsPositive()
  customerMasterSid: number;

  @ApiProperty({ example: 5, description: 'Branch Master SID' })
  @IsInt()
  @IsPositive()
  branchMasterSid: number;

  @ApiPropertyOptional({ example: 10, description: 'Department Master SID' })
  @IsOptional()
  @IsInt()
  @IsPositive()
  departmentMasterSid?: number;
}

export class CustomerTypeDto {
  @ApiProperty({ example: 123, description: 'Customer Master SID' })
  @IsInt()
  @IsPositive()
  customerMasterSid: number;
}

export class PaymentStatusDto {
  @ApiPropertyOptional({ example: 456, description: 'Master Job SID' })
  @IsOptional()
  @IsInt()
  @IsPositive()
  masterJobSid?: number;

  @ApiPropertyOptional({ example: 789, description: 'House Job SID' })
  @IsOptional()
  @IsInt()
  @IsPositive()
  houseJobSid?: number;
}

export class ValidateBLDODto {
  @ApiProperty({ example: 1, description: 'Company Master SID' })
  @IsInt()
  @IsPositive()
  @Type(() => Number)
  CompanyMasterSid: number;

  @ApiProperty({ example: 5, description: 'Branch Master SID' })
  @IsInt()
  @IsPositive()
  @Type(() => Number)
  BranchMasterSid: number;

  @ApiProperty({ example: 123, description: 'Customer Master SID' })
  @IsInt()
  @IsPositive()
  @Type(() => Number)
  CustomerMasterSid: number;

  @ApiProperty({ example: 2, description: 'Customer Branch SID' })
  @IsInt()
  @IsPositive()
  @Type(() => Number)
  CustomerBranchSid: number;

  @ApiProperty({
    example: '2026-03-30',
    description: 'Document date used for picking the active credit request',
  })
  @IsDateString()
  DocumentDate: string;
}
