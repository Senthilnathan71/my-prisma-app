import { BadRequestException, Body, Controller, Delete, Get, HttpCode, HttpStatus, Logger, Param, ParseIntPipe, Patch, Post, UnauthorizedException } from '@nestjs/common';
import { ApiCreatedResponse, ApiOperation } from '@nestjs/swagger';
import { Auth } from 'src/common/decorators/auth.decorator';
import { ResponseData } from 'src/common/response-data';
import { SearchListDto } from 'src/masters/DTO/search-list.dto';
import { CustomerLoginService } from 'src/masters/services/customer-login/customer-login.service';
@Auth()
@Controller('customer-login')
export class CustomerLoginController {
    constructor(private logger: Logger, private customerLoginServ: CustomerLoginService) { }

    @ApiOperation({ summary: 'Create new Customer Login' })
    @ApiCreatedResponse({
        description: 'Create new Customer Login',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Post('create')
    async createNewCustomerLogin(@Body() newData: any) {
        let resp = new ResponseData();
        try {
            let res = await this.customerLoginServ.createNewCustomerLogin(newData);
            this.logger.log(`New Customer Login Created : ${JSON.stringify(res)}`);
            resp.data = res;
            resp.message = "New Customer Login is successfully created";
        } catch (error) {
            this.logger.warn(`Customer Login Creation Error ${JSON.stringify(error), error}`)
            resp.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                resp.message = error.message;
            } else {
                resp.message = "Internal Server Error";
            }
        }
        return resp;
    }



    @ApiOperation({ summary: 'Get All Customer Login' })
    @ApiCreatedResponse({
        description: 'Get All Customer Login',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Get()
    async getAllCustomerLogin() {
        let resp = new ResponseData();
        try {
            let res = await this.customerLoginServ.getAllCustomerLogin();
            this.logger.log(`All Customer Login are Fetched : ${JSON.stringify(res)}`);
            resp.data = res;
            resp.message = "All Customer Login are successfully fetched";
        } catch (error) {
            this.logger.warn(`Get All Customer Login Error ${JSON.stringify(error), error}`)
            resp.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                resp.message = error.message;
            } else {
                resp.message = "Internal Server Error";
            }
        }
        return resp;
    }







    @ApiOperation({ summary: 'Get Customer Login by Id' })
    @ApiCreatedResponse({
        description: 'Get Customer Login by Id',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Get('fetch/:CustomerLoginSid')
    async getCustomerLoginById(@Param('CustomerLoginSid', ParseIntPipe) CustomerLoginSid: number) {
        let resp = new ResponseData();
        try {
            this.logger.log(`Fetching Customer Login with id :${CustomerLoginSid}`);
            let res = await this.customerLoginServ.getCustomerLoginById(CustomerLoginSid);
            this.logger.debug(`Customer Login with Id : ${JSON.stringify(res)}`);
            resp.data = res;
            resp.message = `Customer login with id : ${CustomerLoginSid} is successfully fetched`;
        } catch (error) {
            this.logger.warn(`Get Customer Login By ID Error ${JSON.stringify(error), error}`)
            resp.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                resp.message = error.message;
            } else {
                resp.message = "Internal Server Error";
            }
        }
        return resp;
    }





    @ApiOperation({ summary: 'Update Customer Login By Id' })
    @ApiCreatedResponse({
        description: 'Update Customer Login By Id',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Patch('update/:CustomerLoginSid')
    async updateCustomerLoginById(@Param('CustomerLoginSid', ParseIntPipe) CustomerLoginSid: number, @Body() updateData: any) {
        let resp = new ResponseData();
        try {
            this.logger.log(`Updating Customer Login with id : ${CustomerLoginSid}`);
            let res = await this.customerLoginServ.updateCustomerLogin(CustomerLoginSid, updateData);
            this.logger.debug(`Updated Customer Login : ${JSON.stringify(res)}`);
            resp.data = res;
            resp.message = `Customer Login with id : ${CustomerLoginSid} is successfully updated`;
        } catch (error) {
            this.logger.warn(`Customer Login Updation Error ${JSON.stringify(error), error}`)
            resp.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                resp.message = error.message;
            } else {
                resp.message = "Internal Server Error";
            }
        }
        return resp;
    }









    @ApiOperation({ summary: 'Delete Customer Login By Id' })
    @ApiCreatedResponse({
        description: 'Delete Customer Login By Id',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Delete('delete/:CustomerLoginSid')
    async deleteCustomerLoginById(@Param('CustomerLoginSid', ParseIntPipe) CustomerLoginSid: number,@Body('updatedBy') updatedBy: string) {
        let resp = new ResponseData();
        try {
            this.logger.log(`Deleting Customer Login with Id : ${CustomerLoginSid}`);
            let res = await this.customerLoginServ.deleteCustomerLogin(CustomerLoginSid, updatedBy);
            this.logger.debug(`Deleted Customer Login : ${JSON.stringify(res)}`);
            resp.data = res;
            resp.message = `Customer Login with id : ${CustomerLoginSid} is successfully deleted`
        } catch (error) {
            this.logger.warn(`Customer Login Deletion Error ${JSON.stringify(error), error}`)
            resp.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                resp.message = error.message;
            } else {
                resp.message = "Internal Server Error";
            }
        }
        return resp;
    }







    @ApiOperation({ summary: 'Search List of Customer Login' })
    @ApiCreatedResponse({
        description: 'Search List of Customer Login',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Post('search-list')
    async searchCustomerLogin(@Body() body: SearchListDto) {
        let resp = new ResponseData();
        try {
            let res = await this.customerLoginServ.searchCustomerlogin(body);
            this.logger.log(`Customer Login Search Results : ${JSON.stringify(res)}`);
            resp.data = res;
            resp.message = "Customer Login Search results are successfully fetched";
        } catch (error) {
            this.logger.warn(`Customer Login Search Error ${JSON.stringify(error), error}`)
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
