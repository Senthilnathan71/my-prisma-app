import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiOperation,
  ApiTags,
  ApiCreatedResponse,
  ApiOkResponse,
} from '@nestjs/swagger';
import { ResponseData } from 'src/common/response-data';
import { Auth } from 'src/common/decorators/auth.decorator';
import { CreateCustomsDto, UpdateCustomsDto } from 'src/operation/DTO/customs.dto';
import { CustomsService } from 'src/operation/services/customs/customs.service';

@ApiTags('HouseJob Customs')
@Auth()
@Controller('customs')
export class CustomsController {
  constructor(private readonly customsService: CustomsService) {}

  @Post('create')
  @ApiOperation({ summary: 'Create Customs Record' })
  @ApiCreatedResponse({ description: 'Customs Created Successfully', type: ResponseData })
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() dto: CreateCustomsDto) {
    const resp = new ResponseData();
    try {
      resp.data = await this.customsService.create(dto);
      resp.message = 'Customs created successfully';
    } catch (err) {
      resp.status = false;
      resp.message = err.message;
    }
    return resp;
  }

  @Get()
  @ApiOperation({ summary: 'Get all active Customs records' })
  @ApiOkResponse({ description: 'List of Customs records', type: ResponseData })
  async findAll() {
    const resp = new ResponseData();
    try {
      resp.data = await this.customsService.findAll();
      resp.message = 'Customs records fetched successfully';
    } catch (err) {
      resp.status = false;
      resp.message = err.message;
    }
    return resp;
  }

  @Get('house-job/:houseJobSid')
  @ApiOperation({ summary: 'Get Customs by HouseJobSid' })
  @ApiOkResponse({ description: 'Customs records for house job fetched', type: ResponseData })
  async findByHouseJobSid(@Param('houseJobSid') houseJobSid: string) {
    const resp = new ResponseData();
    try {
      resp.data = await this.customsService.findByHouseJobSid(Number(houseJobSid));
      resp.message = 'Customs records fetched successfully';
    } catch (err) {
      resp.status = false;
      resp.message = err.message;
    }
    return resp;
  }

  @Get('master-job/:masterJobSid')
  @ApiOperation({ summary: 'Get Customs by MasterJobSid' })
  @ApiOkResponse({ description: 'Customs records for master job fetched', type: ResponseData })
  async findByMasterJobSid(@Param('masterJobSid') masterJobSid: string) {
    const resp = new ResponseData();
    try {
      resp.data = await this.customsService.findByMasterJobSid(Number(masterJobSid));
      resp.message = 'Customs records fetched successfully';
    } catch (err) {
      resp.status = false;
      resp.message = err.message;
    }
    return resp;
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get Customs by ID' })
  @ApiOkResponse({ description: 'Customs record fetched', type: ResponseData })
  async findOne(@Param('id') id: string) {
    const resp = new ResponseData();
    try {
      resp.data = await this.customsService.findOne(Number(id));
      resp.message = 'Customs record fetched successfully';
    } catch (err) {
      resp.status = false;
      resp.message = err.message;
    }
    return resp;
  }

  @Patch('update/:id')
  @ApiOperation({ summary: 'Update Customs by ID' })
  @ApiOkResponse({ description: 'Customs updated successfully', type: ResponseData })
  async update(@Param('id') id: string, @Body() dto: UpdateCustomsDto) {
    const resp = new ResponseData();
    try {
      resp.data = await this.customsService.update(Number(id), dto);
      resp.message = 'Customs updated successfully';
    } catch (err) {
      resp.status = false;
      resp.message = err.message;
    }
    return resp;
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Soft delete Customs by ID' })
  @ApiOkResponse({ description: 'Customs deleted successfully', type: ResponseData })
  async remove(@Param('id') id: string) {
    const resp = new ResponseData();
    try {
      resp.data = await this.customsService.remove(Number(id));
      resp.message = 'Customs deleted successfully';
    } catch (err) {
      resp.status = false;
      resp.message = err.message;
    }
    return resp;
  }
}
