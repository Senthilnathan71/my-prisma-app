import { BadRequestException, Body, Controller, Delete, Get, HttpCode, HttpStatus, Logger, Param, ParseIntPipe, Patch, Post, UnauthorizedException } from '@nestjs/common';
import { ApiCreatedResponse, ApiOperation } from '@nestjs/swagger';
import { Auth } from 'src/common/decorators/auth.decorator';
import { ResponseData } from 'src/common/response-data';
import { filterDto } from 'src/masters/DTO/search-vessel.dto';
import { TdsDetailService } from 'src/masters/services/tds-detail/tds-detail.service';

@Auth()
@Controller('tds-detail')
export class TdsDetailController {
    constructor(private tdsDetailService: TdsDetailService, private logger: Logger) { }


    @ApiOperation({ summary: 'Create new TDSSetRate' })
    @ApiCreatedResponse({
        description: 'Create new TDSSetRate',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Post('create')
    async createNewTDSSetRate(@Body() newData: any) {
        let resp = new ResponseData();
        try {
            let res = await this.tdsDetailService.createNewTdsDetail(newData);
            this.logger.log(`New TDS Set Rate Created : ${JSON.stringify(res)}`);
            resp.data = res;
            resp.message = "New tds detail is successfully created."
        } catch (error) {
            this.logger.warn(`TDS Set Rate Creation Error : ${JSON.stringify(error), error}`);
            resp.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                resp.message = error.message;
            } else {
                resp.message = "Internal Server Error";
            }
        }
        return resp;
    }



    @ApiOperation({ summary: 'Get All TDSSetRate' })
    @ApiCreatedResponse({
        description: 'Get All TDSSetRate',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Get()
    async getAllTDSSetRate() {
        let resp = new ResponseData();
        try {
            let res = await this.tdsDetailService.getAllTdsDetail();
            this.logger.log(`All TDS Set Rate Fetched : ${JSON.stringify(res)}`);
            resp.data = res;
            resp.message = "All TDS Set Rate are successfully fetched";
        } catch (error) {
            this.logger.warn(`Get All TDS Set Rate Error : ${JSON.stringify(error), error}`);
            resp.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                resp.message = error.message;
            } else {
                resp.message = "Internal Server Error";
            }
        }
        return resp;
    }



    @ApiOperation({ summary: 'Get TDSSetRate by Id' })
    @ApiCreatedResponse({
        description: 'Get TDSSetRate by Id',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Get('fetch/:TDSSetRateRateSid')
    async getTDSSetRateById(@Param('TDSSetRateRateSid', ParseIntPipe) TDSSetRateRateSid: number) {
        let resp = new ResponseData();
        try {
            this.logger.log(`Getting TDSSetRate with id : ${TDSSetRateRateSid}`);
            let res = await this.tdsDetailService.fetchTdsDetailById(TDSSetRateRateSid);
            this.logger.debug(`Fetched TDS Set Rate : ${JSON.stringify(res)}`);
            resp.data = res;
            resp.message = `TDS Set Rate with id : ${TDSSetRateRateSid} is successfully fetched`;
        } catch (error) {
            this.logger.warn(`Get TDS Set Rate by Id Error : ${JSON.stringify(error), error}`);
            resp.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                resp.message = error.message;
            } else {
                resp.message = "Internal Server Error";
            }
        }
        return resp;
    }

    @ApiOperation({ summary: 'Get TDSSetRate by TDSSetHeaderSid' })
    @ApiCreatedResponse({
        description: 'Get TDSSetRate by TDSSetHeaderSid',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Get('fetchByHeader/:TDSSetHeaderSid')
    async getTDSSetRateByHeaderId(@Param('TDSSetHeaderSid', ParseIntPipe) TDSSetHeaderSid: number) {
        let resp = new ResponseData();
        try {
            this.logger.log(`Getting TDSSetRate with Header Id : ${TDSSetHeaderSid}`);
            let res = await this.tdsDetailService.fetchTdsDetailByHeaderId(TDSSetHeaderSid);
            this.logger.debug(`Fetched TDS Set Rate : ${JSON.stringify(res)}`);
            resp.data = res;
            resp.message = `TDS Set Rate with Header id : ${TDSSetHeaderSid} is successfully fetched`;
        } catch (error) {
            this.logger.warn(`Get TDS Set Rate by Header Id Error : ${JSON.stringify(error), error}`);
            resp.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                resp.message = error.message;
            } else {
                resp.message = "Internal Server Error";
            }
        }
        return resp;
    }



    @ApiOperation({ summary: 'Update TDS Set Rate by Id' })
    @ApiCreatedResponse({
        description: 'Update TDS Set Rate by Id',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Patch('update/:TDSSetRateRateSid')
    async updateTDSSetRateById(@Param('TDSSetRateRateSid', ParseIntPipe) TDSSetRateRateSid: number, @Body() payload: any) {
        let resp = new ResponseData();
        try {
            this.logger.log(`Updating TDS Set Rate with id : ${TDSSetRateRateSid}`);
            let res = await this.tdsDetailService.updateTdsDetailById(TDSSetRateRateSid, payload);
            this.logger.debug(`Updated TDS Set Rate : ${JSON.stringify(res)}`);
            resp.data = res;
            resp.message = `TDS Detail is updated successfully.`;
        } catch (error) {
            this.logger.warn(`TDS Set Rate Updation Error : ${JSON.stringify(error), error}`);
            resp.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                resp.message = error.message;
            } else {
                resp.message = "Internal Server Error";
            }
        }
        return resp;
    }



    @ApiOperation({ summary: 'Delete TDS Set Rate by Id' })
    @ApiCreatedResponse({
        description: 'Delete TDS Set Rate by Id',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Delete('delete/:TDSSetRateSid')
    async deleteTDSSetRateById(@Param('TDSSetRateSid', ParseIntPipe) TDSSetRateSid: number) {
        let resp = new ResponseData();
        try {
            this.logger.log(`Deleting TDS Set Rate with id : ${TDSSetRateSid}`);
            let res = await this.tdsDetailService.deleteTdsDetail(TDSSetRateSid);
            this.logger.debug(`Deleted TDS Set Rate : ${JSON.stringify(res)}`);
            resp.data = res;
            resp.message = `
            TDS Set Rate with id : ${TDSSetRateSid} is successfully deleted`;
        } catch (error) {
            this.logger.warn(`TDS Set Rate Deletion Error : ${JSON.stringify(error), error}`);
            resp.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                resp.message = error.message;
            } else {
                resp.message = "Internal Server Error";
            }
        }
        return resp;
    }



    @ApiOperation({ summary: 'Search List of TDS Set Rate' })
    @ApiCreatedResponse({
        description: 'Search List of TDS Set Rate',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Post('search-list')
    async searchTDSSetRate(@Body() searchData: filterDto) {
        let resp = new ResponseData();
        try {
            let res = await this.tdsDetailService.searchTdsDetail(searchData);
            this.logger.log(`TDS Set Rate Search Results :${JSON.stringify(res)}`);
            resp.data = res;
            resp.message = "TDS Set Rate Search results are successfully fetched"
        } catch (error) {
            this.logger.warn(`TDS Set Rate Search Error : ${JSON.stringify(error), error}`);
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
