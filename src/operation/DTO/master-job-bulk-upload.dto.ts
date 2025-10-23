import { Type } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  IsNumber,
  IsNotEmpty,
  IsDate,
  ValidateNested,
  IsArray,
  IsIn,
  MinLength,
  MaxLength,
  Min
} from 'class-validator';

// Master Job DTOs
export class MasterJobVoyageBulkDto {
  @IsOptional()
  @IsInt()
  VoyageMasterSid?: number;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  VesselName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  VoyageNo?: string;

  @IsOptional()
  @IsDate()
  @Type(() => Date)
  ETD?: Date;

  @IsOptional()
  @IsDate()
  @Type(() => Date)
  ETA?: Date;

  @IsOptional()
  @IsDate()
  @Type(() => Date)
  ATA?: Date;

  @IsOptional()
  @IsDate()
  @Type(() => Date)
  ATD?: Date;

  @IsOptional()
  @IsDate()
  @Type(() => Date)
  DestinationATA?: Date;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  CarrierName?: string;

  @IsOptional()
  @IsInt()
  CarrierSid?: number;
}

export class MasterJobContainerBulkDto {
  @IsNotEmpty()
  @IsInt()
  ContainerType: number;

  @IsNotEmpty()
  @IsString()
  @MaxLength(11)
  ContainerNumber: string;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  LineSeal?: string;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  CustomsSeal?: string;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  HsCode?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  CommodityDescription?: string;

  @IsOptional()
  @IsInt()
  PkgType?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  NoOfPkg?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  GrossWeight?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  NetWeight?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  ChargeableWeight?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  Volume?: number;

  @IsOptional()
  @IsString()
  @IsIn(['Y', 'N'])
  IsSoc?: string;
}

export class MasterJobConnectionBulkDto {
  @IsOptional()
  @IsString()
  @MaxLength(10)
  Mode?: string;

  @IsNotEmpty()
  @IsString()
  @MaxLength(100)
  POL: string;

  @IsNotEmpty()
  @IsString()
  @MaxLength(100)
  POD: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  VesselName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  VoyageNo?: string;

  @IsOptional()
  @IsDate()
  @Type(() => Date)
  ETD?: Date;

  @IsOptional()
  @IsDate()
  @Type(() => Date)
  ETA?: Date;

  @IsOptional()
  @IsDate()
  @Type(() => Date)
  ATD?: Date;

  @IsOptional()
  @IsDate()
  @Type(() => Date)
  ATA?: Date;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  Remarks?: string;
}

export class MasterJobOthersBulkDto {
  @IsOptional()
  @IsInt()
  Yard?: number;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  YardAddress?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  Transporter?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  HandlingInformation?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  InternalNote?: string;

  @IsOptional()
  @IsInt()
  CFS?: number;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  CFSAddress?: string;

  @IsOptional()
  @IsDate()
  @Type(() => Date)
  StuffingStartDate?: Date;

  @IsOptional()
  @IsDate()
  @Type(() => Date)
  StuffingEndDate?: Date;

  @IsOptional()
  @IsString()
  @MaxLength(3)
  CurrencyCode?: string;

  @IsOptional()
  @IsInt()
  SellExchangeRate?: number;

  @IsOptional()
  @IsInt()
  AgentExchangeRate?: number;

  @IsOptional()
  @IsString()
  @IsIn(['Y', 'N'])
  Coload?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  CoLoader?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  ExportDoNo?: string;
}

