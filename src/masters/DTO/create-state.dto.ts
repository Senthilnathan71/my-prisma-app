import {
    IsString,
    IsOptional,
    IsNumber,
    IsDateString,
    IsInt,
} from 'class-validator';

export class CreateStateDto {
    @IsString()
    stateCode: string;

    @IsString()
    stateName: string;

    @IsString()
    createdBy: string;

    @IsString()
    status: string;

    @IsNumber()
    CountryMasterSid: number;
}


export class UpdateStateDto {
    @IsOptional()
    @IsString()
    stateCode: string;

    @IsOptional()
    @IsString()
    stateName: string;

    @IsOptional()
    @IsString()
    status?: string;

    @IsOptional()
    @IsNumber()
    CountryMasterSid?: number;

    @IsNumber()
    StateMasterSid: number;
}