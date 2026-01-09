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
    Length,
    IsInt,
    IsArray,
    IsIn,
    IsDate,
} from 'class-validator';



export class VoucherHeaderDto {

    @IsNotEmpty({message : 'createdBy is required'})
    @IsString()
    @Length(1,100)
    CreatedBy : string;

    @IsOptional()
    @Length(0,100)
    UpdatedBy : string;

    @IsOptional()
    @Length(0,1)
    Status : string;

    @IsNotEmpty({ message: 'CompanyMasterSid is required' })
    @IsNumber()
    CompanyMasterSid: number;

    @IsNotEmpty({ message: 'BranchMasterSid is required' })
    @IsNumber()
    BranchMasterSid: number;

    @IsOptional()
    @IsString()
    @Length(0, 20)
    VoucherNumber: string;

    @IsOptional()
    @IsNumber()
    VoucherType: number;

    @IsOptional()
    @IsDateString()
    VoucherDate: Date;

    @IsOptional()
    @IsDateString()
    PostDate: Date;

    @IsNotEmpty({ message: 'Narration is required' })
    @IsString()
    @Length(0, 300)
    Narration: string;

    @IsDefined({ message: 'PartyMasterSid is required' })
    @IsNumber()
    PartyMasterSid: number;

    @IsNotEmpty({ message: 'PartyName is required' })
    @IsString()
    @Length(0, 100)
    PartyName: string;

    @IsOptional()
    @IsString()
    @Length(0, 100)
    PartyAddress?: string;

    @IsOptional()
    @IsNumber()
    CustomerBranchSid?: number;

    @IsOptional() 
    @IsString() 
    @Length(0, 50)
    PlaceOfSupply?: string;

    @IsOptional() 
    @IsString()
    @Length(0, 50)
    State?: string;

    @IsNotEmpty({ message: 'COAMasterSid is required' })
    @IsNumber()
    COAMasterSid: number;

    @IsOptional() 
    @IsNumber() 
    BankCOA?: number;

    @IsOptional() 
    @IsString() 
    @Length(0, 100)
    BankPartyName?: string;

    
    @IsOptional() 
    @IsString() 
    @Length(0, 20)
    GST_VAT?: string;

    @IsOptional() 
    @IsString()
    @Length(0, 10)
    InvoiceType?: string;
    
    @IsOptional() 
    @IsNumber() 
    ReversalVoucher?: number;

    @IsOptional() 
    @IsNumber() 
    TaxNumber?: number;

    @IsOptional() 
    @IsString() 
    GSTType?: string;

    @IsOptional() 
    @IsString() 
    Remarks?: string;

    @IsOptional() 
    @IsNumber() 
    DepartmentMasterSid?: number;

    @IsOptional() 
    @IsString() 
    @Length(0, 20)
    HouseNumber?: string;

    @IsOptional() 
    @IsString() 
    @Length(0, 20)
    MasterNumber?: string;

    @IsOptional() 
    @IsNumber() 
    HouseJobSid?: number;

    @IsOptional() 
    @IsNumber() 
    MasterJobSid?: number;

    @IsOptional() 
    @IsNumber() 
    CurrencyMasterSid?: number;

    @IsOptional() 
    @IsString() 
    @Length(0, 3)
    CurrencyCode?: string;

    @IsOptional() 
    @IsNumber()
    ExchangeRate?: number;

    @IsOptional() 
    @IsNumber()
    Amount?: number;

    @IsOptional() 
    @IsNumber()
    LocalAmount?: number;

    @IsOptional() 
    @IsNumber()
    NetAmount?: number;

    @IsOptional() 
    @IsString() 
    @Length(0, 30)
    DocumentNumber?: string;

    @IsOptional() 
    @IsDateString() 
    DocumentDate?: Date;

    @IsOptional() 
    @IsString()
    @Length(0, 15)
    SetoffStatus?: string;

    @IsOptional() 
    @IsString() 
    @Length(0, 3)
    TaxType?: string;

    @IsOptional() 
    @IsString() 
    @Length(0, 10)
    InstrumentMode?: string;

    @IsOptional() 
    @IsString() 
    @Length(0, 25)
    InstrumentNumber?: string;

    @IsOptional() 
    @IsDateString() 
    InstrumentDate?: Date;

    @IsOptional()
    @IsDateString()
    ClearanceDate?: Date;

    @IsOptional()
    @IsString()
    @Length(0, 100)
    CreditNoteReason?: string;

    @IsOptional()
    @IsNumber()
    VoucherTypeMasterSid: number;

    @IsOptional()
    @IsNumber()
    VoucherHeaderSid ?: number;

    @IsOptional()
    @IsString()
    @Length(0, 1)
    PostStatus?: string;

    @IsOptional()
    @IsString()
    @Length(0, 1)
    CashOrBank?: string;

    @IsOptional()
    @IsString()
    @Length(0, 1)
    MultiBranch?: string;

