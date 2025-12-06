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
import { ActivityAllocationService } from 'src/crm/services/activity-allocation/activity-allocation.service';
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

      const summary = await this.activityAllocationService.getSummary(
        mode,
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

  @ApiOperation({ summary: 'Get Workload Details' })
  @HttpCode(HttpStatus.OK)
  @Get('workload-details')
  async getWorkloadDetails(
    @Query('userSid', ParseIntPipe) userSid: number,
    @Query('stage') stage: string,
    @Query('mode') mode: string = 'Pending',
    @UserData() user: any,
    @Query('companyId') companyId?: string,
    @Query('branchId') branchId?: string,
  ): Promise<ResponseData> {
    const output = new ResponseData();
    try {
      if (!userSid || !stage) {
        throw new BadRequestException('userSid and stage are required');
      }

      const companyMasterSid = companyId ? Number(companyId) : undefined;
      const branchMasterSid = branchId ? Number(branchId) : undefined;

      const details = await this.activityAllocationService.getWorkloadDetails(
        userSid,
        stage as any,
        mode as any,
        companyMasterSid,
        branchMasterSid,
      );

      output.data = details;
      output.message = 'Workload details fetched successfully';
      output.status = true;
    } catch (error: any) {
      this.logger.warn(`Error fetching workload details: ${error.message}`);
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
      const result =
        await this.activityAllocationService.updateActivityAllocation(
          activityId,
          stage as any,
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

      const report = await this.activityAllocationService.generateReport(
        mode as any,
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
}
