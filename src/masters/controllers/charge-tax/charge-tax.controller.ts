import { BadRequestException, Body, Controller, Delete, Get, HttpCode, HttpStatus, Logger, Param, ParseIntPipe, Patch, Post, Query, UnauthorizedException } from '@nestjs/common';
import { ApiCreatedResponse, ApiOperation } from '@nestjs/swagger';
import { ResponseData } from 'src/common/response-data';
import { ChargeTaxService } from 'src/masters/services/charge-tax/charge-tax.service';
import { SearchListDto } from 'src/masters/DTO/search-list.dto';
import { filterDto } from 'src/masters/DTO/search-vessel.dto';
import { Auth } from 'src/common/decorators/auth.decorator';
class CompanyIdDto {
    CompanyMasterSid: number;
}
@Auth()
@Controller('charge-tax')
export class ChargeTaxController {
    constructor(private chargeTaxService: ChargeTaxService, private logger: Logger) { }

    @ApiOperation({ summary: 'Create new Charge Tax' })
    @ApiCreatedResponse({
        description: 'Create new Charge Tax',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Post('create')
    async createNewChargeTax(@Body() newData: any) {
        let resp = new ResponseData();
        try {
            let res = await this.chargeTaxService.createNewChargeTax(newData);
            this.logger.log(`New Charge Tax Created : ${JSON.stringify(res)}`);
            resp.data = res;
            resp.message = "New Charge Tax is successfully created"
        } catch (error) {
            this.logger.warn(`Charge Tax Creation Error : ${JSON.stringify(error), error}`);
            resp.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                resp.message = error.message;
            } else {
                resp.message = "Internal Server Error";
            }
        }
        return resp;
    }

    @ApiOperation({ summary: 'Get All Charge Taxes' })
    @ApiCreatedResponse({
        description: 'Get All Charge Taxes',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Post()
    async getAllChargeTaxes(@Body() body: CompanyIdDto) {
        let resp = new ResponseData();
        try {
            let res = await this.chargeTaxService.getAllChargeTax(body.CompanyMasterSid);
            this.logger.log(`All Charge Taxes Fetched : ${JSON.stringify(res)}`);
            resp.data = res;
            resp.message = "All Charge Taxes are successfully fetched";
        } catch (error) {
            this.logger.warn(`Get All Charge Taxes Error : ${JSON.stringify(error), error}`);
            resp.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                resp.message = error.message;
            } else {
                resp.message = "Internal Server Error";
            }
        }
        return resp;
    }

    @ApiOperation({ summary: 'Get Charge Tax by Id' })
    @ApiCreatedResponse({
        description: 'Get Charge Tax by Id',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Get('fetch/:ChargeTaxMasterSid')
    async getChargeTaxById(@Param('ChargeTaxMasterSid', ParseIntPipe) ChargeTaxMasterSid: number) {
        let resp = new ResponseData();
        try {
            this.logger.log(`Getting Charge Tax with id : ${ChargeTaxMasterSid}`);
            let res = await this.chargeTaxService.fetchChargeTaxById(ChargeTaxMasterSid);
            this.logger.debug(`Fetched Charge Tax : ${JSON.stringify(res)}`);
            resp.data = res;
            resp.message = `Charge Tax with id : ${ChargeTaxMasterSid} is successfully fetched`;
        } catch (error) {
            this.logger.warn(`Get Charge Tax by Id Error : ${JSON.stringify(error), error}`);
            resp.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                resp.message = error.message;
            } else {
                resp.message = "Internal Server Error";
            }
        }
        return resp;
    }

    @ApiOperation({ summary: 'Update Charge Tax by Id' })
    @ApiCreatedResponse({
        description: 'Update Charge Tax by Id',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Patch('update/:ChargeTaxMasterSid')
    async updateChargeTaxById(@Param('ChargeTaxMasterSid', ParseIntPipe) ChargeTaxMasterSid: number, @Body() payload: any) {
        let resp = new ResponseData();
        try {
            this.logger.log(`Updating Charge Tax with id : ${ChargeTaxMasterSid}`);
            let res = await this.chargeTaxService.updateChargeTaxById(ChargeTaxMasterSid, payload);
            this.logger.debug(`Updated Charge Tax : ${JSON.stringify(res)}`);
            resp.data = res;
            resp.message = `Charge Tax with id : ${ChargeTaxMasterSid} is successfully updated`;
        } catch (error) {
            this.logger.warn(`Charge Tax Updation Error : ${JSON.stringify(error), error}`);
            resp.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                resp.message = error.message;
            } else {
                resp.message = "Internal Server Error";
            }
        }
        return resp;
    }

    @ApiOperation({ summary: 'Delete Charge Tax by Id' })
    @ApiCreatedResponse({
        description: 'Delete Charge Tax by Id',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Delete('delete/:ChargeTaxMasterSid')
    async deleteChargeTaxById(@Param('ChargeTaxMasterSid', ParseIntPipe) ChargeTaxMasterSid: number) {
        let resp = new ResponseData();
        try {
            this.logger.log(`Deleting Charge Tax with id : ${ChargeTaxMasterSid}`);
            let res = await this.chargeTaxService.deleteChargeTax(ChargeTaxMasterSid);
            this.logger.debug(`Deleted Charge Tax : ${JSON.stringify(res)}`);
            resp.data = res;
            resp.message = `Charge Tax with id : ${ChargeTaxMasterSid} is successfully deleted`;
        } catch (error) {
            this.logger.warn(`Charge Tax Deletion Error : ${JSON.stringify(error), error}`);
            resp.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                resp.message = error.message;
            } else {
                resp.message = "Internal Server Error";
            }
        }
        return resp;
    }

    @ApiOperation({ summary: 'Search List of Charge Taxes' })
    @ApiCreatedResponse({
        description: 'Search List of Charge Taxes',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Post('search-list')
    async searchChargeTax(@Body() searchParams: filterDto) {
        const resp = new ResponseData();
        try {
            const res = await this.chargeTaxService.searchChargeTax(searchParams);
            this.logger.log(`Charge Tax Search Data: ${JSON.stringify(res)}`);
            resp.data = res;
            resp.message = 'Charge Tax Search is successfully fetched';
        } catch (error) {
            this.logger.warn(`Search Charge Tax Error: ${error}`);
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

            const logs = await this.chargeTaxService.getAuditLogs(tableName, recordId);

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