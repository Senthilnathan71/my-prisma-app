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
} from '@nestjs/common';
import { PaymentService } from '../../services/payment/payment.service';
import {
  CreatePaymentDto,
  PaymentResponseDto,
  SearchVendorOutstandingDto,
  VendorOutstandingInvoiceDto,
  PaymentFilterDto,
  UpdatePaymentDto,
  ReversePaymentDto,
} from '../../dto/payment.dto';

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
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async createPayment(
    @Body(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true })) createPaymentDto: CreatePaymentDto,
  ): Promise<PaymentResponseDto> {
    this.logger.log(`Creating payment voucher for company ${createPaymentDto.CompanyMasterSid}`);

    try {
      const payment = await this.paymentService.createPayment(createPaymentDto);

      this.logger.log(`Payment voucher created successfully: ${payment.VoucherNumber}`);

      return payment;
    } catch (error) {
      this.logger.error(`Failed to create payment voucher: ${error.message}`, error.stack);
      throw error;
    }
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
    @Body(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true })) searchDto: SearchVendorOutstandingDto,
  ): Promise<VendorOutstandingInvoiceDto[]> {
    this.logger.log(`Searching vendor outstanding for company ${searchDto.CompanyMasterSid}`);

    try {
      const outstanding = await this.paymentService.searchVendorOutstanding(searchDto);

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
  @Get(':id')
  @HttpCode(HttpStatus.OK)
  async getPaymentById(@Param('id', ParseIntPipe) id: number): Promise<any> {
    this.logger.log(`Fetching payment voucher ${id}`);

    try {
      const payment = await this.paymentService.getPaymentById(id);

      this.logger.log(`Payment voucher ${id} fetched successfully`);

      return {
        status: 'success',
        data: payment,
      };
    } catch (error) {
      this.logger.error(`Failed to fetch payment voucher ${id}: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * List payment vouchers with filters
   * POST /api/accounts/payment/list
   *
   * Filters:
   * - Company, Branch
   * - Voucher Number
   * - Vendor
   * - Date Range
   * - Payment Mode (Cash/Bank)
   *
   * @param filterDto Filter criteria
   * @returns List of payment vouchers
   */
  @Post('list')
  @HttpCode(HttpStatus.OK)
  async getPayments(
    @Body(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true })) filterDto: PaymentFilterDto,
  ): Promise<any> {
    this.logger.log(`Fetching payment vouchers with filters: ${JSON.stringify(filterDto)}`);

    try {
      const payments = await this.paymentService.getPayments(filterDto);

      this.logger.log(`Found ${payments.length} payment vouchers`);

      return {
        status: 'success',
        data: payments,
        total: payments.length,
      };
    } catch (error) {
      this.logger.error(`Failed to fetch payment vouchers: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Update payment voucher
   * PUT /api/accounts/payment/:id
   *
   * Allows updating:
   * - Narration
   * - Remarks
   * - Status
   *
   * @param id Voucher Header SID
   * @param updateDto Update data
   * @returns Updated payment details
   */
  @Put(':id')
  @HttpCode(HttpStatus.OK)
  async updatePayment(
    @Param('id', ParseIntPipe) id: number,
    @Body(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true })) updateDto: UpdatePaymentDto,
  ): Promise<any> {
    this.logger.log(`Updating payment voucher ${id}`);

    try {
      // TODO: Implement update logic in service
      this.logger.warn('Payment update not yet implemented');

      return {
        status: 'success',
        message: 'Payment update not yet implemented',
      };
    } catch (error) {
      this.logger.error(`Failed to update payment voucher ${id}: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Reverse payment voucher
   * POST /api/accounts/payment/reverse
   *
   * Creates a reversal voucher with:
   * - Opposite Dr/Cr entries
   * - Reversal date and reason
   * - Links to original voucher
   *
   * @param reverseDto Reversal data
   * @returns Reversal voucher details
   */
  @Post('reverse')
  @HttpCode(HttpStatus.OK)
  async reversePayment(
    @Body(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true })) reverseDto: ReversePaymentDto,
  ): Promise<any> {
    this.logger.log(`Reversing payment voucher ${reverseDto.VoucherHeaderSid}`);

    try {
      // TODO: Implement reversal logic in service
      this.logger.warn('Payment reversal not yet implemented');

      return {
        status: 'success',
        message: 'Payment reversal not yet implemented',
      };
    } catch (error) {
      this.logger.error(
        `Failed to reverse payment voucher ${reverseDto.VoucherHeaderSid}: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Delete payment voucher
   * DELETE /api/accounts/payment/:id
   *
   * Soft delete by setting Status = 'S' (Suspended)
   *
   * @param id Voucher Header SID
   * @returns Deletion confirmation
   */
  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  async deletePayment(@Param('id', ParseIntPipe) id: number): Promise<any> {
    this.logger.log(`Deleting payment voucher ${id}`);

    try {
      // TODO: Implement delete logic in service
      this.logger.warn('Payment deletion not yet implemented');

      return {
        status: 'success',
        message: 'Payment deletion not yet implemented',
      };
    } catch (error) {
      this.logger.error(`Failed to delete payment voucher ${id}: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Get payment summary
   * GET /api/accounts/payment/summary
   *
   * Returns summary statistics:
   * - Total payments by mode (Cash/Bank)
   * - Total TDS deducted
   * - Branch-wise summary
   *
   * @param query Query parameters
   * @returns Payment summary
   */
  @Get('summary')
  @HttpCode(HttpStatus.OK)
  async getPaymentSummary(@Query() query: any): Promise<any> {
    this.logger.log(`Fetching payment summary`);

    try {
      // TODO: Implement summary logic in service
      this.logger.warn('Payment summary not yet implemented');

      return {
        status: 'success',
        message: 'Payment summary not yet implemented',
        data: {
          totalPayments: 0,
          totalCashPayments: 0,
          totalBankPayments: 0,
          totalTDS: 0,
        },
      };
    } catch (error) {
      this.logger.error(`Failed to fetch payment summary: ${error.message}`, error.stack);
      throw error;
    }
  }
}
