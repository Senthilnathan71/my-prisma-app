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
}
