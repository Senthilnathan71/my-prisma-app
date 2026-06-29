import { BadRequestException, Body, Controller, Delete, Get, HttpCode, HttpStatus, Logger, Param, ParseIntPipe, Patch, Post, Query, UnauthorizedException } from '@nestjs/common';
import { ApiCreatedResponse, ApiOperation } from '@nestjs/swagger';
import { Auth } from 'src/common/decorators/auth.decorator';
import { ResponseData } from 'src/common/response-data';
import { SearchListDto } from 'src/masters/DTO/search-list.dto';
import { filterDto } from 'src/masters/DTO/search-vessel.dto';
import { AuthorityService } from 'src/masters/services/authority/authority.service';

@Auth()
@Controller('authority')
export class AuthorityController {
    constructor(private authorityService: AuthorityService, private logger: Logger) { }

    @ApiOperation({ summary: 'Create new Authority' })
    @ApiCreatedResponse({
        description: 'Create new Authority',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Post('create')
    async createNewAuthority(@Body() newData: any) {
        let resp = new ResponseData();
        try {
            let res = await this.authorityService.createNewAuthority(newData);
            this.logger.log(`New Authority Created : ${JSON.stringify(res)}`);
            resp.data = res;
            resp.message = `Authority is successfully created`;
        } catch (error) {
            this.logger.warn(`Authority Creation Error : ${JSON.stringify(error), error}`);
            resp.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                resp.message = error.message;
            } else {
                resp.message = "Internal Server Error";
            }
        }
        return resp;
    }

    @ApiOperation({ summary: 'Get All Authorities' })
    @ApiCreatedResponse({
        description: 'Get All Authorities',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Get()
    async getAllAuthorities() {
        let resp = new ResponseData();
        try {
            let res = await this.authorityService.getAllAuthorities();
            this.logger.log(`All Authorities Fetched : ${JSON.stringify(res)}`);
            resp.data = res;
            resp.message = "All Authorities are successfully fetched";
        } catch (error) {
            this.logger.warn(`Get All Authorities Error : ${JSON.stringify(error), error}`);
            resp.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                resp.message = error.message;
            } else {
                resp.message = "Internal Server Error";
            }
        }
        return resp;
    }

    @ApiOperation({ summary: 'Get Authority by Id' })
    @ApiCreatedResponse({
        description: 'Get Authority by Id',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Post('fetch')
    async getAuthorityById(
        @Body() payload: any
    ) {
        let resp = new ResponseData();
        try {
            this.logger.log(`Getting Authority with id : ${payload.AuthorityMasterSid}`);
            let res = await this.authorityService.fetchAuthorityById(payload.AuthorityMasterSid,payload.CompanyMasterSid,payload.BranchMasterSid);
            this.logger.debug(`Fetched Authority : ${JSON.stringify(res)}`);
            resp.data = res;
            resp.message = `Authority with id : ${payload.AuthorityMasterSid} is successfully fetched`;
        } catch (error) {
            this.logger.warn(`Get Authority by Id Error : ${JSON.stringify(error), error}`);
            resp.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                resp.message = error.message;
            } else {
                resp.message = "Internal Server Error";
            }
        }
        return resp;
    }

    @ApiOperation({ summary: 'Update Authority by Id' })
    @ApiCreatedResponse({
        description: 'Update Authority by Id',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Patch('update/:AuthorityMasterSid')
    async updateAuthorityById(@Param('AuthorityMasterSid', ParseIntPipe) AuthorityMasterSid: number, @Body() payload: any) {
        let resp = new ResponseData();
        try {
            this.logger.log(`Updating Authority with id : ${AuthorityMasterSid}`);
            let res = await this.authorityService.updateAuthorityById(AuthorityMasterSid, payload);
            this.logger.debug(`Updated Authority : ${JSON.stringify(res)}`);
            resp.data = res;
            resp.message = `Authority is successfully updated`;
        } catch (error) {
            this.logger.warn(`Authority Update Error : ${JSON.stringify(error), error}`);
            resp.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                resp.message = error.message;
            } else {
                resp.message = "Internal Server Error";
            }
        }
        return resp;
    }

    @ApiOperation({ summary: 'Delete Authority by Id' })
    @ApiCreatedResponse({
        description: 'Delete Authority by Id',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Delete('delete/:AuthorityMasterSid')
    async deleteAuthorityById(@Param('AuthorityMasterSid', ParseIntPipe) AuthorityMasterSid: number) {
        let resp = new ResponseData();
        try {
            this.logger.log(`Deleting Authority with id : ${AuthorityMasterSid}`);
            let res = await this.authorityService.deleteAuthority(AuthorityMasterSid);
            this.logger.debug(`Deleted Authority : ${JSON.stringify(res)}`);
            resp.data = res;
            resp.message = `Authority with id : ${AuthorityMasterSid} is successfully deleted`;
        } catch (error) {
            this.logger.warn(`Authority Deletion Error : ${JSON.stringify(error), error}`);
            resp.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                resp.message = error.message;
            } else {
                resp.message = "Internal Server Error";
            }
        }
        return resp;
    }

    @ApiOperation({ summary: 'Search List of Authorities' })
    @ApiCreatedResponse({
        description: 'Search List of Authorities',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Post('search-list')
    async searchAuthority(@Body() param: filterDto) {
        let resp = new ResponseData();
        try {
            let res = await this.authorityService.newSearchAuthority(param);
            this.logger.log(`Authority Search Results :${JSON.stringify(res)}`);
            resp.data = res;
            resp.message = "Authority Search results are successfully fetched"
        } catch (error) {
            this.logger.warn(`Authority Search Error : ${JSON.stringify(error), error}`);
            resp.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                resp.message = error.message;
            } else {
                resp.message = "Internal Server Error";
            }
        }
        return resp;
    }

    @ApiOperation({ summary: 'Search Document Authorization List' })
    @ApiCreatedResponse({
        description: 'Search Document Authorization List',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Post('document/search-list/:UserMasterSid')
    async searchDocAuthorization(
        @Body() param: filterDto,
        @Param('UserMasterSid', ParseIntPipe) UserMasterSid: number
    ) {
        const resp = new ResponseData();
        try {

            const res = await this.authorityService.searchDocAuthorization(param, UserMasterSid);

            this.logger.log(`Doc Authorization Search Data : ${JSON.stringify(res)}`);
            resp.data = res;
            resp.message = 'Document Authorization Search successfully fetched';
        } catch (error) {
            this.logger.warn(`Doc Authorization Search Error : ${JSON.stringify(error)}, ${error}`);
            resp.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                resp.message = error.message;
            } else {
                resp.message = 'Internal Server Error';
            }
        }
        return resp;
    }


    @ApiOperation({ summary: 'Check if user is an authorizer for a menu' })
    @ApiCreatedResponse({
        description: 'Returns true if the user is an authorizer',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Post('check-authorizer')
    async isUserAuthorizer(@Body() payload: any) {
        const resp = new ResponseData();
        try {
            const result = await this.authorityService.isUserAuthorizer(payload);

            this.logger.log(`Authorizer Check Result for DocumentSid = ${JSON.stringify(payload)}`);

            resp.data = result;
            resp.message = result.message
        } catch (error) {
            this.logger.warn(`Authorizer Check Error: ${JSON.stringify(error)}, ${error}`);
            resp.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                resp.message = error.message;
            } else {
                resp.message = 'Internal Server Error';
            }
        }

        return resp;
    }

    @ApiOperation({ summary: 'Record an approve/reject decision for a document' })
    @ApiCreatedResponse({
        description: 'Persists the decision and returns the refreshed approval log.',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Post('authorize')
    async authorizeDocument(@Body() payload: any) {
        const resp = new ResponseData();
        try {
            const result = await this.authorityService.authorizeDocument(payload);
            resp.data = result;
            resp.message = 'Approval recorded successfully.';
        } catch (error) {
            this.logger.warn(`Authorize Document Error: ${JSON.stringify(error)}, ${error}`);
            resp.status = false;
            resp.message =
                error instanceof BadRequestException || error instanceof UnauthorizedException
                    ? error.message
                    : 'Internal Server Error';
        }
        return resp;
    }

    @ApiOperation({ summary: 'Get approval status and log for a document under a menu' })
    @ApiCreatedResponse({
        description: 'Returns approval status or pending message for the given document and menu.',
        type: ResponseData,
    })
    @HttpCode(HttpStatus.OK)
    @Get('approval-status/:MenuMasterSid/:DocumentSid')
    async getApprovalStatus(
        @Param('MenuMasterSid', ParseIntPipe) MenuMasterSid: number,
        @Param('DocumentSid', ParseIntPipe) DocumentSid: number,
        @Query('CompanyMasterSid') CompanyMasterSid?: string,
        @Query('BranchMasterSid') BranchMasterSid?: string,
        @Query('DepartmentMasterSid') DepartmentMasterSid?: string,
        @Query('DepartmentMaster') DepartmentMaster?: string
    ) {
        const resp = new ResponseData();

        try {
            const result = await this.authorityService.getApprovalStatusData(
                MenuMasterSid,
                DocumentSid,
                CompanyMasterSid ? Number(CompanyMasterSid) : undefined,
                BranchMasterSid ? Number(BranchMasterSid) : undefined,
                DepartmentMasterSid ? Number(DepartmentMasterSid) : undefined,
                DepartmentMaster
            );
            resp.data = result;
            resp.message = "Document's approval log has been fetched.";
        } catch (error) {
            this.logger.warn(`Approval Status Error: ${JSON.stringify(error)}`);
            resp.status = false;
            resp.message =
                error instanceof BadRequestException || error instanceof UnauthorizedException
                    ? error.message
                    : 'Internal Server Error';
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

            const logs = await this.authorityService.getAuditLogs(tableName, recordId);

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
