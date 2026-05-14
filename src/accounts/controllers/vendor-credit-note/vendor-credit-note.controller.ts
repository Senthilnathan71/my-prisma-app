import { BadRequestException, Body, Controller, Delete, Get, HttpCode, HttpStatus, Logger, NotFoundException, Param, ParseIntPipe, Patch, Post, UnauthorizedException, UsePipes, ValidationPipe } from '@nestjs/common';
import { ApiOperation, ApiCreatedResponse } from '@nestjs/swagger';
import { PullVoucherDTO } from 'src/accounts/dto/voucher.dto';
import { VendorCreditNoteService } from 'src/accounts/services/vendor-credit-note/vendor-credit-note.service';
import { Auth } from 'src/common/decorators/auth.decorator';
import { ResponseData } from 'src/common/response-data';
class CompanyIdDto {
  CompanyMasterSid: number;
  BranchMasterSid: number;
}
@Auth()
@Controller('vendor-credit-note')
export class VendorCreditNoteController {
    private readonly logger = new Logger(VendorCreditNoteController.name);

    constructor(
        private readonly vendorCreditNoteService: VendorCreditNoteService, 
    ){ }

    @ApiOperation({ summary: 'Create Vendor CreditNote' })
      @ApiCreatedResponse({
        description: 'Vendor CreditNote created successfully with TDS',
        type: ResponseData
      })
      @HttpCode(HttpStatus.CREATED)
      @Post('create')
      async createVendorCreditNote(@Body() payload: any) {
        const output = new ResponseData();

        try {
          const finalOutput = await this.vendorCreditNoteService.createVendorCreditNote(payload);

          output.data = finalOutput;
          output.message = "Vendor CreditNote created successfully";
        } catch (error) {
          this.logger.warn('createVendorCreditNote error', (error as any)?.stack || (error as any)?.message || error);
          output.status = false;
          if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
            output.message = (error as any).message || 'Bad request';
          } else {
            output.message = "Internal Server Error";
          }
        }
        return output;
      }

      @ApiOperation({ summary: 'Get All Vendor CreditNotes' })
        @ApiCreatedResponse({
          description: 'All Vendor CreditNotes fetched successfully',
          type: ResponseData
        })
        @HttpCode(HttpStatus.OK)
        @Get()
        async getAllVendorCreditNotes() {
          const output = new ResponseData();
          try {
            const finalOutput = await this.vendorCreditNoteService.fetchVendorCreditNotes();

            output.data = finalOutput;
            output.message = "All Vendor CreditNotes fetched successfully";
          } catch (error) {
            this.logger.warn('getAllVendorCreditNotes error', (error as any)?.stack || (error as any)?.message || error);
            output.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
              output.message = (error as any).message || 'Bad request';
            } else {
              output.message = 'Internal Server Error';
            }
          }
          return output;
        }

        @ApiOperation({ summary: 'Get Vendor CreditNote by ID' })
          @ApiCreatedResponse({
            description: 'Vendor CreditNote data fetched successfully by ID',
            type: ResponseData
          })
          @HttpCode(HttpStatus.OK)
          @Get('fetch/:VoucherHeaderSid')
          async getVendorCreditNoteById(@Param('VoucherHeaderSid', ParseIntPipe) VoucherHeaderSid: number) {
            const output = new ResponseData();
            try {
              const finalOutput = await this.vendorCreditNoteService.fetchVendorCreditNoteById(VoucherHeaderSid);

              output.data = finalOutput;
              output.message = "Vendor CreditNote data fetched successfully";
            } catch (error) {
              this.logger.warn(`getVendorCreditNoteById error for ID ${VoucherHeaderSid}`, (error as any)?.stack || (error as any)?.message || error);
              output.status = false;
              if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                output.message = (error as any).message || 'Bad request';
              } else {
                output.message = 'Internal Server Error';
              }
            }
            return output;
          }

          @ApiOperation({ summary: 'Update Vendor CreditNote by ID' })
            @ApiCreatedResponse({
              description: 'Vendor CreditNote updated successfully',
              type: ResponseData
            })
            @HttpCode(HttpStatus.OK)
            @Patch('update/:VoucherHeaderSid')
            async updateVendorCreditNote(
              @Param('VoucherHeaderSid', ParseIntPipe) VoucherHeaderSid: number,
              @Body() payload: any
            ) {
              const output = new ResponseData();

              try {
                const finalOutput = await this.vendorCreditNoteService.updateVendorCreditNote(VoucherHeaderSid, payload);

                output.data = finalOutput;
                output.message = "Vendor CreditNote updated successfully";
              } catch (error) {
                this.logger.warn(`updateVendorCreditNote error for ID ${VoucherHeaderSid}`, (error as any)?.stack || (error as any)?.message || error);
                output.status = false;
                if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                  output.message = (error as any).message || 'Bad request';
                } else {
                  output.message = "Internal Server Error";
                }
              }
              return output;
            }

            @ApiOperation({ summary: 'Delete Vendor CreditNote by ID' })
              @ApiCreatedResponse({
                description: 'Vendor CreditNote deleted successfully',
                type: ResponseData
              })
              @HttpCode(HttpStatus.OK)
              @Delete('deleteVoucher/:VoucherHeaderSid')
              async deleteVendorCreditNote(@Param('VoucherHeaderSid', ParseIntPipe) VoucherHeaderSid: number) {
                const output = new ResponseData();
                try {
                  const finalOutput = await this.vendorCreditNoteService.deleteVendorCreditNote(VoucherHeaderSid);

                  output.data = finalOutput;
                  output.message = "Vendor CreditNote deleted successfully";
                } catch (error) {
                  this.logger.warn(`deleteVendorCreditNote error for ID ${VoucherHeaderSid}`, (error as any)?.stack || (error as any)?.message || error);
                  output.status = false;
                  if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                    output.message = (error as any).message || 'Bad request';
                  } else {
                    output.message = 'Internal Server Error';
                  }
                }
                return output;
              }

