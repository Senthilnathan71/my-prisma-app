import { IsOptional, IsNumber, IsDateString, IsString } from 'class-validator';
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
}
