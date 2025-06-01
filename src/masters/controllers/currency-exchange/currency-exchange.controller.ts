import { BadRequestException, Body, Controller, Delete, Get, HttpCode, HttpStatus, Logger, Param, ParseIntPipe, Patch, Post, UnauthorizedException } from '@nestjs/common';
import { ApiCreatedResponse, ApiOperation } from '@nestjs/swagger';
import { ResponseData } from 'src/common/response-data';
import { SearchListDto } from 'src/masters/DTO/search-list.dto';
import { CurrencyExchangeService } from 'src/masters/services/currency-exchange/currency-exchange.service';

@Controller('currency-exchange')
export class CurrencyExchangeController {
    constructor(private currencyExService: CurrencyExchangeService, private logger: Logger) { }

    @ApiOperation({ summary: 'Create new Currency Exchange' })
    @ApiCreatedResponse({
        description: "Create new Currency Exchange",
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Post('Create')
    async createNewCurrencyEx(@Body() newData: any) {
        let resp = new ResponseData();
        try {
            let res = await this.currencyExService.createNewCurrencyEx(newData);
            this.logger.log(`New Currency Exchange Created : ${JSON.stringify(res)}`);
            resp.data = res;
            resp.message = "New Currency Exchange is successfully created";
        } catch (error) {
            this.logger.warn(`Currency Exchange Creation Error : ${JSON.stringify(error), error}`)
            resp.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                resp.message = error.message;
            } else {
                resp.message = "Internal Server Error";
            }
        }
        return resp;
    }


    @ApiOperation({ summary: 'Get All Currency Exchange' })
    @ApiCreatedResponse({
        description: "Get All Currency Exchange",
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Get()
    async getAllCurrencyExchange() {
        let resp = new ResponseData();
        try {
            let res = await this.currencyExService.getAllCurrencyEx();
            this.logger.log(`Fetched All Currency Exchanges : ${JSON.stringify(res)}`);
            resp.data = res;
            resp.message = "All Currency Exchanges are successfully fetched";
        } catch (error) {
            this.logger.warn(`Get All Currency Exchange Error : ${JSON.stringify(error), error}`)
            resp.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                resp.message = error.message;
            } else {
                resp.message = "Internal Server Error";
            }
        }
        return resp;
    }



    @ApiOperation({ summary: 'Get Currency Exchange by Id' })
    @ApiCreatedResponse({
        description: "Get Currency Exchange by Id",
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Get('fetch/:CurrencyExchangeSid')
    async getCurrencyExById(@Param('CurrencyExchangeSid', ParseIntPipe) CurrencyExchangeSid: number) {
        let resp = new ResponseData();
        try {
            this.logger.log(`Fetching Currency Exchange with id : ${CurrencyExchangeSid}`);
            let res = await this.currencyExService.getCurrencyExById(CurrencyExchangeSid);
            this.logger.debug(`Fetched Currency Exchange Id : ${JSON.stringify(res)}`);
            resp.data = res;
            resp.message = `Currency Exchange with id : ${CurrencyExchangeSid} is successfully fetched`;
        } catch (error) {
            this.logger.warn(`Get Currency Exchange by Id Error : ${JSON.stringify(error), error}`)
            resp.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                resp.message = error.message;
            } else {
                resp.message = "Internal Server Error";
            }
        }
        return resp;
    }



    @ApiOperation({ summary: 'Update Currency Exchange by Id' })
    @ApiCreatedResponse({
        description: "Update Currency Exchange by Id",
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Patch('update/:CurrencyExchangeSid')
    async updateCurrencyExById(@Param('CurrencyExchangeSid', ParseIntPipe) CurrencyExchangeSid: number, @Body() updateData: any) {
        let resp = new ResponseData();
        try {
            this.logger.log(`Updating Currency Exchange with id : ${CurrencyExchangeSid}`);
            let res = await this.currencyExService.updateCurrencyExById(CurrencyExchangeSid, updateData);
            this.logger.debug(`Updated Currency Exchange : ${JSON.stringify(res)}`);
            resp.data = res;
            resp.message = `Currency Exchange with id : ${CurrencyExchangeSid} is successfully updated`;
        } catch (error) {
            this.logger.warn(`Currency Exchange Updation Error : ${JSON.stringify(error), error}`)
            resp.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                resp.message = error.message;
            } else {
                resp.message = "Internal Server Error";
            }
        }
        return resp;
    }




    @ApiOperation({ summary: 'Delete Currency Exchange by Id' })
    @ApiCreatedResponse({
        description: "Delete Currency Exchange by Id",
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Delete('delete/:CurrencyExchangeSid')
    async deleteCurrencyExById(@Param('CurrencyExchangeSid', ParseIntPipe) CurrencyExchangeSid: number) {
        let resp = new ResponseData();
        try {
            this.logger.log(`Deleting Currency Exchange with id : ${CurrencyExchangeSid}`);
            let res = await this.currencyExService.deleteCurrencyExById(CurrencyExchangeSid);
            this.logger.debug(`Deleted Currency Exchange : ${JSON.stringify(res)}`);
            resp.data = res;
            resp.message = `Currency Exchange with id: ${CurrencyExchangeSid} is successfully deleted`
        } catch (error) {
            this.logger.warn(`Currency Exchange Deletion Error : ${JSON.stringify(error), error}`)
            resp.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                resp.message = error.message;
            } else {
                resp.message = "Internal Server Error";
            }
        }
        return resp;
    }



    @ApiOperation({ summary: 'Search List of Currency Exchange' })
    @ApiCreatedResponse({
        description: "Search List of Currency Exchange",
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Post('search-list')
    async searchCurrencyEx(@Body() searchData: SearchListDto) {
        let resp = new ResponseData();
        try {
            let res = await this.currencyExService.searchCurrencyExchange(searchData);
            this.logger.log(`Currency Exchange Search Results : ${JSON.stringify(res)}`);
            resp.data = res;
            resp.message = "Currency Exchange search is successfully fetched";
        } catch (error) {
            this.logger.warn(`Currency Exchange Search Error : ${error}`)
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
