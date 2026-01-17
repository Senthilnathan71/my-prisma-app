import { Logger, Module } from '@nestjs/common';
import { NumberSeriesService } from './services/number-series/number-series.service';
import { NumberSeriesController } from './controllers/number-series/number-series.controller';

@Module({
  providers: [NumberSeriesService, Logger],
  controllers: [NumberSeriesController],
  exports: [NumberSeriesService],
})
export class SettingsModule {}
