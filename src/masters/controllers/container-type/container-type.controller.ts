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
import { SearchVesselDto } from 'src/masters/DTO/search-vessel.dto';
import { ContainerTypeService } from 'src/masters/services/container-type/container-type.service';

@Controller('container-type')
export class ContainerTypeController {
  constructor(
    private containerTypeService: ContainerTypeService,
    private logger: Logger,
  ) { }

  // Create a new ContainerType

  @ApiOperation({ summary: 'Create new Container Type' })
  @ApiCreatedResponse({
    description: 'create new container type',
    type: ResponseData,
  })
  @HttpCode(HttpStatus.OK)
  @Post('create')
  async addNewContainerType(
    @Body() newData: any,
  ) {
    let resp = new ResponseData();
    this.logger.log(`newContainerTypeData: ${JSON.stringify(newData)}`);
    try {
      let res = await this.containerTypeService.createNewContainerType(newData);
      this.logger.debug(
        `createNewContainerType result: ${JSON.stringify(res)}`,
      );
      if (!res) {
        this.logger.warn(`createdContainerType!!! : ${JSON.stringify(res)}`);
        throw 'Something went wrong';
      }
      resp.data = res;
    } catch (error) {
      this.logger.warn(
        `createContainerTypeError : ${(JSON.stringify(error), error)}`,
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

  //  Getting All The Container Types

  @ApiOperation({ summary: 'Get All Container Types' })
  @ApiCreatedResponse({
    description: 'Get all the Container Types',
    type: ResponseData,
  })
  @HttpCode(HttpStatus.OK)
  @Get()
  async getAllContainerTypes() {
    let resp = new ResponseData();
    try {
      let res = await this.containerTypeService.listAllContainerTypes();
      this.logger.log(`containerTypeData : ${JSON.stringify(res)}`);
      resp.data = res;
    } catch (error) {
      this.logger.warn(
        `containerTypeGettingError : ${(JSON.stringify(error), error)}`,
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

  // Get Container Type by ID
  @ApiOperation({ summary: 'Get ContainerType By Id' })
  @ApiCreatedResponse({
    description: 'Get Container Type By Id',
    type: ResponseData,
  })
  @HttpCode(HttpStatus.OK)
  @Get('fetch/:id')
  async getContainerTypeById(@Param('id', ParseIntPipe) id: number) {
    let resp = new ResponseData();
    this.logger.log(`Going to fetch Container Type with Id : ${id}`);
    try {
      let res = await this.containerTypeService.findContainerTypeById(id);
      this.logger.debug(`containerTypeFound : ${JSON.stringify(res)}`);
      resp.data = res;
    } catch (error) {
      this.logger.warn(
        `gettingContainerTypeWithId failed: ${(JSON.stringify(error), error)}`,
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

  // Update Container Type By Id
  @ApiOperation({ summary: 'Update Container Type By Id' })
  @ApiCreatedResponse({
    description: 'Update Container type based on ID',
    type: ResponseData,
  })
  @HttpCode(HttpStatus.OK)
  @Patch('update/:id')
  async editContainerTypeById(
    @Param('id', ParseIntPipe) id: number,
    @Body() newdata: any,
  ) {
    let resp = new ResponseData();
    this.logger.log(`Going to Update ContainerType with Id : ${id}`);
    try {
      let res = await this.containerTypeService.updateContainerTypeById(
        id,
        newdata,
      );
      this.logger.debug(`updatedContainerType : ${JSON.stringify(res)}`);
      if (!res) {
        this.logger.warn(`updatingContainerType : ${JSON.stringify(res)}`);
        throw 'Something went wrong';
      }
      resp.data = res;
    } catch (error) {
      this.logger.warn(
        `updatingContainerType Failed: ${(JSON.stringify(error), error)}`,
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

  // Soft Delete Container Type By Id
  @ApiOperation({ summary: 'Delete Container Type by Id' })
  @ApiCreatedResponse({
    description: 'Delete Container Type by Id',
    type: ResponseData,
  })
  @HttpCode(HttpStatus.OK)
  @Delete('delete/:id')
  async deleteContainerTypeById(@Param('id', ParseIntPipe) id: number) {
    let resp = new ResponseData();
    this.logger.log(`Soft Delete Container with Id : ${id}`);
    try {
      let res = await this.containerTypeService.softDeleteContainerType(id);
      this.logger.debug(`softDeletedContainerType : ${JSON.stringify(res)}`);
      if (!res) {
        this.logger.warn(`softDeletion!! : ${JSON.stringify(res)}`);
        throw 'Something went wrong';
      }
      resp.data = res;
    } catch (error) {
      this.logger.warn(
        `softDeletionFailed : ${(JSON.stringify(error), error)}`,
      );
      resp.status = false;
      if (
        error instanceof BadRequestException ||
        error instanceof UnauthorizedException
      ) {
        resp.message = error.message;
      } else {
        error.message = 'Internal Server Error';
      }
    }
    return resp;
  }

  // Search Container Type
  @ApiOperation({ summary: 'Search List of Container Type' })
@ApiCreatedResponse({
    description: 'Search list of Container Type',
    type: ResponseData,
})
@HttpCode(HttpStatus.OK)
@Post('search-list')
async searchContainerType(@Body() searchParams: SearchVesselDto) {
    const resp = new ResponseData();
    try {
        const res = await this.containerTypeService.searchContainerType(searchParams);
        this.logger.log(`Container Type Search Data: ${JSON.stringify(res)}`);
        resp.data = res;
        resp.message = 'Container Type Search is successfully fetched';
    } catch (error) {
        this.logger.warn(`Search Container Type Error: ${error}`);
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
