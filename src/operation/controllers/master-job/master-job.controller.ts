import { BadRequestException, Body, Controller, Delete, Get, HttpCode, HttpStatus, Logger, Param, ParseIntPipe, Patch, Post, Query, UnauthorizedException, UploadedFile, UseInterceptors, Res, StreamableFile } from '@nestjs/common';
import { ApiCreatedResponse, ApiOperation, ApiConsumes } from '@nestjs/swagger';
import { ResponseData } from 'src/common/response-data';
import { MasterJobService } from 'src/operation/services/master-job/master-job.service';
import { FileInterceptor } from '@nestjs/platform-express';
import { ExcelParserService } from 'src/common/services/excel-parser/excel-parser.service';
import { Response } from 'express';
import { ReportEmailService } from 'src/common/services/report-email.service';
import { SendReportEmailDto, SendReportEmailResponseDto } from 'src/common/dto/report.dto';
import { EDIManifestService } from 'src/operation/services/edi-manifest/edi-manifest.service';

@Controller('master-job')
export class MasterJobController {
    constructor(
        private masterJobService:MasterJobService,
        private excelParserService:ExcelParserService,
        private reportEmailService:ReportEmailService,
        private ediManifestService:EDIManifestService,
        private logger:Logger
    ){}

    @ApiOperation({ summary: 'Create Master Job' })
    @ApiCreatedResponse({
        description: 'Create Master Job',
        type: ResponseData
    })
    @HttpCode(HttpStatus.CREATED)
    @Post('create')
    async createMasterJob(@Body() payload:any){
        let resp = new ResponseData();
        try {
            this.logger.log(`Creating Master Job : ${JSON.stringify(payload)}`);
            const result = await this.masterJobService.createNewMasterJob(payload);
            this.logger.debug(`Created Master Job : ${JSON.stringify(result)}`);
            resp.data = result;
            resp.message = 'Master Job Created Successfully';
        } catch (error) {
            resp.status = false;
            this.logger.warn(`Error in creating Master Job : ${JSON.stringify(error),error}`);
            if(error instanceof BadRequestException || error instanceof UnauthorizedException){
                resp.message = error.message;
            } else {
                resp.message = 'Internal Server Error';
            }
        }
        return resp;
    }

    @ApiOperation({ summary: 'Get All Master Job by Department' })
    @ApiCreatedResponse({
        description: 'Get All Master Job by Department',
        type: ResponseData
    })
    @HttpCode(HttpStatus.CREATED)
    @Post('filter-by-department')
    async getAllMasterJobsByDepartment(@Body() payload:any){
        let resp = new ResponseData();
        try {
            if(!payload.DepartmentMasterSid){
                throw new BadRequestException('Department Master Sid is required');
            }
            if(!payload.CompanyMasterSid){
                throw new BadRequestException('Company Master Sid is required');
            }
            if(!payload.BranchMasterSid){
                throw new BadRequestException('Branch Master Sid is required');
            }
            this.logger.log(`Getting All Master Job by Department : ${JSON.stringify(payload)}`);
            const result = await this.masterJobService.getMasterJobByDepartmentid(payload);
            this.logger.debug(`Fetched All Master Job by Department : ${JSON.stringify(result)}`);
            resp.message = 'All Master Job by Department fetched successfully';
            resp.data = result;
        } catch (error) {
            resp.status = false;
            this.logger.warn(`Error in getting All Master Job by Department : ${JSON.stringify(error),error}`);
            if(error instanceof BadRequestException || error instanceof UnauthorizedException){
                resp.message = error.message;
            } else {
                resp.message = 'Internal Server Error';
            }
        }
        return resp;
    }

