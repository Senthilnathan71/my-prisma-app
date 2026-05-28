import { Body, Controller, Get, HttpCode, HttpStatus, Post, Query } from '@nestjs/common';
import { ResponseData } from 'src/common/response-data';
import { VoiceService } from '../services/voice.service';

@Controller('voice')
export class VoiceController {
  constructor(private readonly voiceService: VoiceService) {}

  @HttpCode(HttpStatus.CREATED)
  @Post('log')
  log(@Body() body: any) {
    const output = new ResponseData();
    output.data = this.voiceService.createLog({
      userId: body.userId ?? null,
      sessionId: body.sessionId,
      raw: body.raw,
      intent: body.intent,
      screen: body.screen,
      field: body.field ?? null,
      value: body.value ?? null,
      success: !!body.success,
      timestamp: body.timestamp || new Date().toISOString(),
    });
    output.message = 'Voice command logged successfully';
    return output;
  }

  @HttpCode(HttpStatus.OK)
  @Get('commands')
  commands() {
    const output = new ResponseData();
    output.data = this.voiceService.getCommands();
    output.message = 'Voice commands fetched successfully';
    return output;
  }

  @HttpCode(HttpStatus.OK)
  @Get('analytics')
  analytics(@Query() query: { userId?: string; from?: string; to?: string }) {
    const output = new ResponseData();
    output.data = this.voiceService.getAnalytics(query);
    output.message = 'Voice analytics fetched successfully';
    return output;
  }
}
