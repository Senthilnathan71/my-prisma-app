import { Controller, Get, Post, Body, Param, HttpCode, HttpStatus, Logger, ParseIntPipe } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiBody } from '@nestjs/swagger';
import { VoucherPostingService } from '../../services/voucher-posting/voucher-posting.service';
import {
  PostVoucherRequestDto,
  PostVoucherResponseDto,
  ValidationResultDto,
  DraftVoucherResponseDto,
} from '../../dto/voucher-posting.dto';
import { ResponseData } from '../../../common/response-data';
import { Auth } from 'src/common/decorators/auth.decorator';

/**
 * Controller for voucher posting operations
 * Handles API endpoints for posting vouchers from draft to VoucherTransaction table
 */
@Auth()
@ApiTags('Voucher Posting')
@Controller('accounts/voucher-posting')
export class VoucherPostingController {
  constructor(
    private readonly voucherPostingService: VoucherPostingService,
    private readonly logger: Logger,
  ) {}

  /**
   * Get draft voucher with all details
   * @param voucherHeaderSid - Voucher Header ID
   * @returns Draft voucher data including header and detail lines
   */
  @ApiOperation({ summary: 'Get draft voucher with all details' })
  @ApiParam({ name: 'voucherHeaderSid', description: 'Voucher Header Sid', type: Number })
  @ApiResponse({
    status: 200,
    description: 'Draft voucher retrieved successfully',
    type: DraftVoucherResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Voucher not found' })
  @HttpCode(HttpStatus.OK)
  @Get('draft/:voucherHeaderSid')
  async getDraftVoucher(@Param('voucherHeaderSid', ParseIntPipe) voucherHeaderSid: number) {
    const resp = new ResponseData();
    try {
      this.logger.log(`GET /voucher-posting/draft/${voucherHeaderSid} - Fetching draft voucher`);

      const result = await this.voucherPostingService.getDraftVoucher(voucherHeaderSid);

      resp.data = result;
      resp.message = 'Draft voucher retrieved successfully';

      this.logger.log(
        `Draft voucher ${voucherHeaderSid} retrieved: ${result.details.length} detail lines, Posted: ${result.isPosted}`,
      );

      return resp;
    } catch (error) {
      this.logger.error(`Error getting draft voucher ${voucherHeaderSid}: ${error.message}`, error.stack);

      resp.status = false;
      resp.message = error.message || 'Failed to retrieve draft voucher';

      return resp;
    }
  }

  /**
   * Validate a voucher before posting
   * @param voucherHeaderSid - Voucher Header ID
   * @returns Validation result with any errors found
   */
  @ApiOperation({ summary: 'Validate a voucher before posting' })
  @ApiParam({ name: 'voucherHeaderSid', description: 'Voucher Header Sid', type: Number })
  @ApiResponse({
    status: 200,
    description: 'Validation completed',
    type: ValidationResultDto,
  })
  @HttpCode(HttpStatus.OK)
  @Post('validate/:voucherHeaderSid')
  async validateVoucher(@Param('voucherHeaderSid', ParseIntPipe) voucherHeaderSid: number) {
    const resp = new ResponseData();
    try {
      this.logger.log(`POST /voucher-posting/validate/${voucherHeaderSid} - Validating voucher`);

      const result = await this.voucherPostingService.validateVoucher(voucherHeaderSid);

      resp.data = result;
      resp.message = result.isValid ? 'Validation passed' : 'Validation failed';
      resp.status = result.isValid;

      if (!result.isValid) {
        this.logger.warn(
          `Voucher ${voucherHeaderSid} validation failed: ${result.errors.map((e) => e.code).join(', ')}`,
        );
      } else {
        this.logger.log(
          `Voucher ${voucherHeaderSid} validation passed: ${result.lineCount} lines, Dr=${result.totalDebit}, Cr=${result.totalCredit}`,
        );
      }

      return resp;
    } catch (error) {
      this.logger.error(`Error validating voucher ${voucherHeaderSid}: ${error.message}`, error.stack);

      resp.status = false;
      resp.message = error.message || 'Validation failed due to an error';

      return resp;
    }
  }

  /**
   * Prepare posting payload for a draft voucher
   * @param voucherHeaderSid - Voucher Header ID
   * @returns Prepared posting payload
   */
  @ApiOperation({ summary: 'Prepare posting payload for a draft voucher' })
  @ApiParam({ name: 'voucherHeaderSid', description: 'Voucher Header Sid', type: Number })
  @ApiResponse({
    status: 200,
    description: 'Posting payload prepared successfully',
    type: PostVoucherRequestDto,
  })
  @HttpCode(HttpStatus.OK)
  @Post('prepare/:voucherHeaderSid')
  async preparePostingPayload(@Param('voucherHeaderSid', ParseIntPipe) voucherHeaderSid: number) {
    const resp = new ResponseData();
    try {
      this.logger.log(`POST /voucher-posting/prepare/${voucherHeaderSid} - Preparing posting payload`);

      const result = await this.voucherPostingService.preparePostingPayload(voucherHeaderSid);

      resp.data = result;
      resp.message = 'Posting payload prepared successfully';

      this.logger.log(
        `Posting payload prepared for voucher ${voucherHeaderSid}: ${result.lines.length} lines, ${result.taxSummaries.length} tax summaries`,
      );

      return resp;
    } catch (error) {
      this.logger.error(`Error preparing posting payload for ${voucherHeaderSid}: ${error.message}`, error.stack);

      resp.status = false;
      resp.message = error.message || 'Failed to prepare posting payload';

      return resp;
    }
  }

  /**
   * Post a voucher (create VoucherTransaction records)
   * @param payload - Posting payload with voucher data
   * @returns Posting result with transaction details
   */
  @ApiOperation({ summary: 'Post a voucher to create VoucherTransaction records' })
  @ApiBody({ type: PostVoucherRequestDto })
  @ApiResponse({
    status: 200,
    description: 'Voucher posted successfully',
    type: PostVoucherResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Validation failed or posting error' })
  @HttpCode(HttpStatus.OK)
  @Post('post')
  async postVoucher(@Body() payload: PostVoucherRequestDto) {
    const resp = new ResponseData();
    try {
      this.logger.log(
        `POST /voucher-posting/post - Posting voucher ${payload.voucherHeaderSid} (${payload.voucherNumber})`,
      );

      const result = await this.voucherPostingService.postVoucher(payload);

      resp.data = result;
      resp.status = result.success;
      resp.message = result.message || (result.success ? 'Voucher posted successfully' : 'Posting failed');

      if (result.success) {
        this.logger.log(
          `Voucher ${payload.voucherHeaderSid} posted successfully: ${result.transactionCount} transactions created`,
        );
      } else {
        this.logger.warn(
          `Voucher ${payload.voucherHeaderSid} posting failed: ${result.errors.map((e) => e.code).join(', ')}`,
        );
      }

      return resp;
    } catch (error) {
      this.logger.error(`Error posting voucher: ${error.message}`, error.stack);

      resp.status = false;
      resp.message = error.message || 'Failed to post voucher';
      resp.data = {
        success: false,
        errors: [{ code: 'POSTING_ERROR', message: error.message }],
      };

      return resp;
    }
  }

  /**
   * Post a voucher by ID (convenience endpoint)
   * Combines prepare and post operations
   * @param voucherHeaderSid - Voucher Header ID
   * @returns Posting result
   */
  @ApiOperation({ summary: 'Post a voucher by ID (convenience endpoint)' })
  @ApiParam({ name: 'voucherHeaderSid', description: 'Voucher Header Sid', type: Number })
  @ApiResponse({
    status: 200,
    description: 'Voucher posted successfully',
    type: PostVoucherResponseDto,
  })
  @HttpCode(HttpStatus.OK)
  @Post('post/:voucherHeaderSid')
  async postVoucherById(@Param('voucherHeaderSid', ParseIntPipe) voucherHeaderSid: number) {
    const resp = new ResponseData();
    try {
      this.logger.log(`POST /voucher-posting/post/${voucherHeaderSid} - Posting voucher by ID`);

      // Prepare payload
      const payload = await this.voucherPostingService.preparePostingPayload(voucherHeaderSid);

      // Post voucher
      const result = await this.voucherPostingService.postVoucher(payload);

      resp.data = result;
      resp.status = result.success;
      resp.message = result.message || (result.success ? 'Voucher posted successfully' : 'Posting failed');

      if (result.success) {
        this.logger.log(
          `Voucher ${voucherHeaderSid} posted successfully: ${result.transactionCount} transactions created`,
        );
      } else {
        this.logger.warn(
          `Voucher ${voucherHeaderSid} posting failed: ${result.errors.map((e) => e.code).join(', ')}`,
        );
      }

      return resp;
    } catch (error) {
      this.logger.error(`Error posting voucher ${voucherHeaderSid}: ${error.message}`, error.stack);

      resp.status = false;
      resp.message = error.message || 'Failed to post voucher';
      resp.data = {
        success: false,
        errors: [{ code: 'POSTING_ERROR', message: error.message }],
      };

      return resp;
    }
  }

  /**
   * Get posted transactions for a voucher
   * @param voucherHeaderSid - Voucher Header ID
   * @returns Array of VoucherTransaction records
   */
  @ApiOperation({ summary: 'Get posted transactions for a voucher' })
  @ApiParam({ name: 'voucherHeaderSid', description: 'Voucher Header Sid', type: Number })
  @ApiResponse({
    status: 200,
    description: 'Posted transactions retrieved successfully',
  })
  @HttpCode(HttpStatus.OK)
  @Get('transactions/:voucherHeaderSid')
  async getPostedTransactions(@Param('voucherHeaderSid', ParseIntPipe) voucherHeaderSid: number) {
    const resp = new ResponseData();
    try {
      this.logger.log(`GET /voucher-posting/transactions/${voucherHeaderSid} - Fetching posted transactions`);

      const transactions = await this.voucherPostingService['_db'].voucherTransaction.findMany({
        where: {
          VoucherHeaderSid: voucherHeaderSid,
          Status: 'A',
        },
        include: {
          coaMaster: true,
          subledgerMaster: true,
        },
        orderBy: {
          Sno: 'asc',
        },
      });

      resp.data = transactions;
      resp.message = `Retrieved ${transactions.length} posted transactions`;

      this.logger.log(`Retrieved ${transactions.length} posted transactions for voucher ${voucherHeaderSid}`);

      return resp;
    } catch (error) {
      this.logger.error(`Error getting posted transactions for ${voucherHeaderSid}: ${error.message}`, error.stack);

      resp.status = false;
      resp.message = error.message || 'Failed to retrieve posted transactions';

      return resp;
    }
  }
}
