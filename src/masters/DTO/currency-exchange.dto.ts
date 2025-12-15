import { IsIn, IsInt, IsNotEmpty, IsOptional, Length } from "class-validator";

export class FetchExchangeRate {

    @IsNotEmpty({ message : 'Company Master Sid is required' })
    @IsInt({ message : 'Company Master Sid must be an integer' })
    CompanyMasterSid: number;

    @IsNotEmpty({ message : 'Branch Master Sid is required' })
    BranchMasterSid: number;
    
    @IsNotEmpty({ message : 'From Currency is required' })
    @Length(3, 3, { message : 'From Currency must be 3 characters long' })
    fromCurrencyCode: string;

    @IsNotEmpty({ message : 'To Currency is required' })
    @Length(3, 3, { message : 'To Currency must be 3 characters long' })
    toCurrencyCode: string;

    @IsOptional()
    EffectiveFrom: Date;

    @IsNotEmpty({ message : 'Segment is required' })
    @IsIn(['cost', 'revenue'], { message : 'Segment must be either cost or revenue' })
    segment: string;


}