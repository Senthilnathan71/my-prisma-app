import { IsInt, IsOptional, IsString, IsArray, ValidateNested, IsNotEmpty, IsNumber, IsBoolean } from 'class-validator';
import { Type } from 'class-transformer';

export class RoleMenuPermissionDto {
    @IsNumber()
    id?: number | null;

    @IsString()
    key: string;

    @IsBoolean()
    value: boolean;

    @IsBoolean()
    state: boolean;
}

export class RoleMenuItemDto {

    @IsNumber()
    RoleMenuDetailSid: number;

    @IsNumber()
    ModuleMasterSid: number;

    @IsString()
    ModuleName: string;

    @IsNumber()
    MenuMasterSid: number;

    @IsString()
    MenuName: string;

    @IsString()
    MenuDisplayName: string;

    InsertRole: string;

    ViewRole: string;

    UpdateRole: string;

    DeleteRole: string;

    @IsArray()
    menuPermission : string[];
}



export class RoleMenuDetailDto {
    @IsOptional()
    @IsInt()
    RoleMenuDetailSid?: number | null;

    @IsOptional()
    @IsInt()
    RoleMenuHeaderSid: number;

    @IsInt()
    MenuMasterSid: number;

    @IsOptional()
    @IsString()
    DisplayName?: string | null;

    @IsOptional()
    @IsInt()
    CompanyMasterSid?: number | null;

    @IsOptional()
    @IsString()
    InsertRole?: string; // 'Y' or 'N'

    @IsOptional()
    @IsString()
    ViewRole?: string;

    @IsOptional()
    @IsString()
    UpdateRole?: string;

    @IsOptional()
    @IsString()
    DeleteRole?: string;

    @IsOptional()
    @IsString()
    PostRole?: string;

    @IsOptional()
    @IsBoolean()
    isDeleted?: boolean;

}

export class RoleMenuPayload {
    @IsOptional()
    @IsInt()
    RoleMenuHeaderSid: number;

    @IsNotEmpty({message : 'RoleMasterSid is required'})
    @IsInt()
    RoleMasterSid: number;

    @IsNotEmpty({message : 'CompanyMasterSid is required'})
    @IsInt()
    CompanyMasterSid?: number | null;

    @IsString({message : 'CreatedBy is required'})
    createdBy: string;

    @IsOptional()
    @IsString()
    updatedBy?: string | null;

    @IsOptional()
    @IsString()
    Remarks: string;

    @IsOptional()
    @IsString()
    status: string;

    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => RoleMenuDetailDto)
    RoleMenuDetail: RoleMenuDetailDto[];
}

export class RoleMenuFetchPayload {
    @IsNotEmpty()
    @IsInt()
    RoleMenuHeaderSid: number;

    @IsNotEmpty()
    @IsInt()
    CompanyMasterSid: number;
}

export interface MenuModuleMap {
    [key: string]: string;
    value : any
}

export class RoleMenuPrintChangeDto {
    @IsInt()
    PrintMasterSid: number;

    @IsBoolean()
    grantAccess: boolean;
}

export class SaveRoleMenuPrintDto {
    @IsNotEmpty()
    @IsInt()
    CompanyMasterSid: number;

    @IsNotEmpty()
    @IsInt()
    RoleMenuHeaderSid: number;

    @IsNotEmpty()
    @IsInt()
    RoleMenuDetailSid: number;

    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => RoleMenuPrintChangeDto)
    changes: RoleMenuPrintChangeDto[];

    @IsNotEmpty()
    @IsString()
    UpdatedBy: string;
}

export class RoleMenuReportChangeDto {
    @IsInt()
    ReportMasterSid: number;

    @IsBoolean()
    grantAccess: boolean;
}

export class SaveRoleMenuReportDto {
    @IsNotEmpty()
    @IsInt()
    RoleMenuDetailSid: number;

    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => RoleMenuReportChangeDto)
    changes: RoleMenuReportChangeDto[];

    @IsNotEmpty()
    @IsString()
    UpdatedBy: string;
}