    @IsOptional()
    @IsInt()
    BookingHeaderSid : number;


    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => VoucherDetailDto)
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

    @IsOptional()
    @IsNumber()
    VoucherDetailSid ?: number;

    @IsOptional()
    @IsString()
    @Length(0, 100)
    CreatedBy ?: string;

    @IsOptional()
    @IsString()
    @Length(0, 100)
    UpdatedBy ?: string;

    @IsOptional()
    @IsString()
    @Length(0, 1)
    Status ?: string;

    @IsOptional() 
    @IsNumber()
    CompanyMasterSid: number;

    @IsOptional() 
    @IsNumber()
    BranchMasterSid: number;

    @IsOptional() 
    @IsNumber()
    VoucherHeaderSid: number;

    @IsNotEmpty({ message: 'Sno is required' })
    @IsNumber()
    Sno: number;

    @IsOptional() 
    @IsNumber()
    ChargeMasterSid?: number;

    @IsOptional() 
    @IsString()
    @Length(0, 100)
    ChargeDescription?: string;

    @IsOptional() 
    @IsNumber()
    LedgerMasterSid?: number;

    @IsOptional() 
    @IsNumber()
    COAMasterSid: number;

    @IsOptional() 
    @IsNumber()
    HSSACMasterSid?: number;

    @IsOptional() 
    @IsNumber()
    DepartmentMasterSid?: number;

    @IsOptional() 
    @IsNumber()
    HouseJobSid?: number;

    @IsOptional() 
    @IsNumber()
    MasterJobSid?: number;

    @IsOptional() 
    @IsString()
    CostRevenue?: string;

    @IsNotEmpty({ message: 'CurrencyMasterSid is required' })
    @IsNumber()
    CurrencyMasterSid: number;

    @IsNotEmpty({ message: 'CurrencyCode is required' })
    @IsString()
    @Length(1, 3)
    CurrencyCode: string;

    @IsNotEmpty({ message: 'ExchangeRate is required' })
    @IsNumber()
    ExchangeRate: number;

    @IsNotEmpty({ message: 'Rate is required' })
    @IsNumber()
    Rate: number;

    @IsOptional()
    @IsNumber()
    NumberOfUnit?: number;

    @IsOptional() 
    @IsString()
    @Length(0, 200)
    Narration?: string;

    @IsOptional() 
    @IsString()
    @Length(0, 50)
    DrCr?: string;

    @IsNotEmpty({ message: 'TaxableAmount is required' })
    @IsNumber()
    TaxableAmount: number;

    @IsOptional()
    @IsNumber()
    TaxPercentage1?: number;

    @IsOptional()
    @IsNumber()
    TaxAmount1?: number;

    @IsOptional()
    @IsNumber()
    TaxPercentage2?: number;

    @IsOptional()
    @IsNumber()
    TaxAmount2?: number;

    @IsNotEmpty({ message: 'Amount is required' })
    @IsNumber()
    Amount: number;

    @IsNotEmpty({ message: 'LocalAmount is required' })
    @IsNumber()
    LocalAmount: number;

    @IsOptional() 
    @IsString()
    @Length(0, 10)
    InvoiceType?: string;

    @IsOptional() 
    @IsNumber()
    CostCenter?: number;

    @IsOptional() 
    @IsNumber()
    ProfitCenter?: number;

    @IsOptional() 
    @IsString()
    Remarks?: string;

    @IsOptional() 
    @IsNumber()
    ChargeUOMSid?: number;

    @IsOptional() 
    @IsNumber()
    YearMasterSid?: number;

    @IsOptional()
    @IsNumber()
    PartyAmount?: number;

    @IsOptional() 
    @IsNumber()
    VoucherTransactionSid?: number;

    @IsOptional()
    @IsString()
    @Length(0, 1)
    IsAutoGenerated?: string;

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

export class TaxDetailForPostingDTO {
  @IsNotEmpty({ message: 'Country Master Sid is required' })
  @IsInt()
  CountryMasterSid: number;

  @IsNotEmpty({ message: 'Country Code is required' })
  @IsString()
  @Length(2, 2)
  countryCode: string;

  @IsNotEmpty({ message: 'Tax Category is required' })
  @IsIn(['Intra', 'Inter'])
  TaxCategory: 'Intra' | 'Inter';

  @IsNotEmpty({ message: 'Effective From is required' })
  @IsDateString()
  EffectiveFrom: Date;

  @IsNotEmpty({ message: 'Tax Type is required' })
  @IsIn(['Input', 'Output'])
  TaxType: 'Input' | 'Output';
}

export class CreateVoucherPayload extends VoucherHeaderDto {
    @IsNotEmpty({ message: 'Voucher Type Menu Name is required' })
    @IsString()
    VoucherTypeMenuName: string;       // eg. Invoice, Vendor Invoice 

    @IsOptional()
    @IsNumber()
    YearMasterSid: number;

    @IsOptional()
    @IsNumber()
    LocalCurrencyMasterSid: number;

    @IsOptional()
    @IsString()
    @Length(3, 3)
    LocalCurrencyCode: string;

    @IsOptional()
    @ValidateNested()
    @Type(() => TaxDetailForPostingDTO)
    taxDetails : TaxDetailForPostingDTO;

    @IsNotEmpty({ message: 'Need to provide rate ids involved in the voucher' })
    @IsArray({ message: 'selectedRateIds must be an array' })
    @IsNumber({}, { each: true, message: 'Each rate id must be a number' })
    @Type(() => Number)
    selectedRateIds: number[];

    @IsNotEmpty({ message: 'screenName is required' })
    @IsString()
    @IsIn(['Booking', 'House Job', 'Master Job', 'Master Air Waybill', 'House Air Waybill', 'Service Job'], { message: 'screenName must be Booking, House Job, or Master Job' })
    screenName: string;


}

export class CreateVoucherDTO extends VoucherHeaderDto {
    @IsNotEmpty({message : 'Voucher Type Name is required'})
    @IsString()
    VoucherTypeName : string;       // eg. Invoice, Vendor Invoice

    @IsOptional()
    @IsNumber()
    YearMasterSid : number;
}

export class CheckAutoPostingDto {
    @IsNotEmpty({message : 'MenuName is required'})
    @IsString()
    MenuName : string;

    @IsNotEmpty({message : 'Company Master SID is required'})
    @IsInt()
    CompanyMasterSid : number;

    @IsNotEmpty({message : 'Branch Master SID is required'})
    @IsInt()
    BranchMasterSid : number;  
}