import { BadRequestException, Body, Controller, HttpCode, HttpStatus, Logger, Post, UnauthorizedException } from '@nestjs/common';
import { ApiCreatedResponse, ApiOperation } from '@nestjs/swagger';
import { ResponseData } from 'src/common/response-data';
import { Auth } from 'src/common/decorators/auth.decorator';
import { SplitbookingService } from 'src/operation/services/splitbooking/splitbooking.service';

@Auth()
@Controller('splitbooking')
export class SplitbookingController {
    constructor(
        private logger: Logger,
        private splitBookingService: SplitbookingService
    ) { }

    @ApiOperation({ summary: 'Split Booking' })
    @ApiCreatedResponse({ description: 'Booking Splited Successfully' })
    @Post('split')
    @HttpCode(HttpStatus.OK)
    async splitBooking(@Body() payload:any) {
        let resp = new ResponseData();
        try {
            this.logger.log('Split Booking payload',payload);
            const splitedProducts = await this.splitBookingService.splitBooking(payload);
            this.logger.debug('Split Booking results',splitedProducts);
            resp.message = 'Booking Splited Successfully';
            resp.data = splitedProducts.newBooking;
        } catch (error) {
            resp.status = false;
            this.logger.error('Error while spliting booking', error);
            if(error instanceof BadRequestException || error instanceof UnauthorizedException){
                resp.message = error.message;
            } else {
                resp.message = "Internal Server error"
            }
        }
        return resp;
    }

    @ApiOperation({ summary: 'Get All Bookings' })
    @ApiCreatedResponse({ description: 'All Bookings' })
    @Post('allBookings')
    @HttpCode(HttpStatus.OK)
    async getAllBookings(@Body() payload: any) {
        let resp = new ResponseData();
        try {
            this.logger.log(`Get All Bookings payload ${JSON.stringify(payload)}`);
            const allBookings = await this.splitBookingService.getAllBookings(payload);
            this.logger.debug(`Get All Bookings results ${JSON.stringify(allBookings)}`);
            resp.message = 'All Bookings are successfully fetched';
            resp.data = allBookings;
        } catch (error) {
            resp.status = false;
            this.logger.error(`Error while getting all bookings ${JSON.stringify(error)}`);
            if(error instanceof BadRequestException || error instanceof UnauthorizedException){
                resp.message = error.message;
            } else {
                resp.message = "Internal Server error"
            }
        }
        return resp;
    }
}
