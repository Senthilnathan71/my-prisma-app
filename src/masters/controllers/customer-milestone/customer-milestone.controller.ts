import { BadRequestException, Body, Controller, Delete, Get, HttpCode, HttpStatus, Logger, Param, ParseIntPipe, Post, UnauthorizedException } from '@nestjs/common';
import { ApiCreatedResponse, ApiOperation } from '@nestjs/swagger';
import { Auth } from 'src/common/decorators/auth.decorator';
import { ResponseData } from 'src/common/response-data';
import { CustomerMilestoneService } from 'src/masters/services/customer-milestone/customer-milestone.service';
@Auth()
@Controller('customer-milestone')
export class CustomerMilestoneController {
    constructor(
        private customerMilestoneService:CustomerMilestoneService,
        private logger : Logger
    ) {}

    @ApiOperation({summary: 'Get all customer milestones by customer id'})
    @ApiCreatedResponse({
        description: 'Get all customer milestones by customer id',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Get('fetchByCustomer/:CustomerMasterSid')
    async getAllCustomerMilestonesByCustomerId(@Param('CustomerMasterSid',ParseIntPipe) CustomerMasterSid:number) {
        let resp = new ResponseData();
        try {
            this.logger.log('Fetching all customer milestones by customer id ...');
            console.log(CustomerMasterSid);
            console.log(typeof CustomerMasterSid);
            const allMilestones = await this.customerMilestoneService.getAllCustomerMilestonesByCustomerId(CustomerMasterSid);
            this.logger.debug(`All customer milestones by customer id: ${JSON.stringify(allMilestones)}`);
            resp.data = allMilestones;
            resp.message = "All Customer Milestones fetched successfully";
        } catch (error) {
            resp.status = false;
            this.logger.warn(`Error occured while fetching all customer milestones: ${JSON.stringify(error),error}`);
            if(error instanceof BadRequestException || error instanceof UnauthorizedException){
                resp.message = error.message;
            } else {
                resp.message = "Internal Server Error"
            }
        }
        return resp;
    }

    @ApiOperation({summary: 'Save Customer milestones'})
    @ApiCreatedResponse({
        description: 'Save Customer milestones',
        type: ResponseData
    })
    @HttpCode(HttpStatus.CREATED)
    @Post('save')
    async saveCustomerMilestones(@Body() customerMilestones:any[]) {
        let resp = new ResponseData();
        try {
            const savedMilestones = await this.customerMilestoneService.saveCustomerMilestone(customerMilestones);
            this.logger.debug(`Saved customer milestones: ${JSON.stringify(savedMilestones)}`);
            resp.data = savedMilestones;
            resp.message = "Customer Milestones saved successfully";
        } catch (error) {
            resp.status = false;
            this.logger.warn(`Error occured while saving customer milestones: ${JSON.stringify(error),error}`);
            if(error instanceof BadRequestException || error instanceof UnauthorizedException){
                resp.message = error.message;
            } else {
                resp.message = "Internal Server Error"
            }
        }
        return resp;
    }

    @ApiOperation({summary: 'Delete Customer milestone'})
    @ApiCreatedResponse({
        description: 'Delete Customer milestone',
        type: ResponseData
    })
    @HttpCode(HttpStatus.CREATED)
    @Delete('delete/:CustomerMilestoneSid')
    async deleteCustomerMilestone(@Param('CustomerMilestoneSid',ParseIntPipe) CustomerMilestoneSid) {
        let resp = new ResponseData();
        try {
            const deletedMilestone = await this.customerMilestoneService.deleteCustomerMilestone(CustomerMilestoneSid);
            this.logger.debug(`Deleted customer milestone: ${JSON.stringify(deletedMilestone)}`);
            resp.data = deletedMilestone;
            resp.message = "Customer Milestone deleted successfully";
        } catch (error) {
            resp.status = false;
            this.logger.warn(`Error occured while deleting customer milestone: ${JSON.stringify(error),error}`);
            if(error instanceof BadRequestException || error instanceof UnauthorizedException){
                resp.message = error.message;
            } else {
                resp.message = "Internal Server Error"
            }
        }
        return resp;
    }

}
