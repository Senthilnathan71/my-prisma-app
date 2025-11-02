import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  HttpCode,
  HttpStatus,
  Logger,
  BadRequestException,
  Query,
  ParseIntPipe,
} from '@nestjs/common';
import { ApiBody, ApiCreatedResponse, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { ResponseData } from 'src/common/response-data';
import { Auth } from 'src/common/decorators/auth.decorator';
import { UserData } from 'src/common/decorators/user.decorator';
import { filterDto } from 'src/masters/DTO/search-vessel.dto';
import { ServiceJobService } from 'src/operation/services/service-job/service-job.service';

@Auth()
@Controller('service-job')
export class ServiceJobController {
  private readonly logger = new Logger(ServiceJobController.name);

  constructor(private readonly serviceJobService: ServiceJobService) {}

  @ApiOperation({ summary: 'Create Service Job' })
  @ApiCreatedResponse({
    description: 'Service Job Created Successfully',
    type: ResponseData,
  })
  @HttpCode(HttpStatus.CREATED)
  @Post('create')
  async create(@Body() payload: any) {
    const output = new ResponseData();
    try {
      const serviceJob = await this.serviceJobService.createServiceJob(payload);

      if (!serviceJob) {
        this.logger.warn(`Service job create failed: ${serviceJob}`);
        throw new BadRequestException('Service Job Create Failed');
      }

      output.data = serviceJob;
      output.message = 'Service Job Created Successfully';
    } catch (error) {
      this.logger.error(`Service Job Create Failed - ${error.message}`);
      output.status = false;
      output.message = error.message || 'Internal Server Error';
    }
    return output;
  }

  @ApiOperation({ summary: 'Search Service Jobs' })
  @ApiCreatedResponse({
    description: 'Service Jobs Fetched Successfully',
    type: ResponseData,
  })
  @HttpCode(HttpStatus.OK)
  @Post('search-list')
  async searchServiceJobs(@Body() searchParams: filterDto) {
    const output = new ResponseData();
    try {
      const serviceJobs = await this.serviceJobService.searchServiceJob(searchParams);

      if (!serviceJobs) {
        this.logger.warn(`Service jobs data fetched failed: ${serviceJobs}`);
        throw new BadRequestException('Service Jobs Data Fetch Failed');
      }

      output.data = serviceJobs;
      output.message = 'Service Jobs Data Fetched Successfully';
    } catch (error) {
      this.logger.error(`Service Jobs Data Fetch Failed - ${error.message}`);
      output.status = false;
      output.message = error.message || 'Internal Server Error';
    }
    return output;
  }

  @ApiOperation({ summary: 'Fetch Service Job By ID' })
  @ApiCreatedResponse({
    description: 'Service Job Data Fetched Successfully',
    type: ResponseData,
  })
  @HttpCode(HttpStatus.OK)
  @Get('fetch/:id')
  async findOne(@Param('id',ParseIntPipe) id: number) {
    const output = new ResponseData();
    try {
      const serviceJob = await this.serviceJobService.fetchServiceJobById(+id);

      if (!serviceJob) {
        this.logger.warn(`Service job data fetched failed: ${serviceJob}`);
        throw new BadRequestException('Service Job Data Fetch Failed');
      }

      output.data = serviceJob;
      output.message = 'Service Job Data Fetched Successfully';
    } catch (error) {
      this.logger.error(`Service Job Data Fetch Failed - ${error.message}`);
      output.status = false;
      output.message = error.message || 'Internal Server Error';
    }
    return output;
  }

  @ApiOperation({ summary: 'Update Service Job By ID' })
  @ApiCreatedResponse({
    description: 'Service Job Updated Successfully',
    type: ResponseData,
  })
  @HttpCode(HttpStatus.OK)
  @Patch('update/:id')
  async update(
    @Param('id',ParseIntPipe) id: number,
    @Body() payload:any
  ) {
    const output = new ResponseData();
    try {
      const serviceJob = await this.serviceJobService.updateServiceJob(id,payload);

      if (!serviceJob) {
        this.logger.warn(`Service job update failed: ${serviceJob}`);
        throw new BadRequestException('Service Job Update Failed');
      }

      output.data = serviceJob;
      output.message = 'Service Job Updated Successfully';
    } catch (error) {
      this.logger.error(`Service Job Update Failed - ${error.message}`);
      output.status = false;
      output.message = error.message || 'Internal Server Error';
    }
    return output;
  }

}
