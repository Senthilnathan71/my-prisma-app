import { Logger, Module } from '@nestjs/common';
import { NumberSeriesService } from './services/number-series/number-series.service';
import { NumberSeriesController } from './controllers/number-series/number-series.controller';
import { MenuUserConfigService } from './services/menu-user-config/menu-user-config.service';
import { MenuUserConfigController } from './controllers/menu-user-config/menu-user-config.controller';

@Module({
  providers: [NumberSeriesService, MenuUserConfigService, Logger],
  controllers: [NumberSeriesController, MenuUserConfigController],
  exports: [NumberSeriesService],
})
export class SettingsModule {}
