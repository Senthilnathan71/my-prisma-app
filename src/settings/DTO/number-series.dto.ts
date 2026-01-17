import {
  IsNumber,
  IsString,
  IsOptional,
  IsIn,
  Length,
  Min,
  Max,
} from 'class-validator';

export class CreateNumberSeriesConfigDto {
  @IsNumber()
  CompanyMasterSid: number;

  @IsNumber()
  BranchMasterSid: number;

  @IsNumber()
  MenuMasterSid: number;

  @IsString()
  @IsIn(['Y', 'N'])
  @IsOptional()
  CompanyFlagRequired?: string;

  @IsString()
  @Length(0, 10)
  @IsOptional()
  CompanyPrefix?: string;

  @IsString()
  @IsIn(['Y', 'N'])
  @IsOptional()
  BranchFlagRequired?: string;

  @IsString()
  @Length(0, 10)
  @IsOptional()
  BranchPrefix?: string;

  @IsString()
  @IsIn(['Y', 'N'])
  @IsOptional()
  DepartmentCodeRequired?: string;

  @IsString()
  @IsIn(['Y', 'N'])
  @IsOptional()
  MonthFlagRequired?: string;

  @IsString()
  @IsIn(['Y', 'N'])
  @IsOptional()
  YearFlagRequired?: string;

  @IsString()
  @Length(0, 5)
  @IsOptional()
  Separator?: string;

  @IsNumber()
  @Min(1)
  @Max(10)
  @IsOptional()
  NumberLength?: number;

  @IsString()
  @IsIn(['None', 'Monthly', 'Yearly'])
  @IsOptional()
  ResetOption?: string;

  @IsString()
  @IsIn(['Y', 'N'])
  @IsOptional()
  DepartmentWiseCounter?: string;

  @IsString()
  CreatedBy: string;
}

export class UpdateNumberSeriesConfigDto extends CreateNumberSeriesConfigDto {
  @IsString()
  @IsOptional()
  UpdatedBy?: string;
}

export class GenerateNumberDto {
  @IsNumber()
  CompanyMasterSid: number;

  @IsNumber()
  BranchMasterSid: number;

  @IsNumber()
  MenuMasterSid: number;

  @IsNumber()
  @IsOptional()
  DepartmentMasterSid?: number;
}

export class PreviewNumberDto extends GenerateNumberDto {}
