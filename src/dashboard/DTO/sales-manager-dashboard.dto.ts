import { IsEmail, IsOptional, IsNumber, IsDateString, IsString, IsIn, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class SalesManagerQueryDto {
  @ApiProperty({ required: true, description: 'Logged-in sales manager user id used to scope assigned salespersons' })
  @IsNumber()
  @Min(1)
  @Type(() => Number)
  userId: number;

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
  dateFrom : string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsDateString()
  dateTo : string;

  @ApiProperty({ required: false, description: 'Date boundary for timestamp-without-tz columns (meetingDate, followUpDate)' })
  @IsOptional()
  @IsDateString()
  naiveDateFrom?: string;

  @ApiProperty({ required: false, description: 'Date boundary for timestamp-without-tz columns (meetingDate, followUpDate)' })
  @IsOptional()
  @IsDateString()
  naiveDateTo?: string;

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

  @ApiProperty({ required: false, enum: ['today', 'week', 'month', 'lastMonth', 'fy'] })
  @IsOptional()
  @IsIn(['today', 'week', 'month', 'lastMonth', 'fy'])
  preset?: 'today' | 'week' | 'month' | 'lastMonth' | 'fy';
}

export class SalesManagerAlertDrillDownDto extends SalesManagerQueryDto {
  @ApiProperty({ required: true, enum: ['idle_leads', 'overdue_meetings', 'stale_followups', 'unconverted_hightouch'] })
  @IsIn(['idle_leads', 'overdue_meetings', 'stale_followups', 'unconverted_hightouch'])
  alertType: 'idle_leads' | 'overdue_meetings' | 'stale_followups' | 'unconverted_hightouch';

  @ApiProperty({ required: false })
  @IsOptional()
  @IsEmail()
  salespersonEmail?: string;
}
