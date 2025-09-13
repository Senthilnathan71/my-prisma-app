import { BadRequestException, Body, Controller, Get, HttpCode, HttpStatus, Logger, Param, ParseIntPipe, Post, Put, UnauthorizedException } from '@nestjs/common';
import { ApiCreatedResponse, ApiOperation } from '@nestjs/swagger';
import { Auth } from 'src/common/decorators/auth.decorator';
import { UserData } from 'src/common/decorators/user.decorator';
import { ResponseData } from 'src/common/response-data';
import { CreatePrecustomerDto } from 'src/masters/DTO/create-Precustomer.dto';
import { SearchListDto } from 'src/masters/DTO/search-list.dto';
import { PrecustomerService } from 'src/masters/services/precustomer/precustomer.service';
class CompanyIdDto {
  CompanyMasterSid: number;
  BranchMasterSid: number;
}
@Controller('precustomer')

export class PrecustomerController {

    constructor(private precustomerSer: PrecustomerService, private logger: Logger) { }

    @ApiOperation({ summary: 'Get All Customer' })
    @ApiCreatedResponse({
        description: 'Get All Customer',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Post('customer')
    async getAllCustomer(@Body() body: CompanyIdDto) {
        const output = new ResponseData
        try {
            const customers = await this.precustomerSer.getAllCustomer(body.CompanyMasterSid)
            output.data = customers; 
            this.logger.log(`getAllCustomer: ${JSON.stringify(customers)}`)
            output.data = customers;
            output.message = "All Customer are successfully fetched";
        } catch (error) {
            this.logger.warn(`getAllCustomers ${error}`)
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

     @ApiOperation({ summary: 'Get All Customer' })
    @ApiCreatedResponse({
        description: 'Get All Customer',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Get('fetch/customer')
    async getAllCustomers() {
        const output = new ResponseData
        try {
            const customers = await this.precustomerSer.getAllCustomers()
            output.data = customers; 
            this.logger.log(`getAllCustomer: ${JSON.stringify(customers)}`)
        } catch (error) {
            this.logger.warn(`getAllCustomers ${error}`)
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

    @ApiOperation({ summary: 'Get All PreCustomer' })
    @ApiCreatedResponse({
        description: 'Get All PreCustomer',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Get()
    async getAllPrecustomer(@UserData() UserData: any) {
        const output = new ResponseData
        try {
            const customers = await this.precustomerSer.getAllPrecustomer(UserData.userBranchMaster[0])
            this.logger.log(`getAllPrecustomer: ${JSON.stringify(customers)}`)
            output.data = customers;
            output.message = "All Customers are successfully fetched";
        } catch (error) {
            this.logger.warn(`getAllPreCustomer: ${error}`)
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

    @ApiOperation({ summary: 'Get PreCustomer By Id' })
    @ApiCreatedResponse({
        description: 'Get PreCustomer By Id',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Get(':id')
    async getPrecustomerById(@Param('id', ParseIntPipe) PreCustomerMasterSid: number) {
        const output = new ResponseData;
        try {
            const preCustomer = await this.precustomerSer.findOne(PreCustomerMasterSid)
            this.logger.log(`getPrecustomerById: ${JSON.stringify(preCustomer)}`)
            output.data = preCustomer
            output.message = `PreCustomer with id : ${PreCustomerMasterSid} is successfully fetched`;
        } catch (error) {
            this.logger.warn(`getPrecustomerById: ${JSON.stringify(error)}`)
            output.status = false;
            output.message = error
        }
        return output;
    }


    @ApiOperation({ summary: 'Create PreCustomer' })
    @ApiCreatedResponse({
        description: 'Create PreCustomer',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Put()
    async createPrecustomer(@Body() body: CreatePrecustomerDto, @UserData() user: any) {
        let output = new ResponseData
        try {
            let preCustomer = await this.precustomerSer.createPrecustomer(body, );
            this.logger.log(`createPrecustomer: ${JSON.stringify(preCustomer)}`)
            if (!preCustomer) {
                this.logger.warn(`createPrecustomer: ${JSON.stringify(preCustomer)}`)
                throw 'Something went wrong'
            }
            output.data = preCustomer.data;
            output.message = 'PreCustomer Created Successfully'
            output.status = true

        } catch (error) {
            this.logger.warn(`createPrecustomer: ${JSON.stringify(error)}`)
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


    @ApiOperation({ summary: 'Search List of PreCustomers' })
    @ApiCreatedResponse({
        description: 'Search List of PreCustomers',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Post('search-list')
    async searchPreCustomer(@Body() body: SearchListDto) {
        let resp = new ResponseData();
        try {
            let res = await this.precustomerSer.searchPrecustomer(body);
            this.logger.log(`PreCustomer Search Results : ${JSON.stringify(res)}`);
            resp.data = res;
            resp.message = "PreCustomer Search is successfully fetched";
        } catch (error) {
            this.logger.warn(`PreCustomer Search Error ${error}`);
            resp.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                resp.message = error.message;
            } else {
                resp.message = "Internal Server Error"
            }
        }
        return resp;
    }

}


