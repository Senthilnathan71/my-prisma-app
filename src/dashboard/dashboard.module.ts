import { Module } from '@nestjs/common';
import { MastersModule } from 'src/masters/masters.module';
import { SalesDashboardController } from './controllers/sales-dashboard/sales-dashboard.controller';
import { SalesDashboardService } from './services/sales-dashboard/sales-dashboard.service';

@Module({
  imports: [MastersModule],
  controllers: [SalesDashboardController],
  providers: [SalesDashboardService],
})
export class DashboardModule {}
