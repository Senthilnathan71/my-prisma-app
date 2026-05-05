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
  UnauthorizedException,
  Query
} from '@nestjs/common';
import { ApiCreatedResponse, ApiOperation } from '@nestjs/swagger';
import { Auth } from 'src/common/decorators/auth.decorator';
import { UserData } from 'src/common/decorators/user.decorator';
import { ResponseData } from 'src/common/response-data';
import { SearchListDto } from 'src/masters/DTO/search-list.dto';
import { filterDto } from 'src/masters/DTO/search-vessel.dto';
import { ZoneService } from 'src/masters/services/zone/zone.service';
@Auth()
@Controller('zone')
export class ZoneController {
  constructor(
    private logger: Logger,
    private zoneService: ZoneService,
  ) { }

  @ApiOperation({ summary: 'Create new Zone' })
  @ApiCreatedResponse({
    description: 'Create new Zone',
    type: ResponseData,
  })
  @HttpCode(HttpStatus.OK)
  @Post('create')
  async createNewZone(@Body() body: any, @UserData() user: any) {
    let resp = new ResponseData();
    this.logger.log(`createNewZone data : ${JSON.stringify(body)}`);
    try {
      let res = await this.zoneService.createNewZone(body, user);
      this.logger.debug(`createdZone : ${JSON.stringify(res)}`);
      if (!res) {
        this.logger.warn(`createdZone : ${JSON.stringify(res)}`);
        throw 'Something went wrong';
      }
      resp.data = res;
      resp.message = "New Zone is successfully created"
    } catch (error) {
      this.logger.warn(
        `createNewZone failed : ${(JSON.stringify(error), error)}`,
      );
      resp.status = false;
      if (
        error instanceof BadRequestException ||
        error instanceof UnauthorizedException
      ) {
        resp.message = error.message;
      } else {
        resp.message = 'Internal Server Error';
      }
    }
    return resp;
  }

  // Get All Zones
  @ApiOperation({ summary: 'Get All Zones' })
  @ApiCreatedResponse({
    description: 'Get All Zone',
    type: ResponseData,
  })
  @HttpCode(HttpStatus.OK)
  @Get()
  async getAllZone() {
    let resp = new ResponseData();
    try {
      let res = await this.zoneService.getAllZones();
      this.logger.log(`allZoneData : ${JSON.stringify(res)}`);
      resp.data = res;
      resp.message = "All Zone are successfully fetched";
    } catch (error) {
      this.logger.warn(
        `gettingAllZone failed  ${(JSON.stringify(error), error)}`,
      );
      if (
        error instanceof BadRequestException ||
        error instanceof UnauthorizedException
      ) {
        resp.message = error.message;
      } else {
        resp.message = 'Internal Server Error';
      }
    }
    return resp;
  }

  // Get Zone by Id
  @ApiOperation({ summary: 'Get Zone by Id' })
  @ApiCreatedResponse({
    description: 'Get Zone by Id',
    type: ResponseData,
  })
  @HttpCode(HttpStatus.OK)
  @Get('fetch/:id')
  async getZoneById(@Param('id', ParseIntPipe) id: number) {
    let resp = new ResponseData();
    this.logger.log(`Fetching Zone with id : ${id}`);
    try {
      let res = await this.zoneService.getZoneById(id);
      this.logger.debug(`fetched Zone Data : ${JSON.stringify(res)}`);
      if (!res) {
        this.logger.warn(`fetched zone Date : ${JSON.stringify(res)}`);
        throw 'Something went wrong';
      }
      resp.data = res;
      resp.message = `Zone with id : ${id} is successfully fetched`;
    } catch (error) {
      this.logger.warn(
        `Fetching Zone Data failed : ${(JSON.stringify(error), error)}`,
      );
      resp.status = false;
      if (
        error instanceof BadRequestException ||
        error instanceof UnauthorizedException
      ) {
        resp.message = error.message;
      } else {
        resp.message = 'Internal Server Error';
      }
    }
    return resp;
  }

