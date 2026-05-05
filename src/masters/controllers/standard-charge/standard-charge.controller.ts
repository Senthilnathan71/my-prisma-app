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
    UsePipes,
    ValidationPipe,
    NotFoundException,
} from '@nestjs/common';
import { ApiCreatedResponse, ApiOkResponse, ApiOperation } from '@nestjs/swagger';
import { ResponseData } from 'src/common/response-data';
import { filterDto } from 'src/masters/DTO/search-vessel.dto';
import { StandardChargeService } from 'src/masters/services/standard-charge/standard-charge.service';
import { PullStandardRateDTO } from 'src/masters/DTO/standard-rate.dto';
import { Auth } from 'src/common/decorators/auth.decorator';
export class StdChargeDeptDto {
    CompanyMasterSid: number;
    DepartmentMasterSid: number;
}
@Auth()
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
    @Get('fetch/:StdRateHeaderSid')
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

    @ApiOperation({ summary: 'Get All Standard Charge' })
    @ApiCreatedResponse({
        description: 'Get All Standard Charge',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @UsePipes(new ValidationPipe({
        transform : true,
        whitelist : true,
        forbidNonWhitelisted : true,
    }))
    @Post('department-wise')
    async getAllTariff(@Body() body: PullStandardRateDTO) {
        let resp = new ResponseData();
        try {
            let res = await this.standardChargeService.getStdCharges(body);
            this.logger.log(`All Standard Fetched : ${JSON.stringify(res)}`);
            resp.data = res;
            resp.message = "Standard Charge fetched successfully";
        } catch (error) {
            this.logger.warn(`Get All Standard Charge Error : ${JSON.stringify(error), error}`);
            resp.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException || error instanceof NotFoundException) {
                resp.message = error.message;
            } else {
                resp.message = "Internal Server Error";
            }
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


    @ApiOperation({ summary: 'Delete Standard Charge by Id' })
    @ApiOkResponse({ type: ResponseData })
    @HttpCode(HttpStatus.OK)
    @Delete('delete-detail/:StdTariffDetailSid')
    async deleteDetail(
        @Param('StdTariffDetailSid', ParseIntPipe) StdTariffDetailSid: number,
        @Query('email') email?: string
    ): Promise<ResponseData> {

        const resp = new ResponseData();

        try {
            const res = await this.standardChargeService.getStdTariffDetailById(
                StdTariffDetailSid,
                email
            );

            resp.data = res;
            resp.status = true;
            resp.message = 'Standard Charge Detail deleted successfully';

        } catch (error) {
            this.logger.warn(error);

            resp.status = false;
            resp.message = error?.message || 'Internal Server Error';
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
