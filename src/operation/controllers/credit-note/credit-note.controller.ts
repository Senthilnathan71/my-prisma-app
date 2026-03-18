import { BadRequestException, Body, Controller, Delete, Get, HttpCode, HttpStatus, Logger, NotFoundException, Param, ParseIntPipe, Patch, Post, Query, UnauthorizedException, UsePipes, ValidationPipe } from '@nestjs/common';
import { ApiOperation, ApiCreatedResponse } from '@nestjs/swagger';
import { PullVoucherDTO } from 'src/accounts/dto/voucher.dto';
import { ResponseData } from 'src/common/response-data';
import { EmailService } from 'src/email/email.service';
import { filterDto } from 'src/masters/DTO/search-vessel.dto';
import { CreditNoteService } from 'src/operation/services/credit-note/credit-note.service';
class CompanyIdDto {
  CompanyMasterSid: number;
  BranchMasterSid: number;
}

@Controller('credit-note')
export class CreditNoteController {
    private readonly logger = new Logger(CreditNoteController.name);
    constructor(
        private readonly creditNoteService: CreditNoteService,
        private readonly emailService: EmailService,
      ) { }
    
      @ApiOperation({ summary: 'Create CreditNote' })
      @ApiCreatedResponse({
        description: 'VoucherHeader, VoucherDetail, VoucherOthers,created successfully',
        type: ResponseData
      })
      @HttpCode(HttpStatus.CREATED)
      @Post('create')
      async createCreditNote(@Body() payload: any) {
        const output = new ResponseData();
        this.logger.log(`createCreditNote payload: ${JSON.stringify(payload)}`);
        try {
          const finalOutput = await this.creditNoteService.createCreditNote(payload);
          this.logger.debug(`createCreditNote result: ${JSON.stringify(finalOutput)}`);
          output.data = finalOutput;
          output.message = "VoucherHeader created successfully";
        } catch (error) {
          // Log full error object (message + stack) for debugging
          this.logger.warn('createCreditNote error', (error as any)?.stack || (error as any)?.message || error);
          output.status = false;
          if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
            output.message = (error as any).message || 'Bad request';
          } else {
            output.message = "Internal Server Error";
          }
        }
        return output;
      }

      @ApiOperation({ summary: 'Get All Invoices' })
  @ApiCreatedResponse({
    description: 'All Invoices fetched successfully',
    type: ResponseData
  })
  @HttpCode(HttpStatus.OK)
  @Post('invoice')
  async getAllInvoices(@Body() body: CompanyIdDto) {
    const output = new ResponseData();
    try {
      const finalOutput = await this.creditNoteService.allInvoices(body.CompanyMasterSid);
      this.logger.debug(`getAllInvoices: returned ${Array.isArray(finalOutput) ? finalOutput.length : 0} items`);
      output.data = finalOutput;
      output.message = "All Invoices fetched successfully";
    } catch (error) {
      this.logger.warn('getAllInvoices error', (error as any)?.stack || (error as any)?.message || error);
      output.status = false;
      if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
        output.message = (error as any).message || 'Bad request';
      } else {
        output.message = 'Internal Server Error';
      }
    }
    return output;
  }

  @ApiOperation({ summary: 'Get Invoice by ID' })
  @ApiCreatedResponse({
    description: 'Invoice data fetched successfully by ID',
    type: ResponseData
  })
  @HttpCode(HttpStatus.OK)
  // route uses lowercase param name - keep it consistent here
  @Get('fetch/invoice/:voucherHeaderSid')
  async getInvoiceById(@Param('voucherHeaderSid', ParseIntPipe) voucherHeaderSid: number) {
    const output = new ResponseData();
    try {
      const finalOutput = await this.creditNoteService.findInvoiceById(voucherHeaderSid);
      this.logger.debug(`getVoucherHeaderById: ${JSON.stringify(finalOutput)}`);
      output.data = finalOutput;
      output.message = "Invoice data fetched successfully by ID";
    } catch (error) {
      this.logger.warn('getVoucherHeaderById error', (error as any)?.stack || (error as any)?.message || error);
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
    
      @ApiOperation({ summary: 'Get All CreditNotes' })
      @ApiCreatedResponse({
        description: 'All CreditNotes fetched successfully',
        type: ResponseData
      })
      @HttpCode(HttpStatus.OK)
      @Get()
      async fetchCreditNotes() {
        const output = new ResponseData();
        try {
          const finalOutput = await this.creditNoteService.fetchCreditNotes();
          this.logger.debug(`getAllCreditNotes: returned ${Array.isArray(finalOutput) ? finalOutput.length : 0} items`);
          output.data = finalOutput;
          output.message = "All CreditNotes fetched successfully";
        } catch (error) {
          this.logger.warn('getAllCreditNotes error', (error as any)?.stack || (error as any)?.message || error);
          output.status = false;
          if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
            output.message = (error as any).message || 'Bad request';
          } else {
            output.message = 'Internal Server Error';
          }
        }
        return output;
      }
    
      @ApiOperation({ summary: 'Get CreditNote by ID' })
      @ApiCreatedResponse({
        description: 'CreditNote data fetched successfully by ID',
        type: ResponseData
      })
      @HttpCode(HttpStatus.OK)
      // route uses lowercase param name - keep it consistent here
      @Get('fetch/:voucherHeaderSid')
      async getVoucherHeaderById(@Param('voucherHeaderSid', ParseIntPipe) voucherHeaderSid: number) {
        const output = new ResponseData();
        try {
          const finalOutput = await this.creditNoteService.findVoucherHeaderById(voucherHeaderSid);
          this.logger.debug(`getVoucherHeaderById: ${JSON.stringify(finalOutput)}`);
          output.data = finalOutput;
          output.message = "CreditNote data fetched successfully by ID";
        } catch (error) {
          this.logger.warn('getVoucherHeaderById error', (error as any)?.stack || (error as any)?.message || error);
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
    
      @ApiOperation({ summary: 'Update CreditNote' })
      @ApiCreatedResponse({
        description: 'VoucherHeader, VoucherDetail, VoucherOthers updated successfully',
        type: ResponseData
      })
      @HttpCode(HttpStatus.OK)
      @Patch('update/:voucherHeaderSid')
      async updateVoucherHeader(
        @Param('voucherHeaderSid', ParseIntPipe) voucherHeaderSid: number,
        @Body() payload: any
      ) {
        const output = new ResponseData();
        try {
          const finalOutput = await this.creditNoteService.updateVoucherHeaderById(voucherHeaderSid, payload);
          this.logger.debug(`updateVoucherHeader: ${JSON.stringify(finalOutput)}`);
          output.data = finalOutput;
          output.message = "CreditNote updated successfully";
        } catch (error) {
          this.logger.warn('updateVoucherHeader error', (error as any)?.stack || (error as any)?.message || error);
          output.status = false;
          if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
            output.message = (error as any).message || 'Bad request';
          } else {
            output.message = (error as any) || 'Internal Server Error';
          }
        }
        return output;
      }
    
      @ApiOperation({ summary: 'Delete CreditNote By ID' })
      @ApiCreatedResponse({
        description: 'CreditNote deleted successfully',
        type: ResponseData
      })
      @Delete('deleteVoucher/:voucherHeaderSid')
      async deleteVoucherHeader(@Param('voucherHeaderSid', ParseIntPipe) voucherHeaderSid: number) {
        const output = new ResponseData();
        try {
          const booking = await this.creditNoteService.deleteVoucherHeader(voucherHeaderSid);
          this.logger.debug(`deleteVoucherHeader: ${voucherHeaderSid}`);
          output.data = booking;
          output.message = "CreditNote deleted successfully";
        } catch (error) {
          this.logger.warn('deleteVoucherHeader error', (error as any)?.stack || (error as any)?.message || error);
          output.status = false;
          if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
            output.message = (error as any).message || 'Bad request';
          } else {
            output.message = (error as any) || 'Internal Server Error';
          }
        }
        return output;
      }
    
      @ApiOperation({ summary: 'Search List of CreditNotes' })
      @ApiCreatedResponse({
        description: 'Search List of CreditNotes',
        type: ResponseData
      })
      @HttpCode(HttpStatus.OK)
      @Post('search-list')
      async searchBooking(@Body() payload: filterDto) {
        const resp = new ResponseData();
        try {
          const searchOutput = await this.creditNoteService.searchVoucherHeader(payload);
          this.logger.log(`CreditNote Search Result : ${JSON.stringify(searchOutput)}`);
          resp.data = searchOutput;
          resp.message = "CreditNote Search is successfully fetched";
        } catch (error) {
          this.logger.warn('CreditNote Search Error :', (error as any)?.stack || (error as any)?.message || error);
          resp.status = false;
          if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
            resp.message = (error as any).message || 'Bad request';
          } else {
            resp.message = "Internal Server Error";
          }
        }
        return resp;
      }

      @ApiOperation({ summary: 'Get Invoice by Voucher Number with outstanding deduction' })
      @ApiCreatedResponse({
        description: 'Invoice data fetched successfully with outstanding deduction',
        type: ResponseData
      })
      @HttpCode(HttpStatus.OK)
      @UsePipes(new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true,
      }))
      @Post('fetch/invoice')
      async getInvoiceByNumber(@Body() payload: PullVoucherDTO) {
        const output = new ResponseData();
        try {
          const finalOutput = await this.creditNoteService.fetchInvoice(payload);
          this.logger.debug(`getting Invoice: ${payload.VoucherNumber}`);
          output.data = finalOutput;
          output.message = "Invoice data fetched successfully";
        } catch (error) {
          this.logger.warn(`Get Invoice Error : ${JSON.stringify(error),error.message} `);
          output.status = false;
          if (error instanceof BadRequestException || error instanceof UnauthorizedException || error instanceof NotFoundException) {
            output.message = (error as any).message || 'Bad request';
          } else {
            output.message = 'Internal Server Error';
          }
        }
        return output;
      }

      @ApiOperation({ summary: 'Get Audit Logs for a Table/Record' })
            @ApiCreatedResponse({ description: 'Fetch audit logs', type: ResponseData })
            @HttpCode(HttpStatus.OK)
            @Get('audit-logs')
            async getAuditLogs(
              @Query('tableName') tableName: string,
              @Query('recordId') recordId?: string,
            ) {
              const resp = new ResponseData();
              try {
                if (!tableName) throw new Error('tableName query parameter is required');
          
                const logs = await this.creditNoteService.getAuditLogs(tableName, recordId);
          
                // Remove updatedOn from oldVal and newVal
                resp.data = logs.map((log: any) => {
                  const oldVal = log.oldVal ? { ...log.oldVal } : null;
                  const newVal = log.newVal ? { ...log.newVal } : null;
                  if (oldVal && 'updatedOn' in oldVal) delete oldVal.updatedOn;
                  if (newVal && 'updatedOn' in newVal) delete newVal.updatedOn;
                  return { ...log, oldVal, newVal };
                });
          
                resp.message = 'Audit logs fetched successfully';
              } catch (error) {
                this.logger.warn(`getAuditLogsError: ${error}`);
                resp.status = false;
                resp.message = error.message || 'Internal Server Error';
              }
              return resp;
            }
}
