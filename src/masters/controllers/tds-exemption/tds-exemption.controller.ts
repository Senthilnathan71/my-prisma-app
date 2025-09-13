import { BadRequestException, Body, Controller, Delete, Get, HttpCode, HttpStatus, Logger, Param, ParseIntPipe, Patch, Post, UnauthorizedException } from '@nestjs/common';
import { ApiCreatedResponse, ApiOperation } from '@nestjs/swagger';
import { ResponseData } from 'src/common/response-data';
import { filterDto } from 'src/masters/DTO/search-vessel.dto';
import { TdsExemptionService } from 'src/masters/services/tds-exemption/tds-exemption.service';


@Controller('tds-exemption')
export class TdsExemptionController {
    constructor(private tdsExemptionService: TdsExemptionService, private logger: Logger) { }


    @ApiOperation({ summary: 'Create new TDS Exemption' })
    @ApiCreatedResponse({
        description: 'Create new TDS Exemption',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Post('create')
    async createNewTDSExemption(@Body() newData: any) {
        let resp = new ResponseData();
        try {
            let res = await this.tdsExemptionService.createNewTdsExemption(newData);
            this.logger.log(`New TDS Exemption Created : ${JSON.stringify(res)}`);
            resp.data = res;
            resp.message = "New tds exemption is successfully created."
        } catch (error) {
            this.logger.warn(`TDS Exemption Creation Error : ${JSON.stringify(error), error}`);
            resp.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                resp.message = error.message;
            } else {
                resp.message = "Internal Server Error";
            }
        }
        return resp;
    }



    @ApiOperation({ summary: 'Get All TDS Exemption' })
    @ApiCreatedResponse({
        description: 'Get All TDS Exemption',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Get()
    async getAllTDSExemption() {
        let resp = new ResponseData();
        try {
            let res = await this.tdsExemptionService.getAllTdsExemption();
            this.logger.log(`All TDS Exemption Fetched : ${JSON.stringify(res)}`);
            resp.data = res;
            resp.message = "All TDS Exemption are successfully fetched";
        } catch (error) {
            this.logger.warn(`Get All TDS Exemption Error : ${JSON.stringify(error), error}`);
            resp.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                resp.message = error.message;
            } else {
                resp.message = "Internal Server Error";
            }
        }
        return resp;
    }



    @ApiOperation({ summary: 'Get TDS Exemption by Id' })
    @ApiCreatedResponse({
        description: 'Get TDS Exemption by Id',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Get('fetch/:TDSExemptionRateSid')
    async getTDSExemptionById(@Param('TDSExemptionRateSid', ParseIntPipe) TDSExemptionRateSid: number) {
        let resp = new ResponseData();
        try {
            this.logger.log(`Getting TDSExemption with id : ${TDSExemptionRateSid}`);
            let res = await this.tdsExemptionService.fetchTdsExemptionById(TDSExemptionRateSid);
            this.logger.debug(`Fetched TDS Exemption : ${JSON.stringify(res)}`);
            resp.data = res;
            resp.message = `TDS Exemption with id : ${TDSExemptionRateSid} is successfully fetched`;
        } catch (error) {
            this.logger.warn(`Get TDS Exemption by Id Error : ${JSON.stringify(error), error}`);
            resp.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                resp.message = error.message;
            } else {
                resp.message = "Internal Server Error";
            }
        }
        return resp;
    }
    @ApiOperation({ summary: 'Get TDS Exemption by Header Id' })
    @ApiCreatedResponse({
        description: 'Get TDS Exemption by Header Id',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Get('fetchByHeader/:TDSSetHeaderSid')
    async getTDSExemptionByHeaderId(@Param('TDSSetHeaderSid', ParseIntPipe) TDSSetHeaderSid: number) {
        let resp = new ResponseData();
        try {
            this.logger.log(`Getting TDSExemption with Header id : ${TDSSetHeaderSid}`);
            let res = await this.tdsExemptionService.fetchTdsExemptionByHeader(TDSSetHeaderSid);
            this.logger.debug(`Fetched TDS Exemption : ${JSON.stringify(res)}`);
            resp.data = res;
            resp.message = `TDS Exemption with Header Id : ${TDSSetHeaderSid} is successfully fetched`;
        } catch (error) {
            this.logger.warn(`Get TDS Exemption by Header Id Error : ${JSON.stringify(error), error}`);
            resp.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                resp.message = error.message;
            } else {
                resp.message = "Internal Server Error";
            }
        }
        return resp;
    }



    @ApiOperation({ summary: 'Update TDS Exemption by Id' })
    @ApiCreatedResponse({
        description: 'Update TDS Exemption by Id',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Patch('update/:TDSExemptionRateSid')
    async updateTDSExemptionById(@Param('TDSExemptionRateSid', ParseIntPipe) TDSExemptionRateSid: number, @Body() payload: any) {
        let resp = new ResponseData();
        try {
            this.logger.log(`Updating TDS Exemption with id : ${TDSExemptionRateSid}`);
            let res = await this.tdsExemptionService.updateTdsExemptionById(TDSExemptionRateSid, payload);
            this.logger.debug(`Updated TDS Exemption : ${JSON.stringify(res)}`);
            resp.data = res;
            resp.message = `TDS Exemption is updated successfully.`;
        } catch (error) {
            this.logger.warn(`TDS Exemption Updation Error : ${JSON.stringify(error), error}`);
            resp.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                resp.message = error.message;
            } else {
                resp.message = "Internal Server Error";
            }
        }
        return resp;
    }



    @ApiOperation({ summary: 'Delete TDS Exemption by Id' })
    @ApiCreatedResponse({
        description: 'Delete TDS Exemption by Id',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Delete('delete/:TDSExemptionRateSid')
    async deleteTDSExemptionById(@Param('TDSExemptionRateSid', ParseIntPipe) TDSExemptionRateSid: number) {
        let resp = new ResponseData();
        try {
            this.logger.log(`Deleting TDS Exemption with id : ${TDSExemptionRateSid}`);
            let res = await this.tdsExemptionService.deleteTdsExemption(TDSExemptionRateSid);
            this.logger.debug(`Deleted TDS Exemption : ${JSON.stringify(res)}`);
            resp.data = res;
            resp.message = `TDS Exemption with id : ${TDSExemptionRateSid} is successfully deleted`;
        } catch (error) {
            this.logger.warn(`TDS Exemption Deletion Error : ${JSON.stringify(error), error}`);
            resp.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                resp.message = error.message;
            } else {
                resp.message = "Internal Server Error";
            }
        }
        return resp;
    }



    @ApiOperation({ summary: 'Search List of TDS Exemption' })
    @ApiCreatedResponse({
        description: 'Search List of TDS Exemption',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Post('search-list')
    async searchTDSExemption(@Body() searchData: filterDto) {
        let resp = new ResponseData();
        try {
            let res = await this.tdsExemptionService.searchTdsExemption(searchData);
            this.logger.log(`TDS Exemption Search Results :${JSON.stringify(res)}`);
            resp.data = res;
            resp.message = "TDS Exemption Search results are successfully fetched"
        } catch (error) {
            this.logger.warn(`TDS Exemption Search Error : ${JSON.stringify(error), error}`);
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
