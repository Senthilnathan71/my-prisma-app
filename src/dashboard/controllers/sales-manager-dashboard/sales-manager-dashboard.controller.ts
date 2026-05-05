import { Controller, Get, Patch, Post, Query, Body, ParseIntPipe } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ResponseData } from 'src/common/response-data';
import { SalesManagerDashboardService } from '../../services/sales-manager-dashboard/sales-manager-dashboard.service';
import { SalesManagerQueryDto } from '../../DTO/sales-manager-dashboard.dto';
import {
  ReassignLeadDto,
  BulkReassignDto,
  CreateMeetingOnBehalfDto,
  SendReminderDto,
} from '../../DTO/sales-manager-actions.dto';
import { Auth } from 'src/common/decorators/auth.decorator';

@ApiTags('Dashboard - Sales Manager')
@Controller('dashboard/sales-manager')
@Auth()
export class SalesManagerDashboardController {
  constructor(private readonly service: SalesManagerDashboardService) {}

  @Get('salespersons')
  async getSalespersons(
    @Query('companyMasterSid', ParseIntPipe) companyMasterSid: number,
    @Query('branchMasterSid', ParseIntPipe) branchMasterSid: number,
  ) {
    const resp = new ResponseData();
    try {
      resp.data = await this.service.getSalespersons(companyMasterSid, branchMasterSid);
    } catch (error) {
      resp.status = false;
      resp.message = error.message || 'Failed to fetch salespersons';
    }
    return resp;
  }

  @Get('counts')
  async getCounts(@Query() query: SalesManagerQueryDto) {
    const resp = new ResponseData();
    try {
      resp.data = await this.service.getCounts(query);
    } catch (error) {
      resp.status = false;
      resp.message = error.message || 'Failed to fetch counts';
    }
    return resp;
  }

  @Get('scoreboard')
  async getScoreboard(@Query() query: SalesManagerQueryDto) {
    const resp = new ResponseData();
    try {
      resp.data = await this.service.getScoreboard(query);
    } catch (error) {
      resp.status = false;
      resp.message = error.message || 'Failed to fetch scoreboard';
    }
    return resp;
  }

  @Get('weekly-trend')
  async getWeeklyTrend(@Query() query: SalesManagerQueryDto) {
    const resp = new ResponseData();
    try {
      resp.data = await this.service.getWeeklyTrend(query);
    } catch (error) {
      resp.status = false;
      resp.message = error.message || 'Failed to fetch weekly trend';
    }
    return resp;
  }


  @Get('activity-feed')
  async getActivityFeed(@Query() query: SalesManagerQueryDto) {
    const resp = new ResponseData();
    try {
      resp.data = await this.service.getActivityFeed(query);
    } catch (error) {
      resp.status = false;
      resp.message = error.message || 'Failed to fetch activity feed';
    }
    return resp;
  }

  @Get('alerts')
  async getAlerts(@Query() query: SalesManagerQueryDto) {
    const resp = new ResponseData();
    try {
      resp.data = await this.service.getAlerts(query);
    } catch (error) {
      resp.status = false;
      resp.message = error.message || 'Failed to fetch alerts';
    }
    return resp;
  }

  @Get('meetings-board')
  async getMeetingsBoard(@Query() query: SalesManagerQueryDto) {
    const resp = new ResponseData();
    try {
      resp.data = await this.service.getMeetingsBoard(query);
    } catch (error) {
      resp.status = false;
      resp.message = error.message || 'Failed to fetch meetings board';
    }
    return resp;
  }

  @Patch('reassign-lead')
  async reassignLead(@Body() dto: ReassignLeadDto) {
    const resp = new ResponseData();
    try {
      resp.data = await this.service.reassignLead(dto);
      resp.message = 'Lead reassigned successfully';
    } catch (error) {
      resp.status = false;
      resp.message = error.message || 'Failed to reassign lead';
    }
    return resp;
  }

  @Patch('bulk-reassign')
  async bulkReassign(@Body() dto: BulkReassignDto) {
    const resp = new ResponseData();
    try {
      resp.data = await this.service.bulkReassign(dto);
      resp.message = `${dto.PreCustomerMeetingSids.length} leads reassigned successfully`;
    } catch (error) {
      resp.status = false;
      resp.message = error.message || 'Failed to bulk reassign';
    }
    return resp;
  }

  @Post('create-meeting')
  async createMeeting(@Body() dto: CreateMeetingOnBehalfDto) {
    const resp = new ResponseData();
    try {
      resp.data = await this.service.createMeetingOnBehalf(dto);
      resp.message = 'Meeting created successfully';
    } catch (error) {
      resp.status = false;
      resp.message = error.message || 'Failed to create meeting';
    }
    return resp;
  }

  @Post('send-reminder')
  async sendReminder(@Body() dto: SendReminderDto) {
    const resp = new ResponseData();
    try {
      resp.data = await this.service.sendReminder(dto);
      resp.message = 'Reminder sent successfully';
    } catch (error) {
      resp.status = false;
      resp.message = error.message || 'Failed to send reminder';
    }
    return resp;
  }
}
