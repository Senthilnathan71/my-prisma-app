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

/**
 * Payment Voucher Controller
 * Handles payment voucher operations including:
 * - Vendor outstanding search
 * - Payment creation (advance, invoice matching, expenses)
 * - Payment retrieval and listing
 * - Payment update and reversal
 */
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
    this.logger.log(`Creating payment voucher for company ${payload.CompanyMasterSid}`);
    try {
      const payment = await this.paymentService.createNewPayment(payload);
      this.logger.log(`Payment voucher created successfully: ${payment.voucherHeader?.VoucherNumber}`);
      resp.data = payment;
      resp.message = "Payment voucher created successfully";
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

  @Post('post')
  @HttpCode(HttpStatus.CREATED)
  async postPayment(
    @Body() payload: any,
  ) {
    let resp = new ResponseData();
    this.logger.log(`Posting payment voucher for company ${payload.CompanyMasterSid}`);
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
      this.logger.log(`Payment voucher posted successfully: ${payment?.VoucherNumber}`);
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
    this.logger.log(`Searching vendor outstanding for company ${searchDto.CompanyMasterSid}`);

    try {
      const outstanding = await this.paymentService.searchOutstandingInvoices(searchDto);

      this.logger.log(`Found ${outstanding.length} outstanding invoices`);

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
    this.logger.log(`Fetching payment voucher ${payload}`);

    try {
      const payment = await this.paymentService.getPaymentById(payload.VoucherHeaderSid,payload.CompanyMasterSid,payload.BranchMasterSid);

      this.logger.log(`Payment voucher ${payload} fetched successfully`);

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
      this.logger.log(`Searching payment vouchers with criteria: ${JSON.stringify(searchDto)}`);
      resp.data = await this.paymentService.searchPayments(searchDto);
      this.logger.debug("Search Payment Result : " + JSON.stringify(resp.data));
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

}
