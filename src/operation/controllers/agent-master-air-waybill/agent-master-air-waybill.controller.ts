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
import { ResponseData } from 'src/common/response-data';
import { Auth } from 'src/common/decorators/auth.decorator';
import { AgentMasterAirWaybillService } from 'src/operation/services/agent-master-air-waybill/agent-master-air-waybill.service';


@Controller('agent-master-air-waybill')
export class AgentMasterAirWaybillController {
  private readonly logger = new Logger(AgentMasterAirWaybillController.name);

  constructor(
    private readonly agentMasterAirWaybillService: AgentMasterAirWaybillService,
  ) {}

  @ApiOperation({ summary: 'Create Agent Master Air Waybill' })
  @ApiCreatedResponse({
    description: 'Agent Master Air Waybill Created Successfully',
    type: ResponseData,
  })
  @HttpCode(HttpStatus.CREATED)
  @Post('create')
  async create(@Body() payload: any) {
    const output = new ResponseData();
    try {
      const result = await this.agentMasterAirWaybillService.createAgentMasterAirWaybill(payload);
      output.data = result;
      output.message = 'Agent Master Air Waybill Created Successfully';
    } catch (error) {
      this.logger.error(`Agent Master Air Waybill Create Failed - ${error.message}`);
      output.status = false;
      if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
        output.message = error.message;
      } else {
        output.message = 'Internal Server Error';
      }
    }
    return output;
  }

  @ApiOperation({ summary: 'Fetch Agent Master Air Waybill By ID' })
  @ApiCreatedResponse({
    description: 'Agent Master Air Waybill Data Fetched Successfully',
    type: ResponseData,
  })
  @HttpCode(HttpStatus.OK)
  @Get('fetch/:id')
  async findOne(@Param('id', ParseIntPipe) id: number) {
    const output = new ResponseData();
    try {
      const result = await this.agentMasterAirWaybillService.fetchAgentMasterAirWaybillById(id);
      output.data = result;
      output.message = 'Agent Master Air Waybill Data Fetched Successfully';
    } catch (error) {
      this.logger.error(`Agent Master Air Waybill Data Fetch Failed - ${error.message}`);
      output.status = false;
      if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
        output.message = error.message;
      } else {
        output.message = 'Internal Server Error';
      }
    }
    return output;
  }

  @ApiOperation({ summary: 'Update Agent Master Air Waybill By ID' })
  @ApiCreatedResponse({
    description: 'Agent Master Air Waybill Updated Successfully',
    type: ResponseData,
  })
  @HttpCode(HttpStatus.OK)
  @Patch('update/:id')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() payload: any,
  ) {
    const output = new ResponseData();
    try {
      const result = await this.agentMasterAirWaybillService.updateAgentMasterAirWaybill(id, payload);
      output.data = result;
      output.message = 'Agent Master Air Waybill Updated Successfully';
    } catch (error) {
      this.logger.error(`Agent Master Air Waybill Update Failed - ${error.message}`);
      output.status = false;
      if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
        output.message = error.message;
      } else {
        output.message = 'Internal Server Error';
      }
    }
    return output;
  }

  @ApiOperation({ summary: 'Search Agent Master Air Waybill' })
  @ApiCreatedResponse({
    description: 'Agent Master Air Waybill Data Fetched Successfully',
    type: ResponseData,
  })
  @HttpCode(HttpStatus.OK)
  @Post('search')
  async search(@Body() payload: any) {
    const output = new ResponseData();
    try {
      const result = await this.agentMasterAirWaybillService.searchAgentMasterAirWaybill(payload);
      output.data = result;
      output.message = 'Agent Master Air Waybill Data Fetched Successfully';
    } catch (error) {
      this.logger.error(`Agent Master Air Waybill Search Failed - ${error.message}`);
      output.status = false;
      if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
        output.message = error.message;
      } else {
        output.message = 'Internal Server Error';
      }
    }
    return output;
  }

  @ApiOperation({ summary: 'Delete Agent Master Air Waybill' })
  @ApiCreatedResponse({
    description: 'Agent Master Air Waybill Deleted Successfully',
    type: ResponseData,
  })
  @HttpCode(HttpStatus.OK)
  @Delete('delete/:id')
  async delete(
    @Param('id', ParseIntPipe) id: number,
    @Body() payload: any,
  ) {
    const output = new ResponseData();
    try {
      const result = await this.agentMasterAirWaybillService.deleteAgentMasterAirWaybill(id, payload);
      output.data = result;
      output.message = 'Agent Master Air Waybill Deleted Successfully';
    } catch (error) {
      this.logger.error(`Agent Master Air Waybill Delete Failed - ${error.message}`);
      output.status = false;
      if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
        output.message = error.message;
      } else {
        output.message = 'Internal Server Error';
      }
    }
    return output;
  }
}
