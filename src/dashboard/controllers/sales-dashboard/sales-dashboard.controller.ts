import { Controller, Get, Query, Param, ParseIntPipe } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Auth } from 'src/common/decorators/auth.decorator';
import { ResponseData } from 'src/common/response-data';
import { SalesDashboardService } from '../../services/sales-dashboard/sales-dashboard.service';
import { SalesDashboardQueryDto } from '../../DTO/sales-dashboard.dto';

@ApiTags('Dashboard - Sales')
@Controller('dashboard')
export class SalesDashboardController {
  constructor(private readonly salesDashboardService: SalesDashboardService) {}

  @Auth()
  @Get('sales-dashboard')
  async getSalesDashboard(@Query() query: SalesDashboardQueryDto) {
    const resp = new ResponseData();
    resp.data = await this.salesDashboardService.getSalesDashboardData(query);
    return resp;
  }

  @Auth()
  @Get('sales-dashboard/counts')
  async getSalesDashboardCounts(@Query() query: SalesDashboardQueryDto) {
    const resp = new ResponseData();
    resp.data = await this.salesDashboardService.getSalesDashboardCounts(query);
    return resp;
  }

  @Auth()
  @Get('sales-dashboard/section/:sectionNumber')
  async getSalesDashboardSection(
    @Query() query: SalesDashboardQueryDto,
    @Param('sectionNumber', ParseIntPipe) sectionNumber: number,
  ) {
    const resp = new ResponseData();
    resp.data = await this.salesDashboardService.getSectionData(
      sectionNumber,
      query,
    );
    return resp;
  }
}
