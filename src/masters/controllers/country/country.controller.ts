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
import { Auth } from 'src/common/decorators/auth.decorator';
import { UserData } from 'src/common/decorators/user.decorator';
import { ResponseData } from 'src/common/response-data';
import { CountryService } from 'src/masters/services/country/country.service';
import { ApiCreatedResponse, ApiOperation } from '@nestjs/swagger';
import { SearchListDto } from 'src/masters/DTO/search-list.dto';

@Controller('country')
@Auth()
export class CountryController {
  constructor(
    private countryService: CountryService,
    private logger: Logger,
  ) {}
  @ApiOperation({ summary: 'Get All Country' })
  @ApiCreatedResponse({
    description: 'Get All Country',
    type: ResponseData,
  })
  @HttpCode(HttpStatus.OK)
  @Get()
  async getAllCountry() {
    let output = new ResponseData();
    try {
      let countryData = await this.countryService.getAllCountry();
      this.logger.log(`getAllCountry: ${JSON.stringify(countryData)}`);
      output.data = countryData;
    } catch (error) {
      this.logger.warn(`getAllCountry: ${JSON.stringify(error)}`);
      output.status = false;
      if (
        error instanceof BadRequestException ||
        error instanceof UnauthorizedException
      ) {
        output.message = error.message;
      } else {
        output.message = 'Internal Server Error';
      }
    }
    return output;
  }

  @ApiOperation({ summary: 'Country Creation' })
  @ApiCreatedResponse({
    description: 'Country Creation',
    type: ResponseData,
  })
  @HttpCode(HttpStatus.CREATED)
  @Post()
  async createCountry(@Body() body: any, @UserData() user: any) {
    this.logger.log(`createCountrynefore: ${JSON.stringify(body)}`);
    let output = new ResponseData();
    try {
      let Country = await this.countryService.createCountry(body, user);
      this.logger.debug(`createCountry:try ${JSON.stringify(Country)}`);
      if (!Country) {
        this.logger.warn(`createCountry!country: ${JSON.stringify(Country)}`);
        throw 'Something went wrong';
      }
      output.data = Country;
    } catch (error) {
      this.logger.warn(`createCountryerror: ${JSON.stringify(error)}`);
      output.status = false;
      // Handle error message based on the type of error
      if (
        error instanceof BadRequestException ||
        error instanceof UnauthorizedException
      ) {
        output.message = error.message;
      } else {
        output.message = error;
      }
    }
    return output;
  }

  @ApiOperation({ summary: 'Get Country By Id' })
  @ApiCreatedResponse({
    description: 'Get Country By Id',
    type: ResponseData,
  })
  @HttpCode(HttpStatus.OK)
  @Get(':id')
  async getCountryById(@Param('id', ParseIntPipe) unitId: number) {
    const output = new ResponseData();
    try {
      const Country = await this.countryService.findOne(unitId);
      this.logger.log(`getCountryById: ${JSON.stringify(Country)}`);
      output.data = Country;
    } catch (error) {
      this.logger.warn(`getCountryById: ${JSON.stringify(error)}`);
      output.status = false;
      output.message = error;
    }
    return output;
  }

  @ApiOperation({ summary: 'Update Country By Id' })
  @ApiCreatedResponse({
    description: 'Update Country By Id',
    type: ResponseData,
  })
  @HttpCode(HttpStatus.OK)
  @Patch(':id')
  async editCountry(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: any,
    @UserData() user: any,
  ) {
    this.logger.log(`editCountry: ${JSON.stringify(body)}`);
    let output = new ResponseData();
    try {
      let Country = await this.countryService.updateCountry(id, body, user);
      this.logger.log(`editCountry: ${JSON.stringify(Country)}`);

      if (!Country) {
        this.logger.log(`editCountry: ${JSON.stringify(Country)}`);
        throw 'Something went wrong';
      }
      output.data = Country;
    } catch (error) {
      this.logger.warn(`editCountry: ${JSON.stringify(error)}`);
      output.status = false;
      // Handle error message based on the type of error
      if (
        error instanceof BadRequestException ||
        error instanceof UnauthorizedException
      ) {
        output.message = error.message;
      } else {
        output.message = error;
      }
    }
    return output;
  }

  @ApiOperation({ summary: 'Delete Country By Id' })
  @ApiCreatedResponse({
    description: 'Delete Country By Id',
    type: ResponseData,
  })
  @HttpCode(HttpStatus.OK)
  @Delete(':id')
  async softDelete(@Param('id', ParseIntPipe) id: number) {
    return this.countryService.softDelete(id);
  }

  @ApiOperation({ summary: 'Search List of Country' })
  @ApiCreatedResponse({
    description: 'Search List of Country',
    type: ResponseData,
  })
  @HttpCode(HttpStatus.OK)
  @Post('search-list')
  async searchCountry(@Body() body: SearchListDto) {
    let resp = new ResponseData();
    try {
      this.logger.log(`Searching Country : ${JSON.stringify(body)}`);
      let res = await this.countryService.searchCountry(body);
      resp.data = res;
      resp.message = 'Country search is Successfully fetched';
    } catch (error) {
      this.logger.warn(`Searching Country Failed ${JSON.stringify(error)}`);
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
