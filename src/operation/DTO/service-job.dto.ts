import { IsInt, IsOptional, IsString } from 'class-validator';

export class DuplicateCheckDTO {
  @IsInt()
  CompanyMasterSid: number;

  @IsInt()
  BranchMasterSid: number;

  @IsInt()
  DepartmentMasterSid: number;

  @IsOptional()
  @IsString()
  HBLNo?: string;

  @IsOptional()
  @IsString()
  MBLNo?: string;
}
