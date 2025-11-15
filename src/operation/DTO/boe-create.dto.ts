import { PartialType } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsNumber, IsString, IsDateString } from 'class-validator';

export class CreateBoeDto {
  @IsNotEmpty() CompanyMasterSid: number;
  @IsNotEmpty() HouseJobSid: number;
  @IsOptional() Sno?: number;
  @IsOptional() DeclarationNo?: string;
  @IsOptional() BOENo?: string;
  @IsOptional() @IsDateString() BOEDate?: string;
  @IsOptional() BOEValue?: number;
  @IsOptional() BOEInvoiceValue?: number;
  @IsOptional() TransactionType?: string;
  @IsOptional() Amount?: number;
  @IsOptional() @IsDateString() ProcessDate?: string;
  @IsOptional() @IsDateString() ReceivedDate?: string;
  @IsOptional() AckNumber?: string;
  @IsOptional() @IsDateString() AckDate?: string;
  @IsOptional() AckStatus?: string;
  @IsOptional() Remarks?: string;
  @IsNotEmpty() CreatedBy: string;
}



export class UpdateBoeDto extends PartialType(CreateBoeDto) {
  @IsOptional() UpdatedBy?: string;
}