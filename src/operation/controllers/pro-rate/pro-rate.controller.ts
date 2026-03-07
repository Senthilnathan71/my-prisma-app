import { Body, Controller, Post, UsePipes, ValidationPipe } from '@nestjs/common';
import { Auth } from 'src/common/decorators/auth.decorator';
import { ResponseData } from 'src/common/response-data';
import { ProRateService } from '../../services/pro-rate/pro-rate.service';
import { ProRateCalculateDto } from '../../DTO/pro-rate.dto';

@Controller('pro-rate')
@Auth()
export class ProRateController {
  constructor(private readonly proRateService: ProRateService) {}

  @Post('calculate')
  @UsePipes(new ValidationPipe({ transform: true }))
  async calculateProRate(@Body() body: ProRateCalculateDto) {
    const output = new ResponseData();
    try {
      output.data = await this.proRateService.calculateProRate(body);
    } catch (error) {
      output.status = false;
      output.message = error.message || 'Internal Server Error';
    }
    return output;
  }
}
