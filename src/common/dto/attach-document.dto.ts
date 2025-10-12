import { ApiProperty, PartialType } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, IsDateString, MaxLength, IsIn } from 'class-validator';

export class CreateAttachDocumentDto {
  @ApiProperty({ })
  @IsInt()
  CompanyMasterSid: number;

  @ApiProperty({ })
  @IsInt()
  BranchMasterSid: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsInt()
  DocumentSid?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsInt()
  MenuMasterSid?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  menuName?: string;

  @ApiProperty()
  @IsString()
  @MaxLength(20)
  AttachDocmentNo: string;

  @ApiProperty({ })
  @IsDateString()
  DocumentDate: Date;

  @ApiProperty({ })
  @IsString()
  @MaxLength(30)
  FileName: string;

  @ApiProperty({ })
  @IsString()
  @MaxLength(20)
  Documenttype: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsDateString()
  ReceivedDate?: Date;

  @ApiProperty({  required: false })
  @IsOptional()
  @IsDateString()
  SentDate?: Date;

  @ApiProperty({  required: false })
  @IsOptional()
  @IsIn(['Y', 'N'])
  FollowupRequire?: string;

  @ApiProperty({  required: false })
  @IsOptional()
  @IsDateString()
  FollowupDate?: Date;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsIn(['Y', 'N'])
  Public?: string;

  @ApiProperty({ })
  @IsString()
  @MaxLength(100)
  createdBy: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  updatedBy?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(1)
  status?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  Remarks?: string;
}

export class UpdateAttachDocumentDto extends PartialType(CreateAttachDocumentDto) {}
