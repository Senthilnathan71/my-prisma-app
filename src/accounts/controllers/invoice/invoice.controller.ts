import { BadRequestException, Body, Controller, Delete, Get, HttpCode, HttpStatus, Logger, Param, ParseIntPipe, Patch, Post, Query, UnauthorizedException } from '@nestjs/common';
import { ApiOperation, ApiCreatedResponse } from '@nestjs/swagger';
import { ResponseData } from 'src/common/response-data';
import { filterDto } from 'src/masters/DTO/search-vessel.dto';
import { InvoiceService } from 'src/accounts/services/invoice/invoice.service';
import { EmailService } from 'src/email/email.service';
import { Auth } from 'src/common/decorators/auth.decorator';
import { DbTriggerValidationException } from 'src/common/db-validation-error.helper';

class CompanyIdDto {
  CompanyMasterSid: number;
  BranchMasterSid: number;
}

class SendInvoiceEmailDto {
  companyId: number;
  from?: string;
  to: string;
  cc?: string;
  subject: string;
  message: string;
  pdfBase64: string;
  filename: string;
  invoiceDetails?: {
    companyName?: string;
    invoiceNumber?: string;
    invoiceDate?: string;
    totalAmount?: string;
    currency?: string;
  };
}

@Auth()
@Controller('invoice')
export class InvoiceController {
  private readonly logger = new Logger(InvoiceController.name);

  constructor(
    private readonly invoiceService: InvoiceService,
    private readonly emailService: EmailService,
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

    try {
      const finalOutput = await this.invoiceService.createInvoice(payload);

      output.data = finalOutput;
      output.message = "Invoice created successfully";
    } catch (error) {
      // Log full error object (message + stack) for debugging
      if (!(error instanceof DbTriggerValidationException)) {
        this.logger.warn('createInvoice error', (error as any)?.stack || (error as any)?.message || error);
      }
      output.status = false;
      if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
        output.message = (error as any).message || 'Bad request';
      } else {
        output.message = "Internal Server Error";
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
  @Post('fetch')
  async getVoucherHeaderById(@Body() payload: any) {
    const output = new ResponseData();
    try {
      const finalOutput = await this.invoiceService.findVoucherHeaderById(payload.VoucherHeaderSid,payload.CompanyMasterSid,payload.BranchMasterSid);

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

      output.data = finalOutput;
      output.message = "Invoice updated successfully";
    } catch (error) {
      if (!(error instanceof DbTriggerValidationException)) {
        this.logger.warn('updateVoucherHeader error', (error as any)?.stack || (error as any)?.message || error);
      }
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

  @ApiOperation({ summary: 'Send Invoice Email with PDF Attachment' })
  @ApiCreatedResponse({
    description: 'Invoice email sent successfully',
    type: ResponseData
  })
  @HttpCode(HttpStatus.OK)
  @Post('send-email')
  async sendInvoiceEmail(@Body() payload: SendInvoiceEmailDto) {
    const output = new ResponseData();

    try {
      // Validate required fields
      if (!payload.companyId || !payload.to || !payload.subject || !payload.pdfBase64 || !payload.filename) {
        throw new BadRequestException('Missing required fields: companyId, to, subject, pdfBase64, filename');
      }

      // Convert base64 PDF to buffer
      const pdfBuffer = Buffer.from(payload.pdfBase64, 'base64');

      // Send email using email service with company config
      await this.emailService.sendInvoiceEmail({
        companyId: payload.companyId,
        from: payload.from,
        to: payload.to,
        cc: payload.cc,
        subject: payload.subject,
        message: payload.message || 'Please find attached invoice.',
        pdfBuffer: pdfBuffer,
        filename: payload.filename,
        invoiceDetails: payload.invoiceDetails
      });

      output.data = { emailSent: true };
      output.message = "Invoice email sent successfully";
    } catch (error) {
      this.logger.warn('sendInvoiceEmail error', (error as any)?.stack || (error as any)?.message || error);
      output.status = false;
      if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
        output.message = (error as any).message || 'Bad request';
      } else {
        output.message = (error as any)?.message || 'Failed to send invoice email';
      }
    }
    return output;
  }

  @ApiOperation({ summary: 'Get Uninvoiced Revenue Charges for House Job or Master Job' })
  @ApiCreatedResponse({
    description: 'Uninvoiced revenue charges fetched successfully',
    type: ResponseData
  })
  @HttpCode(HttpStatus.OK)
  @Post('uninvoiced-charges')
  async getUninvoicedRevenueCharges(@Body() payload: {
    CompanyMasterSid: number,
    BranchMasterSid: number,
    IsBooking: boolean,
    BookingHeaderSid?: number,
    transactionSid?: number,
    MenuMasterSid?: number,
    RevenueCustomerBranchSid?: number,
    RevenueCustomerMasterSid?: number,
  }) {
    const output = new ResponseData();
    try {
      let data;
      if (payload.IsBooking) {
        if (!payload.BookingHeaderSid) {
          throw new BadRequestException('BookingHeaderSid is required');
        }
      } else {
        if (!payload.transactionSid || !payload.MenuMasterSid) {
          throw new BadRequestException('transactionSid and MenuMasterSid are required');
        }
      }


      const charges = await this.invoiceService.getUninvoicedRevenueCharges(payload);

      output.data = charges;
      output.message = "Uninvoiced revenue charges fetched successfully";
    } catch (error) {
      this.logger.warn('getUninvoicedRevenueCharges error', error?.stack || error?.message || error);
      output.status = false;
      output.message = error instanceof BadRequestException ? error.message : "Internal Server Error";
    }
    return output;
  }

  @ApiOperation({ summary: 'Delete a single Invoice detail (charge line)' })
  @ApiCreatedResponse({
    description: 'Invoice charge line soft-deleted and its revenue link cleared',
    type: ResponseData
  })
  @HttpCode(HttpStatus.OK)
  @Patch('detail/delete/:voucherDetailSid')
  async deleteInvoiceDetail(
    @Param('voucherDetailSid', ParseIntPipe) voucherDetailSid: number,
    @Body() payload: {
      CompanyMasterSid: number;
      BranchMasterSid: number;
      UpdatedBy: string;
      Amount?: number;
      LocalAmount?: number;
    },
  ) {
    const output = new ResponseData();
    try {
      output.data = await this.invoiceService.deleteInvoiceDetail(voucherDetailSid, payload);
      output.message = "Charge line deleted successfully";
    } catch (error) {
      this.logger.warn('deleteInvoiceDetail error', (error as any)?.stack || (error as any)?.message || error);
      output.status = false;
      output.message = error instanceof BadRequestException ? (error as any).message : "Internal Server Error";
    }
    return output;
  }

}
