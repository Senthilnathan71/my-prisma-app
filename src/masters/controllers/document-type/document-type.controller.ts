import { BadRequestException, Body, Controller, Delete, Get, HttpCode, HttpStatus, Logger, Param, ParseIntPipe, Patch, Post, Query, UnauthorizedException } from '@nestjs/common';
import { ApiCreatedResponse, ApiOperation } from '@nestjs/swagger';
import { ResponseData } from 'src/common/response-data';
import { SearchListDto } from 'src/masters/DTO/search-list.dto';
import { filterDto } from 'src/masters/DTO/search-vessel.dto';
import { DocumentTypeService } from 'src/masters/services/document-type/document-type.service';
class CompanyIdDto {
    CompanyMasterSid: number;
    BranchMasterSid: number;
}

@Controller('document-type')
export class DocumentTypeController {
    constructor(private documentTypeService: DocumentTypeService, private logger: Logger) { }


    @ApiOperation({ summary: 'Create new Document Type' })
    @ApiCreatedResponse({
        description: 'Create new Document Type',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Post('create')
    async createNewDocType(@Body() newData: any) {
        let resp = new ResponseData();
        try {
            let res = await this.documentTypeService.createNewDocType(newData);
            this.logger.log(`New Document Type Created : ${JSON.stringify(res)}`);
            resp.data = res;
            resp.message = "New Document Type is successfully created"
        } catch (error) {
            this.logger.warn(`Document Type Creation Error : ${JSON.stringify(error), error}`);
            resp.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                resp.message = error.message;
            } else {
                resp.message = "Internal Server Error";
            }
        }
        return resp;
    }



    @ApiOperation({ summary: 'Get All Document Type' })
    @ApiCreatedResponse({
        description: 'Get All Document Type',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Post()
    async getAllDocType(@Body() body: CompanyIdDto) {
        let resp = new ResponseData();
        try {
            let res = await this.documentTypeService.getAllDocType(body.CompanyMasterSid, body.BranchMasterSid);
            this.logger.log(`All Document Type Fetched : ${JSON.stringify(res)}`);
            resp.data = res;
            resp.message = "All Document Type are successfully fetched";
        } catch (error) {
            this.logger.warn(`Get All Document Type Error : ${JSON.stringify(error), error}`);
            resp.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                resp.message = error.message;
            } else {
                resp.message = "Internal Server Error";
            }
        }
        return resp;
    }



    @ApiOperation({ summary: 'Get Document Type by Id' })
    @ApiCreatedResponse({
        description: 'Get Document Type by Id',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Get('fetch/:VoucherTypeMasterSid')
    async getDocTypeById(@Param('VoucherTypeMasterSid', ParseIntPipe) VoucherTypeMasterSid: number) {
        let resp = new ResponseData();
        try {
            this.logger.log(`Getting Document Type with id : ${VoucherTypeMasterSid}`);
            let res = await this.documentTypeService.fetchDocTypeById(VoucherTypeMasterSid);
            this.logger.debug(`Fetched Document Type : ${JSON.stringify(res)}`);
            resp.data = res;
            resp.message = `Document Type with id : ${VoucherTypeMasterSid} is successfully fetched`;
        } catch (error) {
            this.logger.warn(`Get Document Type by Id Error : ${JSON.stringify(error), error}`);
            resp.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                resp.message = error.message;
            } else {
                resp.message = "Internal Server Error";
            }
        }
        return resp;
    }



    @ApiOperation({ summary: 'Update Document Type by Id' })
    @ApiCreatedResponse({
        description: 'Update Document Type by Id',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Patch('update/:VoucherTypeMasterSid')
    async updateDocTypeById(@Param('VoucherTypeMasterSid', ParseIntPipe) VoucherTypeMasterSid: number, @Body() payload: any) {
        let resp = new ResponseData();
        try {
            this.logger.log(`Updating Document Type with id : ${VoucherTypeMasterSid}`);
            let res = await this.documentTypeService.updateDocTypeById(VoucherTypeMasterSid, payload);
            this.logger.debug(`Updated Document Type : ${JSON.stringify(res)}`);
            resp.data = res;
            resp.message = `Document Type with id : ${VoucherTypeMasterSid} is successfully updated`;
        } catch (error) {
            this.logger.warn(`Document Type Updation Error : ${JSON.stringify(error), error}`);
            resp.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                resp.message = error.message;
            } else {
                resp.message = "Internal Server Error";
            }
        }
        return resp;
    }



    @ApiOperation({ summary: 'Delete Document Type by Id' })
    @ApiCreatedResponse({
        description: 'Delete Document Type by Id',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Delete('delete/:VoucherTypeMasterSid')
    async deleteDocTypeById(@Param('VoucherTypeMasterSid', ParseIntPipe) VoucherTypeMasterSid: number) {
        let resp = new ResponseData();
        try {
            this.logger.log(`Deleting Document Type with id : ${VoucherTypeMasterSid}`);
            let res = await this.documentTypeService.deleteDocType(VoucherTypeMasterSid);
            this.logger.debug(`Deleted Document Type : ${JSON.stringify(res)}`);
            resp.data = res;
            resp.message = `
            Document Type with id : ${VoucherTypeMasterSid} is successfully deleted`;
        } catch (error) {
            this.logger.warn(`Document Type Deletion Error : ${JSON.stringify(error), error}`);
            resp.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                resp.message = error.message;
            } else {
                resp.message = "Internal Server Error";
            }
        }
        return resp;
    }



    @ApiOperation({ summary: 'Search List of Document Types' })
    @ApiCreatedResponse({
        description: 'Search List of Document Types',
        type: ResponseData,
    })
    @HttpCode(HttpStatus.OK)
    @Post('search-list')
    async searchDocTypeNew(@Body() searchParams: filterDto) {
        const resp = new ResponseData();
        try {
            const res = await this.documentTypeService.searchDocType(searchParams);
            this.logger.log(`Document Type Search Data: ${JSON.stringify(res)}`);
            resp.data = res;
            resp.message = 'Document Type Search is successfully fetched';
        } catch (error) {
            this.logger.warn(`Search Document Type Error: ${error}`);
            resp.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                resp.message = error.message;
            } else {
                resp.message = 'Internal Server Error';
            }
        }
        return resp;
    }


    @ApiOperation({ summary: 'Get Subledgers by COA Master ID' })
    @ApiCreatedResponse({
        description: 'Get Subledgers by COA Master ID',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Get('subledgers/:COAMasterSid')
    async getSubledgersByCOA(@Param('COAMasterSid', ParseIntPipe) COAMasterSid: number) {
        let resp = new ResponseData();
        try {
            this.logger.log(`Getting Subledgers for COA Master ID: ${COAMasterSid}`);
            let res = await this.documentTypeService.getSubledgersByCOA(COAMasterSid);
            this.logger.debug(`Fetched Subledgers: ${JSON.stringify(res)}`);
            resp.data = res;
            resp.message = `Subledgers for COA Master ID: ${COAMasterSid} are successfully fetched`;
        } catch (error) {
            this.logger.warn(`Get Subledgers by COA Error: ${JSON.stringify(error), error}`);
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

            const logs = await this.documentTypeService.getAuditLogs(tableName, recordId);

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
