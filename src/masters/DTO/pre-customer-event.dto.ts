import { Type } from 'class-transformer';
import {
    IsDateString,
    IsInt,
    IsNotEmpty,
    IsOptional,
    IsString,
    Length,
    MaxLength,
    Min,
} from 'class-validator';

export class CreateUpdatePreCustomerEventDto {
    @IsString()
    @IsNotEmpty()
    @MaxLength(100)
    EventName: string;

    @IsInt()
    @IsNotEmpty()
    @Type(() => Number)
    CityMasterSid: number;

    @IsDateString()
    @IsNotEmpty()
    EventDate: string;

    @IsInt()
    @Min(0)
    @IsOptional()
    @Type(() => Number)
    TotalLeadRecd?: number;

    @IsInt()
    @Min(0)
    @IsOptional()
    @Type(() => Number)
    TotalLeadSuccess?: number;

    @IsInt()
    @IsNotEmpty()
    @Type(() => Number)
    EventLeader: number;

    @IsInt()
    @IsNotEmpty()
    @Type(() => Number)
    CompanyMasterSid: number;

    @IsString()
    @IsOptional()
    @MaxLength(300)
    Remarks?: string;

    @IsString()
    @IsOptional()
    @Length(1, 1)
    status?: string;
}
