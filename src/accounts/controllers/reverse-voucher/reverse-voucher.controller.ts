import { BadRequestException, Body, Controller, Delete, Get, HttpCode, HttpStatus, Logger, Param, ParseIntPipe, Patch, Post, UnauthorizedException } from '@nestjs/common';
import { ApiOperation, ApiCreatedResponse } from '@nestjs/swagger';
import { PullVoucherDTO } from 'src/accounts/dto/voucher.dto';
import { ResponseData } from 'src/common/response-data';
import { Auth } from 'src/common/decorators/auth.decorator';
import { ReverseVoucherService } from 'src/accounts/services/reverse-voucher/reverse-voucher.service';
class CompanyIdDto {
  CompanyMasterSid: number;
  BranchMasterSid: number;
}
@Auth()
@Controller('reverse-voucher')
export class ReverseVoucherController {
    private readonly logger = new Logger(ReverseVoucherController.name);
    
        constructor(
            private readonly reverseVoucherService: ReverseVoucherService, 
        ){ }
    
        @ApiOperation({ summary: 'Create Reverse Voucher' })
          @ApiCreatedResponse({
            description: 'Reverse Voucher created successfully',
            type: ResponseData
          })
          @HttpCode(HttpStatus.CREATED)
          @Post('create')
          async createReverseVoucher(@Body() payload: any) {
            const output = new ResponseData();

            try {
              const finalOutput = await this.reverseVoucherService.createReverseVoucher(payload);

              output.data = finalOutput;
              output.message = "Reverse Voucher created successfully";
            } catch (error) {
              this.logger.warn('createReverseVoucher error', (error as any)?.stack || (error as any)?.message || error);
              output.status = false;
              if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                output.message = (error as any).message || 'Bad request';
              } else {
                output.message = "Internal Server Error";
              }
            }
            return output;
          }
    
          @ApiOperation({ summary: 'Get All Reverse Vouchers' })
            @ApiCreatedResponse({
              description: 'All Reverse Vouchers fetched successfully',
              type: ResponseData
            })
            @HttpCode(HttpStatus.OK)
            @Get()
            async getAllReverseVouchers() {
              const output = new ResponseData();
              try {
                const finalOutput = await this.reverseVoucherService.fetchReverseVouchers();

                output.data = finalOutput;
                output.message = "All Reverse Vouchers fetched successfully";
              } catch (error) {
                this.logger.warn('getAllReverseVouchers error', (error as any)?.stack || (error as any)?.message || error);
                output.status = false;
                if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                  output.message = (error as any).message || 'Bad request';
                } else {
                  output.message = 'Internal Server Error';
                }
              }
              return output;
            }
    
            @ApiOperation({ summary: 'Get Reverse Voucher by ID' })
              @ApiCreatedResponse({
                description: 'Reverse Voucher data fetched successfully by ID',
                type: ResponseData
              })
              @HttpCode(HttpStatus.OK)
              @Get('fetch/:VoucherHeaderSid')
              async fetchReverseVoucherById(@Param('VoucherHeaderSid', ParseIntPipe) VoucherHeaderSid: number) {
                const output = new ResponseData();
                try {
                  const finalOutput = await this.reverseVoucherService.fetchReverseVoucherById(VoucherHeaderSid);

                  output.data = finalOutput;
                  output.message = "Reverse Voucher data fetched successfully";
                } catch (error) {
                  this.logger.warn(`fetchReverseVoucherById error for ID ${VoucherHeaderSid}`, (error as any)?.stack || (error as any)?.message || error);
                  output.status = false;
                  if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                    output.message = (error as any).message || 'Bad request';
                  } else {
                    output.message = 'Internal Server Error';
                  }
                }
                return output;
              }
    
              @ApiOperation({ summary: 'Update Reverse Voucher by ID' })
                @ApiCreatedResponse({
                  description: 'Reverse Voucher updated successfully',
                  type: ResponseData
                })
                @HttpCode(HttpStatus.OK)
                @Patch('update/:VoucherHeaderSid')
                async updateReverseVoucher(
                  @Param('VoucherHeaderSid', ParseIntPipe) VoucherHeaderSid: number,
                  @Body() payload: any
                ) {
                  const output = new ResponseData();

                  try {
                    const finalOutput = await this.reverseVoucherService.updateReverseVoucher(VoucherHeaderSid, payload);

                    output.data = finalOutput;
                    output.message = "Reverse Voucher updated successfully";
                  } catch (error) {
                    this.logger.warn(`updateReverseVoucher error for ID ${VoucherHeaderSid}`, (error as any)?.stack || (error as any)?.message || error);
                    output.status = false;
                    if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                      output.message = (error as any).message || 'Bad request';
                    } else {
                      output.message = "Internal Server Error";
                    }
                  }
                  return output;
                }
    
                @ApiOperation({ summary: 'Delete Reverse Voucher by ID' })
                  @ApiCreatedResponse({
                    description: 'Reverse Voucherdeleted successfully',
                    type: ResponseData
                  })
                  @HttpCode(HttpStatus.OK)
                  @Delete('deleteVoucher/:VoucherHeaderSid')
                  async deleteReverseVoucher(@Param('VoucherHeaderSid', ParseIntPipe) VoucherHeaderSid: number) {
                    const output = new ResponseData();
                    try {
                      const finalOutput = await this.reverseVoucherService.deleteReverseVoucher(VoucherHeaderSid);

                      output.data = finalOutput;
                      output.message = "Reverse Voucher deleted successfully";
                    } catch (error) {
                      this.logger.warn(`deleteReverseVoucher error for ID ${VoucherHeaderSid}`, (error as any)?.stack || (error as any)?.message || error);
                      output.status = false;
                      if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                        output.message = (error as any).message || 'Bad request';
                      } else {
                        output.message = 'Internal Server Error';
                      }
                    }
                    return output;
                  }
    
    @ApiOperation({ summary: 'Search Reverse Voucher with filters' })
      @ApiCreatedResponse({
        description: 'Reverse Voucher search results',
        type: ResponseData
      })
      @HttpCode(HttpStatus.OK)
      @Post('search-list')
      async searchReverseVouchers(@Body() payload: any) {
        const output = new ResponseData();
        try {
          const finalOutput = await this.reverseVoucherService.searchReverseVouchers(payload);

          output.data = finalOutput;
          output.message = "Reverse Voucher search completed";
        } catch (error) {
          this.logger.warn('searchReverseVouchers error', (error as any)?.stack || (error as any)?.message || error);
          output.status = false;
          if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
            output.message = (error as any).message || 'Bad request';
          } else {
            output.message = 'Internal Server Error';
          }
        }
        return output;
      }
    
      @ApiOperation({ summary: 'Get All Voucher' })
      @ApiCreatedResponse({
        description: 'All Voucher fetched successfully',
        type: ResponseData
      })
      @HttpCode(HttpStatus.OK)
      @Post('voucher')
      async fetchVouchers(@Body() body: CompanyIdDto) {
        const output = new ResponseData();
        try {
          const finalOutput = await this.reverseVoucherService.fetchVouchers(body.CompanyMasterSid, body.BranchMasterSid);

          output.data = finalOutput;
          output.message = "All Vouchers fetched successfully";
        } catch (error) {
          this.logger.warn('fetchVouchers error', (error as any)?.stack || (error as any)?.message || error);
          output.status = false;
          if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
            output.message = (error as any).message || 'Bad request';
          } else {
            output.message = 'Internal Server Error';
          }
        }
        return output;
      }
    
      @ApiOperation({ summary: 'Get Vouchers by ID' })
      @ApiCreatedResponse({
        description: 'Voucher data fetched successfully by ID',
        type: ResponseData
      })
      @HttpCode(HttpStatus.OK)
      @Post('fetch/voucher')
      async fetchVoucherById(@Body() payload: PullVoucherDTO) {
        const output = new ResponseData();
        try {
          const finalOutput = await this.reverseVoucherService.fetchVoucherById(payload);

          output.data = finalOutput;
          output.message = "Voucher data fetched successfully";
        } catch (error) {
          this.logger.warn(`fetchVoucherById error for ID ${payload}`, (error as any)?.stack || (error as any)?.message || error);
          output.status = false;
          if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
            output.message = (error as any).message || 'Bad request';
          } else {
            output.message = 'Internal Server Error';
          }
        }
        return output;
      }

      @Post('post')
@HttpCode(HttpStatus.CREATED)
async postReversalVoucher(
  @Body() payload: any,
) {
  let resp = new ResponseData();

  try {
    const payment = await this.reverseVoucherService.postReversalInternal({
      voucherHeaderSid: Number(payload.VoucherHeaderSid),
      companyMasterSid: Number(payload.CompanyMasterSid),
      branchMasterSid: Number(payload.BranchMasterSid),
      yearMasterSid: Number(payload.YearMasterSid),
      localCurrencyMasterSid: Number(payload.LocalCurrencyMasterSid),
      localCurrencyCode: payload.LocalCurrencyCode,
      postedBy: payload.PostedBy,
      taxDetails: payload.TaxDetails,
    });

    resp.data = payment;
    resp.message = "Reversal voucher posted successfully";
  } catch (error) {
    this.logger.error(`Failed to post reversal voucher: ${error.message}`, error.stack);
    resp.status = false;

    if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
      resp.message = error.message;
    } else {
      resp.message = "Internal Server Error";
    }
  }

  return resp;
}

}
