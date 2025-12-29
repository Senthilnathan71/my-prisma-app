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
  FromHBLDt: string;

  @ApiProperty()
  @IsNotEmpty()
  @IsDateString()
  ToHBLDt: string;

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
  Branch?: number[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  Dept?: number[];

  @ApiProperty({ enum: BLStatusEnum })
  @IsNotEmpty()
  @IsEnum(BLStatusEnum)
  BLIssue: string;
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
  FromHBLDt: string;

  @ApiProperty()
  @IsNotEmpty()
  @IsDateString()
  ToHBLDt: string;

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
  branchId?: number[];

  @ApiProperty()
  @IsNotEmpty()
  @IsDateString()
  Dept: number[];
}

// DO Issue List Report DTOs
export class DOIssueListReportQueryDto {
  @ApiProperty()
  @IsNotEmpty()
  @IsDateString()
  FromHBLDt: string;

  @ApiProperty()
  @IsNotEmpty()
  @IsDateString()
  ToHBLDt: string;

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
  Branch?: number[];

  @ApiProperty()
  @IsNotEmpty()
  @IsDateString()
  Dept: number[];
}

// Shipment Detailed Summary Report DTOs
export class ShipmentDetailedSummaryReportQueryDto {
  @ApiProperty()
  @IsNotEmpty()
  @IsDateString()
  FromHBLDt: string;

  @ApiProperty()
  @IsNotEmpty()
  @IsDateString()
  ToHBLDt: string;

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
  branchId?: number[];

  @ApiProperty()
  @IsNotEmpty()
  @IsDateString()
  Dept: number[];

  @ApiProperty({ enum: BLStatusEnum })
  @IsNotEmpty()
  @IsEnum(BLStatusEnum)
  Transhipment: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  Customer?: number[];

  
  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  Salesperson?: number[];

}


export class profitabilityReportQueryDto {
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


export class lostCustomerReportQueryDto {
  @ApiProperty()
  @IsNotEmpty()
  @IsDateString()
  BookingFromDate: Date;

  @ApiProperty()
  @IsNotEmpty()
  @IsDateString()
  BookingToDate: Date;

  @ApiProperty({ enum: ShipmentStatusEnum })
  @IsNotEmpty()
  @IsEnum(ShipmentStatusEnum)
  shipmentStatus: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  department?: number;

  @ApiProperty()
  @IsNotEmpty()
  @IsInt()
  companyId: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  Branch?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  Dept?: number[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  customer?: number[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  salesman?: number;
}

export class unbilledcostReportQueryDto {
  @ApiProperty()
  @IsNotEmpty()
  @IsDateString()
  FromHBLDt: string;

  @ApiProperty()
  @IsNotEmpty()
  @IsDateString()
  ToHBLDt: string;

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

export class houseJobLossReportQueryDto {
  @ApiProperty()
  @IsNotEmpty()
  @IsDateString()
  FromHBLDt: string;

  @ApiProperty()
  @IsNotEmpty()
  @IsDateString()
  ToHBLDt: string;


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

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  Customer?: number[];
}

export class ProfitSummaryReportQueryDto {
  @ApiProperty()
  @IsNotEmpty()
  @IsDateString()
  FromMBLDt: string;

  @ApiProperty()
  @IsNotEmpty()
  @IsDateString()
  ToMBLDt: string;


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