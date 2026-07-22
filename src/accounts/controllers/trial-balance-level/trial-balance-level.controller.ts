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
import { TrialBalanceLevelService } from '../../services/trial-balance-level/trial-balance-level.service';
import {
  TrialBalanceLevelQueryDto,
  TrialBalanceLevelResponseDto,
} from '../../dto/trial-balance-level.dto';
import { Auth } from 'src/common/decorators/auth.decorator';

@Auth()
@ApiTags('Trial Balance Level')
@Controller('accounts/trial-balance-level')
export class TrialBalanceLevelController {
  constructor(private readonly trialBalanceLevelService: TrialBalanceLevelService) {}

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
    type: TrialBalanceLevelResponseDto,
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
    @Body() query: TrialBalanceLevelQueryDto,
  ): Promise<TrialBalanceLevelResponseDto> {
    return this.trialBalanceLevelService.generateTrialBalance(query);
  }
}
