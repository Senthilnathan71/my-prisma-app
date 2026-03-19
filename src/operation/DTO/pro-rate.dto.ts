import { IsInt, IsNotEmpty } from 'class-validator';

export class ProRateCalculateDto {
  @IsNotEmpty()
  @IsInt()
  CompanyMasterSid: number;

  @IsNotEmpty()
  @IsInt()
  BranchMasterSid: number;

  @IsNotEmpty()
  @IsInt()
  MasterJobSid: number;
}

export class ProRateApplyDto extends ProRateCalculateDto {}

export class ProRateHouseDto {
  @IsNotEmpty()
  @IsInt()
  HouseJobSid: number;

  @IsNotEmpty()
  @IsInt()
  CompanyMasterSid: number;

  @IsNotEmpty()
  @IsInt()
  BranchMasterSid: number;
}
