import { BadRequestException, Body, Controller, Delete, Get, HttpCode, HttpStatus, Logger, Param, ParseIntPipe, Patch, Post, UnauthorizedException } from '@nestjs/common';
import { ApiCreatedResponse, ApiOperation } from '@nestjs/swagger';
import { ResponseData } from 'src/common/response-data';
import { SearchListDto } from 'src/masters/DTO/search-list.dto';
import { YearService } from 'src/masters/services/year/year.service';


@Controller('year')
export class YearController {
    constructor(private yearService: YearService, private logger: Logger) { }

    @ApiOperation({ summary: 'Create new Year' })
    @ApiCreatedResponse({
        description: 'Create new Year',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Post('create')
    async createNewYear(@Body() newData: any) {
        let resp = new ResponseData();
        try {
            let res = await this.yearService.createNewYear(newData);
            this.logger.log(`New Year Created : ${JSON.stringify(res)}`);
            resp.data = res;
            resp.message = "New Year is successfully created"
        } catch (error) {
            this.logger.warn(`Year Creation Error : ${JSON.stringify(error)}`);
            resp.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                resp.message = error.message;
            } else {
                resp.message = "Internal Server Error";
            }
        }
        return resp;
    }

    @ApiOperation({ summary: 'Get All Years' })
    @ApiCreatedResponse({
        description: 'Get All Years',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Get()
    async getAllYears() {
        let resp = new ResponseData();
        try {
            let res = await this.yearService.getAllYears();
            this.logger.log(`All Years Fetched : ${JSON.stringify(res)}`);
            resp.data = res;
            resp.message = "All Years are successfully fetched";
        } catch (error) {
            this.logger.warn(`Get All Years Error : ${JSON.stringify(error)}`);
            resp.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                resp.message = error.message;
            } else {
                resp.message = "Internal Server Error";
            }
        }
        return resp;
    }

    @ApiOperation({ summary: 'Get Year by Id' })
    @ApiCreatedResponse({
        description: 'Get Year by Id',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Get('fetch/:YearMasterSid')
    async getYearById(@Param('YearMasterSid', ParseIntPipe) YearMasterSid: number) {
        let resp = new ResponseData();
        try {
            this.logger.log(`Getting Year with id : ${YearMasterSid}`);
            let res = await this.yearService.fetchYearById(YearMasterSid);
            this.logger.debug(`Fetched Year : ${JSON.stringify(res)}`);
            resp.data = res;
            resp.message = `Year with id : ${YearMasterSid} is successfully fetched`;
        } catch (error) {
            this.logger.warn(`Get Year by Id Error : ${JSON.stringify(error)}`);
            resp.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                resp.message = error.message;
            } else {
                resp.message = "Internal Server Error";
            }
        }
        return resp;
    }

    @ApiOperation({ summary: 'Update Year by Id' })
    @ApiCreatedResponse({
        description: 'Update Year by Id',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Patch('update/:YearMasterSid')
    async updateYearById(@Param('YearMasterSid', ParseIntPipe) YearMasterSid: number, @Body() payload: any) {
        let resp = new ResponseData();
        try {
            this.logger.log(`Updating Year with id : ${YearMasterSid}`);
            let res = await this.yearService.updateYearById(YearMasterSid, payload);
            this.logger.debug(`Updated Year : ${JSON.stringify(res)}`);
            resp.data = res;
            resp.message = `Year with id : ${YearMasterSid} is successfully updated`;
        } catch (error) {
            this.logger.warn(`Year Updation Error : ${JSON.stringify(error)}`);
            resp.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                resp.message = error.message;
            } else {
                resp.message = "Internal Server Error";
            }
        }
        return resp;
    }

    @ApiOperation({ summary: 'Delete Year by Id' })
    @ApiCreatedResponse({
        description: 'Delete Year by Id',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Delete('delete/:YearMasterSid')
    async deleteYearById(@Param('YearMasterSid', ParseIntPipe) YearMasterSid: number) {
        let resp = new ResponseData();
        try {
            this.logger.log(`Deleting Year with id : ${YearMasterSid}`);
            let res = await this.yearService.deleteYear(YearMasterSid);
            this.logger.debug(`Deleted Year : ${JSON.stringify(res)}`);
            resp.data = res;
            resp.message = `Year with id : ${YearMasterSid} is successfully deleted`;
        } catch (error) {
            this.logger.warn(`Year Deletion Error : ${JSON.stringify(error)}`);
            resp.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                resp.message = error.message;
            } else {
                resp.message = "Internal Server Error";
            }
        }
        return resp;
    }

    @ApiOperation({ summary: 'Search List of Years' })
    @ApiCreatedResponse({
        description: 'Search List of Years',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Post('search-list')
    async searchYear(@Body() searchData: SearchListDto) {
        let resp = new ResponseData();
        try {
            let res = await this.yearService.searchYear(searchData);
            this.logger.log(`Year Search Results :${JSON.stringify(res)}`);
            resp.data = res;
            resp.message = "Year Search results are successfully fetched"
        } catch (error) {
            this.logger.warn(`Year Search Error : ${JSON.stringify(error)}`);
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