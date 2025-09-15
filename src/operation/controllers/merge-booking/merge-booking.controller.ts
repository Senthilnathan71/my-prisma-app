import { BadRequestException, Body, Controller, HttpCode, HttpStatus, Logger, Post, UnauthorizedException } from '@nestjs/common';
import { ApiCreatedResponse, ApiOperation } from '@nestjs/swagger';
import { ResponseData } from 'src/common/response-data';
import { MergeBookingService } from 'src/operation/services/merge-booking/merge-booking.service';

@Controller('merge-booking')
export class MergeBookingController {
    constructor(
        private logger : Logger,
        private mergeBookingService:MergeBookingService
    ) { }

    @ApiOperation({ summary: 'Merge Booking' })
    @ApiCreatedResponse({ description: 'Booking Merged Successfully' })
    @Post('merge')
    @HttpCode(HttpStatus.OK)
    async mergeBooking(@Body() payload: any) {
        let resp = new ResponseData();
        try {
            this.logger.log('Merge Booking payload',payload);
            const mergedProducts = await this.mergeBookingService.mergeBooking(payload);
            this.logger.debug('Merge Booking results',mergedProducts);
            resp.message = 'Booking Merged Successfully';
        } catch (error) {
            resp.status = false;
            this.logger.error('Error while merging booking', error);
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
            const allBookings = await this.mergeBookingService.getAllBookings(payload);
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
