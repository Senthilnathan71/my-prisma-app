import { BadRequestException, Body, Controller, Delete, Get, HttpCode, HttpStatus, Logger, Param, ParseIntPipe, Patch, Post, UnauthorizedException } from '@nestjs/common';
import { ApiCreatedResponse, ApiOperation } from '@nestjs/swagger';
import { Auth } from 'src/common/decorators/auth.decorator';
import { UserData } from 'src/common/decorators/user.decorator';
import { ResponseData } from 'src/common/response-data';
import { FollowupService } from 'src/common/services/followup/followup.service';
import { SchedulerService } from 'src/common/services/scheduler/scheduler.service';

@Controller('followup')
@Auth()
export class FollowupController {
    constructor(private followupService: FollowupService, private logger: Logger ,private schedulerService: SchedulerService) { }
    
    @ApiOperation({ summary: 'followup Creation'})
    @ApiCreatedResponse({
        description: 'followup Creation',
        type: ResponseData
    })
    @HttpCode(HttpStatus.CREATED)
    @Post('create')
    async createFollowup(@Body() body:any, @UserData() user: any) {
        this.logger.log(`createfollowupdata: ${JSON.stringify(body)}`)
        let output = new ResponseData
        try {
            let followup = await this.followupService.createFollowup(body, user);
            this.logger.log(`createfollowup: ${JSON.stringify(followup)}`)
            if (!followup) {
                this.logger.debug(`createfollowup!!: ${JSON.stringify(followup)}`)
                throw 'Something went wrong'
            }
            output.data = followup
            output.message = 'Followup Created Successfully'
        } catch (error) {
            this.logger.warn(`createfollowupError: ${error}`)
            output.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                output.message = error.message;
                this.logger.warn(`createfollowupError: ${error.message}`)
            } else {
                this.logger.warn(`createfollowupError: ${error}`)
                output.message = error;
            }
        }
        return output
    }

    @ApiOperation({ summary: 'Get All followup'})
    @ApiCreatedResponse({
        description: 'Get All followups',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Get()
    async getAllFollowups() {
        let output = new ResponseData;
        try {
            let followupData = await this.followupService.getAllFollowups();
            this.logger.log(`getAllfollowups: ${JSON.stringify(followupData)}`)
            output.data = followupData;
        } catch (error) {
            this.logger.warn(`getAllfollowups: ${JSON.stringify(error)}`)
            output.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                output.message = error.message;
            } else {
                output.message = 'Internal Server Error';
            }
        }
        return output
    }

    @ApiOperation({ summary: 'Get followup By Id' })
    @ApiCreatedResponse({
        description: 'Get followup By Id',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Get('fetch/:id')
    async getFollowupsByDocumentId(@Param('id', ParseIntPipe) DocumentSid: number) {
        const output = new ResponseData;
        try{ 
            const followup = await this.followupService.getFollowupsByDocumentId(DocumentSid)
            this.logger.log(`getfollowupId: ${JSON.stringify(DocumentSid)}`)
            output.data = followup
        } catch (error) {
            this.logger.warn(`getfollowupById: ${JSON.stringify(error)}`)
            output.status = false;
            output.message = error
        }
        return output;
    }

    @ApiOperation({ summary: 'Update followup By Id' })
    @ApiCreatedResponse({
        description: 'Update followup By Id',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Patch('update/:id')
    async editFollowup(@Param('id', ParseIntPipe) id: number, @Body() body: any, @UserData() user: any) {
        this.logger.log(`editfollowupbody: ${JSON.stringify(body)}`)
        let output = new ResponseData
        try{
            let followup = await this.followupService.updateFollowup(id,body,user);
            this.logger.log(`editfollowup: ${JSON.stringify(followup)}`)
            if (!followup) {
                this.logger.log(`editfollowup!!: ${JSON.stringify(followup)}`)
                throw 'Something went wrong'
            } else {
                this.logger.log(`editfollowupelse: ${followup}`)
            }
            output.data = followup;
            output.message = 'followup Updated Successfully'
        } catch (error) {
            this.logger.warn(`editfollowuperror: ${JSON.stringify(error), error}`)
            output.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                this.logger.warn(`editfollowupbadrequest: ${error}`)
                output.message = error.message;
            } else {
                output.message = error;
            }
        }
        this.logger.log(`editfollowupmessage; ${output.message}`)
        return output
    }

    @ApiOperation({ summary: 'Delete followup By Id' })
    @ApiCreatedResponse({
        description: 'Delete followup By Id',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Delete('delete/:id')
    async softDelete(@Param('id', ParseIntPipe) id: number) {
        return this.followupService.softDelete(id);
    }

    @ApiOperation({ summary: 'Check for Followup' })
    @ApiCreatedResponse({
        description: 'Check for Followup',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Post('checkForFollowup')
    async checkForFollowup(@Body() body:any) {
        let resp = new ResponseData();
        try {
            let followup = await this.followupService.checkForFollowup(body);
            this.logger.log(`checkForFollowup: ${JSON.stringify(followup)}`)
            resp.data = followup;
            resp.message = 'All Followups fetched Successfully'
        } catch (error) {
            resp.status = false;
            this.logger.warn(`checkForFollowup: ${JSON.stringify(error),error}`)
            if(error instanceof BadRequestException || error instanceof UnauthorizedException) {
                resp.message = error.message;
            } else {
                resp.message = "Internal Server Error";
            }
        }
        return resp;
    }


    @Get('fetchAllCronJobs')
    async getAllCronJobs() {
        return this.schedulerService.listJobs();
    }

    @Get('fetchCronByName/:id')
    async getCronJobsByName(@Param('id', ParseIntPipe) id: number) {
        return this.schedulerService.getCronJobWithName(`followup-${id}`);
    }
}
