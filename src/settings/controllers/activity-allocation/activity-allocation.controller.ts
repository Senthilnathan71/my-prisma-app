import {
  Controller,
  Post,
  Patch,
  Param,
  Body,
  HttpCode,
  HttpStatus,
  Logger,
  BadRequestException,
  ParseIntPipe,
} from '@nestjs/common';
import { ApiOperation } from '@nestjs/swagger';
import {
  ActivityAllocationService,
  SummaryMode,
  Stage,
} from '../../services/activity-allocation/activity-allocation.service';
import { ResponseData } from 'src/common/response-data';
import { Auth } from 'src/common/decorators/auth.decorator';
import { UserData } from 'src/common/decorators/user.decorator';

@Controller('activity-allocation')
@Auth()
export class ActivityAllocationController {
  private logger = new Logger(ActivityAllocationController.name);

  constructor(private activityAllocationService: ActivityAllocationService) {}

  @ApiOperation({ summary: 'Get Activity Summary (All Stages)' })
  @HttpCode(HttpStatus.OK)
  @Post('summary')
  async getSummary(
    @Body() body: { mode?: string; search?: string; companyId?: number; branchId?: number },
    @UserData() user: any,
  ): Promise<ResponseData> {
    const output = new ResponseData();
    try {
      const validMode = this.validateMode(body.mode);

      const summary = await this.activityAllocationService.getSummary(
        validMode,
        body.search || '',
        body.companyId,
        body.branchId,
      );

      output.data = summary.data;
      output.message = 'Activity summary fetched successfully';
      output.status = true;
    } catch (error: any) {
      this.logger.warn(`Error fetching summary: ${error.message}`);
      output.status = false;
      output.message =
        error instanceof BadRequestException
          ? error.message
          : 'Internal Server Error';
    }
    return output;
  }

  @ApiOperation({ summary: 'Get Workload Details with Pagination' })
  @HttpCode(HttpStatus.OK)
  @Post('workload-details')
  async getWorkloadDetails(
    @Body() body: {
      userSid: number;
      stage: string;
      mode?: string;
      page?: number;
      limit?: number;
      companyId?: number;
      branchId?: number;
    },
    @UserData() user: any,
  ): Promise<ResponseData> {
    const output = new ResponseData();

    this.logger.log('🔍 [Controller] getWorkloadDetails called with:', {
      ...body,
      loggedInUser: user?.email || user?.userName || 'unknown',
    });

    try {
      if (!body.userSid || !body.stage) {
        throw new BadRequestException('userSid and stage are required');
      }

      const pageNum = body.page || 1;
      const limitNum = body.limit || 100;

      if (pageNum < 1) {
        throw new BadRequestException('page must be >= 1');
      }
      if (limitNum < 1 || limitNum > 500) {
        throw new BadRequestException('limit must be between 1 and 500');
      }

      const companyMasterSid = body.companyId || undefined;
      const branchMasterSid = body.branchId || undefined;

      const validStage = this.validateStage(body.stage);
      const validMode = this.validateMode(body.mode);

      const details = await this.activityAllocationService.getWorkloadDetails(
        body.userSid,
        validStage,
        validMode,
        companyMasterSid,
        branchMasterSid,
        pageNum,
        limitNum,
      );

      this.logger.log('✅ [Controller] Service returned:', {
        dataLength: details.data?.length || 0,
        total: details.total,
        page: details.page,
        totalPages: details.totalPages,
        availableUsersCount: details.availableUsers?.length || 0,
      });

      output.data = details;
      output.message = 'Workload details fetched successfully';
      output.status = true;
    } catch (error: any) {
      this.logger.error(
        `❌ [Controller] Error fetching workload details: ${error.message}`,
      );
      output.status = false;
      output.message =
        error instanceof BadRequestException
          ? error.message
          : 'Internal Server Error';
    }

    return output;
  }

  @ApiOperation({ summary: 'Update Activity Allocation' })
  @HttpCode(HttpStatus.OK)
  @Patch('allocation/:activityId')
  async updateActivityAllocation(
    @Param('activityId', ParseIntPipe) activityId: number,
    @Body() body: { userSid?: number; status?: string; stage: string },
    @UserData() user: any,
  ): Promise<ResponseData> {
    const output = new ResponseData();
    try {
      const validStage = this.validateStage(body.stage);

      const result =
        await this.activityAllocationService.updateActivityAllocation(
          activityId,
          validStage,
          body,
        );

      output.data = result;
      output.message = result.message;
      output.status = result.success;
    } catch (error: any) {
      this.logger.warn(`Error updating activity allocation: ${error.message}`);
      output.status = false;
      output.message =
        error instanceof BadRequestException
          ? error.message
          : 'Internal Server Error';
    }
    return output;
  }

  @ApiOperation({ summary: 'Generate Activity Allocation Report' })
  @HttpCode(HttpStatus.OK)
  @Post('report')
  async generateReport(
    @Body() body: { mode?: string; companyId?: number; branchId?: number },
    @UserData() user: any,
  ): Promise<ResponseData> {
    const output = new ResponseData();
    try {
      const validMode = this.validateMode(body.mode);

      const report = await this.activityAllocationService.generateReport(
        validMode,
        body.companyId,
        body.branchId,
      );

      output.data = report;
      output.message = 'Report generated successfully';
      output.status = true;
    } catch (error: any) {
      this.logger.warn(`Error generating report: ${error.message}`);
      output.status = false;
      output.message =
        error instanceof BadRequestException
          ? error.message
          : 'Internal Server Error';
    }
    return output;
  }

  // ─── Update CS Person ────────────────────────────────────────

  @ApiOperation({ summary: 'Update CS Person for Activity' })
  @HttpCode(HttpStatus.OK)
  @Patch('cs-person/:activityId')
  async updateCSPerson(
    @Param('activityId', ParseIntPipe) activityId: number,
    @Body() body: { csUserSid: number; stage: string },
    @UserData() user: any,
  ): Promise<ResponseData> {
    const output = new ResponseData();
    try {
      if (!body.csUserSid) {
        throw new BadRequestException('csUserSid is required');
      }
      if (!body.stage) {
        throw new BadRequestException('stage is required');
      }

      const updatedBy = user?.userName || user?.email || 'system';

      const result = await this.activityAllocationService.updateCSPerson(
        activityId,
        body.csUserSid,
        body.stage,
        updatedBy,
      );

      output.data = result;
      output.message = result.message;
      output.status = result.success;
    } catch (error: any) {
      this.logger.warn(`Error updating CS person: ${error.message}`);
      output.status = false;
      output.message =
        error instanceof BadRequestException
          ? error.message
          : 'Failed to update CS person';
    }
    return output;
  }

  // ─── Validators ──────────────────────────────────────────────

  private validateMode(mode?: string): SummaryMode {
    if (!mode) return 'Pending';

    const validModes: SummaryMode[] = ['All', 'Pending', 'Processed'];

    if (validModes.includes(mode as SummaryMode)) {
      return mode as SummaryMode;
    }

    this.logger.warn(`Invalid mode '${mode}', defaulting to 'Pending'`);
    return 'Pending';
  }

  private validateStage(stage?: string): Stage {
    if (!stage) {
      throw new BadRequestException('Stage parameter is required');
    }

    const validStages: Stage[] = [
      'RateRequest',
      'Quotation',
      'Booking',
      'LoadPlan',
      'MasterJob',
    ];

    if (validStages.includes(stage as Stage)) {
      return stage as Stage;
    }

    throw new BadRequestException(
      `Invalid stage '${stage}'. Valid stages: ${validStages.join(', ')}`,
    );
  }
}
