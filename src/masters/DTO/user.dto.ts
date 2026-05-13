import {
    IsString,
    IsOptional,
    IsInt,
    IsEmail,
    Length,
    IsArray,
    IsNotEmpty,
    ValidateNested,
    IsDateString,
} from 'class-validator';
import { PartialType } from '@nestjs/mapped-types';
import { Type } from 'class-transformer';
import { BranchMasterDto, CompanyMasterDto, RoleMasterDto } from './company.dto';

export class CreateUserMasterDto {
    @IsString({ message: 'User code must be a string' })
    @IsNotEmpty({ message: 'User code is required' })
    @Length(2, 100, { message: 'User code must be between 2 and 20 characters' })
    userCode: string;

    @IsString({ message: 'User name must be a string' })
    @IsNotEmpty({ message: 'User name is required' })
    @Length(2, 100, { message: 'User name must be between 2 and 50 characters' })
    userName: string;

    @IsEmail({}, { message: 'Invalid email format' })
    @IsNotEmpty({ message: 'User email is required' })
    @Length(5, 50, { message: 'Email must be between 5 and 100 characters' })
    userEmail: string;

    @IsString({ message: 'Password must be a string' })
    @IsNotEmpty({ message: 'Password is required' })
    @Length(6, 100, { message: 'Password must be between 6 and 50 characters' })
    userPassword: string;

    @IsOptional()
    @IsString({ message: 'isSalesperson must be a string' })
    @Length(1, 1, { message: 'isSalesperson must be a single character (Y/N)' })
    isSalesperson?: string;

    @IsOptional()
    @IsString({ message: 'Contact number must be a string' })
    @Length(5, 20, { message: 'Contact number must be between 5 and 15 digits' })
    contactNumber?: string;

    @IsOptional()
    @IsString({ message: 'Designation must be a string' })
    @Length(2, 20, { message: 'Designation must be between 2 and 50 characters' })
    designation?: string;

    @IsNotEmpty({ message: 'createdBy is required' })
    @IsString({ message: 'createdBy must be a string' })
    @Length(1, 100, { message: 'createdBy must be between 1 and 100 characters' })
    createdBy: string;

    @IsOptional()
    @IsString({ message: 'updatedBy must be a string' })
    @Length(1, 100, { message: 'updatedBy must be between 1 and 100 characters' })
    updatedBy?: string;

    @IsOptional()
    @IsInt({ message: 'CountryMasterSid must be a number' })
    CountryMasterSid?: number;

    @IsOptional()
    @IsInt({ message: 'LoginSid must be a number' })
    LoginSid?: number;

    @IsOptional()
    @IsString({ message: 'CostRevenue must be a string' })
    @Length(1, 1, { message: 'CostRevenue must be a single character' })
    CostRevenue?: string;

    @IsOptional()
    @IsString({ message: 'DefaultDept must be a string' })
    @Length(1, 50, { message: 'DefaultDept must be between 1 and 50 characters' })
    DefaultDept?: string;

    @IsOptional()
    @IsInt({ message: 'DeptHead must be a number' })
    DeptHead?: number;

    @IsOptional()
    @IsString({ message: 'isLoginUser must be a string' })
    @Length(1, 1, { message: 'isLoginUser must be a single character (Y/N)' })
    isLoginUser?: string;

    @IsOptional()
    @IsInt({ message: 'userTypeId must be a number' })
    userTypeId?: number;

    @IsArray({ message: 'Department must be an array of strings' })
    @IsString({ each: true, message: 'Each department must be a string' })
    @IsNotEmpty({ message: 'Department list cannot be empty' })
    department: string[];

    @IsOptional()
    @Length(1, 1, { message: 'status must be a single character (A/I)' })
    status?: string;

    @IsOptional()
    @IsDateString({}, { message: 'AttemptDateTime must be a valid date string' })
    AttemptDateTime?: string | null;

