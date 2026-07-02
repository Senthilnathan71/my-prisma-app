import {
    BadRequestException,
    Controller,
    Get,
    Logger,
    Query,
    UnauthorizedException,
    UsePipes,
    ValidationPipe,
} from '@nestjs/common';
import { ApiOkResponse, ApiOperation } from '@nestjs/swagger';
import { Auth } from 'src/common/decorators/auth.decorator';
import { ResponseData } from 'src/common/response-data';
import {
    ShipmentMilestoneBookingFlowDTO,
    ShipmentMilestoneJobFlowDTO,
} from 'src/operation/DTO/shipment-milestone.dto';
import { ShipmentMilestoneService } from 'src/operation/services/shipment-milestone/shipment-milestone.service';

@Auth()
@Controller('milestone')
export class MilestoneJobFlowController {
    private readonly logger = new Logger(MilestoneJobFlowController.name);

    constructor(private readonly shipmentMilestoneService: ShipmentMilestoneService) {}

    @Get('job-flow')
    @ApiOperation({ summary: 'Fetch previous and current milestones for an exact House Job flow' })
    @ApiOkResponse({ description: 'Job-flow milestones fetched successfully', type: ResponseData })
    @UsePipes(new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true }))
    async getJobFlow(@Query() payload: ShipmentMilestoneJobFlowDTO) {
        const response = new ResponseData();
        try {
            response.data = await this.shipmentMilestoneService.getJobFlow(payload);
            response.message = 'Job-flow milestones fetched successfully';
        } catch (error) {
            this.logger.warn(`Job-flow milestone fetch error: ${error}`);
            response.status = false;
            response.message =
                error instanceof BadRequestException || error instanceof UnauthorizedException
                    ? error.message
                    : 'Internal Server Error';
        }
        return response;
    }

    @Get('booking-flow')
    @ApiOperation({ summary: 'Fetch previous (transhipment source) and current milestones for a Booking' })
    @ApiOkResponse({ description: 'Booking-flow milestones fetched successfully', type: ResponseData })
    @UsePipes(new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true }))
    async getBookingFlow(@Query() payload: ShipmentMilestoneBookingFlowDTO) {
        const response = new ResponseData();
        try {
            response.data = await this.shipmentMilestoneService.getBookingFlow(payload);
            response.message = 'Booking-flow milestones fetched successfully';
        } catch (error) {
            this.logger.warn(`Booking-flow milestone fetch error: ${error}`);
            response.status = false;
            response.message =
                error instanceof BadRequestException || error instanceof UnauthorizedException
                    ? error.message
                    : 'Internal Server Error';
        }
        return response;
    }
}
