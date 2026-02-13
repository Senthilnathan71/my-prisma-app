// src/master-job/dto/search-master-job.dto.ts
import { IsInt, IsNotEmpty, IsOptional, IsString, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class SearchMasterJobDto {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  pageSize?: number = 15;

  @IsNotEmpty({ message: 'CompanyMasterSid is required' })
  @IsInt()
  activeCompanyId: number;

  @IsNotEmpty({ message: 'BranchMasterSid is required' })
  @IsInt()
  activeBranchId: number;

  @IsOptional()
  @IsString()
  departmentType?: string;

  @IsNotEmpty({ message: 'MenuMasterSid is required' })
  @IsInt()
  MenuMasterSid?: number;
}

export interface MasterJobListItem {
  MasterJobSid: number;
  CompanyMasterSid: number;
  BranchMasterSid: number;
  departmentName: string | null;
  departmentType: string | null;
  MasterJobNumber: string | null;
  MasterJobDate: Date | null;
  MBLNo: string | null;
  MBLDate: Date | null;
  POL: string | null;
  POD: string | null;
  FDC: string | null;           // FPD renamed as FDC
  NoOfContainers: number;
  NoOfHouses: number;
  Status: string;
}

export interface MasterJobListResponse {
  items: MasterJobListItem[];
  totalCount: number;
}