import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Logger,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiCreatedResponse, ApiOperation } from '@nestjs/swagger';
import { PaymentRequestService } from 'src/accounts/services/payment-request/payment-request.service';
import { Auth } from 'src/common/decorators/auth.decorator';
import { ResponseData } from 'src/common/response-data';
import { filterDto } from 'src/masters/DTO/search-vessel.dto';
@Auth()
@Controller('payment-request')
export class PaymentRequestController {
  constructor(
    private readonly paymentRequestService: PaymentRequestService,
    private readonly logger: Logger,
  ) {}

  @ApiOperation({ summary: 'Create payment request' })
  @ApiCreatedResponse({ description: 'Payment request created', type: ResponseData })
  @Post('create')
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() payload: any) {
    const resp = new ResponseData();
    try {
      resp.data = await this.paymentRequestService.createPaymentRequest(payload);
      resp.message = 'Payment request created successfully';
    } catch (error) {
      this.logger.warn(`Payment request create error: ${JSON.stringify(error)}`);
      resp.status = false;
      resp.message =
        error instanceof BadRequestException || error instanceof UnauthorizedException
          ? error.message
          : 'Internal Server Error';
    }
    return resp;
  }

  @ApiOperation({ summary: 'Update payment request' })
  @ApiCreatedResponse({ description: 'Payment request updated', type: ResponseData })
  @Patch('update/:paymentRequestSid')
  @HttpCode(HttpStatus.OK)
  async update(
    @Param('paymentRequestSid', ParseIntPipe) paymentRequestSid: number,
    @Body() payload: any,
  ) {
    const resp = new ResponseData();
    try {
      resp.data = await this.paymentRequestService.updatePaymentRequest(paymentRequestSid, payload);
      resp.message = 'Payment request updated successfully';
    } catch (error) {
      this.logger.warn(`Payment request update error: ${JSON.stringify(error)}`);
      resp.status = false;
      resp.message =
        error instanceof BadRequestException || error instanceof UnauthorizedException
          ? error.message
          : 'Internal Server Error';
    }
    return resp;
  }

  @ApiOperation({ summary: 'Fetch payment request by id' })
  @Get('fetch/:paymentRequestSid')
  async fetch(@Param('paymentRequestSid', ParseIntPipe) paymentRequestSid: number) {
    const resp = new ResponseData();
    try {
      resp.data = await this.paymentRequestService.getPaymentRequestById(paymentRequestSid);
      resp.message = 'Payment request fetched successfully';
    } catch (error) {
      this.logger.warn(`Payment request fetch error: ${JSON.stringify(error)}`);
      resp.status = false;
      resp.message =
        error instanceof BadRequestException || error instanceof UnauthorizedException
          ? error.message
          : 'Internal Server Error';
    }
    return resp;
  }

  @ApiOperation({ summary: 'Search payment requests' })
  @Post('search-list')
  @HttpCode(HttpStatus.OK)
  async search(@Body() params: filterDto) {
    const resp = new ResponseData();
    try {
      resp.data = await this.paymentRequestService.searchPaymentRequests(params);
      resp.message = 'Payment request search fetched successfully';
    } catch (error) {
      this.logger.warn(`Payment request search error: ${JSON.stringify(error)}`);
      resp.status = false;
      resp.message =
        error instanceof BadRequestException || error instanceof UnauthorizedException
          ? error.message
          : 'Internal Server Error';
    }
    return resp;
  }

  @ApiOperation({ summary: 'Approved payment requests pending voucher creation' })
  @Get('pending-payment')
  async pendingPayment(
    @Query('CompanyMasterSid') CompanyMasterSid: string,
    @Query('BranchMasterSid') BranchMasterSid: string,
  ) {
    const resp = new ResponseData();
    try {
      resp.data = await this.paymentRequestService.getApprovedPendingForPayment(
        Number(CompanyMasterSid),
        Number(BranchMasterSid),
      );
      resp.message = 'Pending payment requests fetched successfully';
    } catch (error) {
      this.logger.warn(`Pending payment request fetch error: ${JSON.stringify(error)}`);
      resp.status = false;
      resp.message =
        error instanceof BadRequestException || error instanceof UnauthorizedException
          ? error.message
          : 'Internal Server Error';
    }
    return resp;
  }

  @ApiOperation({ summary: 'Link created payment voucher to payment request' })
  @Patch('link-voucher/:paymentRequestSid')
  @HttpCode(HttpStatus.OK)
  async linkVoucher(
    @Param('paymentRequestSid', ParseIntPipe) paymentRequestSid: number,
    @Body() payload: { VoucherSid: number; UpdatedBy?: string },
  ) {
    const resp = new ResponseData();
    try {
      resp.data = await this.paymentRequestService.linkVoucher(
        paymentRequestSid,
        payload.VoucherSid,
        payload.UpdatedBy,
      );
      resp.message = 'Payment request linked to payment voucher successfully';
    } catch (error) {
      this.logger.warn(`Payment request link-voucher error: ${JSON.stringify(error)}`);
      resp.status = false;
      resp.message =
        error instanceof BadRequestException || error instanceof UnauthorizedException
          ? error.message
          : 'Internal Server Error';
    }
    return resp;
  }
}
