import { CreatePreCustomerMeetingDto } from './../../DTO/create-precustomer-meeting.dto';
import { BadRequestException, Body, Controller, Get, HttpCode, HttpStatus, Logger, Param, ParseIntPipe, Post, Put, UnauthorizedException } from '@nestjs/common';
import { ApiCreatedResponse, ApiOperation } from '@nestjs/swagger';
import { Auth } from 'src/common/decorators/auth.decorator';
import { UserData } from 'src/common/decorators/user.decorator';
import { ResponseData } from 'src/common/response-data';
import { CreatePrecustomerDto } from 'src/masters/DTO/create-Precustomer.dto';
import { PreCustomerMeetingService } from 'src/masters/services/precustomer/precustomer-meeting.service';
import { PrecustomerService } from 'src/masters/services/precustomer/precustomer.service';
class CompanyIdDto {
  CompanyMasterSid: number;
  BranchMasterSid: number;
}
@Controller('precustomer-meeting')
@Auth()
export class PreCustomerMeetingController {

    constructor(private preCustomerMeetingService: PreCustomerMeetingService, private logger: Logger) { }

    @ApiOperation({ summary: 'Pending Meetings' })
    @ApiCreatedResponse({
        description: 'Get Pending Meetings',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Post('pendingMeetings')
    async getPendingMeetings(@Body() body: CompanyIdDto) {
        const output = new ResponseData
        try {
            const customers = await this.preCustomerMeetingService.getPreCustomerMastersWithoutMeetings(body.CompanyMasterSid, body.BranchMasterSid)
            this.logger.debug(`getPendingMeetings: ${JSON.stringify(customers)}`)
            output.data = customers;
            output.message = "All PendingMeetings are successfully fetched";
        } catch (error) {
            this.logger.warn(`getPendingMeetings: ${JSON.stringify(error)}`)
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


    @ApiOperation({ summary: 'Create And Update PreCustomer' })
    @ApiCreatedResponse({
        description: 'Create and update PreCustomer',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Put()
    async createPrecustomer(@Body() body: CreatePreCustomerMeetingDto) {
        this.logger.log(`createPrecustomer: ${JSON.stringify(body)}`)
        let output = new ResponseData
        try {
            let preCustomer = await this.preCustomerMeetingService.CreateAndUpdatePreCustomerMeeting(body);
            this.logger.log(`createPrecustomer: ${JSON.stringify(preCustomer)}`)

            if (!preCustomer) {
                this.logger.log(`createPrecustomer: ${JSON.stringify(preCustomer)}`)

                throw 'Something went wrong'
            }
            output.data = preCustomer.data;
           output.message = 'PreCustomerMeeting Created Successfully'
            output.status = true

        } catch (error) {
            this.logger.warn(`createPrecustomer: ${JSON.stringify(error)}`)
            console.log(error,error.stack)
            output.status = false;
            // Handle error message based on the type of error
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                output.message = error.message;
            } else {
                output.message = "Internal Server Error";
            }
        }
        return output
    }


    @ApiOperation({ summary: 'Get All PreCustomerMeetings' })
    @ApiCreatedResponse({
        description: 'Get All PreCustomerMeetings',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Get('meetingDate')
    async getPreCustomerMeetings() {
        const output = new ResponseData
        try {
            const customers = await this.preCustomerMeetingService.getPreCustomerMeetingDate()
            this.logger.log(`getPreCustomerMeetings: ${JSON.stringify(customers)}`)
            output.data = customers;
            output.message = "All PreCustomerMeetings are successfully fetched";
        } catch (error) {
            this.logger.warn(`getPreCustomerMeetings: ${JSON.stringify(error)}`)

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


    @ApiOperation({ summary: 'Get PreCustomer by id' })
    @ApiCreatedResponse({
        description: 'Get PreCustomer By Id',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Get(':id')
    async getPreCustomer(@Param('id') id: string) {
        const output = new ResponseData
        try {
            const result = await this.preCustomerMeetingService.getPreCustomer(id)
            this.logger.log(`getPreCustomer: ${JSON.stringify(result)}`)
            output.data = result;
            output.message = `GetPreCustomer with id : ${id} is successfully fetched`;
        } catch (error) {
            this.logger.warn(`getPreCustomer: ${JSON.stringify(error)}`)
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



    @ApiOperation({ summary: 'Get Todo Meetings' })
    @ApiCreatedResponse({
        description: 'Get All Todo Meetings',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Post('lead/todo')
    async todoMeetings(@Body() body: CompanyIdDto) {
        const output = new ResponseData
        try {
            const todo = await this.preCustomerMeetingService.todoMeetings(body.CompanyMasterSid, body.BranchMasterSid)
            this.logger.debug(`todoMeetings: ${JSON.stringify(todo)}`)
            output.data = todo;
            output.message = "All TodoMeetings are successfully fetched";
        } catch (error) {
            this.logger.debug(`todoMeetings: ${JSON.stringify(error)}`)
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