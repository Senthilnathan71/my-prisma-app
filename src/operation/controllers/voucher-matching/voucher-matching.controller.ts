import { BadRequestException, Body, Controller, Get, HttpCode, HttpStatus, Logger, Param, ParseIntPipe, Post, UnauthorizedException } from '@nestjs/common';
import { ApiOperation, ApiCreatedResponse } from '@nestjs/swagger';
import { ResponseData } from 'src/common/response-data';
import { filterDto } from 'src/masters/DTO/search-vessel.dto';
import { VoucherMatchingService } from 'src/operation/services/voucher-matching/voucher-matching.service';

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
}
