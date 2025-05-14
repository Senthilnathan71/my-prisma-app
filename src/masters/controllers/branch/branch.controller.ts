import { BadRequestException, Body, Controller, Delete, Get, HttpCode, HttpStatus, Logger, Param, ParseIntPipe, Patch, Post, UnauthorizedException } from '@nestjs/common';
import { ApiCreatedResponse, ApiOperation } from '@nestjs/swagger';
import { Prisma } from '@prisma/client';
import { ResponseData } from 'src/common/response-data';
import { SearchListDto } from 'src/masters/DTO/search-list.dto';
import { BranchService } from 'src/masters/services/branch/branch.service';

@Controller('branch')
export class BranchController {
    constructor(private branchService: BranchService, private logger: Logger) { }

    @ApiOperation({ summary: 'Create new Branch' })
    @ApiCreatedResponse({
        description: "Create new Branch",
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Post('Create')
    async createNewBranch(@Body() newData: Prisma.BranchMasterCreateInput) {
        let resp = new ResponseData();
        try {
            let res = await this.branchService.createNewBranch(newData);
            this.logger.log(`Branch Created : ${JSON.stringify(res)}`);
            resp.data = res;
            resp.message = "New Branch is successfully created";
        } catch (error) {
            this.logger.warn(`Branch Creation Error : ${JSON.stringify(error), error}`)
            resp.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                resp.message = error.message;
            } else {
                resp.message = "Internal Server Error";
            }
        }
        return resp;
    }


    @ApiOperation({ summary: 'Get All Branch' })
    @ApiCreatedResponse({
        description: "Get All Branch",
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Get()
    async getAllBranch() {
        let resp = new ResponseData();
        try {
            let allBranches = await this.branchService.getAllBranches();
            this.logger.log(`All Branches Fetched : ${JSON.stringify(allBranches)}`);
            resp.data = allBranches;
            resp.message = "All Branches are successfully fetched";
        } catch (error) {
            this.logger.warn(`Get All Branch Error : ${JSON.stringify(error), error}`)
            resp.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                resp.message = error.message;
            } else {
                resp.message = "Internal Server Error";
            }
        }
        return resp;
    }



    @ApiOperation({ summary: 'Get Branch by Id' })
    @ApiCreatedResponse({
        description: "Get Branch by Id",
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Get('fetch/:BranchMasterSid')
    async getBranchById(@Param('BranchMasterSid', ParseIntPipe) BranchMasterSid: number) {
        let resp = new ResponseData();
        try {
            this.logger.log(`Getting Branch with id : ${BranchMasterSid}`);
            let res = await this.branchService.getBranchById(BranchMasterSid);
            this.logger.debug(`Fetched Branch : ${JSON.stringify(res)}`);
            resp.data = res;
            resp.message = `Branch with id : ${BranchMasterSid} is successfully fetched`;
        } catch (error) {
            this.logger.warn(`Get Branch by Id Error : ${JSON.stringify(error), error}`)
            resp.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                resp.message = error.message;
            } else {
                resp.message = "Internal Server Error";
            }
        }
        return resp;
    }



    @ApiOperation({ summary: 'Update Branch by Id' })
    @ApiCreatedResponse({
        description: "Update Branch by Id",
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Patch('update/:BranchMasterSid')
    async updateBranchById(@Param('BranchMasterSid', ParseIntPipe) BranchMasterSid: number, @Body() updateData: Prisma.BranchMasterUpdateInput) {
        let resp = new ResponseData();
        try {
            this.logger.log(`Updating Branch with id : ${BranchMasterSid}`)
            let res = await this.branchService.updateBranchById(BranchMasterSid, updateData);
            this.logger.debug(`Updated Branch :${JSON.stringify(res)}`);
            resp.data = res;
            resp.message = `Branch with id :${BranchMasterSid} is successfully updated`;
        } catch (error) {
            this.logger.warn(`Branch Updation Error : ${JSON.stringify(error), error}`)
            resp.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                resp.message = error.message;
            } else {
                resp.message = "Internal Server Error";
            }
        }
        return resp;
    }




    @ApiOperation({ summary: 'Delete Branch by Id' })
    @ApiCreatedResponse({
        description: "Delete Branch by Id",
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Delete('delete/:BranchMasterSid')
    async deleteBranchById(@Param('BranchMasterSid', ParseIntPipe) BranchMasterSid: number) {
        let resp = new ResponseData();
        try {
            this.logger.log(`Deleting Branch with id : ${BranchMasterSid}`);
            let res = await this.branchService.deleteBranchById(BranchMasterSid);
            this.logger.debug(`Deleted Branch : ${JSON.stringify(res)}`);
            resp.data = res;
            resp.message = `Branch with id : ${BranchMasterSid} is successfully deleted`;
        } catch (error) {
            this.logger.warn(`Branch Deletion Error : ${JSON.stringify(error), error}`)
            resp.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                resp.message = error.message;
            } else {
                resp.message = "Internal Server Error";
            }
        }
        return resp;
    }



    @ApiOperation({ summary: 'Search List of Branch' })
    @ApiCreatedResponse({
        description: "Search List of Branch",
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Post('search-list')
    async searchBranch(@Body() searchData: SearchListDto) {
        let resp = new ResponseData();
        try {
            let res = await this.branchService.searchBranch(searchData);
            this.logger.log(`Branch Search Results = ${JSON.stringify(res)}`);
            resp.data = res;
            resp.message = "Branch Search Results are successfully fetched";
        } catch (error) {
            this.logger.warn(`Branch Search Error : ${error}`)
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
