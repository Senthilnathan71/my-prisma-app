import { PartialType } from '@nestjs/swagger';
import { CreateExceptionCheckScriptDto } from './create-exception-check-script.dto';

export class UpdateExceptionCheckScriptDto extends PartialType(CreateExceptionCheckScriptDto) {}