    @ApiOperation({ summary: 'Get All Master Jobs' })
    @ApiCreatedResponse({
        description: 'Get All Master Jobs',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Post()
    async getAllMasterJobs(@Body() payload:any){
        let resp = new ResponseData();
        try {
            this.logger.log(`Fetching all Master Jobs`);
            const result = await this.masterJobService.getAllMasterJobs(payload);
            this.logger.debug(`Fetched all Master Jobs : ${JSON.stringify(result)}`);
            resp.message = 'All Master Jobs fetched successfully';
            resp.data = result;
        } catch (error) {
            resp.status = false;
            this.logger.warn(`Error in fetching all Master Jobs : ${JSON.stringify(error),error}`);
            if(error instanceof BadRequestException || error instanceof UnauthorizedException){
                resp.message = error.message;
            } else {
                resp.message = 'Internal Server Error';
            }
        }
        return resp;
    }

    @ApiOperation({ summary: 'Get Master Job by MasterJobSid' })
    @ApiCreatedResponse({
        description: 'Get Master Job by MasterJobSid',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Post('fetch')
    async getMasterJobById(
        @Body() payload:{MasterJobSid:number,screenName:string}
    ){
        let resp = new ResponseData();
        try {
            if(!payload.MasterJobSid){
                throw new BadRequestException('Master Job Sid is required');
            }
            if(!payload.screenName){
                throw new BadRequestException('screenName is required');
            }
            this.logger.log(`Fetching Master Job by MasterJobSid : ${JSON.stringify(payload)}`);
            const result = await this.masterJobService.getMasterJobById(payload);
            this.logger.debug(`Fetched Master Job by MasterJobSid : ${JSON.stringify(result)}`);
            resp.message = 'Master Job fetched successfully';
            resp.data = result;
        } catch (error) {
            resp.status = false;
            this.logger.warn(`Error in fetching Master Job by MasterJobSid : ${JSON.stringify(error),error}`);
            if(error instanceof BadRequestException || error instanceof UnauthorizedException){
                resp.message = error.message;
            } else {
                resp.message = 'Internal Server Error';
            }
        }
        return resp;
    }

    @ApiOperation({ summary: 'Update Master Job' })
    @ApiCreatedResponse({
        description: 'Update Master Job',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Patch('update')
    async updateMasterJob(@Body() payload:any){
        let resp = new ResponseData();
        try {
            this.logger.log(`Updating Master Job : ${JSON.stringify(payload)}`);
            const result = await this.masterJobService.updateMasterJob(payload);
            this.logger.debug(`Updated Master Job : ${JSON.stringify(result)}`);
            resp.data = result;
            resp.message = 'Master Job Updated Successfully';
        } catch (error) {
            resp.status = false;
            this.logger.warn(`Error in updating Master Job : ${JSON.stringify(error),error}`);
            if(error instanceof BadRequestException || error instanceof UnauthorizedException){
                resp.message = error.message;
            } else {
                resp.message = 'Internal Server Error';
            }
        }
        return resp;
    }

    @ApiOperation({ summary: 'Delete Master Job by MasterJobSid' })
    @ApiCreatedResponse({
        description: 'Delete Master Job by MasterJobSid',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Delete('delete/:MasterJobSid')
    async deleteMasterJobById(@Param('MasterJobSid',ParseIntPipe) MasterJobSid:number){
        let resp = new ResponseData();
        try {
            this.logger.log(`Deleting Master Job by MasterJobSid : ${MasterJobSid}`);
            const result = await this.masterJobService.deleteMasterJob(MasterJobSid);
            this.logger.debug(`Deleted Master Job by MasterJobSid : ${JSON.stringify(result)}`);
            resp.message = 'Master Job deleted successfully';
        } catch (error) {
            resp.status = false;
            this.logger.warn(`Error in deleting Master Job by MasterJobSid : ${JSON.stringify(error),error}`);
            if(error instanceof BadRequestException || error instanceof UnauthorizedException){
                resp.message = error.message;
            } else {
                resp.message = 'Internal Server Error';
            }
        }
        return resp;
    }

    @ApiOperation({ summary : "Detach booking from Master Job"})
    @ApiCreatedResponse({
      description: 'Successfully detached booking from Master Job',
      type: ResponseData,
    })
    @HttpCode(HttpStatus.OK)
    @Delete('detach/:BookingHeaderSid')
    async detachBookingFromMasterJob(
        @Param('BookingHeaderSid', ParseIntPipe) BookingHeaderSid: number,
        @Query('userEmail') userEmail: string
    ) {
      let resp = new ResponseData();
      try {
        this.logger.log(`Detaching Booking with id : ${BookingHeaderSid}`);
        const result = await this.masterJobService.detachBookingFromMasterJob(BookingHeaderSid,userEmail);
        this.logger.debug(`Detached Booking with id : ${BookingHeaderSid}`);
        resp.data = result;
        resp.message = `Booking with id: ${BookingHeaderSid} is successfully detached from Master Job`;
      } catch (error) {
        resp.status = false;
        this.logger.warn(`Error in detaching Booking with id : ${BookingHeaderSid} : ${JSON.stringify(error), error}`);
        if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
          resp.message = error.message;
        } else {
          resp.message = 'Internal Server Error';
        }
      }
      return resp;
    }

    // create post endpoint for searchMasterJob
    @ApiOperation({ summary: 'Search Master Jobs' })
    @ApiCreatedResponse({
        description: 'Search Master Jobs',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Post('search-list')
    async searchMasterJob(@Body() payload:any){
        let resp = new ResponseData();
        try {
            this.logger.log(`Searching Master Jobs with params : ${JSON.stringify(payload)}`);
            const result = await this.masterJobService.searchMasterJobList(payload);
            this.logger.debug(`Searched Master Jobs : ${JSON.stringify(result)}`);
            resp.message = 'Master Jobs fetched successfully';
            resp.data = result;
        } catch (error) {
            resp.status = false;
            this.logger.warn(`Error in searching Master Jobs : ${JSON.stringify(error),error}`);
            if(error instanceof BadRequestException || error instanceof UnauthorizedException){
                resp.message = error.message;
            } else {
                resp.message = 'Internal Server Error';
            }
        }
        return resp;
    }


     // Job Close Endpoints
    @ApiOperation({ summary: 'Search Job Close Master Jobs' })
    @ApiCreatedResponse({
        description: 'Search Job Close Master Jobs',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Post('job-close/search-list')
    async searchJobCloseMasterJob(@Body() payload:any){
        let resp = new ResponseData();
        try {
            this.logger.log(`Searching Job Close Master Jobs with params : ${JSON.stringify(payload)}`);
            const result = await this.masterJobService.searchJobCloseMasterJobList(payload);
            this.logger.debug(`Searched Job Close Master Jobs : ${JSON.stringify(result)}`);
            resp.message = 'Master Jobs fetched successfully';
            resp.data = result;
        } catch (error) {
            resp.status = false;
            this.logger.warn(`Error in searching Job Close Master Jobs : ${JSON.stringify(error),error}`);
            if(error instanceof BadRequestException || error instanceof UnauthorizedException){
                resp.message = error.message;
            } else {
                resp.message = 'Internal Server Error';
            }
        }
        return resp;
    }

    @ApiOperation({ summary: 'Get Job Close Detail' })
    @ApiCreatedResponse({
        description: 'Get Job Close Detail by MasterJobSid',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Get('job-close/detail/:MasterJobSid')
    async getJobCloseDetail(@Param('MasterJobSid', ParseIntPipe) MasterJobSid: number){
        let resp = new ResponseData();
        try {
            this.logger.log(`Getting Job Close Detail for MasterJobSid : ${MasterJobSid}`);
            const result = await this.masterJobService.getJobCloseDetail(MasterJobSid);
            this.logger.debug(`Got Job Close Detail : ${JSON.stringify(result)}`);
            resp.message = 'Job Close detail fetched successfully';
            resp.data = result;
        } catch (error) {
            resp.status = false;
            this.logger.warn(`Error in getting Job Close Detail : ${JSON.stringify(error),error}`);
            if(error instanceof BadRequestException || error instanceof UnauthorizedException){
                resp.message = error.message;
            } else {
                resp.message = 'Internal Server Error';
            }
        }
        return resp;
    }

    @ApiOperation({ summary: 'Save Job Close Status' })
    @ApiCreatedResponse({
        description: 'Save Job Close Status',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Patch('job-close/save')
    async saveJobCloseStatus(@Body() payload: any){
        let resp = new ResponseData();
        try {
            this.logger.log(`Saving Job Close Status : ${JSON.stringify(payload)}`);
            const result = await this.masterJobService.saveJobCloseStatus(payload);
            this.logger.debug(`Saved Job Close Status : ${JSON.stringify(result)}`);
            resp.message = 'Job Close status saved successfully';
            resp.data = result;
        } catch (error) {
            resp.status = false;
            this.logger.warn(`Error in saving Job Close Status : ${JSON.stringify(error),error}`);
            if(error instanceof BadRequestException || error instanceof UnauthorizedException){
                resp.message = error.message;
            } else {
                resp.message = 'Internal Server Error';
            }
        }
        return resp;
    }

    @ApiOperation({ summary: 'Delete Master Job Connection by MasterJobConnectionSid' })
    @ApiCreatedResponse({
        description: 'Delete Master Job Container by MasterJobConnectionSid',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Delete('connection/delete/:MasterJobConnectionSid')
    async softDeleteMasterJobContainer(@Param('MasterJobConnectionSid',ParseIntPipe) MasterJobConnectionSid:number){
        let resp = new ResponseData();
        try {
            this.logger.log(`Soft Deleting Master Job Connection by MasterJobConnectionSid : ${MasterJobConnectionSid}`);
            const result = await this.masterJobService.softDeleteMasterJobConnection(MasterJobConnectionSid);
            this.logger.debug(`Soft Deleted Master Job Connection by MasterJobConnectionSid : ${JSON.stringify(result)}`);
            resp.message = 'Master Job Connection soft deleted successfully';
        } catch (error) {
            resp.status = false;
            this.logger.warn(`Error in soft deleting Master Job Connection by MasterJobConnectionSid : ${JSON.stringify(error),error}`);
            if(error instanceof BadRequestException || error instanceof UnauthorizedException){
                resp.message = error.message;
            } else {
                resp.message = 'Internal Server Error';
            }
        }
        return resp;
    }

    @ApiOperation({ summary: 'Soft Delete Master Job Container by MasterJobContainerSid' })
    @ApiCreatedResponse({
        description: 'Soft Delete Master Job Container by MasterJobContainerSid',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Delete('container/delete/:MasterJobContainerSid')
    async softDeleteMasterJobContainerById(@Param('MasterJobContainerSid',ParseIntPipe) MasterJobContainerSid:number){
        let resp = new ResponseData();
        try {
            this.logger.log(`Soft Deleting Master Job Container by MasterJobContainerSid : ${MasterJobContainerSid}`);
            const result = await this.masterJobService.softDeleteMasterJobContainer(MasterJobContainerSid);
            this.logger.debug(`Soft Deleted Master Job Container by MasterJobContainerSid : ${JSON.stringify(result)}`);
            resp.message = 'Master Job Container soft deleted successfully';
        } catch (error) {
            resp.status = false;
            this.logger.warn(`Error in soft deleting Master Job Container by MasterJobContainerSid : ${JSON.stringify(error),error}`);
            if(error instanceof BadRequestException || error instanceof UnauthorizedException){
                resp.message = error.message;
            } else {
                resp.message = 'Internal Server Error';
            }
        }
        return resp;
    }

    @ApiOperation({ summary: 'Soft Delete Container Activity by ContainerActivitySid' })
    @ApiCreatedResponse({
        description: 'Soft Delete Container Activity by ContainerActivitySid',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Delete('container-activity/delete/:ContainerActivitySid')
    async softDeleteContainerActivityById(@Param('ContainerActivitySid',ParseIntPipe) ContainerActivitySid:number){
        let resp = new ResponseData();
        try {
            this.logger.log(`Soft Deleting Container Activity by ContainerActivitySid : ${ContainerActivitySid}`);
            const result = await this.masterJobService.softDeleteContainerActivity(ContainerActivitySid);
            this.logger.debug(`Soft Deleted Container Activity by ContainerActivitySid : ${JSON.stringify(result)}`);
            resp.message = 'Container Activity soft deleted successfully';
        } catch (error) {
            resp.status = false;
            this.logger.warn(`Error in soft deleting Container Activity by ContainerActivitySid : ${JSON.stringify(error),error}`);
            if(error instanceof BadRequestException || error instanceof UnauthorizedException){
                resp.message = error.message;
            } else {
                resp.message = 'Internal Server Error';
            }
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
        
              const logs = await this.masterJobService.getAuditLogs(tableName, recordId);
        
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

    @ApiOperation({ summary: 'Create House Job with Booking' })
    @ApiCreatedResponse({
        description: 'Create House Job with Booking',
        type: ResponseData
    })
    @HttpCode(HttpStatus.CREATED)
    @Post('attach')
    async createHouseJobWithBooking(@Body() payload:number[]){
        let resp = new ResponseData();
        try {
            this.logger.log(`Creating House Job with Booking : ${JSON.stringify(payload)}`);
            const result = await this.masterJobService.createHouseJobWithBooking(payload);
            this.logger.debug(`Created House Job with Booking : ${JSON.stringify(result)}`);
            resp.data = result;
            resp.message = 'House Job with Booking created successfully';
        } catch (error) {
            resp.status = false;
            this.logger.warn(`Error in creating House Job with Booking : ${JSON.stringify(error),error}`);
            if(error instanceof BadRequestException || error instanceof UnauthorizedException){
                resp.message = error.message;
            } else {
                resp.message = 'Internal Server Error';
            }

        }
        return resp;
    }

    @ApiOperation({ summary: 'Upload Excel file and parse Master Job + House Jobs data' })
    @ApiCreatedResponse({
        description: 'Parse Excel file and return preview data for validation',
        type: ResponseData
    })
    @ApiConsumes('multipart/form-data')
    @HttpCode(HttpStatus.OK)
    @Post('bulk-upload/parse')
    @UseInterceptors(FileInterceptor('file'))
    async parseExcelFile(@UploadedFile() file: Express.Multer.File){
        let resp = new ResponseData();
        try {
            this.logger.log(`Parsing Excel file for bulk upload`);

            if (!file) {
                throw new BadRequestException('No file uploaded');
            }

            // Validate file type
            const allowedMimeTypes = [
                'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                'application/vnd.ms-excel'
            ];

            if (!allowedMimeTypes.includes(file.mimetype)) {
                throw new BadRequestException('Invalid file type. Only Excel files (.xlsx, .xls) are allowed');
            }

            // Validate file size (5MB max)
            if (file.size > 5 * 1024 * 1024) {
                throw new BadRequestException('File size exceeds 5MB limit');
            }

            // Parse Excel file
            const { masterJob, houseJobs, errors } = this.excelParserService.parseExcelFile(file.buffer);

            if (errors && errors.length > 0) {
                resp.status = false;
                resp.message = 'Excel file has validation errors';
                resp.data = { errors };
                return resp;
            }

            this.logger.debug(`Parsed Excel successfully: Master Job and ${houseJobs.length} House Jobs`);

            resp.message = 'Excel file parsed successfully';
            resp.data = {
                masterJob,
                houseJobs,
                totalHouseJobs: houseJobs.length
            };

        } catch (error) {
            resp.status = false;
            this.logger.warn(`Error parsing Excel file: ${JSON.stringify(error)}, ${error}`);
            if(error instanceof BadRequestException || error instanceof UnauthorizedException){
                resp.message = error.message;
            } else {
                resp.message = 'Internal Server Error';
            }
        }
        return resp;
    }

    @ApiOperation({ summary: 'Process bulk upload and create Master Job with House Jobs' })
    @ApiCreatedResponse({
        description: 'Create Master Job and House Jobs from parsed data',
        type: ResponseData
    })
    @HttpCode(HttpStatus.CREATED)
    @Post('bulk-upload/process')
    async processBulkUpload(@Body() payload: any){
        let resp = new ResponseData();
        try {
            this.logger.log(`Processing bulk upload: ${JSON.stringify(payload)}`);

            const { masterJob, houseJobs, containers, voyages, connections, others, companyMasterSid, branchMasterSid, createdBy } = payload;

            if (!masterJob || !houseJobs || houseJobs.length === 0) {
                throw new BadRequestException('Invalid payload: Master Job and House Jobs data required');
            }

            // Validate the data
            const validationErrors = await this.masterJobService.validateBulkUploadData(
                masterJob,
                houseJobs,
                companyMasterSid,
                containers,
                voyages,
                connections,
                others
            );

            if (validationErrors && validationErrors.length > 0) {
                resp.status = false;
                resp.message = 'Validation failed';
                resp.data = { errors: validationErrors };
                return resp;
            }

            // Process bulk upload
            const result = await this.masterJobService.processBulkUpload(
                masterJob,
                houseJobs,
                companyMasterSid,
                branchMasterSid,
                createdBy,
                containers,
                voyages,
                connections,
                others
            );

            this.logger.debug(`Bulk upload processed: ${JSON.stringify(result)}`);

            // Check if service returned an error (e.g., duplicate MBL Number)
            if (result && typeof result === 'object' && 'status' in result && result.status === false) {
                resp.status = false;
                resp.message = (result as any).message;
                resp.data = (result as any).data;
            } else {
                resp.message = 'Master Job and House Jobs created successfully';
                resp.data = result;
            }

        } catch (error) {
            resp.status = false;
            this.logger.warn(`Error processing bulk upload: ${JSON.stringify(error)}, ${error}`);
            if(error instanceof BadRequestException || error instanceof UnauthorizedException){
                resp.message = error.message;
            } else {
                resp.message = 'Internal Server Error';
            }
        }
        return resp;
    }

    @ApiOperation({ summary: 'Download Excel template for bulk upload' })
    @ApiCreatedResponse({
        description: 'Download Excel template with sample data',
    })
    @HttpCode(HttpStatus.OK)
    @Get('bulk-upload/template')
    async downloadTemplate(@Res() res: Response){
        try {
            this.logger.log(`Generating Excel template for bulk upload`);

            const buffer = await this.excelParserService.generateTemplate();

            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            res.setHeader('Content-Disposition', 'attachment; filename=Master_Job_Upload_Template.xlsx');
            res.send(buffer);

        } catch (error) {
            this.logger.warn(`Error generating template: ${JSON.stringify(error)}, ${error}`);
            res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
                status: false,
                message: 'Error generating template'
            });
        }
    }

    /**
     * Get report data for specified report type
     */
    @ApiOperation({ summary: 'Get report data for master job' })
    @ApiCreatedResponse({
        description: 'Get report data for master job',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Get(':id/report-data')
    async getReportData(
        @Param('id', ParseIntPipe) id: number,
        @Query('reportType') reportType: string,
    ){
        let resp = new ResponseData();
        try {
            this.logger.log(`Fetching report data for Master Job ID: ${id}, Report Type: ${reportType}`);
            const result = await this.masterJobService.getReportData(id, reportType);
            this.logger.debug(`Fetched report data: ${JSON.stringify(result)}`);
            resp.message = 'Report data fetched successfully';
            resp.data = result;
        } catch (error) {
            resp.status = false;
            this.logger.warn(`Error fetching report data: ${JSON.stringify(error)}, ${error}`);
        }
        return resp;
    }

    @ApiOperation({ summary: 'Create Booking From Master Job' })
    @ApiCreatedResponse({
        description: 'Create Booking from Master Job',
        type: ResponseData
    })
    @HttpCode(HttpStatus.CREATED)
    @Post('booking-create/transhipment')
    async createBookingFromMasterJob(@Body() payload:any){
        let resp = new ResponseData();
        try {
            this.logger.log(`Creating Booking From Master Job : ${JSON.stringify(payload)}`);
            const result = await this.masterJobService.createBookingFromMasterJob(payload);
            this.logger.debug(`Creating Booking From Master Job : ${JSON.stringify(result)}`);
            resp.data = result;
            resp.message = 'Booking Created From Master Job Successfully';
        } catch (error) {
            resp.status = false;
            this.logger.warn(`Error in creating booking from Master Job : ${JSON.stringify(error),error}`);
            if(error instanceof BadRequestException || error instanceof UnauthorizedException){
                resp.message = error.message;
            } else {
                resp.message = 'Internal Server Error';
            }
        }
        return resp;
    }

    /**
     * Send report email with PDF attachment
     */
    @ApiOperation({ summary: 'Send report email' })
    @ApiCreatedResponse({
        description: 'Send report email with PDF attachment',
        type: SendReportEmailResponseDto
    })
    @HttpCode(HttpStatus.OK)
    @Post('send-email')
    @UseInterceptors(FileInterceptor('file'))
    async sendReportEmail(
        @UploadedFile() file: Express.Multer.File,
        @Body() body: SendReportEmailDto,
    ){
        let resp = new ResponseData();
        try {
            this.logger.log(`Sending report email for type: ${body.ReportType}`);

            if (!file) {
                throw new BadRequestException('PDF file is required');
            }

            const options = {
                reportType: body.ReportType,
                recipients: {
                    to: body.EmailTo,
                    cc: body.EmailCC,
                    bcc: body.EmailBCC,
                },
                subject: body.Subject,
                body: body.Mailbody,
                attachments: [
                    {
                        filename: file.originalname,
                        content: file.buffer,
                        contentType: file.mimetype,
                    },
                ],
            };

            const result = await this.reportEmailService.sendReportEmail(options);

            resp.data = {
                success: result,
                message: result ? 'Email sent successfully' : 'Failed to send email',
            };
            resp.message = result ? 'Email sent successfully' : 'Failed to send email';

        } catch (error) {
            resp.status = false;
            this.logger.warn(`Error sending report email: ${JSON.stringify(error)}, ${error}`);
            if(error instanceof BadRequestException || error instanceof UnauthorizedException){
                resp.message = error.message;
            } else {
                resp.message = 'Internal Server Error';
            }
        }
        return resp;
    }

    @ApiOperation({ summary: 'Generate EDI Manifest for Master Job' })
    @HttpCode(HttpStatus.OK)
    @Get('edi-manifest/:id')
    async generateEDIManifest(
        @Param('id', ParseIntPipe) id: number,
        @Res() res: Response
    ) {
        try {
            this.logger.log(`Generating EDI Manifest for Master Job ID: ${id}`);
            const manifestText = await this.ediManifestService.generateMasterJobManifest(id);
            this.logger.debug(`EDI Manifest generated successfully for Master Job ID: ${id}`);

            res.setHeader('Content-Type', 'text/plain');
            res.setHeader('Content-Disposition', `attachment; filename="EDI_Manifest_MasterJob_${id}_${Date.now()}.txt"`);
            res.send(manifestText);
        } catch (error) {
            this.logger.warn(`Error generating EDI Manifest for Master Job ID ${id}: ${JSON.stringify(error)}, ${error}`);
            if (error instanceof BadRequestException) {
                const response = error.getResponse() as any;
                res.status(HttpStatus.BAD_REQUEST).json({
                    status: false,
                    message: response?.message || error.message || 'Failed to generate EDI manifest',
                    errors: response?.errors || [],
                });
            } else {
                res.status(HttpStatus.BAD_REQUEST).json({
                    status: false,
                    message: 'Failed to generate EDI manifest',
                });
            }
        }
    }

    @ApiOperation({ summary: 'Get Master Job AR/AP Data'})
    @ApiCreatedResponse({
        description:'Master Job AR/AP data fetched successfully',
        type:ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Get('arap-data/:MasterJobSid')
    async getMasterJobARAPData(@Param('MasterJobSid',ParseIntPipe) MasterJobSid:number){
        let resp = new ResponseData();
        try {
            this.logger.log(`Fetching Master Job AR/AP data: ${MasterJobSid}`);
            const arapData = await this.masterJobService.getMasterJobARAPData(MasterJobSid);
            this.logger.debug(`Master Job AR/AP data fetched: ${JSON.stringify(arapData)}`);
            resp.message = 'Master Job AR/AP data fetched successfully';
            resp.data = arapData;
        } catch (error) {
            resp.status = false;
            this.logger.warn(`Error fetching Master Job AR/AP data: ${JSON.stringify(error),error}`);
            if(error instanceof BadRequestException || error instanceof UnauthorizedException){
                resp.message = error.message;
            } else {
                resp.message = 'Internal Server Error';
            }
        }
        return resp;
    }


      @ApiOperation({
        summary: 'Get House Job by HouseJobSid',
    })
    @ApiCreatedResponse({
        description: 'Get House Job by HouseJobSid',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Post('fetch/:MasterJobSid')
    async getHouseJobById(@Param('MasterJobSid', ParseIntPipe) MasterJobSid: number) {
        let resp = new ResponseData();
        try {
            this.logger.log(`Fetching House Job by HouseJobSid : ${MasterJobSid}`);
            const result = await this.masterJobService.getAllHouseJobById(MasterJobSid);
            this.logger.debug(`Fetched House Job by HouseJobSid : ${JSON.stringify(result)}`);
            resp.message = 'House Job fetched successfully';
            resp.data = result;
        } catch (error) {
            resp.status = false;
            this.logger.warn(`Error in fetching House Job by HouseJobSid : ${JSON.stringify(error), error}`);
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                resp.message = error.message;
            } else {
                resp.message = 'Internal Server Error';
            }
        }
        return resp;
    }


    @ApiOperation({ summary: 'Download Container Excel template' })
@ApiCreatedResponse({
    description: 'Download Excel template for container bulk upload',
})
@HttpCode(HttpStatus.OK)
@Get('container/template')
async downloadContainerTemplate(@Res() res: Response) {
    try {
        this.logger.log(`Generating Excel template for container upload`);
        const buffer = await this.excelParserService.generateContainerTemplate();
        
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename=Container_Upload_Template.xlsx');
        res.send(buffer);
    } catch (error) {
        this.logger.warn(`Error generating container template: ${JSON.stringify(error)}, ${error}`);
        res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
            status: false,
            message: 'Error generating template'
        });
    }
}
@ApiOperation({ summary: 'Parse Excel file for container bulk upload' })
@ApiCreatedResponse({
    description: 'Parse Excel file and return container data',
    type: ResponseData
})
@ApiConsumes('multipart/form-data')
@HttpCode(HttpStatus.OK)
@Post('container/bulk-upload/parse')
@UseInterceptors(FileInterceptor('file'))
async parseContainerExcelFile(@UploadedFile() file: Express.Multer.File) {
    let resp = new ResponseData();
    try {
        this.logger.log(`Parsing Excel file for container bulk upload`);

        if (!file) {
            throw new BadRequestException('No file uploaded');
        }

        // Validate file type
        const allowedMimeTypes = [
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'application/vnd.ms-excel'
        ];

        if (!allowedMimeTypes.includes(file.mimetype)) {
            throw new BadRequestException('Invalid file type. Only Excel files (.xlsx, .xls) are allowed');
        }

        // Validate file size (5MB max)
        if (file.size > 5 * 1024 * 1024) {
            throw new BadRequestException('File size exceeds 5MB limit');
        }

        // Parse Excel file for containers
        const { containers, errors } = await this.excelParserService.parseContainerExcelFile(file.buffer);

        if (errors && errors.length > 0) {
            resp.status = false;
            resp.message = 'Excel file has validation errors';
            resp.data = { errors };
            return resp;
        }

        this.logger.debug(`Parsed Excel successfully: ${containers.length} containers`);

        resp.message = 'Excel file parsed successfully';
        resp.data = {
            containers,
            totalContainers: containers.length
        };

    } catch (error) {
        resp.status = false;
        this.logger.warn(`Error parsing Excel file: ${JSON.stringify(error)}, ${error}`);
        if (error instanceof BadRequestException) {
            resp.message = error.message;
        } else {
            resp.message = 'Internal Server Error';
        }
    }
    return resp;
}


@ApiOperation({ summary: 'Process container bulk upload' })
@ApiCreatedResponse({
    description: 'Process and validate container data from Excel',
    type: ResponseData
})
@HttpCode(HttpStatus.OK)
@Post('container/bulk-upload/validate')
async validateContainerBulkUpload(
    @Body() payload: {
        containers: any[];
        masterJobSid?: number;
        companyMasterSid: number;
        branchMasterSid: number;
        createdBy: string;
    }
) {
    let resp = new ResponseData();
    try {
        this.logger.log(`Validating container bulk upload data`);
        
        const { containers, masterJobSid, companyMasterSid, branchMasterSid, createdBy } = payload;

        if (!containers || containers.length === 0) {
            throw new BadRequestException('No container data provided');
        }

        // Validate container data
        const validationErrors = await this.masterJobService.validateContainerData(
            containers,
            companyMasterSid,
            branchMasterSid
        );

        if (validationErrors && validationErrors.length > 0) {
            resp.status = false;
            resp.message = 'Container validation failed';
            resp.data = { errors: validationErrors };
            return resp;
        }

        // Format containers with proper data types
        const formattedContainers = containers.map(container => ({
            ...container,
            ContainerType: container.ContainerType ? Number(container.ContainerType) : null,
            PkgType: container.PkgType ? Number(container.PkgType) : null,
            NoOfPkg: container.NoOfPkg ? Number(container.NoOfPkg) : 0,
            GrossWeight: container.GrossWeight ? Number(container.GrossWeight) : 0,
            NetWeight: container.NetWeight ? Number(container.NetWeight) : 0,
            ChargeableWeight: container.ChargeableWeight ? Number(container.ChargeableWeight) : 0,
            Volume: container.Volume ? Number(container.Volume) : 0,
            IsSoc: container.IsSoc === 'Y' || container.IsSoc === true || container.IsSoc === 'Yes'
        }));

        resp.message = 'Container data validated successfully';
        resp.data = { containers: formattedContainers };

    } catch (error) {
        resp.status = false;
        this.logger.warn(`Error validating container data: ${JSON.stringify(error)}, ${error}`);
        if (error instanceof BadRequestException) {
            resp.message = error.message;
        } else {
            resp.message = 'Internal Server Error';
        }
    }
    return resp;
}

@Get('download-product-template')
  async downloadProductTemplate(
    @Query('masterJobSid') masterJobSid: number
  ) {
    try {
      const buffer = await this.excelParserService.generateProductTemplate(
        Number(masterJobSid)
      );

      return new StreamableFile(buffer, {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        disposition: `attachment; filename="Product_Template_${masterJobSid}_${new Date()
          .toISOString()
          .slice(0, 10)}.xlsx"`,
      });
    } catch (error) {
      throw new BadRequestException('Failed to generate product template');
    }
  }

@Post('parse-product-excel')
@UseInterceptors(FileInterceptor('file'))
async parseProductExcel(
    @UploadedFile() file: Express.Multer.File
) {
    try {
        const result = await this.excelParserService.parseProductExcelFile(file.buffer);
        
        return {
            status: true,
            message: 'Excel parsed successfully',
            data: result
        };
    } catch (error) {
        return {
            status: false,
            message: error.message,
            data: null
        };
    }
}
@Post('validate-product-data')
async validateProductData(@Body() payload: any) {
    try {
        const errors = await this.masterJobService.validateProductData(
            payload.products,
            payload.companyMasterSid,
            payload.branchMasterSid,
            payload.masterJobSid
        );
        
        return {
            status: errors.length === 0,
            message: errors.length === 0 ? 'Validation passed' : 'Validation failed',
            data: { errors }
        };
    } catch (error) {
        return {
            status: false,
            message: error.message,
            data: null
        };
    }
}

@Post('process-product-upload')
async processProductUpload(@Body() payload: any) {
    try {
        const result = await this.masterJobService.processProductUpload(
            payload.products,
            payload.companyMasterSid,
            payload.branchMasterSid,
            payload.masterJobSid,
            payload.createdBy
        );
        
        return {
            status: true,
            message: result.message,
            data: result
        };
    } catch (error) {
        return {
            status: false,
            message: error.message,
            data: null
        };
    }
}
}