    @IsOptional()
    @ValidateNested({ each: true })
    @Type(() => UserCompanyMasterDto)
    userCompanyMaster: UserCompanyMasterDto[];
}

export class UpdateUserMasterDto extends PartialType(CreateUserMasterDto) {
    @IsOptional()
    @IsString({ message: 'User code must be a string' })
    @Length(2, 20, { message: 'User code must be between 2 and 20 characters' })
    @IsNotEmpty({ message: 'User code cannot be empty' })
    userCode?: string;

    @IsOptional()
    @IsString({ message: 'User name must be a string' })
    @Length(2, 50, { message: 'User name must be between 2 and 50 characters' })
    @IsNotEmpty({ message: 'User name cannot be empty' })
    userName?: string;

    @IsOptional()
    @IsEmail({}, { message: 'Invalid email format' })
    @Length(5, 100, { message: 'Email must be between 5 and 100 characters' })
    @IsNotEmpty({ message: 'User email cannot be empty' })
    userEmail?: string;

    @IsOptional()
    @IsString({ message: 'Password must be a string' })
    @Length(6, 50, { message: 'Password must be between 6 and 50 characters' })
    @IsNotEmpty({ message: 'Password cannot be empty' })
    userPassword?: string;

    @IsOptional()
    @IsString({ message: 'isSalesperson must be a string' })
    @Length(1, 1, { message: 'isSalesperson must be a single character (Y/N)' })
    isSalesperson?: string;

    @IsOptional()
    @IsString({ message: 'Contact number must be a string' })
    @Length(5, 15, { message: 'Contact number must be between 5 and 15 digits' })
    contactNumber?: string;

    @IsOptional()
    @IsString({ message: 'Designation must be a string' })
    @Length(2, 50, { message: 'Designation must be between 2 and 50 characters' })
    designation?: string;

    @IsOptional()
    @IsInt({ message: 'CountryMasterSid must be a number' })
    CountryMasterSid?: number;

    @IsOptional()
    @IsInt({ message: 'LoginSid must be a number' })
    LoginSid?: number;

    @IsOptional()
    @IsString({ message: 'CostRevenue must be a string' })
    @Length(1, 1, { message: 'CostRevenue must be a single character' })
    CostRevenue?: string;

    @IsOptional()
    @IsString({ message: 'DefaultDept must be a string' })
    @Length(1, 50, { message: 'DefaultDept must be between 1 and 50 characters' })
    DefaultDept?: string;

    @IsOptional()
    @IsInt({ message: 'DeptHead must be a number' })
    DeptHead?: number;

    @IsOptional()
    @IsString({ message: 'isLoginUser must be a string' })
    @Length(1, 1, { message: 'isLoginUser must be a single character (Y/N)' })
    isLoginUser?: string;

    @IsNotEmpty({ message: 'updatedBy is required' })
    @IsString({ message: 'updatedBy must be a string' })
    @Length(1, 100, { message: 'updatedBy must be between 1 and 100 characters' })
    updatedBy: string;

    @IsOptional()
    @IsInt({ message: 'userTypeId must be a number' })
    userTypeId?: number;

    @IsOptional()
    @IsArray({ message: 'Department must be an array of strings' })
    @IsString({ each: true, message: 'Each department must be a string' })
    department?: string[];

    @IsOptional()
    @ValidateNested({ each: true })
    @Type(() => UserCompanyMasterDto)
    userCompanyMaster?: UserCompanyMasterDto[];

    @IsOptional()
    @IsDateString({}, { message: 'AttemptDateTime must be a valid date string' })
    AttemptDateTime?: string | null;
}

export class UserCompanyMasterDto {

    @IsInt()
    @IsOptional()
    UserCompanyMasterSid: number;

    @IsOptional()
    @IsInt({ message: 'UserMasterSid must be a number' })
    UserMasterSid: number;

    @IsInt({ message: 'CompanyMasterSid must be a number' })
    @IsNotEmpty({ message: 'CompanyMasterSid is required' })
    CompanyMasterSid: number;

