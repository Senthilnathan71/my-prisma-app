import { 
  BadRequestException, 
  Body, 
  Controller, 
  Delete, 
  Get, 
  HttpCode, 
  HttpStatus, 
  Logger, 
  Param, 
  ParseIntPipe, 
  Patch, 
  Post, 
  UnauthorizedException 
} from '@nestjs/common';
import { ApiOperation, ApiCreatedResponse } from '@nestjs/swagger';
import { ResponseData } from 'src/common/response-data';
import { JournalVoucherService } from 'src/accounts/services/journal-voucher/journal-voucher.service';

@Controller('accounts/journal-voucher')
export class JournalVoucherController {
  private readonly logger = new Logger(JournalVoucherController.name);

  constructor(
    private readonly journalVoucherService: JournalVoucherService,
  ) { }

  @ApiOperation({ summary: 'Create Journal Voucher' })
  @ApiCreatedResponse({
    description: 'Journal Voucher created successfully',
    type: ResponseData
  })
  @HttpCode(HttpStatus.CREATED)
  @Post('create')
  async createJournalVoucher(@Body() payload: any) {
    const output = new ResponseData();
    this.logger.log(`createJournalVoucher payload: ${JSON.stringify(payload)}`);
    try {
      const finalOutput = await this.journalVoucherService.createJournalVoucher(payload);
      this.logger.debug(`createJournalVoucher result: ${JSON.stringify(finalOutput)}`);
      output.data = finalOutput;
      output.message = "Journal Voucher created successfully";
    } catch (error) {
      this.logger.warn('createJournalVoucher error', (error as any)?.stack || (error as any)?.message || error);
      output.status = false;
      if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
        output.message = (error as any).message || 'Bad request';
      } else {
        output.message = "Internal Server Error";
      }
    }
    return output;
  }

  @ApiOperation({ summary: 'Get All Journal Vouchers' })
  @ApiCreatedResponse({
    description: 'All Journal Vouchers fetched successfully',
    type: ResponseData
  })
  @HttpCode(HttpStatus.OK)
  @Get()
  async getAllJournalVouchers() {
    const output = new ResponseData();
    try {
      const finalOutput = await this.journalVoucherService.fetchJournalVouchers();
      this.logger.debug(`getAllJournalVouchers: returned ${Array.isArray(finalOutput) ? finalOutput.length : 0} items`);
      output.data = finalOutput;
      output.message = "All Journal Vouchers fetched successfully";
    } catch (error) {
      this.logger.warn('getAllJournalVouchers error', (error as any)?.stack || (error as any)?.message || error);
      output.status = false;
      if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
        output.message = (error as any).message || 'Bad request';
      } else {
        output.message = 'Internal Server Error';
      }
    }
    return output;
  }

  @ApiOperation({ summary: 'Get Journal Voucher by ID' })
  @ApiCreatedResponse({
    description: 'Journal Voucher data fetched successfully by ID',
    type: ResponseData
  })
  @HttpCode(HttpStatus.OK)
  @Get('fetch/:VoucherHeaderSid')
  async getJournalVoucherById(@Param('VoucherHeaderSid', ParseIntPipe) VoucherHeaderSid: number) {
    const output = new ResponseData();
    try {
      const finalOutput = await this.journalVoucherService.fetchJournalVoucherById(VoucherHeaderSid);
      this.logger.debug(`getJournalVoucherById: ${VoucherHeaderSid}`);
      output.data = finalOutput;
      output.message = "Journal Voucher data fetched successfully";
    } catch (error) {
      this.logger.warn(`getJournalVoucherById error for ID ${VoucherHeaderSid}`, (error as any)?.stack || (error as any)?.message || error);
      output.status = false;
      if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
        output.message = (error as any).message || 'Bad request';
      } else {
        output.message = 'Internal Server Error';
      }
    }
    return output;
  }

  @ApiOperation({ summary: 'Update Journal Voucher by ID' })
  @ApiCreatedResponse({
    description: 'Journal Voucher updated successfully',
    type: ResponseData
  })
  @HttpCode(HttpStatus.OK)
  @Patch('update/:VoucherHeaderSid')
  async updateJournalVoucher(
    @Param('VoucherHeaderSid', ParseIntPipe) VoucherHeaderSid: number,
    @Body() payload: any
  ) {
    const output = new ResponseData();
    this.logger.log(`updateJournalVoucher ID: ${VoucherHeaderSid}, payload: ${JSON.stringify(payload)}`);
    try {
      const finalOutput = await this.journalVoucherService.updateJournalVoucher(VoucherHeaderSid, payload);
      this.logger.debug(`updateJournalVoucher result: ${JSON.stringify(finalOutput)}`);
      output.data = finalOutput;
      output.message = "Journal Voucher updated successfully";
    } catch (error) {
      this.logger.warn(`updateJournalVoucher error for ID ${VoucherHeaderSid}`, (error as any)?.stack || (error as any)?.message || error);
      output.status = false;
      if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
        output.message = (error as any).message || 'Bad request';
      } else {
        output.message = "Internal Server Error";
      }
    }
    return output;
  }

  @ApiOperation({ summary: 'Delete Journal Voucher by ID' })
  @ApiCreatedResponse({
    description: 'Journal Voucher deleted successfully',
    type: ResponseData
  })
  @HttpCode(HttpStatus.OK)
  @Delete('deleteVoucher/:VoucherHeaderSid')
  async deleteJournalVoucher(@Param('VoucherHeaderSid', ParseIntPipe) VoucherHeaderSid: number) {
    const output = new ResponseData();
    try {
      const finalOutput = await this.journalVoucherService.deleteJournalVoucher(VoucherHeaderSid);
      this.logger.debug(`deleteJournalVoucher: ${VoucherHeaderSid}`);
      output.data = finalOutput;
      output.message = "Journal Voucher deleted successfully";
    } catch (error) {
      this.logger.warn(`deleteJournalVoucher error for ID ${VoucherHeaderSid}`, (error as any)?.stack || (error as any)?.message || error);
      output.status = false;
      if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
        output.message = (error as any).message || 'Bad request';
      } else {
        output.message = 'Internal Server Error';
      }
    }
    return output;
  }

  @ApiOperation({ summary: 'Search Journal Vouchers with filters' })
  @ApiCreatedResponse({
    description: 'Journal Vouchers search results',
    type: ResponseData
  })
  @HttpCode(HttpStatus.OK)
  @Post('search-list')
  async searchJournalVouchers(@Body() payload: any) {
    const output = new ResponseData();
    try {
      const finalOutput = await this.journalVoucherService.searchJournalVouchers(payload);
      this.logger.debug(`searchJournalVouchers: returned ${finalOutput?.items?.length || 0} items`);
      output.data = finalOutput;
      output.message = "Journal Vouchers search completed";
    } catch (error) {
      this.logger.warn('searchJournalVouchers error', (error as any)?.stack || (error as any)?.message || error);
      output.status = false;
      if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
        output.message = (error as any).message || 'Bad request';
      } else {
        output.message = 'Internal Server Error';
      }
    }
    return output;
  }

  @ApiOperation({ summary: 'Post Journal Voucher' })
  @ApiCreatedResponse({
    description: 'Journal Voucher posted successfully',
    type: ResponseData
  })
  @HttpCode(HttpStatus.OK)
  @Post('post/:VoucherHeaderSid')
  async postJournalVoucher(@Param('VoucherHeaderSid', ParseIntPipe) VoucherHeaderSid: number) {
    const output = new ResponseData();
    try {
      const finalOutput = await this.journalVoucherService.postJournalVoucher(VoucherHeaderSid);
      this.logger.debug(`postJournalVoucher: ${VoucherHeaderSid}`);
      output.data = finalOutput;
      output.message = "Journal Voucher posted successfully";
    } catch (error) {
      this.logger.warn(`postJournalVoucher error for ID ${VoucherHeaderSid}`, (error as any)?.stack || (error as any)?.message || error);
      output.status = false;
      if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
        output.message = (error as any).message || 'Bad request';
      } else {
        output.message = 'Internal Server Error';
      }
    }
    return output;
  }
}