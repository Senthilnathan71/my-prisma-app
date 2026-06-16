import { Body, Controller, Get, Param, ParseIntPipe, Post } from '@nestjs/common';
import { Auth } from 'src/common/decorators/auth.decorator';
import { ResponseData } from 'src/common/response-data';
import {
  InterBranchService,
  StageAllocationsPayload,
} from '../../services/inter-branch/inter-branch.service';

@Auth()
@Controller('inter-branch')
export class InterBranchController {
  constructor(private readonly interBranchService: InterBranchService) {}

  /** Stage (replace) the inter-branch allocations + owning-branch matching for a draft receipt/payment. */
  @Post('stage')
  async stage(@Body() payload: StageAllocationsPayload) {
    const resp = new ResponseData();
    try {
      resp.data = await this.interBranchService.stageAllocations(payload);
      resp.message = 'Inter-branch allocations staged';
    } catch (error) {
      resp.status = false;
      resp.message = error?.message || 'Failed to stage inter-branch allocations';
    }
    return resp;
  }

  /** Read staged allocations when re-opening a draft. */
  @Get('allocations/:voucherHeaderSid')
  async allocations(@Param('voucherHeaderSid', ParseIntPipe) voucherHeaderSid: number) {
    const resp = new ResponseData();
    try {
      resp.data = await this.interBranchService.getAllocations(voucherHeaderSid);
    } catch (error) {
      resp.status = false;
      resp.message = error?.message || 'Failed to fetch inter-branch allocations';
    }
    return resp;
  }
}
