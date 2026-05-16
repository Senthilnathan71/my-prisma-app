import { BadRequestException, Body, Controller, Delete, Get, HttpCode, HttpStatus, Logger, Param, ParseIntPipe, Patch, Post, UnauthorizedException } from '@nestjs/common';
import { ApiCreatedResponse, ApiOperation } from '@nestjs/swagger';
import { ResponseData } from 'src/common/response-data';
import { PreCustomerMeetingService } from 'src/crm/services/PreCustomerMeeting/pre-customer-meeting/pre-customer-meeting.service';
import { SearchListDto } from 'src/masters/DTO/search-list.dto';
import { filterDto } from 'src/masters/DTO/search-vessel.dto';

class CompanyIdDto {
  CompanyMasterSid: number;
  BranchMasterSid: number;
  userTypeCode?: string;
  userId?: number;
}
@Controller('pre-customer-meeting')
export class PreCustomerMeetingController {
    constructor(
        private preCustomerMeetingService: PreCustomerMeetingService,
        private logger: Logger
    ) { }

    @ApiOperation({ summary: 'Create new PreCustomerMeeting' })
    @ApiCreatedResponse({
        description: 'Create new PreCustomerMeeting',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Post('create')
    async createNewPreCustomerMeeting(@Body() newData: any) {
        let resp = new ResponseData();
        try {
            let res = await this.preCustomerMeetingService.createNewPreCustomerMeeting(newData);
            this.logger.log(`New PreCustomerMeeting Created : ${JSON.stringify(res)}`);
            resp.data = res;
            resp.message = 'New PreCustomerMeeting is successfully created';
        } catch (error) {
            this.logger.warn(`PreCustomerMeeting Creation Error : ${JSON.stringify(error)}`, error);
            resp.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                resp.message = error.message;
            } else {
                resp.message = 'Internal Server Error';
            }
        }
        return resp;
    }

    @ApiOperation({ summary: 'Get All PreCustomerMeetings' })
    @ApiCreatedResponse({
        description: 'Get All PreCustomerMeetings',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Post()
    async getAllPreCustomerMeetings(@Body() body: CompanyIdDto) {
        let resp = new ResponseData();
        try {
            let res = await this.preCustomerMeetingService.getAllPreCustomerMeetings(
                body.CompanyMasterSid,
                body.BranchMasterSid,
                body.userTypeCode,
                body.userId
            );
            this.logger.log(`All PreCustomerMeetings Fetched : ${JSON.stringify(res)}`);
            resp.data = res;
            resp.message = 'All PreCustomerMeetings are successfully fetched';
        } catch (error) {
            this.logger.warn(`Get All PreCustomerMeetings Error : ${JSON.stringify(error)}`, error);
            resp.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                resp.message = error.message;
            } else {
                resp.message = 'Internal Server Error';
            }
        }
        return resp;
    }

    @ApiOperation({ summary: 'Get PreCustomerMeeting by Id' })
    @ApiCreatedResponse({
        description: 'Get PreCustomerMeeting by Id',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Get('fetch/:PreCustomerMeetingSid')
    async getPreCustomerMeetingById(@Param('PreCustomerMeetingSid', ParseIntPipe) PreCustomerMeetingSid: number) {
        let resp = new ResponseData();
        try {
            this.logger.log(`Getting PreCustomerMeeting with id : ${PreCustomerMeetingSid}`);
            let res = await this.preCustomerMeetingService.fetchPreCustomerMeetingById(PreCustomerMeetingSid);
            this.logger.debug(`Fetched PreCustomerMeeting : ${JSON.stringify(res)}`);
            resp.data = res;
            resp.message = `PreCustomerMeeting with id : ${PreCustomerMeetingSid} is successfully fetched`;
        } catch (error) {
            this.logger.warn(`Get PreCustomerMeeting by Id Error : ${JSON.stringify(error)}`, error);
            resp.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                resp.message = error.message;
            } else {
                resp.message = 'Internal Server Error';
            }
        }
        return resp;
    }

    @ApiOperation({ summary: 'Update PreCustomerMeeting by Id' })
    @ApiCreatedResponse({
        description: 'Update PreCustomerMeeting by Id',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Patch('update/:PreCustomerMeetingSid')
    async updatePreCustomerMeetingById(
        @Param('PreCustomerMeetingSid', ParseIntPipe) PreCustomerMeetingSid: number,
        @Body() payload: any
    ) {
        let resp = new ResponseData();
        try {
            this.logger.log(`Updating PreCustomerMeeting with id : ${PreCustomerMeetingSid}`);
            let res = await this.preCustomerMeetingService.updatePreCustomerMeetingById(PreCustomerMeetingSid, payload);
            this.logger.debug(`Updated PreCustomerMeeting : ${JSON.stringify(res)}`);
            resp.data = res;
            resp.message = `PreCustomerMeeting with id : ${PreCustomerMeetingSid} is successfully updated`;
        } catch (error) {
            this.logger.warn(`PreCustomerMeeting Updation Error : ${JSON.stringify(error)}`, error);
            resp.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                resp.message = error.message;
            } else {
                resp.message = 'Internal Server Error';
            }
        }
        return resp;
    }

    @ApiOperation({ summary: 'Delete PreCustomerMeeting by Id' })
    @ApiCreatedResponse({
        description: 'Delete PreCustomerMeeting by Id',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Delete('delete/:PreCustomerMeetingSid')
    async deletePreCustomerMeetingById(@Param('PreCustomerMeetingSid', ParseIntPipe) PreCustomerMeetingSid: number) {
        let resp = new ResponseData();
        try {
            this.logger.log(`Deleting PreCustomerMeeting with id : ${PreCustomerMeetingSid}`);
            let res = await this.preCustomerMeetingService.deletePreCustomerMeeting(PreCustomerMeetingSid);
            this.logger.debug(`Deleted PreCustomerMeeting : ${JSON.stringify(res)}`);
            resp.data = res;
            resp.message = `PreCustomerMeeting with id : ${PreCustomerMeetingSid} is successfully deleted`;
        } catch (error) {
            this.logger.warn(`PreCustomerMeeting Deletion Error : ${JSON.stringify(error)}`, error);
            resp.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                resp.message = error.message;
            } else {
                resp.message = 'Internal Server Error';
            }
        }
        return resp;
    }

    @ApiOperation({ summary: 'Search List of PreCustomerMeetings' })
    @ApiCreatedResponse({
        description: 'Search List of PreCustomerMeetings',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Post('search-list')
    async searchList(@Body() searchParams: filterDto) {
        let resp = new ResponseData();
        try {
            let res = await this.preCustomerMeetingService.searchList(searchParams);
            this.logger.log(`PreCustomerMeeting Search Results : ${JSON.stringify(res)}`);
            resp.data = res;
            resp.message = 'PreCustomerMeeting Search results are successfully fetched';
        } catch (error) {
            this.logger.warn(`PreCustomerMeeting Search Error : ${JSON.stringify(error)}`, error);
            resp.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                resp.message = error.message;
            } else {
                resp.message = 'Internal Server Error';
            }
        }
        return resp;
    }

}
