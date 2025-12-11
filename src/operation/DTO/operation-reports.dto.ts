import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsInt, IsNotEmpty, IsDateString, IsEnum } from 'class-validator';

export enum BLStatusEnum {
  ISSUED = 'issued',
  NOT_ISSUED = 'not_issued',
  ALL = 'all'
}

export enum ShipmentStatusEnum {
  PENDING = 'pending',
  IN_TRANSIT = 'in_transit',
  DELIVERED = 'delivered',
  ALL = 'all'
}

export enum DOStatusEnum {
  ISSUED = 'issued',
  NOT_ISSUED = 'not_issued',
  ALL = 'all'
}

export enum KPIMetricEnum {
  UTILIZATION = 'utilization',
  TURNOVER = 'turnover',
  COST = 'cost',
  ALL = 'all'
}

export enum YesNoEnum {
  YES = 'yes',
  NO = 'no'
}

// BL Issue List Report DTOs
export class BLIssueListReportQueryDto {
  @ApiProperty()
  @IsNotEmpty()
  @IsDateString()
  fromDate: string;

  @ApiProperty()
  @IsNotEmpty()
  @IsDateString()
  toDate: string;

  @ApiProperty({ enum: BLStatusEnum })
  @IsNotEmpty()
  @IsEnum(BLStatusEnum)
  blStatus: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  customer?: number;

  @ApiProperty()
  @IsNotEmpty()
  @IsInt()
  companyId: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  branchId?: number;
}

// Shipment Summary Report DTOs
export class ShipmentSummaryReportQueryDto {
  @ApiProperty()
  @IsNotEmpty()
  @IsDateString()
  FromMBLDt: string;

  @ApiProperty()
  @IsNotEmpty()
  @IsDateString()
  ToMBLDt: string;

  @ApiProperty({ enum: ShipmentStatusEnum })
  @IsNotEmpty()
  @IsEnum(ShipmentStatusEnum)
  shipmentStatus: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  port?: number;

  @ApiProperty()
  @IsNotEmpty()
  @IsInt()
  companyId: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  Branch?: number[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  Dept?: number[];
}

// Containerwise Details Report DTOs
export class ContainerwiseDetailsReportQueryDto {
  @ApiProperty()
  @IsNotEmpty()
  @IsDateString()
  fromDate: string;

  @ApiProperty()
  @IsNotEmpty()
  @IsDateString()
  toDate: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  containerType?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  masterJob?: number;

  @ApiProperty()
  @IsNotEmpty()
  @IsInt()
  companyId: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  branchId?: number;
}

// Container KPI Report DTOs
export class ContainerKPIReportQueryDto {
  @ApiProperty()
  @IsNotEmpty()
  @IsDateString()
  fromDate: string;

  @ApiProperty()
  @IsNotEmpty()
  @IsDateString()
  toDate: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  containerType?: number;

  @ApiProperty({ enum: KPIMetricEnum })
  @IsNotEmpty()
  @IsEnum(KPIMetricEnum)
  kpiMetric: string;

  @ApiProperty()
  @IsNotEmpty()
  @IsInt()
  companyId: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  branchId?: number;
}

// DO Issue List Report DTOs
export class DOIssueListReportQueryDto {
  @ApiProperty()
  @IsNotEmpty()
  @IsDateString()
  fromDate: string;

  @ApiProperty()
  @IsNotEmpty()
  @IsDateString()
  toDate: string;

  @ApiProperty({ enum: DOStatusEnum })
  @IsNotEmpty()
  @IsEnum(DOStatusEnum)
  doStatus: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  customer?: number;

  @ApiProperty()
  @IsNotEmpty()
  @IsInt()
  companyId: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  branchId?: number;
}

// Shipment Detailed Summary Report DTOs
export class ShipmentDetailedSummaryReportQueryDto {
  @ApiProperty()
  @IsNotEmpty()
  @IsDateString()
  fromDate: string;

  @ApiProperty()
  @IsNotEmpty()
  @IsDateString()
  toDate: string;

  @ApiProperty({ enum: YesNoEnum })
  @IsNotEmpty()
  @IsEnum(YesNoEnum)
  includeFinancials: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  port?: number;

  @ApiProperty()
  @IsNotEmpty()
  @IsInt()
  companyId: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  branchId?: number;
}
