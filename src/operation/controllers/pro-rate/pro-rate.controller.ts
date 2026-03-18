import { Body, Controller, Post, UsePipes, ValidationPipe } from '@nestjs/common';
import { Auth } from 'src/common/decorators/auth.decorator';
import { ResponseData } from 'src/common/response-data';
import { ProRateService } from '../../services/pro-rate/pro-rate.service';
import {
  ProRateApplyDto,
  ProRateCalculateDto,
  ProRateHouseDto,
} from '../../DTO/pro-rate.dto';

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

  @Post('apply')
  @UsePipes(new ValidationPipe({ transform: true }))
  async applyProRate(@Body() body: ProRateApplyDto) {
    const output = new ResponseData();
    try {
      output.data = await this.proRateService.applyProRate(body);
    } catch (error) {
      output.status = false;
      output.message = error.message || 'Internal Server Error';
    }
    return output;
  }

  @Post('house-charges')
  @UsePipes(new ValidationPipe({ transform: true }))
  async getHouseProratedCharges(@Body() body: ProRateHouseDto) {
    const output = new ResponseData();
    try {
      output.data = await this.proRateService.getHouseProratedCharges(body);
    } catch (error) {
      output.status = false;
      output.message = error.message || 'Internal Server Error';
    }
    return output;
  }

  @Post('house-status')
  @UsePipes(new ValidationPipe({ transform: true }))
  async getHouseProrateStatus(@Body() body: ProRateHouseDto) {
    const output = new ResponseData();
    try {
      output.data = await this.proRateService.getHouseProrateStatus(body);
    } catch (error) {
      output.status = false;
      output.message = error.message || 'Internal Server Error';
    }
    return output;
  }
}
