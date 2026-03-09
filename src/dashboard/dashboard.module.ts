import { Module } from '@nestjs/common';
import { SalesDashboardController } from './controllers/sales-dashboard/sales-dashboard.controller';
import { SalesDashboardService } from './services/sales-dashboard/sales-dashboard.service';

@Module({
  controllers: [SalesDashboardController],
  providers: [SalesDashboardService],
})
export class DashboardModule {}
