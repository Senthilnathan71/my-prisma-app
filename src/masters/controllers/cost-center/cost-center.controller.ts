import { BadRequestException, Body, Controller, Delete, Get, HttpCode, HttpStatus, Logger, Param, ParseIntPipe, Patch, Post, Query, UnauthorizedException } from '@nestjs/common';
import { ApiOperation, ApiCreatedResponse } from '@nestjs/swagger';
import { UserData } from 'src/common/decorators/user.decorator';
import { ResponseData } from 'src/common/response-data';
import { SearchListDto } from 'src/masters/DTO/search-list.dto';
import { SearchVesselDto } from 'src/masters/DTO/search-vessel.dto';
import { CostCenterService } from 'src/masters/services/cost-center/cost-center.service';

@Controller('cost-center')
export class CostCenterController {
    constructor(private costCenterService: CostCenterService, private logger: Logger) { }

    @ApiOperation({ summary: 'Cost-Center Creation' })
    @ApiCreatedResponse({
        description: 'Cost-Center Creation',
        type: ResponseData
    })
    @HttpCode(HttpStatus.CREATED)
    @Post('create')
    async createCostCenter(@Body() body: any,@UserData() user: any) {
        this.logger.log(`createCostCenterData: ${JSON.stringify(body)}`)
        let output = new ResponseData
        try {
            let CostCenter = await this.costCenterService.createCostCenter(body, user);
            this.logger.debug(`createCostCenterData: ${JSON.stringify(CostCenter)}`)
            if (!CostCenter) {
                this.logger.warn(`createCostCenter!!: ${JSON.stringify(CostCenter)}`)
                throw 'Something went wrong'
            }
            output.data = CostCenter
            output.message = 'Cost-Center Created Successfully'
        } catch (error) {
            this.logger.warn(`createCostCenterError: ${JSON.stringify(error), error}`)
            output.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                output.message = error.message;
                this.logger.warn(`createCostCenterError: ${error.message}`)
            } else {
                this.logger.warn(`createCostCenterError: ${error}`)
                output.message = error;
            }
        }
        return output
    }

    @ApiOperation({ summary: 'Get All Cost-Center' })
    @ApiCreatedResponse({
        description: 'Get All Cost-Center',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Get()
    async getAllCostCenter() {
        let output = new ResponseData;
        try {
            let CostCenterData = await this.costCenterService.getAllCostCenter();
            this.logger.log(`getAllCostCenter: ${JSON.stringify(CostCenterData)}`)
            output.data = CostCenterData;
        } catch (error) {
            this.logger.warn(`getAllCostCenter: ${JSON.stringify(error)}`)
            output.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                output.message = error.message;
            } else {
                output.message = 'Internal Server Error';
            }
        }
        return output
    }

    @ApiOperation({ summary: 'Get Cost-Center By Id' })
    @ApiCreatedResponse({
        description: 'Get Cost-Center By Id',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Get('fetch/:id')
    async getCostCenterById(@Param('id', ParseIntPipe) CostCenterId: number) {
        const output = new ResponseData;
        try {
            const CostCenter = await this.costCenterService.findOne(CostCenterId)
            this.logger.log(`getCostCenterById: ${JSON.stringify(CostCenter)}`)
            output.data = CostCenter;
            output.message = `Cost-Center with id : ${CostCenterId} is successfully fetched`;
            
        } catch (error) {
            this.logger.warn(`getCostCenterById: ${JSON.stringify(error)}`)
            output.status = false;
            output.message = error
        }
        return output;
    }

    @ApiOperation({ summary: 'Update Cost-Center By Id' })
@ApiCreatedResponse({
    description: 'Update Cost-Center By Id',
    type: ResponseData
})
@HttpCode(HttpStatus.OK)
@Patch('update/:id')
async editCostCenter(@Param('id', ParseIntPipe) id: number, @Body() body: any) {
    this.logger.log(`editCostCenterbody: ${JSON.stringify(body)}`)
    let output = new ResponseData();
    try {
        let CostCenter = await this.costCenterService.updateCostCenter(id, body);
        this.logger.log(`editCostCenter: ${JSON.stringify(CostCenter)}`)
        if (!CostCenter) {
            this.logger.log(`editCostCenter!!: ${JSON.stringify(CostCenter)}`)
            throw 'Something went wrong';
        } else {
            this.logger.log(`editCostCenterelse: ${CostCenter}`)
        }
        output.data = CostCenter;
        output.message = `Cost-Center with id : ${id} is successfully updated`;
    } catch (error) {
        this.logger.warn(`editCostCenterError: ${JSON.stringify(error), error}`)
        output.status = false;
        if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
            this.logger.warn(`editCostCenterbadrequest: ${error}`)
            output.message = error.message;
        } else {
            output.message = "Internal Server Error";
        }
    }
    this.logger.log(`editCostCentermessage: ${output.message}`)
    return output;
}


    @ApiOperation({ summary: 'Delete Cost-Center By Id' })
    @ApiCreatedResponse({
        description: 'Delete Cost-Center By Id',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Delete('delete/:id')
    async softDelete(@Param('id', ParseIntPipe) id: number) {
        return this.costCenterService.softDelete(id);
    }

    @ApiOperation({ summary: 'Search List of Cost-Center' })
@ApiCreatedResponse({
    description: 'Search List',
    type: ResponseData
})
@HttpCode(HttpStatus.OK)
@Post('search-list')
async searchCostCenter(@Body() searchParams: SearchVesselDto) {
    const resp = new ResponseData();
    try {
        const res = await this.costCenterService.searchList(searchParams);
        this.logger.log(`Cost Center Search Data: ${JSON.stringify(res)}`);
        resp.data = res;
        resp.message = 'Cost Center Search is successfully fetched';
    } catch (error) {
        this.logger.warn(`Search Cost Center Error: ${error}`);
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

      const logs = await this.costCenterService.getAuditLogs(tableName, recordId);

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
 