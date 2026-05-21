
import { BadRequestException, Body, Controller, Delete, Get, HttpCode, HttpStatus, Logger, Param, ParseIntPipe, Post, Put, UnauthorizedException } from '@nestjs/common';
import { ApiCreatedResponse, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Auth } from 'src/common/decorators/auth.decorator';
import { UserData } from 'src/common/decorators/user.decorator';
import { ResponseData } from 'src/common/response-data';
import { CreatePrecustomerDto } from 'src/masters/DTO/create-Precustomer.dto';
import { PreCustomerMeetingService } from 'src/crm-desktop/services/precustomer/precustomer-meeting.service';
import { PrecustomerService } from 'src/crm/services/precustomer/precustomer.service';
import { filterDto } from 'src/masters/DTO/search-vessel.dto';
import { CreatePreCustomerMeetingDto } from 'src/crm-desktop/DTO/create-precustomer-meeting.dto';
class CompanyIdDto {
  CompanyMasterSid: number;
  BranchMasterSid: number;
  userTypeCode?: string;
  userId?: number;
}
@Auth()
@Controller('ff-pre-customer-meeting')
export class PreCustomerMeetingController {

    constructor(private preCustomerMeetingService: PreCustomerMeetingService, private logger: Logger) { }

    @ApiOperation({ summary: 'Pending Meetings' })
    @ApiCreatedResponse({
        description: 'Get Pending Meetings',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Post('pendingMeetings')
    async getPendingMeetings(@UserData() user:any, @Body() body: CompanyIdDto) {
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

    @ApiOperation({ summary: 'Search List of Opportunity' })
    @ApiCreatedResponse({
        description: 'Search List of Opportunity',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Post('search-Opportunity')
    async searchOpportunity(@UserData() user:any,@Body() searchParams: filterDto) {
        let resp = new ResponseData();
        try {
            let res = await this.preCustomerMeetingService.searchOpportunity(searchParams);
            this.logger.log(`Opportunity Search Data : ${JSON.stringify(res)}`);
            resp.data = res;
            resp.message = "Opportunity Search is successfully fetched";
        } catch (error) {
            this.logger.warn(`Opportunity Search Error : ${JSON.stringify(error), error}`);
            resp.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                resp.message = error.message;
            } else {
                resp.message = "Internal Server Error";
            }
        }
        return resp;
    }


    @ApiOperation({ summary: 'Create And Update PreCustomer' })
    @ApiCreatedResponse({
        description: 'Create and update PreCustomer',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Put()
    async createPrecustomer(@UserData() user:any, @Body() body: CreatePreCustomerMeetingDto) {
        this.logger.log(`createPrecustomer: ${JSON.stringify(body)}`)
        let output = new ResponseData
        try {
            let preCustomer = await this.preCustomerMeetingService.CreateAndUpdatePreCustomerMeeting(user,body);
            this.logger.log(`createPrecustomer: ${JSON.stringify(preCustomer)}`)

            if (!preCustomer) {
                this.logger.log(`createPrecustomer: ${JSON.stringify(preCustomer)}`)

                throw 'Something went wrong'
            }
            output.data = preCustomer.data;
           output.message = preCustomer.message
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
    async getPreCustomerMeetings(@UserData() user:any,) {
        const output = new ResponseData
        try {
            const customers = await this.preCustomerMeetingService.getPreCustomerMeetingDate(user)
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

    @ApiOperation({summary : 'Get Salesman of Lead'})
    @ApiResponse({
        type : ResponseData,
        description : 'Salesman of Lead',
    })
    @HttpCode(HttpStatus.OK)
    @Get('salespersonForLead/:PreCustomerMasterSid')
    async salespersonForLead(@Param('PreCustomerMasterSid',ParseIntPipe) PreCustomerMasterSid: number) {
        let resp = new ResponseData();
        try {
            let result = await this.preCustomerMeetingService.getSalesmanOfPreCustomer(PreCustomerMasterSid);
            this.logger.log(`salespersonForLead: ${JSON.stringify(result)}`)
            resp.data = result;
            resp.message = "Salesman of Lead";
        } catch (error) {
            this.logger.warn(`salespersonForLead: ${JSON.stringify(error)}`)
            resp.status = false;
            // Handle error message based on the type of error
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                resp.message = error.message;
            } else {
                resp.message = "Internal Server Error";
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
    @Get('followup/meetingDate/:CompanyId/:BranchId')
    async getPreCustomerFollowupMeetings(
        @Param('CompanyId') companyId: number,
        @Param('BranchId') branchId: number,
        @UserData() user:any,
    ) {
        const output = new ResponseData
        try {
            const followupMeetings = await this.preCustomerMeetingService.getPreCustomerFollowupMeetings(user,+companyId,+branchId)
            this.logger.log(`getPreCustomerMeetings: ${JSON.stringify(followupMeetings)}`)
            output.data = followupMeetings;
            output.message = "All PreCustomerFollowupMeetings are successfully fetched";
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


    @ApiOperation({ summary: 'Get All PreCustomerMeetings' })
        @ApiCreatedResponse({
            description: 'Get All PreCustomerMeetings',
            type: ResponseData
        })
        @HttpCode(HttpStatus.OK)
        @Post()
    async getAllPreCustomerMeetings(@UserData() user:any,@Body() body: CompanyIdDto) {
        let resp = new ResponseData();
        try {
            const scopedUser = {
              ...user,
              userTypeCode: body?.userTypeCode || user?.userTypeCode,
              UserMasterSid: Number(body?.userId || user?.UserMasterSid || 0),
            };
            let res = await this.preCustomerMeetingService.getAllPreCustomerMeetings(scopedUser,body.CompanyMasterSid, body.BranchMasterSid);
            this.logger.log(`All PreCustomerMeetings Fetched : ${JSON.stringify(res)}`);
            resp.data = res;
            resp.message = "All PreCustomerMeetings are successfully fetched";
            } catch (error) {
                this.logger.warn(`Get All PreCustomerMeetings Error : ${JSON.stringify(error)}`, error);
                resp.status = false;
                if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                    resp.message = error.message;
                } else {
                    resp.message = "Internal Server Error";
                }
            }
            return resp;
        }


    @ApiOperation({ summary: 'Get PreCustomer by id' })
    @ApiCreatedResponse({
        description: 'Get PreCustomer By Id',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Get(':id')
    async getPreCustomer(@UserData() user:any,@Param('id') id: string) {
        const output = new ResponseData
        try {
            const result = await this.preCustomerMeetingService.getPreCustomer(user,id)
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
    async todoMeetings(@UserData() user:any,@Body() body: CompanyIdDto) {
        const output = new ResponseData
        try {
            const todo = await this.preCustomerMeetingService.todoMeetings(user,body.CompanyMasterSid, body.BranchMasterSid)
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
      @ApiOperation({ summary: 'Search List of PreCustomerMeetings' })
    @ApiCreatedResponse({
        description: 'Search List of PreCustomerMeetings',
        type: ResponseData
    })
    @ApiOperation({ summary: 'Search List of PreCustomerMeetings' })
    @ApiCreatedResponse({
        description: 'Search List of PreCustomerMeetings',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Post('search-list')
    async searchList(@Body() searchParams: filterDto,@UserData() user:any) {
        let resp = new ResponseData();
        try {
            let res = await this.preCustomerMeetingService.searchPreCustomerMeeting(searchParams,user);
            this.logger.log(`PreCustomerMeeting Search Results : ${JSON.stringify(res)}`);
            resp.data = res;
            resp.message = "PreCustomerMeeting Search results are successfully fetched";
        } catch (error) {
            this.logger.warn(`PreCustomerMeeting Search Error : ${JSON.stringify(error)}`, error);
            resp.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                resp.message = error.message;
            } else {
                resp.message = "Internal Server Error";
            }
        }
        return resp;
    }


    @ApiOperation({summary : 'Delete precustomer meeting'})
    @ApiCreatedResponse({description: 'Delete precustomer meeting', type: ResponseData})
    @HttpCode(HttpStatus.OK)
    @Delete('delete/:PreCustomerMeetingSid')
    async deletePrecustomerMeeting(@Param('PreCustomerMeetingSid',ParseIntPipe) PreCustomerMeetingSid: number): Promise<any> {
        const output = new ResponseData();
        try {
            const result = await this.preCustomerMeetingService.deletePrecustomerMeeting(PreCustomerMeetingSid);
            this.logger.debug(`deletePrecustomerMeeting: ${JSON.stringify(result)}`)
            output.data = result;
            output.message = "Precustomer meeting is successfully deleted";
        } catch (error) {
            this.logger.debug(`deletePrecustomerMeeting: ${JSON.stringify(error)}`)
            output.status = false;
            output.message = typeof error == 'string' ? error : ''
        }
        return output;
    }

}
