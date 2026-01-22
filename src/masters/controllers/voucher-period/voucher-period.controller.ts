import { BadRequestException, Body, Controller, Delete, Get, HttpCode, HttpStatus, Logger, NotFoundException, Param, ParseIntPipe, Patch, Post, Query, UnauthorizedException } from '@nestjs/common';
import { ApiCreatedResponse, ApiOperation } from '@nestjs/swagger';
import { ResponseData } from 'src/common/response-data';
import { filterDto } from 'src/masters/DTO/search-vessel.dto';
import { VoucherPeriodService } from 'src/masters/services/voucher-period/voucher-period.service';

class VoucherPeriodFilterDto {
    CompanyMasterSid: number;
    BranchMasterSid: number;
    YearMasterSid: number;
}

@Controller('voucher-period')
export class VoucherPeriodController {
    constructor(private voucherPeriodService: VoucherPeriodService, private logger: Logger) { }

    @ApiOperation({ summary: 'Create new VoucherPeriod' })
    @ApiCreatedResponse({
        description: 'Create new VoucherPeriod',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Post('create')
    async createVoucherPeriod(@Body() newData: any) {
        let resp = new ResponseData();
        try {
            let res = await this.voucherPeriodService.createVoucherPeriod(newData);
            this.logger.log(`New VoucherPeriod Created : ${JSON.stringify(res)}`);
            resp.data = res;
            resp.message = "New VoucherPeriod is successfully created"
        } catch (error) {
            this.logger.warn(`VoucherPeriod Creation Error : ${JSON.stringify(error)}`);
            resp.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                resp.message = error.message;
            } else {
                resp.message = "Internal Server Error";
            }
        }
        return resp;
    }

    @ApiOperation({ summary: 'Get All VoucherPeriods' })
    @ApiCreatedResponse({
        description: 'Get All VoucherPeriods',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Post()
    async getAllVoucherPeriods(@Body() body: VoucherPeriodFilterDto) {
        let resp = new ResponseData();
        try {
            let res = await this.voucherPeriodService.getAllVoucherPeriods(
                body.CompanyMasterSid,
                body.BranchMasterSid,
                body.YearMasterSid
            );
            this.logger.log(`All VoucherPeriods Fetched : ${JSON.stringify(res)}`);
            resp.data = res;
            resp.message = "All VoucherPeriods are successfully fetched";
        } catch (error) {
            this.logger.warn(`Get All VoucherPeriods Error : ${JSON.stringify(error)}`);
            resp.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                resp.message = error.message;
            } else {
                resp.message = "Internal Server Error";
            }
        }
        return resp;
    }

    @ApiOperation({ summary: 'Get VoucherPeriod by Id' })
    @ApiCreatedResponse({
        description: 'Get VoucherPeriod by Id',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Get('fetch/:VoucherPeriodSid')
    async getVoucherPeriodById(@Param('VoucherPeriodSid', ParseIntPipe) VoucherPeriodSid: number) {
        let resp = new ResponseData();
        try {
            this.logger.log(`Getting VoucherPeriod with id : ${VoucherPeriodSid}`);
            let res = await this.voucherPeriodService.fetchVoucherPeriodById(VoucherPeriodSid);
            this.logger.debug(`Fetched VoucherPeriod : ${JSON.stringify(res)}`);
            resp.data = res;
            resp.message = `VoucherPeriod with id : ${VoucherPeriodSid} is successfully fetched`;
        } catch (error) {
            this.logger.warn(`Get VoucherPeriod by Id Error : ${JSON.stringify(error)}`);
            resp.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                resp.message = error.message;
            } else {
                resp.message = "Internal Server Error";
            }
        }
        return resp;
    }

    @ApiOperation({ summary: 'Update VoucherPeriod by Id' })
    @ApiCreatedResponse({
        description: 'Update VoucherPeriod by Id',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Patch('update/:VoucherPeriodSid')
    async updateVoucherPeriodById(@Param('VoucherPeriodSid', ParseIntPipe) VoucherPeriodSid: number, @Body() payload: any) {
        let resp = new ResponseData();
        try {
            this.logger.log(`Updating VoucherPeriod with id : ${VoucherPeriodSid}`);
            let res = await this.voucherPeriodService.updateVoucherPeriodById(VoucherPeriodSid, payload);
            this.logger.debug(`Updated VoucherPeriod : ${JSON.stringify(res)}`);
            resp.data = res;
            resp.message = `VoucherPeriod with id : ${VoucherPeriodSid} is successfully updated`;
        } catch (error) {
            this.logger.warn(`VoucherPeriod Updation Error : ${JSON.stringify(error)}`);
            resp.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                resp.message = error.message;
            } else {
                resp.message = "Internal Server Error";
            }
        }
        return resp;
    }

    @ApiOperation({ summary: 'Delete VoucherPeriod by Id' })
    @ApiCreatedResponse({
        description: 'Delete VoucherPeriod by Id',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Delete('delete/:VoucherPeriodSid')
    async deleteVoucherPeriodById(@Param('VoucherPeriodSid', ParseIntPipe) VoucherPeriodSid: number) {
        let resp = new ResponseData();
        try {
            this.logger.log(`Deleting VoucherPeriod with id : ${VoucherPeriodSid}`);
            let res = await this.voucherPeriodService.deleteVoucherPeriod(VoucherPeriodSid);
            this.logger.debug(`Deleted VoucherPeriod : ${JSON.stringify(res)}`);
            resp.data = res;
            resp.message = `VoucherPeriod with id : ${VoucherPeriodSid} is successfully deleted`;
        } catch (error) {
            this.logger.warn(`VoucherPeriod Deletion Error : ${JSON.stringify(error)}`);
            resp.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                resp.message = error.message;
            } else {
                resp.message = "Internal Server Error";
            }
        }
        return resp;
    }

    @ApiOperation({ summary: 'Search List of VoucherPeriods' })
    @ApiCreatedResponse({
        description: 'Search List of VoucherPeriods',
        type: ResponseData,
    })
    @HttpCode(HttpStatus.OK)
    @Post('search-list')
    async searchVoucherPeriodNew(@Body() searchParams: filterDto) {
        const resp = new ResponseData();
        try {
            const res = await this.voucherPeriodService.searchVoucherPeriodNew(searchParams);
            this.logger.log(`VoucherPeriod Search Data: ${JSON.stringify(res)}`);
            resp.data = res;
            resp.message = 'VoucherPeriod Search is successfully fetched';
        } catch (error) {
            this.logger.warn(`Search VoucherPeriod Error: ${error}`);
            resp.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                resp.message = error.message;
            } else {
                resp.message = 'Internal Server Error';
            }
        }
        return resp;
    }

    @ApiOperation({ summary: 'Get Audit Logs for a Table/Record' })
    @ApiCreatedResponse({ description: 'Fetch audit logs', type: ResponseData })
    @HttpCode(HttpStatus.OK)
    @Get('audit-logs')
    async getAuditLogs(
        @Query('tableName') tableName: string,
        @Query('recordId') recordId?: string,
    ) {
        const resp = new ResponseData();
        try {
            if (!tableName) throw new Error('tableName query parameter is required');

            const logs = await this.voucherPeriodService.getAuditLogs(tableName, recordId);

            // Remove updatedOn from oldVal and newVal
            resp.data = logs.map((log: any) => {
                const oldVal = log.oldVal ? { ...log.oldVal } : null;
                const newVal = log.newVal ? { ...log.newVal } : null;
                if (oldVal && 'updatedOn' in oldVal) delete oldVal.updatedOn;
                if (newVal && 'updatedOn' in newVal) delete newVal.updatedOn;
                return { ...log, oldVal, newVal };
            });

            resp.message = 'Audit logs fetched successfully';
        } catch (error) {
            this.logger.warn(`getAuditLogsError: ${error}`);
            resp.status = false;
            resp.message = error.message || 'Internal Server Error';
        }
        return resp;
    }
}
