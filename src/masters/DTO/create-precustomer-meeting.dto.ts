import { IsInt, IsOptional, IsString, IsDate, IsDateString, IsNumber } from 'class-validator';

export class CreatePreCustomerMeetingDto {

  @IsNumber()
  @IsOptional()
  PreCustomerMeetingSid: number;
  @IsNumber()
  @IsOptional()
  PreCustomerMeetingid: number;
  @IsInt()
  CompanyMasterSid: number;

  @IsInt()
  BranchMasterSid: number;

  @IsInt()
  PreCustomerMasterSid: number;

  @IsOptional()
  DepartmentMasterSid: number

  @IsOptional()
  OpportunitySector: string

  @IsDateString()
  meetingDate: Date;

  @IsString()
  meetingType: string;

  @IsString()
  meetingNote: string;

  @IsString()
  followUpNote: string;

  @IsInt()
  leadAssignTo: number;

  @IsString()
  meetingStatus: string;

  @IsString()
  @IsOptional()
  customerProfile?: string;

  @IsOptional()
  @IsDateString()
  followUpDate: Date;

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
