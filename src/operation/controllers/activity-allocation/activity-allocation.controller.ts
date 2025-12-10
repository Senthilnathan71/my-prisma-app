import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { ActivityAllocationService } from '../../services/activity-allocation/activity-allocation.service';

class ResponseData<T = any> {
  status = true;
  message = '';
  data: T | null = null;
}

@Controller('activity-allocation')
export class ActivityAllocationController {
  constructor(
    private readonly activityService: ActivityAllocationService,
  ) {}

  @Get('dashboard-data')
  async getDashboardData() {
    const resp = new ResponseData();
    try {
      resp.data = await this.activityService.getDashboardData();
      resp.message = 'Dashboard data fetched successfully';
    } catch (e: any) {
      resp.status = false;
      resp.message = e.message || 'Error fetching dashboard data';
    }
    return resp;
  }

  @Get('resource-summary')
  async getResourceSummary(
    @Query('mode') mode: 'pending' | 'processed' | 'all' = 'pending',
  ) {
    const resp = new ResponseData();
    try {
      resp.data = await this.activityService.getResourceSummary(mode);
      resp.message = 'Resource summary fetched successfully';
    } catch (e: any) {
      resp.status = false;
      resp.message = e.message || 'Error fetching resource summary';
    }
    return resp;
  }

  @Get('workload')
  async getWorkload(
    @Query('page') page = '1',
    @Query('pageSize') pageSize = '10',
  ) {
    const resp = new ResponseData();
    try {
      const p = parseInt(page, 10) || 1;
      const size = parseInt(pageSize, 10) || 10;
      resp.data = await this.activityService.getWorkLoadDetail(p, size);
      resp.message = 'Workload fetched successfully';
    } catch (e: any) {
      resp.status = false;
      resp.message = e.message || 'Error fetching workload';
    }
    return resp;
  }

  @Get('search')
  async searchWorkload(
    @Query('q') q: string,
    @Query('page') page = '1',
    @Query('pageSize') pageSize = '10',
  ) {
    const resp = new ResponseData();
    try {
      const p = parseInt(page, 10) || 1;
      const size = parseInt(pageSize, 10) || 10;
      resp.data = await this.activityService.searchWorkload(q || '', p, size);
      resp.message = 'Workload search completed';
    } catch (e: any) {
      resp.status = false;
      resp.message = e.message || 'Error searching workload';
    }
    return resp;
  }

  @Post('allocate')
  async allocateItems(
    @Body()
    body: {
      itemIds: number[];
      stage: 'Quotation' | 'Booking' | 'Job';
      csUser?: string;
      docUser?: string;
      operationUser?: string;
    },
  ) {
    const resp = new ResponseData();
    try {
      const result = await this.activityService.allocateItems(body);
      resp.data = result;
      resp.message = 'Items allocated successfully';
    } catch (e: any) {
      resp.status = false;
      resp.message = e.message || 'Error allocating items';
    }
    return resp;
  }
}
