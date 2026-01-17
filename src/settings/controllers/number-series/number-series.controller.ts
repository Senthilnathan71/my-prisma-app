import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from 'src/common/decorators/jwt-auth.guard';
import { NumberSeriesService } from '../../services/number-series/number-series.service';
import {
  CreateNumberSeriesConfigDto,
  GenerateNumberDto,
  PreviewNumberDto,
} from '../../DTO/number-series.dto';

@Controller('number-series')
@UseGuards(JwtAuthGuard)
export class NumberSeriesController {
  constructor(private readonly numberSeriesService: NumberSeriesService) {}

  /**
   * Get all configurations for a branch
   * GET /number-series/configs?CompanyMasterSid=1&BranchMasterSid=1
   */
  @Get('configs')
  async getConfigs(
    @Query('CompanyMasterSid') CompanyMasterSid: string,
    @Query('BranchMasterSid') BranchMasterSid: string,
  ) {
    try {
      const data = await this.numberSeriesService.getConfigsByBranch(
        Number(CompanyMasterSid),
        Number(BranchMasterSid),
      );
      return { status: true, data };
    } catch (error) {
      return { status: false, message: error.message };
    }
  }

  /**
   * Get configuration for a specific menu
   * GET /number-series/config/:menuMasterSid?CompanyMasterSid=1&BranchMasterSid=1
   */
  @Get('config/:menuMasterSid')
  async getConfigByMenu(
    @Param('menuMasterSid') menuMasterSid: string,
    @Query('CompanyMasterSid') CompanyMasterSid: string,
    @Query('BranchMasterSid') BranchMasterSid: string,
  ) {
    try {
      const data = await this.numberSeriesService.getConfigByMenu(
        Number(CompanyMasterSid),
        Number(BranchMasterSid),
        Number(menuMasterSid),
      );
      return { status: true, data };
    } catch (error) {
      return { status: false, message: error.message };
    }
  }

  /**
   * Create or update configuration
   * POST /number-series/config
   */
  @Post('config')
  async upsertConfig(@Body() payload: CreateNumberSeriesConfigDto) {
    try {
      const data = await this.numberSeriesService.upsertConfig(payload);
      return {
        status: true,
        data,
        message: 'Number series configuration saved successfully',
      };
    } catch (error) {
      return { status: false, message: error.message };
    }
  }

  /**
   * Generate next document number (increments counter)
   * POST /number-series/generate
   */
  @Post('generate')
  async generateNumber(@Body() payload: GenerateNumberDto) {
    try {
      const number = await this.numberSeriesService.generateNextNumber(
        payload.CompanyMasterSid,
        payload.BranchMasterSid,
        payload.MenuMasterSid,
        payload.DepartmentMasterSid,
      );
      return { status: true, data: number };
    } catch (error) {
      return { status: false, message: error.message };
    }
  }

  /**
   * Preview next number without incrementing counter
   * POST /number-series/preview
   */
  @Post('preview')
  async previewNumber(@Body() payload: PreviewNumberDto) {
    try {
      const result = await this.numberSeriesService.previewNextNumber(
        payload.CompanyMasterSid,
        payload.BranchMasterSid,
        payload.MenuMasterSid,
        payload.DepartmentMasterSid,
      );
      return { status: true, data: result };
    } catch (error) {
      return { status: false, message: error.message };
    }
  }

  /**
   * Delete configuration (soft delete)
   * DELETE /number-series/config/:id
   */
  @Delete('config/:id')
  async deleteConfig(
    @Param('id') id: string,
    @Body('UpdatedBy') UpdatedBy: string,
  ) {
    try {
      const data = await this.numberSeriesService.deleteConfig(
        Number(id),
        UpdatedBy,
      );
      return {
        status: true,
        data,
        message: 'Number series configuration deleted',
      };
    } catch (error) {
      return { status: false, message: error.message };
    }
  }

  /**
   * Get current financial year for a company
   * GET /number-series/financial-year?CompanyMasterSid=1
   */
  @Get('financial-year')
  async getCurrentFinancialYear(
    @Query('CompanyMasterSid') CompanyMasterSid: string,
  ) {
    try {
      const data = await this.numberSeriesService.getCurrentFinancialYear(
        Number(CompanyMasterSid),
      );
      return { status: true, data };
    } catch (error) {
      return { status: false, message: error.message };
    }
  }

  /**
   * Get all counters for a configuration (for debugging/reporting)
   * GET /number-series/counters/:configId
   */
  @Get('counters/:configId')
  async getCountersByConfig(@Param('configId') configId: string) {
    try {
      const data = await this.numberSeriesService.getCountersByConfig(
        Number(configId),
      );
      return { status: true, data };
    } catch (error) {
      return { status: false, message: error.message };
    }
  }

  /**
   * Reset counter (admin use only)
   * POST /number-series/reset-counter
   */
  @Post('reset-counter')
  async resetCounter(@Body() payload: GenerateNumberDto) {
    try {
      const data = await this.numberSeriesService.resetCounter(
        payload.CompanyMasterSid,
        payload.BranchMasterSid,
        payload.MenuMasterSid,
        payload.DepartmentMasterSid,
      );
      return { status: true, data, message: 'Counter reset successfully' };
    } catch (error) {
      return { status: false, message: error.message };
    }
  }

  /**
   * Debug: Get ALL number series configs (for troubleshooting)
   * GET /number-series/debug/all-configs
   */
  @Get('debug/all-configs')
  async getAllConfigsDebug() {
    try {
      const data = await this.numberSeriesService.getAllConfigsDebug();
      return { status: true, data };
    } catch (error) {
      return { status: false, message: error.message };
    }
  }
}
