import { BadRequestException, Body, Controller, Delete, Get, HttpCode, HttpStatus, Logger, Param, ParseIntPipe, Patch, Post, UnauthorizedException } from '@nestjs/common';
import { ApiCreatedResponse, ApiOperation } from '@nestjs/swagger';
import { Auth } from 'src/common/decorators/auth.decorator';
import { UserData } from 'src/common/decorators/user.decorator';
import { ResponseData } from 'src/common/response-data';
import { SearchListDto } from 'src/masters/DTO/search-list.dto';
import { SearchVesselDto } from 'src/masters/DTO/search-vessel.dto';
import { CustomerService } from 'src/masters/services/customer/customer.service';

@Controller('customer')
@Auth()
export class CustomerController {
    constructor(private customerService: CustomerService, private logger: Logger) { }

    @ApiOperation({ summary: 'Customer Creation' })
    @ApiCreatedResponse({
        description: 'Customer Creation',
        type: ResponseData
    })
    @HttpCode(HttpStatus.CREATED)
    @Post('create')
    async createCustomer(@Body() body: any, @UserData() user: any) {
        this.logger.log(`createDepartmentdata: ${JSON.stringify(body)}`)
        let output = new ResponseData
        try {
            let customer = await this.customerService.createCustomer(body, user);
            this.logger.debug(`createCustomer: ${JSON.stringify(customer)}`)
            if (!customer) {
                this.logger.warn(`createCustomer!!: ${JSON.stringify(customer)}`)
                throw 'Something went wrong'
            }
            output.data = customer
            output.message = 'Organization Created Successfully'

        } catch (error) {
            this.logger.warn(`createCustomerError: ${error}`)
            output.status = false;
            // Handle error message based on the type of error
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                output.message = error.message;
                this.logger.warn(`createCustomerError: ${error.message}`)
            } else {
                this.logger.warn(`createCustomerError: ${error}`)
                output.message = error;
            }
        }
        return output
    }


    @ApiOperation({ summary: 'Get All Customer' })
    @ApiCreatedResponse({
        description: 'Get All Customers',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Get()
    async getAllCustomers() {
        let output = new ResponseData;
        try {
            let customerData = await this.customerService.getAllCustomers();
            this.logger.log(`getAllCustomers: ${JSON.stringify(customerData)}`)
            output.data = customerData;
        } catch (error) {
            this.logger.warn(`getAllCustomers: ${JSON.stringify(error)}`)
            output.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                output.message = error.message;
            } else {
                output.message = 'Internal Server Error';
            }
        }
        return output
    }


    @ApiOperation({ summary: 'Get Customer By Id' })
    @ApiCreatedResponse({
        description: 'Get Customer By Id',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Get('fetch/:id')
    async getCustomerById(@Param('id', ParseIntPipe) customerId: number) {
        const output = new ResponseData;
        try {
            const Customer = await this.customerService.findOne(customerId)
            this.logger.log(`getCustomerById: ${JSON.stringify(Customer)}`)
            output.data = Customer
        } catch (error) {
            this.logger.warn(`getCustomerById: ${JSON.stringify(error)}`)
            output.status = false;
            output.message = error
        }
        return output;
    }


    @ApiOperation({ summary: 'Update Customer By Id' })
    @ApiCreatedResponse({
        description: 'Update Customer By Id',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Patch('update/:id')
    async editCustomer(@Param('id', ParseIntPipe) id: number, @Body() body: any, @UserData() user: any) {
        this.logger.log(`editCustomer: ${JSON.stringify(body)}`)
        let output = new ResponseData
        try {
            let Customer = await this.customerService.updateCustomer(id, body, user);
            this.logger.log(`editCustomer: ${JSON.stringify(Customer)}`)

            if (!Customer) {
                this.logger.log(`editCustomer!!: ${JSON.stringify(Customer)}`)
                throw 'Something went wrong'
            } else {
                this.logger.log(`editCustomer: ${Customer}`)
            }
            output.data = Customer;
            output.message = 'Organization Updated Successfully'
        } catch (error) {
            this.logger.warn(`editCustomer: ${JSON.stringify(error), error}`)
            output.status = false;
            // Handle error message based on the type of error
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                this.logger.warn(`editCustomer: ${error}`)
                output.message = error.message;
            } else {
                output.message = error;
            }
        }
        this.logger.warn(`editCustomer: ${output.message}`)
        return output
    }



    @ApiOperation({ summary: 'Delete Customer By Id' })
    @ApiCreatedResponse({
        description: 'Delete Customer By Id',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Delete('delete/:id')
    async softDelete(@Param('id', ParseIntPipe) id: number) {
        return this.customerService.softDelete(id);
    }



    @ApiOperation({ summary: 'Search List of Customer' })
@ApiCreatedResponse({
    description: 'Search List',
    type: ResponseData
})
@HttpCode(HttpStatus.OK)
@Post('search-list')
async searchCustomer(@Body() searchParams: SearchVesselDto) {
    let resp = new ResponseData();
    try {
        this.logger.log(`Searching Customers with params: ${JSON.stringify(searchParams)}`);
        const res = await this.customerService.searchList(searchParams);
        this.logger.log(`Customer Search Data: ${JSON.stringify(res)}`);
        resp.data = res;
        resp.message = 'Customer search results fetched successfully';
    } catch (error) {
        this.logger.warn(`Search Customer Error: ${error}`);
        resp.status = false;
        if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
            resp.message = error.message;
        } else {
            resp.message = 'Internal Server Error';
        }
    }
    return resp;
}

    @ApiOperation({ summary: 'Get All Carrier' })
    @ApiCreatedResponse({
        description: 'Get All Carrier',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Get('carrier')
    async getAllCarriers() {
        let output = new ResponseData;
        try {
            let customerData = await this.customerService.getAllCarriers();
            this.logger.log(`getAllCarriers: ${JSON.stringify(customerData)}`)
            output.data = customerData;
        } catch (error) {
            this.logger.warn(`getAllCarriers: ${JSON.stringify(error)}`)
            output.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                output.message = error.message;
            } else {
                output.message = 'Internal Server Error';
            }
        }
        return output
    }
    @ApiOperation({ summary: 'Get All Agent' })
    @ApiCreatedResponse({
        description: 'Get All Agent',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Get('agent')
    async getAllAgents() {
        let output = new ResponseData;
        try {
            let customerData = await this.customerService.getAllAgents();
            this.logger.log(`getAllAgents: ${JSON.stringify(customerData)}`)
            output.data = customerData;
        } catch (error) {
            this.logger.warn(`getAllAgents: ${JSON.stringify(error)}`)
            output.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                output.message = error.message;
            } else {
                output.message = 'Internal Server Error';
            }
        }
        return output
    }
    @ApiOperation({ summary: 'Get All Transporter' })
    @ApiCreatedResponse({
        description: 'Get All Transporter',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Get('transporter')
    async getAllTransporters() {
        let output = new ResponseData;
        try {
            let customerData = await this.customerService.getAllTransporters();
            this.logger.log(`getAllTransporters: ${JSON.stringify(customerData)}`)
            output.data = customerData;
        } catch (error) {
            this.logger.warn(`getAllTransporters: ${JSON.stringify(error)}`)
            output.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                output.message = error.message;
            } else {
                output.message = 'Internal Server Error';
            }
        }
        return output
    }

}
