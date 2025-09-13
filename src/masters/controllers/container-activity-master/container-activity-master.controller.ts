import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Logger,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiCreatedResponse, ApiOperation } from '@nestjs/swagger';
import { ResponseData } from 'src/common/response-data';
import { filterDto } from 'src/masters/DTO/search-vessel.dto';
import { ContainerActivityMasterService } from 'src/masters/services/container-activity-master/container-activity-master.service';

@Controller('container-activity-master')
export class ContainerActivityMasterController {
  constructor(
    private containerActivityMasterService: ContainerActivityMasterService,
    private logger: Logger,
  ) { }

  @ApiOperation({ summary: 'Create new Container Activity (with nextActivities)' })
  @ApiCreatedResponse({
    description: 'Create new Container Activity',
    type: ResponseData,
  })
  @HttpCode(HttpStatus.OK)
  @Post('create')
  async createNewContainerActivity(@Body() newData: any) {
    let resp = new ResponseData();
    try {
      let res = await this.containerActivityMasterService.createNewContainerActivity(newData);
      this.logger.log(`New Container Activity Created : ${JSON.stringify(res)}`);
      resp.data = res;
      resp.message = 'New Container Activity is successfully created';
    } catch (error) {
      this.logger.warn(`Container Activity Creation Error : ${JSON.stringify(error), error}`);
      resp.status = false;
      resp.message = error.message || 'Internal Server Error';
    }
    return resp;
  }

  @ApiOperation({ summary: 'Get All Container Activities' })
  @ApiCreatedResponse({
    description: 'Get All Container Activities',
    type: ResponseData,
  })
  @HttpCode(HttpStatus.OK)
  @Get()
  async getAllContainerActivities() {
    let resp = new ResponseData();
    try {
      let res = await this.containerActivityMasterService.getAllContainerActivities();
      this.logger.log(`All Container Activities Fetched : ${JSON.stringify(res)}`);
      resp.data = res;
      resp.message = 'All Container Activities are successfully fetched';
    } catch (error) {
      this.logger.warn(`Get All Container Activities Error : ${JSON.stringify(error), error}`);
      resp.status = false;
      resp.message = error.message || 'Internal Server Error';
    }
    return resp;
  }

  @ApiOperation({ summary: 'Get Container Activity by Id (with nextActivities)' })
  @ApiCreatedResponse({
    description: 'Get Container Activity by Id',
    type: ResponseData,
  })
  @HttpCode(HttpStatus.OK)
  @Get('fetch/:ContainerActivityMasterSid')
  async getContainerActivityById(
    @Param('ContainerActivityMasterSid', ParseIntPipe) ContainerActivityMasterSid: number,
  ) {
    let resp = new ResponseData();
    try {
      this.logger.log(`Getting Container Activity with id : ${ContainerActivityMasterSid}`);
      let res = await this.containerActivityMasterService.fetchContainerActivityById(
        ContainerActivityMasterSid,
      );
      this.logger.debug(`Fetched Container Activity : ${JSON.stringify(res)}`);
      resp.data = res;
      resp.message = `Container Activity with id : ${ContainerActivityMasterSid} is successfully fetched`;
    } catch (error) {
      this.logger.warn(`Get Container Activity by Id Error : ${JSON.stringify(error), error}`);
      resp.status = false;
      resp.message = error.message || 'Internal Server Error';
    }
    return resp;
  }

  @ApiOperation({ summary: 'Update Container Activity by Id (with nextActivities)' })
  @ApiCreatedResponse({
    description: 'Update Container Activity by Id',
    type: ResponseData,
  })
  @HttpCode(HttpStatus.OK)
  @Patch('update/:ContainerActivityMasterSid')
  async updateContainerActivityById(
    @Param('ContainerActivityMasterSid', ParseIntPipe) id: number,
    @Body() payload: any,
  ) {
    let resp = new ResponseData();
    try {
      this.logger.log(`Updating Container Activity with id : ${id}`);
      let res = await this.containerActivityMasterService.updateContainerActivityById(id, payload);
      this.logger.debug(`Updated Container Activity : ${JSON.stringify(res)}`);
      resp.data = res;
      resp.message = `Container Activity with id : ${id} is successfully updated`;
    } catch (error) {
      this.logger.warn(`Container Activity Updation Error : ${JSON.stringify(error), error}`);
      resp.status = false;
      resp.message = error.message || 'Internal Server Error';
    }
    return resp;
  }

  @ApiOperation({ summary: 'Delete Container Activity by Id (soft delete)' })
  @ApiCreatedResponse({
    description: 'Delete Container Activity by Id',
    type: ResponseData,
  })
  @HttpCode(HttpStatus.OK)
  @Delete('delete/:ContainerActivityMasterSid')
  async deleteContainerActivityById(
    @Param('ContainerActivityMasterSid', ParseIntPipe) ContainerActivityMasterSid: number,
  ) {
    let resp = new ResponseData();
    try {
      this.logger.log(`Deleting Container Activity with id : ${ContainerActivityMasterSid}`);
      let res = await this.containerActivityMasterService.deleteContainerActivity(
        ContainerActivityMasterSid,
      );
      this.logger.debug(`Deleted Container Activity : ${JSON.stringify(res)}`);
      resp.data = res;
      resp.message = `Container Activity with id : ${ContainerActivityMasterSid} is successfully deleted`;
    } catch (error) {
      this.logger.warn(`Container Activity Deletion Error : ${JSON.stringify(error), error}`);
      resp.status = false;
      resp.message = error.message || 'Internal Server Error';
    }
    return resp;
  }

  @ApiOperation({ summary: 'Search List of Container Activities' })
  @ApiCreatedResponse({
    description: 'Search List of Container Activities',
    type: ResponseData,
  })
  @HttpCode(HttpStatus.OK)
  @Post('search-list')
  async searchContainerActivities(@Body() searchData: filterDto) {
    let resp = new ResponseData();
    try {
      let res = await this.containerActivityMasterService.searchContainerActivities(searchData);
      this.logger.log(`Container Activity Search Results :${JSON.stringify(res)}`);
      resp.data = res;
      resp.message = 'Container Activity Search results are successfully fetched';
    } catch (error) {
      this.logger.warn(`Container Activity Search Error : ${JSON.stringify(error), error}`);
      resp.status = false;
      resp.message = error.message || 'Internal Server Error';
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

      const logs = await this.containerActivityMasterService.getAuditLogs(tableName, recordId);

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
