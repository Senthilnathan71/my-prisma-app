import {
  BadRequestException,
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Logger,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Get,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiCreatedResponse, ApiOperation } from '@nestjs/swagger';
import { Auth } from 'src/common/decorators/auth.decorator';
import { ResponseData } from 'src/common/response-data';
import { EmailService } from 'src/email/email.service';
import { filterDto } from 'src/masters/DTO/search-vessel.dto';
import { InvoiceNonJobService } from '../services/invoice-non-job.service';

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
@Controller('invoice-non-job')
export class InvoiceNonJobController {
  private readonly logger = new Logger(InvoiceNonJobController.name);

  constructor(
    private readonly invoiceNonJobService: InvoiceNonJobService,
    private readonly emailService: EmailService,
  ) {}

  @ApiOperation({ summary: 'Create Invoice Non Job' })
  @ApiCreatedResponse({ description: 'Invoice Non Job created successfully', type: ResponseData })
  @HttpCode(HttpStatus.CREATED)
  @Post('create')
  async createInvoice(@Body() payload: any) {
    const output = new ResponseData();
    try {
      output.data = await this.invoiceNonJobService.createInvoice(payload);
      output.message = 'Invoice Non Job created successfully';
    } catch (error) {
      this.logger.warn('createInvoiceNonJob error', (error as any)?.stack || (error as any)?.message || error);
      output.status = false;
      output.message = error instanceof BadRequestException || error instanceof UnauthorizedException
        ? (error as any).message || 'Bad request'
        : 'Internal Server Error';
    }
    return output;
  }

  @ApiOperation({ summary: 'Get Invoice Non Job by ID' })
  @ApiCreatedResponse({ description: 'Invoice Non Job data fetched successfully by ID', type: ResponseData })
  @HttpCode(HttpStatus.OK)
  @Get('fetch/:voucherHeaderSid')
  async getVoucherHeaderById(@Param('voucherHeaderSid', ParseIntPipe) voucherHeaderSid: number) {
    const output = new ResponseData();
    try {
      output.data = await this.invoiceNonJobService.findVoucherHeaderById(voucherHeaderSid);
      output.message = 'Invoice Non Job data fetched successfully by ID';
    } catch (error) {
      this.logger.warn('getInvoiceNonJobById error', (error as any)?.stack || (error as any)?.message || error);
      output.status = false;
      output.message = error instanceof BadRequestException || error instanceof UnauthorizedException
        ? (error as any).message || 'Bad request'
        : (error as any) || 'Internal Server Error';
    }
    return output;
  }

  @ApiOperation({ summary: 'Update Invoice Non Job' })
  @ApiCreatedResponse({ description: 'Invoice Non Job updated successfully', type: ResponseData })
  @HttpCode(HttpStatus.OK)
  @Patch('update/:voucherHeaderSid')
  async updateVoucherHeader(
    @Param('voucherHeaderSid', ParseIntPipe) voucherHeaderSid: number,
    @Body() payload: any,
  ) {
    const output = new ResponseData();
    try {
      output.data = await this.invoiceNonJobService.updateVoucherHeaderById(voucherHeaderSid, payload);
      output.message = 'Invoice Non Job updated successfully';
    } catch (error) {
      this.logger.warn('updateInvoiceNonJob error', (error as any)?.stack || (error as any)?.message || error);
      output.status = false;
      output.message = error instanceof BadRequestException || error instanceof UnauthorizedException
        ? (error as any).message || 'Bad request'
        : (error as any) || 'Internal Server Error';
    }
    return output;
  }

  @ApiOperation({ summary: 'Search List of Invoice Non Job' })
  @ApiCreatedResponse({ description: 'Search List of Invoice Non Job', type: ResponseData })
  @HttpCode(HttpStatus.OK)
  @Post('search-list')
  async searchInvoiceNonJob(@Body() payload: filterDto) {
    const output = new ResponseData();
    try {
      output.data = await this.invoiceNonJobService.searchVoucherHeader(payload);
      output.message = 'Invoice Non Job search fetched successfully';
    } catch (error) {
      this.logger.warn('searchInvoiceNonJob error', (error as any)?.stack || (error as any)?.message || error);
      output.status = false;
      output.message = error instanceof BadRequestException || error instanceof UnauthorizedException
        ? (error as any).message || 'Bad request'
        : 'Internal Server Error';
    }
    return output;
  }

  @ApiOperation({ summary: 'Send Invoice Non Job Email with PDF Attachment' })
  @ApiCreatedResponse({ description: 'Invoice Non Job email sent successfully', type: ResponseData })
  @HttpCode(HttpStatus.OK)
  @Post('send-email')
  async sendInvoiceEmail(@Body() payload: SendInvoiceEmailDto) {
    const output = new ResponseData();
    try {
      if (!payload.companyId || !payload.to || !payload.subject || !payload.pdfBase64 || !payload.filename) {
        throw new BadRequestException('Missing required fields: companyId, to, subject, pdfBase64, filename');
      }

      const pdfBuffer = Buffer.from(payload.pdfBase64, 'base64');
      await this.emailService.sendInvoiceEmail({
        companyId: payload.companyId,
        from: payload.from,
        to: payload.to,
        cc: payload.cc,
        subject: payload.subject,
        message: payload.message || 'Please find attached invoice.',
        pdfBuffer,
        filename: payload.filename,
        invoiceDetails: payload.invoiceDetails,
      });

      output.data = { emailSent: true };
      output.message = 'Invoice Non Job email sent successfully';
    } catch (error) {
      this.logger.warn('sendInvoiceNonJobEmail error', (error as any)?.stack || (error as any)?.message || error);
      output.status = false;
      output.message = error instanceof BadRequestException || error instanceof UnauthorizedException
        ? (error as any).message || 'Bad request'
        : (error as any)?.message || 'Failed to send invoice email';
    }
    return output;
  }
}
