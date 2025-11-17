import { Type } from 'class-transformer';
import {
    IsString,
    IsNotEmpty,
    IsDefined,
    IsNumber,
    IsOptional,
    IsDateString,
    IsDecimal,
    ValidateNested,
} from 'class-validator';



export class VoucherHeaderDto {
    // REQUIRED FIELDS
    @IsDefined({ message: 'CompanyMasterSid is required' })
    @IsNumber()
    CompanyMasterSid: number;

    @IsDefined({ message: 'BranchMasterSid is required' })
    @IsNumber()
    BranchMasterSid: number;

    @IsDefined({ message: 'VoucherNumber is required' })
    @IsString()
    @IsNotEmpty()
    VoucherNumber: string;

    @IsDefined({ message: 'VoucherType is required' })
    @IsNumber()
    VoucherType: number;

    @IsDefined({ message: 'VoucherDate is required' })
    @IsDateString()
    VoucherDate: Date;

    @IsDefined({ message: 'PostDate is required' })
    @IsDateString()
    PostDate: Date;

    @IsDefined({ message: 'Narration is required' })
    @IsString()
    @IsNotEmpty()
    Narration: string;

    @IsDefined({ message: 'PartyMasterSid is required' })
    @IsNumber()
    PartyMasterSid: number;

    @IsDefined({ message: 'PartyName is required' })
    @IsString()
    @IsNotEmpty()
    PartyName: string;

    @IsDefined({ message: 'COAMasterSid is required' })
    @IsNumber()
    COAMasterSid: number;

    @IsDefined({ message: 'VoucherTypeMasterSid is required' })
    @IsNumber()
    VoucherTypeMasterSid: number;

    // OPTIONAL FIELDS
    @IsOptional() @IsString() PartyAddress?: string;
    @IsOptional() @IsNumber() CustomerBranchSid?: number;
    @IsOptional() @IsString() PlaceOfSupply?: string;
    @IsOptional() @IsString() State?: string;

    @IsOptional() @IsNumber() BankCOA?: number;
    @IsOptional() @IsString() BankPartyName?: string;
    @IsOptional() @IsString() GST_VAT?: string;
    @IsOptional() @IsString() InvoiceType?: string;
    @IsOptional() @IsNumber() ReversalVoucher?: number;

    @IsOptional() @IsNumber() TaxNumber?: number;
    @IsOptional() @IsString() GSTType?: string;
    @IsOptional() @IsString() Remarks?: string;

    @IsOptional() @IsNumber() DepartmentMasterSid?: number;
    @IsOptional() @IsString() HouseNumber?: string;
    @IsOptional() @IsString() MasterNumber?: string;

    @IsOptional() @IsNumber() HouseJobSid?: number;
    @IsOptional() @IsNumber() MasterJobSid?: number;

    @IsOptional() @IsNumber() CurrencyMasterSid?: number;
    @IsOptional() @IsString() CurrencyCode?: string;

    @IsOptional() @IsDecimal()
    ExchangeRate?: number;

    @IsOptional() @IsDecimal()
    Amount?: number;

    @IsOptional() @IsDecimal()
    LocalAmount?: number;

    @IsOptional() @IsDecimal()
    NetAmount?: number;

    @IsOptional() @IsString() DocumentNumber?: string;
    @IsOptional() @IsDateString() DocumentDate?: Date;

    @IsOptional() @IsString() SetoffStatus?: string;
    @IsOptional() @IsString() TaxType?: string;

    @IsOptional() @IsString() InstrumentMode?: string;
    @IsOptional() @IsString() InstrumentNumber?: string;
    @IsOptional() @IsDateString() InstrumentDate?: Date;

    @IsOptional() @IsDateString() ClearanceDate?: Date;
    @IsOptional() @IsString() CreditNoteReason?: string;

    // ENUM-LIKE FIELDS
    @IsOptional()
    @IsString()
    CashOrBank?: string;

    @IsOptional()
    @IsString()
    MultiBranch?: string;

    @IsOptional()
    @IsString()
    PostStatus?: string;


    @ValidateNested({ each: true })
    @Type(() => VoucherDetailDto)
    @IsOptional()
    VoucherDetail?: VoucherDetailDto[];

    @ValidateNested({ each: true })
    @Type(() => VoucherMatchingHeaderDto)
    @IsOptional()
    voucherMatchingHeader?: VoucherMatchingHeaderDto[];

    @ValidateNested({ each: true })
    @Type(() => VoucherMatchingDto)
    @IsOptional()
    voucherMatchings?: VoucherMatchingDto[];
}

