import { BadRequestException, Body, Controller, Delete, Get, HttpCode, HttpStatus, Logger, Param, ParseIntPipe, Patch, Post, Query, UnauthorizedException } from '@nestjs/common';
import { ApiCreatedResponse, ApiOperation } from '@nestjs/swagger';
import { ResponseData } from 'src/common/response-data';
import { SearchListDto } from 'src/masters/DTO/search-list.dto';
import { filterDto } from 'src/masters/DTO/search-vessel.dto';
import { ChargeGroupService } from 'src/masters/services/charge-group/charge-group.service';
class CompanyIdDto {
    CompanyMasterSid: number;

}

@Controller('charge-group')
export class ChargeGroupController {
    constructor(private chargeGroupService: ChargeGroupService, private logger: Logger) { }

    @ApiOperation({ summary: 'Create new Charge Group' })
    @ApiCreatedResponse({
        description: 'Create new Charge Group',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Post('create')
    async createNewChargeGroup(@Body() newData: any) {
        let resp = new ResponseData();
        try {
            let res = await this.chargeGroupService.createNewChargeGroup(newData);
            this.logger.log(`New Charge Group Created: ${JSON.stringify(res)}`);
            resp.data = res;
            resp.message = "New charge group is successfully created";
        } catch (error) {
            this.logger.warn(`Create new Charge Group Error: ${error}`);
            resp.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                resp.message = error.message;
            } else {
                resp.message = "Internal Server Error";
            }
        }
        return resp;
    }

    @ApiOperation({ summary: 'Get All Charge Groups' })
    @ApiCreatedResponse({
        description: 'Get All Charge Groups',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Post()
    async getAllChargeGroups(@Body() body: CompanyIdDto) {
        let resp = new ResponseData();
        try {
            let res = await this.chargeGroupService.getAllChargeGroups(body.CompanyMasterSid);
            this.logger.log(`All Charge Groups Data: ${JSON.stringify(res)}`);
            resp.data = res;
            resp.message = "All charge groups are successfully fetched";
        } catch (error) {
            this.logger.warn(`Fetching All Charge Groups Error: ${JSON.stringify(error)}`);
            resp.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                resp.message = error.message;
            } else {
                resp.message = "Internal Server Error";
            }
        }
        return resp;
    }

    @ApiOperation({ summary: 'Get Charge Group by Id' })
    @ApiCreatedResponse({
        description: 'Get Charge Group by Id',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Get('fetch/:ChargeGroupSid')
    async getChargeGroupById(@Param('ChargeGroupSid', ParseIntPipe) ChargeGroupSid: number) {
        let resp = new ResponseData();
        try {
            this.logger.log(`Getting Charge Group with id: ${ChargeGroupSid}`);
            let res = await this.chargeGroupService.getChargeGroupById(ChargeGroupSid);
            this.logger.debug(`Fetched Charge Group: ${JSON.stringify(res)}`);
            resp.data = res;
            resp.message = `Charge group with id: ${ChargeGroupSid} is successfully fetched`;
        } catch (error) {
            this.logger.warn(`Get Charge Group By Id Error: ${JSON.stringify(error)}`);
            resp.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                resp.message = error.message;
            } else {
                resp.message = "Internal Server Error";
            }
        }
        return resp;
    }

    @ApiOperation({ summary: "Updating Charge Group by Id" })
    @ApiCreatedResponse({
        description: "Update Charge Group by Id",
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Patch('update/:ChargeGroupSid')
    async updateChargeGroupById(@Param('ChargeGroupSid', ParseIntPipe) ChargeGroupSid: number, @Body() updateData: any) {
        let resp = new ResponseData();
        try {
            this.logger.log(`Updating Charge Group with id: ${ChargeGroupSid}`);
            let res = await this.chargeGroupService.updateChargeGroupById(ChargeGroupSid, updateData);
            this.logger.debug(`Updated Data: ${JSON.stringify(res)}`);
            resp.data = res;
            resp.message = `Charge group with id: ${ChargeGroupSid} is successfully updated`;
        } catch (error) {
            this.logger.warn(`Charge Group Update Error: ${JSON.stringify(error)}`);
            resp.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                resp.message = error.message;
            } else {
                resp.message = "Internal Server Error";
            }
        }
        return resp;
    }

    @ApiOperation({ summary: "Delete Charge Group by Id" })
    @ApiCreatedResponse({
        description: "Delete Charge Group by Id",
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Delete('delete/:ChargeGroupSid')
    async deleteChargeGroupById(@Param('ChargeGroupSid', ParseIntPipe) ChargeGroupSid: number) {
        let resp = new ResponseData();
        try {
            this.logger.log(`Deleting Charge Group with id: ${ChargeGroupSid}`);
            let res = await this.chargeGroupService.deleteChargeGroupById(ChargeGroupSid);
            this.logger.debug(`Deleted Data: ${JSON.stringify(res)}`);
            resp.data = res;
            resp.message = `Charge group with id: ${ChargeGroupSid} is successfully deleted`;
        } catch (error) {
            this.logger.warn(`Charge Group Deletion Error: ${JSON.stringify(error)}`);
            resp.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                resp.message = error.message;
            } else {
                resp.message = "Internal Server Error";
            }
        }
        return resp;
    }

    @ApiOperation({ summary: 'Search List of Charge Groups with pagination' })
    @ApiCreatedResponse({
        description: "Search List of Charge Groups",
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Post('search-list')
    async searchChargeGroups(@Body() params: filterDto) {
        let resp = new ResponseData();
        try {
            let res = await this.chargeGroupService.searchChargeGroups(params);
            this.logger.log(`Search Charge Groups results: ${JSON.stringify(res)}`);
            resp.data = res;
            resp.message = "Search Charge Groups is successfully fetched";
        } catch (error) {
            this.logger.warn(`Search Charge Groups Error: ${error}`);
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

            const logs = await this.chargeGroupService.getAuditLogs(tableName, recordId);

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