import { BadRequestException, Body, Controller, Get, HttpCode, HttpStatus, Logger, Param, ParseIntPipe, Patch, Post, UnauthorizedException, Res, Delete, Query } from '@nestjs/common';
import { ApiCreatedResponse, ApiOperation } from '@nestjs/swagger';
import { ResponseData } from 'src/common/response-data';
import { Auth } from 'src/common/decorators/auth.decorator';
import { HouseJobService } from 'src/operation/services/house-job/house-job.service';
import { EDIManifestService } from 'src/operation/services/edi-manifest/edi-manifest.service';
import { Response } from 'express';

@Auth()
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
    @Post('fetch')
    async getHouseJobById(@Body() payload: any) {
        let resp = new ResponseData();
        try {
            this.logger.log(`Fetching House Job by HouseJobSid`);
            const result = await this.houseJobService.getHouseJobById(payload.HouseJobSid,payload.CompanyMasterSid,payload.BranchMasterSid);
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
      resp.status = false;
      if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
        resp.message = error.message;
      } else {
        resp.message = 'Internal Server Error';
      }
    }
    return resp;
  }

  @ApiOperation({ summary: 'Update House Job HBL Count' })
  @ApiCreatedResponse({
    description: 'Update House Job HBL Count Successfully',
    type: ResponseData
  })
  @HttpCode(HttpStatus.OK)
  @Patch('hbl-count')
  async updateHBLCount(@Body() payload: any) {
    const resp = new ResponseData();
    try {
      if(!payload.HouseJobSid){
        throw new BadRequestException('HouseJobSid is required');
      }
      if(!payload.CompanyMasterSid){
        throw new BadRequestException('CompanyMasterSid is required');
      }
      if(!payload.BranchMasterSid){
        throw new BadRequestException('BranchMasterSid is required');
      }
      this.logger.log(`Updating House Job HBL Count for HouseJobSid : ${JSON.stringify(payload)}`);
      const updatedHouseJob = await this.houseJobService.updateHBLCount(payload);
      this.logger.debug(`House Job HBL Count Updated Successfully by HouseJobSid : ${JSON.stringify(updatedHouseJob)}`);
      resp.message = 'House Job HBL Count Updated Successfully';
      this.logger.debug(`House Job HBL Count Updated Successfully by HouseJobSid : ${JSON.stringify(updatedHouseJob)}`);
      resp.data = updatedHouseJob;
    } catch (error) {
      this.logger.error(`Error in updating House Job HBL Count by HouseJobSid : ${JSON.stringify(error), error}`);
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
  @Get('shiping_Ins/fetch')
  async getBookingByBookingNumber(@Query('bookingNumber') bookingNumber: string) {
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
  async getMasterJobContainersByMasterJobSid(
    @Param('MasterJobSid', ParseIntPipe) MasterJobSid: number,
    @Query('ContainerType') ContainerType?: string
  ) {
    let output = new ResponseData();
    try {
      const parsedContainerType = ContainerType ? Number(ContainerType) : undefined;
      const masterJobContainers = await this.houseJobService.getMasterJobContainersByMasterJobSid(
        MasterJobSid,
        Number.isFinite(parsedContainerType) ? parsedContainerType : undefined
      );
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
      if (error instanceof BadRequestException) {
        const response = error.getResponse() as any;
        res.status(HttpStatus.BAD_REQUEST).json({
          status: false,
          message: response?.message || error.message || 'Failed to generate EDI manifest',
          errors: response?.errors || [],
        });
      } else {
        res.status(HttpStatus.BAD_REQUEST).json({
          status: false,
          message: 'Failed to generate EDI manifest',
        });
      }
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
  @ApiOperation({ summary: 'Delete House Job Product By ID' })
  @ApiCreatedResponse({
    description: 'House Job Product deleted successfully',
    type: ResponseData
  })
  @Delete('product/:HouseJobProductSid')
  async deleteHouseJobProduct(@Param('HouseJobProductSid', ParseIntPipe) HouseJobProductSid: number,
  @Body('updatedBy')updatedBy: string) {
    let output = new ResponseData
    try {
      let houseJobProduct = await this.houseJobService.softDeleteHouseJobProduct(HouseJobProductSid,updatedBy);
      this.logger.debug(`deleteHouseJobProduct: ${JSON.stringify(houseJobProduct)}`)
      output.data = houseJobProduct;
      output.message = "House Job Product deleted successfully";

    } catch (error) {
      this.logger.warn(`deleteHouseJobProduct: ${JSON.stringify(error), error}`)
      output.status = false;
      if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
        output.message = error.message;
      } else {
        output.message = error;
      }
    }
    return output
  }

  @ApiOperation({ summary: 'Delete House Job Connection By ID' })
  @ApiCreatedResponse({
    description: 'House Job Connection deleted successfully',
    type: ResponseData
  })
  @Delete(['connection/:HouseJobConnectionSid', 'connection/delete/:HouseJobConnectionSid'])
  async deleteHouseJobConnection(@Param('HouseJobConnectionSid', ParseIntPipe) HouseJobConnectionSid: number,
  @Body('updatedBy') updatedBy: string) {
    let output = new ResponseData
    try {
      const houseJobConnection = await this.houseJobService.softDeleteHouseJobConnection(HouseJobConnectionSid,updatedBy);
      this.logger.debug(`deleteHouseJobConnection: ${JSON.stringify(houseJobConnection)}`)
      output.data = houseJobConnection;
      output.message = "House Job Connection deleted successfully";
    } catch (error) {
      this.logger.warn(`deleteHouseJobConnection: ${JSON.stringify(error), error}`)
      output.status = false;
      if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
        output.message = error.message;
      } else {
        output.message = error;
      }
    }
    return output
  }

@ApiOperation({ summary: 'Search house job or HAWBill Search'})
@ApiCreatedResponse({
  description: 'House Job or HAWBill Search',
  type: ResponseData
})
@HttpCode(HttpStatus.OK)
@Post('search')
async searchHouseJob(@Body() payload: any) {
  let resp = new ResponseData();
  try {
    this.logger.log(`Searching House Job or HAWBill Search : ${JSON.stringify(payload)}`);
    const result = await this.houseJobService.searchHouseJob(payload);
    this.logger.debug(`Searched House Job or HAWBill Search : ${JSON.stringify(result)}`);
    resp.message = 'House Job or HAWBill Searched successfully';
    resp.data = result;
  } catch (error) {
    resp.status = false;
    this.logger.warn(`Error in searching House Job or HAWBill Search : ${JSON.stringify(error), error}`);
    if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
      resp.message = error.message;
    } else {
      resp.message = 'Internal Server Error';
    }
  }
  return resp;
}

@ApiOperation({ summary: 'Get Audit Logs for a Table/Record' })
          @ApiCreatedResponse({ description: 'Fetch audit logs', type: ResponseData })
          @HttpCode(HttpStatus.OK)
          @Get('audit-logs')
          async getAuditLogs(
            @Query('tableName') tableName: string,
            @Query('recordId') recordId?: string,
          ) {
            const resp = new ResponseData();
            try {
              if (!tableName) throw new Error('tableName query parameter is required');
        
              const logs = await this.houseJobService.getAuditLogs(tableName, recordId);
        
              // Remove updatedOn from oldVal and newVal
              resp.data = logs.map((log: any) => {
                const oldVal = log.oldVal ? { ...log.oldVal } : null;
                const newVal = log.newVal ? { ...log.newVal } : null;
                if (oldVal && 'updatedOn' in oldVal) delete oldVal.updatedOn;
                if (newVal && 'updatedOn' in newVal) delete newVal.updatedOn;
                return { ...log, oldVal, newVal };
              });
        
              resp.message = 'Audit logs fetched successfully';
            } catch (error) {
              this.logger.warn(`getAuditLogsError: ${error}`);
              resp.status = false;
              resp.message = error.message || 'Internal Server Error';
            }
            return resp;
          }


}
