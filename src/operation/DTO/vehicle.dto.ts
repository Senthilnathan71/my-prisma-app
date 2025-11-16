import { PartialType } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsNumber,
  IsDateString,
} from 'class-validator';

export class CreateVehicleDto {
  @IsNotEmpty() CompanyMasterSid: number;
  @IsNotEmpty() HouseJobSid: number;

  @IsOptional() @IsString() VehicleIndicator?: string; // V,E,X
  @IsOptional() @IsString() UsedNew?: string; // U,N
  @IsOptional() ChassisNo?: string;
  @IsOptional() CaseNo?: string;
  @IsOptional() Make?: string;
  @IsOptional() Model?: string;
  @IsOptional() EngineNo?: string;
  @IsOptional() YearBuilt?: string;
  @IsOptional() Color?: string;
  @IsOptional() Rolling?: string;
  @IsOptional() GoodsDescription?: string;

  @IsOptional() @IsNumber() Weight?: number;
  @IsOptional() @IsNumber() Volume?: number;

  @IsOptional() Remarks?: string;

  @IsNotEmpty() CreatedBy: string;
}

export class UpdateVehicleDto extends PartialType(CreateVehicleDto) {
  @IsOptional() UpdatedBy?: string;
}