    @IsOptional()
    @IsString({ message: 'createdBy must be a string' })
    createdBy: string;

    @IsOptional()
    @IsString({ message: 'updatedBy must be a string' })
    updatedBy?: string;

    @IsOptional()
    @IsString({ message: 'status must be a string' })
    @Length(1, 1, { message: 'status must be exactly 1 character' })
    status?: string;

    @IsOptional()
    @IsString({ message: 'GiveAccess must be a string' })
    @Length(1, 1, { message: 'GiveAccess must be exactly 1 character' })
    GiveAccess?: string;

    @IsOptional()
    @IsString({ message: 'IsDefault must be a string' })
    @Length(1, 1, { message: 'IsDefault must be exactly 1 character' })
    IsDefault?: string;

    @IsOptional()
    @ValidateNested()
    @Type(() => CompanyMasterDto)
    companyMaster?: CompanyMasterDto;

    @IsOptional()
    @ValidateNested()
    @Type(() => UserBranchMasterDto)
    userBranchMaster: UserBranchMasterDto[];

    @IsOptional()
    @ValidateNested()
    @Type(() => UserRoleMasterDto)
    userRoleMaster?: UserRoleMasterDto[];

}


export class UserBranchMasterDto {

    @IsInt()
    @IsOptional()
    UserBranchMasterSid: number;

    @IsInt()
    @IsOptional()
    UserMasterSid: number;

    @IsInt()
    @IsNotEmpty({ message: 'CompanyMasterSid is required' })
    CompanyMasterSid: number;

    @IsInt()
    @IsNotEmpty({ message: 'BranchMasterSid is required' })
    BranchMasterSid: number;

    @IsOptional()
    @Length(1, 100, { message: 'createdBy must be between 1 and 100 characters' })
    createdBy: string;

    @IsOptional()
    @Length(1, 100, { message: 'updatedBy must be between 1 and 100 characters' })
    updatedBy?: string;

    @IsOptional()
    @Length(1, 1, { message: 'status must be a single character (A/I)' })
    status?: string;

    @IsOptional()
    @Length(1, 1, { message: 'GiveAccess must be a single character (Y/N)' })
    GiveAccess?: string;

    @IsOptional()
    @Length(1, 1, { message: 'IsDefault must be a single character (Y/N)' })
    IsDefault?: string;

    @IsOptional()
    @IsInt({ message: 'LoginSid must be a number if provided' })
    LoginSid?: number;

    @IsOptional()
    @ValidateNested()
    @Type(() => BranchMasterDto)
    branchMaster?: BranchMasterDto;
}

export class FetchReportingUsersDto {
    @IsInt({ message: 'CompanyMasterSid must be a number' })
    @IsNotEmpty({ message: 'CompanyMasterSid is required' })
    CompanyMasterSid: number;
}

export class UserRoleMasterDto {

    @IsInt()
    @IsOptional()
    UserRoleMasterSid: number;

    @IsInt()
    @IsOptional()
    UserMasterSid: number;

    @IsInt()
    @IsNotEmpty({ message: 'RoleMasterSid is required' })
    RoleMasterSid: number;

    @IsOptional()
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
    @Length(1, 1, { message: 'GiveAccess must be a single character (Y/N)' })
    GiveAccess?: string;

    @IsOptional()
    @Length(1, 1, { message: 'IsDefault must be a single character (Y/N)' })
    IsDefault?: string;

    @IsOptional()
    @IsInt({ message: 'MenuMasterSid must be a number if provided' })
    MenuMasterSid?: number;

    @IsOptional()
    @IsInt({ message: 'UserCompanyMasterSid must be a number if provided' })
    UserCompanyMasterSid?: number;

    @IsOptional()
    @ValidateNested()
    @Type(() => RoleMasterDto)
    roleMaster?: RoleMasterDto;
}
