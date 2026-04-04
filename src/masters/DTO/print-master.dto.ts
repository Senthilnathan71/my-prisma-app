import { IsInt, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreatePrintMasterDto {
    @IsNotEmpty()
    @IsString()
    Name: string;

    @IsNotEmpty()
    @IsString()
    PrintMail: string;

    @IsNotEmpty()
    @IsInt()
    MenuMasterSid: number;

    @IsNotEmpty()
    @IsInt()
    CompanyMasterSid: number;

    @IsNotEmpty()
    @IsString()
    CreatedBy: string;
}

export class UpdatePrintMasterDto {
    @IsOptional()
    @IsString()
    Name?: string;

    @IsOptional()
    @IsString()
    PrintMail?: string;

    @IsOptional()
    @IsInt()
    MenuMasterSid?: number;

    @IsOptional()
    @IsString()
    Status?: string;

    @IsNotEmpty()
    @IsString()
    UpdatedBy: string;
}

export class PrintMasterSearchDto {
    @IsOptional()
    @IsString()
    search?: string;

    @IsOptional()
    @IsInt()
    page?: number;

    @IsOptional()
    @IsInt()
    pageSize?: number;

    @IsNotEmpty()
    @IsInt()
    activeCompanyId: number;

    @IsOptional()
    @IsInt()
    MenuMasterSid?: number;
}
