import { BadRequestException, Body, Controller,Delete,Get,HttpCode,HttpStatus,Logger, Param, ParseIntPipe, Patch, Post, UnauthorizedException } from '@nestjs/common';
import { ApiOperation, ApiCreatedResponse } from '@nestjs/swagger';
import { ResponseData } from 'src/common/response-data';
import { filterDto } from 'src/masters/DTO/search-vessel.dto';
import { InvoiceService } from 'src/operation/services/invoice/invoice.service';

@Controller('invoice')
export class InvoiceController {
    constructor(
            private invoiceService: InvoiceService,
            private logger: Logger,
        ) {}

         @ApiOperation({ summary: 'Create Invoice' })
            @ApiCreatedResponse({
                description: 'VoucherHeader, VoucherDetail, VoucherOthers, VoucherTransaction,VoucherTDS created successfully',
                type: ResponseData
            })
            @HttpCode(HttpStatus.CREATED)
            @Post('create')
            async createInvoice(@Body() payload: any) {
                let output = new ResponseData()
                this.logger.log(`createInvoice: ${JSON.stringify(payload)}`)
                try {
                    let finalOutput = await this.invoiceService.createInvoice(payload);
                    this.logger.debug(`createInvoice: ${JSON.stringify(finalOutput)}`)
                    output.data = finalOutput;
                    output.message = "VoucherHeader created successfully";
                } catch (error) {
                    this.logger.warn(`createInvoice: ${JSON.stringify(error), error}`)
                    output.status = false;
                    if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                        output.message = error.message;
                    } else {
                        output.message = "Internal Server Error";
                    }
                }
                return output
            }
        
            @ApiOperation({ summary: 'Get All Invoices' })
            @ApiCreatedResponse({
                description: 'All Invoices fetched successfully',
                type: ResponseData
            })
            @HttpCode(HttpStatus.OK)
            @Get()
            async getAllInvoices() {
                const output = new ResponseData();
                try {
                    const finalOutput = await this.invoiceService.fetchInvoices()
                    this.logger.debug(`getAllInvoices: ${JSON.stringify(finalOutput)}`)
                    output.data = finalOutput;
                    output.message = "All Invoices fetched successfully"
                } catch (error) {
                    this.logger.warn(`getAllInvoices: ${JSON.stringify(error)}`)
                    output.status = false;
                    if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                        output.message = error.message;
                    } else {
                        output.message = 'Internal Server Error';
                    }
                }
                return output;
            }
        
            @ApiOperation({ summary: 'Get Invoice by ID' })
            @ApiCreatedResponse({
                description: 'Invoice data fetched successfully by ID',
                type: ResponseData
            })
            @HttpCode(HttpStatus.OK)
            @Get('fetch/:voucherHeaderSid')
            async getVoucherHeaderById(@Param('VoucherHeaderSid', ParseIntPipe) VoucherHeaderSid: number) {
                const output = new ResponseData();
                try {
                    const finalOutput = await this.invoiceService.findVoucherHeaderById(VoucherHeaderSid)
                    this.logger.debug(`getVoucherHeaderById: ${JSON.stringify(finalOutput)}`)
                    output.data = finalOutput
                    output.message = "Invoice data fetched successfully by ID"
                } catch (error) {
                    this.logger.warn(`getVoucherHeaderById: ${JSON.stringify(error),error}`)
                    output.status = false;
                    if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                        output.message = error.message;
                    } else {
                        output.message = error;
                    }
                }
                return output;
            }
        
            @ApiOperation({ summary: 'Update Invoice' })
            @ApiCreatedResponse({
                description: 'VoucherHeader, VoucherDetail, VoucherOthers, VoucherTransaction,VoucherTDS updated successfully',
                type: ResponseData
            })
            @HttpCode(HttpStatus.OK)
            @Patch('update/:VoucherHeaderSid')
            async updateVoucherHeader(@Param('BookingHeaderSid', ParseIntPipe) VoucherHeaderSid: number, @Body() payload: any) {
                let output = new ResponseData
                try {
                    let finalOutput = await this.invoiceService.updateVoucherHeaderById(VoucherHeaderSid, payload);
                    this.logger.debug(`updateVoucherHeader: ${JSON.stringify(finalOutput)}`)
                    output.data = finalOutput;
                    output.message = "Invoice updated successfully";
        
                } catch (error) {
                    this.logger.warn(`updateVoucherHeader: ${JSON.stringify(error), error}`)
                    output.status = false;
                    if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                        output.message = error.message;
                    } else {
                        output.message = error;
                    }
                }
                return output
            }
        
            @ApiOperation({ summary: 'Delete Invoice By ID' })
            @ApiCreatedResponse({
                description: 'Invoice deleted successfully',
                type: ResponseData
            })
            @Delete('deleteVoucher/:VoucherHeaderSid')
            async deleteVoucherHeader(@Param('VoucherHeaderSid', ParseIntPipe) VoucherHeaderSid: number) {
                let output = new ResponseData
                try {
                    let booking = await this.invoiceService.deleteVoucherHeader(VoucherHeaderSid);
                    this.logger.debug(`deleteVoucherHeader: ${JSON.stringify(VoucherHeaderSid)}`)
                    output.data = booking;
                    output.message = "Invoice deleted successfully";
        
                } catch (error) {
                    this.logger.warn(`deleteVoucherHeader: ${JSON.stringify(error), error}`)
                    output.status = false;
                    if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                        output.message = error.message;
                    } else {
                        output.message = error;
                    }
                }
                return output
            }
        
            @ApiOperation({ summary: 'Search List of Invoices' })
            @ApiCreatedResponse({
                description: 'Search List of Invoices',
                type: ResponseData
            })
            @HttpCode(HttpStatus.OK)
            @Post('search-list')
            async searchBooking(@Body() payload: filterDto) {
                let resp = new ResponseData();
                try {
                    let searchOutput = await this.invoiceService.searchVoucherHeader(payload);
                    this.logger.log(`Invoice Search Result : ${JSON.stringify(searchOutput)}`);
                    resp.data = searchOutput;
                    resp.message = "Invoice Search is successfully fetched";
                } catch (error) {
                    this.logger.warn(`Invoice Search Error : ${error}`)
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
