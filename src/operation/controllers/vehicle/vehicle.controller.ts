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
import { CreateVehicleDto, UpdateVehicleDto } from 'src/operation/DTO/vehicle.dto';
import { VehicleService } from 'src/operation/services/vehicle/vehicle.service';

@ApiTags('HouseJob Vehicle')
@Auth()
@Controller('vehicle')
export class VehicleController {
  constructor(private readonly vehicleService: VehicleService) {}

  // CREATE
  @Post('create')
  @ApiOperation({ summary: 'Create Vehicle Record' })
  @ApiCreatedResponse({ description: 'Vehicle Created Successfully', type: ResponseData })
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() dto: CreateVehicleDto) {
    const resp = new ResponseData();
    try {
      const result = await this.vehicleService.create(dto);
      resp.status = true;
      resp.message = 'Vehicle created successfully';
      resp.data = result;
    } catch (err) {
      resp.status = false;
      resp.message = err.message;
    }
    return resp;
  }

  // GET ALL
  @Get()
  @ApiOperation({ summary: 'Get all active Vehicle records' })
  @ApiOkResponse({ description: 'List of Vehicle records', type: ResponseData })
  async findAll() {
    const resp = new ResponseData();
    try {
      resp.data = await this.vehicleService.findAll();
      resp.message = 'Vehicle records fetched successfully';
    } catch (err) {
      resp.status = false;
      resp.message = err.message;
    }
    return resp;
  }

  // GET BY ID
  @Get(':id')
  @ApiOperation({ summary: 'Get Vehicle by ID' })
  @ApiOkResponse({ description: 'Vehicle record fetched', type: ResponseData })
  async findOne(@Param('id') id: string) {
    const resp = new ResponseData();
    try {
      resp.data = await this.vehicleService.findOne(Number(id));
      resp.message = 'Vehicle record fetched successfully';
    } catch (err) {
      resp.status = false;
      resp.message = err.message;
    }
    return resp;
  }

  // UPDATE
  @Patch('update/:id')
  @ApiOperation({ summary: 'Update Vehicle by ID' })
  @ApiOkResponse({ description: 'Vehicle updated successfully', type: ResponseData })
  async update(@Param('id') id: string, @Body() dto: UpdateVehicleDto) {
    const resp = new ResponseData();
    try {
      resp.data = await this.vehicleService.update(Number(id), dto);
      resp.message = 'Vehicle updated successfully';
    } catch (err) {
      resp.status = false;
      resp.message = err.message;
    }
    return resp;
  }

  // DELETE (Soft Delete)
  @Delete(':id')
  @ApiOperation({ summary: 'Soft delete Vehicle by ID' })
  @ApiOkResponse({ description: 'Vehicle deleted successfully', type: ResponseData })
  async remove(@Param('id') id: string,
  @Body('updatedBy') updatedBy: string) {
    const resp = new ResponseData();
    try {
      resp.data = await this.vehicleService.remove(Number(id),updatedBy);
      resp.message = 'Vehicle deleted successfully';
    } catch (err) {
      resp.status = false;
      resp.message = err.message;
    }
    return resp;
  }
}
