import { BadRequestException, Body, Controller, Delete, Get, HttpCode, HttpStatus, Logger, Param, ParseIntPipe, Patch, Post, UnauthorizedException } from '@nestjs/common';
import { ApiCreatedResponse, ApiOperation } from '@nestjs/swagger';
import { ResponseData } from 'src/common/response-data';
import { SearchListDto } from 'src/masters/DTO/search-list.dto';
import { MilestoneService } from 'src/masters/services/milestone/milestone.service';

@Controller('milestone')
export class MilestoneController {
    constructor(private milestoneService: MilestoneService, private logger: Logger) { }

    @ApiOperation({ summary: 'Create new Milestone' })
    @ApiCreatedResponse({
        description: 'Create new Milestone',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Post('create')
    async createNewMilestone(@Body() newData: any) {
        let resp = new ResponseData();
        try {
            let res = await this.milestoneService.createNewMilestone(newData);
            this.logger.log(`New Milestone Created : ${JSON.stringify(res)}`);
            resp.data = res;
            resp.message = "New Milestone is successfully created"
        } catch (error) {
            this.logger.warn(`Milestone Creation Error : ${JSON.stringify(error)}`);
            resp.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                resp.message = error.message;
            } else {
                resp.message = "Internal Server Error";
            }
        }
        return resp;
    }

    @ApiOperation({ summary: 'Get All Milestones' })
    @ApiCreatedResponse({
        description: 'Get All Milestones',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Get()
    async getAllMilestones() {
        let resp = new ResponseData();
        try {
            let res = await this.milestoneService.getAllMilestones();
            this.logger.log(`All Milestones Fetched : ${JSON.stringify(res)}`);
            resp.data = res;
            resp.message = "All Milestones are successfully fetched";
        } catch (error) {
            this.logger.warn(`Get All Milestones Error : ${JSON.stringify(error)}`);
            resp.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                resp.message = error.message;
            } else {
                resp.message = "Internal Server Error";
            }
        }
        return resp;
    }

    @ApiOperation({ summary: 'Get Milestone by Id' })
    @ApiCreatedResponse({
        description: 'Get Milestone by Id',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Get('fetch/:MilestoneMasterSid')
    async getMilestoneById(@Param('MilestoneMasterSid', ParseIntPipe) MilestoneMasterSid: number) {
        let resp = new ResponseData();
        try {
            this.logger.log(`Getting Milestone with id : ${MilestoneMasterSid}`);
            let res = await this.milestoneService.fetchMilestoneById(MilestoneMasterSid);
            this.logger.debug(`Fetched Milestone : ${JSON.stringify(res)}`);
            resp.data = res;
            resp.message = `Milestone with id : ${MilestoneMasterSid} is successfully fetched`;
        } catch (error) {
            this.logger.warn(`Get Milestone by Id Error : ${JSON.stringify(error)}`);
            resp.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                resp.message = error.message;
            } else {
                resp.message = "Internal Server Error";
            }
        }
        return resp;
    }

    @ApiOperation({ summary: 'Update Milestone by Id' })
    @ApiCreatedResponse({
        description: 'Update Milestone by Id',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Patch('update/:MilestoneMasterSid')
    async updateMilestoneById(@Param('MilestoneMasterSid', ParseIntPipe) MilestoneMasterSid: number, @Body() payload: any) {
        let resp = new ResponseData();
        try {
            this.logger.log(`Updating Milestone with id : ${MilestoneMasterSid}`);
            let res = await this.milestoneService.updateMilestoneById(MilestoneMasterSid, payload);
            this.logger.debug(`Updated Milestone : ${JSON.stringify(res)}`);
            resp.data = res;
            resp.message = `Milestone with id : ${MilestoneMasterSid} is successfully updated`;
        } catch (error) {
            this.logger.warn(`Milestone Updation Error : ${JSON.stringify(error)}`);
            resp.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                resp.message = error.message;
            } else {
                resp.message = "Internal Server Error";
            }
        }
        return resp;
    }

    @ApiOperation({ summary: 'Delete Milestone by Id' })
    @ApiCreatedResponse({
        description: 'Delete Milestone by Id',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Delete('delete/:MilestoneMasterSid')
    async deleteMilestoneById(@Param('MilestoneMasterSid', ParseIntPipe) MilestoneMasterSid: number) {
        let resp = new ResponseData();
        try {
            this.logger.log(`Deleting Milestone with id : ${MilestoneMasterSid}`);
            let res = await this.milestoneService.deleteMilestone(MilestoneMasterSid);
            this.logger.debug(`Deleted Milestone : ${JSON.stringify(res)}`);
            resp.data = res;
            resp.message = `Milestone with id : ${MilestoneMasterSid} is successfully deleted`;
        } catch (error) {
            this.logger.warn(`Milestone Deletion Error : ${JSON.stringify(error)}`);
            resp.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                resp.message = error.message;
            } else {
                resp.message = "Internal Server Error";
            }
        }
        return resp;
    }

    @ApiOperation({ summary: 'Search List of Milestones' })
    @ApiCreatedResponse({
        description: 'Search List of Milestones',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Post('search-list')
    async searchMilestone(@Body() searchData: SearchListDto) {
        let resp = new ResponseData();
        try {
            let res = await this.milestoneService.searchMilestone(searchData);
            this.logger.log(`Milestone Search Results :${JSON.stringify(res)}`);
            resp.data = res;
            resp.message = "Milestone Search results are successfully fetched"
        } catch (error) {
            this.logger.warn(`Milestone Search Error : ${JSON.stringify(error)}`);
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