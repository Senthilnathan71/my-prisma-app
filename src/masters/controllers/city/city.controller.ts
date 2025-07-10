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
  async addNewCity(@Body() cityObj: any) {
    this.logger.log(`createCityData : ${JSON.stringify(cityObj)}`);
    const resp = new ResponseData();
    try {
      let res = await this.cityService.addCity(cityObj);
      this.logger.debug(`createdCity : ${JSON.stringify(res)}`);
      if (!res) {
        this.logger.warn(`createdCityData : ${JSON.stringify(res)}`);
        throw 'Something went wrong';
      }
      resp.data = res;
    } catch (error) {
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
    this.logger.log(`City with Id=${id} is going to be Deleted`);
    try {
      const deletedCity = await this.cityService.deleteCityById(id);
      this.logger.debug(`CityDeleted : ${JSON.stringify(deletedCity)}`);
      resp.data = deletedCity;
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
}
