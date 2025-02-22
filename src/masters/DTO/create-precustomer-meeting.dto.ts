import { IsInt, IsOptional, IsString, IsDate, IsDateString, IsNumber } from 'class-validator';

export class CreatePreCustomerMeetingDto {

  @IsNumber()
  @IsOptional()
  PreCustomerMeetingSid: number;
  @IsInt()
  CompanyMasterSid: number;

  @IsInt()
  BranchMasterSid: number;

  @IsInt()
  PreCustomerMasterSid: number;

  @IsDateString()
  meetingDate: Date;

  @IsString()
  meetingType: string;

  @IsInt()
  leadAssignTo: number;

  @IsString()
  meetingStatus: string;

  @IsString()
  @IsOptional()
  customerProfile?: string;

  @IsOptional()
  @IsDateString()
  followupDate?: Date;

  @IsString()
  remarks?: string;

  @IsString()
  createdBy: string;

  @IsString()
  updatedBy: string;

  @IsOptional()
  @IsInt()
  LoginSid?: number;

  @IsString()
  status: string;
}
