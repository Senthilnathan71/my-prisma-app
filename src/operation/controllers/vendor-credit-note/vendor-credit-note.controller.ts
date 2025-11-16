import { BadRequestException, Body, Controller, Delete, Get, HttpCode, HttpStatus, Logger, Param, ParseIntPipe, Patch, Post, UnauthorizedException } from '@nestjs/common';
import { ApiOperation, ApiCreatedResponse } from '@nestjs/swagger';
import { ResponseData } from 'src/common/response-data';
import { VendorCreditNoteService } from 'src/operation/services/vendor-credit-note/vendor-credit-note.service';

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
        this.logger.log(`createVendorCreditNote payload: ${JSON.stringify(payload)}`);
        try {
          const finalOutput = await this.vendorCreditNoteService.createVendorCreditNote(payload);
          this.logger.debug(`createVendorCreditNote result: ${JSON.stringify(finalOutput)}`);
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
            this.logger.debug(`getAllVendorCreditNotes: returned ${Array.isArray(finalOutput) ? finalOutput.length : 0} items`);
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
              this.logger.debug(`getVendorCreditNoteById: ${VoucherHeaderSid}`);
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
              this.logger.log(`updateVendorCreditNote ID: ${VoucherHeaderSid}, payload: ${JSON.stringify(payload)}`);
              try {
                const finalOutput = await this.vendorCreditNoteService.updateVendorCreditNote(VoucherHeaderSid, payload);
                this.logger.debug(`updateVendorCreditNote result: ${JSON.stringify(finalOutput)}`);
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
                  this.logger.debug(`deleteVendorCreditNote: ${VoucherHeaderSid}`);
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
      this.logger.debug(`searchVendorCreditNotes: returned ${finalOutput?.items?.length || 0} items`);
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
  @Get('vendor-invoice')
  async getAllVendorInvoices() {
    const output = new ResponseData();
    try {
      const finalOutput = await this.vendorCreditNoteService.fetchVendorInvoices();
      this.logger.debug(`getAllVendorInvoices: returned ${Array.isArray(finalOutput) ? finalOutput.length : 0} items`);
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
  @Get('fetch/vendor-invoice/:VoucherHeaderSid')
  async getVendorInvoiceById(@Param('VoucherHeaderSid', ParseIntPipe) VoucherHeaderSid: number) {
    const output = new ResponseData();
    try {
      const finalOutput = await this.vendorCreditNoteService.fetchVendorInvoiceById(VoucherHeaderSid);
      this.logger.debug(`getVendorInvoiceById: ${VoucherHeaderSid}`);
      output.data = finalOutput;
      output.message = "Vendor Invoice data fetched successfully";
    } catch (error) {
      this.logger.warn(`getVendorInvoiceById error for ID ${VoucherHeaderSid}`, (error as any)?.stack || (error as any)?.message || error);
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
