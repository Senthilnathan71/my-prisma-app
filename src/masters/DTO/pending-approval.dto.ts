import { IsInt, IsOptional, IsString, Min } from 'class-validator';

export class PendingApprovalDto {
  @IsInt()
  UserMasterSid: number;

  @IsInt()
  activeCompanyId: number;

  @IsOptional()
  @IsInt()
  activeBranchId?: number;

  @IsOptional()
  @IsInt()
  MenuMasterSid?: number; // null/omitted = All menus

  @IsOptional()
  @IsInt()
  DepartmentMasterSid?: number;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  page: number = 1;

  @IsOptional()
  @IsInt()
  @Min(1)
  pageSize: number = 10;

  @IsOptional()
  @IsString()
  dateFrom?: string;

  @IsOptional()
  @IsString()
  dateTo?: string;

  @IsOptional()
  @IsString()
  status?: string;
}
