import { IsOptional, IsString, IsInt, Min } from 'class-validator';

export class filterDto {
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
  @IsInt()
  activeCompanyId: number;

  @IsOptional()
  @IsInt()
  activeBranchId: number;

  @IsOptional()
  @IsInt()
  yearMasterSid?: number;

  @IsOptional()
  @IsString()
  dateFrom?: string;

  @IsOptional()
  @IsString()
  dateTo?: string;

  @IsOptional()
  @IsString()
  DateFrom?: string;

  @IsOptional()
  @IsString()
  DateTo?: string;

  @IsOptional()
  @IsString()
  dateField?: string;

  @IsOptional()
  @IsString()
  DateField?: string;

  @IsOptional()
  @IsInt()
  CustomerMasterSid?: number;

  @IsOptional()
  @IsInt()
  customerMasterSid?: number;

  @IsOptional()
  @IsInt()
  PartyMasterSid?: number;

  @IsOptional()
  @IsInt()
  partyMasterSid?: number;

  @IsOptional()
  @IsInt()
  DepartmentMasterSid?: number;

  @IsOptional()
  @IsInt()
  departmentMasterSid?: number;

  @IsOptional()
  @IsString()
  POL?: string;

  @IsOptional()
  @IsString()
  POD?: string;

  @IsOptional()
  @IsString()
  pol?: string;

  @IsOptional()
  @IsString()
  pod?: string;

  @IsOptional()
  @IsString()
  CurrencyCode?: string;

  @IsOptional()
  @IsString()
  currencyCode?: string;

  @IsOptional()
  @IsString()
  SubledgerName?: string;

  @IsOptional()
  @IsString()
  subledgerName?: string;

  @IsOptional()
  @IsInt()
  POLSid?: number;

  @IsOptional()
  @IsInt()
  PODSid?: number;

  @IsOptional()
  @IsInt()
  polSid?: number;

  @IsOptional()
  @IsInt()
  podSid?: number;
}
