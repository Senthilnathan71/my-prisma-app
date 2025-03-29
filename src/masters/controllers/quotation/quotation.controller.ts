import { BadRequestException, Body, Controller, Delete, Get, HttpCode, HttpStatus, Logger, Param, ParseIntPipe, Patch, Post, UnauthorizedException } from "@nestjs/common";
import { ApiCreatedResponse, ApiOperation } from "@nestjs/swagger";
import { Auth } from "src/common/decorators/auth.decorator";
import { UserData } from "src/common/decorators/user.decorator";
import { ResponseData } from "src/common/response-data";
import { QuotationService } from "src/masters/services/quotation/quotation.service";

@Controller('quotation')
@Auth()
export class QuotationController {
    constructor(private quotationService: QuotationService, private logger: Logger) { }

    @ApiOperation({ summary: 'Quotation' })
    @ApiCreatedResponse({
        description: 'Quotation Header,Route,Carrier,cargo created successfully',
        type: ResponseData
    })
    @HttpCode(HttpStatus.CREATED)
    @Post()
    async createQuoteHeader(@Body() body: any, @UserData() user: any) {
        this.logger.debug(`createQuoteHeader: ${JSON.stringify(body)}`)
        let output = new ResponseData
        try {
            let quote = await this.quotationService.createQuotation(body, user);
            this.logger.debug(`createQuoteHeader: ${JSON.stringify(quote)}`)
            if (!quote) {
                this.logger.debug(`createQuoteHeader: ${JSON.stringify(quote)}`)
                throw 'Something went wrong'
            }
            output.data = quote.data;
            output.message = quote.message;
            output.status = true

        } catch (error) {
            this.logger.warn(`createQuoteHeader: ${JSON.stringify(error)}`)
            output.status = false;
            // Handle error message based on the type of error
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                output.message = error.message;
            } else {
                output.message = error;
            }
        }
        return output
    }

    @ApiOperation({ summary: 'Get All Quote Header, Route, Cargo' })
    @ApiCreatedResponse({
        description: 'Quote Header,Route,cargo Fetch All Data',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Get()
    async getAllQuotations(@UserData() UserData: any) {
        const output = new ResponseData
        try {
            const quotations = await this.quotationService.getAllQuotations()
            this.logger.debug(`getAllQuotations: ${JSON.stringify(quotations)}`)
            output.data = quotations;
        } catch (error) {
            this.logger.warn(`getAllQuotations: ${JSON.stringify(error)}`)

            output.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                output.message = error.message;
            } else {
                output.message = 'Internal Server Error';
            }
        }
        return output;
    }


    @ApiOperation({ summary: 'Quote Header by id' })
    @ApiCreatedResponse({
        description: 'Quote Header,Route,cargo Fetch Data By Id',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Get('header/:id')
    async getQuoterHeaderById(@Param('id', ParseIntPipe) quoteId: number) {
        const output = new ResponseData;
        try {
            const quote = await this.quotationService.findOne(quoteId)
            this.logger.debug(`getQuoterHeaderById: ${JSON.stringify(quote)}`)
            output.data = quote
        } catch (error) {
            this.logger.warn(`getQuoterHeaderById: ${JSON.stringify(error)}`)
            output.status = false;
            output.message = error
        }
        return output;
    }



    @ApiOperation({ summary: 'Update Quote header' })
    @ApiCreatedResponse({
        description: 'Quote Header,Route,cargo updated successfully',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Patch('header/:id')
    async editQuote(@Param('id', ParseIntPipe) id: number, @Body() body: any, @UserData() user: any) {
        let output = new ResponseData
        this.logger.debug(`editQuote: ${JSON.stringify(body)}`)
        try {
            let quote = await this.quotationService.updateQuote(id, body, user);
            if (!quote) {
                throw 'Something went wrong'
            }
            output.data = quote.data;
            output.message = quote.message;
            output.status = quote.status

        } catch (error) {
            this.logger.warn(`editQuote: ${JSON.stringify(error)}`)
            output.status = false;
            // Handle error message based on the type of error
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                output.message = error.message;
            } else {
                output.message = error;
            }
        }
        return output
    }


    @ApiOperation({ summary: 'Delete Header By Id' })
    @ApiCreatedResponse({
        description: 'Delete Header By Id',
        type: ResponseData
    })
    @Delete('header/:id')
    async softDelete(@Param('id', ParseIntPipe) id: number) {
        return this.quotationService.softDelete(id);
    }


    @ApiOperation({ summary: 'Delete Route By Id' })
    @ApiCreatedResponse({
        description: 'Delete Route By Id',
        type: ResponseData
    })
    @Delete('route/:id')
    async deleteRoute(@Param('id', ParseIntPipe) id: number) {
        return this.quotationService.deleteRoute(id);
    }

    @ApiOperation({ summary: 'Delete Charge By Id' })
    @ApiCreatedResponse({
        description: 'Delete Charge By Id',
        type: ResponseData
    })
    @Delete('charge/:id')
    async deleteCharge(@Param('id', ParseIntPipe) id: number) {
        return this.quotationService.deleteCharge(id);
    }



    @Get('unit-currency-charge')
    async getAllMasters(@UserData() UserData: any) {
        const output = new ResponseData
        try {
            const allMasters = await this.quotationService.getAllMasters()
            this.logger.debug(`getAllMasters: ${JSON.stringify(allMasters)}`)
            output.data = allMasters;
        } catch (error) {
            this.logger.warn(`getAllMasters: ${JSON.stringify(error)}`)
            output.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                output.message = error.message;
            } else {
                output.message = 'Internal Server Error';
            }
        }
        return output;
    }


    @Get('carrier')
    async getAllCustomer(@UserData() UserData: any) {
        const output = new ResponseData
        try {
            const customers = await this.quotationService.getAllCustomer()
            this.logger.debug(`getAllCustomer in quotation: ${JSON.stringify(customers)}`)
            output.data = customers;
        } catch (error) {
            this.logger.warn(`getAllCustomer in quotation: ${JSON.stringify(error)}`)
            output.status = false;
            // Handle error message based on the type of error
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                output.message = error.message;
            } else {
                output.message = 'Internal Server Error';
            }
        }
        return output;
    }

}