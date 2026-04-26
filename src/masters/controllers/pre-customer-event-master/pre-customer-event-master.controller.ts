import {
    BadRequestException,
    Body,
    Controller,
    Delete,
    Get,
    HttpCode,
    HttpStatus,
    Logger,
    NotFoundException,
    Param,
    ParseIntPipe,
    Patch,
    Post,
    UnauthorizedException,
    UsePipes,
    ValidationPipe,
} from '@nestjs/common';
import { ApiCreatedResponse, ApiOperation } from '@nestjs/swagger';
import { Auth } from 'src/common/decorators/auth.decorator';
import { UserData } from 'src/common/decorators/user.decorator';
import { ResponseData } from 'src/common/response-data';
import { CreateUpdatePreCustomerEventDto } from 'src/masters/DTO/pre-customer-event.dto';
import { filterDto } from 'src/masters/DTO/search-vessel.dto';
import { PreCustomerEventMasterService } from 'src/masters/services/pre-customer-event-master/pre-customer-event-master.service';


@Auth()
@Controller('pre-customer-event-master')
export class PreCustomerEventMasterController {
    constructor(
        private preCustomerEventService: PreCustomerEventMasterService,
        private logger: Logger,
    ) { }

    @ApiOperation({ summary: 'Create PreCustomerEvent' })
    @ApiCreatedResponse({ description: 'PreCustomerEvent created', type: ResponseData })
    @HttpCode(HttpStatus.CREATED)
    @Post('create')
    @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
    async create(@Body() body: CreateUpdatePreCustomerEventDto, @UserData() user: any) {
        const output = new ResponseData();
        try {
            const event = await this.preCustomerEventService.create(body, user);
            output.data = event;
            output.message = 'Event created successfully';
        } catch (error:any) {
            this.logger.warn(`createPreCustomerEvent error: ${error}`);
            output.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                output.message = error.message;
            } else {
                output.message = error?.message || 'Internal Server Error';
            }
        }
        return output;
    }

    @ApiOperation({ summary: 'Get All PreCustomerEvents by Company' })
    @HttpCode(HttpStatus.OK)
    @Post()
    async getAll(@Body() body: any) {
        const output = new ResponseData();
        try {
            output.data = await this.preCustomerEventService.findAll(body.CompanyMasterSid);
            output.message = 'Events fetched successfully';
        } catch (error:any) {
            this.logger.warn(`getAllPreCustomerEvents error: ${error}`);
            output.status = false;
            output.message = error?.message || 'Internal Server Error';
        }
        return output;
    }

    @ApiOperation({ summary: 'Get PreCustomerEvent By Id' })
    @HttpCode(HttpStatus.OK)
    @Get('fetch/:id')
    async getById(@Param('id', ParseIntPipe) id: number) {
        const output = new ResponseData();
        try {
            output.data = await this.preCustomerEventService.findOne(id);
            output.message = `Event ${id} fetched successfully`;
        } catch (error:any) {
            this.logger.warn(`getPreCustomerEventById error: ${error}`);
            output.status = false;
            if (error instanceof NotFoundException) {
                output.message = error.message;
            } else {
                output.message = error?.message || 'Internal Server Error';
            }
        }
        return output;
    }

    @ApiOperation({ summary: 'Update PreCustomerEvent By Id' })
    @HttpCode(HttpStatus.OK)
    @Patch('update/:id')
    @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
    async edit(
        @Param('id', ParseIntPipe) id: number,
        @Body() body: any,
        @UserData() user: any,
    ) {
        const output = new ResponseData();
        try {
            const event = await this.preCustomerEventService.update(id, body, user);
            output.data = event;
            output.message = 'Event updated successfully';
        } catch (error:any) {
            this.logger.warn(`updatePreCustomerEvent error: ${error}`);
            output.status = false;
            if (
                error instanceof BadRequestException ||
                error instanceof UnauthorizedException ||
                error instanceof NotFoundException
            ) {
                output.message = error.message;
            } else {
                output.message = error?.message || 'Internal Server Error';
            }
        }
        return output;
    }

    @ApiOperation({ summary: 'Soft Delete PreCustomerEvent By Id' })
    @HttpCode(HttpStatus.OK)
    @Delete('delete/:id')
    async softDelete(@Param('id', ParseIntPipe) id: number, @UserData() user: any) {
        const output = new ResponseData();
        try {
            output.data = await this.preCustomerEventService.softDelete(id, user);
            output.message = 'Event deleted successfully';
        } catch (error:any) {
            this.logger.warn(`deletePreCustomerEvent error: ${error}`);
            output.status = false;
            if (error instanceof BadRequestException || error instanceof NotFoundException) {
                output.message = error.message;
            } else {
                output.message = error?.message || 'Internal Server Error';
            }
        }
        return output;
    }

    @ApiOperation({ summary: 'Search List of PreCustomerEvents' })
    @HttpCode(HttpStatus.OK)
    @Post('search-list')
    async search(@Body() searchParams: filterDto) {
        const output = new ResponseData();
        try {
            output.data = await this.preCustomerEventService.searchList(searchParams);
            output.message = 'Event search results fetched successfully';
        } catch (error:any) {
            this.logger.warn(`searchPreCustomerEvent error: ${error}`);
            output.status = false;
            output.message = error?.message || 'Internal Server Error';
        }
        return output;
    }

    @ApiOperation({
        summary: 'Bell-icon notifications: events for the logged-in user (creator or leader) with EventDate today or tomorrow',
    })
    @HttpCode(HttpStatus.OK)
    @Get('notifications')
    async getNotifications(@UserData() user: any) {
        const output = new ResponseData();
        try {
            output.data = await this.preCustomerEventService.getNotificationsForUser(user);
            output.message = 'Notifications fetched successfully';
        } catch (error:any) {
            this.logger.warn(`getNotifications error: ${error}`);
            output.status = false;
            output.message = error?.message || 'Internal Server Error';
        }
        return output;
    }
}
