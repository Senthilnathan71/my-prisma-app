import { BadRequestException, Body, Controller, Delete, Get, HttpCode, HttpStatus, Logger, Param, ParseIntPipe, Patch, Post, UnauthorizedException } from '@nestjs/common';
import { ApiOperation, ApiCreatedResponse } from '@nestjs/swagger';
import { ResponseData } from 'src/common/response-data';
import { filterDto } from 'src/masters/DTO/search-vessel.dto';
import { InvoiceService } from 'src/operation/services/invoice/invoice.service';

class CompanyIdDto {
  CompanyMasterSid: number;
  BranchMasterSid: number;
}

@Controller('invoice')
export class InvoiceController {
  private readonly logger = new Logger(InvoiceController.name);

  constructor(
    private readonly invoiceService: InvoiceService,
  ) { }

  @ApiOperation({ summary: 'Create Invoice' })
  @ApiCreatedResponse({
    description: 'VoucherHeader, VoucherDetail, VoucherOthers,created successfully',
    type: ResponseData
  })
  @HttpCode(HttpStatus.CREATED)
  @Post('create')
  async createInvoice(@Body() payload: any) {
    const output = new ResponseData();
    this.logger.log(`createInvoice payload: ${JSON.stringify(payload)}`);
    try {
      const finalOutput = await this.invoiceService.createInvoice(payload);
      this.logger.debug(`createInvoice result: ${JSON.stringify(finalOutput)}`);
      output.data = finalOutput;
      output.message = "VoucherHeader created successfully";
    } catch (error) {
      // Log full error object (message + stack) for debugging
      this.logger.warn('createInvoice error', (error as any)?.stack || (error as any)?.message || error);
      output.status = false;
      if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
        output.message = (error as any).message || 'Bad request';
      } else {
        output.message = "Internal Server Error";
      }
    }
    return output;
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
      const finalOutput = await this.invoiceService.fetchInvoices();
      this.logger.debug(`getAllInvoices: returned ${Array.isArray(finalOutput) ? finalOutput.length : 0} items`);
      output.data = finalOutput;
      output.message = "All Invoices fetched successfully";
    } catch (error) {
      this.logger.warn('getAllInvoices error', (error as any)?.stack || (error as any)?.message || error);
      output.status = false;
      if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
        output.message = (error as any).message || 'Bad request';
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
  // route uses lowercase param name - keep it consistent here
  @Get('fetch/:voucherHeaderSid')
  async getVoucherHeaderById(@Param('voucherHeaderSid', ParseIntPipe) voucherHeaderSid: number) {
    const output = new ResponseData();
    try {
      const finalOutput = await this.invoiceService.findVoucherHeaderById(voucherHeaderSid);
      this.logger.debug(`getVoucherHeaderById: ${JSON.stringify(finalOutput)}`);
      output.data = finalOutput;
      output.message = "Invoice data fetched successfully by ID";
    } catch (error) {
      this.logger.warn('getVoucherHeaderById error', (error as any)?.stack || (error as any)?.message || error);
      output.status = false;
      if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
        output.message = (error as any).message || 'Bad request';
      } else {
        // return error message/stack only if you want to expose it — here we set the object
        output.message = (error as any) || 'Internal Server Error';
      }
    }
    return output;
  }

  @ApiOperation({ summary: 'Update Invoice' })
  @ApiCreatedResponse({
    description: 'VoucherHeader, VoucherDetail, VoucherOthers updated successfully',
    type: ResponseData
  })
  @HttpCode(HttpStatus.OK)
  @Patch('update/:voucherHeaderSid')
  async updateVoucherHeader(
    @Param('voucherHeaderSid', ParseIntPipe) voucherHeaderSid: number,
    @Body() payload: any
  ) {
    const output = new ResponseData();
    try {
      const finalOutput = await this.invoiceService.updateVoucherHeaderById(voucherHeaderSid, payload);
      this.logger.debug(`updateVoucherHeader: ${JSON.stringify(finalOutput)}`);
      output.data = finalOutput;
      output.message = "Invoice updated successfully";
    } catch (error) {
      this.logger.warn('updateVoucherHeader error', (error as any)?.stack || (error as any)?.message || error);
      output.status = false;
      if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
        output.message = (error as any).message || 'Bad request';
      } else {
        output.message = (error as any) || 'Internal Server Error';
      }
    }
    return output;
  }

  @ApiOperation({ summary: 'Delete Invoice By ID' })
  @ApiCreatedResponse({
    description: 'Invoice deleted successfully',
    type: ResponseData
  })
  @Delete('deleteVoucher/:voucherHeaderSid')
  async deleteVoucherHeader(@Param('voucherHeaderSid', ParseIntPipe) voucherHeaderSid: number) {
    const output = new ResponseData();
    try {
      const booking = await this.invoiceService.deleteVoucherHeader(voucherHeaderSid);
      this.logger.debug(`deleteVoucherHeader: ${voucherHeaderSid}`);
      output.data = booking;
      output.message = "Invoice deleted successfully";
    } catch (error) {
      this.logger.warn('deleteVoucherHeader error', (error as any)?.stack || (error as any)?.message || error);
      output.status = false;
      if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
        output.message = (error as any).message || 'Bad request';
      } else {
        output.message = (error as any) || 'Internal Server Error';
      }
    }
    return output;
  }

  @ApiOperation({ summary: 'Search List of Invoices' })
  @ApiCreatedResponse({
    description: 'Search List of Invoices',
    type: ResponseData
  })
  @HttpCode(HttpStatus.OK)
  @Post('search-list')
  async searchBooking(@Body() payload: filterDto) {
    const resp = new ResponseData();
    try {
      const searchOutput = await this.invoiceService.searchVoucherHeader(payload);
      this.logger.log(`Invoice Search Result : ${JSON.stringify(searchOutput)}`);
      resp.data = searchOutput;
      resp.message = "Invoice Search is successfully fetched";
    } catch (error) {
      this.logger.warn('Invoice Search Error :', (error as any)?.stack || (error as any)?.message || error);
      resp.status = false;
      if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
        resp.message = (error as any).message || 'Bad request';
      } else {
        resp.message = "Internal Server Error";
      }
    }
    return resp;
  }
}
