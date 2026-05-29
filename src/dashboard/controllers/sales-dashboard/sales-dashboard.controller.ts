import { Controller, Get, Patch, Query, Param, ParseIntPipe } from '@nestjs/common';
import { UserData } from 'src/common/decorators/user.decorator';
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

  @Auth()
  @Get('sales-dashboard/funnel-journeys')
  async getFunnelJourneys(@Query() query: SalesDashboardQueryDto) {
    const resp = new ResponseData();
    resp.data = await this.salesDashboardService.getFunnelJourneys(query);
    return resp;
  }

  @Auth()
  @Patch('sales-dashboard/followup/complete/:id')
  async completeMeetingFollowup(
    @Param('id', ParseIntPipe) id: number,
    @UserData() user: any,
  ) {
    const resp = new ResponseData();
    try {
      resp.data = await this.salesDashboardService.completeMeetingFollowup(id, user?.userEmail || 'system');
      resp.message = 'Followup marked as completed';
    } catch (error) {
      resp.status = false;
      resp.message = 'Internal Server Error';
    }
    return resp;
  }

}
