import { BadRequestException, Body, Controller, Delete, Get, HttpCode, HttpStatus, Logger, Param, ParseIntPipe, Patch, Post, UnauthorizedException ,Query} from '@nestjs/common';
import { ApiOperation, ApiCreatedResponse } from '@nestjs/swagger';
import { Auth } from 'src/common/decorators/auth.decorator';
import { UserData } from 'src/common/decorators/user.decorator';
import { ResponseData } from 'src/common/response-data';
import { SearchVesselDto } from 'src/masters/DTO/search-vessel.dto';
import { VesselService } from 'src/masters/services/vessel/vessel.service';

@Controller('vessel')
@Auth()
export class VesselController {
    constructor(private vesselService: VesselService, private logger: Logger) { }

    @ApiOperation({ summary: 'Vessel Creation' })
    @ApiCreatedResponse({
        description: 'Vessel Creation',
        type: ResponseData
    })
    @HttpCode(HttpStatus.CREATED)
    @Post('create')
    async createVessel(@Body() body:any, @UserData() user: any) {
        this.logger.log(`createVesselData: ${JSON.stringify(body)}`)
        let output = new ResponseData
        try {
            let vessel = await this.vesselService.createVessel(body, user);
            this.logger.debug(`createVessel: ${JSON.stringify(vessel)}`)
            if (!vessel) {
                this.logger.warn(`createVessel!!: ${JSON.stringify(vessel)}`)
                throw 'Something went wrong'
            }
            output.data = vessel
        } catch (error) {
            this.logger.warn(`createVesselError: ${error}`)
            output.status = false;
            // Handle error message based on the type of error
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                output.message = error.message;
                this.logger.warn(`createVesselError: ${error.message}`)
            } else {
                this.logger.warn(`createVesselError: ${error}`)
                output.message = error;
            }
        }
        return output
    }


    @ApiOperation({ summary: 'Get All Vessel' })
    @ApiCreatedResponse({
        description: 'Get All Vessels',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Get()
    async getAllVessels() {
        let output = new ResponseData;
        try {
            let vesselData = await this.vesselService.getAllVessels();
            this.logger.log(`getAllVessels: ${JSON.stringify(vesselData)}`)
            output.data = vesselData;
        } catch (error) {
            this.logger.warn(`getAllVessels: ${JSON.stringify(error)}`)
            output.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                output.message = error.message;
            } else {
                output.message = 'Internal Server Error';
            }
        }
        return output
    }


    @ApiOperation({ summary: 'Get Vessel By Id' })
    @ApiCreatedResponse({
        description: 'Get Vessel By Id',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Get('fetch/:id')
    async getVesselById(@Param('id', ParseIntPipe) VesselId: number) {
        const output = new ResponseData;
        try {
            const vessel = await this.vesselService.findOne(VesselId)
            this.logger.log(`getVesselById: ${JSON.stringify(vessel)}`)
            output.data = vessel
        } catch (error) {
            this.logger.warn(`getVesselById: ${JSON.stringify(error)}`)
            output.status = false;
            output.message = error
        }
        return output;
    }


    @ApiOperation({ summary: 'Update Vessel By Id' })
    @ApiCreatedResponse({
        description: 'Update Vessel By Id',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Patch('update/:id')
    async editVessel(@Param('id', ParseIntPipe) id: number, @Body() body: any, @UserData() user: any) {
        this.logger.log(`editVesselBody: ${JSON.stringify(body)}`)
        let output = new ResponseData
        try {
            let vessel = await this.vesselService.updateVessel(id, body, user);
            this.logger.log(`editVessel: ${JSON.stringify(vessel)}`)

            if (!vessel) {
                this.logger.log(`editVessel!!: ${JSON.stringify(vessel)}`)
                throw 'Something went wrong'
            } else {
                this.logger.log(`editVesselelse: ${vessel}`)
            }
            output.data = vessel;

        } catch (error) {
            this.logger.warn(`editVesselerror: ${JSON.stringify(error), error}`)
            output.status = false;
            // Handle error message based on the type of error
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                this.logger.warn(`editVesselbadrequest: ${error}`)
                output.message = error.message;
            } else {
                output.message = error;
            }
        }
        this.logger.warn(`editVesselmessage: ${output.message}`)
        return output
    }



    @ApiOperation({ summary: 'Delete Vessel By Id' })
    @ApiCreatedResponse({
        description: 'Delete Vessel By Id',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Delete('delete/:id')
    async softDelete(@Param('id', ParseIntPipe) id: number) {
        return this.vesselService.softDelete(id);
    }

    @ApiOperation({summary:'Search List of Vessels'})
    @ApiCreatedResponse({
        description:'Search List of Vessels',
        type:ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Get('search-list')
    async searchVessel(){
        let resp=new ResponseData();
        try {
            let res=await this.vesselService.searchVessel();
            this.logger.log(`Vessel Search Data : ${JSON.stringify(res)}`);
            resp.data=res;
            resp.message="Vessel Search is successfully fetched"
        } catch (error) {
            this.logger.warn(`Search Vessel Error : ${error}`);
            resp.status=false;
            if(error instanceof BadRequestException || error instanceof UnauthorizedException){
                resp.message=error.message;
            } else {
                resp.message='Internal Server Error';
            }
        }
        return resp;
    }

  @ApiOperation({ summary: 'Search List of Vessels' })
  @ApiCreatedResponse({
    description: 'Search List of Vessels',
    type: ResponseData,
  })
  @HttpCode(HttpStatus.OK)
  @Post('search-list')
  async searchVesselNew(@Body() searchParams: SearchVesselDto) {
    const resp = new ResponseData();
    try {
      const res = await this.vesselService.searchVesselNew(searchParams);
      this.logger.log(`Vessel Search Data : ${JSON.stringify(res)}`);
      resp.data = res;
      resp.message = 'Vessel Search is successfully fetched';
    } catch (error) {
      this.logger.warn(`Search Vessel Error : ${error}`);
      resp.status = false;
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
    
          const logs = await this.vesselService.getAuditLogs(tableName, recordId);
    
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
