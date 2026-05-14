import {
  Controller,
  Post,
  Get,
  Put,
  Delete,
  Body,
  Param,
  Query,
  HttpStatus,
  HttpCode,
  Logger,
  ParseIntPipe,
  ValidationPipe,
  UnauthorizedException,
  BadRequestException,
  Patch,
} from '@nestjs/common';
import {
  CreatePaymentDto,
  PaymentResponseDto,
  SearchVendorOutstandingDto,
  VendorOutstandingInvoiceDto,
  PaymentFilterDto,
  UpdatePaymentDto,
  ReversePaymentDto,
  SearchPaymentDto,
} from '../../dto/payment.dto';
import { ResponseData } from 'src/common/response-data';
import { filterDto } from 'src/masters/DTO/search-vessel.dto';
import { PaymentService } from 'src/accounts/services/payment/payment.service';
import { OutstandingInvoiceDto, SearchOutstandingDto } from 'src/accounts/dto/receipt.dto';
import { ApiCreatedResponse, ApiOperation } from '@nestjs/swagger';
import { Auth } from 'src/common/decorators/auth.decorator';

/**
 * Payment Voucher Controller
 * Handles payment voucher operations including:
 * - Vendor outstanding search
 * - Payment creation (advance, invoice matching, expenses)
 * - Payment retrieval and listing
 * - Payment update and reversal
 */
@Auth()
@Controller('api/accounts/payment')
export class PaymentController {
  private readonly logger = new Logger(PaymentController.name);

  constructor(private readonly paymentService: PaymentService) {}

  /**
   * Create a new payment voucher
   * POST /api/accounts/payment
   *
   * Supports 4 types:
   * 1. Advance Payment to Vendor
   * 2. Payment against Vendor Invoice with TDS
   * 3. Multi-branch Payment with Auto Inter-branch JV
   * 4. Direct Expense Payment
   *
   * @param createPaymentDto Payment creation data
   * @returns Created payment details with JV numbers
   */
  @Post('create')
  @HttpCode(HttpStatus.CREATED)
  async createPayment(
    @Body() payload: any,
  ) {
    let resp = new ResponseData();

    try {
      const payment = await this.paymentService.createNewPayment(payload);

      resp.data = payment;
      resp.message = payment.isAutoPosted
        ? 'New payment is created and posted successfully'
        : 'New payment is created successfully';
    } catch (error) {
      this.logger.error(`Failed to create payment voucher: ${error.message}`, error.stack);
      resp.status = false;
      if(error  instanceof BadRequestException || error instanceof UnauthorizedException){
        resp.message = error.message;
      } else {
        resp.message = " Internal Server Error";
      }
    }
    return resp;
  }

  @Patch('update/:VoucherHeaderSid')
  @HttpCode(HttpStatus.OK)
  async updateNewPayment(
    @Param('VoucherHeaderSid', ParseIntPipe) VoucherHeaderSid: number,
    @Body() payload: any
  ) {
    let resp = new ResponseData();

    try {

      const receipt = await this.paymentService.updatePayment(VoucherHeaderSid, payload);
      resp.data = receipt;
      resp.message = "Payment updated successfully";
    } catch (error) {
      this.logger.warn(`Error updating Payment: ${JSON.stringify(error), error}`);
      resp.status = false;
      if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
        resp.message = (error as any).message || 'Bad request';
      } else {
        resp.message = 'Internal Server Error';
      }
    }
    return resp;
  }

  @Post('post')
  @HttpCode(HttpStatus.CREATED)
  async postPayment(
    @Body() payload: any,
  ) {
    let resp = new ResponseData();

    try {
      const payment = await this.paymentService.postPayment({
        voucherHeaderSid: Number(payload.VoucherHeaderSid),
        companyMasterSid: Number(payload.CompanyMasterSid),
        branchMasterSid: Number(payload.BranchMasterSid),
        yearMasterSid: Number(payload.YearMasterSid),
        localCurrencyMasterSid: Number(payload.LocalCurrencyMasterSid),
        localCurrencyCode: payload.LocalCurrencyCode,
        postedBy: payload.PostedBy,
        taxDetails: payload.TaxDetails
      });

      resp.data = payment;
      resp.message = "Payment voucher posted successfully";
    } catch (error) {
      this.logger.error(`Failed to post payment voucher: ${error.message}`, error.stack);
      resp.status = false;
      if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
        resp.message = error.message;
      } else {
        resp.message = " Internal Server Error";
      }
    }
    return resp;
  }

  /**
   * Search vendor outstanding invoices
   * POST /api/accounts/payment/search-outstanding
   *
   * Search criteria:
   * - Vendor Name
   * - Invoice Number
   * - House No, HBL No, Master No, MBL No
   * - HAWB, MAWB
   *
   * @param searchDto Search criteria
   * @returns List of outstanding vendor invoices
   */
  @Post('search-outstanding')
  @HttpCode(HttpStatus.OK)
  async searchVendorOutstanding(
    @Body(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true })) searchDto: SearchOutstandingDto,
  ): Promise<OutstandingInvoiceDto[]> {

    try {
      const outstanding = await this.paymentService.searchOutstandingInvoices(searchDto);

      return outstanding;
    } catch (error) {
      this.logger.error(`Failed to search vendor outstanding: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Get payment voucher by ID
   * GET /api/accounts/payment/:id
   *
   * @param id Voucher Header SID
   * @returns Payment voucher details
   */
  @Post('fetch')
  @HttpCode(HttpStatus.OK)
  async getPaymentById(@Body() payload: any) {

    try {
      const payment = await this.paymentService.getPaymentById(payload.VoucherHeaderSid,payload.CompanyMasterSid,payload.BranchMasterSid);

      return {
        status: 'success',
        data: payment,
      };
    } catch (error) {
      this.logger.error(`Failed to fetch payment voucher ${payload.VoucherHeaderSid}: ${error.message}`, error.stack);
      throw error;
    }
  }


  /**
   * Search Payment Voucher with filters
   */

  @Post('search-list')
  @HttpCode(HttpStatus.OK)
  async searchPayments(@Body() searchDto: filterDto){
    let resp = new ResponseData();
    try {

      resp.data = await this.paymentService.searchPayments(searchDto);

      resp.message = 'Payment vouchers fetched successfully';
    } catch (error) {
      resp.status = false;
      if(error instanceof BadRequestException || error instanceof UnauthorizedException){
        resp.message = error.message;
      } else {
        resp.message = 'Failed to fetch payment vouchers';
      }
    }
    return resp;
  }

  @ApiOperation({ summary : 'Delete payment voucher' })
  @ApiCreatedResponse({
    description: 'Deleted payment voucher',
    type: ResponseData,
  })
  @Delete('delete/:VoucherHeaderSid')
  @HttpCode(HttpStatus.OK)
  async deletePayment(
    @Param('VoucherHeaderSid',ParseIntPipe) VoucherHeaderSid: number,
  ){
    let resp = new ResponseData();

    try {
      const payment = await this.paymentService.deletePayment(VoucherHeaderSid);

      resp.data = payment;
      resp.message = "Payment voucher deleted successfully";
    } catch (error) {
      this.logger.error(`Failed to delete payment voucher: ${error.message}`, error.stack);
      resp.status = false;
      if(error instanceof BadRequestException || error instanceof UnauthorizedException){
        resp.message = error.message;
      } else {
        resp.message = " Internal Server Error";
      }
    }
    return resp;
  }


}
