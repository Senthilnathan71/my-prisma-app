import { Logger, Module } from '@nestjs/common';
import { NumberSeriesService } from './services/number-series/number-series.service';
import { NumberSeriesController } from './controllers/number-series/number-series.controller';
import { MenuUserConfigService } from './services/menu-user-config/menu-user-config.service';
import { MenuUserConfigController } from './controllers/menu-user-config/menu-user-config.controller';
import { ActivityAllocationService } from './services/activity-allocation/activity-allocation.service';
import { ActivityAllocationController } from './controllers/activity-allocation/activity-allocation.controller';

@Module({
  providers: [NumberSeriesService, MenuUserConfigService, ActivityAllocationService, Logger],
  controllers: [NumberSeriesController, MenuUserConfigController, ActivityAllocationController],
  exports: [NumberSeriesService],
})
export class SettingsModule {}
