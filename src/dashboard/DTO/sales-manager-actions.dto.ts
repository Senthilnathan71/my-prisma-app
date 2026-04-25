import { IsOptional, IsNumber, IsString, IsArray, IsIn } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class ReassignLeadDto {
  @ApiProperty()
  @IsNumber()
  @Type(() => Number)
  PreCustomerMeetingSid: number;

  @ApiProperty()
  @IsNumber()
  @Type(() => Number)
  newSalespersonId: number;

  @ApiProperty()
  @IsNumber()
  @Type(() => Number)
  CompanyMasterSid: number;

  @ApiProperty()
  @IsNumber()
  @Type(() => Number)
  BranchMasterSid: number;

  @ApiProperty()
  @IsString()
  updatedBy: string;
}

export class BulkReassignDto {
  @ApiProperty({ type: [Number] })
  @IsArray()
  @Type(() => Number)
  PreCustomerMeetingSids: number[];

  @ApiProperty()
  @IsNumber()
  @Type(() => Number)
  newSalespersonId: number;

  @ApiProperty()
  @IsNumber()
  @Type(() => Number)
  CompanyMasterSid: number;

  @ApiProperty()
  @IsNumber()
  @Type(() => Number)
  BranchMasterSid: number;

  @ApiProperty()
  @IsString()
  updatedBy: string;
}

export class CreateMeetingOnBehalfDto {
  @ApiProperty()
  @IsNumber()
  @Type(() => Number)
  PreCustomerMasterSid: number;

  @ApiProperty()
  @IsNumber()
  @Type(() => Number)
  leadAssignTo: number;

  @ApiProperty()
  @IsString()
  meetingDate: string;

  @ApiProperty()
  @IsString()
  meetingType: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  meetingNote?: string;

  @ApiProperty()
  @IsNumber()
  @Type(() => Number)
  CompanyMasterSid: number;

  @ApiProperty()
  @IsNumber()
  @Type(() => Number)
  BranchMasterSid: number;

  @ApiProperty()
  @IsString()
  createdBy: string;
}

export class SendReminderDto {
  @ApiProperty()
  @IsNumber()
  @Type(() => Number)
  salespersonId: number;

  @ApiProperty({ enum: ['overdue-meetings', 'idle-leads', 'pending-followups'] })
  @IsIn(['overdue-meetings', 'idle-leads', 'pending-followups'])
  reminderType: 'overdue-meetings' | 'idle-leads' | 'pending-followups';

  @ApiProperty()
  @IsNumber()
  @Type(() => Number)
  CompanyMasterSid: number;

  @ApiProperty()
  @IsNumber()
  @Type(() => Number)
  BranchMasterSid: number;

  @ApiProperty()
  @IsString()
  senderName: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  customMessage?: string;
}