  // Edit Zone by Id
  @ApiOperation({ summary: 'Update Zone by ID' })
  @ApiCreatedResponse({
    description: 'Update Zone with Id',
    type: ResponseData,
  })
  @HttpCode(HttpStatus.OK)
  @Patch('update/:id')
  async updateZoneById(
    @Param('id', ParseIntPipe) id: number,
    @Body() newData: any,
  ) {
    let resp = new ResponseData();
    this.logger.log(
      `Going to update Data for Id ${id} with ${JSON.stringify(newData)}`,
    );
    try {
      let res = await this.zoneService.editZoneById(id, newData);
      this.logger.debug(`updatedZone : ${JSON.stringify(res)}`);
      if (!res) {
        this.logger.warn(`updatedZone!!! : ${JSON.stringify(res)}`);
        throw 'Something went wrong';
      }
      resp.data = res;
      resp.message = `Zone with id : ${id} is successfully updated`;
    } catch (error) {
      this.logger.warn(
        `updatingZone failed: ${(JSON.stringify(error), error)}`,
      );
      resp.status = false;
      if (
        error instanceof BadRequestException ||
        error instanceof UnauthorizedException
      ) {
        resp.message = error.message;
      } else {
        resp.message = 'Internal Server Error';
      }
    }
    return resp;
  }

  // Delete Zone By Id
  @ApiOperation({ summary: 'Delete Zone By Id' })
  @ApiCreatedResponse({
    description: 'Delete Zone By Id',
    type: ResponseData,
  })
  @HttpCode(HttpStatus.OK)
  @Delete('delete/:id')
  async softDeleteZone(@Param('id', ParseIntPipe) id: number) {
    let resp = new ResponseData();
    this.logger.log(`Going to delete Zone with id:${id}`);
    try {
      let deletedZone = await this.zoneService.softDeleteZone(id);
      this.logger.debug(`deletedZone : ${JSON.stringify(deletedZone)}`);
      if (!deletedZone) {
        this.logger.warn(`deletedZone!!! : ${JSON.stringify(deletedZone)}`);
        throw 'Something went wrong';
      }
      resp.data = deletedZone;
    } catch (error) {
      this.logger.warn(
        `zoneDeletion failed : ${(JSON.stringify(error), error)}`,
      );
      resp.status = false;
      if (
        error instanceof BadRequestException ||
        error instanceof UnauthorizedException
      ) {
        resp.message = error.message;
      } else {
        resp.message = 'Internal Server Error';
      }
    }
    return resp;
  }


  @ApiOperation({ summary: 'Search list of Zone' })
  @ApiCreatedResponse({
    description: 'Search List of Zone',
    type: ResponseData
  })
  @HttpCode(HttpStatus.OK)
  @Get('search-list')
  async searchZone() {
    let resp = new ResponseData();
    try {
      let res = await this.zoneService.searchZone();
      this.logger.log(`Zone Search Result ${JSON.stringify(res)}`);
      resp.data = res;
      resp.message = "Zone Search is successfully fetched"
    } catch (error) {
      this.logger.warn(`Zone Search Error ${error}`);
      resp.status = false;
      if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
        resp.message = error.message;
      } else {
        resp.message = "Internal Server Error";
      }
    }
    return resp;
  }

  @ApiOperation({ summary: 'Search List of Zones' })
  @ApiCreatedResponse({
    description: 'Search List of Zones',
    type: ResponseData,
  })
  @HttpCode(HttpStatus.OK)
  @Post('search-list')
  async searchZoneNew(@Body() searchParams: filterDto) {
    const resp = new ResponseData();
    try {
      const res = await this.zoneService.searchZoneNew(searchParams);
      this.logger.log(`Zone Search Data: ${JSON.stringify(res)}`);
      resp.data = res;
      resp.message = 'Zone Search is successfully fetched';
    } catch (error) {
      this.logger.warn(`Search Zone Error: ${error}`);
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

      const logs = await this.zoneService.getAuditLogs(tableName, recordId);

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
