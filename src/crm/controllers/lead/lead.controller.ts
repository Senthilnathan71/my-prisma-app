import { BadRequestException, Body, Controller, Delete, Get, HttpCode, HttpStatus, Logger, Param, ParseIntPipe, Patch, Post, Query, UnauthorizedException } from '@nestjs/common';
import { ApiCreatedResponse, ApiOperation } from '@nestjs/swagger';
import { ResponseData } from 'src/common/response-data';
import { LeadService } from 'src/crm/services/lead/lead.service';
import { filterDto } from 'src/masters/DTO/search-vessel.dto';
class CompanyIdDto {
    CompanyMasterSid: number;
    BranchMasterSid: number;
}

@Controller('ff-lead')
export class LeadController {
    constructor(private leadService: LeadService, private logger: Logger) { }

    @ApiOperation({ summary: 'Create new Lead' })
    @ApiCreatedResponse({
        description: 'Create new Lead',
        type: ResponseData
    })
    @HttpCode(HttpStatus.CREATED)
    @Post('create')
    async createNewLead(@Body() newData: any) {
        let resp = new ResponseData();
        try {
            let res = await this.leadService.createNewLead(newData);
            this.logger.log(`New Lead Created : ${JSON.stringify(res)}`);
            resp.data = res;
            resp.message = "New Lead is successfully created"
        } catch (error) {
            this.logger.warn(`Lead Creation Error : ${JSON.stringify(error), error}`);
            resp.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                resp.message = error.message;
            } else {
                resp.message = "Internal Server Error";
            }
        }
        return resp;
    }

    @ApiOperation({ summary: 'Get All Leads' })
    @ApiCreatedResponse({
        description: 'Get All Lead',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Post()
    async getAllLead(@Body() body: CompanyIdDto) {
        let resp = new ResponseData();
        try {
            let res = await this.leadService.getAllLeads(body.CompanyMasterSid, body.BranchMasterSid);
            this.logger.log(`All Leads Fetched : ${JSON.stringify(res)}`);
            resp.data = res;
            resp.message = "All Leads are successfully fetched";
        } catch (error) {
            this.logger.warn(`Get All Leads Error : ${JSON.stringify(error), error}`);
            resp.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                resp.message = error.message;
            } else {
                resp.message = "Internal Server Error";
            }
        }
        return resp;
    }

    @ApiOperation({ summary: 'Get Leads by Id' })
    @ApiCreatedResponse({
        description: 'Get Leads by Id',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Get('fetch/:PreCustomerMasterSid')
    async getLeadById(@Param('PreCustomerMasterSid', ParseIntPipe) PreCustomerMasterSid: number) {
        let resp = new ResponseData();
        try {
            this.logger.log(`Getting Lead with id : ${PreCustomerMasterSid}`);
            let res = await this.leadService.fetchLeadById(PreCustomerMasterSid);
            this.logger.debug(`Fetched Lead : ${JSON.stringify(res)}`);
            resp.data = res;
            resp.message = `Lead with id : ${PreCustomerMasterSid} is successfully fetched`;
        } catch (error) {
            this.logger.warn(`Get Lead by Id Error : ${JSON.stringify(error), error}`);
            resp.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                resp.message = error.message;
            } else {
                resp.message = "Internal Server Error";
            }
        }
        return resp;
    }

    @ApiOperation({ summary: 'Update Lead by Id' })
    @ApiCreatedResponse({
        description: 'Update Lead by Id',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Patch('update/:PreCustomerMasterSid')
    async updateLeadById(@Param('PreCustomerMasterSid', ParseIntPipe) PreCustomerMasterSid: number, @Body() payload: any) {
        let resp = new ResponseData();
        try {
            this.logger.log(`Updating Lead with id : ${PreCustomerMasterSid}`);
            let res = await this.leadService.updateLeadById(PreCustomerMasterSid, payload);
            this.logger.debug(`Updated Lead : ${JSON.stringify(res)}`);
            resp.data = res;
            resp.message = `Lead with id : ${PreCustomerMasterSid} is successfully updated`;
        } catch (error) {
            this.logger.warn(`Lead Updation Error : ${JSON.stringify(error), error}`);
            resp.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                resp.message = error.message;
            } else {
                resp.message = "Internal Server Error";
            }
        }
        return resp;
    }

    @ApiOperation({ summary: 'Delete Lead by Id' })
    @ApiCreatedResponse({
        description: 'Delete Lead by Id',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Delete('delete/:PreCustomerMasterSid')
    async deleteLeadById(@Param('PreCustomerMasterSid', ParseIntPipe) PreCustomerMasterSid: number) {
        let resp = new ResponseData();
        try {
            this.logger.log(`Deleting Lead with id : ${PreCustomerMasterSid}`);
            let res = await this.leadService.deleteLead(PreCustomerMasterSid);
            this.logger.debug(`Deleted Lead : ${JSON.stringify(res)}`);
            resp.data = res;
            resp.message = `Lead with id : ${PreCustomerMasterSid} is successfully deleted`;
        } catch (error) {
            this.logger.warn(`Lead Deletion Error : ${JSON.stringify(error), error}`);
            resp.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                resp.message = error.message;
            } else {
                resp.message = "Internal Server Error";
            }
        }
        return resp;
    }

    @ApiOperation({ summary: 'Search List of Lead' })
    @ApiCreatedResponse({
        description: 'Search List of Lead',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Post('search-list')
    async searchLead(@Body() searchParams: filterDto) {
        let resp = new ResponseData();
        try {
            let res = await this.leadService.searchLead(searchParams);
            this.logger.log(`Lead Search Data : ${JSON.stringify(res)}`);
            resp.data = res;
            resp.message = "Lead Search is successfully fetched";
        } catch (error) {
            this.logger.warn(`Lead Search Error : ${JSON.stringify(error), error}`);
            resp.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                resp.message = error.message;
            } else {
                resp.message = "Internal Server Error";
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

            const logs = await this.leadService.getAuditLogs(tableName, recordId);

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