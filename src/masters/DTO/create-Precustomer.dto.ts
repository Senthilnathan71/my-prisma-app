import { IsDate, IsNumber, IsOptional, IsString } from "class-validator";

export class CreatePrecustomerDto {
    @IsNumber()
    @IsOptional()
    PreCustomerMasterSid: number;

    @IsNumber()
    CompanyMasterSid: number

    @IsNumber()
    BranchMasterSid: number

    @IsNumber() 
    CityMasterSid : number

    @IsNumber()
    CountryMasterSid : number

    @IsNumber()
    StateMasterSid : number

    @IsString()
    preCustomerName : string

    @IsString()
    preCustomerAddress1 :string

    @IsString()
    preCustomerAddress2 : string

    @IsString()
    contactPerson :string

    @IsString()
    email : string

    @IsString()
    phone :string

    @IsString()
    leadFrom : string

    @IsString()
    leadReferredBy :string

    @IsString()
    @IsOptional()
    status : string

    @IsDate()
    @IsOptional()
    createdOn : Date

    @IsDate()
    @IsOptional()
    updatedOn : Date

    @IsString()
    @IsOptional()
    createdBy : string

    @IsString()
    @IsOptional()
    updatedBy : string

}