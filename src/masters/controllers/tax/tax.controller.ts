import { BadRequestException, Body, Controller, Delete, Get, HttpCode, HttpStatus, Logger, Param, ParseIntPipe, Patch, Post, Query, UnauthorizedException } from '@nestjs/common';
import { ApiCreatedResponse, ApiOperation } from '@nestjs/swagger';
import { Auth } from 'src/common/decorators/auth.decorator';
import { ResponseData } from 'src/common/response-data';
import { SearchListDto } from 'src/masters/DTO/search-list.dto';
import { filterDto } from 'src/masters/DTO/search-vessel.dto';
import { TaxService } from 'src/masters/services/tax/tax.service';
@Auth()

@Controller('tax')
export class TaxController {
    constructor(private taxService: TaxService, private logger: Logger) { }


    @ApiOperation({ summary: 'Create new Tax' })
    @ApiCreatedResponse({
        description: 'Create new Tax',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Post('create')
    async createNewTax(@Body() newData: any) {
        let resp = new ResponseData();
        try {
            let res = await this.taxService.createNewTax(newData);
            this.logger.log(`New Tax Created : ${JSON.stringify(res)}`);
            resp.data = res;
            resp.message = "New Tax is successfully created"
        } catch (error) {
            this.logger.warn(`Tax Creation Error : ${JSON.stringify(error), error}`);
            resp.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                resp.message = error.message;
            } else {
                resp.message = "Internal Server Error";
            }
        }
        return resp;
    }



    @ApiOperation({ summary: 'Get All Tax' })
    @ApiCreatedResponse({
        description: 'Get All Tax',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Get()
    async getAllTax() {
        let resp = new ResponseData();
        try {
            let res = await this.taxService.getAllTax();
            this.logger.log(`All Tax Fetched : ${JSON.stringify(res)}`);
            resp.data = res;
            resp.message = "All Tax are successfully fetched";
        } catch (error) {
            this.logger.warn(`Get All Tax Error : ${JSON.stringify(error), error}`);
            resp.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                resp.message = error.message;
            } else {
                resp.message = "Internal Server Error";
            }
        }
        return resp;
    }



    @ApiOperation({ summary: 'Get Tax filtered by Country and TaxType' })
    @ApiCreatedResponse({
        description: 'Get Tax filtered by Country and TaxType',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Get('filter')
    async getTaxByCountryAndType(
        @Query('CountryMasterSid', ParseIntPipe) countryMasterSid: number,
        @Query('TaxType') taxType: string
    ) {
        let resp = new ResponseData();
        try {
            let res = await this.taxService.getTaxByCountryAndType(countryMasterSid, taxType);
            resp.data = res;
            resp.message = "Tax records filtered successfully";
        } catch (error) {
            this.logger.warn(`Tax Filter Error : ${JSON.stringify(error), error}`);
            resp.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                resp.message = error.message;
            } else {
                resp.message = "Internal Server Error";
            }
        }
        return resp;
    }


    @ApiOperation({ summary: 'Get Tax by Id' })
    @ApiCreatedResponse({
        description: 'Get Tax by Id',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Get('fetch/:TaxMasterSid')
    async getTaxById(@Param('TaxMasterSid', ParseIntPipe) TaxMasterSid: number) {
        let resp = new ResponseData();
        try {
            this.logger.log(`Getting Tax with id : ${TaxMasterSid}`);
            let res = await this.taxService.fetchTaxById(TaxMasterSid);
            this.logger.debug(`Fetched Tax : ${JSON.stringify(res)}`);
            resp.data = res;
            resp.message = `Tax with id : ${TaxMasterSid} is successfully fetched`;
        } catch (error) {
            this.logger.warn(`Get Tax by Id Error : ${JSON.stringify(error), error}`);
            resp.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                resp.message = error.message;
            } else {
                resp.message = "Internal Server Error";
            }
        }
        return resp;
    }



    @ApiOperation({ summary: 'Update Tax by Id' })
    @ApiCreatedResponse({
        description: 'Update Tax by Id',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Patch('update/:TaxMasterSid')
    async updateTaxById(@Param('TaxMasterSid', ParseIntPipe) TaxMasterSid: number, @Body() payload: any) {
        let resp = new ResponseData();
        try {
            this.logger.log(`Updating Tax with id : ${TaxMasterSid}`);
            let res = await this.taxService.updateTaxById(TaxMasterSid, payload);
            this.logger.debug(`Updated Tax : ${JSON.stringify(res)}`);
            resp.data = res;
            resp.message = `Tax with id : ${TaxMasterSid} is successfully updated`;
        } catch (error) {
            this.logger.warn(`Tax Updation Error : ${JSON.stringify(error), error}`);
            resp.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                resp.message = error.message;
            } else {
                resp.message = "Internal Server Error";
            }
        }
        return resp;
    }



    @ApiOperation({ summary: 'Delete Tax by Id' })
    @ApiCreatedResponse({
        description: 'Delete Tax by Id',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Delete('delete/:TaxMasterSid')
    async deleteTaxById(@Param('TaxMasterSid', ParseIntPipe) TaxMasterSid: number) {
        let resp = new ResponseData();
        try {
            this.logger.log(`Deleting Tax with id : ${TaxMasterSid}`);
            let res = await this.taxService.deleteTax(TaxMasterSid);
            this.logger.debug(`Deleted Tax : ${JSON.stringify(res)}`);
            resp.data = res;
            resp.message = `Tax with id : ${TaxMasterSid} is successfully deleted`;
        } catch (error) {
            this.logger.warn(`Tax Deletion Error : ${JSON.stringify(error), error}`);
            resp.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                resp.message = error.message;
            } else {
                resp.message = "Internal Server Error";
            }
        }
        return resp;
    }



    @ApiOperation({ summary: 'Search List of Tax' })
    @ApiCreatedResponse({
        description: 'Search List of Tax',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Post('search-list')
    async searchTax(@Body() searchData: filterDto) {
        let resp = new ResponseData();
        try {
            let res = await this.taxService.searchTax(searchData);
            this.logger.log(`Tax Search Results :${JSON.stringify(res)}`);
            resp.data = res;
            resp.message = "Tax Search results are successfully fetched"
        } catch (error) {
            this.logger.warn(`Tax Search Error : ${JSON.stringify(error), error}`);
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
