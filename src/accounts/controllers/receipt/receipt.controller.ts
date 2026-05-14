import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  ParseIntPipe,
  HttpCode,
  HttpStatus,
  Logger,
  UseGuards,
  BadRequestException,
  UnauthorizedException,
  Patch,
} from '@nestjs/common';
import { ReceiptService } from '../../services/receipt/receipt.service';
import {
  CreateReceiptDto,
  ReceiptResponseDto,
  SearchOutstandingDto,
  OutstandingInvoiceDto,
  ReceiptFilterDto,
  UpdateReceiptDto,
  ReverseReceiptDto,
} from '../../dto/receipt.dto';
import { ApiCreatedResponse, ApiOperation } from '@nestjs/swagger';
import { ResponseData } from 'src/common/response-data';
import { PrismaClientValidationError } from '@prisma/client/runtime/library';
import { Auth } from 'src/common/decorators/auth.decorator';

/**
 * Receipt Voucher Controller
 * Provides REST API endpoints for receipt voucher operations
 *
 * Endpoints:
 * - POST /api/accounts/receipt - Create new receipt
 * - GET /api/accounts/receipt/:id - Get receipt by ID
 * - GET /api/accounts/receipt - List receipts with filters
 * - POST /api/accounts/receipt/search-outstanding - Search outstanding invoices
 * - PUT /api/accounts/receipt/:id - Update receipt
 * - POST /api/accounts/receipt/:id/reverse - Reverse receipt
 */
@Auth()
@Controller('accounts/receipt')
export class ReceiptController {
  private readonly logger = new Logger(ReceiptController.name);

  constructor(private readonly receiptService: ReceiptService) {}

