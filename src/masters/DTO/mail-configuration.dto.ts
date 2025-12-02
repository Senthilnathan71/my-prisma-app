import {
    IsInt,
    IsNotEmpty,
    IsOptional,
    IsString,
    MaxLength,
    Min,
    Max,
    IsIn,
    Length,
} from 'class-validator';

// Create Mail Configuration DTO
export class CreateMailConfigurationDto {
    @IsInt()
    @IsNotEmpty()
    CompanyMasterSid: number;

    @IsInt()
    @IsNotEmpty()
    @Min(1)
    @Max(999)
    Sno: number;

    @IsString()
    @IsNotEmpty()
    @MaxLength(50)
    MailName: string;

    @IsInt()
    @IsNotEmpty()
    MenuMasterSid: number;

    @IsString()
    @IsNotEmpty()
    @MaxLength(500)
    MailSubject: string;

    @IsString()
    @IsNotEmpty()
    @MaxLength(2000)
    MailBody: string;

    @IsString()
    @IsOptional()
    @MaxLength(200)
    ToEmailidFrom?: string;

    @IsString()
    @IsOptional()
    @MaxLength(200)
    CcEmailidFrom?: string;

    @IsString()
    @IsOptional()
    @Length(1, 1)
    @IsIn(['Y', 'N'])
    AttachmentRequire?: string;

    @IsString()
    @IsOptional()
    @Length(1, 1)
    @IsIn(['A', 'P'])
    AutoPopup?: string;
}

// Update Mail Configuration DTO
export class UpdateMailConfigurationDto {
    @IsInt()
    @IsOptional()
    @Min(1)
    @Max(999)
    Sno?: number;

    @IsString()
    @IsOptional()
    @MaxLength(50)
    MailName?: string;

    @IsInt()
    @IsOptional()
    MenuMasterSid?: number;

    @IsString()
    @IsOptional()
    @MaxLength(500)
    MailSubject?: string;

    @IsString()
    @IsOptional()
    @MaxLength(2000)
    MailBody?: string;

    @IsString()
    @IsOptional()
    @MaxLength(200)
    ToEmailidFrom?: string;

    @IsString()
    @IsOptional()
    @MaxLength(200)
    CcEmailidFrom?: string;

    @IsString()
    @IsOptional()
    @Length(1, 1)
    @IsIn(['Y', 'N'])
    AttachmentRequire?: string;

    @IsString()
    @IsOptional()
    @Length(1, 1)
    @IsIn(['A', 'P'])
    AutoPopup?: string;

    @IsString()
    @IsOptional()
    @Length(1, 1)
    @IsIn(['A', 'D'])
    Status?: string;
}

// Search Mail Configuration DTO
export class SearchMailConfigurationDto {
    @IsString()
    @IsOptional()
    search?: string;

    @IsInt()
    @IsOptional()
    page?: number;

    @IsInt()
    @IsOptional()
    pageSize?: number;

    @IsInt()
    @IsNotEmpty()
    CompanyMasterSid: number;

    @IsString()
    @IsOptional()
    sortColumn?: string;

    @IsString()
    @IsOptional()
    sortDirection?: string;
}