export class MasterJobBulkUploadDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  MasterJobNumber?: string;

  @IsOptional()
  @IsDate()
  @Type(() => Date)
  MasterJobDate?: Date;

  @IsNotEmpty()
  @IsInt()
  CompanyMasterSid: number;

  @IsNotEmpty()
  @IsInt()
  BranchMasterSid: number;

  @IsNotEmpty()
  @IsInt()
  DepartmentMasterSid: number;

  @IsNotEmpty()
  @IsString()
  @MaxLength(10)
  FreightPPCC: string;

  @IsOptional()
  @IsInt()
  DestinationAgent?: number;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  DestinationAgentName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  DestinationAgentAddress?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  MBLNo?: string;

  @IsOptional()
  @IsDate()
  @Type(() => Date)
  MBLDate?: Date;

  @IsOptional()
  @IsString()
  @MaxLength(15)
  BLReleaseType?: string;

  @IsOptional()
  @IsInt()
  NoofOriginal?: number;

  @IsOptional()
  @IsInt()
  OriginAgent?: number;

  @IsNotEmpty()
  @IsString()
  @MaxLength(100)
  POO: string;

  @IsNotEmpty()
  @IsString()
  @MaxLength(100)
  POL: string;

  @IsNotEmpty()
  @IsString()
  @MaxLength(100)
  POD: string;

  @IsNotEmpty()
  @IsString()
  @MaxLength(100)
  FPD: string;

  @IsOptional()
  @IsInt()
  TsPortSid?: number;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  POLTerminal?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  PODTerminal?: string;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  MovementType?: string;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  ShipmentTerms?: string;

  @IsOptional()
  @IsInt()
  PkgType?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  NoOfPkg?: number;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  WeightIn?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  GrossWeight?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  NetWeight?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  ChargeableWeight?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  Volume?: number;

  @IsOptional()
  @IsString()
  @IsIn(['Y', 'N'])
  Haz?: string;

  @IsOptional()
  @IsDate()
  @Type(() => Date)
  DGBookingDate?: Date;

  @IsOptional()
  @IsDate()
  @Type(() => Date)
  DGApprovedDate?: Date;

  @IsOptional()
  @IsString()
  @MaxLength(3000)
  CommodityDescription?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  MarksandNumber?: string;

  @IsNotEmpty()
  @IsString()
  @MaxLength(100)
  CreatedBy: string;

  @IsOptional()
  @IsInt()
  MenuMasterSid?: number;

  // Related entities
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MasterJobVoyageBulkDto)
  voyages?: MasterJobVoyageBulkDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MasterJobContainerBulkDto)
  containers?: MasterJobContainerBulkDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MasterJobConnectionBulkDto)
  connections?: MasterJobConnectionBulkDto[];

  @IsOptional()
  @ValidateNested()
  @Type(() => MasterJobOthersBulkDto)
  others?: MasterJobOthersBulkDto;
}

// House Job DTOs
export class HouseJobCargoBulkDto {
  @IsNotEmpty()
  @IsString()
  @MaxLength(50)
  CargoType: string;

  @IsOptional()
  @IsInt()
  ContainerType?: number;

  @IsNotEmpty()
  @IsNumber()
  @Min(0)
  GrossWeight: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  NetWeight?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  Volume?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  ChargeableWeight?: number;

  @IsOptional()
  @IsInt()
  PackageType?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  NoOfPackage?: number;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  FreightAmount?: string;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  ShipmentTerms?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  FreightTerms?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  ModeOfTransport?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  MovementType?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  NoofContainers?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  Qty?: number;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  StuffingAt?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  CommodityDescription?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  MarksAndNumber?: string;
}

export class HouseJobProductBulkDto {
  @IsNotEmpty()
  @IsString()
  @MaxLength(100)
  ProductName: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  ProductDescription?: string;

  @IsNotEmpty()
  @IsString()
  @MaxLength(100)
  ShippingBillNo: string;

  @IsOptional()
  @IsDate()
  @Type(() => Date)
  ShippingBillDate?: Date;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  ExternaPkg?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  ExternlQty?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  InternalPkg?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  InternalQty?: string;

  @IsNotEmpty()
  @IsNumber()
  @Min(0)
  GrossWeight: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  NetWeight?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  Volume?: number;

  @IsOptional()
  @IsInt()
  Height?: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  ImcoClass?: string;

  @IsOptional()
  @IsString()
  @IsIn(['Y', 'N'])
  IsHaz?: string;

  @IsOptional()
  @IsInt()
  Length?: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  PkgGroup?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  UnNo?: string;

  @IsOptional()
  @IsInt()
  Width?: number;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  MarksAndNumber?: string;

  @IsOptional()
  @IsString()
  @MaxLength(11)
  ContainerNo?: string;
}

export class HouseJobConnectionBulkDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  Mode?: string;

  @IsNotEmpty()
  @IsString()
  @MaxLength(100)
  POL: string;

  @IsNotEmpty()
  @IsString()
  @MaxLength(100)
  POD: string;

  @IsNotEmpty()
  @IsString()
  @MaxLength(100)
  VesselName: string;

  @IsNotEmpty()
  @IsString()
  @MaxLength(10)
  VoyageNo: string;

  @IsOptional()
  @IsDate()
  @Type(() => Date)
  ETD?: Date;

  @IsOptional()
  @IsDate()
  @Type(() => Date)
  ETA?: Date;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  Remarks?: string;
}

export class HouseJobOthersBulkDto {
  @IsNotEmpty()
  @IsString()
  @MaxLength(20)
  CustomerRefNo: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  OperationUser?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  DocumentationUser?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  CustomerServiceuser?: string;

  @IsNotEmpty()
  @IsString()
  @MaxLength(100)
  NotifyParty: string;

