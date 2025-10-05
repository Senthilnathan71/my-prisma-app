import { Type } from 'class-transformer';
import {
    IsArray,
    IsBoolean,
    IsDate,
    IsEmail,
    IsInt,
    IsNotEmpty,
    IsOptional,
    IsString,
    Length,
    Matches,
    MaxLength,
    MinLength,
    ValidateNested,
} from 'class-validator';

// Base Customer DTO
export class CustomerMasterDto {
    @IsInt()
    @IsNotEmpty()
    CompanyMasterSid: number;

    @IsInt()
    @IsOptional()
    PreCustomerMasterSid?: number;

    @IsInt()
    @IsOptional()
    CountryMasterSid?: number;

    @IsString()
    @IsNotEmpty()
    @MaxLength(100)
    CustomerName: string;

    @IsString()
    @IsOptional()
    @MaxLength(50)
    CustomerShortCode?: string;

    @IsString()
    @IsOptional()
    @MaxLength(100)
    CustomerAliasName?: string;

    @IsString()
    @IsNotEmpty()
    @MaxLength(300)
    CustomerAddress1: string;

    @IsString()
    @IsOptional()
    @MaxLength(300)
    CustomerAddress2?: string;

    @IsOptional()
    CustomerType?: any; // JSON field

    @IsString()
    @IsOptional()
    @MaxLength(100)
    PanName?: string;

    @IsString()
    @IsOptional()
    @MaxLength(20)
    PanType?: string;

    @IsString()
    @IsOptional()
    @MaxLength(20)
    GroupName?: string;

    @IsString()
    @IsOptional()
    @MaxLength(50)
    Website?: string;

    @IsString()
    @IsOptional()
    @MaxLength(6)
    CashCredit?: string;

    @IsString()
    @IsOptional()
    @MaxLength(20)
    Network?: string;

    @IsString()
    @IsOptional()
    @MaxLength(100)
    Remarks?: string;

    @IsString()
    @IsOptional()
    @Length(1, 1)
    IsMSME?: string;

    @IsString()
    @IsOptional()
    @MaxLength(20)
    RegistrationNo?: string;

    @IsString()
    @IsOptional()
    @MaxLength(50)
    CompanyType?: string;

    @IsString()
    @IsOptional()
    AirlineNumber?: string;

    @IsString()
    @IsOptional()
    AirlineCode?: string;

    @IsString()
    @IsOptional()
    @Length(1, 1)
    status?: string;

    @IsString()
    @IsOptional()
    @MaxLength(100)
    createdBy?: string;

    @IsString()
    @IsOptional()
    @MaxLength(100)
    updatedBy?: string;
}

// Customer Branch Contact DTO
export class CusBranchContactDto {
    @IsInt()
    @IsOptional()
    CusBranchContactSid?: number;

    @IsString()
    @IsNotEmpty()
    @MaxLength(50)
    ContactType: string;

    @IsString()
    @IsNotEmpty()
    @MaxLength(50)
    ContactName: string;

    @IsString()
    @IsOptional()
    @MaxLength(15)
    ContactNo?: string;

    @IsString()
    @IsOptional()
    @MaxLength(15)
    MobileNo?: string;

    @IsEmail()
    @IsOptional()
    @MaxLength(100)
    Email?: string;

    @IsString()
    @IsOptional()
    @Length(1, 1)
    status?: string;

    @IsString()
    @IsOptional()
    @MaxLength(100)
    createdBy?: string;

    @IsString()
    @IsOptional()
    @MaxLength(100)
    updatedBy?: string;
}

// Customer Branch Email DTO
export class CustomerBrEmailDto {
    @IsInt()
    @IsOptional()
    CustomerBrEmailSid?: number;

    @IsInt()
    @IsOptional()
    MenuMasterSid?: number;

    @IsEmail()
    @IsNotEmpty()
    @MaxLength(100)
    Toemail: string;

    @IsString()
    @IsOptional()
    @MaxLength(100)
    CCemail?: string;

    @IsArray()
    @IsOptional()
    DepartmentMasterSid?: string[]; // Array of department IDs

    @IsString()
    @IsOptional()
    @Length(1, 1)
    status?: string;

    @IsString()
    @IsOptional()
    @MaxLength(100)
    createdBy?: string;

    @IsString()
    @IsOptional()
    @MaxLength(100)
    updatedBy?: string;
}

// Customer Login DTO
export class CustomerLoginDto {
    @IsInt()
    @IsOptional()
    CustomerLoginSid?: number;

    @IsString()
    @IsNotEmpty()
    @MaxLength(50)
    LoginName: string;

    @IsEmail()
    @IsNotEmpty()
    @MaxLength(50)
    LoginEmail: string;

