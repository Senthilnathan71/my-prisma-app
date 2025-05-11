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
import { Auth } from 'src/common/decorators/auth.decorator';
import { UserData } from 'src/common/decorators/user.decorator';
import { ResponseData } from 'src/common/response-data';
import { SearchListDto } from 'src/masters/DTO/search-list.dto';
import { StateService } from 'src/masters/services/state/state.service';

@Controller('state')
@Auth()
export class StateController {
  constructor(
    private stateService: StateService,
    private logger: Logger,
  ) {}

  @ApiOperation({ summary: 'State Creation' })
  @ApiCreatedResponse({
    description: 'State Creation',
    type: ResponseData,
  })
  @HttpCode(HttpStatus.CREATED)
  @Post('create')
  async createState(@Body() body: any, @UserData() user: any) {
    this.logger.log(`createStatedata: ${JSON.stringify(body)}`);
    let output = new ResponseData();
    try {
      let state = await this.stateService.createState(body, user);
      this.logger.debug(`createState: ${JSON.stringify(state)}`);
      if (!state) {
        this.logger.warn(`createState!!: ${JSON.stringify(state)}`);
        throw 'Something went wrong';
      }
      output.data = state;
    } catch (error) {
      this.logger.warn(`createStateError: ${error}`);
      output.status = false;
      // Handle error message based on the type of error
      if (
        error instanceof BadRequestException ||
        error instanceof UnauthorizedException
      ) {
        output.message = error.message;
        this.logger.warn(`createStateError: ${error.message}`);
      } else {
        this.logger.warn(`createStateError: ${error}`);
        output.message = error;
      }
    }
    return output;
  }

  @ApiOperation({ summary: 'Get states by CountryMasterSid' })
  @ApiCreatedResponse({
    description: 'Get states by CountryMasterSid',
    type: ResponseData,
  })
  @HttpCode(HttpStatus.OK)
  @Get('/statesbyCountry/:CountryMasterSid')
  async getAllStateByCountry(
    @Param('CountryMasterSid', ParseIntPipe) CountryMasterSid: number,
  ) {
    const output = new ResponseData();
    try {
      const state =
        await this.stateService.getAllStateByCountry(CountryMasterSid);
      this.logger.log(`getAllStateByCountry: ${JSON.stringify(state)}`);
      output.data = state;
    } catch (error) {
      this.logger.warn(`getAllStateByCountry: ${JSON.stringify(error)}`);
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

  @ApiOperation({ summary: 'Get All State' })
  @ApiCreatedResponse({
    description: 'Get All States',
    type: ResponseData,
  })
  @HttpCode(HttpStatus.OK)
  @Get()
  async getAllStates() {
    let output = new ResponseData();
    try {
      let stateData = await this.stateService.getAllStates();
      this.logger.log(`getAllStates: ${JSON.stringify(stateData)}`);
      output.data = stateData;
    } catch (error) {
      this.logger.warn(`getAllStates: ${JSON.stringify(error)}`);
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

  @ApiOperation({ summary: 'Get State By Id' })
  @ApiCreatedResponse({
    description: 'Get State By Id',
    type: ResponseData,
  })
  @HttpCode(HttpStatus.OK)
  @Get('fetch/:id')
  async getStateById(@Param('id', ParseIntPipe) stateId: number) {
    const output = new ResponseData();
    try {
      const state = await this.stateService.findOne(stateId);
      this.logger.log(`getStateById: ${JSON.stringify(state)}`);
      output.data = state;
    } catch (error) {
      this.logger.warn(`getStateById: ${JSON.stringify(error)}`);
      output.status = false;
      output.message = error;
    }
    return output;
  }

  @ApiOperation({ summary: 'Update State By Id' })
  @ApiCreatedResponse({
    description: 'Update State By Id',
    type: ResponseData,
  })
  @HttpCode(HttpStatus.OK)
  @Patch('update/:id')
  async editState(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: any,
    @UserData() user: any,
  ) {
    this.logger.log(`editStatebody: ${JSON.stringify(body)}`);
    let output = new ResponseData();
    try {
      let state = await this.stateService.updateState(id, body, user);
      this.logger.log(`editState: ${JSON.stringify(state)}`);

      if (!state) {
        this.logger.log(`editState!!: ${JSON.stringify(state)}`);
        throw 'Something went wrong';
      } else {
        this.logger.log(`editStateelse: ${state}`);
      }
      output.data = state;
    } catch (error) {
      this.logger.warn(`editStateerror: ${(JSON.stringify(error), error)}`);
      output.status = false;
      // Handle error message based on the type of error
      if (
        error instanceof BadRequestException ||
        error instanceof UnauthorizedException
      ) {
        this.logger.warn(`editStatebadrequest: ${error}`);
        output.message = error.message;
      } else {
        output.message = error;
      }
    }
    this.logger.warn(`editStatemessage: ${output.message}`);
    return output;
  }

  @ApiOperation({ summary: 'Delete State By Id' })
  @ApiCreatedResponse({
    description: 'Delete State By Id',
    type: ResponseData,
  })
  @HttpCode(HttpStatus.OK)
  @Delete('delete/:id')
  async softDelete(@Param('id', ParseIntPipe) id: number) {
    const output = new ResponseData();
    try {
      const result = await this.stateService.softDelete(id);
      output.data = result;
    } catch (error) {
      this.logger.warn(`softDeleteError: ${error}`);
      output.status = false;
      if (
        error instanceof BadRequestException ||
        error instanceof UnauthorizedException
      ) {
        output.message = error.message;
      } else {
        output.message = 'Failed to delete state';
      }
    }
    return output;
  }

  @ApiOperation({ summary: 'Search list of States' })
  @ApiCreatedResponse({
    description: 'Search List of States',
    type: ResponseData,
  })
  @HttpCode(HttpStatus.OK)
  @Post('search-list')
  async searchState(@Body() body: SearchListDto) {
    let resp = new ResponseData();
    try {
      let res = await this.stateService.searchState(body);
      this.logger.log(`State Search Result : ${JSON.stringify(res)}`);
      resp.data = res;
      resp.message = 'State search is successfully fetched';
    } catch (error) {
      this.logger.warn(`State Search Error ${error}`);
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
