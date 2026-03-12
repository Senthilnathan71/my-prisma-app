import { IsOptional, IsNumber, IsDateString, IsString, IsIn } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class SalesDashboardQueryDto {
  @ApiProperty({ required: true })
  @IsNumber()
  @Type(() => Number)
  companyMasterSid: number;

  @ApiProperty({ required: true })
  @IsNumber()
  @Type(() => Number)
  branchMasterSid: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  salespersonId?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  salespersonEmail?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsDateString()
  dateTo?: string;

  @ApiProperty({ required: false, default: 1 })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  page?: number;

  @ApiProperty({ required: false, default: 10 })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  pageSize?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiProperty({ required: false, enum: ['overdue', 'today', 'future'] })
  @IsOptional()
  @IsIn(['overdue', 'today', 'future'])
  bucket?: 'overdue' | 'today' | 'future';
}
