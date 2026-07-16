import {
    IsString,
    IsNotEmpty,
    Length,
    IsOptional,
    IsInt,
    IsEmail,
    IsJSON,
} from 'class-validator';

export class CompanyMasterDto {
    @IsString({ message: 'Company name must be a string' })
    @IsNotEmpty({ message: 'Company name is required' })
    @Length(1, 100, { message: 'Company name cannot exceed 100 characters' })
    companyName: string;

    @IsString({ message: 'Company code must be a string' })
    @IsNotEmpty({ message: 'Company code is required' })
    @Length(1, 10, { message: 'Company code must be max 10 characters' })
    companyCode: string;

    @IsOptional()
    @IsString({ message: 'Company group must be a string' })
    @Length(0, 100, { message: 'Company group cannot exceed 100 characters' })
    CompanyGroup?: string;

    @IsString({ message: 'createdBy must be a string' })
    @IsNotEmpty({ message: 'createdBy is required' })
    @Length(1, 100, { message: 'createdBy cannot exceed 100 characters' })
    createdBy: string;

    @IsString({ message: 'Address Line 1 must be a string' })
    @IsNotEmpty({ message: 'Address Line 1 is required' })
    @Length(1, 500, { message: 'Address Line 1 cannot exceed 500 characters' })
    addressLine1: string;

    @IsOptional()
    @IsString({ message: 'Address Line 2 must be a string' })
    @Length(0, 500, { message: 'Address Line 2 cannot exceed 500 characters' })
    addressLine2?: string;

    @IsOptional()
    @IsString({ message: 'Postal code must be a string' })
    @Length(0, 10, { message: 'Postal code cannot exceed 10 characters' })
    postal_code?: string;

    @IsOptional()
    @IsString({ message: 'Website must be a string' })
    @Length(0, 100, { message: 'Website cannot exceed 100 characters' })
    webSite?: string;

    @IsOptional()
    @IsString({ message: 'Phone number must be a string' })
    @Length(0, 20, { message: 'Phone number cannot exceed 20 characters' })
    phoneNumber?: string;

    @IsOptional()
    @IsEmail({}, { message: 'Invalid email format' })
    email?: string;

    @IsString({ message: 'isHo must be a string' })
    @IsNotEmpty({ message: 'isHo is required' })
    @Length(1, 1, { message: 'isHo must be exactly 1 character' })
    isHo: string;

    @IsOptional()
    @IsString({ message: 'Remarks must be a string' })
    @Length(0, 500, { message: 'Remarks cannot exceed 500 characters' })
    remarks?: string;

    @IsOptional()
    @IsString({ message: 'Company logo must be a string' })
    companyLogo?: string;

    @IsOptional()
    @IsString({ message: 'Report logo must be a string' })
    reportLogo?: string;

    @IsOptional()
    @IsString({ message: 'Status must be a string' })
    @Length(1, 1, { message: 'Status must be exactly 1 character' })
    status?: string;

    @IsOptional()
    @IsInt({ message: 'CityMasterSid must be a number' })
    CityMasterSid?: number;

    @IsOptional()
    @IsInt({ message: 'CountryMasterSid must be a number' })
    CountryMasterSid?: number;

    @IsOptional()
    @IsInt({ message: 'CurrencyMasterSid must be a number' })
    CurrencyMasterSid?: number;

    @IsOptional()
    @IsInt({ message: 'LoginSid must be a number' })
    LoginSid?: number;

    @IsOptional()
    @IsInt({ message: 'StateMasterSid must be a number' })
    StateMasterSid?: number;

    @IsOptional()
    @IsString({ message: 'PAN must be a string' })
    @Length(0, 20, { message: 'PAN cannot exceed 20 characters' })
    Pan?: string;

    @IsOptional()
    config?: any; // JSON field
}


export class BranchMasterDto {
    // ------------------------------
    // BASIC DETAILS
    // ------------------------------

    @IsString({ message: 'Branch name must be a string' })
    @IsNotEmpty({ message: 'Branch name is required' })
    @Length(1, 100, { message: 'Branch name cannot exceed 100 characters' })
    branchName: string;

    @IsString({ message: 'Branch code must be a string' })
    @IsNotEmpty({ message: 'Branch code is required' })
    @Length(1, 10, { message: 'Branch code cannot exceed 10 characters' })
    branchCode: string;

    @IsString({ message: 'createdBy must be a string' })
    @IsNotEmpty({ message: 'createdBy is required' })
    @Length(1, 100, { message: 'createdBy cannot exceed 100 characters' })
    createdBy: string;

    // ------------------------------
    // ADDRESS & CONTACT
    // ------------------------------

    @IsString({ message: 'Address Line 1 must be a string' })
    @IsNotEmpty({ message: 'Address Line 1 is required' })
    @Length(1, 500, { message: 'Address Line 1 cannot exceed 500 characters' })
    addressLine1: string;

    @IsOptional()
    @IsString({ message: 'Address Line 2 must be a string' })
    @Length(0, 500, { message: 'Address Line 2 cannot exceed 500 characters' })
    addressLine2?: string;

