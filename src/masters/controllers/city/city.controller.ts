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
import { UserData } from 'src/common/decorators/user.decorator';
import { ResponseData } from 'src/common/response-data';
import { SearchListDto } from 'src/masters/DTO/search-list.dto';
import { SearchVesselDto } from 'src/masters/DTO/search-vessel.dto';
import { CityService } from 'src/masters/services/city/city.service';

@Controller('city')
export class CityController {
  constructor(
    private cityService: CityService,
    private logger: Logger,
  ) {}

  //   Getting all cities

  @ApiOperation({ summary: 'Get All the cities' })
  @ApiCreatedResponse({
    description: 'Get All the cities',
    type: ResponseData,
  })
  @HttpCode(HttpStatus.OK)
  @Get()
  async getAllCities() {
    let resp = new ResponseData();
    try {
      let cityData = await this.cityService.getAllCity();
      this.logger.log(`getCityData : ${JSON.stringify(cityData)}`);
      resp.data = cityData;
       resp.message = "All Citys are successfully fetched";
    } catch (error) {
      this.logger.warn(`GetCityError : ${JSON.stringify(error)}`);
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

  // Getting city by its id

  @ApiOperation({ summary: 'Get City by City ID' })
  @ApiCreatedResponse({
    description: 'Get City by City ID',
    type: ResponseData,
  })
  @HttpCode(HttpStatus.OK)
  @Get('cityId/:CityMasterSid')
  async getCityByCityID(@Param('CityMasterSid', ParseIntPipe) cityId: number) {
    let resp = new ResponseData();
    try {
      let result = await this.cityService.findCityByCityId(cityId);
      this.logger.log(`getCityData: ${JSON.stringify(result)}`);
      resp.data = result;
      resp.message = `City with id : ${cityId} is successfully fetched`;

    } catch (error) {
      this.logger.warn(`getCityError : ${JSON.stringify(error)}`);
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
  // Getting city by its State id

  @ApiOperation({ summary: 'Get City by State ID' })
  @ApiCreatedResponse({
    description: 'Get City by State ID',
    type: ResponseData,
  })
  @HttpCode(HttpStatus.OK)
  @Get('fetchByState/:StateMasterSid')
  async getCityByStateID(@Param('StateMasterSid', ParseIntPipe) stateId: number) {
    let resp = new ResponseData();
    try {
      let result = await this.cityService.findCityByStateId(stateId);
      this.logger.log(`getCityByStateData: ${JSON.stringify(result)}`);
      resp.data = result;
      resp.message = `Fetch All Cities with State Id : ${stateId}`
    } catch (error) {
      this.logger.warn(`getCityByStateError : ${JSON.stringify(error),error}`);
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

  // Post new City

  @ApiOperation({ summary: 'Create new City' })
  @ApiCreatedResponse({
    description: 'Create new City',
    type: ResponseData,
  })
  @HttpCode(HttpStatus.CREATED)
  @Post('add')
  async addNewCity(@Body() body: any,@UserData() user: any) {
    this.logger.log(`createCityData : ${JSON.stringify(body)}`);
    const resp = new ResponseData();
    try {
      let res = await this.cityService.addCity(body, user);
      this.logger.log(`createdCity : ${JSON.stringify(res)}`);
      resp.data = res;
      resp.message = "New City is successfully created"
      }
      catch (error) {
      this.logger.warn(`createCityError : ${JSON.stringify(error)}`);
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

  // Update Existing City
  @ApiOperation({ summary: 'Update existing City' })
  @ApiCreatedResponse({
    description: 'Update City Data',
    type: ResponseData,
  })
  @HttpCode(HttpStatus.OK)
  @Patch('update/:id')
  async updateCityByID(
    @Param('id', ParseIntPipe) id: number,
    @Body() newData: any,
  ) {
    let resp = new ResponseData();
    this.logger.log(`updateCityData : ${JSON.stringify(newData)}`);
    try {
      let newCity = await this.cityService.updateCityById(id, newData);
      this.logger.debug(`updatedCity : ${JSON.stringify(newCity)}`);
      if (!newCity) {
        this.logger.warn(`updateCity!! : ${JSON.stringify(newCity)}`);
        throw 'Something went wrong';
      }
      resp.data = newCity;
      resp.message = `City with id : ${id} is successfully updated`;
    } catch (error) {
      this.logger.warn(`updateCityError : ${JSON.stringify(error)}`);
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

  // Delete City By Id
  @ApiOperation({ summary: 'Delete City by Id' })
  @ApiCreatedResponse({
    description: 'Delete City by Id',
    type: ResponseData,
  })
  @HttpCode(HttpStatus.OK)
  @Delete('delete/:id')
  async deleteCityByID(@Param('id', ParseIntPipe) id: number) {
    let resp = new ResponseData();
    try {
     this.logger.log(`Deleting City with id: ${id}`);
     let res = await this.cityService.softDeleteCity(id);
     this.logger.debug(`City Deleted: ${JSON.stringify(res)}`);
     resp.data = res;
     resp.message = "City is successfully deleted"
    } catch (error) {
      this.logger.warn(`cityDeletionFailed : ${JSON.stringify(error)}`);
      resp.status = false;
      if (error instanceof UnauthorizedException) {
        resp.message = error.message;
      } else {
        resp.message = 'Internal Server Error';
      }
    }
    return resp;
  }

  @ApiOperation({ summary: 'Search List of Cities' })
@ApiCreatedResponse({
    description: 'Search List of Cities',
    type: ResponseData,
})
@HttpCode(HttpStatus.OK)
@Post('search-list')
async searchCity(@Body() searchParams: SearchVesselDto) {
    const resp = new ResponseData();
    try {
        const res = await this.cityService.searchCityList(searchParams);
        this.logger.log(`City Search Data: ${JSON.stringify(res)}`);
        resp.data = res;
        resp.message = 'City Search is successfully fetched'; 
    } catch (error) {
        this.logger.warn(`Search City Error: ${error}`);
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

      const logs = await this.cityService.getAuditLogs(tableName, recordId);

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
