import { BadRequestException, Body, Controller, Delete, Get, HttpCode, HttpStatus, Logger, Param, ParseIntPipe, Patch, Post, Query, UnauthorizedException } from '@nestjs/common';
import { ApiCreatedResponse, ApiOperation } from '@nestjs/swagger';
import { SubledgermasterService } from 'src/accounts/services/subledgermaster/subledgermaster.service';
import { ResponseData } from 'src/common/response-data';
import { SearchListDto } from 'src/masters/DTO/search-list.dto';
import { filterDto } from 'src/masters/DTO/search-vessel.dto';

@Controller('subledgermaster')
export class SubledgermasterController {
    constructor(private SubledgermasterService: SubledgermasterService, private logger: Logger) { }


    @ApiOperation({ summary: 'Get All SubledgerMaster' })
    @ApiCreatedResponse({
        description: 'Get All SubledgerMaster',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Get()
    async getAllSuledgermaster() {
        let resp = new ResponseData();
        try {
            let res = await this.SubledgermasterService.getAllSuledgermaster();
            this.logger.log(`All SubledgerMaster Fetched : ${JSON.stringify(res)}`);
            resp.data = res;
            resp.message = "All SubledgerMaster are successfully fetched";
        } catch (error) {
            this.logger.warn(`Get All SubledgerMaster Error : ${JSON.stringify(error), error}`);
            resp.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                resp.message = error.message;
            } else {
                resp.message = "Internal Server Error";
            }
        }
        return resp;
    }

    @ApiOperation({ summary: 'Create new SubledgerMaster' })
    @ApiCreatedResponse({
        description: 'Create new SubledgerMaster',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Post('create')
    async createNewSubledgerMaster(@Body() newData: any) {
        let resp = new ResponseData();
        try {
            let res = await this.SubledgermasterService.createNewSubledgerMaster(newData);
            this.logger.log(`New SubledgerMaster Created : ${JSON.stringify(res)}`);
            resp.data = res;
            resp.message = "New SubledgerMaster is successfully created"
        } catch (error) {
            this.logger.warn(`SubledgerMaster Creation Error : ${JSON.stringify(error), error}`);
            resp.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                resp.message = error.message;
            } else {
                resp.message = "Internal Server Error";
            }
        }
        return resp;
    }

    
    @ApiOperation({summary : "Get All Mapped Creditors"})
    @ApiCreatedResponse({
        description : "Get All Mapped Creditors",
        type : ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Post('mapped-creditors')
    async getAllMappedCustomerCreditors(@Body() payload:any) {
        let resp = new ResponseData();
        try {
            let res = await this.SubledgermasterService.getAllMappedCustomerCreditors(payload);
            this.logger.log(`All Mapped Creditors Fetched : ${JSON.stringify(res)}`);
            resp.data = res;
            resp.message = "All Mapped Creditors are successfully fetched";
        } catch (error) {
            this.logger.warn(`Get All Mapped Creditors Error : ${JSON.stringify(error), error}`);
            resp.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                resp.message = error.message;
            } else {
                resp.message = "Internal Server Error";
            }
        }
        return resp;
    }

    @ApiOperation({summary : "Get All Mapped Customer Debtors"})
    @ApiCreatedResponse({
        description : "Get All Mapped Customer Debtors",
        type : ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Post('mapped-debtors')
    async getAllMappedCustomerDebtors(@Body() payload:any) {
        let resp = new ResponseData();
        try {
            let res = await this.SubledgermasterService.getAllMappedCustomerDebtors(payload);
            this.logger.log(`All Mapped Debtors Fetched : ${JSON.stringify(res)}`);
            resp.data = res;
            resp.message = "All Mapped Debtors are successfully fetched";
        } catch (error) {
            this.logger.warn(`Get All Mapped Debtors Error : ${JSON.stringify(error), error}`);
            resp.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                resp.message = error.message;
            } else {
                resp.message = "Internal Server Error";
            }
        }
        return resp;
    }



    @ApiOperation({ summary: 'Get SubledgerMaster by Id' })
    @ApiCreatedResponse({
        description: 'Get SubledgerMaster by Id',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Get('fetch/:SubledgerMasterSid')
    async getSubledgerMasterId(@Param('SubledgerMasterSid', ParseIntPipe) SubledgerMasterSid: number) {
        let resp = new ResponseData();
        try {
            this.logger.log(`Getting SubledgerMaster with id : ${SubledgerMasterSid}`);
            let res = await this.SubledgermasterService.fetchSubledgerMasterId(SubledgerMasterSid);
            this.logger.debug(`Fetched SubledgerMaster : ${JSON.stringify(res)}`);
            resp.data = res;
            resp.message = `SubledgerMaster with id : ${SubledgerMasterSid} is successfully fetched`;
        } catch (error) {
            this.logger.warn(`Get SubledgerMaster by Id Error : ${JSON.stringify(error), error}`);
            resp.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                resp.message = error.message;
            } else {
                resp.message = "Internal Server Error";
            }
        }
        return resp;
    }

    @ApiOperation({ summary: 'Update SubledgerMaster by Id' })
    @ApiCreatedResponse({
        description: 'Update SubledgerMaster by Id',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Patch('update/:SubledgerMasterSid')
    async updateSubledgerMasterById(@Param('SubledgerMasterSid', ParseIntPipe) SubledgerMasterSid: number, @Body() payload: any) {
        let resp = new ResponseData();
        try {
            this.logger.log(`Updating SubledgerMaster with id : ${SubledgerMasterSid}`);
            let res = await this.SubledgermasterService.updateSubledgerMasterById(SubledgerMasterSid, payload);
            this.logger.debug(`Updated SubledgerMaster : ${JSON.stringify(res)}`);
            resp.data = res;
            resp.message = `SubledgerMaster with id : ${SubledgerMasterSid} is successfully updated`;
        } catch (error) {
            this.logger.warn(`SubledgerMaster Updation Error : ${JSON.stringify(error), error}`);
            resp.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                resp.message = error.message;
            } else {
                resp.message = "Internal Server Error";
            }
        }
        return resp;
    }

    @ApiOperation({ summary: 'Delete SubledgerMaster by Id' })
    @ApiCreatedResponse({
        description: 'Delete SubledgerMaster by Id',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Delete('delete/:SubledgerMasterSid')
    async deleteSudledgerMasterById(@Param('SubledgerMasterSid', ParseIntPipe) SubledgerMasterSid: number) {
        let resp = new ResponseData();
        try {
            this.logger.log(`Deleting SubledgerMaster with id : ${SubledgerMasterSid}`);
            let res = await this.SubledgermasterService.deleteSudledgerMaster(SubledgerMasterSid);
            this.logger.debug(`Deleted SubledgerMaster : ${JSON.stringify(res)}`);
            resp.data = res;
            resp.message = `
            SubledgerMaster with id : ${SubledgerMasterSid} is successfully deleted`;
        } catch (error) {
            this.logger.warn(`SubledgerMaster Deletion Error : ${JSON.stringify(error), error}`);
            resp.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                resp.message = error.message;
            } else {
                resp.message = "Internal Server Error";
            }
        }
        return resp;
    }

    @ApiOperation({ summary: 'Search List of SubledgerMaster' })
    @ApiCreatedResponse({
        description: 'Search List of SubledgerMaster',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Post('search-list')
    async searchSubledgerMaster(@Body() searchData: filterDto) {
        let resp = new ResponseData();
        try {
            let res = await this.SubledgermasterService.searchSubledgerMaster(searchData);
            this.logger.log(`SubledgerMaster Search Results :${JSON.stringify(res)}`);
            resp.data = res;
            resp.message = "SubledgerMaster Search results are successfully fetched"
        } catch (error) {
            this.logger.warn(`SubledgerMaster Search Error : ${JSON.stringify(error), error}`);
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

            const logs = await this.SubledgermasterService.getAuditLogs(tableName, recordId);

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
    // subledgermaster.controller.ts - Add these new endpoints

@ApiOperation({ summary: 'Get Subledger Master by Type' })
@ApiCreatedResponse({
    description: 'Get Subledger Master by Type',
    type: ResponseData
})
@HttpCode(HttpStatus.OK)
@Get('type/:subledgerType')
async getSubledgerMasterByType(@Param('subledgerType') subledgerType: string) {
    let resp = new ResponseData();
    try {
        let res = await this.SubledgermasterService.getSubledgerMasterByType(subledgerType);
        this.logger.log(`SubledgerMaster by Type Fetched : ${JSON.stringify(res)}`);
        resp.data = res;
        resp.message = "SubledgerMaster by type successfully fetched";
    } catch (error) {
        this.logger.warn(`Get SubledgerMaster by Type Error : ${JSON.stringify(error), error}`);
        resp.status = false;
        if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
            resp.message = error.message;
        } else {
            resp.message = "Internal Server Error";
        }
    }
    return resp;
}

@ApiOperation({ summary: 'Bulk Update Subledger Master' })
@ApiCreatedResponse({
    description: 'Bulk Update Subledger Master',
    type: ResponseData
})
@HttpCode(HttpStatus.OK)
@Patch('bulk-update')
async bulkUpdateSubledgerMaster(@Body() payload: { updates: any[] }) {
    let resp = new ResponseData();
    try {
        let res = await this.SubledgermasterService.bulkUpdateSubledgerMaster(payload.updates);
        this.logger.log(`SubledgerMaster Bulk Updated : ${JSON.stringify(res)}`);
        resp.data = res;
        resp.message = "SubledgerMaster successfully updated in bulk";
    } catch (error) {
        this.logger.warn(`SubledgerMaster Bulk Update Error : ${JSON.stringify(error), error}`);
        resp.status = false;
        if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
            resp.message = error.message;
        } else {
            resp.message = "Internal Server Error";
        }
    }
    return resp;
}
}
