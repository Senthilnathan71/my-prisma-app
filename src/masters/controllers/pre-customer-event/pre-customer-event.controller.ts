import { BadRequestException, Body, Controller, Delete, Get, HttpCode, HttpStatus, Logger, Param, ParseIntPipe, Patch, Post, UnauthorizedException } from '@nestjs/common';
import { ApiCreatedResponse, ApiOperation } from '@nestjs/swagger';
import { Auth } from 'src/common/decorators/auth.decorator';
import { ResponseData } from 'src/common/response-data';
import { SearchListDto } from 'src/masters/DTO/search-list.dto';
import { PreCustomerEventService } from 'src/masters/services/pre-customer-event/pre-customer-event.service';

@Auth()
@Controller('pre-customer-event')
export class PreCustomerEventController {
    constructor(
        private preCustomerEventService: PreCustomerEventService, 
        private logger: Logger
    ) {}

    @ApiOperation({ summary: 'Create new Pre-Customer Event' })
    @ApiCreatedResponse({
        description: 'Create new Pre-Customer Event',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Post('create')
    async createNewEvent(@Body() newData: any) {
        let resp = new ResponseData();
        try {
            let res = await this.preCustomerEventService.createNewEvent(newData);
            this.logger.log(`New Pre-Customer Event Created : ${JSON.stringify(res)}`);
            resp.data = res;
            resp.message = "New Pre-Customer Event is successfully created";
        } catch (error) {
            this.logger.warn(`Pre-Customer Event Creation Error : ${JSON.stringify(error)}`, error.stack);
            resp.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                resp.message = error.message;
            } else {
                resp.message = "Internal Server Error";
            }
        }
        return resp;
    }

    @ApiOperation({ summary: 'Get All Pre-Customer Events' })
    @ApiCreatedResponse({
        description: 'Get All Pre-Customer Events',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Get()
    async getAllEvents() {
        let resp = new ResponseData();
        try {
            let res = await this.preCustomerEventService.getAllEvents();
            this.logger.log(`All Pre-Customer Events Fetched : Count ${res.length}`);
            resp.data = res;
            resp.message = "All Pre-Customer Events are successfully fetched";
        } catch (error) {
            this.logger.warn(`Get All Pre-Customer Events Error : ${JSON.stringify(error)}`, error.stack);
            resp.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                resp.message = error.message;
            } else {
                resp.message = "Internal Server Error";
            }
        }
        return resp;
    }

    @ApiOperation({ summary: 'Get Pre-Customer Event by Id' })
    @ApiCreatedResponse({
        description: 'Get Pre-Customer Event by Id',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Get('fetch/:PreCustomerEventSid')
    async getEventById(@Param('PreCustomerEventSid', ParseIntPipe) PreCustomerEventSid: number) {
        let resp = new ResponseData();
        try {
            this.logger.log(`Getting Pre-Customer Event with id : ${PreCustomerEventSid}`);
            let res = await this.preCustomerEventService.getEventById(PreCustomerEventSid);
            this.logger.debug(`Fetched Pre-Customer Event : ${JSON.stringify(res)}`);
            resp.data = res;
            resp.message = `Pre-Customer Event with id : ${PreCustomerEventSid} is successfully fetched`;
        } catch (error) {
            this.logger.warn(`Get Pre-Customer Event by Id Error : ${JSON.stringify(error)}`, error.stack);
            resp.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                resp.message = error.message;
            } else {
                resp.message = "Internal Server Error";
            }
        }
        return resp;
    }

    @ApiOperation({ summary: 'Update Pre-Customer Event by Id' })
    @ApiCreatedResponse({
        description: 'Update Pre-Customer Event by Id',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Patch('update/:PreCustomerEventSid')
    async updateEventById(
        @Param('PreCustomerEventSid', ParseIntPipe) PreCustomerEventSid: number, 
        @Body() payload: any
    ) {
        let resp = new ResponseData();
        try {
            this.logger.log(`Updating Pre-Customer Event with id : ${PreCustomerEventSid}`);
            let res = await this.preCustomerEventService.updateEventById(PreCustomerEventSid, payload);
            this.logger.debug(`Updated Pre-Customer Event : ${JSON.stringify(res)}`);
            resp.data = res;
            resp.message = `Pre-Customer Event with id : ${PreCustomerEventSid} is successfully updated`;
        } catch (error) {
            this.logger.warn(`Pre-Customer Event Update Error : ${JSON.stringify(error)}`, error.stack);
            resp.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                resp.message = error.message;
            } else {
                resp.message = "Internal Server Error";
            }
        }
        return resp;
    }

    @ApiOperation({ summary: 'Delete Pre-Customer Event by Id' })
    @ApiCreatedResponse({
        description: 'Delete Pre-Customer Event by Id',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Delete('delete/:PreCustomerEventSid')
    async deleteEventById(@Param('PreCustomerEventSid', ParseIntPipe) PreCustomerEventSid: number) {
        let resp = new ResponseData();
        try {
            this.logger.log(`Deleting Pre-Customer Event with id : ${PreCustomerEventSid}`);
            let res = await this.preCustomerEventService.deleteEvent(PreCustomerEventSid);
            this.logger.debug(`Deleted Pre-Customer Event : ${JSON.stringify(res)}`);
            resp.data = res;
            resp.message = `Pre-Customer Event with id : ${PreCustomerEventSid} is successfully deleted`;
        } catch (error) {
            this.logger.warn(`Pre-Customer Event Deletion Error : ${JSON.stringify(error)}`, error.stack);
            resp.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                resp.message = error.message;
            } else {
                resp.message = "Internal Server Error";
            }
        }
        return resp;
    }

    @ApiOperation({ summary: 'Search Pre-Customer Events' })
    @ApiCreatedResponse({
        description: 'Search Pre-Customer Events',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Post('search-list')
    async searchEvents(@Body() searchData: SearchListDto) {
        let resp = new ResponseData();
        try {
            let res = await this.preCustomerEventService.searchEvents(searchData);
            this.logger.log(`Pre-Customer Event Search Results : Count ${res.length}`);
            resp.data = res;
            resp.message = "Pre-Customer Event search results are successfully fetched";
        } catch (error) {
            this.logger.warn(`Pre-Customer Event Search Error : ${JSON.stringify(error)}`, error.stack);
            resp.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                resp.message = error.message;
            } else {
                resp.message = "Internal Server Error";
            }
        }
        return resp;
    }
}