  @IsNotEmpty()
  @IsString()
  @MaxLength(200)
  NotifyPartyAddress: string;

  @IsNotEmpty()
  @IsString()
  @MaxLength(100)
  CHAName: string;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  PickupMode?: string;

  @IsNotEmpty()
  @IsString()
  @MaxLength(100)
  YardCFS: string;

  @IsOptional()
  @IsString()
  @IsIn(['Y', 'N'])
  LocalTransport?: string;

  @IsOptional()
  @IsString()
  @IsIn(['Y', 'N'])
  OverseasTransport?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  OverseasClearance?: string;

  @IsNotEmpty()
  @IsString()
  @MaxLength(100)
  PickupPlace: string;

  @IsOptional()
  @IsDate()
  @Type(() => Date)
  PickupDate?: Date;

  @IsNotEmpty()
  @IsString()
  @MaxLength(200)
  PickupAddress: string;

  @IsNotEmpty()
  @IsString()
  @MaxLength(100)
  DeliveryPlace: string;

  @IsNotEmpty()
  @IsString()
  @MaxLength(100)
  DeliveryDate: string;

  @IsNotEmpty()
  @IsString()
  @MaxLength(200)
  DeliveryAddress: string;

  @IsNotEmpty()
  @IsString()
  @MaxLength(3)
  CargoCurrency: string;

  @IsNotEmpty()
  @IsNumber()
  @Min(0)
  CargoValue: number;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  DeliveryMode?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  ExternalRemarks?: string;

  @IsOptional()
  @IsString()
  @IsIn(['Y', 'N'])
  SwitchBL?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  TransporterName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  Forwarder?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  ForwarderAddress?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  Coloader?: string;
}

export class HouseJobBulkUploadDto {
  @IsNotEmpty()
  @IsInt()
  CompanyMasterSid: number;

  @IsNotEmpty()
  @IsInt()
  BranchMasterSid: number;

  @IsNotEmpty()
  @IsInt()
  DepartmentMasterSid: number;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  ShipmentNo?: string;

  @IsNotEmpty()
  @IsString()
  @MaxLength(50)
  BookingNo: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  HBLNo?: string;

  @IsNotEmpty()
  @IsInt()
  CustomerMasterSid: number;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  CustomerName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  CustomerAddress?: string;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  IncoTerms?: string;

  @IsOptional()
  @IsInt()
  DestinationAgent?: number;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  AgentName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  AgentAddress?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  ShipperName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  ShipperAddress?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  ConsigneeName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  ConsigneeAddress?: string;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  ShipmentType?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  NominatedBy?: string;

  @IsNotEmpty()
  @IsString()
  @MaxLength(100)
  POL: string;

  @IsNotEmpty()
  @IsString()
  @MaxLength(100)
  POD: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  FPD?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  POO?: string;

  @IsOptional()
  @IsDate()
  @Type(() => Date)
  ETD?: Date;

  @IsOptional()
  @IsDate()
  @Type(() => Date)
  ETA?: Date;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  MovementType?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  Notify?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  NotifyAddress?: string;

  @IsNotEmpty()
  @IsString()
  @MaxLength(100)
  CreatedBy: string;

  // Related entities
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => HouseJobCargoBulkDto)
  cargo?: HouseJobCargoBulkDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => HouseJobProductBulkDto)
  products?: HouseJobProductBulkDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => HouseJobConnectionBulkDto)
  connections?: HouseJobConnectionBulkDto[];

  @IsOptional()
  @ValidateNested()
  @Type(() => HouseJobOthersBulkDto)
  others?: HouseJobOthersBulkDto;
}

export class BulkUploadRequestDto {
  @IsNotEmpty()
  @ValidateNested()
  @Type(() => MasterJobBulkUploadDto)
  masterJob: MasterJobBulkUploadDto;

  @IsNotEmpty()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => HouseJobBulkUploadDto)
  houseJobs: HouseJobBulkUploadDto[];

  @IsNotEmpty()
  @IsInt()
  CompanyMasterSid: number;

  @IsNotEmpty()
  @IsInt()
  BranchMasterSid: number;

  @IsNotEmpty()
  @IsString()
  CreatedBy: string;
}

export class BulkUploadValidationError {
  field: string;
  message: string;
  row?: number;
  sheet?: string;
}

export class BulkUploadResponseDto {
  success: boolean;
  message: string;
  errors?: BulkUploadValidationError[];
  data?: {
    masterJobSid?: number;
    houseJobSids?: number[];
    masterJobNumber?: string;
    houseJobNumbers?: string[];
  };
}
