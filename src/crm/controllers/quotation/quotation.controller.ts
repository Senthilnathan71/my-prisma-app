import { BadRequestException, Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, UnauthorizedException } from "@nestjs/common";
import { Auth } from "src/common/decorators/auth.decorator";
import { UserData } from "src/common/decorators/user.decorator";
import { ResponseData } from "src/common/response-data";
import { QuotationService } from "src/crm/services/quotation/quotation.service";

@Controller('quotation')
@Auth()
export class QuotationController {
    constructor(private quotationService: QuotationService) { }

    @Post()
    async createQuoteHeader(@Body() body: any, @UserData() user: any) {
        let output = new ResponseData
        try {
            let quote = await this.quotationService.createQuotation(body, user);
            if (!quote) {
                throw 'Something went wrong'
            }
            output.data = quote.data;
            output.message = quote.message;
            output.status = true

        } catch (error) {
            console.log("controler error::", error);
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
    @Get()
    async getAllEnquiries(@UserData() UserData: any) {
        const output = new ResponseData
        try {
            const enquiries = await this.quotationService.getAllQuotations()
            output.data = enquiries;
        } catch (error) {
            output.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                output.message = error.message;
            } else {
                output.message = 'Internal Server Error';
            }
        }
        return output;
    }


    @Get('header/:id')
    async getQuoterHeaderById(@Param('id', ParseIntPipe) quoteId: number) {
        const output = new ResponseData;
        try {
            output.data = await this.quotationService.findOne(quoteId)
        } catch (error) {
            output.status = false;
            output.message = error
        }
        console.log(output, 'getQuoterHeaderById')
        return output;
    }



    @Patch('header/:id')
    async editQuote(@Param('id', ParseIntPipe) id: number, @Body() body: any, @UserData() user: any) {
        let output = new ResponseData
        try {
            let quote = await this.quotationService.updateQuote(id, body, user);
            if (!quote) {
                throw 'Something went wrong'
            }
            output.data = quote.data;
            output.message = quote.message;
            output.status = quote.status

        } catch (error) {
            console.log("controler error::", error);
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


    @Delete('header/:id')
    async softDelete(@Param('id', ParseIntPipe) id: number) {
        return this.quotationService.softDelete(id);
    }


    @Delete('route/:id')
    async deleteRoute(@Param('id', ParseIntPipe) id: number) {
        return this.quotationService.deleteRoute(id);
    }

    @Delete('charge/:id')
    async deleteCharge(@Param('id', ParseIntPipe) id: number) {
        return this.quotationService.deleteCharge(id);
    }



    @Get('unit-currency-charge')
    async getAllDepartments(@UserData() UserData: any) {
        const output = new ResponseData
        try {
            const department = await this.quotationService.getAllMasters()
            output.data = department;
        } catch (error) {
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
            console.log("customer", customers);
            output.data = customers;
        } catch (error) {
            console.log("controler error::", error);
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