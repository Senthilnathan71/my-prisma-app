import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsEmail, IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';

export class SendReportEmailDto {
  @ApiProperty({ description: 'Email recipients (To)', type: [String] })
  @IsArray()
  @IsEmail({}, { each: true })
  EmailTo: string[];

  @ApiProperty({ description: 'Email CC', type: [String], required: false })
  @IsArray()
  @IsOptional()
  @IsEmail({}, { each: true })
  EmailCC?: string[];

  @ApiProperty({ description: 'Email BCC', type: [String], required: false })
  @IsArray()
  @IsOptional()
  @IsEmail({}, { each: true })
  EmailBCC?: string[];

  @ApiProperty({ description: 'Email subject' })
  @IsString()
  @IsNotEmpty()
  Subject: string;

  @ApiProperty({ description: 'Email body (HTML)' })
  @IsString()
  @IsNotEmpty()
  Mailbody: string;

  @ApiProperty({ description: 'Report type' })
  @IsString()
  @IsNotEmpty()
  ReportType: string;

  @ApiProperty({ description: 'Entity ID (MasterJobSid, etc.)' })
  @IsNumber()
  @IsNotEmpty()
  EntityId: number;
}

export class SendReportEmailResponseDto {
  @ApiProperty()
  success: boolean;

  @ApiProperty()
  message: string;

  @ApiProperty({ required: false })
  emailId?: string;
}
