import { ApiProperty } from '@nestjs/swagger';
import {
  IsOptional,
  IsNumber,
  IsString,
  IsBoolean,
  IsArray,
  IsIn,
  MaxLength,
  Min,
  Max,
  ValidateIf,
} from 'class-validator';

export class UpdateReportScheduleDto {
  @ApiProperty({ description: 'Company ID', required: false })
  @IsOptional()
  @IsNumber()
  CompanyMasterSid?: number;

  @ApiProperty({ description: 'Schedule name', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  ScheduleName?: string;

  @ApiProperty({ description: 'Report master ID', required: false })
  @IsOptional()
  @IsNumber()
  ReportMasterSid?: number;

  @ApiProperty({ description: 'Subledger (customer) ID', required: false })
  @IsOptional()
  @IsNumber()
  SubledgerMasterSid?: number;

  @ApiProperty({ description: 'COA (ledger) ID', required: false })
  @IsOptional()
  @IsNumber()
  COAMasterSid?: number;

  @ApiProperty({ description: 'Branch filter — array of BranchMasterSid, null = all', required: false })
  @IsOptional()
  @IsArray()
  BranchFilter?: number[];

  @ApiProperty({ description: 'Frequency: DAILY, WEEKLY, or MONTHLY', required: false })
  @IsOptional()
  @IsString()
  @IsIn(['DAILY', 'WEEKLY', 'MONTHLY'])
  Frequency?: string;

  @ApiProperty({ description: 'Day of week (0=Sun..6=Sat)', required: false })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(6)
  DayOfWeek?: number;

  @ApiProperty({ description: 'Day of month (1-28)', required: false })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(28)
  DayOfMonth?: number;

  @ApiProperty({ description: 'Schedule time in HH:mm 24h format', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(5)
  ScheduleTime?: string;

  @ApiProperty({ description: 'Timezone', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  TimeZone?: string;

  @ApiProperty({ description: 'To email addresses (comma-separated)', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  ToEmails?: string;

  @ApiProperty({ description: 'CC email addresses (comma-separated)', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  CcEmails?: string;

  @ApiProperty({ description: 'Report format: EXCEL or PDF', required: false })
  @IsOptional()
  @IsString()
  @IsIn(['EXCEL', 'PDF'])
  ReportFormat?: string;

  @ApiProperty({ description: 'Additional report parameters (JSON)', required: false })
  @IsOptional()
  ReportParams?: Record<string, any>;

  @ApiProperty({ description: 'Whether the schedule is active', required: false })
  @IsOptional()
  @IsBoolean()
  IsActive?: boolean;
}
