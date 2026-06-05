import { IsInt, IsOptional, IsString } from 'class-validator';

export class TdsFilterDto {
  @IsOptional()
  @IsString({ message: 'CompanyType must be a string' })
  CompanyType?: string;

  @IsOptional()
  @IsInt({ message: 'CountryMasterSid must be a number' })
  CountryMasterSid?: number;
}
