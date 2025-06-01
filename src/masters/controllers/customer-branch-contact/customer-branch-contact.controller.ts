import { BadRequestException, Body, Controller, Delete, Get, HttpCode, HttpStatus, Logger, Param, ParseIntPipe, Patch, Post, UnauthorizedException } from '@nestjs/common';
import { ApiCreatedResponse, ApiOperation } from '@nestjs/swagger';
import { ResponseData } from 'src/common/response-data';
import { SearchListDto } from 'src/masters/DTO/search-list.dto';
import { CustomerBranchContactService } from 'src/masters/services/customer-branch-contact/customer-branch-contact.service';

@Controller('customer-branch-contact')
export class CustomerBranchContactController {
    constructor(private logger: Logger, private customerBrContactServ: CustomerBranchContactService) { }


    @ApiOperation({ summary: 'Create new Customer Branch Contact' })
    @ApiCreatedResponse({
        description: 'Create new Customer Branch Contact',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Post('create')
    async createNewCustomerBrContact(@Body() newData:any) {
        let resp = new ResponseData();
        try {
            let res = await this.customerBrContactServ.createNewCustomerBrContact(newData);
            this.logger.log(`New Customer Branch Contact Created : ${JSON.stringify(res)}`);
            resp.data = res;
            resp.message = "New Customer Branch Contact is successfully created";
        } catch (error) {
            this.logger.warn(`CustomerBranch Contact Creation Error ${JSON.stringify(error), error}`)
            resp.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                resp.message = error.message;
            } else {
                resp.message = "Internal Server Error";
            }
        }
        return resp;
    }


    @ApiOperation({ summary: 'Get All Customer Branch Contact' })
    @ApiCreatedResponse({
        description: 'Get All Customer Branch Contact',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Get()
    async getAllCustomerBrContact() {
        let resp = new ResponseData();
        try {
            let res = await this.customerBrContactServ.getAllCustomerBrContact();
            this.logger.log(`All Customer branch Contact Fetched : ${JSON.stringify(res)}`);
            resp.data = res;
            resp.message = "All Customer Branch Contact are successfully fetched";
        } catch (error) {
            this.logger.warn(`Get All CustomerBranch Contact Error ${JSON.stringify(error), error}`)
            resp.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                resp.message = error.message;
            } else {
                resp.message = "Internal Server Error";
            }
        }
        return resp;
    }


    @ApiOperation({ summary: 'Get Customer Branch Contact by Id' })
    @ApiCreatedResponse({
        description: 'Get Customer Branch Contact by Id',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Get('fetch/:CusBranchContactSid')
    async getCustomerBrContactById(@Param('CusBranchContactSid', ParseIntPipe) CusBranchContactSid: number) {
        let resp = new ResponseData();
        try {
            this.logger.log(`Fetching Customer Branch Contact with id : ${CusBranchContactSid}`);
            let res = await this.customerBrContactServ.getCustomerBrContactById(CusBranchContactSid);
            this.logger.debug(`Fetched Customer Branch Contact : ${JSON.stringify(res)}`);
            resp.data = res;
            resp.message = `Customer Branch Contact with Id ${CusBranchContactSid} is successfully fetched`;
        } catch (error) {
            this.logger.warn(`Get CustomerBranchContact By ID Error ${JSON.stringify(error), error}`)
            resp.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                resp.message = error.message;
            } else {
                resp.message = "Internal Server Error";
            }
        }
        return resp;
    }


    @ApiOperation({ summary: 'Update Customer Branch Contact By Id' })
    @ApiCreatedResponse({
        description: 'Update Customer Branch Contact By Id',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Patch('update/:CusBranchContactSid')
    async updateCustomerBrContactById(@Param('CusBranchContactSid', ParseIntPipe) CusBranchContactSid: number, @Body() updateData:any) {
        let resp = new ResponseData();
        try {
            this.logger.log(`Updating Customer Branch with id : ${CusBranchContactSid}`)
            let res = await this.customerBrContactServ.updateCustomerBrContactById(CusBranchContactSid, updateData);
            this.logger.debug(`Updated Customer Branch Contact : ${JSON.stringify(res)}`);
            resp.data = res;
            resp.message = `Customer Branch Contact with id : ${CusBranchContactSid} is successfully updated`;
        } catch (error) {
            this.logger.warn(`CustomerBranch Contact Updation Error ${JSON.stringify(error), error}`)
            resp.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                resp.message = error.message;
            } else {
                resp.message = "Internal Server Error";
            }
        }
        return resp;
    }


    @ApiOperation({ summary: 'Delete Customer Branch Contact By Id' })
    @ApiCreatedResponse({
        description: 'Delete Customer Branch Contact By Id',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Delete('delete/:CusBranchContactSid')
    async deleteCustomerBrContactById(@Param('CusBranchContactSid', ParseIntPipe) CusBranchContactSid: number) {
        let resp = new ResponseData();
        try {
            this.logger.log(`Deleting Customer Branch Contact with id :${CusBranchContactSid} `)
            let res = await this.customerBrContactServ.deleteCustomerBrContactById(CusBranchContactSid);
            this.logger.debug(`Deleted Customer Branch Contact Data : ${JSON.stringify(res)}`);
            resp.data = res;
            resp.message = `Customer Branch Contact with id :${CusBranchContactSid} is successfully deleted`;
        } catch (error) {
            this.logger.warn(`CustomerBranch Contact Deletion Error ${JSON.stringify(error), error}`)
            resp.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                resp.message = error.message;
            } else {
                resp.message = "Internal Server Error";
            }
        }
        return resp;
    }


    @ApiOperation({ summary: 'Search List of Customer Branch Contact' })
    @ApiCreatedResponse({
        description: 'Search List of Customer Branch Contact',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Post('search-list')
    async searchCustomerBranchContact(@Body() body: SearchListDto) {
        let resp = new ResponseData();
        try {
            let res = await this.customerBrContactServ.searchCustomerBrContact(body);
            this.logger.log(`Customer Branch Contact Search Results : ${JSON.stringify(res)}`);
            resp.data = res;
            resp.message = "Customer Branch Contact search is successfully fetched"
        } catch (error) {
            this.logger.warn(`CustomerBranch Contact Search Error ${JSON.stringify(error), error}`)
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
