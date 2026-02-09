import {
  IsBoolean,
  IsDateString,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Length,
  ValidateIf,
} from "class-validator";

export class PullStandardRateDTO {

  @IsNotEmpty({ message: "CompanyMasterSid is required" })
  @IsInt({ message: "CompanyMasterSid must be a number" })
  CompanyMasterSid: number;


  @IsNotEmpty({ message: "DepartmentMasterSid is required" })
  @IsInt({ message: "DepartmentMasterSid must be a number" })
  DepartmentMasterSid: number;


  @IsNotEmpty({ message: "BranchMasterSid is required" })
  @IsInt({ message: "BranchMasterSid must be a number" })
  BranchMasterSid: number;


  @IsOptional()
  @IsString({ message: "CargoType must be a string" })
  @Length(0, 20, { message: "CargoType max length is 20 characters" })
  CargoType: string;


  @IsOptional()
  @IsBoolean({ message: "isQuotation must be true or false" })
  isQuotation?: boolean;


  @ValidateIf(o => o.isQuotation !== true)
  @IsNotEmpty({ message: "OperationDate is required when isQuotation is false" })
  @IsDateString({}, { message: "OperationDate must be a valid ISO Date string" })
  OperationDate: Date ;


  @ValidateIf(o => o.isQuotation === true)
  @IsNotEmpty({ message: "EffectiveFrom is required when isQuotation is true" })
  @IsDateString({}, { message: "EffectiveFrom must be a valid ISO Date string" })
  EffectiveFrom: Date ;


  @ValidateIf(o => o.isQuotation === true)
  @IsNotEmpty({ message: "ExpiredTo is required when isQuotation is true" })
  @IsDateString({}, { message: "ExpiredTo must be a valid ISO Date string" })
  ExpiredTo: Date;
}