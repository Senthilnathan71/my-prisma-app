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
    Query,
} from '@nestjs/common';
import { ApiCreatedResponse, ApiOperation } from '@nestjs/swagger';
import { ResponseData } from 'src/common/response-data';
import { filterDto } from 'src/masters/DTO/search-vessel.dto';
import { StandardChargeService } from 'src/masters/services/standard-charge/standard-charge.service';

@Controller('standard-charge')
export class StandardChargeController {
    constructor(
        private standardChargeService: StandardChargeService,
        private logger: Logger,
    ) { }


    @ApiOperation({ summary: 'Create new Standard Charge' })
    @ApiCreatedResponse({ type: ResponseData })
    @HttpCode(HttpStatus.OK)
    @Post('create')
    async create(@Body() payload: any) {
        const resp = new ResponseData();
        try {
            const res = await this.standardChargeService.createNewStdCharge(payload);
            resp.data = res;
            resp.message = 'Standard Charge created successfully';
        } catch (error) {
            this.logger.warn(error);
            resp.status = false;
            resp.message = error.message || 'Internal Server Error';
        }
        return resp;
    }


    @ApiOperation({ summary: 'Get all Standard Charges' })
    @ApiCreatedResponse({ type: ResponseData })
    @HttpCode(HttpStatus.OK)
    @Get()
    async getAll() {
        const resp = new ResponseData();
        try {
            const res = await this.standardChargeService.getAllStdCharges();
            resp.data = res;
            resp.message = 'Standard Charges fetched successfully';
        } catch (error) {
            this.logger.warn(error);
            resp.status = false;
            resp.message = error.message || 'Internal Server Error';
        }
        return resp;
    }


    @ApiOperation({ summary: 'Get Standard Charge by Id' })
    @ApiCreatedResponse({ type: ResponseData })
    @HttpCode(HttpStatus.OK)
    @Get(':StdRateHeaderSid')
    async getById(
        @Param('StdRateHeaderSid', ParseIntPipe) StdRateHeaderSid: number,
    ) {
        const resp = new ResponseData();
        try {
            const res =
                await this.standardChargeService.fetchStdChargeById(StdRateHeaderSid);
            resp.data = res;
            resp.message = 'Standard Charge fetched successfully';
        } catch (error) {
            this.logger.warn(error);
            resp.status = false;
            resp.message = error.message || 'Internal Server Error';
        }
        return resp;
    }


    @ApiOperation({ summary: 'Update Standard Charge by Id' })
    @ApiCreatedResponse({ type: ResponseData })
    @HttpCode(HttpStatus.OK)
    @Patch('update/:StdRateHeaderSid')
    async update(
        @Param('StdRateHeaderSid', ParseIntPipe) StdRateHeaderSid: number,
        @Body() payload: any,
    ) {
        const resp = new ResponseData();
        try {
            const res =
                await this.standardChargeService.updateStdChargeById(
                    StdRateHeaderSid,
                    payload,
                );
            resp.data = res;
            resp.message = 'Standard Charge updated successfully';
        } catch (error) {
            this.logger.warn(error);
            resp.status = false;
            resp.message = error.message || 'Internal Server Error';
        }
        return resp;
    }


    @ApiOperation({ summary: 'Delete Standard Charge by Id' })
    @ApiCreatedResponse({ type: ResponseData })
    @HttpCode(HttpStatus.OK)
    @Delete('delete/:StdRateHeaderSid')
    async delete(
        @Param('StdRateHeaderSid', ParseIntPipe) StdRateHeaderSid: number
    ) {
        const resp = new ResponseData();
        try {
            const res =
            await this.standardChargeService.deleteStdCharge(StdRateHeaderSid);
            resp.data = res;
            resp.message = 'Standard Charge deleted successfully';
        } catch (error) {
            this.logger.warn(error);
            resp.status = false;
            resp.message = error.message || 'Internal Server Error';
        }
        return resp;
    }

    @ApiOperation({ summary: 'Search List of Standard-charge' })
    @ApiCreatedResponse({
        description: 'Search List of Standard-charge',
        type: ResponseData,
    })
    @HttpCode(HttpStatus.OK)
    @Post('search-list')
    async searchStdHeaderNew(@Body() searchParams: filterDto) {
        const resp = new ResponseData();
        try {
            const res = await this.standardChargeService.searchStdHeaderNew(searchParams);
            this.logger.log(`Standard-chargeSearch Data : ${JSON.stringify(res)}`);
            resp.data = res;
            resp.message = 'Standard-charge Search is successfully fetched';
        } catch (error) {
            this.logger.warn(`Standard-charge Search Error : ${error}`);
            resp.status = false;
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


    @ApiOperation({ summary: 'Get Audit Logs' })
    @ApiCreatedResponse({ type: ResponseData })
    @HttpCode(HttpStatus.OK)
    @Get('audit-logs')
    async getAuditLogs(
        @Query('tableName') tableName: string,
        @Query('recordId') recordId?: string,
    ) {
        const resp = new ResponseData();
        try {
            const logs =
                await this.standardChargeService.getAuditLogs(tableName, recordId);
            resp.data = logs;
            resp.message = 'Audit logs fetched successfully';
        } catch (error) {
            this.logger.warn(error);
            resp.status = false;
            resp.message = error.message || 'Internal Server Error';
        }
        return resp;
    }
}
