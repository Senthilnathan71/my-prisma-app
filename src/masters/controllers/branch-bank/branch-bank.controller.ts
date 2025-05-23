import { BadRequestException, Body, Controller, Delete, Get, HttpCode, HttpStatus, Logger, Param, ParseIntPipe, Patch, Post, UnauthorizedException } from '@nestjs/common';
import { ApiCreatedResponse, ApiOperation } from '@nestjs/swagger';
import { Prisma } from '@prisma/client';
import { ResponseData } from 'src/common/response-data';
import { SearchListDto } from 'src/masters/DTO/search-list.dto';
import { BranchBankService } from 'src/masters/services/branch-bank/branch-bank.service';

@Controller('branch-bank')
export class BranchBankController {
    constructor(private branchBankService:BranchBankService,private logger:Logger){}

    @ApiOperation({summary:'Create new Branch Bank'})
    @ApiCreatedResponse({
        description:'Create New Branch Bank',
        type:ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Post('create')
    async createNewBranchBank(@Body() payload:Prisma.BranchBankCreateInput){
        let resp = new ResponseData();
        try {
            this.logger.log('Creating new Branch Bank');
            let res= await this.branchBankService.createNewBranchBack(payload);
            this.logger.debug(`New Branch Bank Created : ${res}`);
            resp.data=res;
            resp.message="New Branch Bank is successfully created";
        } catch (error) {
            this.logger.warn(`Branch Bank Creation Error : ${JSON.stringify(error),error}`)
            resp.status=false;
            if(error instanceof BadRequestException || error instanceof UnauthorizedException){
                resp.message=error.message;
            } else {
                resp.message='Internal Server Error'
            }
        }
        return resp;
    }


    @ApiOperation({summary:'Get All Branch Banks'})
    @ApiCreatedResponse({
        description:'Get All Branch Banks',
        type:ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Get()
    async getAllBranchBanks(){
        let resp = new ResponseData();
        try {
            this.logger.log('Getting All Branch Bank')
            let res= await this.branchBankService.getAllBranchBanks();
            this.logger.debug(`All Branch Banks are fetched : ${JSON.stringify(res)}`);
            resp.data=res;
            resp.message="All Branch Banks are successfully fetched";
        } catch (error) {
            this.logger.warn(`Branch Bank Creation Error : ${JSON.stringify(error),error}`)
            resp.status=false;
            if(error instanceof BadRequestException || error instanceof UnauthorizedException){
                resp.message=error.message;
            } else {
                resp.message='Internal Server Error'
            }
        }
        return resp;
    }
    @ApiOperation({summary:'Get Branch Banks by Id'})
    @ApiCreatedResponse({
        description:'Get Branch Banks by Id',
        type:ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Get('fetch/:BranchBankSid')
    async getBranchBankById(@Param('BranchBankSid',ParseIntPipe) BranchBankSid:number){
        let resp = new ResponseData();
        try {
            this.logger.log(`Fetching Branch Banks with Id:${BranchBankSid}`);
            let res=await this.branchBankService.getBranchBankById(BranchBankSid);
            this.logger.debug(`Branch Bank Fetched :${JSON.stringify(res)}`);
            resp.data=res;
            resp.message=`Branch Bank with id :${BranchBankSid} is successfully fetched`;
        } catch (error) {
            this.logger.warn(`Branch Bank Creation Error : ${JSON.stringify(error),error}`)
            resp.status=false;
            if(error instanceof BadRequestException || error instanceof UnauthorizedException){
                resp.message=error.message;
            } else {
                resp.message='Internal Server Error'
            }
        }
        return resp;
    }

    @ApiOperation({summary:'Update Branch Bank By Id'})
    @ApiCreatedResponse({
        description:'Update Branch Bank By Id',
        type:ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Patch('update/:BranchBankSid')
    async updateBranchBankById(@Param('BranchBankSid',ParseIntPipe) BranchBankSid:number,@Body() payload:Prisma.BranchBankUpdateInput){
        let resp = new ResponseData();
        try {
            this.logger.log(`Updating Branch Bank with id:${BranchBankSid}`);
            let res=await this.branchBankService.updateBranchBankById(BranchBankSid,payload);
            this.logger.debug(`Branch Bank Updated : ${JSON.stringify(res)}`);
            resp.data=res;
            resp.message=`Branch bank with id :${BranchBankSid} is successfully updated`;
        } catch (error) {
            this.logger.warn(`Branch Bank Creation Error : ${JSON.stringify(error),error}`)
            resp.status=false;
            if(error instanceof BadRequestException || error instanceof UnauthorizedException){
                resp.message=error.message;
            } else {
                resp.message='Internal Server Error'
            }
        }
        return resp;
    }
    @ApiOperation({summary:'Delete Branch Bank by Id'})
    @ApiCreatedResponse({
        description:'Delete Branch Bank by Id',
        type:ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Delete('delete/:BranchBankSid')
    async deleteBranchBankBy(@Param('BranchBankSid',ParseIntPipe) BranchBankSid:number){
        let resp = new ResponseData();
        try {
            this.logger.log(`Deleting Branch Bank with id:${BranchBankSid}`);
            let res = await this.branchBankService.deleteBranchBankById(BranchBankSid);
            this.logger.debug(`Branch Bank Deleted :${JSON.stringify(res)}`);
            resp.data=res;
            resp.message=`Branch bank with id :${BranchBankSid} is successfully deleted`;
        } catch (error) {
            this.logger.warn(`Branch Bank Creation Error : ${JSON.stringify(error),error}`)
            resp.status=false;
            if(error instanceof BadRequestException || error instanceof UnauthorizedException){
                resp.message=error.message;
            } else {
                resp.message='Internal Server Error'
            }
        }
        return resp;
    }


    @ApiOperation({summary:'Search List of Branch Bank'})
    @ApiCreatedResponse({
        description:'Search List of Branch Bank',
        type:ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Post('search-list')
    async searchBranchBank(@Body() payload:SearchListDto){
        let resp = new ResponseData();
        try {
            this.logger.log(`Searching Branch Bank :${JSON.stringify(payload)}`)
            let res = await this.branchBankService.searchBranchBank(payload);
            this.logger.debug(`Branch Bank Search Results : ${JSON.stringify(res)}`);
            resp.data=res;
            resp.message="Branch Bank search results are successfully fetched";
        } catch (error) {
            this.logger.warn(`Branch Bank Creation Error : ${JSON.stringify(error),error}`)
            resp.status=false;
            if(error instanceof BadRequestException || error instanceof UnauthorizedException){
                resp.message=error.message;
            } else {
                resp.message='Internal Server Error'
            }
        }
        return resp;
    }

}