  /**
   * Create new receipt voucher
   *
   * @param createDto - Receipt creation data
   * @returns Created receipt details with voucher number and matched invoices
   *
   * Example request:
   * POST /api/accounts/receipt
   * {
   *   "CompanyMasterSid": 1,
   *   "BranchMasterSid": 1,
   *   "LedgerMasterSid": 123,
   *   "VoucherDate": "2025-11-02",
   *   "PaymentMode": "NEFT",
   *   "TotalAmount": 10000,
   *   "Details": [
   *     {
   *       "VoucherTransactionSid": 456,
   *       "Amount": 10000,
   *       "IsAdvance": false
   *     }
   *   ]
   * }
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async createReceipt(@Body() payload: any){
    let resp = new ResponseData();
    
    try {

      const receipt = await this.receiptService.createNewReceipt(payload);
      resp.data = receipt;
      resp.message = receipt.isAutoPosted
        ? 'New receipt is created and posted successfully'
        : 'New receipt is created successfully';
    } catch (error) {
      resp.status = false;
      this.logger.warn(`Error creating receipt: ${JSON.stringify(error),error}`);
      if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
        resp.message = (error as any).message || 'Bad request';
      } else {
        resp.message = 'Internal Server Error';
      }
    }
    return resp;
  }

  @Patch('update/:VoucherHeaderSid')
  @HttpCode(HttpStatus.OK)
  async updateNewReceipt(
    @Param('VoucherHeaderSid',ParseIntPipe) VoucherHeaderSid: number, 
    @Body() payload: any
  ){
    let resp = new ResponseData();
    
    try {

      const receipt = await this.receiptService.updateReceipt(VoucherHeaderSid,payload);
      resp.data = receipt;
      resp.message = "Receipt updated successfully";
    } catch (error) {
      this.logger.warn(`Error updating receipt: ${JSON.stringify(error),error}`);
      resp.status = false;
      if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
        resp.message = (error as any).message || 'Bad request';
      } else {
        resp.message = 'Internal Server Error';
      }
    }
    return resp;
  }

  @Post('post-receipt')
  @HttpCode(HttpStatus.CREATED)
  async postReceipt(@Body() payload: any){
    let resp = new ResponseData();
    
    try {

      const receipt = await this.receiptService.postReceipt({
        voucherHeaderSid: Number(payload.VoucherHeaderSid),
        companyMasterSid: Number(payload.CompanyMasterSid),
        branchMasterSid: Number(payload.BranchMasterSid),
        yearMasterSid: Number(payload.YearMasterSid),
        localCurrencyMasterSid: Number(payload.LocalCurrencyMasterSid),
        localCurrencyCode: payload.LocalCurrencyCode,
        postedBy: payload.PostedBy,
        taxDetails: payload.TaxDetails
      });
      resp.data = receipt;
      resp.message = 'Receipt posted successfully';
    } catch (error) {
      resp.status = false;
      this.logger.warn(`Error posting receipt: ${JSON.stringify(error),error}`);
      if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
        resp.message = (error as any).message || 'Bad request';
      } else {
        resp.message = 'Internal Server Error';
      }
    }
    return resp;
  }

  /**
   * Search outstanding invoices for receipt matching
   * Uses existing OutstandingService (as per user requirement)
   *
   * @param searchDto - Search criteria
   * @returns List of outstanding invoices
   *
   * Example request:
   * POST /api/accounts/receipt/search-outstanding
   * {
   *   "CompanyMasterSid": 1,
   *   "LedgerMasterSid": 123,
   *   "CustomerName": "ABC Corp",
   *   "InvoiceNumber": "INV2025",
   *   "HouseNumber": "HBL123",
   *   "IncludeFullyPaid": false
   * }
   */
  @Post('search-outstanding')
  @HttpCode(HttpStatus.OK)
  async searchOutstandingInvoices(@Body() searchDto: SearchOutstandingDto): Promise<{
    status: boolean;
    message: string;
    data: OutstandingInvoiceDto[];
  }> {

    try {
      const invoices = await this.receiptService.searchOutstandingInvoices(searchDto);

      return {
        status: true,
        message: `Found ${invoices.length} outstanding invoice(s)`,
        data: invoices,
      };
    } catch (error) {
      this.logger.error(`Failed to search outstanding invoices: ${error.message}`, error.stack);
      throw error;
    }
  }

  
  @ApiOperation({ summary: 'Search Receipts with filters' })
  @ApiCreatedResponse({
    description: 'Receipts search results',
    type: ResponseData
  })
  @HttpCode(HttpStatus.OK)
  @Post('search-list')
  async searchReceipts(@Body() payload: any) {
    const output = new ResponseData();
    try {
      const finalOutput = await this.receiptService.searchReceipts(payload);

      output.data = finalOutput;
      output.message = "Receipts search completed";
    } catch (error) {
      this.logger.warn('searchReceipts error', (error as any)?.stack || (error as any)?.message || error);
      output.status = false;
      if(error instanceof PrismaClientValidationError){
        output.message = error.message;
      }
      if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
        output.message = (error as any).message || 'Bad request';
      } else {
        output.message = 'Internal Server Error';
      }
    }
    return output;
  }


  /**
   * Get receipt voucher by ID
   *
   * @param id - VoucherHeaderSid
   * @returns Receipt details with all transactions and matchings
   *
   * Example: GET /api/accounts/receipt/123
   */
  @HttpCode(HttpStatus.OK)
  @Post('fetch')
  async getReceiptById(@Body() payload: any) {
    let response = new ResponseData();
    
    try {

      const receipt = await this.receiptService.getReceiptById(payload.VoucherHeaderSid,payload.CompanyMasterSid,payload.BranchMasterSid);

      response.data = receipt;
      response.message = "Receipt is successfully fetched";
    } catch (error) {
      response.status = false;
      this.logger.warn(`Receipt fetching error : ${JSON.stringify(error), error}`);
      if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
        response.message = error.message;
      } else {
        response.message = "Internal Server Error";
      }
    }
    return response;
  }

  /**
   * Get list of receipts with filters
   *
   * @param filterDto - Filter criteria as query parameters
   * @returns List of receipts
   *
   * Example: GET /api/accounts/receipt?CompanyMasterSid=1&BranchMasterSid=1&DateFrom=2025-01-01&DateTo=2025-12-31
   */
  @Get()
  async getReceipts(@Query() filterDto: ReceiptFilterDto): Promise<{
    status: boolean;
    message: string;
    data: any[];
  }> {

    try {
      const receipts = await this.receiptService.getReceipts(filterDto);

      return {
        status: true,
        message: `Found ${receipts.length} receipt(s)`,
        data: receipts,
      };
    } catch (error) {
      this.logger.error(`Failed to get receipts: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Get outstanding invoices for a specific customer
   * Convenience endpoint that wraps searchOutstandingInvoices
   *
   * @param companySid - Company Sid
   * @param customerSid - Customer Ledger Master Sid
   * @returns List of outstanding invoices for the customer
   *
   * Example: GET /api/accounts/receipt/outstanding/1/123
   */
  @Get('outstanding/:companySid/:customerSid')
  async getCustomerOutstanding(
    @Param('companySid', ParseIntPipe) companySid: number,
    @Param('customerSid', ParseIntPipe) customerSid: number,
  ): Promise<{
    status: boolean;
    message: string;
    data: OutstandingInvoiceDto[];
  }> {

    try {
      const searchDto: SearchOutstandingDto = {
        CompanyMasterSid: companySid,
        LedgerMasterSid: customerSid,
        IncludeFullyPaid: false,
      };

      const invoices = await this.receiptService.searchOutstandingInvoices(searchDto);

      return {
        status: true,
        message: `Found ${invoices.length} outstanding invoice(s)`,
        data: invoices,
      };
    } catch (error) {
      this.logger.error(`Failed to get customer outstanding: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Update receipt voucher
   * Note: Only limited fields can be updated (narration, status, etc.)
   * Cannot update amounts or matched invoices after creation
   *
   * @param id - VoucherHeaderSid
   * @param updateDto - Update data
   * @returns Updated receipt
   *
   * Example: PUT /api/accounts/receipt/123
   * {
   *   "Narration": "Updated narration",
   *   "UpdatedBy": "admin"
   * }
   */
  @Put(':id')
  async updateReceipt(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateDto: UpdateReceiptDto,
  ): Promise<{
    status: boolean;
    message: string;
    data: any;
  }> {

    try {
      // Implementation would go here
      // For now, return placeholder
      return {
        status: true,
        message: 'Receipt update not yet implemented',
        data: null,
      };
    } catch (error) {
      this.logger.error(`Failed to update receipt: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Reverse a receipt voucher
   * Creates a reversal entry to cancel the original receipt
   * Also reverses any voucher matchings and inter-branch JVs
   *
   * @param id - VoucherHeaderSid
   * @param reverseDto - Reversal details
   * @returns Reversal voucher details
   *
   * Example: POST /api/accounts/receipt/123/reverse
   * {
   *   "VoucherHeaderSid": 123,
   *   "ReversalDate": "2025-11-02",
   *   "Reason": "Payment bounced",
   *   "ReversedBy": "admin"
   * }
   */
  @Post(':id/reverse')
  @HttpCode(HttpStatus.CREATED)
  async reverseReceipt(
    @Param('id', ParseIntPipe) id: number,
    @Body() reverseDto: ReverseReceiptDto,
  ): Promise<{
    status: boolean;
    message: string;
    data: any;
  }> {

    try {
      // Implementation would go here
      // Would need to:
      // 1. Create reversal voucher with opposite Dr/Cr
      // 2. Link via ReversalVoucher field
      // 3. Update voucher matchings
      // 4. Reverse inter-branch JV if exists

      return {
        status: true,
        message: 'Receipt reversal not yet implemented',
        data: null,
      };
    } catch (error) {
      this.logger.error(`Failed to reverse receipt: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Get receipt summary/statistics
   *
   * @param companySid - Company Sid
   * @param branchSid - Branch Sid (optional)
   * @param dateFrom - Start date (optional)
   * @param dateTo - End date (optional)
   * @returns Summary statistics
   *
   * Example: GET /api/accounts/receipt/summary/1?BranchMasterSid=1&DateFrom=2025-01-01&DateTo=2025-12-31
   */
  @Get('summary/:companySid')
  async getReceiptSummary(
    @Param('companySid', ParseIntPipe) companySid: number,
    @Query('BranchMasterSid', ParseIntPipe) branchSid?: number,
    @Query('DateFrom') dateFrom?: string,
    @Query('DateTo') dateTo?: string,
  ): Promise<{
    status: boolean;
    message: string;
    data: any;
  }> {

    try {
      // Implementation would calculate:
      // - Total receipts count
      // - Total amount collected
      // - Total TDS deducted
      // - Breakdown by payment mode
      // - Breakdown by branch

      return {
        status: true,
        message: 'Receipt summary not yet implemented',
        data: null,
      };
    } catch (error) {
      this.logger.error(`Failed to get receipt summary: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Get receipt by voucher number
   * Convenience endpoint for searching by voucher number
   *
   * @param companySid - Company Sid
   * @param voucherNumber - Voucher number (e.g., RV2511001)
   * @returns Receipt details
   *
   * Example: GET /api/accounts/receipt/by-number/1/RV2511001
   */
  @Get('by-number/:companySid/:voucherNumber')
  async getReceiptByNumber(
    @Param('companySid', ParseIntPipe) companySid: number,
    @Param('voucherNumber') voucherNumber: string,
  ): Promise<{
    status: boolean;
    message: string;
    data: any;
  }> {

    try {
      const filterDto: ReceiptFilterDto = {
        CompanyMasterSid: companySid,
        VoucherNumber: voucherNumber,
      };

      const receipts = await this.receiptService.getReceipts(filterDto);

      if (receipts.length === 0) {
        return {
          status: false,
          message: `Receipt ${voucherNumber} not found`,
          data: null,
        };
      }

      return {
        status: true,
        message: 'Receipt found',
        data: receipts[0],
      };
    } catch (error) {
      this.logger.error(`Failed to get receipt by number: ${error.message}`, error.stack);
      throw error;
    }
  }
}
