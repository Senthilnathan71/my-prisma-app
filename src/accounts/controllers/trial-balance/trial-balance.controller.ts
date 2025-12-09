import {
  Controller,
  Get,
  Query,
  HttpCode,
  HttpStatus,
  Body,
  Post,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { TrialBalanceService } from '../../services/trial-balance/trial-balance.service';
import {
  TrialBalanceQueryDto,
  TrialBalanceResponseDto,
} from '../../dto/trial-balance.dto';

@ApiTags('Trial Balance')
@Controller('accounts/trial-balance')
export class TrialBalanceController {
  constructor(private readonly trialBalanceService: TrialBalanceService) {}

  @Post('report')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Generate Trial Balance Report',
    description:
      'Generate trial balance report with opening, current, and closing balances for all active ledgers. ' +
      'Supports filtering by date range, group, subgroup, and branch. ' +
      'Validates that dates fall within the same financial year.',
  })
  @ApiResponse({
    status: 200,
    description: 'Trial balance report generated successfully',
    type: TrialBalanceResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - validation error (e.g., invalid date range, cross-year dates)',
  })
  @ApiResponse({
    status: 404,
    description: 'Financial year not found',
  })
  async generateReport(
    @Body() query: TrialBalanceQueryDto,
  ): Promise<TrialBalanceResponseDto> {
    return this.trialBalanceService.generateTrialBalance(query);
  }
}