    @IsString()
    @IsNotEmpty()
    @MinLength(6)
    @MaxLength(100)
    LoginPassword: string;

    @IsString()
    @IsOptional()
    @Length(1, 1)
    status?: string;

    @IsString()
    @IsOptional()
    @MaxLength(100)
    createdBy?: string;

    @IsString()
    @IsOptional()
    @MaxLength(100)
    updatedBy?: string;
}

// Customer Sales Team DTO
export class CustomerSalesTeamDto {
    @IsInt()
    @IsOptional()
    CustomerSalesSid?: number;

    @IsInt()
    @IsOptional()
    Salesman?: number;

    @IsInt()
    @IsOptional()
    DocPerson?: number;

    @IsInt()
    @IsOptional()
    CSPerson?: number;

    @IsArray()
    @IsOptional()
    DepartmentMasterSid?: string[]; // Array of department IDs (stored as string array)

    @IsDate()
    @Type(() => Date)
    @IsNotEmpty()
    EffectiveFrom: Date;

    @IsString()
    @IsOptional()
    @Length(1, 1)
    status?: string;

    @IsString()
    @IsOptional()
    @MaxLength(100)
    createdBy?: string;

    @IsString()
    @IsOptional()
    @MaxLength(100)
    updatedBy?: string;
}

// Customer Milestone DTO
export class CustomerMilestoneDto {
    @IsInt()
    @IsOptional()
    CustomerMilestoneSid?: number;

    @IsInt()
    @IsNotEmpty()
    MilestoneMasterSid: number;

    @IsString()
    @IsNotEmpty()
    @MaxLength(10)
    UpdateType: string;

    @IsString()
    @IsNotEmpty()
    @MaxLength(100)
    ContactInfo: string;

    @IsDate()
    @Type(() => Date)
    @IsOptional()
    EffectiveFrom?: Date;

    @IsString()
    @IsOptional()
    @Length(1, 1)
    Status?: string;

    @IsString()
    @IsOptional()
    @MaxLength(100)
    CreatedBy?: string;

    @IsString()
    @IsOptional()
    @MaxLength(100)
    UpdatedBy?: string;
}

// Customer Branch DTO
export class CustomerBranchDto {
    @IsInt()
    @IsOptional()
    CustomerBranchSid?: number;

    @IsInt()
    @IsNotEmpty()
    StateMasterSid: number;

    @IsInt()
    @IsNotEmpty()
    CityMasterSid: number;

    @IsString()
    @IsNotEmpty()
    @MaxLength(20)
    BranchName: string;

    @IsString()
    @IsOptional()
    @MaxLength(20)
    Branch_Type?: string;

    @IsString()
    @IsOptional()
    @MaxLength(20)
    Contact_Person?: string;

    @IsString()
    @IsOptional()
    @MaxLength(10)
    Zip_PostBox?: string;

    @IsString()
    @IsOptional()
    @MaxLength(20)
    ContactNo?: string;

    @IsEmail()
    @IsNotEmpty()
    @MaxLength(200)
    Email: string;

    @IsString()
    @IsNotEmpty()
    @MaxLength(200)
    Address: string;

    @IsString()
    @IsNotEmpty()
    @Length(1, 1)
    Registered: string; // 'Y' or 'N'

    @IsString()
    @IsOptional()
    @MaxLength(20)
    CustomerGstType?: string;

    @IsString()
    @IsOptional()
    @Length(15, 15)
    @Matches(/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/, {
        message: 'Invalid GST number format'
    })
    GSTNo?: string;

    @IsString()
    @IsOptional()
    @Length(1, 1)
    status?: string;

    @IsString()
    @IsOptional()
    @MaxLength(100)
    createdBy?: string;

    @IsString()
    @IsOptional()
    @MaxLength(100)
    updatedBy?: string;

    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => CusBranchContactDto)
    @IsOptional()
    customerBranchContacts?: CusBranchContactDto[];

    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => CustomerBrEmailDto)
    @IsOptional()
    customerBranchEmails?: CustomerBrEmailDto[];

    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => CustomerLoginDto)
    @IsOptional()
    customerBranchLogins?: CustomerLoginDto[];

    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => CustomerSalesTeamDto)
    @IsOptional()
    customerSalesTeams?: CustomerSalesTeamDto[];

    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => CustomerMilestoneDto)
    @IsOptional()
    customerMilestones?: CustomerMilestoneDto[];
}

// Main Create/Update Customer DTO
export class CreateUpdateCustomerDto {
    @ValidateNested()
    @Type(() => CustomerMasterDto)
    @IsNotEmpty()
    customer: CustomerMasterDto;

    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => CustomerBranchDto)
    @IsNotEmpty()
    customerBranches: CustomerBranchDto[];
}