@ApiOperation({ summary: 'Search Vendor CreditNotes with filters' })
  @ApiCreatedResponse({
    description: 'Vendor CreditNotes search results',
    type: ResponseData
  })
  @HttpCode(HttpStatus.OK)
  @Post('search-list')
  async searchVendorCreditNotes(@Body() payload: any) {
    const output = new ResponseData();
    try {
      const finalOutput = await this.vendorCreditNoteService.searchVendorCreditNotes(payload);

      output.data = finalOutput;
      output.message = "Vendor CreditNotes search completed";
    } catch (error) {
      this.logger.warn('searchVendorCreditNotes error', (error as any)?.stack || (error as any)?.message || error);
      output.status = false;
      if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
        output.message = (error as any).message || 'Bad request';
      } else {
        output.message = 'Internal Server Error';
      }
    }
    return output;
  }

  @ApiOperation({ summary: 'Get All Vendor Invoices' })
  @ApiCreatedResponse({
    description: 'All Vendor Invoices fetched successfully',
    type: ResponseData
  })
  @HttpCode(HttpStatus.OK)
  @Post('vendor-invoice')
  async getAllVendorInvoices(@Body() body: CompanyIdDto) {
    const output = new ResponseData();
    try {
      const finalOutput = await this.vendorCreditNoteService.fetchVendorInvoices(body.CompanyMasterSid);

      output.data = finalOutput;
      output.message = "All Vendor Invoices fetched successfully";
    } catch (error) {
      this.logger.warn('getAllVendorInvoices error', (error as any)?.stack || (error as any)?.message || error);
      output.status = false;
      if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
        output.message = (error as any).message || 'Bad request';
      } else {
        output.message = 'Internal Server Error';
      }
    }
    return output;
  }

  @ApiOperation({ summary: 'Get Vendor Invoice by ID' })
  @ApiCreatedResponse({
    description: 'Vendor Invoice data fetched successfully by ID',
    type: ResponseData
  })
  @HttpCode(HttpStatus.OK)
  @UsePipes(new ValidationPipe({
    transform: true,
    whitelist: true,
    forbidNonWhitelisted: true,
  }))
  @Post('fetch/vendor-invoice')
  async getVendorInvoiceById(@Body() payload : PullVoucherDTO) {
    const output = new ResponseData();
    try {
      const finalOutput = await this.vendorCreditNoteService.fetchVendorInvoice(payload);

      output.data = finalOutput;
      output.message = "Vendor Invoice data fetched successfully";
    } catch (error) {
      this.logger.warn(`Get Vendor Invoice Error : ${JSON.stringify(error),error.message} `);
      output.status = false;
      if (error instanceof BadRequestException || error instanceof UnauthorizedException || error instanceof NotFoundException) {
        output.message = (error as any).message || 'Bad request';
      } else {
        output.message = 'Internal Server Error';
      }
    }
    return output;
  }
}
