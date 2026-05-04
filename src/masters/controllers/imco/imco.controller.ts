import { BadRequestException, Body, Controller, Delete, Get, HttpCode, HttpStatus, Logger, Param, ParseIntPipe, Patch, Post, UnauthorizedException, Query } from '@nestjs/common';
import { ApiCreatedResponse, ApiOperation } from '@nestjs/swagger';
import { Auth } from 'src/common/decorators/auth.decorator';
import { ResponseData } from 'src/common/response-data';
import { SearchListDto } from 'src/masters/DTO/search-list.dto';
import { filterDto } from 'src/masters/DTO/search-vessel.dto';
import { ImcoService } from 'src/masters/services/imco/imco.service';
@Auth()
@Controller('imco')
export class ImcoController {
    constructor(private imcoService: ImcoService, private logger: Logger) { }


    @ApiOperation({ summary: 'Create new IMCO' })
    @ApiCreatedResponse({
        description: 'Create new IMCO',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Post('create')
    async createNewImco(@Body() newData: any) {
        let resp = new ResponseData();
        try {
            let res = await this.imcoService.createNewIMCO(newData);
            this.logger.log(`New IMCO Created : ${JSON.stringify(res)}`);
            const imcoName = newData?.ImcoName || 'Imco';
            resp.data = res;
            resp.message = `Imco ${imcoName} is successfully created`;
        } catch (error) {
            this.logger.warn(`IMCO Creation Error : ${JSON.stringify(error), error}`);
            resp.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                resp.message = error.message;
            } else {
                resp.message = "Internal Server Error";
            }
        }
        return resp;
    }



    @ApiOperation({ summary: 'Get All IMCO' })
    @ApiCreatedResponse({
        description: 'Get All IMCO',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Get()
    async getAllIMCO() {
        let resp = new ResponseData();
        try {
            let res = await this.imcoService.getAllIMCO();
            this.logger.log(`All IMCO Fetched : ${JSON.stringify(res)}`);
            resp.data = res;
            resp.message = "ALl IMCO are successfully fetched";
        } catch (error) {
            this.logger.warn(`Get All IMCO Error : ${JSON.stringify(error), error}`);
            resp.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                resp.message = error.message;
            } else {
                resp.message = "Internal Server Error";
            }
        }
        return resp;
    }



    @ApiOperation({ summary: 'Get IMCO by Id' })
    @ApiCreatedResponse({
        description: 'Get IMCO by Id',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Get('fetch/:ImcoMasterSid')
    async getIMCOById(@Param('ImcoMasterSid', ParseIntPipe) ImcoMasterSid: number) {
        let resp = new ResponseData();
        try {
            this.logger.log(`Getting IMCO with id : ${ImcoMasterSid}`);
            let res = await this.imcoService.fetchIMCOById(ImcoMasterSid);
            this.logger.debug(`Fetched IMCO : ${JSON.stringify(res)}`);
            resp.data = res;
            resp.message = `IMCO with id : ${ImcoMasterSid} is successfully fetched`;
        } catch (error) {
            this.logger.warn(`Get IMCO by Id Error : ${JSON.stringify(error), error}`);
            resp.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                resp.message = error.message;
            } else {
                resp.message = "Internal Server Error";
            }
        }
        return resp;
    }



    @ApiOperation({ summary: 'Update IMCO by Id' })
    @ApiCreatedResponse({
        description: 'Update IMCO by Id',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Patch('update/:ImcoMasterSid')
    async updateIMCOById(@Param('ImcoMasterSid', ParseIntPipe) ImcoMasterSid: number, @Body() payload: any) {
        let resp = new ResponseData();
        try {
            this.logger.log(`Updating IMCO with id : ${ImcoMasterSid}`);
            let res = await this.imcoService.updateimcoMasterById(ImcoMasterSid, payload);
            this.logger.debug(`Updated IMCO : ${JSON.stringify(res)}`);
            const imcoName = payload?.ImcoName || 'Imco';
            resp.data = res;
            resp.message = `Imco ${imcoName}  is successfully updated`;
        } catch (error) {
            this.logger.warn(`IMCO Updation Error : ${JSON.stringify(error), error}`);
            resp.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                resp.message = error.message;
            } else {
                resp.message = "Internal Server Error";
            }
        }
        return resp;
    }



    @ApiOperation({ summary: 'Delete IMCO by Id' })
    @ApiCreatedResponse({
        description: 'Delete IMCO by Id',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Delete('delete/:ImcoMasterSid')
    async deleteIMCOById(@Param('ImcoMasterSid', ParseIntPipe) ImcoMasterSid: number) {
        let resp = new ResponseData();
        try {
            this.logger.log(`Deleting IMCO with id : ${ImcoMasterSid}`);
            let res = await this.imcoService.deleteimcoMasters(ImcoMasterSid);
            this.logger.debug(`Deleted IMCO : ${JSON.stringify(res)}`);
            resp.data = res;
            resp.message = `IMCO with id : ${ImcoMasterSid} is successfully deleted`;
        } catch (error) {
            this.logger.warn(`IMCO Deletion Error : ${JSON.stringify(error), error}`);
            resp.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                resp.message = error.message;
            } else {
                resp.message = "Internal Server Error";
            }
        }
        return resp;
    }



    @ApiOperation({ summary: 'Search List of IMCO' })
    @ApiCreatedResponse({
        description: 'Search List of IMCO',
        type: ResponseData,
    })
    @HttpCode(HttpStatus.OK)
    @Post('search-list')
    async searchIMCO(@Body() searchParams: filterDto) {
        const resp = new ResponseData();
        try {
            const res = await this.imcoService.searchimcoMaster(searchParams);
            this.logger.log(`IMCO Search Data: ${JSON.stringify(res)}`);
            resp.data = res;
            resp.message = 'IMCO Search is successfully fetched';
        } catch (error) {
            this.logger.warn(`Search IMCO Error: ${error}`);
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

            const logs = await this.imcoService.getAuditLogs(tableName, recordId);

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
