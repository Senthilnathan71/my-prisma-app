import { BadRequestException, Body, Controller, Delete, Get, HttpCode, HttpStatus, Logger, Param, ParseIntPipe, Patch, Post, Query, UnauthorizedException } from '@nestjs/common';
import { ApiCreatedResponse, ApiOperation } from '@nestjs/swagger';
import { Auth } from 'src/common/decorators/auth.decorator';
import { UserData } from 'src/common/decorators/user.decorator';
import { ResponseData } from 'src/common/response-data';
import { filterDto } from 'src/masters/DTO/search-vessel.dto';
import { TdsService } from 'src/masters/services/tds/tds.service';
class CompanyIdDto {
    CompanyMasterSid: number;
}

@Auth()

@Controller('tds')

export class TdsController {
    constructor(private tdsService: TdsService, private logger: Logger) { }


    @ApiOperation({ summary: 'Create new TdsSet' })
    @ApiCreatedResponse({
        description: 'Create new TdsSet',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Post('create')
    async createNewTdsSet(@Body() newData: any) {
        let resp = new ResponseData();
        try {
            let res = await this.tdsService.createNewTds(newData);
            this.logger.log(`New TdsSet Created : ${JSON.stringify(res)}`);
            resp.data = res;
            resp.message = "New tdsSet is successfully created."
        } catch (error) {
            this.logger.warn(`TdsSet Creation Error : ${JSON.stringify(error), error}`);
            resp.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                resp.message = error.message;
            } else {
                resp.message = "Internal Server Error";
            }
        }
        return resp;
    }



    @ApiOperation({ summary: 'Get All TdsSet' })
    @ApiCreatedResponse({
        description: 'Get All TdsSet',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Post()
    async getAllTdsSet(@Body() body: CompanyIdDto) {
        let resp = new ResponseData();
        try {
            let res = await this.tdsService.getAllTds(body.CompanyMasterSid);
            this.logger.log(`All TdsSet Fetched : ${JSON.stringify(res)}`);
            resp.data = res;
            resp.message = "All TdsSet are successfully fetched";
        } catch (error) {
            this.logger.warn(`Get All TdsSet Error : ${JSON.stringify(error), error}`);
            resp.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                resp.message = error.message;
            } else {
                resp.message = "Internal Server Error";
            }
        }
        return resp;
    }



    @ApiOperation({ summary: 'Get TdsSet by Id' })
    @ApiCreatedResponse({
        description: 'Get TdsSet by Id',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Get('fetch/:TDSSetHeaderSid')
    async getTdsSetById(@Param('TDSSetHeaderSid', ParseIntPipe) TDSSetHeaderSid: number) {
        let resp = new ResponseData();
        try {
            this.logger.log(`Getting TdsSet with id : ${TDSSetHeaderSid}`);
            let res = await this.tdsService.fetchTdsById(TDSSetHeaderSid);
            this.logger.debug(`Fetched TdsSet : ${JSON.stringify(res)}`);
            resp.data = res;
            resp.message = `TdsSet with id : ${TDSSetHeaderSid} is successfully fetched`;
        } catch (error) {
            this.logger.warn(`Get TdsSet by Id Error : ${JSON.stringify(error), error}`);
            resp.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                resp.message = error.message;
            } else {
                resp.message = "Internal Server Error";
            }
        }
        return resp;
    }



    @ApiOperation({ summary: 'Update TdsSet by Id' })
    @ApiCreatedResponse({
        description: 'Update TdsSet by Id',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Patch('update/:TDSSetHeaderSid')
    async updateTdsSetById(@Param('TDSSetHeaderSid', ParseIntPipe) TDSSetHeaderSid: number, @Body() payload: any) {
        let resp = new ResponseData();
        try {
            this.logger.log(`Updating TdsSet with id : ${TDSSetHeaderSid}`);
            let res = await this.tdsService.updateTdsById(TDSSetHeaderSid, payload);
            this.logger.debug(`Updated TdsSet : ${JSON.stringify(res)}`);
            resp.data = res;
            resp.message = `TdsSet is updated successfully.`;
        } catch (error) {
            this.logger.warn(`TdsSet Updation Error : ${JSON.stringify(error), error}`);
            resp.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                resp.message = error.message;
            } else {
                resp.message = "Internal Server Error";
            }
        }
        return resp;
    }



    @ApiOperation({ summary: 'Delete TdsSet by Id' })
    @ApiCreatedResponse({
        description: 'Delete TdsSet by Id',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Delete('delete/:TDSSetHeaderSid')
    async deleteTdsSetById(@Param('TDSSetHeaderSid', ParseIntPipe) TDSSetHeaderSid: number) {
        let resp = new ResponseData();
        try {
            this.logger.log(`Deleting TdsSet with id : ${TDSSetHeaderSid}`);
            let res = await this.tdsService.deleteTds(TDSSetHeaderSid);
            this.logger.debug(`Deleted TdsSet : ${JSON.stringify(res)}`);
            resp.data = res;
            resp.message = `
            TdsSet with id : ${TDSSetHeaderSid} is successfully deleted`;
        } catch (error) {
            this.logger.warn(`TdsSet Deletion Error : ${JSON.stringify(error), error}`);
            resp.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                resp.message = error.message;
            } else {
                resp.message = "Internal Server Error";
            }
        }
        return resp;
    }



    @ApiOperation({ summary: 'Search List of TdsSet' })
    @ApiCreatedResponse({
        description: 'Search List of TdsSet',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Post('search-list')
    async searchTdsSet(@Body() searchData: filterDto) {
        let resp = new ResponseData();
        try {
            let res = await this.tdsService.searchTds(searchData);
            this.logger.log(`TdsSet Search Results :${JSON.stringify(res)}`);
            resp.data = res;
            resp.message = "TdsSet Search results are successfully fetched"
        } catch (error) {
            this.logger.warn(`TdsSet Search Error : ${JSON.stringify(error), error}`);
            resp.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                resp.message = error.message;
            } else {
                resp.message = "Internal Server Error";
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

            const logs = await this.tdsService.getAuditLogs(tableName, recordId);

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
