import { BadRequestException, Body, Controller, Delete, Get, HttpCode, HttpStatus, Logger, NotFoundException, Param, ParseIntPipe, Patch, Post, Query, Res, UnauthorizedException } from '@nestjs/common';
import { ApiCreatedResponse, ApiOperation } from '@nestjs/swagger';
import { Auth } from 'src/common/decorators/auth.decorator';
import { ResponseData } from 'src/common/response-data';
import { SearchListDto } from 'src/masters/DTO/search-list.dto';
import { filterDto } from 'src/masters/DTO/search-vessel.dto';
import { YearService } from 'src/masters/services/year/year.service';

class CompanyIdDto {
    CompanyMasterSid: number;
}
@Controller('year')
export class YearController {
    constructor(private yearService: YearService, private logger: Logger) { }

    @ApiOperation({ summary: 'Create new Year' })
    @ApiCreatedResponse({
        description: 'Create new Year',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Post('create')
    async createNewYear(@Body() newData: any) {
        let resp = new ResponseData();
        try {
            let res = await this.yearService.createNewYear(newData);
            this.logger.log(`New Year Created : ${JSON.stringify(res)}`);
            resp.data = res;
            resp.message = "New Year is successfully created"
        } catch (error) {
            this.logger.warn(`Year Creation Error : ${JSON.stringify(error)}`);
            resp.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                resp.message = error.message;
            } else {
                resp.message = "Internal Server Error";
            }
        }
        return resp;
    }

    @ApiOperation({ summary: 'Get All Years' })
    @ApiCreatedResponse({
        description: 'Get All Years',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Post()
    async getAllYears(@Body() body: CompanyIdDto) {
        let resp = new ResponseData();
        try {
            let res = await this.yearService.getAllYears(body.CompanyMasterSid);
            this.logger.log(`All Years Fetched : ${JSON.stringify(res)}`);
            resp.data = res;
            resp.message = "All Years are successfully fetched";
        } catch (error) {
            this.logger.warn(`Get All Years Error : ${JSON.stringify(error)}`);
            resp.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                resp.message = error.message;
            } else {
                resp.message = "Internal Server Error";
            }
        }
        return resp;
    }

    @ApiOperation({ summary: 'Get Year by Id' })
    @ApiCreatedResponse({
        description: 'Get Year by Id',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Get('fetch/:YearMasterSid')
    async getYearById(@Param('YearMasterSid', ParseIntPipe) YearMasterSid: number) {
        let resp = new ResponseData();
        try {
            this.logger.log(`Getting Year with id : ${YearMasterSid}`);
            let res = await this.yearService.fetchYearById(YearMasterSid);
            this.logger.debug(`Fetched Year : ${JSON.stringify(res)}`);
            resp.data = res;
            resp.message = `Year with id : ${YearMasterSid} is successfully fetched`;
        } catch (error) {
            this.logger.warn(`Get Year by Id Error : ${JSON.stringify(error)}`);
            resp.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                resp.message = error.message;
            } else {
                resp.message = "Internal Server Error";
            }
        }
        return resp;
    }

    @ApiOperation({ summary: 'Get All Years by User Email' })
    @ApiCreatedResponse({
        description: 'Get All Years by User Email',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Get('user/:userEmail')
    async getYearByUserEmail(@Param('userEmail') userEmail: string) {
        let resp = new ResponseData();
        try {
            this.logger.log(`Getting Year with mail : ${userEmail}`);
            let res = await this.yearService.getAllYearMaster(userEmail);
            this.logger.debug(`Fetched Year : ${JSON.stringify(res)}`);
            resp.data = res;
            resp.message = `Year with id : ${userEmail} is successfully fetched`;
        } catch (error) {
            this.logger.warn(`Get Year by Id Error : ${JSON.stringify(error),error}`);
            resp.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException || error instanceof NotFoundException) {
                resp.message = error.message;
            } else {
                resp.message = "Internal Server Error";
            }
        }
        return resp;
    }

    
    @ApiOperation({ summary: 'Get All Years by Company Id' })
    @ApiCreatedResponse({
        description: 'Get All Years by Company Id',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Get('company/:CompanyMasterSid')
    async getYearByCompanyId(@Param('CompanyMasterSid', ParseIntPipe) CompanyMasterSid: number) {
        let resp = new ResponseData();
        try {
            this.logger.log(`Getting Years with CompanyMasterSid : ${CompanyMasterSid}`);
            let res = await this.yearService.getFinancialYearsByCompany(CompanyMasterSid);
            this.logger.debug(`Fetched Year : ${JSON.stringify(res)}`);
            resp.data = res;
            resp.message = `Years with CompanyMasterSid : ${CompanyMasterSid} is successfully fetched`;
        } catch (error) {
            this.logger.warn(`Get Years by CompanyMasterSid Error : ${JSON.stringify(error)}`);
            resp.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException || error instanceof NotFoundException) {
                resp.message = error.message;
            } else {
                resp.message = "Internal Server Error";
            }
        }
        return resp;
    }

    @ApiOperation({ summary: 'Update Year by Id' })
    @ApiCreatedResponse({
        description: 'Update Year by Id',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Patch('update/:YearMasterSid')
    async updateYearById(@Param('YearMasterSid', ParseIntPipe) YearMasterSid: number, @Body() payload: any) {
        let resp = new ResponseData();
        try {
            this.logger.log(`Updating Year with id : ${YearMasterSid}`);
            let res = await this.yearService.updateYearById(YearMasterSid, payload);
            this.logger.debug(`Updated Year : ${JSON.stringify(res)}`);
            resp.data = res;
            resp.message = `Year with id : ${YearMasterSid} is successfully updated`;
        } catch (error) {
            this.logger.warn(`Year Updation Error : ${JSON.stringify(error)}`);
            resp.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                resp.message = error.message;
            } else {
                resp.message = "Internal Server Error";
            }
        }
        return resp;
    }

    @ApiOperation({ summary: 'Delete Year by Id' })
    @ApiCreatedResponse({
        description: 'Delete Year by Id',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Delete('delete/:YearMasterSid')
    async deleteYearById(@Param('YearMasterSid', ParseIntPipe) YearMasterSid: number) {
        let resp = new ResponseData();
        try {
            this.logger.log(`Deleting Year with id : ${YearMasterSid}`);
            let res = await this.yearService.deleteYear(YearMasterSid);
            this.logger.debug(`Deleted Year : ${JSON.stringify(res)}`);
            resp.data = res;
            resp.message = `Year with id : ${YearMasterSid} is successfully deleted`;
        } catch (error) {
            this.logger.warn(`Year Deletion Error : ${JSON.stringify(error)}`);
            resp.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                resp.message = error.message;
            } else {
                resp.message = "Internal Server Error";
            }
        }
        return resp;
    }

    @ApiOperation({ summary: 'Search List of Years' })
    @ApiCreatedResponse({
        description: 'Search List of Years',
        type: ResponseData,
    })
    @HttpCode(HttpStatus.OK)
    @Post('search-list')
    async searchYearNew(@Body() searchParams: filterDto) {
        const resp = new ResponseData();
        try {
            const res = await this.yearService.searchYearNew(searchParams);
            this.logger.log(`Year Search Data: ${JSON.stringify(res)}`);
            resp.data = res;
            resp.message = 'Year Search is successfully fetched';
        } catch (error) {
            this.logger.warn(`Search Year Error: ${error}`);
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

            const logs = await this.yearService.getAuditLogs(tableName, recordId);

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