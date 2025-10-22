import { BadRequestException, Body, Controller, Delete, Get, HttpCode, HttpStatus, Logger, Param, ParseIntPipe, Patch, Post, UnauthorizedException } from '@nestjs/common';
import { ApiOperation, ApiCreatedResponse } from '@nestjs/swagger';
import { ResponseData } from 'src/common/response-data';
import { VendorInvoiceService } from 'src/operation/services/vendor-invoice/vendor-invoice.service';

@Controller('vendor-invoice')
export class VendorInvoiceController {
  private readonly logger = new Logger(VendorInvoiceController.name);

  constructor(
    private readonly vendorInvoiceService: VendorInvoiceService,
  ) { }

  @ApiOperation({ summary: 'Create Vendor Invoice' })
  @ApiCreatedResponse({
    description: 'Vendor Invoice created successfully with TDS',
    type: ResponseData
  })
  @HttpCode(HttpStatus.CREATED)
  @Post('create')
  async createVendorInvoice(@Body() payload: any) {
    const output = new ResponseData();
    this.logger.log(`createVendorInvoice payload: ${JSON.stringify(payload)}`);
    try {
      const finalOutput = await this.vendorInvoiceService.createVendorInvoice(payload);
      this.logger.debug(`createVendorInvoice result: ${JSON.stringify(finalOutput)}`);
      output.data = finalOutput;
      output.message = "Vendor Invoice created successfully";
    } catch (error) {
      this.logger.warn('createVendorInvoice error', (error as any)?.stack || (error as any)?.message || error);
      output.status = false;
      if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
        output.message = (error as any).message || 'Bad request';
      } else {
        output.message = "Internal Server Error";
      }
    }
    return output;
  }

  @ApiOperation({ summary: 'Get All Vendor Invoices' })
  @ApiCreatedResponse({
    description: 'All Vendor Invoices fetched successfully',
    type: ResponseData
  })
  @HttpCode(HttpStatus.OK)
  @Get()
  async getAllVendorInvoices() {
    const output = new ResponseData();
    try {
      const finalOutput = await this.vendorInvoiceService.fetchVendorInvoices();
      this.logger.debug(`getAllVendorInvoices: returned ${Array.isArray(finalOutput) ? finalOutput.length : 0} items`);
      output.data = finalOutput;
      output.message = "All Vendor Invoices fetched successfully";
    } catch (error) {
      this.logger.warn('getAllVendorInvoices error', (error as any)?.stack || (error as any)?.message || error);
      output.status = false;
      if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
        output.message = (error as any).message || 'Bad request';
      } else {
        output.message = 'Internal Server Error';
      }
    }
    return output;
  }

  @ApiOperation({ summary: 'Get Vendor Invoice by ID' })
  @ApiCreatedResponse({
    description: 'Vendor Invoice data fetched successfully by ID',
    type: ResponseData
  })
  @HttpCode(HttpStatus.OK)
  @Get('fetch/:VoucherHeaderSid')
  async getVendorInvoiceById(@Param('VoucherHeaderSid', ParseIntPipe) VoucherHeaderSid: number) {
    const output = new ResponseData();
    try {
      const finalOutput = await this.vendorInvoiceService.fetchVendorInvoiceById(VoucherHeaderSid);
      this.logger.debug(`getVendorInvoiceById: ${VoucherHeaderSid}`);
      output.data = finalOutput;
      output.message = "Vendor Invoice data fetched successfully";
    } catch (error) {
      this.logger.warn(`getVendorInvoiceById error for ID ${VoucherHeaderSid}`, (error as any)?.stack || (error as any)?.message || error);
      output.status = false;
      if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
        output.message = (error as any).message || 'Bad request';
      } else {
        output.message = 'Internal Server Error';
      }
    }
    return output;
  }

  @ApiOperation({ summary: 'Update Vendor Invoice by ID' })
  @ApiCreatedResponse({
    description: 'Vendor Invoice updated successfully',
    type: ResponseData
  })
  @HttpCode(HttpStatus.OK)
  @Patch('update/:VoucherHeaderSid')
  async updateVendorInvoice(
    @Param('VoucherHeaderSid', ParseIntPipe) VoucherHeaderSid: number,
    @Body() payload: any
  ) {
    const output = new ResponseData();
    this.logger.log(`updateVendorInvoice ID: ${VoucherHeaderSid}, payload: ${JSON.stringify(payload)}`);
    try {
      const finalOutput = await this.vendorInvoiceService.updateVendorInvoice(VoucherHeaderSid, payload);
      this.logger.debug(`updateVendorInvoice result: ${JSON.stringify(finalOutput)}`);
      output.data = finalOutput;
      output.message = "Vendor Invoice updated successfully";
    } catch (error) {
      this.logger.warn(`updateVendorInvoice error for ID ${VoucherHeaderSid}`, (error as any)?.stack || (error as any)?.message || error);
      output.status = false;
      if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
        output.message = (error as any).message || 'Bad request';
      } else {
        output.message = "Internal Server Error";
      }
    }
    return output;
  }

  @ApiOperation({ summary: 'Delete Vendor Invoice by ID' })
  @ApiCreatedResponse({
    description: 'Vendor Invoice deleted successfully',
    type: ResponseData
  })
  @HttpCode(HttpStatus.OK)
  @Delete('deleteVoucher/:VoucherHeaderSid')
  async deleteVendorInvoice(@Param('VoucherHeaderSid', ParseIntPipe) VoucherHeaderSid: number) {
    const output = new ResponseData();
    try {
      const finalOutput = await this.vendorInvoiceService.deleteVendorInvoice(VoucherHeaderSid);
      this.logger.debug(`deleteVendorInvoice: ${VoucherHeaderSid}`);
      output.data = finalOutput;
      output.message = "Vendor Invoice deleted successfully";
    } catch (error) {
      this.logger.warn(`deleteVendorInvoice error for ID ${VoucherHeaderSid}`, (error as any)?.stack || (error as any)?.message || error);
      output.status = false;
      if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
        output.message = (error as any).message || 'Bad request';
      } else {
        output.message = 'Internal Server Error';
      }
    }
    return output;
  }

  @ApiOperation({ summary: 'Search Vendor Invoices with filters' })
  @ApiCreatedResponse({
    description: 'Vendor Invoices search results',
    type: ResponseData
  })
  @HttpCode(HttpStatus.OK)
  @Post('search-list')
  async searchVendorInvoices(@Body() payload: any) {
    const output = new ResponseData();
    try {
      const finalOutput = await this.vendorInvoiceService.searchVendorInvoices(payload);
      this.logger.debug(`searchVendorInvoices: returned ${finalOutput?.items?.length || 0} items`);
      output.data = finalOutput;
      output.message = "Vendor Invoices search completed";
    } catch (error) {
      this.logger.warn('searchVendorInvoices error', (error as any)?.stack || (error as any)?.message || error);
      output.status = false;
      if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
        output.message = (error as any).message || 'Bad request';
      } else {
        output.message = 'Internal Server Error';
      }
    }
    return output;
  }

  @ApiOperation({ summary: 'Search pending costs for vendor invoice generation' })
  @ApiCreatedResponse({
    description: 'Pending costs search results',
    type: ResponseData
  })
  @HttpCode(HttpStatus.OK)
  @Post('search-pending-costs')
  async searchPendingCosts(@Body() criteria: any) {
    const output = new ResponseData();
    try {
      const finalOutput = await this.vendorInvoiceService.searchPendingCosts(criteria);
      this.logger.debug(`searchPendingCosts: returned ${Array.isArray(finalOutput) ? finalOutput.length : 0} items`);
      output.data = finalOutput;
      output.message = "Pending costs search completed";
    } catch (error) {
      this.logger.warn('searchPendingCosts error', (error as any)?.stack || (error as any)?.message || error);
      output.status = false;
      if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
        output.message = (error as any).message || 'Bad request';
      } else {
        output.message = 'Internal Server Error';
      }
    }
    return output;
  }

  @ApiOperation({ summary: 'Get vendor TDS mapping configuration' })
  @ApiCreatedResponse({
    description: 'Vendor TDS configuration',
    type: ResponseData
  })
  @HttpCode(HttpStatus.OK)
  @Get('vendor-tds-mapping/:vendorId')
  async getVendorTDSMapping(@Param('vendorId', ParseIntPipe) vendorId: number) {
    const output = new ResponseData();
    try {
      const finalOutput = await this.vendorInvoiceService.getVendorTDSConfiguration(vendorId);
      this.logger.debug(`getVendorTDSMapping for vendor: ${vendorId}`);
      output.data = finalOutput;
      output.message = "Vendor TDS configuration fetched successfully";
    } catch (error) {
      this.logger.warn(`getVendorTDSMapping error for vendor ${vendorId}`, (error as any)?.stack || (error as any)?.message || error);
      output.status = false;
      if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
        output.message = (error as any).message || 'Bad request';
      } else {
        output.message = 'Internal Server Error';
      }
    }
    return output;
  }
}