export class VoucherDetailDto {
    @IsDefined() @IsNumber()
    CompanyMasterSid: number;

    @IsDefined() @IsNumber()
    BranchMasterSid: number;

    @IsDefined() @IsNumber()
    VoucherHeaderSid: number;

    @IsDefined()
    Sno: number;

    @IsOptional() @IsNumber()
    ChargeMasterSid?: number;

    @IsOptional() @IsString()
    ChargeDescription?: string;

    @IsOptional() @IsNumber()
    LedgerMasterSid?: number;

    @IsOptional() @IsNumber()
    COAMasterSid?: number;

    @IsOptional() @IsNumber()
    HSSACMasterSid?: number;

    @IsOptional() @IsNumber()
    DepartmentMasterSid?: number;

    @IsOptional() @IsNumber()
    HouseJobSid?: number;

    @IsOptional() @IsNumber()
    MasterJobSid?: number;

    @IsOptional() @IsString()
    CostRevenue?: string;

    @IsDefined() @IsNumber()
    CurrencyMasterSid: number;

    @IsDefined() @IsString()
    CurrencyCode: string;

    @IsDefined()
    ExchangeRate: number;

    @IsDefined()
    Rate: number;

    @IsOptional()
    NumberOfUnit?: number;

    @IsOptional() @IsString()
    Narration?: string;

    @IsOptional() @IsString()
    DrCr?: string;

    @IsDefined()
    TaxableAmount: number;

    @IsOptional()
    TaxPercentage1?: number;

    @IsOptional()
    TaxAmount1?: number;

    @IsOptional()
    TaxPercentage2?: number;

    @IsOptional()
    TaxAmount2?: number;

    @IsDefined()
    Amount: number;

    @IsDefined()
    LocalAmount: number;

    @IsOptional() @IsString()
    InvoiceType?: string;

    @IsOptional() @IsNumber()
    CostCenter?: number;

    @IsOptional() @IsNumber()
    ProfitCenter?: number;

    @IsOptional() @IsString()
    Remarks?: string;

    @IsOptional() @IsNumber()
    ChargeUOMSid?: number;

    @IsOptional() @IsNumber()
    YearMasterSid?: number;

    @IsOptional()
    PartyAmount?: number;

    @IsOptional() @IsNumber()
    VoucherTransactionSid?: number;
}


export class VoucherMatchingHeaderDto {
    @IsDefined() @IsNumber()
    CompanyMasterSid: number;

    @IsDefined() @IsNumber()
    BranchMasterSid: number;

    @IsOptional() @IsNumber()
    VoucherHeaderSid?: number;

    @IsDefined() @IsString()
    VoucherMatchingNo: string;

    @IsDefined() @IsDateString()
    VoucherMatchingDate: Date;

    @IsOptional() @IsString()
    Narration?: string;

    @IsOptional() @IsString()
    Remarks?: string;

    /** Nested Matching Records */
    @ValidateNested({ each: true })
    @Type(() => VoucherMatchingDto)
    @IsOptional()
    voucherMatchings?: VoucherMatchingDto[];
}

export class VoucherMatchingDto {
    @IsDefined() @IsNumber()
    CompanyMasterSid: number;

    @IsDefined() @IsNumber()
    BranchMasterSid: number;

    @IsDefined() @IsNumber()
    VoucherMatchingHeaderSid: number;

    @IsDefined() @IsNumber()
    VoucherHeaderSid: number;

    @IsDefined() @IsNumber()
    VoucherDetailSid: number;

    @IsDefined() @IsNumber()
    VoucherTransactionSid: number;

    @IsOptional() @IsNumber()
    MatchingTransactionSid?: number;

    @IsDefined() @IsDateString()
    VoucherMatchingDate: Date;

    @IsDefined() @IsNumber()
    VoucherType: number;

    @IsDefined()
    Sno: number;

    @IsOptional() @IsNumber()
    COAMasterSid?: number;

    @IsOptional() @IsNumber()
    LedgerMasterSid?: number;

    @IsDefined() @IsString()
    CurrencyCode: string;

    @IsDefined()
    ExchangeRate: number;

    @IsDefined() @IsString()
    DrCr: string;

    @IsDefined()
    Amount: number;

    @IsDefined()
    LocalAmount: number;

    @IsDefined() @IsString()
    MatchingType: string;
}

export class VoucherRelatedPayload extends VoucherHeaderDto {
    @IsNotEmpty({message : 'userEmail is required'}) @IsString()
    userEmail : string;

    @IsNotEmpty({message : 'YearMasterSid is required'}) 
    @IsNumber()
    YearMasterSid : number;
}
