import { CreatePreCustomerMeetingDto } from './../../DTO/create-precustomer-meeting.dto';
import { BadRequestException, Body, Controller, Get, Param, ParseIntPipe, Post, Put, UnauthorizedException } from '@nestjs/common';
import { Auth } from 'src/common/decorators/auth.decorator';
import { UserData } from 'src/common/decorators/user.decorator';
import { ResponseData } from 'src/common/response-data';
import { CreatePrecustomerDto } from 'src/masters/DTO/create-Precustomer.dto';
import { PreCustomerMeetingService } from 'src/masters/services/precustomer/precustomer-meeting.service';
import { PrecustomerService } from 'src/masters/services/precustomer/precustomer.service';

@Controller('precustomer-meeting')
@Auth()
export class PreCustomerMeetingController {

    constructor(private preCustomerMeetingService: PreCustomerMeetingService) { }

    @Get('pendingMeetings')
    async getPendingMeetings(@UserData() UserData: any) {
        const output = new ResponseData
        try {
            const customers = await this.preCustomerMeetingService.getPreCustomerMastersWithoutMeetings()
            console.log("customer", customers);
            output.data = customers;
        } catch (error) {
            console.log("controler error::", error);
            output.status = false;
            // Handle error message based on the type of error
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                output.message = error.message;
            } else {
                output.message = 'Internal Server Error';
            }
        }
        return output;
    }


    @Put()
    async createPrecustomer(@Body() body: CreatePreCustomerMeetingDto, @UserData() user: any) {
        let output = new ResponseData
        try {
            let preCustomer = await this.preCustomerMeetingService.CreateAndUpdatePreCustomerMeeting(body, user);
            if (!preCustomer) {
                throw 'Something went wrong'
            }
            output.data = preCustomer.data;
            output.message = preCustomer.message;
            output.status = true

        } catch (error) {
            console.log("controler error::", error);
            output.status = false;
            // Handle error message based on the type of error
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                output.message = error.message;
            } else {
                output.message = error;
            }
        }
        return output
    }



    @Get('meetingDate')
    async getPreCustomerMeetings(@UserData() UserData: any) {
        const output = new ResponseData
        try {
            const customers = await this.preCustomerMeetingService.getPreCustomerMeetingDate()
            console.log("customer", customers);
            output.data = customers;
        } catch (error) {
            console.log("controler error::", error);
            output.status = false;
            // Handle error message based on the type of error
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                output.message = error.message;
            } else {
                output.message = 'Internal Server Error';
            }
        }
        return output;
    }
}