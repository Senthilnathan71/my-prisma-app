import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';

export enum PublicApprovalDecision {
  Approved = 'Approved',
  Rejected = 'Rejected',
}

export class CarrierDecisionDto {
  @IsInt()
  QuoteCarrierSid!: number;

  @IsEnum(PublicApprovalDecision)
  ApprovalStatus!: PublicApprovalDecision;

  @IsString()
  @MinLength(1)
  @MaxLength(20)
  ApprovedBy!: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  Remarks?: string;
}

export class SubmitDecisionsDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayUnique((d: CarrierDecisionDto) => d.QuoteCarrierSid)
  @ValidateNested({ each: true })
  @Type(() => CarrierDecisionDto)
  decisions!: CarrierDecisionDto[];
}
