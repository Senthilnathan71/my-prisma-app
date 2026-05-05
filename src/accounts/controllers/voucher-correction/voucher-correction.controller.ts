import { BadRequestException, Body, Controller, Get, HttpCode, HttpStatus, Logger, Param, ParseIntPipe, Patch, Post, UnauthorizedException } from '@nestjs/common';
import { ApiCreatedResponse, ApiOperation } from '@nestjs/swagger';
import { ResponseData } from 'src/common/response-data';
import { filterDto } from 'src/masters/DTO/search-vessel.dto';
import { VoucherCorrectionService } from 'src/accounts/services/voucher-correction/voucher-correction.service';
import { Auth } from 'src/common/decorators/auth.decorator';
class CompanyIdDto {
    CompanyMasterSid: number;
    BranchMasterSid: number;
}
@Auth()
@Controller('voucher-correction')
export class VoucherCorrectionController {
    constructor(
        private logger: Logger,
        private voucherCorrectionService: VoucherCorrectionService,
    ) { }

    @ApiOperation({ summary: 'Search List of Voucher Correction' })
    @ApiCreatedResponse({
        description: 'Search List of Voucher Correction',
        type: ResponseData,
    })
    @HttpCode(HttpStatus.OK)
    @Post('search-list')
    async searchVoucher(@Body() searchParams: filterDto) {
        const resp = new ResponseData();
        try {
            const res = await this.voucherCorrectionService.searchVoucher(searchParams);
            this.logger.log(`Voucher Correction Search Data: ${JSON.stringify(res)}`);
            resp.data = res;
            resp.message = 'Voucher Correction Search is Successfully fetched';
        } catch (error) {
            this.logger.warn(`Search Voucher Correction Error: ${error}`);
            resp.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                resp.message = error.message;
            } else {
                resp.message = 'Internal Server Error';
            }
        }
        return resp;
    }

    @ApiOperation({ summary: 'Update Voucher Correction' })
    @ApiCreatedResponse({
        description: 'Update Voucher Correction',
        type: ResponseData,
    })
    @HttpCode(HttpStatus.OK)
    @Patch('update/:VoucherHeaderSid')
    async updateVoucher(
        @Param('VoucherHeaderSid', ParseIntPipe) VoucherHeaderSid: number,
        @Body() payload: any
    ) {
        let resp = new ResponseData();

        try {
            this.logger.log(`Updating voucher ${payload}`);
            const voucher = await this.voucherCorrectionService.updateVoucher(VoucherHeaderSid, payload);
            resp.data = voucher;
            resp.message = "Voucher updated successfully";
        } catch (error) {
            this.logger.warn(`Error updating voucher: ${JSON.stringify(error), error}`);
            resp.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                resp.message = (error as any).message || 'Bad request';
            } else {
                resp.message = 'Internal Server Error';
            }
        }
        return resp;
    }
    @ApiOperation({ summary: 'Fetch Voucher Correction' })
    @ApiCreatedResponse({
        description: 'Fetch Voucher Correction',
        type: ResponseData,
    })
    @Get('fetch/:VoucherHeaderSid')
  async getVoucherById(@Param('VoucherHeaderSid', ParseIntPipe) VoucherHeaderSid: number) {
    const output = new ResponseData();
    try {
      const finalOutput = await this.voucherCorrectionService.findVoucherById(VoucherHeaderSid);
      this.logger.debug(`getVoucherById: ${JSON.stringify(finalOutput)}`);
      output.data = finalOutput;
      output.message = "Voucher data fetched successfully by ID";
    } catch (error) {
      this.logger.warn('getVoucherById error', (error as any)?.stack || (error as any)?.message || error);
      output.status = false;
      if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
        output.message = (error as any).message || 'Bad request';
      } else {
        // return error message/stack only if you want to expose it — here we set the object
        output.message = (error as any) || 'Internal Server Error';
      }
    }
    return output;
  }
}
