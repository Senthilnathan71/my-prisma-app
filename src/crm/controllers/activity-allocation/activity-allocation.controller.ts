import {
  Controller,
  Get,
  Patch,
  Query,
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
} from 'src/crm/services/activity-allocation/activity-allocation.service';
import { ResponseData } from 'src/common/response-data';
import { Auth } from 'src/common/decorators/auth.decorator';
import { UserData } from 'src/common/decorators/user.decorator';

@Controller('crm/activity-allocation')
@Auth()
export class ActivityAllocationController {
  private logger = new Logger(ActivityAllocationController.name);

  constructor(private activityAllocationService: ActivityAllocationService) {}

  @ApiOperation({ summary: 'Get Activity Summary (All Stages)' })
  @HttpCode(HttpStatus.OK)
  @Get('summary')
  async getSummary(
    @Query('mode') mode: string = 'Pending',
    @Query('search') search: string = '',
    @UserData() user: any,
    @Query('companyId') companyId?: string,
    @Query('branchId') branchId?: string,
  ): Promise<ResponseData> {
    const output = new ResponseData();
    try {
      const companyMasterSid = companyId ? Number(companyId) : undefined;
      const branchMasterSid = branchId ? Number(branchId) : undefined;

      
      const validMode = this.validateMode(mode);

      const summary = await this.activityAllocationService.getSummary(
        validMode,
        search,
        companyMasterSid,
        branchMasterSid,
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
  @Get('workload-details')
  async getWorkloadDetails(
    @Query('userSid', ParseIntPipe) userSid: number,
    @Query('stage') stage: string,
    @Query('mode') mode: string = 'Pending',
    @UserData() user: any,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('companyId') companyId?: string,
    @Query('branchId') branchId?: string,
  ): Promise<ResponseData> {
    const output = new ResponseData();

    this.logger.log('🔍 [Controller] getWorkloadDetails called with:', {
      userSid,
      stage,
      mode,
      page,
      limit,
      companyId,
      branchId,
      loggedInUser: user?.email || user?.userName || 'unknown',
    });

    try {
      if (!userSid || !stage) {
        throw new BadRequestException('userSid and stage are required');
      }

      const pageNum = page ? Number(page) : 1;
      const limitNum = limit ? Number(limit) : 100;

      if (pageNum < 1) {
        throw new BadRequestException('page must be >= 1');
      }
      if (limitNum < 1 || limitNum > 500) {
        throw new BadRequestException('limit must be between 1 and 500');
      }

      const companyMasterSid = companyId ? Number(companyId) : 7;
      const branchMasterSid = branchId ? Number(branchId) : undefined;

      
      const validStage = this.validateStage(stage);
      const validMode = this.validateMode(mode);

      this.logger.log('📊 [Controller] Calling service with:', {
        userSid,
        stage: validStage,
        mode: validMode,
        companyMasterSid,
        branchMasterSid,
        pageNum,
        limitNum,
      });

      const details = await this.activityAllocationService.getWorkloadDetails(
        userSid,
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

      if (details.total === 0) {
        this.logger.warn('⚠️ [Controller] No records found. Check:');
        this.logger.warn(`  - UserSid ${userSid} exists in UserMaster?`);
        this.logger.warn(`  - Records exist in ${stage} table for this user?`);
        this.logger.warn(`  - CompanyMasterSid ${companyMasterSid} is correct?`);
        this.logger.warn(`  - Mode filter (${mode}) matches data status?`);
      }

      output.data = details;
      output.message = 'Workload details fetched successfully';
      output.status = true;
    } catch (error: any) {
      this.logger.error(
        `❌ [Controller] Error fetching workload details: ${error.message}`,
      );
      this.logger.error(`   Stack: ${error.stack}`);

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
    @Query('stage') stage: string,
    @Body() body: { userSid?: number; status?: string },
    @UserData() user: any,
  ): Promise<ResponseData> {
    const output = new ResponseData();
    try {
      
      const validStage = this.validateStage(stage);

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
  @Get('report')
  async generateReport(
    @Query('mode') mode: string = 'Pending',
    @UserData() user: any,
    @Query('companyId') companyId?: string,
    @Query('branchId') branchId?: string,
  ): Promise<ResponseData> {
    const output = new ResponseData();
    try {
      const companyMasterSid = companyId ? Number(companyId) : undefined;
      const branchMasterSid = branchId ? Number(branchId) : undefined;

      
      const validMode = this.validateMode(mode);

      const report = await this.activityAllocationService.generateReport(
        validMode,
        companyMasterSid,
        branchMasterSid,
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
    @Body() body: { csUserSid: number },
    @UserData() user: any,
  ): Promise<ResponseData> {
    const output = new ResponseData();
    try {
      if (!body.csUserSid) {
        throw new BadRequestException('csUserSid is required');
      }

      const updatedBy = user?.userName || user?.email || 'system';

      const result = await this.activityAllocationService.updateCSPerson(
        activityId,
        body.csUserSid,
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
      'Job',
      'BL',
      'SI',
      'Invoice',
    ];

    if (validStages.includes(stage as Stage)) {
      return stage as Stage;
    }

    throw new BadRequestException(
      `Invalid stage '${stage}'. Valid stages: ${validStages.join(', ')}`,
    );
  }
}
