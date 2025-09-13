import { BadRequestException, Body, Controller, Delete, Get, HttpCode, HttpStatus, Logger, Param, ParseIntPipe, Patch, Post, Query, UnauthorizedException } from '@nestjs/common';
import { ApiCreatedResponse, ApiOperation } from '@nestjs/swagger';
import { ResponseData } from 'src/common/response-data';
import { MasterJobService } from 'src/operation/services/master-job/master-job.service';

@Controller('master-job')
export class MasterJobController {
    constructor(private masterJobService:MasterJobService,private logger:Logger){}

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
    @Get('fetch/:MasterJobSid')
    async getMasterJobById(@Param('MasterJobSid',ParseIntPipe) MasterJobSid:number){
        let resp = new ResponseData();
        try {
            this.logger.log(`Fetching Master Job by MasterJobSid : ${MasterJobSid}`);
            const result = await this.masterJobService.getMasterJobById(MasterJobSid);
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
    async detachBookingFromMasterJob(@Param('BookingHeaderSid', ParseIntPipe) BookingHeaderSid: number) {
      let resp = new ResponseData();
      try {
        this.logger.log(`Detaching Booking with id : ${BookingHeaderSid}`);
        const result = await this.masterJobService.detachBookingFromMasterJob(BookingHeaderSid);
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
}
