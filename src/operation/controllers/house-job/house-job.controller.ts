import { BadRequestException, Body, Controller, Get, HttpCode, HttpStatus, Logger, Param, ParseIntPipe, Patch, UnauthorizedException } from '@nestjs/common';
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

  @ApiOperation({ summary: 'Update House Job Data' })
  @ApiCreatedResponse({
    description: 'Update House Job Data Successfully',
    type: ResponseData
  })
  @HttpCode(HttpStatus.OK)
  @Patch('update/:houseJobSid')
  async updateHouseJob(@Param('houseJobSid',ParseIntPipe) houseJobSid: number, @Body() payload: any) {
    const resp = new ResponseData();
    try {
      const houseJob = await this.houseJobService.updateHouseJobById(houseJobSid, payload);
      this.logger.debug(`House Job Updated Successfully by HouseJobSid : ${JSON.stringify(houseJob)}`);
      resp.data = houseJob;
      resp.message = 'House Job Updated Successfully';
      return resp;
    } catch (error) {
      this.logger.error(`Error in updating House Job by HouseJobSid : ${JSON.stringify(error), error}`);
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
      const booking = await this.houseJobService.getHouseJobByBookingNo(bookingNumber)
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

  @ApiOperation({ summary: 'Fetch Master Job Container Data' })
  @ApiCreatedResponse({
    description: 'Fetch Master Job Container Data Successfully',
    type: ResponseData
  })
  @HttpCode(HttpStatus.OK)
  @Get('fetch-containers/:MasterJobSid')
  async getMasterJobContainersByMasterJobSid(@Param('MasterJobSid', ParseIntPipe) MasterJobSid: number) {
    let output = new ResponseData();
    try {
      const masterJobContainers = await this.houseJobService.getMasterJobContainersByMasterJobSid(MasterJobSid)
      if (!masterJobContainers) {
        this.logger.warn(`masterJobContainers data fetched failed:- ${masterJobContainers}`);
        throw new BadRequestException('Master Job Containers data fetch Failed');
      }
      output.data = masterJobContainers
      output.message = "Master Job Containers Data Fetch Successfully"

    } catch (error) {
      this.logger.error(`Master Job Containers Data Fetch Failed'} - ${error.message}`);
      output.status = false;
      output.message = error.message || 'Internal Server Error';
    }
    return output;
  }
}
