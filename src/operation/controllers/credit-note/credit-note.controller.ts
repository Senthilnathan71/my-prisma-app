import { BadRequestException, Body, Controller, Delete, Get, HttpCode, HttpStatus, Logger, Param, ParseIntPipe, Patch, Post, UnauthorizedException } from '@nestjs/common';
import { ApiOperation, ApiCreatedResponse } from '@nestjs/swagger';
import { ResponseData } from 'src/common/response-data';
import { EmailService } from 'src/email/email.service';
import { filterDto } from 'src/masters/DTO/search-vessel.dto';
import { CreditNoteService } from 'src/operation/services/credit-note/credit-note.service';
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

@Controller('credit-note')
export class CreditNoteController {
    private readonly logger = new Logger(CreditNoteController.name);
    constructor(
        private readonly creditNoteService: CreditNoteService,
        private readonly emailService: EmailService,
      ) { }
    
      @ApiOperation({ summary: 'Create Invoice' })
      @ApiCreatedResponse({
        description: 'VoucherHeader, VoucherDetail, VoucherOthers,created successfully',
        type: ResponseData
      })
      @HttpCode(HttpStatus.CREATED)
      @Post('create')
      async createCreditNote(@Body() payload: any) {
        const output = new ResponseData();
        this.logger.log(`createInvoice payload: ${JSON.stringify(payload)}`);
        try {
          const finalOutput = await this.creditNoteService.createCreditNote(payload);
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
  @Get('invoice')
  async getAllInvoices() {
    const output = new ResponseData();
    try {
      const finalOutput = await this.creditNoteService.allInvoices();
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
  @Get('fetch/invoice/:voucherHeaderSid')
  async getInvoiceById(@Param('voucherHeaderSid', ParseIntPipe) voucherHeaderSid: number) {
    const output = new ResponseData();
    try {
      const finalOutput = await this.creditNoteService.findInvoiceById(voucherHeaderSid);
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
    
      @ApiOperation({ summary: 'Get All Invoices' })
      @ApiCreatedResponse({
        description: 'All Invoices fetched successfully',
        type: ResponseData
      })
      @HttpCode(HttpStatus.OK)
      @Get()
      async fetchCreditNotes() {
        const output = new ResponseData();
        try {
          const finalOutput = await this.creditNoteService.fetchCreditNotes();
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
          const finalOutput = await this.creditNoteService.findVoucherHeaderById(voucherHeaderSid);
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
          const finalOutput = await this.creditNoteService.updateVoucherHeaderById(voucherHeaderSid, payload);
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
          const booking = await this.creditNoteService.deleteVoucherHeader(voucherHeaderSid);
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
          const searchOutput = await this.creditNoteService.searchVoucherHeader(payload);
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
    
      @ApiOperation({ summary: 'Send Invoice Email with PDF Attachment' })
      @ApiCreatedResponse({
        description: 'Invoice email sent successfully',
        type: ResponseData
      })
      @HttpCode(HttpStatus.OK)
      @Post('send-email')
      async sendInvoiceEmail(@Body() payload: SendInvoiceEmailDto) {
        const output = new ResponseData();
        this.logger.log(`sendInvoiceEmail to: ${payload.to}, companyId: ${payload.companyId}`);
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
}
