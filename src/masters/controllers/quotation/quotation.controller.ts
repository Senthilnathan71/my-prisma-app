import { BadRequestException, Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, UnauthorizedException } from "@nestjs/common";
import { Auth } from "src/common/decorators/auth.decorator";
import { UserData } from "src/common/decorators/user.decorator";
import { ResponseData } from "src/common/response-data";
import { QuotationService } from "src/masters/services/quotation/quotation.service";

@Controller('quotation')
@Auth()
export class QuotationController {
    constructor(private quotationService: QuotationService) { }

    @Post()
    async createEnquiryHeader(@Body() body: any, @UserData() user: any) {
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
            const enquiries = await this.quotationService.getAllEnquiries()
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
    async getPrecustomerById(@Param('id', ParseIntPipe) enquiryId: number) {
        const output = new ResponseData;
        try {
            output.data = await this.quotationService.findOne(enquiryId)
        } catch (error) {
            output.status = false;
            output.message = error
        }
        return output;
    }



    @Patch('header/:id')
    async editEnquiry(@Param('id', ParseIntPipe) id: number, @Body() body: any, @UserData() user: any) {
        let output = new ResponseData
        try {
            let enquiry = await this.quotationService.updateEnquiry(id, body, user);
            if (!enquiry) {
                throw 'Something went wrong'
            }
            output.data = enquiry.data;
            output.message = enquiry.message;
            output.status = enquiry.status

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


}