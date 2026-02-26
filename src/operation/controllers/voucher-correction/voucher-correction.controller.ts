import { BadRequestException, Body, Controller, HttpCode, HttpStatus, Logger, Post, UnauthorizedException } from '@nestjs/common';
import { ApiCreatedResponse, ApiOperation } from '@nestjs/swagger';
import { ResponseData } from 'src/common/response-data';
import { filterDto } from 'src/masters/DTO/search-vessel.dto';
import { VoucherCorrectionService } from 'src/operation/services/voucher-correction/voucher-correction.service';
class CompanyIdDto {
  CompanyMasterSid: number;
  BranchMasterSid: number;
}
@Controller('voucher-correction')
export class VoucherCorrectionController {
    constructor(
        private logger: Logger,
        private voucherCorrectionService: VoucherCorrectionService,
    ) {}

    @ApiOperation({ summary: 'Search List of Voucher Correction'})
    @ApiCreatedResponse({
        description: 'Search List of Voucher Correction',
        type: ResponseData,
    })
    @HttpCode(HttpStatus.OK)
    @Post('search-list')
    async searchVoucher(@Body() searchParams: filterDto) {
        const resp = new ResponseData();
        try{
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
}
