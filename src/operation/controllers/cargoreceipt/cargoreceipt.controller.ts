import { BadRequestException, Body, Controller, Get, HttpCode, HttpStatus, Logger, Param, ParseIntPipe, Patch, Post, Query, UnauthorizedException } from '@nestjs/common';
import { ApiCreatedResponse, ApiOperation } from '@nestjs/swagger';
import { ResponseData } from 'src/common/response-data';
import { Auth } from 'src/common/decorators/auth.decorator';
import { filterDto } from 'src/masters/DTO/search-vessel.dto';
import { CargoreceiptService } from 'src/operation/services/cargoreceipt/cargoreceipt.service';

@Auth()
@Controller('cargoreceipt')
export class CargoreceiptController {
    constructor(
        private cargoreceiptService: CargoreceiptService,
        private logger: Logger,
    ) {}

    @ApiOperation({ summary: 'Get LCL Export Booking By Id' })
    @ApiCreatedResponse({
        description: 'Get LCL Export Booking By Id',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Get('fetch/:BookingHeaderSid')
    async getLCLExportBookingById(@Param('BookingHeaderSid', ParseIntPipe) BookingHeaderSid: number) {
        let resp = new ResponseData();
        try {
            this.logger.log(`Getting LCL Export Booking By Id: ${BookingHeaderSid}`);
            let res = await this.cargoreceiptService.getLCLExportBookingById(BookingHeaderSid);
            this.logger.debug(`GetLCLExportBookingById Data: ${JSON.stringify(res)}`);
            resp.data = res;
            resp.message = `Get LCL Export Booking By Id : ${BookingHeaderSid} is fetched`
        } catch (error) {
            this.logger.warn(`LCL Export Booking Fetch By Id Error: ${JSON.stringify(error)}`);
            resp.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                resp.message = error.message;
            } else {
                resp.message = "Internal Server Error";
            }
        }
        return resp;
    }

    @ApiOperation({ summary: 'Update Booking Products By Id' })
    @ApiCreatedResponse({
        description: 'Update Booking Products By Id',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Patch('update/:BookingHeaderSid')
    async updateBookingById(@Param('BookingHeaderSid', ParseIntPipe) BookingHeaderSid: number, @Body() body: any) {
        let resp = new ResponseData();
        try {
            this.logger.log(`Updating Booking Products By Id: ${BookingHeaderSid} ${JSON.stringify(body)}`);
            let res = await this.cargoreceiptService.updateBookingById(BookingHeaderSid, body);
            this.logger.debug(`Updated Booking Products Data: ${JSON.stringify(res)}`);
            resp.data = res;
            resp.message = `Booking Product with id: ${BookingHeaderSid} is successfully updated`
        } catch (error) {
            this.logger.warn(`Update Booking Product By Id Error: ${JSON.stringify(error),error}`);
            resp.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                resp.message = 'Internal Server Error';
            }
        }
        return resp;
    }

    @ApiOperation({ summary: 'Search List of LCL Export Booking' })
    @ApiCreatedResponse({
        description: 'Search List of LCL Export Booking',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Post("search-list")
    async search(@Body() searchParams: filterDto) {
        const resp = new ResponseData();
        try {
            const res = await this.cargoreceiptService.search(searchParams);
            this.logger.log(`LCL Export Search Result: ${JSON.stringify(res)}`);
            resp.data = res;
            resp.message = "Search LCL Export Booking is successfully fetched"
        } catch (error) {
            this.logger.warn(`LCL Export Booking Search Error ${error}`);
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
