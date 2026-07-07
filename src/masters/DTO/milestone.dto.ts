import {
    IsInt,
    IsString,
    IsOptional,
    IsNotEmpty,
    MaxLength,
    IsIn,
    IsArray,
} from 'class-validator';
import { Type } from 'class-transformer';
import { Decimal } from '@prisma/client/runtime/library';
import { PartialType } from '@nestjs/swagger';

export class MilestoneMasterDTO {
    @IsOptional()
    @IsInt()
    MilestoneMasterSid: number;

    @IsOptional()
    @IsInt()
    CompanyMasterSid?: number | null;

    @IsOptional()
    @IsInt()
    BranchMasterSid?: number | null;

    @IsString()
    @IsNotEmpty()
    @MaxLength(30)
    MilestoneName: string;

    @IsString()
    @IsNotEmpty()
    @MaxLength(30)
    MilestoneCode: string;

    @IsOptional()
    @IsString()
    @IsIn(['Y', 'N'], {
        message: 'AutomailRequire must be Y or N',
    })
    AutomailRequire?: string | null;

    @Type(() => Decimal)
    SortBy: Decimal;

    @IsString()
    @IsNotEmpty()
    @MaxLength(100)
    ShipmentType: string;

    @IsOptional()
    @IsString()
    @IsIn(['Y', 'N'], {
        message: 'AutoCapture must be Y or N',
    })
    AutoCapture?: string | null;

    @IsOptional()
    @IsString()
    @IsIn(['Y', 'N'], {
        message: 'IsCustomerSpecific must be Y or N',
    })
    IsCustomerSpecific?: string;

    @IsOptional()
    @IsString()
    @IsIn(['Y', 'N'], {
        message: 'IsMandatory must be Y or N',
    })
    IsMandatory?: string;

    @IsOptional()
    @Type(() => Date)
    createdOn?: Date;

    @IsOptional()
    @Type(() => Date)
    updatedOn?: Date | null;

    @IsOptional()
    @Type(() => Date)
    deletedAt?: Date | null;

    @IsString()
    @IsNotEmpty()
    @MaxLength(100)
    createdBy: string;

    @IsOptional()
    @IsString()
    @MaxLength(100)
    updatedBy?: string | null;

    @IsOptional()
    @IsString()
    @IsIn(['A', 'S', 'D'], {
        message: 'status must be A (Active) or S (Suspended) or D (Deleted)',
    })
    status?: string | null;

    @IsOptional()
    @IsString()
    @MaxLength(500)
    Remarks?: string | null;

    @IsArray()
    @IsString({ each: true })
    DepartmentMasterSid: string[];
}