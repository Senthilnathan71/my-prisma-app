import { Type } from 'class-transformer';
import { ArrayNotEmpty, IsArray, IsInt, IsOptional, IsString, ValidateNested } from 'class-validator';

export class CreateCompanyConfigDto {
  @IsOptional()
  CompanyMasterSid?: number | number[];

  @IsOptional()
  @IsArray()
  @ArrayNotEmpty()
  @IsInt({ each: true })
  @Type(() => Number)
  CompanyMasterSids?: number[];

  @IsString()
  ConfigurationName: string;

  @IsOptional()
  @IsString()
  DisplayName?: string;

  @IsOptional()
  @IsString()
  ConfigType?: string;

  @IsOptional()
  @IsString()
  ConfigurationValue?: string;
}

export class UpdateCompanyConfigDto {
  @IsOptional()
  @IsString()
  ConfigurationName?: string;

  @IsOptional()
  @IsString()
  DisplayName?: string;

  @IsOptional()
  @IsString()
  ConfigType?: string;

  @IsOptional()
  @IsString()
  ConfigurationValue?: string;
}

export class CompanyConfigBulkUpdateItemDto extends UpdateCompanyConfigDto {
  @IsOptional()
  @IsInt()
  @Type(() => Number)
  CompanyConfigurationSid?: number;

  @IsOptional()
  @IsInt()
  @Type(() => Number)
  CompanyMasterSid?: number;
}

export class BulkCompanyConfigUpdateDto {
  @IsInt()
  @Type(() => Number)
  CompanyMasterSid: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CompanyConfigBulkUpdateItemDto)
  configurations: CompanyConfigBulkUpdateItemDto[];
}
