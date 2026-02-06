import { IsDateString, IsInt, IsNotEmpty, IsOptional, IsString, Length } from "class-validator";

export class PullStandardRateDTO {
    @IsNotEmpty({ message : 'CompanyMasterSid is required' })
    @IsInt()
    CompanyMasterSid : number

    @IsNotEmpty({ message : 'DepartmentMasterSid is required'})
    @IsInt()
    DepartmentMasterSid : number

    @IsNotEmpty({ message : 'OperationDate is required'})
    @IsDateString()
    OperationDate : Date | string;

    @IsOptional()
    @IsString()
    @Length(0,20)
    CargoType : string;

    @IsNotEmpty({ message : 'BranchMasterSid is required' })
    @IsInt()
    BranchMasterSid: number;
}