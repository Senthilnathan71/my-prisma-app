import { BadRequestException, Body, Controller, Delete, Get, HttpCode, HttpStatus, Logger, Param, ParseIntPipe, Patch, Post, UnauthorizedException } from '@nestjs/common';
import { ApiCreatedResponse, ApiOperation } from '@nestjs/swagger';
import { Prisma } from '@prisma/client';
import { ResponseData } from 'src/common/response-data';
import { SearchListDto } from 'src/masters/DTO/search-list.dto';
import { CustomerBranchService } from 'src/masters/services/customer-branch/customer-branch.service';

@Controller('customer-branch')
export class CustomerBranchController {
    constructor(private customerBranchService: CustomerBranchService, private logger: Logger) { }

    @ApiOperation({ summary: 'Create new Customer Branch' })
    @ApiCreatedResponse({
        description: 'Create new Customer Branch ',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Post('create')
    async createNewCustomerBranch(@Body() body: Prisma.CustomerBranchCreateInput) {
        let resp = new ResponseData();
        try {
            let res = await this.customerBranchService.createNewCustomerBranch(body);
            this.logger.log(`New Customer Branch Created :${JSON.stringify(res)}`);
            resp.data = res;
            resp.message = "New Customer Branch is successfully created";
        } catch (error) {
            this.logger.warn(`Customer branch Creation Error : ${JSON.stringify(error), error}`)
            resp.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                resp.message = error.message;
            } else {
                resp.message = "Internal Server Error";
            }
        }
        return resp;
    }

    @ApiOperation({ summary: 'Get All Customer Branches' })
    @ApiCreatedResponse({
        description: 'Get All Customer Branches',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Get()
    async getAllCustomerBranch() {
        let resp = new ResponseData();
        try {
            let res = await this.customerBranchService.getAllCustomerBranch();
            this.logger.log(`All Customer Branch Data: ${JSON.stringify(res)}`);
            resp.data = res;
            resp.message = "All Customer Branches are successfully fetched"
        } catch (error) {
            this.logger.warn(`Getting All Customer Branch Error: ${JSON.stringify(error), error}`)
            resp.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                resp.message = error.message;
            } else {
                resp.message = "Internal Server Error"
            }
        }
        return resp;
    }

    @ApiOperation({ summary: 'Get Customer Branch By Id' })
    @ApiCreatedResponse({
        description: 'Get Customer Branch by Id',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Get('fetch/:CustomerBranchSid')
    async getCustomerBranchById(@Param('CustomerBranchSid', ParseIntPipe) CustomerBranchSid: number) {
        let resp = new ResponseData();
        try {
            this.logger.log(`Fetching CustomerBranch with id : ${CustomerBranchSid} `)
            let res = await this.customerBranchService.getCustomerBranchById(CustomerBranchSid);
            this.logger.debug(`Fetch CustomerBranch Result : ${JSON.stringify(res)}`);
            resp.data = res;
            resp.message = "Fetching Customer Branch is successfull"
        } catch (error) {
            this.logger.warn(`Getting Error in fetching CustomerBranch with Id : ${CustomerBranchSid}`)
            resp.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                resp.message = error.message;
            } else {
                resp.message = "Internal Server Error";
            }
        }
        return resp;
    }


    @ApiOperation({ summary: 'Updating Customer Branch with Id' })
    @ApiCreatedResponse({
        description: "Updating Customer Branch by Id",
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Patch('update/:CustomerBranchSid')
    async updateCustomerBranchWithId(@Param('CustomerBranchSid', ParseIntPipe) CustomerBranchSid: number, @Body() body: Prisma.CustomerBranchUpdateInput) {
        let resp = new ResponseData();
        try {
            this.logger.log(`Updating CustomerBranch with Id : ${CustomerBranchSid}`);
            let res = await this.customerBranchService.updateCustomerBranchById(CustomerBranchSid, body);
            this.logger.debug(`Customer Branch Updated :${JSON.stringify(res)}`);
            resp.data = res;
            resp.message = "Customer Branch is successfully updated";
        } catch (error) {
            this.logger.warn(`Customer Branch Updation Error :${JSON.stringify(error), error}`);
            resp.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                resp.message = error.message;
            } else {
                resp.message = "Internal Server Error";
            }
        }
        return resp;
    }

    @ApiOperation({ summary: "Delete Customer Branch by Id" })
    @ApiCreatedResponse({
        description: 'Deleting Customer Branch by Id',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Delete('delete/:CustomerBranchSid')
    async deleteCustomerBranch(@Param('CustomerBranchSid', ParseIntPipe) CustomerBranchSid: number) {
        let resp = new ResponseData();
        try {
            this.logger.log(`Deleting Customer Branch with id:${CustomerBranchSid}`)
            let res = await this.customerBranchService.softDeleteCustomerBranch(CustomerBranchSid);
            this.logger.debug(`Deleted Customer Branch : ${JSON.stringify(res)}`);
            resp.data = res;
            resp.message = "Customer Branch is successfully deleted";
        } catch (error) {
            this.logger.warn(`Customer Branch Deletion Error : ${JSON.stringify(error), error}`);
            resp.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                resp.message = error.message;
            } else {
                resp.message = "Internal Server Error";
            }
        }
        return resp;
    }


    @ApiOperation({ summary: "Search List of CustomerBranch" })
    @ApiCreatedResponse({
        description: "Search List of Customer Branch",
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Post('search-list')
    async searchCustomerBranch(@Body() body: SearchListDto) {
        let resp = new ResponseData();
        try {
            let res = await this.customerBranchService.searchCustomerBranch(body);
            this.logger.log(`Customer Branch Search Results :${JSON.stringify(res)}`);
            resp.data = res;
            resp.message = "Customer Branch Search is successfully fetched";
        } catch (error) {
            this.logger.warn(`Customer Branch Search Error : ${error}`)
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
