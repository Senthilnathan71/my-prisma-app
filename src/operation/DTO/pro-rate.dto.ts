import { IsNotEmpty, IsInt } from 'class-validator';

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
