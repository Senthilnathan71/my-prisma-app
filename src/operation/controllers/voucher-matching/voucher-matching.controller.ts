import { BadRequestException, Body, Controller, Get, HttpCode, HttpStatus, Logger, Param, ParseIntPipe, Post, UnauthorizedException, UsePipes, ValidationPipe } from '@nestjs/common';
import { ApiOperation, ApiCreatedResponse } from '@nestjs/swagger';
import { ResponseData } from 'src/common/response-data';
import { filterDto } from 'src/masters/DTO/search-vessel.dto';
import { VoucherMatchingService } from 'src/operation/services/voucher-matching/voucher-matching.service';
import { SearchPostedVouchersDto, CreateStandaloneVoucherMatchingDto, UpdateStandaloneVoucherMatchingDto, FetchVoucherMatchingByIdDto, PostVoucherMatchingDto } from 'src/accounts/dto/voucher-matching.dto';

@Controller('voucher-matching')
export class VoucherMatchingController {

  constructor(
    private logger: Logger,
    private voucherMatchingService: VoucherMatchingService,
  ) { }


  @ApiOperation({ summary: 'Search List of Voucher Matching' })
  @ApiCreatedResponse({
    description: 'Search List of Voucher Matching',
    type: ResponseData,
  })
  @HttpCode(HttpStatus.OK)
  @Post('search-list')
  @UsePipes(new ValidationPipe({ transform: true }))
  async searchVoucherMatching(@Body() searchParams: filterDto) {
    const resp = new ResponseData();
    try {
      const res = await this.voucherMatchingService.searchVoucherMatching(searchParams);
      this.logger.log(`Voucher Matching Search Data: ${JSON.stringify(res)}`);
      resp.data = res;
      resp.message = 'Voucher Matching Search is successfully fetched';
    } catch (error) {
      this.logger.warn(`Search Voucher Matching Error: ${error}`);
      resp.status = false;
      if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
        resp.message = error.message;
      } else {
        resp.message = 'Internal Server Error';
      }
    }
    return resp;
  }

  @ApiOperation({ summary: 'Get Voucher Matching by ID' })
  @ApiCreatedResponse({
    description: 'Voucher Matching data fetched successfully by ID',
    type: ResponseData
  })
  @HttpCode(HttpStatus.OK)
  @Get('fetch/:voucherMatchingHeaderSid')
  async getVoucherMatchingById(@Param('voucherMatchingHeaderSid', ParseIntPipe) voucherMatchingHeaderSid: number) {
    const output = new ResponseData();
    try {
      const finalOutput = await this.voucherMatchingService.getVoucherMatchingById(voucherMatchingHeaderSid);
      this.logger.debug(`getVoucherMatchingById: ${JSON.stringify(finalOutput)}`);
      output.data = finalOutput;
      output.message = "Voucher Matching data fetched successfully by ID";
    } catch (error) {
      this.logger.warn('getVoucherMatchingById error', (error as any)?.stack || (error as any)?.message || error);
      output.status = false;
      if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
        output.message = (error as any).message || 'Bad request';
      } else {
        output.message = (error as any) || 'Internal Server Error';
      }
    }
    return output;
  }

  @ApiOperation({ summary: 'Search posted vouchers (Receipt/Payment) for matching' })
  @ApiCreatedResponse({
    description: 'Posted vouchers fetched successfully',
    type: ResponseData,
  })
  @HttpCode(HttpStatus.OK)
  @Post('search-posted-vouchers')
  @UsePipes(new ValidationPipe({ transform: true }))
  async searchPostedVouchers(@Body() searchParams: SearchPostedVouchersDto) {
    const resp = new ResponseData();
    try {
      const res = await this.voucherMatchingService.searchPostedVouchers(searchParams);
      resp.data = res;
      resp.message = 'Posted vouchers fetched successfully';
    } catch (error) {
      this.logger.warn(`searchPostedVouchers Error: ${error}`);
      resp.status = false;
      if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
        resp.message = error.message;
      } else {
        resp.message = 'Internal Server Error';
      }
    }
    return resp;
  }

  @ApiOperation({ summary: 'Get posted voucher with details' })
  @ApiCreatedResponse({
    description: 'Posted voucher details fetched successfully',
    type: ResponseData,
  })
  @HttpCode(HttpStatus.OK)
  @Get('posted-voucher/:voucherHeaderSid')
  async getPostedVoucherWithDetails(@Param('voucherHeaderSid', ParseIntPipe) voucherHeaderSid: number) {
    const resp = new ResponseData();
    try {
      const res = await this.voucherMatchingService.getPostedVoucherWithDetails(voucherHeaderSid);
      resp.data = res;
      resp.message = 'Posted voucher details fetched successfully';
    } catch (error) {
      this.logger.warn(`getPostedVoucherWithDetails Error: ${error}`);
      resp.status = false;
      if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
        resp.message = error.message;
      } else {
        resp.message = 'Internal Server Error';
      }
    }
    return resp;
  }

  @ApiOperation({ summary: 'Create standalone voucher matching' })
  @ApiCreatedResponse({
    description: 'Voucher matching created successfully',
    type: ResponseData,
  })
  @HttpCode(HttpStatus.CREATED)
  @Post('create')
  @UsePipes(new ValidationPipe({
    whitelist: true,
    transform: true,
    forbidNonWhitelisted: true
  }))
  async createStandaloneVoucherMatching(@Body() dto: CreateStandaloneVoucherMatchingDto) {
    const resp = new ResponseData();
    try {
      const res = await this.voucherMatchingService.createStandaloneVoucherMatching(dto);
      resp.data = res;
      resp.message = 'Voucher matching created successfully';
    } catch (error) {
      this.logger.warn(`createStandaloneVoucherMatching Error: ${error}`);
      resp.status = false;
      if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
        resp.message = error.message;
      } else {
        resp.message = 'Internal Server Error';
      }
    }
    return resp;
  }

  @ApiOperation({ summary: 'Update standalone voucher matching' })
  @ApiCreatedResponse({
    description: 'Voucher matching updated successfully',
    type: ResponseData,
  })
  @HttpCode(HttpStatus.OK)
  @Post('update')
  @UsePipes(new ValidationPipe({
    whitelist: true,
    transform: true,
    forbidNonWhitelisted: true
  }))
  async updateStandaloneVoucherMatching(@Body() dto: UpdateStandaloneVoucherMatchingDto) {
    const resp = new ResponseData();
    try {
      const res = await this.voucherMatchingService.updateStandaloneVoucherMatching(dto);
      resp.data = res;
      resp.message = 'Voucher matching updated successfully';
    } catch (error) {
      this.logger.warn(`updateStandaloneVoucherMatching Error: ${error}`);
      resp.status = false;
      if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
        resp.message = error.message;
      } else {
        resp.message = 'Internal Server Error';
      }
    }
    return resp;
  }

  @ApiOperation({ summary: 'Fetch voucher matching by ID with details' })
  @ApiCreatedResponse({
    description: 'Voucher matching fetched successfully',
    type: ResponseData,
  })
  @HttpCode(HttpStatus.OK)
  @Post('fetch-by-id')
  @UsePipes(new ValidationPipe({
    whitelist: true,
    transform: true,
    forbidNonWhitelisted: true
  }))
  async fetchVoucherMatchingById(@Body() dto: FetchVoucherMatchingByIdDto) {
    const resp = new ResponseData();
    try {
      const res = await this.voucherMatchingService.fetchVoucherMatchingById(dto);
      resp.data = res;
      resp.message = 'Voucher matching fetched successfully';
    } catch (error) {
      this.logger.warn(`fetchVoucherMatchingById Error: ${error}`);
      resp.status = false;
      if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
        resp.message = error.message;
      } else {
        resp.message = 'Internal Server Error';
      }
    }
    return resp;
  }

  @ApiOperation({ summary: 'Post voucher matching' })
  @ApiCreatedResponse({
    description: 'Voucher matching posted successfully',
    type: ResponseData,
  })
  @HttpCode(HttpStatus.OK)
  @Post('post')
  @UsePipes(new ValidationPipe({
    whitelist: true,
    transform: true,
    forbidNonWhitelisted: true
  }))
  async postVoucherMatching(@Body() dto: PostVoucherMatchingDto) {
    const resp = new ResponseData();
    try {
      const res = await this.voucherMatchingService.postVoucherMatching(dto);
      resp.data = res;
      resp.message = 'Voucher matching posted successfully';
    } catch (error) {
      this.logger.warn(`postVoucherMatching Error: ${error}`);
      resp.status = false;
      if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
        resp.message = error.message;
      } else {
        resp.message = 'Internal Server Error';
      }
    }
    return resp;
  }
}
