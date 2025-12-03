import { BadRequestException, Body, Controller, Delete, Get, HttpCode, HttpStatus, Logger, Param, ParseIntPipe, Patch, Post, Query, UnauthorizedException, UploadedFile, UseInterceptors } from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { ApiCreatedResponse, ApiOperation } from "@nestjs/swagger";
import { ResponseData } from "src/common/response-data";
import { EmailService } from "src/email/email.service";
import { SearchListDto } from "src/masters/DTO/search-list.dto";
import { filterDto } from "src/masters/DTO/search-vessel.dto";
import { QuotationService } from "src/masters/services/quotation/quotation.service";
class CompanyIdDto {
    CompanyMasterSid: number;
    BranchMasterSid: number;
}

@Controller('ff-quotation')
export class QuotationController {
    constructor(private quotationService: QuotationService, private logger: Logger, private emailService: EmailService) { }

    @ApiOperation({ summary: 'Quotation' })
    @ApiCreatedResponse({
        description: 'Quotation Header,Route,Carrier,cargo created successfully',
        type: ResponseData
    })
    @HttpCode(HttpStatus.CREATED)
    @Post()
    async createQuoteHeader(@Body() body: any) {
        this.logger.debug(`createQuoteHeader: ${JSON.stringify(body)}`)
        let output = new ResponseData
        try {
            let quote = await this.quotationService.createQuotation(body);
            this.logger.debug(`createQuoteHeader: ${JSON.stringify(quote)}`)
            if (!quote) {
                this.logger.debug(`createQuoteHeader: ${JSON.stringify(quote)}`)
                throw 'Something went wrong'
            }
            output.data = quote.data;
            output.message = 'Quotation Created Successfully'
            output.status = true

        } catch (error) {
            this.logger.warn(`createQuoteHeader: ${JSON.stringify(error), error}`)
            output.status = false;
            // Handle error message based on the type of error
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                output.message = error.message;
            } else {
                output.message = "Internal Server Error";
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
    @Post()
    async getAllQuotations(@Body() body: CompanyIdDto) {
        const output = new ResponseData
        try {
            const quotations = await this.quotationService.getAllQuotations(body.CompanyMasterSid, body.BranchMasterSid)
            this.logger.debug(`getAllQuotations: ${JSON.stringify(quotations)}`)
            output.data = quotations;
            output.message = "All Quotations are successfully fetched";
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
            output.message = `Quotation with id : ${quoteId} is successfully fetched`;
        } catch (error) {
            this.logger.warn(`getQuoterHeaderById: ${JSON.stringify(error)}`)
            output.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                output.message = error.message;
            } else {
                output.message = "Internal Server Error";
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
    @Get('quote/:id')
    async findQuote(@Param('id', ParseIntPipe) quoteId: number) {
        const output = new ResponseData;
        try {
            const quote = await this.quotationService.findQuote(quoteId)
            this.logger.debug(`getQuoterHeaderById: ${JSON.stringify(quote)}`)
            output.data = quote
            output.message = `Quotation with id : ${quoteId} is successfully fetched`;
        } catch (error) {
            this.logger.warn(`getQuoterHeaderById: ${JSON.stringify(error)}`)
            output.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                output.message = error.message;
            } else {
                output.message = "Internal Server Error";
            }
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
    async editQuote(@Param('id', ParseIntPipe) id: number, @Body() body: any) {
        let output = new ResponseData
        this.logger.debug(`editQuote: ${JSON.stringify(body)}`)
        try {
            let quote = await this.quotationService.updateQuote(id, body);
            if (!quote) {
                throw 'Something went wrong'
            }
            output.data = quote;
            output.message = `Quotation with id : ${id} is successfully updated`;

        } catch (error) {
            this.logger.warn(`editQuote: ${JSON.stringify(error), error}`)
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
        let output = new ResponseData
        this.logger.debug(`deleteQuoteRoute: ${JSON.stringify(id)}`)
        try {
            let quote = await this.quotationService.deleteRoute(id);
            if (!quote) {
                throw 'Something went wrong'
            }
            output.data = quote;
            output.message = "Quote Route deleted successfully.";

        } catch (error) {
            this.logger.warn(`deleteQuoteRoute: ${JSON.stringify(error), error}`)
            output.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                output.message = error.message;
            } else {
                output.message = error;
            }
        }
        return output
    }

    @ApiOperation({ summary: 'Delete Charge By Id' })
    @ApiCreatedResponse({
        description: 'Delete Charge By Id',
        type: ResponseData
    })
    @Delete('charge/:id')
    async deleteCharge(@Param('id', ParseIntPipe) id: number) {
        let output = new ResponseData
        this.logger.debug(`deleteQuoteCharge: ${JSON.stringify(id)}`)
        try {
            let quote = await this.quotationService.deleteCharge(id);
            if (!quote) {
                throw 'Something went wrong'
            }
            output.data = quote;
            output.message = "Quote Charge deleted successfully.";

        } catch (error) {
            this.logger.warn(`deleteQuoteCharge: ${JSON.stringify(error), error}`)
            output.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                output.message = error.message;
            } else {
                output.message = error;
            }
        }
        return output
    }



    @Post('unit-currency-charge')
    async getAllMasters(@Body() body: CompanyIdDto) {
        const output = new ResponseData
        try {
            const allMasters = await this.quotationService.getAllMasters(body.CompanyMasterSid)
            this.logger.debug(`getAllMasters: ${JSON.stringify(allMasters)}`)
            output.data = allMasters;
            output.message = 'MasterData are successfully fetched'
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


    @Post('carrier')
    async getAllCustomer(@Body() body: CompanyIdDto) {
        const output = new ResponseData
        try {
            const customers = await this.quotationService.getAllCustomer(body.CompanyMasterSid)
            this.logger.debug(`getAllCustomer in quotation: ${JSON.stringify(customers)}`)
            output.data = customers;
            output.message = 'All Customer are successfully fetched'
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

    @ApiOperation({ summary: 'Search List of Quotation' })
    @ApiCreatedResponse({
        description: 'Search List of Quotations',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Post('search-list')
    async searchQuotation(@Body() searchParams: filterDto) {
        let resp = new ResponseData();
        try {
            let res = await this.quotationService.searchQuotation(searchParams);
            this.logger.log(`Quotation Search Result : ${JSON.stringify(res)}`);
            resp.data = res;
            resp.message = "Quotation Search is successfully fetched";
        } catch (error) {
            this.logger.warn(`Quotation Search Error : ${error}`)
            resp.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                resp.message = error.message;
            } else {
                resp.message = "Internal Server Error";
            }
        }
        return resp;
    }


    @ApiOperation({ summary: 'Quotation Report' })
    @ApiCreatedResponse({
        description: 'Quotation Report Sent successfully',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @UseInterceptors(FileInterceptor('file'))
    @Post('send/email')
    async quotationReport(@UploadedFile() file: Express.Multer.File,
        @Body() body: any) {
        let output = new ResponseData();
        try {
            const reportPayload = {
                email: body.EmailTo,
                cc: body.EmailCC,
                subject: body.Subject,
                html: body.Mailbody,
                file, // this is the PDF file from FormData
            };
            console.log(reportPayload);
            let res = await this.emailService.sendEmailWithFileAttachment(reportPayload);
            this.logger.log(`Quotation Report Sent Successfully : ${JSON.stringify(res)}`);
            output.data = res;
            output.message = "Quotation Report Sent successfully";
        } catch (error) {
            this.logger.warn(`Quotation Report Error : ${error}`)
            output.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                output.message = error.message;
            } else {
                output.message = "Internal Server Error";
            }
        }
        return output;
    }

    @ApiOperation({ summary: 'Get All Salesman' })
    @ApiCreatedResponse({
        description: 'Getting All Salesman',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Get('salesman')
    async getAllSalesman() {
        const output = new ResponseData
        try {
            const salesperson = await this.quotationService.getAllSalesperson()
            this.logger.debug(`getAllSalesperson: ${JSON.stringify(salesperson)}`)
            output.data = salesperson;
            output.message = 'All Salesperson are successfully fetched'
        } catch (error) {
            this.logger.warn(`getAllSalesperson: ${JSON.stringify(error), error}`)

            output.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                output.message = error.message;
            } else {
                output.message = 'Internal Server Error';
            }
        }
        return output;
    }

    @ApiOperation({ summary: 'Get Customer Branch Email' })
    @ApiCreatedResponse({
        description: 'Getting Customer Branch Email',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Get('customer-branch-email/:CustomerBranchSid')
    async getCustomerBranchEmail(@Param('CustomerBranchSid', ParseIntPipe) CustomerBranchSid: number) {
        const output = new ResponseData
        try {
            const cusBranch = await this.quotationService.getCustomerBranchEmail(CustomerBranchSid)
            this.logger.debug(`getCustomerBranchEmail: ${JSON.stringify(cusBranch)}`)
            output.data = cusBranch;
            output.message = 'CustomerBranch are successfully fetched'
        } catch (error) {
            this.logger.warn(`getCustomerBranchEmail: ${JSON.stringify(error), error}`)

            output.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                output.message = error.message;
            } else {
                output.message = 'Internal Server Error';
            }
        }
        return output;
    }

    @ApiOperation({ summary: 'Get Tariff Details by Quote Details' })
    @ApiCreatedResponse({
        description: 'Getting Tariff Details by Quote Details',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Post('tariffDetails')
    async getTariffDetailWithQuote(@Body() quoteDetails: any) {
        const output = new ResponseData()
        try {
            const tariffs = await this.quotationService.getTariffByQuoteDetails(quoteDetails)
            this.logger.debug(`getTariffDetails: ${JSON.stringify(tariffs)}`)
            output.data = tariffs;
            output.message = "All tariff details are successfully fetched for respective quotes"
        } catch (error) {
            this.logger.warn(`getTariffDetails: ${JSON.stringify(error), error}`)

            output.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                output.message = error.message;
            } else {
                output.message = 'Internal Server Error';
            }
        }
        return output;
    }


    @ApiOperation({ summary: 'Get Audit Logs for a Table/Record' })
    @ApiCreatedResponse({ description: 'Fetch audit logs', type: ResponseData })
    @HttpCode(HttpStatus.OK)
    @Get('audit-logs')
    async getAuditLogs(
        @Query('tableName') tableName: string,
        @Query('recordId') recordId?: string,
    ) {
        const resp = new ResponseData();
        try {
            if (!tableName) throw new Error('tableName query parameter is required');

            const logs = await this.quotationService.getAuditLogs(tableName, recordId);

            // Remove updatedOn from oldVal and newVal
            resp.data = logs.map((log: any) => {
                const oldVal = log.oldVal ? { ...log.oldVal } : null;
                const newVal = log.newVal ? { ...log.newVal } : null;
                if (oldVal && 'updatedOn' in oldVal) delete oldVal.updatedOn;
                if (newVal && 'updatedOn' in newVal) delete newVal.updatedOn;
                return { ...log, oldVal, newVal };
            });

            resp.message = 'Audit logs fetched successfully';
        } catch (error) {
            this.logger.warn(`getAuditLogsError: ${error}`);
            resp.status = false;
            resp.message = error.message || 'Internal Server Error';
        }
        return resp;
    }

    @ApiOperation({ summary: 'Delete Quote Product' })
    @ApiCreatedResponse({
        description: 'Delete Quote Product',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Delete('product/:QuoteProductSid')
    async deleteProduct(@Param('QuoteProductSid', ParseIntPipe) QuoteProductSid: number) {
        let output = new ResponseData
        try {
            let quote = await this.quotationService.deleteQuoteProduct(QuoteProductSid);
            this.logger.debug(`deletedQuoteProduct: ${JSON.stringify(QuoteProductSid)}`)
            output.data = quote;
            output.message = "Quote Product deleted successfully.";
        } catch (error) {
            this.logger.error(`deleteQuoteProduct: ${JSON.stringify(QuoteProductSid)}`)
            output.message = error.message;
        }
        return output;
    }

    @ApiOperation({ summary: 'Delete Quote Carrier' })
    @ApiCreatedResponse({
        description: 'Delete Quote Carrier',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Delete('carrier/:QuoteCarrierSid')
    async deleteCarrier(@Param('QuoteCarrierSid', ParseIntPipe) QuoteCarrierSid: number) {
        let output = new ResponseData
        try {
            let quote = await this.quotationService.deleteQuoteCarrier(QuoteCarrierSid);
            this.logger.debug(`deletedQuoteCarrier: ${JSON.stringify(QuoteCarrierSid)}`)
            output.data = quote;
            output.message = "Quote Carrier deleted successfully.";
        } catch (error) {
            this.logger.error(`deleteQuoteCarrier: ${JSON.stringify(QuoteCarrierSid)}`)
            output.message = error.message;
        }
        return output;
    }



}