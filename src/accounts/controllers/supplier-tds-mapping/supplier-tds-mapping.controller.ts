
import { BadRequestException, Body, Controller, Delete, Get, HttpCode, HttpStatus, Logger, Param, ParseIntPipe, Patch, Post, Query, UnauthorizedException } from '@nestjs/common';
import { SupplierTdsMappingService } from 'src/accounts/services/supplier-tds-mapping/supplier-tds-mapping.service';
import { ApiCreatedResponse, ApiOperation } from '@nestjs/swagger';
import { Auth } from 'src/common/decorators/auth.decorator';
import { UserData } from 'src/common/decorators/user.decorator';
import { ResponseData } from 'src/common/response-data';
import { filterDto } from 'src/masters/DTO/search-vessel.dto';
@Controller('supplier-tds-mapping')
@Auth()
export class SupplierTdsMappingController {
    constructor(private logger: Logger, private suppliertdsmappingService: SupplierTdsMappingService) { }

    @ApiOperation({ summary: 'Get All Supplier TDS Mapping' })
    @ApiCreatedResponse({
        description: 'Get All Supplier TDS Mapping',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Get()
    async getAllSupptdsMapping() {
        let resp = new ResponseData();
        try {
            let res = await this.suppliertdsmappingService.getAllSupptdsMapping();
            this.logger.log(`All Supplier TDS Mapping Fetched : ${JSON.stringify(res)}`);
            resp.data = res;
            resp.message = "All Supplier TDS Mapping are successfully fetched";
        } catch (error) {
            this.logger.warn(`Get All Supplier TDS Mapping Error : ${JSON.stringify(error), error}`);
            resp.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                resp.message = error.message;
            } else {
                resp.message = "Internal Server Error";
            }
        }
        return resp;
    }


    @ApiOperation({ summary: 'Create new Supplier TDS Mapping' })
    @ApiCreatedResponse({
        description: 'Create new Supplier TDS Mapping',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Post('create')
    async createNewSupptdsMapping(@Body() newData: any) {
        let resp = new ResponseData();
        try {
            let res = await this.suppliertdsmappingService.createNewSupptdsMapping(newData);
            this.logger.log(`New Supplier TDS Mapping Created : ${JSON.stringify(res)}`);
            resp.data = res;
            resp.message = "New Supplier TDS Mapping is successfully created"
        } catch (error) {
            this.logger.warn(`Supplier TDS Mapping Creation Error : ${JSON.stringify(error), error}`);
            resp.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                resp.message = error.message;
            } else {
                resp.message = "Internal Server Error";
            }
        }
        return resp;
    }

    @ApiOperation({ summary: 'Get Supplier TDS Mapping by Id' })
    @ApiCreatedResponse({
        description: 'Get Supplier TDS Mapping by Id',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Get('fetch/:SupplierTdsMappingSid')
    async getSuppliertdsMappingId(@Param('SupplierTdsMappingSid', ParseIntPipe) SupplierTdsMappingSid: number) {
        let resp = new ResponseData();
        try {
            this.logger.log(`Getting Supplier TDS Mapping with id : ${SupplierTdsMappingSid}`);
            let res = await this.suppliertdsmappingService.fetchSuppliertdsMappingById(SupplierTdsMappingSid);
            this.logger.debug(`Fetched Supplier TDS Mapping : ${JSON.stringify(res)}`);
            resp.data = res;
            resp.message = `Supplier TDS Mapping with id : ${SupplierTdsMappingSid} is successfully fetched`;
        } catch (error) {
            this.logger.warn(`Get Supplier TDS Mapping by Id Error : ${JSON.stringify(error), error}`);
            resp.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                resp.message = error.message;
            } else {
                resp.message = "Internal Server Error";
            }
        }
        return resp;
    }


    @ApiOperation({ summary: 'Update Supplier TDS Mapping by Id' })
    @ApiCreatedResponse({
        description: 'Update Supplier TDS Mapping by Id',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Patch('update/:SupplierTdsMappingSid')
    async updateSuppliertdsMappingById(@Param('SupplierTdsMappingSid', ParseIntPipe) SupplierTdsMappingSid: number, @Body() payload: any) {
        let resp = new ResponseData();
        try {
            this.logger.log(`Updating Supplier TDS Mapping with id : ${SupplierTdsMappingSid}`);
            let res = await this.suppliertdsmappingService.updateSuppliertdsMappingById(SupplierTdsMappingSid, payload);
            this.logger.debug(`Updated Supplier TDS Mapping : ${JSON.stringify(res)}`);
            resp.data = res;
            resp.message = `Supplier TDS Mapping with id : ${SupplierTdsMappingSid} is successfully updated`;
        } catch (error) {
            this.logger.warn(`Supplier TDS Mapping Updation Error : ${JSON.stringify(error), error}`);
            resp.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                resp.message = error.message;
            } else {
                resp.message = "Internal Server Error";
            }
        }
        return resp;
    }

    @ApiOperation({ summary: 'Delete Supplier TDS Mapping by Id' })
    @ApiCreatedResponse({
        description: 'Delete Supplier TDS Mapping by Id',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Delete('delete/:SupplierTdsMappingSid')
    async deleteSuppliertdsMappingId(@Param('SupplierTdsMappingSid', ParseIntPipe) SupplierTdsMappingSid: number) {
        let resp = new ResponseData();
        try {
            this.logger.log(`Deleting Supplier TDS Mapping with id : ${SupplierTdsMappingSid}`);
            let res = await this.suppliertdsmappingService.deleteSuppliertdsMapping(SupplierTdsMappingSid);
            this.logger.debug(`Deleted Supplier TDS Mapping : ${JSON.stringify(res)}`);
            resp.data = res;
            resp.message = `
            Supplier TDS Mapping with id : ${SupplierTdsMappingSid} is successfully deleted`;
        } catch (error) {
            this.logger.warn(`Supplier TDS Mapping Deletion Error : ${JSON.stringify(error), error}`);
            resp.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                resp.message = error.message;
            } else {
                resp.message = "Internal Server Error";
            }
        }
        return resp;
    }

    @HttpCode(HttpStatus.OK)
    @Post('search-list')
    async searchSuppliertdsMapping(@Body() searchData: filterDto) {
        let resp = new ResponseData();
        try {
            let res = await this.suppliertdsmappingService.searchSuppliertdsMapping(searchData);
            this.logger.log(`Supplier TDS Mapping Search Results :${JSON.stringify(res)}`);
            resp.data = res;
            resp.message = "Supplier TDS Mapping Search results are successfully fetched"
        } catch (error) {
            this.logger.warn(`Supplier TDS Mapping Search Error : ${JSON.stringify(error), error}`);
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

            const logs = await this.suppliertdsmappingService.getAuditLogs(tableName, recordId);

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
