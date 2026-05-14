import { Controller, Get, Param, HttpCode, HttpStatus, Logger, ParseIntPipe } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';
import { OutstandingService } from '../../services/outstanding/outstanding.service';
import { VoucherOutstandingResponseDto, CustomerOutstandingResponseDto } from '../../dto/outstanding.dto';
import { ResponseData } from '../../../common/response-data';
import { Auth } from 'src/common/decorators/auth.decorator';

/**
 * Controller for outstanding balance calculations
 * Handles API endpoints for retrieving outstanding amounts for vouchers and customers
 */
@Auth()
@ApiTags('Outstanding')
@Controller('accounts/outstanding')
export class OutstandingController {
  constructor(
    private readonly outstandingService: OutstandingService,
    private readonly logger: Logger,
  ) {}

  /**
   * Get outstanding amount for a specific voucher transaction
   * @param companySid - Company Master Sid
   * @param voucherTransactionSid - Voucher Transaction Sid
   * @returns Outstanding balance details
   */
  @ApiOperation({ summary: 'Get outstanding amount for a specific voucher' })
  @ApiParam({ name: 'companySid', description: 'Company Master Sid', type: Number })
  @ApiParam({ name: 'voucherTransactionSid', description: 'Voucher Transaction Sid', type: Number })
  @ApiResponse({
    status: 200,
    description: 'Outstanding amount retrieved successfully',
    type: VoucherOutstandingResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Voucher not found' })
  @HttpCode(HttpStatus.OK)
  @Get('voucher/:companySid/:voucherTransactionSid')
  async getVoucherOutstanding(
    @Param('companySid', ParseIntPipe) companySid: number,
    @Param('voucherTransactionSid', ParseIntPipe) voucherTransactionSid: number,
  ) {
    const resp = new ResponseData();
    try {

      const result = await this.outstandingService.getVoucherOutstanding(companySid, voucherTransactionSid);

      resp.data = result;
      resp.message = 'Voucher outstanding retrieved successfully';

      return resp;
    } catch (error) {
      this.logger.error(
        `Error getting voucher outstanding ${voucherTransactionSid}: ${error.message}`,
        error.stack,
      );

      resp.status = false;
      resp.message = error.message || 'Failed to retrieve voucher outstanding';

      return resp;
    }
  }

  /**
   * Get all outstanding vouchers for a customer
   * @param companySid - Company Master Sid
   * @param ledgerMasterSid - Customer's Ledger Master Sid (SubledgerMasterSid)
   * @returns List of outstanding transactions with totals
   */
  @ApiOperation({ summary: 'Get all outstanding vouchers for a customer' })
  @ApiParam({ name: 'companySid', description: 'Company Master Sid', type: Number })
  @ApiParam({
    name: 'ledgerMasterSid',
    description: 'Customer Ledger Master Sid (SubledgerMasterSid)',
    type: Number,
  })
  @ApiResponse({
    status: 200,
    description: 'Customer outstanding retrieved successfully',
    type: CustomerOutstandingResponseDto,
  })
  @HttpCode(HttpStatus.OK)
  @Get('customer/:companySid/:ledgerMasterSid')
  async getCustomerOutstanding(
    @Param('companySid', ParseIntPipe) companySid: number,
    @Param('ledgerMasterSid', ParseIntPipe) ledgerMasterSid: number,
  ) {
    const resp = new ResponseData();
    try {

      const result = await this.outstandingService.getCustomerOutstanding(companySid, ledgerMasterSid);

      resp.data = result;
      resp.message = `Retrieved ${result.voucherCount} outstanding voucher(s) for customer`;

      return resp;
    } catch (error) {
      this.logger.error(
        `Error getting customer outstanding ${ledgerMasterSid}: ${error.message}`,
        error.stack,
      );

      resp.status = false;
      resp.message = error.message || 'Failed to retrieve customer outstanding';

      return resp;
    }
  }

  /**
   * Get outstanding summary for multiple vouchers (batch query)
   * Useful for displaying outstanding balances in grids or reports
   * @param companySid - Company Master Sid
   * @returns Summary of outstanding vouchers
   */
  @ApiOperation({ summary: 'Get outstanding summary for all vouchers in company' })
  @ApiParam({ name: 'companySid', description: 'Company Master Sid', type: Number })
  @ApiResponse({
    status: 200,
    description: 'Outstanding summary retrieved successfully',
  })
  @HttpCode(HttpStatus.OK)
  @Get('summary/:companySid')
  async getOutstandingSummary(@Param('companySid', ParseIntPipe) companySid: number) {
    const resp = new ResponseData();
    try {

      // For now, return a simple implementation
      // Can be extended to provide company-wide outstanding statistics
      resp.data = {
        companyMasterSid: companySid,
        message: 'Summary endpoint - to be implemented for specific requirements',
      };
      resp.message = 'Outstanding summary retrieved successfully';

      return resp;
    } catch (error) {
      this.logger.error(`Error getting outstanding summary: ${error.message}`, error.stack);

      resp.status = false;
      resp.message = error.message || 'Failed to retrieve outstanding summary';

      return resp;
    }
  }
}
