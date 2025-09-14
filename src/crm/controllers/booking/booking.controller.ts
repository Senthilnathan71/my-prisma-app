import { Controller, Get, Post, Body, Patch, Param, Delete, HttpCode, HttpStatus, Logger, BadRequestException } from '@nestjs/common';
import { ApiBody, ApiCreatedResponse, ApiOperation } from '@nestjs/swagger';
import { ResponseData } from 'src/common/response-data';
import { Auth } from 'src/common/decorators/auth.decorator';
import { BookingService } from 'src/crm/services/booking/booking.service';
import { UserData } from 'src/common/decorators/user.decorator';
import { CreateBookingDto } from 'src/crm/DTO/CreateBookingDto';

@Auth()
@Controller('booking')
export class BookingController {
  constructor(private readonly bookingService: BookingService, private logger: Logger) { }

  @ApiOperation({ summary: 'Create Booking' })
  @ApiBody({ type: CreateBookingDto })
  @ApiCreatedResponse({
    description: 'Booking Created Successfully',
    type: ResponseData
  })
  @HttpCode(HttpStatus.CREATED)
  @Post()
  async create(@UserData() user: any, @Body() createBookingDto: CreateBookingDto) {
    let output = new ResponseData();
    try {
      const booking = await this.bookingService.create(createBookingDto, user)
      if (!booking) {
        this.logger.warn(`booking create failed:- ${booking}`);
        throw new BadRequestException('Booking Create Failed');
      }
      output.data = booking
      output.message = "Booking Create Successfully"
    } catch (error) {
      this.logger.error(`Booking Create Failed'} - ${error.message}`);
      output.status = false;
      output.message = error.message || 'Internal Server Error';
    }
    return output;
  }

  @ApiOperation({ summary: 'Fetch Booking Data' })
  @ApiCreatedResponse({
    description: 'Fetch Booking Data Successfully',
    type: ResponseData
  })
  @HttpCode(HttpStatus.OK)
  @Get()
  async findAll() {
    let output = new ResponseData();
    try {
      const booking = await this.bookingService.findAll()
      if (!booking) {
        this.logger.warn(`booking data fetched failed:- ${booking}`);
        throw new BadRequestException('Booking data fetch Failed');
      }
      output.data = booking
      output.message = "Booking Data Fetch Successfully"

    } catch (error) {
      this.logger.error(`Booking Data Fetch Failed'} - ${error.message}`);
      output.status = false;
      output.message = error.message || 'Internal Server Error';
    }
    return output;
  }


  @ApiOperation({ summary: 'Fetch Booking Data' })
  @ApiCreatedResponse({
    description: 'Fetch Booking Data Successfully',
    type: ResponseData
  })
  @HttpCode(HttpStatus.OK)
  @Get(':id')
  async findOne(@Param('id') id: string) {
    let output = new ResponseData();
    try {
      const booking = await this.bookingService.findOne(+id)
      if (!booking) {
        this.logger.warn(`booking data fetched failed:- ${booking}`);
        throw new BadRequestException('Booking data fetch Failed');
      }
      output.data = booking
      output.message = "Booking Data Fetch Successfully"

    } catch (error) {
      this.logger.error(`Booking Data Fetch Failed'} - ${error.message}`);
      output.status = false;
      output.message = error.message || 'Internal Server Error';
    }
    return output;
  }

  @ApiOperation({ summary: 'Update Booking Data By Id' })
  @ApiCreatedResponse({
    description: 'Successfully Update Booking Data By Id',
    type: ResponseData
  })
  @HttpCode(HttpStatus.OK)
  @Patch(':id')
  async update(@Param('id') id: string, @Body() updateBookingDto: any, @UserData() user: any,) {
    let output = new ResponseData();
    try {
      const booking = await this.bookingService.update(+id, updateBookingDto, user)
      if (!booking) {
        this.logger.warn(`booking data fetched failed:- ${booking}`);
        throw new BadRequestException('Booking data fetch Failed');
      }
      output.data = booking
      output.message = "Booking Data Fetch Successfully"

    } catch (error) {
      this.logger.error(`Booking Data Fetch Failed'} - ${error.message}`);
      output.status = false;
      output.message = error.message || 'Internal Server Error';
    }
    return output;
  }

  @ApiOperation({ summary: 'Delete Booking Data' })
  @ApiCreatedResponse({
    description: 'Delete Booking Data Successfully',
    type: ResponseData
  })
  @HttpCode(HttpStatus.OK)
  @Delete(':id')
  async remove(@Param('id') id: string) {
    try {
      const deleteHeader = await this.bookingService.remove(+id)
      return deleteHeader
    } catch (error) {
      throw error
    }
  }


  // port master
  @ApiOperation({ summary: 'Fetch Port Data' })
  @ApiCreatedResponse({
    description: 'Fetch Port Data Successfully',
    type: ResponseData
  })
  @HttpCode(HttpStatus.OK)
  @Get('port/list')
  async getAllPorts() {
    let output = new ResponseData();
    try {
      const port = await this.bookingService.getAllPort()
      if (!port) {
        this.logger.warn(`port data fetched failed:- ${port}`);
        throw new BadRequestException('port data fetch Failed');
      }
      output.data = port
      output.message = "Port Data Fetch Successfully"

    } catch (error) {
      this.logger.error(`port Data Fetch Failed'} - ${error.message}`);
      output.status = false;
      output.message = error.message || 'Internal Server Error';
    }
    return output;
  }


  // vessel master
  @ApiOperation({ summary: 'Fetch Vessel Data' })
  @ApiCreatedResponse({
    description: 'Fetch Vessel Data Successfully',
    type: ResponseData
  })
  @HttpCode(HttpStatus.OK)
  @Get('vessel/list')
  async getAllVesselMaster() {
    let output = new ResponseData();
    try {
      const vessel = await this.bookingService.getAllVesselMaster()
      if (!vessel) {
        this.logger.warn(`vessel data fetched failed:- ${vessel}`);
        throw new BadRequestException('vessel data fetch Failed');
      }
      output.data = vessel
      output.message = "Vessel Data Fetch Successfully"

    } catch (error) {
      this.logger.error(`vessel Data Fetch Failed'} - ${error.message}`);
      output.status = false;
      output.message = error.message || 'Internal Server Error';
    }
    return output;
  }





}