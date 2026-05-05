import { ApiProperty } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsBoolean,
  IsIn,
  IsNumber,
  Min,
  Max,
  MaxLength,
  ValidateIf,
  Matches,
} from 'class-validator';

const EMAIL_LIST_REGEX = /^(\s*[^\s,;]+@[^\s,;]+\.[^\s,;]+\s*)([,;]\s*[^\s,;]+@[^\s,;]+\.[^\s,;]+\s*)*$/;
const TIME_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/;

export class CreateExceptionCheckScriptDto {
  @ApiProperty({ description: 'Script name (unique)' })
  @IsNotEmpty()
  @IsString()
  @MaxLength(200)
  ScriptName: string;

  @ApiProperty({ description: 'Optional human-readable description', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  ScriptDescription?: string;

  @ApiProperty({ description: 'SELECT query text' })
  @IsNotEmpty()
  @IsString()
  @MaxLength(20000)
  ScriptText: string;

  @ApiProperty({ description: 'MANUAL | SCHEDULED' })
  @IsNotEmpty()
  @IsString()
  @IsIn(['MANUAL', 'SCHEDULED'])
  ExecutionMode: 'MANUAL' | 'SCHEDULED';

  // ── Scheduler fields — required iff ExecutionMode = SCHEDULED ──

  @ApiProperty({ required: false })
  @ValidateIf((o) => o.ExecutionMode === 'SCHEDULED')
  @IsNotEmpty({ message: 'Frequency is required for SCHEDULED scripts' })
  @IsIn(['DAILY', 'WEEKLY', 'MONTHLY'])
  Frequency?: 'DAILY' | 'WEEKLY' | 'MONTHLY';

  @ApiProperty({ required: false })
  @ValidateIf((o) => o.ExecutionMode === 'SCHEDULED' && o.Frequency === 'WEEKLY')
  @IsNotEmpty({ message: 'DayOfWeek is required when Frequency=WEEKLY' })
  @IsNumber()
  @Min(0)
  @Max(6)
  DayOfWeek?: number;

  @ApiProperty({ required: false })
  @ValidateIf((o) => o.ExecutionMode === 'SCHEDULED' && o.Frequency === 'MONTHLY')
  @IsNotEmpty({ message: 'DayOfMonth is required when Frequency=MONTHLY' })
  @IsNumber()
  @Min(1)
  @Max(28)
  DayOfMonth?: number;

  @ApiProperty({ required: false, description: 'HH:mm 24h' })
  @ValidateIf((o) => o.ExecutionMode === 'SCHEDULED')
  @IsNotEmpty({ message: 'ScheduleTime is required for SCHEDULED scripts' })
  @IsString()
  @MaxLength(5)
  @Matches(TIME_REGEX, { message: 'ScheduleTime must be HH:mm (24h)' })
  ScheduleTime?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  TimeZone?: string;

  @ApiProperty({ required: false, description: 'Comma/semicolon-separated emails' })
  @ValidateIf((o) => o.ExecutionMode === 'SCHEDULED')
  @IsNotEmpty({ message: 'ToEmails is required for SCHEDULED scripts' })
  @IsString()
  @MaxLength(1000)
  @Matches(EMAIL_LIST_REGEX, { message: 'ToEmails must be a comma-separated list of valid email addresses' })
  ToEmails?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  @ValidateIf((o) => !!o.CcEmails && o.CcEmails.trim().length > 0)
  @Matches(EMAIL_LIST_REGEX, { message: 'CcEmails must be a comma-separated list of valid email addresses' })
  CcEmails?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  IsActive?: boolean;
}
