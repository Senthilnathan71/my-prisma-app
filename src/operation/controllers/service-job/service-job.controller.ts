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
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { ApiBody, ApiCreatedResponse, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
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
  @Post('fetch')
  async findOne(@Body() payload: any) {
    const output = new ResponseData();
    try {
      const serviceJob = await this.serviceJobService.fetchServiceJobById(payload.HouseJobSid,payload.CompanyMasterSid,payload.BranchMasterSid);

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

  @ApiOperation({ summary: 'Download Service Job Excel template' })
  @HttpCode(HttpStatus.OK)
  @Get('template')
  async downloadServiceJobTemplate(
    @Query('CompanyMasterSid') CompanyMasterSid: number,
    @Query('BranchMasterSid') BranchMasterSid: number,
    @Res() res: Response
  ) {
    try {
      if (!CompanyMasterSid) throw new BadRequestException('CompanyMasterSid is required');
      if (!BranchMasterSid) throw new BadRequestException('BranchMasterSid is required');

      this.logger.log(`Generating Excel template for service job upload`);
      const buffer = await this.serviceJobService.generateServiceJobTemplate(
        Number(CompanyMasterSid),
        Number(BranchMasterSid),
      );

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', 'attachment; filename=ServiceJob_Upload_Template.xlsx');
      res.send(buffer);
    } catch (error) {
      this.logger.warn(`Error generating service job template: ${JSON.stringify(error)}, ${error}`);
      const status = error instanceof BadRequestException ? HttpStatus.BAD_REQUEST : HttpStatus.INTERNAL_SERVER_ERROR;
      res.status(status).json({ status: false, message: error.message || 'Error generating template' });
    }
  }

  @ApiOperation({ summary: 'Parse and validate Service Job Excel without saving' })
  @HttpCode(HttpStatus.OK)
  @Post('bulk-upload/parse')
  @UseInterceptors(FileInterceptor('file'))
  async parseServiceJobExcel(
    @UploadedFile() file: Express.Multer.File,
    @Body('CompanyMasterSid') CompanyMasterSid: string,
    @Body('BranchMasterSid') BranchMasterSid: string,
  ) {
    const resp = new ResponseData();
    try {
      if (!file) throw new BadRequestException('No file uploaded');

      const allowedMimeTypes = [
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.ms-excel',
      ];
      if (!allowedMimeTypes.includes(file.mimetype)) {
        throw new BadRequestException('Invalid file type. Only .xlsx or .xls allowed');
      }
      if (file.size > 5 * 1024 * 1024) {
        throw new BadRequestException('File size exceeds 5MB limit');
      }
      if (!CompanyMasterSid) throw new BadRequestException('CompanyMasterSid is required');
      if (!BranchMasterSid) throw new BadRequestException('BranchMasterSid is required');

      const result = await this.serviceJobService.parseServiceJobExcel(
        file.buffer,
        Number(CompanyMasterSid),
        Number(BranchMasterSid),
      );

      resp.status = true;
      resp.message = result.validRows.length
        ? `Parsed successfully. ${result.validRows.length} valid, ${result.invalidRows.length} invalid.`
        : 'No valid rows found. Please fix the errors and re-upload.';
      resp.data = result;
    } catch (error) {
      resp.status = false;
      this.logger.warn(`Error parsing service job Excel: ${JSON.stringify(error)}, ${error}`);
      resp.message = error instanceof BadRequestException ? error.message : 'Internal Server Error';
    }
    return resp;
  }

  @ApiOperation({ summary: 'Save validated Service Job Excel rows to DB' })
  @HttpCode(HttpStatus.OK)
  @Post('bulk-upload/save')
  async saveServiceJobExcel(
    @Body() payload: {
      validRows: any[];
      CompanyMasterSid: number;
      BranchMasterSid: number;
      createdBy: string;
    }
  ) {
    const resp = new ResponseData();
    try {
      const { validRows, CompanyMasterSid, BranchMasterSid, createdBy } = payload;

      if (!validRows?.length) throw new BadRequestException('No valid rows to save');
      if (!CompanyMasterSid) throw new BadRequestException('CompanyMasterSid is required');
      if (!BranchMasterSid) throw new BadRequestException('BranchMasterSid is required');
      if (!createdBy) throw new BadRequestException('createdBy is required');

      const result = await this.serviceJobService.saveServiceJobExcel(
        validRows,
        Number(CompanyMasterSid),
        Number(BranchMasterSid),
        createdBy,
      );

      resp.status = true;
      resp.message = `Import complete. ${result.created} created, ${result.skipped} skipped.`;
      resp.data = result;
    } catch (error) {
      resp.status = false;
      this.logger.warn(`Error saving service job Excel: ${JSON.stringify(error)}, ${error}`);
      resp.message = error instanceof BadRequestException ? error.message : 'Internal Server Error';
    }
    return resp;
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
