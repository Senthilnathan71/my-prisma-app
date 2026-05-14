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
import { Auth } from 'src/common/decorators/auth.decorator';

@Auth()
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

    try {
      const finalOutput = await this.journalVoucherService.createJournalVoucher(payload);

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

    try {
      const finalOutput = await this.journalVoucherService.updateJournalVoucher(VoucherHeaderSid, payload);

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
  @Post('post-voucher')
  async postJournalVoucher(@Body() body: any) {
    const output = new ResponseData();

    try {
      if (!body.VoucherHeaderSid) {
        throw new BadRequestException('Voucher Header SID is required');
      }
      if (!body.CompanyMasterSid) {
        throw new BadRequestException('Company Master SID is required');
      }
      if (!body.BranchMasterSid) {
        throw new BadRequestException('Branch Master SID is required');
      }
      if (!body.YearMasterSid) {
        throw new BadRequestException('Financial year Sid is required');
      }
      if (!body.PostedBy) {
        throw new BadRequestException('Posted By is required');
      }
      const finalOutput = await this.journalVoucherService.postJournalInternal({
        voucherHeaderSid: Number(body.VoucherHeaderSid),
        companyMasterSid: Number(body.CompanyMasterSid),
        branchMasterSid: Number(body.BranchMasterSid),
        yearMasterSid: Number(body.YearMasterSid),
        localCurrencyMasterSid: Number(body.LocalCurrencyMasterSid),
        localCurrencyCode: body.LocalCurrencyCode,
        postedBy: body.PostedBy,
        taxDetails: body.TaxDetails
      });

      output.data = finalOutput;
      output.message = "Journal Voucher posted successfully";
    } catch (error) {
      this.logger.warn(`postVoucher error: ${JSON.stringify(error), error}`);
      output.status = false;
      if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
        output.message = (error as any).message || 'Bad request';
      } else {
        output.message = 'Internal Server Error';
      }
    }
    return output;
  }

  @ApiOperation({ summary: 'Get All journal Vouchers' })
            @ApiCreatedResponse({
              description: 'All journal Vouchers fetched successfully',
              type: ResponseData
            })
            @HttpCode(HttpStatus.OK)
            @Get()
            async getAlljournalVouchers() {
              const output = new ResponseData();
              try {
                const finalOutput = await this.journalVoucherService.fetchjournalVouchers();

                output.data = finalOutput;
                output.message = "All journal Vouchers fetched successfully";
              } catch (error) {
                this.logger.warn('getAlljournalVouchers error', (error as any)?.stack || (error as any)?.message || error);
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