import { Logger, Module } from '@nestjs/common';
import { OcrController } from './controllers/ocr.controller';
import { OcrService } from './services/ocr.service';

@Module({
  controllers: [OcrController],
  providers: [OcrService, Logger],
  exports: [OcrService],
})
export class OcrModule {}
