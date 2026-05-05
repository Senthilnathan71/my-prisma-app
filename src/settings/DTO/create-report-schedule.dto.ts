import { ApiProperty } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsNumber,
  IsString,
  IsOptional,
  IsBoolean,
  IsArray,
  IsIn,
  MaxLength,
  Min,
  Max,
  ValidateIf,
} from 'class-validator';

export class CreateReportScheduleDto {
  @ApiProperty({ description: 'Company ID' })
  @IsNotEmpty()
  @IsNumber()
  CompanyMasterSid: number;

  @ApiProperty({ description: 'Schedule name' })
  @IsNotEmpty()
  @IsString()
  @MaxLength(200)
  ScheduleName: string;

  @ApiProperty({ description: 'Report master ID' })
  @IsNotEmpty()
  @IsNumber()
  ReportMasterSid: number;

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

  @ApiProperty({ description: 'Frequency: DAILY, WEEKLY, or MONTHLY' })
  @IsNotEmpty()
  @IsString()
  @IsIn(['DAILY', 'WEEKLY', 'MONTHLY'])
  Frequency: string;

  @ApiProperty({ description: 'Day of week (0=Sun..6=Sat) — required for WEEKLY', required: false })
  @ValidateIf((o) => o.Frequency === 'WEEKLY')
  @IsNotEmpty({ message: 'DayOfWeek is required for WEEKLY frequency' })
  @IsNumber()
  @Min(0)
  @Max(6)
  DayOfWeek?: number;

  @ApiProperty({ description: 'Day of month (1-28) — required for MONTHLY', required: false })
  @ValidateIf((o) => o.Frequency === 'MONTHLY')
  @IsNotEmpty({ message: 'DayOfMonth is required for MONTHLY frequency' })
  @IsNumber()
  @Min(1)
  @Max(28)
  DayOfMonth?: number;

  @ApiProperty({ description: 'Schedule time in HH:mm 24h format' })
  @IsNotEmpty()
  @IsString()
  @MaxLength(5)
  ScheduleTime: string;

  @ApiProperty({ description: 'Timezone (e.g. Asia/Kolkata)', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  TimeZone?: string;

  @ApiProperty({ description: 'To email addresses (comma-separated)' })
  @IsNotEmpty()
  @IsString()
  @MaxLength(1000)
  ToEmails: string;

  @ApiProperty({ description: 'CC email addresses (comma-separated)', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  CcEmails?: string;

  @ApiProperty({ description: 'Report format: EXCEL or PDF' })
  @IsNotEmpty()
  @IsString()
  @IsIn(['EXCEL', 'PDF'])
  ReportFormat: string;

  @ApiProperty({ description: 'Additional report parameters (JSON)', required: false })
  @IsOptional()
  ReportParams?: Record<string, any>;

  @ApiProperty({ description: 'Whether the schedule is active', required: false })
  @IsOptional()
  @IsBoolean()
  IsActive?: boolean;
}
