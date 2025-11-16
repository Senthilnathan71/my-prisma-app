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
  Put,
  Query,
} from '@nestjs/common';
import { ApiOperation, ApiTags, ApiCreatedResponse, ApiOkResponse } from '@nestjs/swagger';
import { ResponseData } from 'src/common/response-data';
import { CreateBoeDto, UpdateBoeDto } from 'src/operation/DTO/boe-create.dto';
import { BoeService } from 'src/operation/services/boe/boe.service';


@ApiTags('HouseJob BOE')
@Controller('boe')
export class BoeController {
  constructor(private readonly boeService: BoeService) {}

  // ✅ CREATE
  @Post('create')
  @ApiOperation({ summary: 'Create HouseJob BOE Record' })
  @ApiCreatedResponse({ description: 'BOE Created Successfully', type: ResponseData })
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() dto: CreateBoeDto) {
    const resp = new ResponseData();
    try {
      const result = await this.boeService.create(dto);
      resp.status = true;
      resp.message = 'BOE created successfully';
      resp.data = result;
    } catch (err) {
      resp.status = false;
      resp.message = 'Failed to create BOE';
      resp.message = err.message;
    }
    return resp;
  }

  // ✅ GET ALL
  @Get()
  @ApiOperation({ summary: 'Get all active BOE records' })
  @ApiOkResponse({ description: 'List of BOE records', type: ResponseData })
  async findAll() {
    const resp = new ResponseData();
    try {
      const list = await this.boeService.findAll();
      resp.message = 'BOE records fetched successfully';
      resp.data = list;
    } catch (err) {
      resp.status = false;
      resp.message = 'Failed to fetch BOE records';
      resp.message = err.message;
    }
    return resp;
  }

  // ✅ GET BY ID
  @Get(':id')
  @ApiOperation({ summary: 'Get BOE by ID' })
  @ApiOkResponse({ description: 'BOE record fetched', type: ResponseData })
  async findOne(@Param('id') id: string) {
    const resp = new ResponseData();
    try {
      const boe = await this.boeService.findOne(Number(id));
      resp.message = 'BOE record fetched successfully';
      resp.data = boe;
    } catch (err) {
      resp.status = false;
      resp.message = 'BOE record not found';
      resp.message = err.message;
    }
    return resp;
  }

  // ✅ UPDATE
  @Patch('update/:id')
  @ApiOperation({ summary: 'Update BOE by ID' })
  @ApiOkResponse({ description: 'BOE updated successfully', type: ResponseData })
  async update(@Param('id') id: string, @Body() dto: UpdateBoeDto) {
    const resp = new ResponseData();
    try {
      const updated = await this.boeService.update(Number(id), dto);
      resp.message = 'BOE record updated successfully';
      resp.data = updated;
    } catch (err) {
      resp.status = false;
      resp.message = 'Failed to update BOE';
      resp.message = err.message;
    }
    return resp;
  }

  // ✅ DELETE
  @Delete(':id')
  @ApiOperation({ summary: 'Soft delete BOE by ID' })
  @ApiOkResponse({ description: 'BOE deleted successfully', type: ResponseData })
  async remove(@Param('id') id: string, @Query('deletedBy') deletedBy?: string) {
    const resp = new ResponseData();
    try {
      const deleted = await this.boeService.remove(Number(id), deletedBy);
      resp.message = 'BOE record deleted successfully';
      resp.data = deleted;
    } catch (err) {
      resp.status = false;
      resp.message = 'Failed to delete BOE';
      resp.message = err.message;
    }
    return resp;
  }
}
