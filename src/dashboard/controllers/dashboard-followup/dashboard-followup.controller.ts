import { Controller, Get, Patch, Query, Param, ParseIntPipe } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Auth } from 'src/common/decorators/auth.decorator';
import { UserData } from 'src/common/decorators/user.decorator';
import { ResponseData } from 'src/common/response-data';
import { DashboardFollowupService } from '../../services/dashboard-followup/dashboard-followup.service';
import { DashboardFollowupsQueryDto } from '../../DTO/sales-dashboard.dto';

@ApiTags('Dashboard - Followups')
@Controller('dashboard')
export class DashboardFollowupController {
  constructor(private readonly followupService: DashboardFollowupService) {}

  @Auth()
  @Get('my-followups')
  async getDashboardFollowups(
    @Query() query: DashboardFollowupsQueryDto,
    @UserData() user: any,
  ) {
    const resp = new ResponseData();
    resp.data = await this.followupService.getDashboardFollowups(
      query,
      user?.UserMasterSid,
      user?.userEmail || '',
    );
    return resp;
  }

  @Auth()
  @Patch('complete-followup/:id')
  async completeDashboardFollowup(
    @Param('id', ParseIntPipe) id: number,
    @UserData() user: any,
  ) {
    const resp = new ResponseData();
    try {
      resp.data = await this.followupService.completeDashboardFollowup(id, user?.userEmail || 'system');
      resp.message = 'Followup marked as completed';
    } catch (error) {
      resp.status = false;
      resp.message = 'Internal Server Error';
    }
    return resp;
  }
}