    @IsString({ message: 'Postal code must be a string' })
    @IsNotEmpty({ message: 'Postal code is required' })
    @Length(1, 10, { message: 'Postal code cannot exceed 10 characters' })
    postalCode: string;

    @IsOptional()
    @IsString({ message: 'Website must be a string' })
    @Length(0, 100, { message: 'Website cannot exceed 100 characters' })
    webSite?: string;

    @IsOptional()
    @IsString({ message: 'Phone number must be a string' })
    @Length(0, 20, { message: 'Phone number cannot exceed 20 characters' })
    phoneNumber?: string;

    @IsOptional()
    @IsEmail({}, { message: 'Invalid email format' })
    email?: string;

    @IsOptional()
    @IsString({ message: 'Time zone must be a string' })
    @Length(0, 6, { message: 'Time zone must be max 6 characters' })
    timeZone?: string;

    @IsOptional()
    @IsString({ message: 'Remarks must be a string' })
    @Length(0, 500, { message: 'Remarks cannot exceed 500 characters' })
    remarks?: string;

    @IsOptional()
    @IsString({ message: 'Company logo must be a string' })
    companyLogo?: string;

    @IsOptional()
    @IsString({ message: 'Report logo must be a string' })
    reportLogo?: string;

    @IsOptional()
    @IsString({ message: 'Status must be a string' })
    @Length(1, 1, { message: 'Status must be exactly 1 character' })
    status?: string;

    // ------------------------------
    // FOREIGN KEYS
    // ------------------------------

    @IsInt({ message: 'CityMasterSid must be a number' })
    CityMasterSid: number;

    @IsInt({ message: 'CompanyMasterSid must be a number' })
    CompanyMasterSid: number;

    @IsOptional()
    @IsInt({ message: 'CountryMasterSid must be a number' })
    CountryMasterSid?: number;

    @IsOptional()
    @IsInt({ message: 'CurrencyMasterSid must be a number' })
    CurrencyMasterSid?: number;

    @IsOptional()
    @IsInt({ message: 'LoginSid must be a number' })
    LoginSid?: number;

    @IsInt({ message: 'StateMasterSid must be a number' })
    StateMasterSid: number;

    // ------------------------------
    // CONFIG JSON
    // ------------------------------

    @IsOptional()
    config?: any;

    // ------------------------------
    // NUMBER SERIES SETTINGS
    // ------------------------------

    @IsOptional()
    @IsInt()
    consoleNoLen?: number;

    @IsOptional()
    @IsString()
    @Length(0, 20)
    consolePrefix?: string;

    @IsOptional()
    @IsInt()
    enquiryNoLen?: number;

    @IsOptional()
    @IsString()
    @Length(0, 20)
    enquiryPrefix?: string;

    @IsOptional()
    @IsInt()
    quotationNoLen?: number;

    @IsOptional()
    @IsString()
    @Length(0, 20)
    quotationPrefix?: string;

    @IsOptional()
    @IsInt()
    shipmentNoLen?: number;

    @IsOptional()
    @IsString()
    @Length(0, 20)
    shipmentPrefix?: string;

    @IsOptional()
    @IsInt()
    HBLNoLen?: number;

    @IsOptional()
    @IsString()
    @Length(0, 20)
    HBLPrefix?: string;

    @IsOptional()
    @IsInt()
    lastConsoleNo?: number;

    @IsOptional()
    @IsInt()
    lastEnquiryNo?: number;

    @IsOptional()
    @IsInt()
    lastHBLNo?: number;

    @IsOptional()
    @IsInt()
    lastQuotationNo?: number;

    @IsOptional()
    @IsInt()
    lastShipmentNo?: number;

    @IsOptional()
    @IsInt()
    BookingNoLen?: number;

    @IsOptional()
    @IsString()
    @Length(0, 20)
    BookingPrefix?: string;

    @IsOptional()
    @IsInt()
    LastBookingNo?: number;
}


export class RoleMasterDto {
  @IsNotEmpty({ message: 'UserRoleCode is required' })
  @Length(1, 3, { message: 'UserRoleCode must be 1-3 characters' })
  UserRoleCode: string;

  @IsNotEmpty({ message: 'UserRoleName is required' })
  @Length(1, 50, { message: 'UserRoleName must be between 1 and 50 characters' })
  UserRoleName: string;

  @IsOptional()
  @IsInt({ message: 'CompanyMasterSid must be a number' })
  CompanyMasterSid?: number;

  @IsNotEmpty({ message: 'createdBy is required' })
  @Length(1, 100, { message: 'createdBy must be between 1 and 100 characters' })
  createdBy: string;

  @IsOptional()
  @Length(1, 100, { message: 'updatedBy must be between 1 and 100 characters' })
  updatedBy?: string;

  @IsOptional()
  @Length(1, 1, { message: 'status must be a single character (A/I)' })
  status?: string;

  @IsOptional()
  @Length(1, 300, { message: 'Remarks must be between 1 and 300 characters' })
  Remarks?: string;

  @IsOptional()
  @Length(1, 50, { message: 'LicenseType must be between 1 and 50 characters' })
  LicenseType?: string;
}
