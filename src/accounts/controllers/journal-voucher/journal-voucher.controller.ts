import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  ParseIntPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';
import { JournalVoucherService } from '../../services/journal-voucher/journal-voucher.service';
import { VoucherPostingService } from '../../services/voucher-posting/voucher-posting.service';
import {
  CreateJournalVoucherDto,
  UpdateJournalVoucherDto,
  JournalVoucherListQueryDto,
  JournalVoucherResponseDto,
} from '../../dto/journal-voucher.dto';

@ApiTags('Journal Voucher')
@Controller('accounts/journal-voucher')
export class JournalVoucherController {
  constructor(
    private readonly journalVoucherService: JournalVoucherService,
    private readonly voucherPostingService: VoucherPostingService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Create a new journal voucher (draft)' })
  @ApiResponse({
    status: 201,
    description: 'Journal voucher created successfully',
    type: JournalVoucherResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Bad request - validation error' })
  async create(
    @Body() createDto: CreateJournalVoucherDto,
  ): Promise<JournalVoucherResponseDto> {
    return this.journalVoucherService.create(createDto);
  }

  @Get('list')
  @ApiOperation({ summary: 'Get list of journal vouchers with pagination and filters' })
  @ApiResponse({
    status: 200,
    description: 'List of journal vouchers retrieved successfully',
  })
  async findAll(@Query() query: JournalVoucherListQueryDto) {
    return this.journalVoucherService.findAll(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get journal voucher by ID' })
  @ApiParam({ name: 'id', description: 'Voucher Header Sid' })
  @ApiResponse({
    status: 200,
    description: 'Journal voucher retrieved successfully',
    type: JournalVoucherResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Journal voucher not found' })
  async findOne(
    @Param('id', ParseIntPipe) id: number,
    @Query('CompanyMasterSid', ParseIntPipe) companyMasterSid: number,
    @Query('BranchMasterSid', ParseIntPipe) branchMasterSid: number,
  ): Promise<JournalVoucherResponseDto> {
    return this.journalVoucherService.findById(id, companyMasterSid, branchMasterSid);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update journal voucher (unposted only)' })
  @ApiParam({ name: 'id', description: 'Voucher Header Sid' })
  @ApiResponse({
    status: 200,
    description: 'Journal voucher updated successfully',
    type: JournalVoucherResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Cannot update posted voucher' })
  @ApiResponse({ status: 404, description: 'Journal voucher not found' })
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateDto: UpdateJournalVoucherDto,
    @Query('CompanyMasterSid', ParseIntPipe) companyMasterSid: number,
    @Query('BranchMasterSid', ParseIntPipe) branchMasterSid: number,
  ): Promise<JournalVoucherResponseDto> {
    return this.journalVoucherService.update(id, updateDto, companyMasterSid, branchMasterSid);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete journal voucher (unposted only)' })
  @ApiParam({ name: 'id', description: 'Voucher Header Sid' })
  @ApiResponse({
    status: 200,
    description: 'Journal voucher deleted successfully',
  })
  @ApiResponse({ status: 400, description: 'Cannot delete posted voucher' })
  @ApiResponse({ status: 404, description: 'Journal voucher not found' })
  @HttpCode(HttpStatus.OK)
  async delete(
    @Param('id', ParseIntPipe) id: number,
    @Query('CompanyMasterSid', ParseIntPipe) companyMasterSid: number,
    @Query('BranchMasterSid', ParseIntPipe) branchMasterSid: number,
  ) {
    return this.journalVoucherService.delete(id, companyMasterSid, branchMasterSid);
  }

  @Post(':id/validate')
  @ApiOperation({ summary: 'Validate journal voucher before posting' })
  @ApiParam({ name: 'id', description: 'Voucher Header Sid' })
  @ApiResponse({
    status: 200,
    description: 'Validation result',
  })
  async validate(@Param('id', ParseIntPipe) id: number) {
    return this.voucherPostingService.validateVoucher(id);
  }

  @Post(':id/post')
  @ApiOperation({ summary: 'Post journal voucher to VoucherTransaction' })
  @ApiParam({ name: 'id', description: 'Voucher Header Sid' })
  @ApiResponse({
    status: 200,
    description: 'Journal voucher posted successfully',
  })
  @ApiResponse({
    status: 400,
    description: 'Voucher validation failed or already posted',
  })
  @ApiResponse({ status: 404, description: 'Journal voucher not found' })
  async post(@Param('id', ParseIntPipe) id: number) {
    // First validate
    const validation = await this.voucherPostingService.validateVoucher(id);

    if (!validation.isValid) {
      return {
        success: false,
        message: 'Validation failed',
        errors: validation.errors,
      };
    }

    // Prepare posting payload
    const payload = await this.voucherPostingService.preparePostingPayload(id);

    // Then post
    const result = await this.voucherPostingService.postVoucher(payload);

    return {
      success: true,
      message: 'Journal voucher posted successfully',
      data: result,
    };
  }
}
