import { BadRequestException, Body, Controller, Delete, Get, HttpCode, HttpStatus, Logger, Param, ParseIntPipe, Patch, Post, UnauthorizedException } from '@nestjs/common';
import { ApiCreatedResponse, ApiOperation } from '@nestjs/swagger';
import { Prisma } from '@prisma/client';
import { ResponseData } from 'src/common/response-data';
import { SearchListDto } from 'src/masters/DTO/search-list.dto';
import { CustomerBranchEmailService } from 'src/masters/services/customer-branch-email/customer-branch-email.service';

@Controller('customer-branch-email')
export class CustomerBranchEmailController {
    constructor(private logger: Logger, private customerBrEmailServ: CustomerBranchEmailService) { }

    @ApiOperation({ summary: 'Create new Customer Branch Email' })
    @ApiCreatedResponse({
        description: 'Create new Customer Branch Email',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Post('create')
    async createNewCustomerBrEmail(@Body() newData: Prisma.CustomerBrEmailCreateInput) {
        let resp = new ResponseData();
        try {
            let res = await this.customerBrEmailServ.createNewCustomerBrEmail(newData);
            this.logger.log(`New Customer Branch Email Created ${JSON.stringify(res)}`);
            resp.data = res;
            resp.message = "New Customer Branch Email is successfully created"
        } catch (error) {
            this.logger.warn(`CustomerBranch Email Creation Error ${JSON.stringify(error), error}`)
            resp.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                resp.message = error.message;
            } else {
                resp.message = "Internal Server Error";
            }
        }
        return resp;
    }


    @ApiOperation({ summary: 'Get All Customer Branch Email' })
    @ApiCreatedResponse({
        description: 'Get All Customer Branch Email',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Get()
    async getAllCustomerBrEmail() {
        let resp = new ResponseData();
        try {
            let res = await this.customerBrEmailServ.getAllCustomerBrEmail();
            this.logger.log(`All Customer Branch Email :${JSON.stringify(res)}`);
            resp.data = res;
            resp.message = "All Customer Branch Emails are successfully fetched";
        } catch (error) {
            this.logger.warn(`Get All CustomerBranch Email Error : ${JSON.stringify(error), error}`)
            resp.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                resp.message = error.message;
            } else {
                resp.message = "Internal Server Error";
            }
        }
        return resp;
    }


    @ApiOperation({ summary: 'Get Customer Branch Email by Id' })
    @ApiCreatedResponse({
        description: 'Get Customer Branch Email by Id',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Get('fetch/:CustomerBrEmailSid')
    async getCustomerBrEmailById(@Param('CustomerBrEmailSid', ParseIntPipe) CustomerBrEmailSid: number) {
        let resp = new ResponseData();
        try {
            this.logger.log(`Fetching customer branch email with id : ${CustomerBrEmailSid}`);
            let res = await this.customerBrEmailServ.getCustomerBrEmailById(CustomerBrEmailSid);
            this.logger.debug(`Fetched Customer Branch Email : ${JSON.stringify(res)}`);
            resp.data = res;
            resp.message = `Customer Branch Email with id : ${CustomerBrEmailSid} is successfully`;
        } catch (error) {
            this.logger.warn(`Get CustomerBranchEmail By ID Error ${JSON.stringify(error), error}`)
            resp.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                resp.message = error.message;
            } else {
                resp.message = "Internal Server Error";
            }
        }
        return resp;
    }





    @ApiOperation({ summary: 'Update Customer Branch Email By Id' })
    @ApiCreatedResponse({
        description: 'Update Customer Branch Email By Id',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Patch('update/:CustomerBrEmailSid')
    async updateCustomerBrEmailById(@Param('CustomerBrEmailSid', ParseIntPipe) CustomerBrEmailSid: number, @Body() updateData: Prisma.CustomerBrEmailUpdateInput) {
        let resp = new ResponseData();
        try {
            this.logger.log(`Updating Customer Branch Email with id :${CustomerBrEmailSid}`);
            let res = await this.customerBrEmailServ.updateCustomerBrEmailById(CustomerBrEmailSid, updateData);
            this.logger.debug(`Customer Branch Email Updated : ${JSON.stringify(res)}`);
            resp.data = res;
            resp.message = `Customer Branch Email with id : ${CustomerBrEmailSid} is successfully updated`;
        } catch (error) {
            this.logger.warn(`CustomerBranch Email Updation Error ${JSON.stringify(error), error}`)
            resp.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                resp.message = error.message;
            } else {
                resp.message = "Internal Server Error";
            }
        }
        return resp;
    }


    @ApiOperation({ summary: 'Delete Customer Branch Email By Id' })
    @ApiCreatedResponse({
        description: 'Delete Customer Branch Email By Id',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Delete('delete/:CustomerBrEmailSid')
    async deleteCustomerBrEmailById(@Param('CustomerBrEmailSid', ParseIntPipe) CustomerBrEmailSid: number) {
        let resp = new ResponseData();
        try {
            this.logger.log(`Deleting Customer Branch Email : ${CustomerBrEmailSid}`);
            let res = await this.customerBrEmailServ.deleteCustomerBrEmailById(CustomerBrEmailSid);
            this.logger.debug(`Deleted Customer Branch Email : ${JSON.stringify(res)}`);
            resp.data = res;
            resp.message = `Customer Branch Email with id : ${CustomerBrEmailSid} is successfully deleted`;
        } catch (error) {
            this.logger.warn(`CustomerBranch Email Deletion Error ${JSON.stringify(error), error}`)
            resp.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                resp.message = error.message;
            } else {
                resp.message = "Internal Server Error";
            }
        }
        return resp;
    }







    @ApiOperation({ summary: 'Search List of Customer Branch Email' })
    @ApiCreatedResponse({
        description: 'Search List of Customer Branch Email',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Post('search-list')
    async searchCustomerBranchEmail(@Body() body: SearchListDto) {
        let resp = new ResponseData();
        try {
            let res = await this.customerBrEmailServ.searchCustomerBrEmail(body);
            this.logger.log(`Customer Branch Email SearchResults : ${JSON.stringify(res)}`);
            resp.data = res;
            resp.message = "Customer Branch Email Search is successfully fetched";
        } catch (error) {
            this.logger.warn(`CustomerBranch Email Search Error ${JSON.stringify(error), error}`)
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
