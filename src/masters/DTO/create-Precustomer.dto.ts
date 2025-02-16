import { IsNumber, IsOptional, IsString } from "class-validator";

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
    PreCustomerName : string

    @IsString()
    PreCustomerAddress1 :string

    @IsString()
    PreCustomerAddress2 : string

    @IsString()
    ContactPerson :string

    @IsString()
    Email : string

    @IsString()
    Phone :string

    @IsString()
    LeadFrom : string

    @IsString()
    LeadReferredBy :string

    @IsString()
    @IsOptional()
    Status : string

}