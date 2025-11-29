import { PartialType } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsNumber,
} from 'class-validator';

export class CreateCustomsDto {
  @IsNotEmpty() CompanyMasterSid: number;
  @IsOptional() @IsNumber() HouseJobSid?: number;
  @IsOptional() @IsNumber() MasterJobSid?: number;

  @IsString() LineCode: string;
  @IsString() VoyageAgentCode: string;
  @IsString() RotationNumber: string;
  @IsString() ManifestSequence: string;
  @IsString() CargoCode: string;

  @IsOptional() StorageRequest?: string;
  @IsString() PackageTypeCode: string;

  @IsOptional() @IsNumber() FreightTonne?: number;
  @IsOptional() @IsNumber() NoOfPallets?: number;

  @IsOptional() SLACIndicator?: string;
  @IsString() ImporterCode: string;

  @IsNumber() SerialNumber: number;
  @IsOptional() UsedOrNew?: string;

  @IsString() UNHSCode: string;
  @IsOptional() UNNumber?: string;

  @IsOptional() FlashPoints?: number;
  @IsOptional() TemperatureUnit?: string;

  @IsOptional() HazStorageRequest?: string;
  @IsOptional() RefrigerationRequired?: string;

  @IsOptional() MinTemperature?: number;
  @IsOptional() MaxTemperature?: number;
  @IsOptional() RefTemperatureUnit?: string;

  @IsNotEmpty() CreatedBy: string;
}

export class UpdateCustomsDto extends PartialType(CreateCustomsDto) {
  @IsOptional() UpdatedBy?: string;
}
