import { PartialType } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsNumber,
  MaxLength,
} from 'class-validator';

export class CreateCustomsDto {
  @IsNotEmpty() CompanyMasterSid: number;
  @IsOptional() @IsNumber() HouseJobSid?: number;
  @IsOptional() @IsNumber() MasterJobSid?: number;

  @IsString() @MaxLength(6) LineCode: string;
  @IsString() @MaxLength(6) VoyageAgentCode: string;
  @IsString() @MaxLength(6) RotationNumber: string;
  @IsString() @MaxLength(5) ManifestSequence: string;
  @IsString() @MaxLength(1) CargoCode: string;

  @IsOptional() @MaxLength(1) StorageRequest?: string;
  @IsString() @MaxLength(3) PackageTypeCode: string;

  @IsOptional() @IsNumber() FreightTonne?: number;
  @IsOptional() @IsNumber() NoOfPallets?: number;

  @IsOptional() @MaxLength(1) SLACIndicator?: string;
  @IsString() @MaxLength(5) ImporterCode: string;

  @IsNumber() SerialNumber: number;
  @IsOptional() @MaxLength(1) UsedOrNew?: string;

  @IsString() @MaxLength(10) UNHSCode: string;
  @IsOptional() @MaxLength(5) UNNumber?: string;

  @IsOptional() FlashPoints?: number;
  @IsOptional() @MaxLength(1) TemperatureUnit?: string;

  @IsOptional() @MaxLength(1) HazStorageRequest?: string;
  @IsOptional() @MaxLength(1) RefrigerationRequired?: string;

  @IsOptional() MinTemperature?: number;
  @IsOptional() MaxTemperature?: number;
  @IsOptional() @MaxLength(1) RefTemperatureUnit?: string;

  @IsNotEmpty() CreatedBy: string;
}

export class UpdateCustomsDto extends PartialType(CreateCustomsDto) {
  @IsOptional() UpdatedBy?: string;
}
