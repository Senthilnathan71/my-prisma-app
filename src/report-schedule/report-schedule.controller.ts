import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  ParseIntPipe,
  HttpCode,
  HttpStatus,
  Logger,
  BadRequestException,
} from '@nestjs/common';
import { ApiOperation, ApiTags, ApiCreatedResponse } from '@nestjs/swagger';
import { ResponseData } from 'src/common/response-data';
import { ReportScheduleService } from './report-schedule.service';
import { CreateReportScheduleDto } from './dto/create-report-schedule.dto';
import { UpdateReportScheduleDto } from './dto/update-report-schedule.dto';

@ApiTags('Report Schedule')
@Controller('report-schedule')
export class ReportScheduleController {
  constructor(
    private readonly reportScheduleService: ReportScheduleService,
    private readonly logger: Logger,
  ) {}

  @ApiOperation({ summary: 'List all report schedules for a company' })
  @HttpCode(HttpStatus.OK)
  @Get()
  async findAll(@Query('companyId', ParseIntPipe) companyId: number) {
    const resp = new ResponseData();
    try {
      resp.data = await this.reportScheduleService.findAll(companyId);
      resp.message = 'Report schedules fetched successfully';
    } catch (error) {
      this.logger.warn(`findAll error: ${error.message}`);
      resp.status = false;
      resp.message = error instanceof BadRequestException ? error.message : 'Internal Server Error';
    }
    return resp;
  }

  @ApiOperation({ summary: 'Get available reports for scheduling' })
  @HttpCode(HttpStatus.OK)
  @Get('available-reports')
  async getAvailableReports(@Query('companyId', ParseIntPipe) companyId: number) {
    const resp = new ResponseData();
    try {
      resp.data = await this.reportScheduleService.getAvailableReports(companyId);
      resp.message = 'Available reports fetched successfully';
    } catch (error) {
      this.logger.warn(`getAvailableReports error: ${error.message}`);
      resp.status = false;
      resp.message = error instanceof BadRequestException ? error.message : 'Internal Server Error';
    }
    return resp;
  }

  @ApiOperation({ summary: 'Get one report schedule' })
  @HttpCode(HttpStatus.OK)
  @Get(':id')
  async findOne(
    @Param('id', ParseIntPipe) id: number,
    @Query('companyId', ParseIntPipe) companyId: number,
  ) {
    const resp = new ResponseData();
    try {
      resp.data = await this.reportScheduleService.findOne(id, companyId);
      resp.message = 'Report schedule fetched successfully';
    } catch (error) {
      this.logger.warn(`findOne error: ${error.message}`);
      resp.status = false;
      resp.message = error instanceof BadRequestException ? error.message : 'Internal Server Error';
    }
    return resp;
  }

  @ApiOperation({ summary: 'Create a new report schedule' })
  @HttpCode(HttpStatus.CREATED)
  @Post()
  async create(
    @Body() dto: CreateReportScheduleDto,
    @Query('username') username: string,
  ) {
    const resp = new ResponseData();
    try {
      resp.data = await this.reportScheduleService.create(dto, username || 'system');
      resp.message = 'Report schedule created successfully';
    } catch (error) {
      this.logger.warn(`create error: ${error.message}`);
      resp.status = false;
      resp.message = error instanceof BadRequestException ? error.message : 'Internal Server Error';
    }
    return resp;
  }

  @ApiOperation({ summary: 'Update a report schedule' })
  @HttpCode(HttpStatus.OK)
  @Patch(':id')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateReportScheduleDto,
    @Query('username') username: string,
  ) {
    const resp = new ResponseData();
    try {
      resp.data = await this.reportScheduleService.update(id, dto, username || 'system');
      resp.message = 'Report schedule updated successfully';
    } catch (error) {
      this.logger.warn(`update error: ${error.message}`);
      resp.status = false;
      resp.message = error instanceof BadRequestException ? error.message : 'Internal Server Error';
    }
    return resp;
  }

  @ApiOperation({ summary: 'Delete a report schedule' })
  @HttpCode(HttpStatus.OK)
  @Delete(':id')
  async remove(
    @Param('id', ParseIntPipe) id: number,
    @Query('username') username: string,
  ) {
    const resp = new ResponseData();
    try {
      resp.data = await this.reportScheduleService.remove(id, username || 'system');
      resp.message = 'Report schedule deleted successfully';
    } catch (error) {
      this.logger.warn(`remove error: ${error.message}`);
      resp.status = false;
      resp.message = error instanceof BadRequestException ? error.message : 'Internal Server Error';
    }
    return resp;
  }

  @ApiOperation({ summary: 'Toggle schedule active/inactive' })
  @HttpCode(HttpStatus.OK)
  @Patch(':id/toggle-active')
  async toggleActive(
    @Param('id', ParseIntPipe) id: number,
    @Query('username') username: string,
  ) {
    const resp = new ResponseData();
    try {
      resp.data = await this.reportScheduleService.toggleActive(id, username || 'system');
      resp.message = 'Schedule toggled successfully';
    } catch (error) {
      this.logger.warn(`toggleActive error: ${error.message}`);
      resp.status = false;
      resp.message = error instanceof BadRequestException ? error.message : 'Internal Server Error';
    }
    return resp;
  }

  @ApiOperation({ summary: 'Test send — execute schedule immediately' })
  @HttpCode(HttpStatus.OK)
  @Post(':id/test-send')
  async testSend(
    @Param('id', ParseIntPipe) id: number,
    @Query('companyId', ParseIntPipe) companyId: number,
  ) {
    const resp = new ResponseData();
    try {
      resp.data = await this.reportScheduleService.testSend(id, companyId);
      resp.message = 'Test report sent successfully';
    } catch (error) {
      this.logger.warn(`testSend error: ${error.message}`);
      resp.status = false;
      resp.message = error instanceof BadRequestException ? error.message : 'Internal Server Error';
    }
    return resp;
  }
}
