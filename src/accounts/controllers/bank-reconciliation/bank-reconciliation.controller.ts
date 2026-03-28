import { BadRequestException, Body, Controller, HttpCode, HttpStatus, Logger, Post, UnauthorizedException } from '@nestjs/common';
import { ApiCreatedResponse, ApiOperation } from '@nestjs/swagger';
import { ResponseData } from 'src/common/response-data';
import { AutoMatchBankReconciliationDto, BankReconciliationFilterDto, BankReconciliationReportDto, ManualMatchBankReconciliationDto, UnmatchBankReconciliationDto } from '../../dto/bank-reconciliation.dto';
import { BankReconciliationService } from '../../services/bank-reconciliation/bank-reconciliation.service';

@Controller('accounts/bank-reconciliation')
export class BankReconciliationController {
  private readonly logger = new Logger(BankReconciliationController.name);

  constructor(private readonly bankReconciliationService: BankReconciliationService) {}

  @ApiOperation({ summary: 'Search book-side bank transactions' })
  @ApiCreatedResponse({ description: 'Book transactions fetched successfully', type: ResponseData })
  @HttpCode(HttpStatus.OK)
  @Post('search-book')
  async searchBook(@Body() payload: BankReconciliationFilterDto) {
    const resp = new ResponseData();
    try {
      resp.data = await this.bankReconciliationService.searchBookTransactions(payload);
      resp.message = 'Book transactions fetched successfully';
    } catch (error) {
      this.logger.warn(`searchBook error: ${(error as any)?.message || error}`);
      resp.status = false;
      resp.message = error instanceof BadRequestException || error instanceof UnauthorizedException ? (error as any).message || 'Bad request' : 'Internal Server Error';
    }
    return resp;
  }

  @ApiOperation({ summary: 'Auto match bank statement rows to vouchers' })
  @ApiCreatedResponse({ description: 'Auto match completed', type: ResponseData })
  @HttpCode(HttpStatus.OK)
  @Post('auto-match')
  async autoMatch(@Body() payload: AutoMatchBankReconciliationDto) {
    const resp = new ResponseData();
    try {
      resp.data = await this.bankReconciliationService.autoMatch(payload);
      resp.message = 'Auto match completed successfully';
    } catch (error) {
      this.logger.warn(`autoMatch error: ${(error as any)?.message || error}`);
      resp.status = false;
      resp.message = error instanceof BadRequestException || error instanceof UnauthorizedException ? (error as any).message || 'Bad request' : 'Internal Server Error';
    }
    return resp;
  }

  @ApiOperation({ summary: 'Manual match a bank transaction to a voucher' })
  @ApiCreatedResponse({ description: 'Manual match completed', type: ResponseData })
  @HttpCode(HttpStatus.OK)
  @Post('manual-match')
  async manualMatch(@Body() payload: ManualMatchBankReconciliationDto) {
    const resp = new ResponseData();
    try {
      resp.data = await this.bankReconciliationService.manualMatch(payload);
      resp.message = 'Manual match completed successfully';
    } catch (error) {
      this.logger.warn(`manualMatch error: ${(error as any)?.message || error}`);
      resp.status = false;
      resp.message = error instanceof BadRequestException || error instanceof UnauthorizedException ? (error as any).message || 'Bad request' : 'Internal Server Error';
    }
    return resp;
  }

  @ApiOperation({ summary: 'Unmatch a voucher from bank reconciliation' })
  @ApiCreatedResponse({ description: 'Unmatch completed', type: ResponseData })
  @HttpCode(HttpStatus.OK)
  @Post('unmatch')
  async unmatch(@Body() payload: UnmatchBankReconciliationDto) {
    const resp = new ResponseData();
    try {
      resp.data = await this.bankReconciliationService.unmatch(payload);
      resp.message = 'Unmatch completed successfully';
    } catch (error) {
      this.logger.warn(`unmatch error: ${(error as any)?.message || error}`);
      resp.status = false;
      resp.message = error instanceof BadRequestException || error instanceof UnauthorizedException ? (error as any).message || 'Bad request' : 'Internal Server Error';
    }
    return resp;
  }

  @ApiOperation({ summary: 'Generate bank reconciliation report' })
  @ApiCreatedResponse({ description: 'Bank reconciliation report generated', type: ResponseData })
  @HttpCode(HttpStatus.OK)
  @Post('report')
  async report(@Body() payload: BankReconciliationReportDto) {
    const resp = new ResponseData();
    try {
      resp.data = await this.bankReconciliationService.generateReport(payload);
      resp.message = 'Bank reconciliation report generated successfully';
    } catch (error) {
      this.logger.warn(`report error: ${(error as any)?.message || error}`);
      resp.status = false;
      resp.message = error instanceof BadRequestException || error instanceof UnauthorizedException ? (error as any).message || 'Bad request' : 'Internal Server Error';
    }
    return resp;
  }
}
