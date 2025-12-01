import { BadRequestException, Body, Controller, Get, HttpCode, HttpStatus, Logger, Param, ParseIntPipe, Patch, Post, UnauthorizedException, Res } from '@nestjs/common';
import { ApiCreatedResponse, ApiOperation } from '@nestjs/swagger';
import { ResponseData } from 'src/common/response-data';
import { HouseJobService } from 'src/operation/services/house-job/house-job.service';
import { EDIManifestService } from 'src/operation/services/edi-manifest/edi-manifest.service';
import { Response } from 'express';

@Controller('house-job')
export class HouseJobController {
    constructor(
        private houseJobService: HouseJobService,
        private ediManifestService: EDIManifestService,
        private logger: Logger
    ) { }

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

    @ApiOperation({ summary: 'Create New House Job' })
@ApiCreatedResponse({
  description: 'House Job Created Successfully',
  type: ResponseData
})
@HttpCode(HttpStatus.CREATED)
@Post('create')
async createHouseJob(@Body() payload: any) {
  const resp = new ResponseData();
  try {
    this.logger.log(`Creating new House Job with payload: ${JSON.stringify(payload)}`);
    const houseJob = await this.houseJobService.createHouseJob(payload);
    this.logger.debug(`House Job Created Successfully: ${JSON.stringify(houseJob)}`);
    resp.data = houseJob;
    resp.message = 'House Job Created Successfully';
    return resp;
  } catch (error) {
    this.logger.error(`Error in creating House Job: ${JSON.stringify(error)}, ${error}`);
    resp.status = false;
    if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
      resp.message = error.message;
    } else {
      resp.message = 'Internal Server Error';
    }
  }
  return resp;
}
  @ApiOperation({
    summary: 'Get House Job by MasterJobSid',
  })
  @ApiCreatedResponse({
    description: 'Get House Job by MasterJobSid',
    type: ResponseData
  })
  @HttpCode(HttpStatus.OK)
  @Post('fetchByMaster')
  async getHouseJobByMasterJobSid(@Body() payload: any) {
    let resp = new ResponseData();
    try {
      this.logger.log(`Fetching House Job by MasterJobSid : ${JSON.stringify(payload)}`);
      const result = await this.houseJobService.getHouseJobByMasterJobSid(payload);
      this.logger.debug(`Fetched House Job by MasterJobSid : ${JSON.stringify(result)}`);
      resp.message = 'House Job By MasterJobSid is fetched successfully';
      resp.data = result;
    } catch (error) {
      resp.status = false;
      this.logger.warn(`Error in fetching House Job by MasterJobSid : ${JSON.stringify(error), error}`);
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

  @ApiOperation({ summary: 'Generate EDI Manifest for House Job' })
  @HttpCode(HttpStatus.OK)
  @Get('edi-manifest/:id')
  async generateEDIManifest(
    @Param('id', ParseIntPipe) id: number,
    @Res() res: Response
  ) {
    try {
      this.logger.log(`Generating EDI Manifest for House Job ID: ${id}`);
      const manifestText = await this.ediManifestService.generateHouseJobManifest(id);
      this.logger.debug(`EDI Manifest generated successfully for House Job ID: ${id}`);

      res.setHeader('Content-Type', 'text/plain');
      res.setHeader('Content-Disposition', `attachment; filename="EDI_Manifest_HouseJob_${id}_${Date.now()}.txt"`);
      res.send(manifestText);
    } catch (error) {
      this.logger.warn(`Error generating EDI Manifest for House Job ID ${id}: ${JSON.stringify(error)}, ${error}`);
      res.status(HttpStatus.BAD_REQUEST).json({
        status: false,
        message: error.message || 'Failed to generate EDI manifest'
      });
    }
  }

  @ApiOperation({ summary: 'Get House Job AR/AP Data'})
  @ApiCreatedResponse({
    description: 'House Job AR/AP Data fetched successfully',
    type: ResponseData
  })
  @HttpCode(HttpStatus.OK)
  @Get('arap-data/:HouseJobSid')
  async getHouseJobARAPData(@Param('HouseJobSid', ParseIntPipe) HouseJobSid: number) {
    let output = new ResponseData();
    try {
      const arapData = await this.houseJobService.getHouseJobARAPData(HouseJobSid);
      this.logger.debug(`getHouseJobARAPData: ${JSON.stringify(arapData)}`);
      output.data = arapData;
      output.message = "House Job AR/AP Data fetched successfully";
    } catch (error) {
      this.logger.warn(`getHouseJobARAPData: ${JSON.stringify(error)}`);
      output.status = false;
      output.message = 'Failed to fetch AR/AP data';
    }
    return output;
  }
}
