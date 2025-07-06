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
} from '@nestjs/common';
import { ApiCreatedResponse, ApiOperation } from '@nestjs/swagger';
import { ResponseData } from 'src/common/response-data';
import { SearchListDto } from 'src/masters/DTO/search-list.dto';
import { ZoneService } from 'src/masters/services/zone/zone.service';

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
  async createNewZone(@Body() newData:any) {
    let resp = new ResponseData();
    this.logger.log(`createNewZone data : ${JSON.stringify(newData)}`);
    try {
      let res = await this.zoneService.createNewZone(newData);
      this.logger.debug(`createdZone : ${JSON.stringify(res)}`);
      if (!res) {
        this.logger.warn(`createdZone : ${JSON.stringify(res)}`);
        throw 'Something went wrong';
      }
      resp.data = res;
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
}
