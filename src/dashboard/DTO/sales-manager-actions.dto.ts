import {
  IsDateString,
  IsEmail,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

const trimString = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

const normalizeEmail = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim().toLowerCase() : value;

export class ReassignLeadDto {
  @ApiProperty()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  PreCustomerMeetingSid: number;

  @ApiProperty()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  newSalespersonId: number;

  @ApiProperty()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  CompanyMasterSid: number;

  @ApiProperty()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  BranchMasterSid: number;

  @ApiProperty()
  @Transform(normalizeEmail)
  @IsEmail()
  @MaxLength(320)
  updatedBy: string;
}

export class CreateMeetingOnBehalfDto {
  @ApiProperty()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  PreCustomerMasterSid: number;

  @ApiProperty()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  leadAssignTo: number;

  @ApiProperty()
  @IsDateString()
  meetingDate: string;

  @ApiProperty({ enum: ['Call', 'Visit', 'eMeeting'] })
  @Transform(trimString)
  @IsIn(['Call', 'Visit', 'eMeeting'])
  meetingType: 'Call' | 'Visit' | 'eMeeting';

  @ApiProperty({ required: false })
  @IsOptional()
  @Transform(trimString)
  @IsString()
  @MinLength(1)
  @MaxLength(1000)
  meetingNote?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsDateString()
  followUpDate?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @Transform(trimString)
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  followUpNote?: string;

  @ApiProperty()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  CompanyMasterSid: number;

  @ApiProperty()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  BranchMasterSid: number;

  @ApiProperty()
  @Transform(normalizeEmail)
  @IsEmail()
  @MaxLength(320)
  createdBy: string;
}

export class SendReminderDto {
  @ApiProperty()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  salespersonId: number;

  @ApiProperty({ enum: ['overdue-meetings', 'idle-leads', 'pending-followups'] })
  @IsIn(['overdue-meetings', 'idle-leads', 'pending-followups'])
  reminderType: 'overdue-meetings' | 'idle-leads' | 'pending-followups';

  @ApiProperty()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  CompanyMasterSid: number;

  @ApiProperty()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  BranchMasterSid: number;

  @ApiProperty()
  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  senderName: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @Transform(trimString)
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  customMessage?: string;
}
