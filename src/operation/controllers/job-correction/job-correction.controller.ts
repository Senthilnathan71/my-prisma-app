import { BadRequestException, Body, Controller, HttpCode, HttpStatus, Logger, Patch, Post, UnauthorizedException } from '@nestjs/common';
import { ApiCreatedResponse, ApiOperation } from '@nestjs/swagger';
import { ResponseData } from 'src/common/response-data';
import { Auth } from 'src/common/decorators/auth.decorator';
import { JobCorrectionService } from 'src/operation/services/job-correction/job-correction.service';

@Auth()
@Controller('master-job')
export class JobCorrectionController {
    constructor(
        private jobCorrectionService: JobCorrectionService,
        private logger: Logger,
    ) { }

    @ApiOperation({ summary: 'Search master jobs for correction by Job No or MBL / MAWB No (air + sea)' })
    @ApiCreatedResponse({ description: 'Search master jobs for correction', type: ResponseData })
    @HttpCode(HttpStatus.OK)
    @Post('job-correction/search')
    async searchJobs(@Body() payload: any) {
        let resp = new ResponseData();
        try {
            const result = await this.jobCorrectionService.searchJobs(payload);
            resp.data = result;
            resp.message = 'Jobs fetched successfully';
        } catch (error) {
            resp.status = false;
            this.logger.warn(`Error in Job Correction search : ${JSON.stringify(error), error}`);
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                resp.message = error.message;
            } else {
                resp.message = 'Internal Server Error';
            }
        }
        return resp;
    }

    @ApiOperation({ summary: 'Correct a Master Job and cascade to House Jobs and Bookings' })
    @ApiCreatedResponse({
        description: 'Correct Master Job (Job Date / POL / POD / Vessel-Voyage / ETD / ETA / Container No.)',
        type: ResponseData,
    })
    @HttpCode(HttpStatus.OK)
    @Patch('job-correction')
    async correctJob(@Body() payload: any) {
        let resp = new ResponseData();
        try {
            this.logger.log(`Job Correction : ${JSON.stringify(payload)}`);
            const result = await this.jobCorrectionService.correctJob(payload);
            this.logger.debug(`Job Correction result : ${JSON.stringify(result)}`);
            resp.data = result;
            resp.message = 'Job corrected successfully';
        } catch (error) {
            resp.status = false;
            this.logger.warn(`Error in Job Correction : ${JSON.stringify(error), error}`);
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                resp.message = error.message;
            } else {
                resp.message = 'Internal Server Error';
            }
        }
        return resp;
    }
}
