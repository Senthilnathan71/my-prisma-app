import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsInt, IsNotEmpty, IsArray, IsJSON, IsEnum } from 'class-validator';
import { Type } from 'class-transformer';

export enum ReportFormatEnum {
  EXCEL = 'EXCEL',
  PDF = 'PDF',
  BOTH = 'BOTH'
}

export enum ParameterFieldTypeEnum {
  DATE = 'DATE',
  DROPDOWN = 'DROPDOWN',
  NUMBER = 'NUMBER',
  TEXT = 'TEXT',
  YEAR = 'YEAR'
}

export class ReportParameterDetailDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  ReportMasterDetailSid?: number;

  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  ParameterName: string;

  @ApiProperty({ enum: ParameterFieldTypeEnum })
  @IsNotEmpty()
  @IsEnum(ParameterFieldTypeEnum)
  ParameterFieldType: string;

  @ApiPropertyOptional()
  @IsOptional()
  DropDownValue?: any;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  ParameterQuery?: string;

  @ApiPropertyOptional({ default: 'A' })
  @IsOptional()
  @IsString()
  Status?: string;

  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  CreatedBy?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  UpdatedBy?: string;
}

export class CreateReportMasterDto {
  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  ReportName: string;

  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  ReportDisplayName: string;

  @ApiProperty()
  @IsNotEmpty()
  @IsInt()
  ReportMenuSid: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  ReportType?: string;

  @ApiProperty({ enum: ReportFormatEnum })
  @IsNotEmpty()
  @IsEnum(ReportFormatEnum)
  ReportFormat: string;

  @ApiPropertyOptional({ description: 'Array of company IDs to exclude this report from' })
  @IsOptional()
  @IsArray()
  ReportExcludedCompany?: number[];

  @ApiPropertyOptional({ type: [ReportParameterDetailDto] })
  @IsOptional()
  @IsArray()
  @Type(() => ReportParameterDetailDto)
  reportDetails?: ReportParameterDetailDto[];

  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  CreatedBy: string;

  @ApiPropertyOptional({ default: 'A' })
  @IsOptional()
  @IsString()
  Status?: string;
}

export class UpdateReportMasterDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  ReportName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  ReportDisplayName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  ReportMenuSid?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  ReportType?: string;

  @ApiPropertyOptional({ enum: ReportFormatEnum })
  @IsOptional()
  @IsEnum(ReportFormatEnum)
  ReportFormat?: string;

  @ApiPropertyOptional({ description: 'Array of company IDs to exclude this report from' })
  @IsOptional()
  @IsArray()
  ReportExcludedCompany?: number[];

  @ApiPropertyOptional({ type: [ReportParameterDetailDto] })
  @IsOptional()
  @IsArray()
  @Type(() => ReportParameterDetailDto)
  reportDetails?: ReportParameterDetailDto[];

  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  UpdatedBy?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  Status?: string;
}

export class CreateReportParameterDto {
  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  ParameterName: string;

  @ApiProperty({ enum: ParameterFieldTypeEnum })
  @IsNotEmpty()
  @IsEnum(ParameterFieldTypeEnum)
  ParameterFieldType: string;

  @ApiPropertyOptional()
  @IsOptional()
  DropDownValue?: any;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  ParameterQuery?: string;

  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  CreatedBy: string;

  @ApiPropertyOptional({ default: 'A' })
  @IsOptional()
  @IsString()
  Status?: string;
}

export class UpdateReportParameterDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  ParameterName?: string;

  @ApiPropertyOptional({ enum: ParameterFieldTypeEnum })
  @IsOptional()
  @IsEnum(ParameterFieldTypeEnum)
  ParameterFieldType?: string;

  @ApiPropertyOptional()
  @IsOptional()
  DropDownValue?: any;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  ParameterQuery?: string;

  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  UpdatedBy: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  Status?: string;
}
