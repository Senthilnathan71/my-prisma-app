import { BadRequestException, Body, Controller, Delete, Get, HttpCode, HttpStatus, Logger, Param, ParseIntPipe, Patch, Post, UnauthorizedException } from '@nestjs/common';
import { ApiCreatedResponse, ApiOperation } from '@nestjs/swagger';
import { ResponseData } from 'src/common/response-data';
import { SearchListDto } from 'src/masters/DTO/search-list.dto';
import { TermsAndConditionsDetailService } from 'src/masters/services/terms-and-conditions-detail/terms-and-conditions-detail.service';



@Controller('terms-and-conditions-detail')
export class TermsAndConditionsDetailController {
    constructor(private TermAndCondDetailService: TermsAndConditionsDetailService, private logger: Logger) { }


    @ApiOperation({ summary: 'Create new Terms and Conditions Detail' })
    @ApiCreatedResponse({
        description: 'Create new Terms and Conditions Detail',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Post('create')
    async createNewTermAndCondDetail(@Body() newData:any) {
        let resp = new ResponseData();
        try {
            let res = await this.TermAndCondDetailService.createNewTermAndCondDetail(newData);
            this.logger.log(`New Terms and Conditions Detail Created : ${JSON.stringify(res)}`);
            resp.data = res;
            resp.message = "New Terms and Conditions Detail is successfully created"
        } catch (error) {
            this.logger.warn(`Terms and Conditions Detail Creation Error : ${JSON.stringify(error), error}`);
            resp.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                resp.message = error.message;
            } else {
                resp.message = "Internal Server Error";
            }
        }
        return resp;
    }



    @ApiOperation({ summary: 'Get All Terms and Conditions Details' })
    @ApiCreatedResponse({
        description: 'Get All Terms and Conditions Details',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Get()
    async getAllTermsAndCondDetails() {
        let resp = new ResponseData();
        try {
            let res = await this.TermAndCondDetailService.getAllTermAndCondDetails();
            this.logger.log(`All Terms and Conditions Details Fetched : ${JSON.stringify(res)}`);
            resp.data = res;
            resp.message = "All Terms and Conditions Details are successfully fetched";
        } catch (error) {
            this.logger.warn(`Get All Terms and Conditions Details Error : ${JSON.stringify(error), error}`);
            resp.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                resp.message = error.message;
            } else {
                resp.message = "Internal Server Error";
            }
        }
        return resp;
    }



    @ApiOperation({ summary: 'Get Terms and Conditions Detail by Id' })
    @ApiCreatedResponse({
        description: 'Get Terms and Conditions Detail by Id',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Get('fetch/:TermsAndConditionsDetailSid')
    async getTermAndCondById(@Param('TermsAndConditionsDetailSid', ParseIntPipe) TermsAndConditionsDetailSid: number) {
        let resp = new ResponseData();
        try {
            this.logger.log(`Getting Terms And Conditions Detail with id : ${TermsAndConditionsDetailSid}`);
            let res = await this.TermAndCondDetailService.fetchTermAndCondDetailById(TermsAndConditionsDetailSid);
            this.logger.debug(`Fetched Terms and Conditions Detail : ${JSON.stringify(res)}`);
            resp.data = res;
            resp.message = `Terms and Conditions Detail with id : ${TermsAndConditionsDetailSid} is successfully fetched`;
        } catch (error) {
            this.logger.warn(`Get Terms and Conditions Detail by Id Error : ${JSON.stringify(error), error}`);
            resp.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                resp.message = error.message;
            } else {
                resp.message = "Internal Server Error";
            }
        }
        return resp;
    }



    @ApiOperation({ summary: 'Update Terms and Conditions Details by Id' })
    @ApiCreatedResponse({
        description: 'Update Terms and Conditions Details by Id',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Patch('update/:TermsAndConditionsDetailSid')
    async updateTermAndCondDetailById(@Param('TermsAndConditionsDetailSid', ParseIntPipe) TermsAndConditionsDetailSid: number, @Body() payload: any) {
        let resp = new ResponseData();
        try {
            this.logger.log(`Updating Terms and Conditions Detail with id : ${TermsAndConditionsDetailSid}`);
            let res = await this.TermAndCondDetailService.updateTermAndCondDetailById(TermsAndConditionsDetailSid, payload);
            this.logger.debug(`Updated Terms and Conditions Detail : ${JSON.stringify(res)}`);
            resp.data = res;
            resp.message = `Terms and Conditions Detail with id : ${TermsAndConditionsDetailSid} is successfully updated`;
        } catch (error) {
            this.logger.warn(`Terms and Conditions Detail Updation Error : ${JSON.stringify(error), error}`);
            resp.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                resp.message = error.message;
            } else {
                resp.message = "Internal Server Error";
            }
        }
        return resp;
    }



    @ApiOperation({ summary: 'Delete Terms and Conditions Detail by Id' })
    @ApiCreatedResponse({
        description: 'Delete Terms and Conditions Detail by Id',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Delete('delete/:TermsAndConditionsDetailSid')
    async deleteTermAndCondDetailById(@Param('TermsAndConditionsDetailSid', ParseIntPipe) TermsAndConditionsDetailSid: number) {
        let resp = new ResponseData();
        try {
            this.logger.log(`Deleting Terms and Conditions Detail with id : ${TermsAndConditionsDetailSid}`);
            let res = await this.TermAndCondDetailService.deleteTermAndCondDetail(TermsAndConditionsDetailSid);
            this.logger.debug(`Deleted Terms and Conditions Detail : ${JSON.stringify(res)}`);
            resp.data = res;
            resp.message = `Terms and Conditions Detail with id : ${TermsAndConditionsDetailSid} is successfully deleted`;
        } catch (error) {
            this.logger.warn(`Terms and Conditions Detail Deletion Error : ${JSON.stringify(error), error}`);
            resp.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                resp.message = error.message;
            } else {
                resp.message = "Internal Server Error";
            }
        }
        return resp;
    }



    @ApiOperation({ summary: 'Search List of Terms and Conditions Detail' })
    @ApiCreatedResponse({
        description: 'Search List of Terms and Conditions Detail',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Post('search-list')
    async searchTermAndCondDetail(@Body() searchData: SearchListDto) {
        let resp = new ResponseData();
        try {
            let res = await this.TermAndCondDetailService.searchTermAndCondDetail(searchData);
            this.logger.log(`Terms and Conditions Detail Search Results :${JSON.stringify(res)}`);
            resp.data = res;
            resp.message = "Terms and Conditions Detail Search results are successfully fetched"
        } catch (error) {
            this.logger.warn(`Terms and Conditions Detail Search Error : ${JSON.stringify(error), error}`);
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