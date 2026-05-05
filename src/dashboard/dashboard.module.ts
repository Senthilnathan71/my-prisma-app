import { Module } from '@nestjs/common';
import { MastersModule } from 'src/masters/masters.module';
import { EmailModule } from 'src/email/email.module';
import { SalesDashboardController } from './controllers/sales-dashboard/sales-dashboard.controller';
import { SalesDashboardService } from './services/sales-dashboard/sales-dashboard.service';
import { SalesManagerDashboardController } from './controllers/sales-manager-dashboard/sales-manager-dashboard.controller';
import { SalesManagerDashboardService } from './services/sales-manager-dashboard/sales-manager-dashboard.service';
import { SettingsModule } from 'src/settings/settings.module';


@Module({
  imports: [SettingsModule],
  controllers: [
    SalesDashboardController, 
    SalesManagerDashboardController
  ],
  providers: [
    SalesDashboardService, 
    SalesManagerDashboardService
  ],
})
export class DashboardModule { }
