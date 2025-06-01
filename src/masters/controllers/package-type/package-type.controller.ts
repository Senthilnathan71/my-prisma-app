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
import { PackageTypeService } from 'src/masters/services/package-type/package-type.service';

@Controller('package-type')
export class PackageTypeController {
  constructor(
    private packageTypeService: PackageTypeService,
    private logger: Logger,
  ) {}

  // Create new Package Type
  @ApiOperation({ summary: 'Create a new Package Type' })
  @ApiCreatedResponse({
    description: 'Create a new Package Type',
    type: ResponseData,
  })
  @HttpCode(HttpStatus.OK)
  @Post('create')
  async createNewPackageType(
    @Body() newData:any,
  ) {
    let resp = new ResponseData();
    this.logger.log(`createPackageTypeData: ${JSON.stringify(newData)}`);
    try {
      let res = await this.packageTypeService.createPackageType(newData);
      this.logger.debug(`new Package Type Created : ${JSON.stringify(res)}`);
      if (!res) {
        this.logger.warn(`PackageTypeCreated!! : ${res}`);
        throw 'Something went wrong';
      }
      resp.data = res;
    } catch (error) {
      this.logger.warn(
        `Package type create Failed : ${(JSON.stringify(error), error)}`,
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

  // Get All Package Types
  @ApiOperation({ summary: 'Get all Package Types' })
  @ApiCreatedResponse({
    description: 'Get All Package Types',
    type: ResponseData,
  })
  @HttpCode(HttpStatus.OK)
  @Get()
  async getAllPackageTypes() {
    let resp = new ResponseData();
    try {
      let res = await this.packageTypeService.getAllPackageType();
      this.logger.log(`All Package Types : ${JSON.stringify(res)}`);
      resp.data = res;
    } catch (error) {
      this.logger.warn(`Getting All Package Types Failed`);
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

  // Get Package Type
  @ApiOperation({ summary: 'Get Package Type by Id' })
  @ApiCreatedResponse({
    description: 'Get Package Type by Id',
    type: ResponseData,
  })
  @HttpCode(HttpStatus.OK)
  @Get('fetch/:id')
  async getPackageTypeById(@Param('id', ParseIntPipe) id: number) {
    let resp = new ResponseData();
    this.logger.log(`Getting Package Type by Id : ${id}`);
    try {
      let res = await this.packageTypeService.getPackageTypeById(id);
      this.logger.debug(
        `Package Type with id : ${id} is ${JSON.stringify(res)}`,
      );
      if (!res) {
        this.logger.warn(`PackageTypeFound : ${JSON.stringify(res)} `);
        throw ' Something went wrong';
      }
      resp.data = res;
    } catch (error) {
      this.logger.warn(`Getting Package Type by Id : ${id} failed`);
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

  // Update Package Type by Id
  @ApiOperation({ summary: 'Updating Package type by Id' })
  @ApiCreatedResponse({
    description: 'Updating Package Type by Id',
    type: ResponseData,
  })
  @HttpCode(HttpStatus.OK)
  @Patch('update/:id')
  async updatePackageTypeById(
    @Param('id', ParseIntPipe) id: number,
    @Body() newData:any,
  ) {
    let resp = new ResponseData();
    this.logger.log(`Going to Update Package Type with id : ${id}`);
    try {
      let res = await this.packageTypeService.editPackageTypeById(id, newData);
      this.logger.debug(`UpdatedPackageType : ${JSON.stringify(res)}`);
      if (!res) {
        this.logger.warn(`PackageType updation !! : ${JSON.stringify(res)}`);
        throw 'Something went wrong';
      }
      resp.data = res;
    } catch (error) {
      this.logger.warn(
        `Updating Package Type Failed : ${(JSON.stringify(error), error)}`,
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

  // Deleting Package Type with id
  @ApiOperation({ summary: 'Deleting Package Type with Id' })
  @ApiCreatedResponse({
    description: 'Delete Package Type with id',
    type: ResponseData,
  })
  @HttpCode(HttpStatus.OK)
  @Delete('delete/:id')
  async deletePackageTypeById(@Param('id', ParseIntPipe) id: number) {
    let resp = new ResponseData();
    this.logger.log(`Going to delete Package Type with id : ${id}`);
    try {
      let res = await this.packageTypeService.softDeletePackageType(id);
      this.logger.debug(`deleted Package Type : ${JSON.stringify(res)}`);
      if (!res) {
        this.logger.warn(`deleting Package Type !! : ${JSON.stringify(res)}`);
        throw 'Something went wrong';
      }
      resp.data = res;
    } catch (error) {
      this.logger.warn(
        `deletingPackageType failed : ${(JSON.stringify(error), error)}`,
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

  @ApiOperation({ summary: 'Search List for Package Type' })
  @ApiCreatedResponse({
    description: 'Search Type for Package Type',
    type: ResponseData,
  })
  @HttpCode(HttpStatus.OK)
  @Post('search-list')
  async searchPackageType(@Body() body: SearchListDto) {
    let resp = new ResponseData();
    try {
      let res = await this.packageTypeService.searchPackageType(body);
      this.logger.log(`Package Type SearchData : ${JSON.stringify(res)}`);
      resp.data = res;
      resp.message = 'PackageType Search is successfully fetched';
    } catch (error) {
      this.logger.warn(
        `PackageType Search Error : ${(JSON.stringify(error), error)}`,
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
}
