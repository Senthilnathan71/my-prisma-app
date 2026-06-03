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
  Query, 
  Res, 
  UnauthorizedException,
  UploadedFile,
  UseInterceptors
} from '@nestjs/common';
import { ApiOperation, ApiCreatedResponse, ApiConsumes } from '@nestjs/swagger';
import { ResponseData } from 'src/common/response-data';
import { JournalVoucherService } from 'src/accounts/services/journal-voucher/journal-voucher.service';
import { Auth } from 'src/common/decorators/auth.decorator';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';

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

            // ─── TEMPLATE ─────────────────────────────────────────────────────────────────
@ApiOperation({ summary: 'Download Journal Voucher Excel template' })
@HttpCode(HttpStatus.OK)
@Get('template')
async downloadJournalVoucherTemplate(
  @Query('CompanyMasterSid') CompanyMasterSid: number,
  @Query('BranchMasterSid') BranchMasterSid: number,
  @Res() res: Response
) {
  try {
    this.logger.log(`Generating Excel template for journal voucher upload`);
    const buffer = await this.journalVoucherService.generateJournalVoucherTemplate(
      Number(CompanyMasterSid),
      Number(BranchMasterSid)
    );
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=Journal_Voucher_Upload_Template.xlsx');
    res.send(buffer);
  } catch (error) {
    this.logger.warn(`Error generating journal voucher template: ${JSON.stringify(error)}, ${error}`);
    res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ status: false, message: 'Error generating template' });
  }
}

// ─── STEP 1: PARSE ────────────────────────────────────────────────────────────
@ApiOperation({ summary: 'Parse & validate Journal Voucher Excel — does NOT save to DB' })
@ApiConsumes('multipart/form-data')
@HttpCode(HttpStatus.OK)
@Post('bulk-upload/parse')
@UseInterceptors(FileInterceptor('file'))
async parseJournalVoucherExcel(
  @UploadedFile() file: Express.Multer.File,
  @Body('CompanyMasterSid') CompanyMasterSid: string,
  @Body('BranchMasterSid') BranchMasterSid: string,
  @Body('YearMasterSid') YearMasterSid: string,
) {
  const resp = new ResponseData();
  try {
    if (!file) throw new BadRequestException('No file uploaded');

    const allowedMimeTypes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel'
    ];
    if (!allowedMimeTypes.includes(file.mimetype))
      throw new BadRequestException('Invalid file type. Only .xlsx or .xls allowed');

    if (file.size > 5 * 1024 * 1024)
      throw new BadRequestException('File size exceeds 5MB limit');

    if (!CompanyMasterSid) throw new BadRequestException('CompanyMasterSid is required');
    if (!BranchMasterSid)  throw new BadRequestException('BranchMasterSid is required');
    if (!YearMasterSid)    throw new BadRequestException('YearMasterSid is required');

    const result = await this.journalVoucherService.parseJournalVoucherExcel(
      file.buffer,
      Number(CompanyMasterSid),
      Number(BranchMasterSid),
      Number(YearMasterSid)
    );

    const hasValid = result.validRows.length > 0;

    resp.status = true;
    resp.message = hasValid
      ? `Parsed successfully. ${result.validRows.length} valid, ${result.invalidRows.length} invalid.`
      : 'No valid rows found. Please fix the errors and re-upload.';
    resp.data = result;

  } catch (error) {
    resp.status = false;
    this.logger.warn(`Error parsing journal voucher Excel: ${JSON.stringify(error)}, ${error}`);
    resp.message = error instanceof BadRequestException
      ? error.message
      : 'Internal Server Error';
  }
  return resp;
}

// ─── STEP 2: SAVE ─────────────────────────────────────────────────────────────
@ApiOperation({ summary: 'Save validated Journal Voucher rows to DB' })
@HttpCode(HttpStatus.OK)
@Post('bulk-upload/save')
async saveJournalVoucherExcel(
  @Body() payload: {
    validRows: any[];
    CompanyMasterSid: number;
    BranchMasterSid: number;
    YearMasterSid: number;
    createdBy: string;
  }
) {
  const resp = new ResponseData();
  try {
    const { validRows, CompanyMasterSid, BranchMasterSid, YearMasterSid, createdBy } = payload;

    if (!validRows?.length)      throw new BadRequestException('No valid rows to save');
    if (!CompanyMasterSid)       throw new BadRequestException('CompanyMasterSid is required');
    if (!BranchMasterSid)        throw new BadRequestException('BranchMasterSid is required');
    if (!YearMasterSid)          throw new BadRequestException('YearMasterSid is required');
    if (!createdBy)              throw new BadRequestException('createdBy is required');

    const result = await this.journalVoucherService.saveJournalVoucherExcel(
      validRows,
      Number(CompanyMasterSid),
      Number(BranchMasterSid),
      Number(YearMasterSid),
      createdBy
    );

    resp.status = true;
    resp.message = `Import complete. ${result.created} created, ${result.skipped} skipped.`;
    resp.data = result;

  } catch (error) {
    resp.status = false;
    this.logger.warn(`Error saving journal voucher Excel: ${JSON.stringify(error)}, ${error}`);
    resp.message = error instanceof BadRequestException
      ? error.message
      : 'Internal Server Error';
  }
  return resp;
}
}