import { BadRequestException, Controller, Get, HttpCode, HttpStatus, Logger, Param, ParseIntPipe, UnauthorizedException } from '@nestjs/common';
import { ApiCreatedResponse, ApiOperation } from '@nestjs/swagger';
import { ResponseData } from 'src/common/response-data';
import { HouseJobService } from 'src/operation/services/house-job/house-job.service';

@Controller('house-job')
export class HouseJobController {
    constructor(private houseJobService: HouseJobService, private logger: Logger) { }

    @ApiOperation({
        summary: 'Get House Job by HouseJobSid',
    })
    @ApiCreatedResponse({
        description: 'Get House Job by HouseJobSid',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Get('fetch/:HouseJobSid')
    async getHouseJobById(@Param('HouseJobSid', ParseIntPipe) HouseJobSid: number) {
        let resp = new ResponseData();
        try {
            this.logger.log(`Fetching House Job by HouseJobSid : ${HouseJobSid}`);
            const result = await this.houseJobService.getHouseJobById(HouseJobSid);
            this.logger.debug(`Fetched House Job by HouseJobSid : ${JSON.stringify(result)}`);
            resp.message = 'House Job fetched successfully';
            resp.data = result;
        } catch (error) {
            resp.status = false;
            this.logger.warn(`Error in fetching House Job by HouseJobSid : ${JSON.stringify(error), error}`);
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                resp.message = error.message;
            } else {
                resp.message = 'Internal Server Error';
            }
        }
        return resp;
    }


    @ApiOperation({ summary: 'Fetch Booking Data' })
  @ApiCreatedResponse({
    description: 'Fetch Booking Data Successfully',
    type: ResponseData
  })
  @HttpCode(HttpStatus.OK)
  @Get('shiping_Ins/fetch/:bookingNumber')
  async getBookingByBookingNumber(@Param('bookingNumber') bookingNumber: string) {
    let output = new ResponseData();
    try {
      const booking = await this.houseJobService.getBookingByNumber(bookingNumber)
      if (!booking) {
        this.logger.warn(`booking data fetched failed:- ${booking}`);
        throw new BadRequestException('Booking data fetch Failed');
      }
      output.data = booking
      output.message = "Booking Data Fetch Successfully"

    } catch (error) {
      this.logger.error(`Booking Data Fetch Failed'} - ${error.message}`);
      output.status = false;
      output.message = error.message || 'Internal Server Error';
    }
    return output;
  }
}
