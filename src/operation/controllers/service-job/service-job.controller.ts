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
  ValidationPipe,
  UsePipes,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiBody, ApiCreatedResponse, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { ResponseData } from 'src/common/response-data';
import { Auth } from 'src/common/decorators/auth.decorator';
import { UserData } from 'src/common/decorators/user.decorator';
import { filterDto } from 'src/masters/DTO/search-vessel.dto';
import { DuplicateCheckDTO } from 'src/operation/DTO/service-job.dto';
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


  @ApiOperation({ summary:'Check if Service Job already exists' })
  @ApiCreatedResponse({
    description: 'Service Job already exists',
    type: ResponseData
  })
  @HttpCode(HttpStatus.OK)
  @UsePipes(new ValidationPipe({
    transform: true,
    whitelist: true,
    forbidNonWhitelisted: true,
  }))
  @Post('check-duplicate')
  async checkDuplicateServiceJob(@Body() payload : DuplicateCheckDTO) {
    const output = new ResponseData();
    try {
      const isDuplicate = await this.serviceJobService.checkDuplicateServiceJob(payload);
      this.logger.debug(`checkDuplicateServiceJob: ${JSON.stringify(isDuplicate)}`)
      output.data = isDuplicate;
      output.message = "Service Job already exists";
    } catch (error) {
      this.logger.warn(`checkDuplicateServiceJob: ${JSON.stringify(error), error}`)
      output.status = false;
      if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
        output.message = error.message;
      } else {
        output.message = error;
      }
    }
    return output
  }

   @ApiOperation({ summary: 'Get Audit Logs for a Table/Record' })
        @ApiCreatedResponse({ description: 'Fetch audit logs', type: ResponseData })
        @HttpCode(HttpStatus.OK)
        @Get('audit-logs')
        async getAuditLogs(
          @Query('tableName') tableName: string,
          @Query('recordId') recordId?: string,
        ) {
          const resp = new ResponseData();
          try {
            if (!tableName) throw new Error('tableName query parameter is required');
      
            const logs = await this.serviceJobService.getAuditLogs(tableName, recordId);
      
            // Remove updatedOn from oldVal and newVal
            resp.data = logs.map((log: any) => {
              const oldVal = log.oldVal ? { ...log.oldVal } : null;
              const newVal = log.newVal ? { ...log.newVal } : null;
              if (oldVal && 'updatedOn' in oldVal) delete oldVal.updatedOn;
              if (newVal && 'updatedOn' in newVal) delete newVal.updatedOn;
              return { ...log, oldVal, newVal };
            });
      
            resp.message = 'Audit logs fetched successfully';
          } catch (error) {
            this.logger.warn(`getAuditLogsError: ${error}`);
            resp.status = false;
            resp.message = error.message || 'Internal Server Error';
          }
          return resp;
        }

}
