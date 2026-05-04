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
import { ApiOperation, ApiCreatedResponse } from '@nestjs/swagger';
import e from 'express';
import { Auth } from 'src/common/decorators/auth.decorator';
import { UserData } from 'src/common/decorators/user.decorator';
import { ResponseData } from 'src/common/response-data';
import { SearchListDto } from 'src/masters/DTO/search-list.dto';
import { filterDto } from 'src/masters/DTO/search-vessel.dto';
import { CurrencyService } from 'src/masters/services/currency/currency.service';
@Auth()
@Controller('currency')
export class CurrencyController {
  constructor(
    private currencyService: CurrencyService,
    private logger: Logger,
  ) { }

  @ApiOperation({ summary: 'Currency Creation' })
  @ApiCreatedResponse({
    description: 'Currency Creation',
    type: ResponseData,
  })
  @HttpCode(HttpStatus.CREATED)
  @Post('create')
  async createCurrency(
    @Body() body: any,

  ) {
    this.logger.log(`createCurrencyData: ${JSON.stringify(body)}`);
    let output = new ResponseData();
    try {
      let currency = await this.currencyService.createCurrency(body);
      this.logger.log(`createCurrency: ${JSON.stringify(currency)}`);
      if (!currency) {
        this.logger.debug(`createCurrency!!: ${JSON.stringify(currency)}`);
        throw 'Something went wrong';
      }
      output.data = currency;
      output.message = "New Currency is successfully created"
    } catch (error) {
      this.logger.warn(`createCurrencyError: ${error}`);
      output.status = false;
      // Handle error message based on the type of error
      if (
        error instanceof BadRequestException ||
        error instanceof UnauthorizedException
      ) {
        output.message = error.message;
        this.logger.warn(`createCurrencyError: ${error.message}`);
      } else {
        this.logger.warn(`createCurrencyError: ${error}`);
        output.message = error;
      }
    }
    return output;
  }

  @ApiOperation({ summary: 'Get All Currency' })
  @ApiCreatedResponse({
    description: 'Get All Currencys',
    type: ResponseData,
  })
  @HttpCode(HttpStatus.OK)
  @Get()
  async getAllCurrencys() {
    let output = new ResponseData();
    try {
      let currencyData = await this.currencyService.getAllCurrencys();
      this.logger.log(`getAllCurrencys: ${JSON.stringify(currencyData)}`);
      output.data = currencyData;
      output.message = "All Currency are successfully fetched";
    } catch (error) {
      this.logger.warn(`getAllCurrencys: ${JSON.stringify(error)}`);
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

  @ApiOperation({ summary: 'Get Currency By Id' })
  @ApiCreatedResponse({
    description: 'Get Currency By Id',
    type: ResponseData,
  })
  @HttpCode(HttpStatus.OK)
  @Get('fetch/:id')
  async getCurrencyById(@Param('id', ParseIntPipe) CurrencyId: number) {
    const output = new ResponseData();
    try {
      const currency = await this.currencyService.findOne(CurrencyId);
      this.logger.log(`getCurrencyById: ${JSON.stringify(currency)}`);
      output.data = currency;
      output.message = `Currency with id : ${CurrencyId} is successfully fetched`;
    } catch (error) {
      this.logger.warn(`getCurrencyById Error: ${JSON.stringify(error)}`);
      output.status = false;
      if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
        output.message = error.message;
      } else {
        output.message = "Internal Server Error";
      }
    }
    return output;
  }

  @ApiOperation({ summary: 'Update Currency By Id' })
  @ApiCreatedResponse({
    description: 'Update Currency By Id',
    type: ResponseData,
  })
  @HttpCode(HttpStatus.OK)
  @Patch('update/:id')
  async editCurrency(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: any,

  ) {
    this.logger.log(`editCurrencybody: ${JSON.stringify(body)}`);
    let output = new ResponseData();
    try {
      let currency = await this.currencyService.updateCurrency(id, body);
      this.logger.log(`editCurrency: ${JSON.stringify(currency)}`);

      if (!currency) {
        this.logger.log(`editCurrency!!: ${JSON.stringify(currency)}`);
        throw 'Something went wrong';
      } else {
        this.logger.log(`editCurrencyelse: ${currency}`);
      }
      output.data = currency;
      output.message = `Currency with id : ${id} is successfully updated`;
    } catch (error) {
      this.logger.warn(`editCurrencyerror: ${(JSON.stringify(error), error)}`);
      output.status = false;
      // Handle error message based on the type of error
      if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
        output.message = error.message;
      } else {
        output.message = "Internal Server Error";
      }
    }
    return output;
  }

  @ApiOperation({ summary: 'Delete Currency By Id' })
  @ApiCreatedResponse({
    description: 'Delete Currency By Id',
    type: ResponseData,
  })
  @HttpCode(HttpStatus.OK)
  @Delete('delete/:id')
  async softDelete(@Param('id', ParseIntPipe) id: number) {
    return this.currencyService.softDelete(id);
  }

  @ApiOperation({ summary: 'Search List of Currencies' })
  @ApiCreatedResponse({
    description: 'Search List of Currencies',
    type: ResponseData,
  })
  @HttpCode(HttpStatus.OK)
  @Post('search-list')
  async searchCurrency(@Body() searchParams: filterDto) {
    const resp = new ResponseData();
    try {
      const res = await this.currencyService.searchCurrency(searchParams);
      this.logger.log(`Currency Search Data: ${JSON.stringify(res)}`);
      resp.data = res;
      resp.message = 'Currency Search is successfully fetched';
    } catch (error) {
      this.logger.warn(`Search Currency Error: ${error}`);
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

      const logs = await this.currencyService.getAuditLogs(tableName, recordId);

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
