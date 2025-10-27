import { BadRequestException, Body, Controller, Delete, HttpCode, HttpStatus, Logger, Param, ParseIntPipe, Patch, Post, UnauthorizedException } from '@nestjs/common';
import { ApiCreatedResponse, ApiOperation } from '@nestjs/swagger';
import { UserData } from 'src/common/decorators/user.decorator';
import { ResponseData } from 'src/common/response-data';
import { filterDto } from 'src/masters/DTO/search-vessel.dto';
import { CreditRequestService } from 'src/operation/services/credit-request/credit-request.service';

@Controller('credit-request')
export class CreditRequestController {
    constructor(private creditRequestService: CreditRequestService, private logger: Logger) { }

    @ApiOperation({ summary: 'Search Credit Customer'})
    @ApiCreatedResponse({
        description: 'Search Credit Customer',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Post('search-list')
    async searchCreditCustomer(@Body() searchParams: filterDto) {
        let resp = new ResponseData();
        try {
            let res = await this.creditRequestService.searchCreditCustomer(searchParams);
            this.logger.log(`Credit Customer Data: ${JSON.stringify(res)}`);
            resp.data = res;
            resp.message = "Credit Customer Search is successfully fetched";
        } catch (error) {
            this.logger.warn(`Credit Customer Search Error: ${JSON.stringify(error),error}`);
            resp.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                resp.message = error.message;
            } else {
                resp.message = "Internal Server Error";
            }
        }
        return resp;
    }

    @ApiOperation({ summary: 'Get Salesperson'})
    @ApiCreatedResponse({
        description: 'Get Salesperson',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Post('fetch/salesperson')
    async getSalesperson(@Body() body: any) {
        const output = new ResponseData;
        try {
            const salesman = await this.creditRequestService.getSalesperson(body);
            output.data = salesman;
            this.logger.log(`getSalesperson: ${JSON.stringify(salesman)}`)
        } catch (error) {
            this.logger.warn(`getSalesperson: ${JSON.stringify(error),error}`)
            output.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                output.message = error.message;
            } else {
                output.message = 'Internal Server Error';
            }
        }
        return output;
    }

    @ApiOperation({ summary: 'Get Department'})
    @ApiCreatedResponse({
        description: 'Get Deprtment',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Post('fetch/department')
    async getDepartment(@Body() body: any) {
        const output = new ResponseData;
        try {
            const department = await this.creditRequestService.getDepartment(body);
            output.data = department;
            this.logger.log(`getDepartment: ${JSON.stringify(department)}`)
        } catch (error) {
            this.logger.warn(`getDepartment: ${JSON.stringify(error),error}`)
            output.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                output.message = error.message;
            } else {
                output.message = 'Internal Server Error';
            }
        }
        return output;
    }

    @ApiOperation({ summary: 'Create Credit Request' })
    @ApiCreatedResponse({
        description: 'Create Credit Request',
        type: ResponseData
    })
    @HttpCode(HttpStatus.CREATED)
    @Post('create')
    async createCreditRequest(@Body() body: any, @UserData() user: any) {
        this.logger.log(`createCreditRequest: ${JSON.stringify(body)}`)
        let output = new ResponseData
        try {
            let credit = await this.creditRequestService.createCreditRequest(body, user);
            this.logger.debug(`createCreditRequest: ${JSON.stringify(credit)}`)
            if (!credit) {
                this.logger.warn(`createCreditRequest!!: ${JSON.stringify(credit)}`)
                throw 'Something went wrong'
            }
            output.data = credit;
            output.message = "Credit Request Created Successfully"
        } catch (error) {
            this.logger.error(`createCreditRequestError: ${error}`)
            output.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                output.message = error.message;
                this.logger.warn(`createCreditRequestError: ${error.message}`)
            } else {
                output.message = 'Internal Server Error';
            }
        }
        return output
    }

    @ApiOperation({ summary: 'Update credit request by id'})
    @ApiCreatedResponse({
        description: 'Update credit request by id',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Patch('update/:CustomerCreditRequestSid')
    async updateCreditRequest(@Param('CustomerCreditRequestSid', ParseIntPipe) CustomerCreditRequestSid: number, @Body() body: any, @UserData() user: any) {
        this.logger.log(`updateCreditRequest: ${JSON.stringify(body)}`)
        let output = new ResponseData
        try {
            let credit = await this.creditRequestService.updateCreditRequest(CustomerCreditRequestSid, body, user);
            this.logger.log(`updateCreditRequest: ${JSON.stringify(credit)}`)

            if (!credit) {
                this.logger.log(`updateCreditRequest!!: ${JSON.stringify(credit)}`)
                throw 'Something went wrong'
            } else {
                this.logger.log(`updateCreditRequestelse: ${credit}`)
            }
            output.data = credit;
            output.message = `Credit Request with id : ${CustomerCreditRequestSid} is successfully updated`;
        } catch (error) {
            this.logger.warn(`updateCreditRequestError: ${JSON.stringify(error),error}`)
            output.status = false;
            // Handle error message based on the type of error
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                this.logger.warn(`updateCreditRequestError: ${error}`)
                output.message = error.message;
            } else {
                output.message = error;
            }           
            this.logger.warn(`updateCreditRequestMessage: ${output.message}`)       
            return output
        }
    }

    @ApiOperation({ summary: 'Delete credit request by id'})
    @ApiCreatedResponse({
        description: 'Delete credit request by id',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Delete('delete/:CustomerCreditRequestSid')
    async deleteCreditRequest(@Param('CustomerCreditRequestSid', ParseIntPipe) CustomerCreditRequestSid: number) {
        return this.creditRequestService.deleteCreditRequest(CustomerCreditRequestSid);
    }
}
