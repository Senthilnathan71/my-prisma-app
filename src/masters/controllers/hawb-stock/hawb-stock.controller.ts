import { BadRequestException, Body, Controller, Delete, Get, HttpCode, HttpStatus, Logger, Param, ParseIntPipe, Patch, Post, UnauthorizedException, Query } from '@nestjs/common';
import { ApiCreatedResponse, ApiOperation } from '@nestjs/swagger';
import { Auth } from 'src/common/decorators/auth.decorator';
import { ResponseData } from 'src/common/response-data';
import { SearchListDto } from 'src/masters/DTO/search-list.dto';
import { filterDto } from 'src/masters/DTO/search-vessel.dto';
import { HawbStockService } from 'src/masters/services/hawb-stock/hawb-stock.service';
class CompanyIdDto {
    CompanyMasterSid: number;
    BranchMasterSid: number;
}

@Auth()
@Controller('hawb-stock')
export class HawbStockController {
    constructor(private hawbStockService: HawbStockService, private logger: Logger) { }

    @ApiOperation({ summary: 'Create new HAWB Stock' })
    @ApiCreatedResponse({
        description: 'Create new HAWB Stock',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Post('create')
    async createNewHawbStock(@Body() newData: any) {
        let resp = new ResponseData();
        try {
            let res = await this.hawbStockService.createNewHawbStock(newData);
            this.logger.log(`New HAWB Stock Created : ${JSON.stringify(res)}`);
            resp.data = res;
            resp.message = "New HAWB Stock is successfully created"
        } catch (error) {
            this.logger.warn(`HAWB Stock Creation Error : ${JSON.stringify(error), error}`);
            resp.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                resp.message = error.message;
            } else {
                resp.message = "Internal Server Error";
            }
        }
        return resp;
    }

    @ApiOperation({ summary: 'Get All HAWB Stocks' })
    @ApiCreatedResponse({
        description: 'Get All HAWB Stocks',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Post()
    async getAllHawbStocks(@Body() body: CompanyIdDto) {
        let resp = new ResponseData();
        try {
            let res = await this.hawbStockService.getAllHawbStocks(body.CompanyMasterSid, body.BranchMasterSid);
            this.logger.log(`All HAWB Stocks Fetched : ${JSON.stringify(res)}`);
            resp.data = res;
            resp.message = "All HAWB Stocks are successfully fetched";
        } catch (error) {
            this.logger.warn(`Get All HAWB Stocks Error : ${JSON.stringify(error), error}`);
            resp.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                resp.message = error.message;
            } else {
                resp.message = "Internal Server Error";
            }
        }
        return resp;
    }

    @ApiOperation({ summary: 'Get HAWB Stock by Id' })
    @ApiCreatedResponse({
        description: 'Get HAWB Stock by Id',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Get('fetch/:HawbStockSid')
    async getHawbStockById(@Param('HawbStockSid', ParseIntPipe) HawbStockSid: number) {
        let resp = new ResponseData();
        try {
            this.logger.log(`Getting HAWB Stock with id : ${HawbStockSid}`);
            let res = await this.hawbStockService.fetchHawbStockById(HawbStockSid);
            this.logger.debug(`Fetched HAWB Stock : ${JSON.stringify(res)}`);
            resp.data = res;
            resp.message = `HAWB Stock with id : ${HawbStockSid} is successfully fetched`;
        } catch (error) {
            this.logger.warn(`Get HAWB Stock by Id Error : ${JSON.stringify(error), error}`);
            resp.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                resp.message = error.message;
            } else {
                resp.message = "Internal Server Error";
            }
        }
        return resp;
    }

    @ApiOperation({ summary: 'Update HAWB Stock by Id' })
    @ApiCreatedResponse({
        description: 'Update HAWB Stock by Id',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Patch('update/:HawbStockSid')
    async updateHawbStockById(@Param('HawbStockSid', ParseIntPipe) HawbStockSid: number, @Body() payload: any) {
        let resp = new ResponseData();
        try {
            this.logger.log(`Updating HAWB Stock with id : ${HawbStockSid}`);
            let res = await this.hawbStockService.updateHawbStockById(HawbStockSid, payload);
            this.logger.debug(`Updated HAWB Stock : ${JSON.stringify(res)}`);
            resp.data = res;
            resp.message = `HAWB Stock with id : ${HawbStockSid} is successfully updated`;
        } catch (error) {
            this.logger.warn(`HAWB Stock Update Error : ${JSON.stringify(error), error}`);
            resp.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                resp.message = error.message;
            } else {
                resp.message = "Internal Server Error";
            }
        }
        return resp;
    }

    @ApiOperation({ summary: 'Delete HAWB Stock by Id' })
    @ApiCreatedResponse({
        description: 'Delete HAWB Stock by Id',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Delete('delete/:HawbStockSid')
    async deleteHawbStockById(@Param('HawbStockSid', ParseIntPipe) HawbStockSid: number) {
        let resp = new ResponseData();
        try {
            this.logger.log(`Deleting HAWB Stock with id : ${HawbStockSid}`);
            let res = await this.hawbStockService.deleteHawbStock(HawbStockSid);
            this.logger.debug(`Deleted HAWB Stock : ${JSON.stringify(res)}`);
            resp.data = res;
            resp.message = `HAWB Stock with id : ${HawbStockSid} is successfully deleted`;
        } catch (error) {
            this.logger.warn(`HAWB Stock Deletion Error : ${JSON.stringify(error), error}`);
            resp.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                resp.message = error.message;
            } else {
                resp.message = "Internal Server Error";
            }
        }
        return resp;
    }

    @ApiOperation({ summary: 'Search List of HAWB Stocks' })
    @ApiCreatedResponse({
        description: 'Search List of HAWB Stocks',
        type: ResponseData,
    })
    @HttpCode(HttpStatus.OK)
    @Post('search-list')
    async searchHawbStockNew(@Body() searchParams: filterDto) {
        const resp = new ResponseData();
        try {
            const res = await this.hawbStockService.searchHawbStock(searchParams);
            this.logger.log(`HAWB Stock Search Data: ${JSON.stringify(res)}`);
            resp.data = res;
            resp.message = 'HAWB Stock Search is successfully fetched';
        } catch (error) {
            this.logger.warn(`Search HAWB Stock Error: ${error}`);
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

            const logs = await this.hawbStockService.getAuditLogs(tableName, recordId);

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