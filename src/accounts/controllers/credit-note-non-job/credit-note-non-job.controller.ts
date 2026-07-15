import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  HttpCode,
  HttpStatus,
  Logger,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiCreatedResponse, ApiOperation } from '@nestjs/swagger';
import { Auth } from 'src/common/decorators/auth.decorator';
import { ResponseData } from 'src/common/response-data';
import { EmailService } from 'src/email/email.service';
import { filterDto } from 'src/masters/DTO/search-vessel.dto';
import { PullVoucherDTO } from 'src/accounts/dto/voucher.dto';
import { CreditNoteNonJobService } from '../../services/credit-note-non-job/credit-note-non-job.service';

class SendCreditNoteEmailDto {
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
@Controller('credit-note-non-job')
export class CreditNoteNonJobController {
  private readonly logger = new Logger(CreditNoteNonJobController.name);

  constructor(
    private readonly creditNoteNonJobService: CreditNoteNonJobService,
    private readonly emailService: EmailService,
  ) {}

  private resolveMessage(error: any, fallback: string): string {
    return error instanceof BadRequestException || error instanceof UnauthorizedException
      ? (error as any).message || 'Bad request'
      : fallback;
  }

  @ApiOperation({ summary: 'Create Credit Note Non Job' })
  @ApiCreatedResponse({ description: 'Credit Note Non Job created successfully', type: ResponseData })
  @HttpCode(HttpStatus.CREATED)
  @Post('create')
  async createCreditNote(@Body() payload: any) {
    const output = new ResponseData();
    try {
      output.data = await this.creditNoteNonJobService.createCreditNote(payload);
      output.message = 'Credit Note Non Job created successfully';
    } catch (error) {
      this.logger.warn('createCreditNoteNonJob error', (error as any)?.stack || (error as any)?.message || error);
      output.status = false;
      output.message = this.resolveMessage(error, 'Internal Server Error');
    }
    return output;
  }

  @ApiOperation({ summary: 'Get Credit Note Non Job by ID' })
  @ApiCreatedResponse({ description: 'Credit Note Non Job fetched successfully by ID', type: ResponseData })
  @HttpCode(HttpStatus.OK)
  @Post('fetch')
  async getVoucherHeaderById(@Body() payload: any) {
    const output = new ResponseData();
    try {
      output.data = await this.creditNoteNonJobService.findVoucherHeaderById(
        payload.VoucherHeaderSid,
        payload.CompanyMasterSid,
        payload.BranchMasterSid,
      );
      output.message = 'Credit Note Non Job fetched successfully by ID';
    } catch (error) {
      this.logger.warn('getCreditNoteNonJobById error', (error as any)?.stack || (error as any)?.message || error);
      output.status = false;
      output.message = this.resolveMessage(error, 'Internal Server Error');
    }
    return output;
  }

  @ApiOperation({ summary: 'Update Credit Note Non Job' })
  @ApiCreatedResponse({ description: 'Credit Note Non Job updated successfully', type: ResponseData })
  @HttpCode(HttpStatus.OK)
  @Patch('update/:voucherHeaderSid')
  async updateVoucherHeader(
    @Param('voucherHeaderSid', ParseIntPipe) voucherHeaderSid: number,
    @Body() payload: any,
  ) {
    const output = new ResponseData();
    try {
      output.data = await this.creditNoteNonJobService.updateVoucherHeaderById(voucherHeaderSid, payload);
      output.message = 'Credit Note Non Job updated successfully';
    } catch (error) {
      this.logger.warn('updateCreditNoteNonJob error', (error as any)?.stack || (error as any)?.message || error);
      output.status = false;
      output.message = this.resolveMessage(error, 'Internal Server Error');
    }
    return output;
  }

  @ApiOperation({ summary: 'Search List of Credit Note Non Job' })
  @ApiCreatedResponse({ description: 'Search List of Credit Note Non Job', type: ResponseData })
  @HttpCode(HttpStatus.OK)
  @Post('search-list')
  async searchCreditNoteNonJob(@Body() payload: filterDto) {
    const output = new ResponseData();
    try {
      output.data = await this.creditNoteNonJobService.searchVoucherHeader(payload);
      output.message = 'Credit Note Non Job search fetched successfully';
    } catch (error) {
      this.logger.warn('searchCreditNoteNonJob error', (error as any)?.stack || (error as any)?.message || error);
      output.status = false;
      output.message = this.resolveMessage(error, 'Internal Server Error');
    }
    return output;
  }

  @ApiOperation({ summary: 'Pull source Invoice Non Job (NIN) to reverse' })
  @ApiCreatedResponse({ description: 'Source Invoice Non Job fetched successfully', type: ResponseData })
  @HttpCode(HttpStatus.OK)
  @Post('fetch/invoice')
  async fetchSourceInvoice(@Body() payload: PullVoucherDTO) {
    const output = new ResponseData();
    try {
      output.data = await this.creditNoteNonJobService.fetchSourceInvoice(payload);
      output.message = 'Source Invoice Non Job fetched successfully';
    } catch (error) {
      this.logger.warn('fetchSourceInvoiceNonJob error', (error as any)?.stack || (error as any)?.message || error);
      output.status = false;
      output.message = this.resolveMessage(error, 'Internal Server Error');
    }
    return output;
  }

  @ApiOperation({ summary: 'Delete Credit Note Non Job' })
  @ApiCreatedResponse({ description: 'Credit Note Non Job deleted successfully', type: ResponseData })
  @HttpCode(HttpStatus.OK)
  @Delete('deleteVoucher/:voucherHeaderSid')
  async deleteVoucher(@Param('voucherHeaderSid', ParseIntPipe) voucherHeaderSid: number) {
    const output = new ResponseData();
    try {
      output.data = await this.creditNoteNonJobService.deleteVoucherHeader(voucherHeaderSid);
      output.message = 'Credit Note Non Job deleted successfully';
    } catch (error) {
      this.logger.warn('deleteCreditNoteNonJob error', (error as any)?.stack || (error as any)?.message || error);
      output.status = false;
      output.message = this.resolveMessage(error, 'Internal Server Error');
    }
    return output;
  }

  @ApiOperation({ summary: 'Send Credit Note Non Job Email with PDF Attachment' })
  @ApiCreatedResponse({ description: 'Credit Note Non Job email sent successfully', type: ResponseData })
  @HttpCode(HttpStatus.OK)
  @Post('send-email')
  async sendCreditNoteEmail(@Body() payload: SendCreditNoteEmailDto) {
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
        message: payload.message || 'Please find attached credit note.',
        pdfBuffer,
        filename: payload.filename,
        invoiceDetails: payload.invoiceDetails,
      });

      output.data = { emailSent: true };
      output.message = 'Credit Note Non Job email sent successfully';
    } catch (error) {
      this.logger.warn('sendCreditNoteNonJobEmail error', (error as any)?.stack || (error as any)?.message || error);
      output.status = false;
      output.message = this.resolveMessage(error, (error as any)?.message || 'Failed to send credit note email');
    }
    return output;
  }
}
