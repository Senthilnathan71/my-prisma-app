import {
    BadRequestException,
    Body,
    Controller,
    HttpCode,
    HttpStatus,
    Logger,
    Post,
    UnauthorizedException,
    UsePipes,
    ValidationPipe,
} from '@nestjs/common';
import {
    ApiBadRequestResponse,
    ApiOkResponse,
    ApiOperation,
} from '@nestjs/swagger';
import { ResponseData } from 'src/common/response-data';
import { Auth } from 'src/common/decorators/auth.decorator';
import {
    MilestoneTrackerFetchDTO,
    MilestoneTrackerSearchDTO,
    MilestoneTrackerSubmitDTO,
} from 'src/operation/DTO/milestone-tracker.dto';
import { MilestoneTrackerService } from 'src/operation/services/milestone-tracker/milestone-tracker.service';

const validationPipe = new ValidationPipe({
    transform: true,
    whitelist: true,
    forbidNonWhitelisted: true,
});

@Auth()
@Controller('milestone-tracker')
export class MilestoneTrackerController {
    private readonly logger = new Logger(MilestoneTrackerController.name);
    constructor(private milestoneTrackerService: MilestoneTrackerService) { }

    private fail(response: ResponseData, error: any, context: string) {
        this.logger.warn(`${context} : ${error?.message ?? error}`);
        response.status = false;
        if (
            error instanceof BadRequestException ||
            error instanceof UnauthorizedException
        ) {
            response.message = error.message;
        } else {
            response.message = 'Internal Server Error';
        }
        return response;
    }

    /**
     * Search house shipment(s) by HBL / MBL reference.
     */
    @ApiOperation({ summary: 'Search house shipments by HBL / MBL for milestone update' })
    @ApiOkResponse({ description: 'Matching shipments fetched', type: ResponseData })
    @ApiBadRequestResponse({ description: 'Invalid request payload' })
    @Post('search')
    @HttpCode(HttpStatus.OK)
    @UsePipes(validationPipe)
    async search(@Body() payload: MilestoneTrackerSearchDTO) {
        const response = new ResponseData();
        try {
            response.data = await this.milestoneTrackerService.searchHouses(payload);
            response.message = 'Shipments fetched successfully';
        } catch (error) {
            return this.fail(response, error, 'Milestone Tracker Search Error');
        }
        return response;
    }

    /**
     * Fetch the header summary for a resolved house shipment. The applicable
     * master milestones (ff-booking/milestone) and the achieved milestones
     * (milestone/job-flow) are fetched separately by the frontend.
     */
    @ApiOperation({ summary: 'Fetch header summary for a shipment' })
    @ApiOkResponse({ description: 'Milestones fetched', type: ResponseData })
    @ApiBadRequestResponse({ description: 'Invalid request payload' })
    @Post('fetch')
    @HttpCode(HttpStatus.OK)
    @UsePipes(validationPipe)
    async fetch(@Body() payload: MilestoneTrackerFetchDTO) {
        const response = new ResponseData();
        try {
            response.data = await this.milestoneTrackerService.getMilestones(payload);
            response.message = 'Milestones fetched successfully';
        } catch (error) {
            return this.fail(response, error, 'Milestone Tracker Fetch Error');
        }
        return response;
    }

    /**
     * Submit pending milestones (date + remarks) and return the refreshed header.
     */
    @ApiOperation({ summary: 'Save pending milestones for a shipment' })
    @ApiOkResponse({ description: 'Milestones saved', type: ResponseData })
    @ApiBadRequestResponse({ description: 'Invalid request payload' })
    @Post('submit')
    @HttpCode(HttpStatus.OK)
    @UsePipes(validationPipe)
    async submit(@Body() payload: MilestoneTrackerSubmitDTO) {
        const response = new ResponseData();
        try {
            response.data = await this.milestoneTrackerService.submit(payload);
            response.message = 'Milestones saved successfully';
        } catch (error) {
            return this.fail(response, error, 'Milestone Tracker Submit Error');
        }
        return response;
    }
}
