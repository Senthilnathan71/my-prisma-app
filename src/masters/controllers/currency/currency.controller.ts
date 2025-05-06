import { BadRequestException, Body, Controller, Delete, Get, HttpCode, HttpStatus, Logger, Param, ParseIntPipe, Patch, Post, UnauthorizedException } from '@nestjs/common';
import { ApiOperation, ApiCreatedResponse } from '@nestjs/swagger';
import { Prisma } from '@prisma/client';
import { UserData } from 'src/common/decorators/user.decorator';
import { ResponseData } from 'src/common/response-data';
import { CurrencyService } from 'src/masters/services/currency/currency.service';

@Controller('currency')
export class CurrencyController {
    constructor(private currencyService: CurrencyService, private logger: Logger) { }

    @ApiOperation({ summary: 'Currency Creation' })
    @ApiCreatedResponse({
        description: 'Currency Creation',
        type: ResponseData
    })
    @HttpCode(HttpStatus.CREATED)
    @Post('create')
    async createCurrency(@Body() body: Prisma.CurrencyMasterCreateInput, @UserData() user: any) {
        this.logger.log(`createCurrencyData: ${JSON.stringify(body)}`)
        let output = new ResponseData
        try {
            let currency = await this.currencyService.createCurrency(body, user);
            this.logger.debug(`createCurrency: ${JSON.stringify(currency)}`)
            if (!currency) {
                this.logger.warn(`createCurrency!!: ${JSON.stringify(currency)}`)
                throw 'Something went wrong'
            }
            output.data = currency
        } catch (error) {
            this.logger.warn(`createCurrencyError: ${error}`)
            output.status = false;
            // Handle error message based on the type of error
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                output.message = error.message;
                this.logger.warn(`createCurrencyError: ${error.message}`)
            } else {
                this.logger.warn(`createCurrencyError: ${error}`)
                output.message = error;
            }
        }
        return output
    }


    @ApiOperation({ summary: 'Get All Currency' })
    @ApiCreatedResponse({
        description: 'Get All Currencys',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Get()
    async getAllCurrencys() {
        let output = new ResponseData;
        try {
            let currencyData = await this.currencyService.getAllCurrencys();
            this.logger.log(`getAllCurrencys: ${JSON.stringify(currencyData)}`)
            output.data = currencyData;
        } catch (error) {
            this.logger.warn(`getAllCurrencys: ${JSON.stringify(error)}`)
            output.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                output.message = error.message;
            } else {
                output.message = 'Internal Server Error';
            }
        }
        return output
    }


    @ApiOperation({ summary: 'Get Currency By Id' })
    @ApiCreatedResponse({
        description: 'Get Currency By Id',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Get('fetch/:id')
    async getCurrencyById(@Param('id', ParseIntPipe) CurrencyId: number) {
        const output = new ResponseData;
        try {
            const currency = await this.currencyService.findOne(CurrencyId)
            this.logger.log(`getCurrencyById: ${JSON.stringify(currency)}`)
            output.data = currency
        } catch (error) {
            this.logger.warn(`getCurrencyById: ${JSON.stringify(error)}`)
            output.status = false;
            output.message = error
        }
        return output;
    }


    @ApiOperation({ summary: 'Update Currency By Id' })
    @ApiCreatedResponse({
        description: 'Update Currency By Id',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Patch('update/:id')
    async editCurrency(@Param('id', ParseIntPipe) id: number, @Body() body: Prisma.CurrencyMasterUpdateInput, @UserData() user: any) {
        this.logger.log(`editCurrencybody: ${JSON.stringify(body)}`)
        let output = new ResponseData
        try {
            let currency = await this.currencyService.updateCurrency(id, body, user);
            this.logger.log(`editCurrency: ${JSON.stringify(currency)}`)

            if (!currency) {
                this.logger.log(`editCurrency!!: ${JSON.stringify(currency)}`)
                throw 'Something went wrong'
            } else {
                this.logger.log(`editCurrencyelse: ${currency}`)
            }
            output.data = currency;

        } catch (error) {
            this.logger.warn(`editCurrencyerror: ${JSON.stringify(error), error}`)
            output.status = false;
            // Handle error message based on the type of error
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                this.logger.warn(`editCurrencybadrequest: ${error}`)
                output.message = error.message;
            } else {
                output.message = error;
            }
        }
        this.logger.warn(`editCurrencymessage: ${output.message}`)
        return output
    }



    @ApiOperation({ summary: 'Delete Currency By Id' })
    @ApiCreatedResponse({
        description: 'Delete Currency By Id',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Delete('delete/:id')
    async softDelete(@Param('id', ParseIntPipe) id: number) {
        return this.currencyService.softDelete(id);
    }
}
