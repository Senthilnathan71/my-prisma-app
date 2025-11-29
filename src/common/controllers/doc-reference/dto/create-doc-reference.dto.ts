import {
  IsNotEmpty,
  IsString,
  MaxLength,
  IsOptional,
  IsBoolean,
  IsDateString,
  IsIn,
  IsNumber,
  IsArray,
  ValidateNested,
  ArrayMinSize,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class DocumentReferenceItemDto {
  @ApiPropertyOptional({ description: 'ID for existing document (for updates)' })
  @IsOptional()
  @IsNumber()
  refDocumentSid?: number;

  @ApiProperty({ description: 'Document reference number', maxLength: 20 })
  @IsNotEmpty({ message: 'Document number is required' })
  @IsString()
  @MaxLength(20, { message: 'Document number cannot exceed 20 characters' })
  refDocumentNo: string;

  @ApiProperty({ description: 'Document date in ISO format' })
  @IsNotEmpty({ message: 'Document date is required' })
  @IsDateString({}, { message: 'Invalid date format' })
  documentDate: string;

  @ApiPropertyOptional({ description: 'Remarks or notes', maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500, { message: 'Remarks cannot exceed 500 characters' })
  remarks?: string;

  @ApiPropertyOptional({ description: 'Whether document is public' })
  @IsOptional()
  @IsBoolean()
  isPublic?: boolean;

  @ApiProperty({ description: 'Status of the document', enum: ['ACTIVE', 'INACTIVE', 'A', 'I'] })
  @IsNotEmpty({ message: 'Status is required' })
  @IsIn(['ACTIVE', 'INACTIVE', 'A', 'I'], { message: 'Status must be ACTIVE, INACTIVE, A, or I' })
  status: string;
}

export class CreateDocReferenceDto {
  @ApiProperty({ description: 'Company Master ID' })
  @IsNotEmpty({ message: 'Company ID is required' })
  @IsNumber()
  CompanyMasterSid: number;

  @ApiProperty({ description: 'Branch Master ID' })
  @IsNotEmpty({ message: 'Branch ID is required' })
  @IsNumber()
  BranchMasterSid: number;

  @ApiPropertyOptional({ description: 'Menu Master ID' })
  @IsOptional()
  @IsNumber()
  MenuMasterSid?: number;

  @ApiPropertyOptional({ description: 'Document ID (Booking/Enquiry/Invoice)' })
  @IsOptional()
  @IsNumber()
  DocumentSid?: number;

  @ApiProperty({ description: 'User who created the document' })
  @IsNotEmpty({ message: 'Created by is required' })
  @IsString()
  createdBy: string;

  @ApiProperty({ description: 'Array of document references', type: [DocumentReferenceItemDto] })
  @IsArray()
  @ArrayMinSize(1, { message: 'At least one document reference is required' })
  @ValidateNested({ each: true })
  @Type(() => DocumentReferenceItemDto)
  documentReferences: DocumentReferenceItemDto[];
}

export class UpdateDocReferenceDto {
  @ApiPropertyOptional({ description: 'Document reference number', maxLength: 20 })
  @IsOptional()
  @IsString()
  @MaxLength(20, { message: 'Document number cannot exceed 20 characters' })
  refDocumentNo?: string;

  @ApiPropertyOptional({ description: 'Document date in ISO format' })
  @IsOptional()
  @IsDateString({}, { message: 'Invalid date format' })
  documentDate?: string;

  @ApiPropertyOptional({ description: 'Remarks or notes', maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500, { message: 'Remarks cannot exceed 500 characters' })
  remarks?: string;

  @ApiPropertyOptional({ description: 'Whether document is public' })
  @IsOptional()
  @IsBoolean()
  isPublic?: boolean;

  @ApiPropertyOptional({ description: 'Status of the document', enum: ['ACTIVE', 'INACTIVE', 'A', 'I'] })
  @IsOptional()
  @IsIn(['ACTIVE', 'INACTIVE', 'A', 'I'], { message: 'Status must be ACTIVE, INACTIVE, A, or I' })
  status?: string;

  @ApiPropertyOptional({ description: 'User who updated the document' })
  @IsOptional()
  @IsString()
  updatedBy?: string;
}
