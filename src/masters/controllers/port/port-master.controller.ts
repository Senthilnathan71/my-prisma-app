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
import { PortService } from 'src/masters/services/port/port-master.service';
@Auth()
@Controller('port')

export class PortMasterController {
  constructor(
    private portService: PortService,
    private logger: Logger,
  ) { }

  @ApiOperation({ summary: 'Get All Ports' })
  @ApiCreatedResponse({
    description: 'Get All Ports',
    type: ResponseData,
  })
  @HttpCode(HttpStatus.OK)
  @Get()
  async getAllPorts() {
    const output = new ResponseData();
    try {
      const ports = await this.portService.getAllPorts();
      this.logger.log(`getAllPorts: ${JSON.stringify(ports)}`);
      output.data = ports;
      output.message = "All Ports are successfully fetched";
    } catch (error) {
      this.logger.warn(`getAllPorts: ${JSON.stringify(error)}`);
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

  @ApiOperation({ summary: 'Get Backend Filtered Ports' })
  @ApiCreatedResponse({
    description: 'Get Backend Filtered Ports',
    type: ResponseData,
  })
  @HttpCode(HttpStatus.OK)
  @Post('filtered-list')
  async getFilteredPorts(@Body() body: any) {
    const output = new ResponseData();
    try {
      const ports = await this.portService.getFilteredPorts(body);
      output.data = ports;
      output.message = 'Filtered ports are successfully fetched';
    } catch (error) {
      this.logger.warn(`getFilteredPorts: ${JSON.stringify(error)}`);
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

  @ApiOperation({ summary: 'Port Creation' })
  @ApiCreatedResponse({
    description: 'Port Creation',
    type: ResponseData,
  })
  @HttpCode(HttpStatus.CREATED)
  @Post()
  async createPort(@Body() body: any) {
    this.logger.log(`createPortdata: ${JSON.stringify(body)}`);
    let output = new ResponseData();
    try {
      let port = await this.portService.createPort(body);
      this.logger.debug(`createPorttry: ${JSON.stringify(port)}`);
      if (!port) {
        this.logger.warn(`createPorterror!!: ${JSON.stringify(port)}`);
        throw 'Something went wrong';
      }
      output.data = port;
      output.message = "New Port is successfully created"
    } catch (error) {
      this.logger.warn(`createporterror: ${error}`);
      output.status = false;
      // Handle error message based on the type of error
      if (
        error instanceof BadRequestException ||
        error instanceof UnauthorizedException
      ) {
        output.message = error.message;
        this.logger.warn(`createportexception: ${error.message}`);
      } else {
        output.message = "Internal Server Error";
      }
    }
    return output;
  }

  @ApiOperation({ summary: 'Get Port By Id' })
  @ApiCreatedResponse({
    description: 'Get Port By Id',
    type: ResponseData,
  })
  @HttpCode(HttpStatus.OK)
  @Get(':id')
  async getPortById(@Param('id', ParseIntPipe) portId: number) {
    const output = new ResponseData();
    try {
      const port = await this.portService.findOne(portId);
      this.logger.log(`getPortById: ${JSON.stringify(port)}`);
      output.data = port;
      output.message = `Port with id : ${portId} is successfully fetched`;
    } catch (error) {
      this.logger.warn(`getPortById: ${JSON.stringify(error)}`);
      output.status = false;
      output.message = error;
    }
    return output;
  }

  @ApiOperation({ summary: 'Update Port By Id' })
  @ApiCreatedResponse({
    description: 'Update Port By Id',
    type: ResponseData,
  })
  @HttpCode(HttpStatus.OK)
  @Patch(':id')
  async editPort(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: any,

  ) {
    this.logger.log(`editPortbody: ${JSON.stringify(body)}`);
    let output = new ResponseData();
    try {
      let port = await this.portService.updatePort(id, body);
      this.logger.log(`editPort: ${JSON.stringify(port)}`);

      if (!port) {
        this.logger.log(`editPort!!: ${JSON.stringify(port)}`);
        throw 'Something went wrong';
      } else {
        this.logger.log(`editPortelse: ${port}`);
      }
      output.data = port;
      output.message = `Port with id : ${id} is successfully updated`;
    } catch (error) {
      this.logger.warn(`editPorterror: ${(JSON.stringify(error), error)}`);
      output.status = false;
      // Handle error message based on the type of error
      if (
        error instanceof BadRequestException ||
        error instanceof UnauthorizedException
      ) {
        this.logger.warn(`editPortbadrequest: ${error}`);
        output.message = error.message;
      } else {
        output.message = "Internal Server Error";
      }
    }
    this.logger.warn(`editPortmessage: ${output.message}`);
    return output;
  }

  @ApiOperation({ summary: 'Delete Port By Id' })
  @ApiCreatedResponse({
    description: 'Delete Port By Id',
    type: ResponseData,
  })
  @HttpCode(HttpStatus.OK)
  @Delete(':id')
  async softDelete(@Param('id', ParseIntPipe) id: number) {
    return this.portService.softDelete(id);
  }

  @ApiOperation({ summary: 'Search List of Ports' })
  @ApiCreatedResponse({
    description: 'Search List of Ports',
    type: ResponseData,
  })
  @HttpCode(HttpStatus.OK)
  @Post('search-list')
  async searchPortNew(@Body() searchParams: filterDto) {
    const resp = new ResponseData();
    try {
      const res = await this.portService.searchPortNew(searchParams);
      this.logger.log(`PortSearchResult : ${JSON.stringify(res)}`);
      resp.data = res;
      resp.message = 'Port Search is successfully fetched';
    } catch (error) {
      this.logger.warn(`Search Port Error ${error}`);
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

      const logs = await this.portService.getAuditLogs(tableName, recordId);

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
