import { IsInt, IsOptional, IsString, IsDecimal, IsNumber, IsNotEmpty, IsIn } from 'class-validator';

export class CreateBookingRateDto {
  @IsInt()
  @IsNotEmpty()
  BookingHeaderSid: number;

  @IsInt()
  @IsNotEmpty()
  CompanyMasterSid: number;

  @IsInt()
  @IsNotEmpty()
  BranchMasterSid: number;

  @IsString()
  @IsNotEmpty()
  CreatedBy: string;

  @IsOptional()
  @IsInt()
  SerialNumber?: number;

  @IsInt()
  @IsNotEmpty()
  ChargeMasterSid: number;

  @IsString()
  @IsNotEmpty()
  ChargeDescription: string;

  @IsOptional()
  @IsInt()
  ChargeUomSid?: number;

  @IsOptional()
  @IsInt()
  NoOfUnit?: number;

  @IsOptional()
  @IsInt()
  QuoteChargeSid?: number;

  @IsOptional()
  @IsInt()
  TariffDetailSid?: number;

  // Cost Section
  @IsOptional()
  @IsString()
  @IsIn(['Prepaid', 'Collect'])
  CostPrepaidCollect?: string;

  @IsOptional()
  @IsInt()
  CostCurrencyMasterSid?: number;

  @IsOptional()
  @IsNumber()
  CostExchangeRate?: number;

  @IsOptional()
  @IsNumber()
  CostRate?: number;

  @IsOptional()
  @IsNumber()
  CostNumberOfUnit?: number;

  @IsString()
  @IsNotEmpty()
  @IsIn(['D', 'C'])
  CostDrCr: string;

  @IsNumber()
  @IsNotEmpty()
  CostAmount: number;

  @IsNumber()
  @IsNotEmpty()
  CostLocalAmount: number;

  @IsOptional()
  @IsInt()
  CostChargeUomSid?: number;

  // Revenue Section
  @IsOptional()
  @IsString()
  RevenuePrepaidCollect?: string;

  @IsOptional()
  @IsInt()
  RevenueCurrencyMasterSid?: number;

  @IsOptional()
  @IsNumber()
  RevenueExchangeRate?: number;

  @IsOptional()
  @IsNumber()
  RevenueRate?: number;

  @IsOptional()
  @IsNumber()
  RevenueNumberOfUnit?: number;

  @IsString()
  @IsNotEmpty()
  @IsIn(['D', 'C'])
  RevenueDrCr: string;

  @IsNumber()
  @IsNotEmpty()
  RevenueAmount: number;

  @IsNumber()
  @IsNotEmpty()
  RevenueLocalAmount: number;

  @IsOptional()
  @IsString()
  PrepaidCollect?: string;

  @IsOptional()
  @IsInt()
  AgentMasterSid?: number;

  @IsOptional()
  @IsInt()
  AgentBranchSid?: number;

  @IsInt()
  @IsNotEmpty()
  CustomerMasterSid: number;

  @IsInt()
  @IsNotEmpty()
  CustomerBranchSid: number;

  @IsOptional()
  @IsInt()
  RevenueChargeUomSid?: number;

  @IsOptional()
  @IsString()
  Remarks?: string;
}

export class UpdateBookingRateDto {
  @IsOptional()
  @IsString()
  UpdatedBy?: string;

  @IsOptional()
  @IsInt()
  SerialNumber?: number;

  @IsOptional()
  @IsInt()
  ChargeMasterSid?: number;

  @IsOptional()
  @IsString()
  ChargeDescription?: string;

  @IsOptional()
  @IsInt()
  ChargeUomSid?: number;

  @IsOptional()
  @IsInt()
  NoOfUnit?: number;

  // Cost Section
  @IsOptional()
  @IsString()
  CostPrepaidCollect?: string;

  @IsOptional()
  @IsInt()
  CostCurrencyMasterSid?: number;

  @IsOptional()
  @IsNumber()
  CostExchangeRate?: number;

  @IsOptional()
  @IsNumber()
  CostRate?: number;

  @IsOptional()
  @IsNumber()
  CostNumberOfUnit?: number;

  @IsOptional()
  @IsString()
  CostDrCr?: string;

  @IsOptional()
  @IsNumber()
  CostAmount?: number;

  @IsOptional()
  @IsNumber()
  CostLocalAmount?: number;

  @IsOptional()
  @IsInt()
  CostChargeUomSid?: number;

  // Revenue Section
  @IsOptional()
  @IsString()
  RevenuePrepaidCollect?: string;

  @IsOptional()
  @IsInt()
  RevenueCurrencyMasterSid?: number;

  @IsOptional()
  @IsNumber()
  RevenueExchangeRate?: number;

  @IsOptional()
  @IsNumber()
  RevenueRate?: number;

  @IsOptional()
  @IsNumber()
  RevenueNumberOfUnit?: number;

  @IsOptional()
  @IsString()
  RevenueDrCr?: string;

  @IsOptional()
  @IsNumber()
  RevenueAmount?: number;

  @IsOptional()
  @IsNumber()
  RevenueLocalAmount?: number;

  @IsOptional()
  @IsString()
  PrepaidCollect?: string;

  @IsOptional()
  @IsInt()
  AgentMasterSid?: number;

  @IsOptional()
  @IsInt()
  AgentBranchSid?: number;

  @IsOptional()
  @IsInt()
  CustomerMasterSid?: number;

  @IsOptional()
  @IsInt()
  CustomerBranchSid?: number;

  @IsOptional()
  @IsInt()
  RevenueChargeUomSid?: number;

  @IsOptional()
  @IsString()
  Remarks?: string;
}
