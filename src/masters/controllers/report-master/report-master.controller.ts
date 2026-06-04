import {
    BadRequestException,
    Body,
    Controller,
    Delete,
    Get,
    HttpCode,
    HttpStatus,
    Logger,
    Param,
    ParseIntPipe,
    Patch,
    Post,
    UnauthorizedException,
    Query
} from '@nestjs/common';
import { ApiCreatedResponse, ApiOperation } from '@nestjs/swagger';
import { Auth } from 'src/common/decorators/auth.decorator';
import { ResponseData } from 'src/common/response-data';
import { SearchListDto } from 'src/masters/DTO/search-list.dto';
import { filterDto } from 'src/masters/DTO/search-vessel.dto';
import { ReportMasterService } from 'src/masters/services/report-master/report-master.service';
@Auth()
@Controller('report-master')
export class ReportMasterController {
    
    constructor(
        private reportMasterService: ReportMasterService,
        private logger: Logger,
    ) { }

    @ApiOperation({ summary: 'Create a new Report Master' })
    @ApiCreatedResponse({ description: 'Create a new Report Master', type: ResponseData })
    @HttpCode(HttpStatus.CREATED)
    @Post('create')
    async createReportMasterData(@Body() newData: any) {
        const resp = new ResponseData();
        this.logger.log(`createReportMasterData: ${JSON.stringify(newData)}`);
        try {
            const res = await this.reportMasterService.createReportMaster(newData);
            this.logger.debug(`Created ReportMaster: ${JSON.stringify(res)}`);
            if (!res) throw 'Something went wrong';
            resp.data = res;
            resp.message = 'Report Master Created Successfully';
        } catch (error) {
            this.logger.warn(`createReportMasterError: ${JSON.stringify(error),error}`);
            resp.status = false;
            resp.message = error instanceof BadRequestException || error instanceof UnauthorizedException
                ? error.message
                : 'Internal Server Error';
        }
        return resp;
    }

    @ApiOperation({ summary: 'Get All Report Masters' })
    @ApiCreatedResponse({ description: 'Get all Report Masters', type: ResponseData })
    @HttpCode(HttpStatus.OK)
    @Get()
    async getAllReportMaster() {
        const resp = new ResponseData();
        try {
            const res = await this.reportMasterService.getAllReportMaster();
            this.logger.log(`getAllReportMaster: ${JSON.stringify(res)}`);
            resp.data = res;
            resp.message = 'Report Masters fetched successfully';
        } catch (error) {
            this.logger.warn(`getAllReportMasterError: ${JSON.stringify(error)}`);
            resp.status = false;
            resp.message = error instanceof BadRequestException || error instanceof UnauthorizedException
                ? error.message
                : 'Internal Server Error';
        }
        return resp;
    }

    @ApiOperation({ summary: 'Get Report Master By Id' })
    @ApiCreatedResponse({ description: 'Get Report Master by ID', type: ResponseData })
    @HttpCode(HttpStatus.OK)
    @Get('fetch/:id')
    async getReportMasterById(@Param('id', ParseIntPipe) id: number) {
        const resp = new ResponseData();
        try {
            const res = await this.reportMasterService.getReportMasterById(id);
            this.logger.log(`getReportMasterById: ${JSON.stringify(res)}`);
            if (!res) throw 'Something went wrong';
            resp.data = res;
            resp.message = `Report Master with id: ${id} fetched successfully`;
        } catch (error) {
            this.logger.warn(`getReportMasterByIdError: ${JSON.stringify(error)}`);
            resp.status = false;
            resp.message = error instanceof BadRequestException || error instanceof UnauthorizedException
                ? error.message
                : 'Internal Server Error';
        }
        return resp;
    }

    @ApiOperation({ summary: 'Update Report Master By Id' })
    @ApiCreatedResponse({ description: 'Update Report Master by ID', type: ResponseData })
    @HttpCode(HttpStatus.OK)
    @Patch('update/:id')
    async editReportMasterById(@Param('id', ParseIntPipe) id: number, @Body() newData: any) {
        const resp = new ResponseData();
        this.logger.log(`editReportMasterByIdBody: ${JSON.stringify(newData)}`);
        try {
            const res = await this.reportMasterService.editReportMasterById(id, newData);
            this.logger.log(`editReportMasterById: ${JSON.stringify(res)}`);
            if (!res) throw 'Something went wrong';
            resp.data = res;
            resp.message = `Report Master with id: ${id} updated successfully`;
        } catch (error) {
            this.logger.warn(`editReportMasterByIdError: ${JSON.stringify(error),error}`);
            resp.status = false;
            resp.message = error instanceof BadRequestException || error instanceof UnauthorizedException
                ? error.message
                : 'Internal Server Error';
        }
        return resp;
    }

    @ApiOperation({ summary: 'Delete Report Master By Id' })
    @ApiCreatedResponse({ description: 'Delete Report Master by ID', type: ResponseData })
    @HttpCode(HttpStatus.OK)
    @Delete('delete/:id')
    async softDeleteReportMaster(@Param('id', ParseIntPipe) id: number) {
        const resp = new ResponseData();
        this.logger.log(`Deleting Report Master with id: ${id}`);
        try {
            const res = await this.reportMasterService.softDeleteReportMaster(id);
            this.logger.log(`Deleted Report Master: ${JSON.stringify(res)}`);
            if (!res) throw 'Something went wrong';
            resp.data = res;
            resp.message = `Report Master with id: ${id} deleted successfully`;
        } catch (error) {
            this.logger.warn(`softDeleteReportMasterError: ${JSON.stringify(error)}`);
            resp.status = false;
            resp.message = error instanceof BadRequestException || error instanceof UnauthorizedException
                ? error.message
                : 'Internal Server Error';
        }
        return resp;
    }

    @ApiOperation({ summary: 'Search Report Masters' })
    @ApiCreatedResponse({ description: 'Search Report Master list', type: ResponseData })
    @HttpCode(HttpStatus.OK)
    @Post('search-list')
    async searchReportMaster(@Body() searchParams: filterDto) {
        const resp = new ResponseData();
        try {
            const res = await this.reportMasterService.searchReportMasterNew(searchParams);
            this.logger.log(`searchReportMaster: ${JSON.stringify(res)}`);
            resp.data = res;
            resp.message = 'Report Master list fetched successfully';
        } catch (error) {
            this.logger.warn(`searchReportMasterError: ${JSON.stringify(error),error}`);
            resp.status = false;
            resp.message = error instanceof BadRequestException || error instanceof UnauthorizedException
                ? error.message
                : 'Internal Server Error';
        }
        return resp;
    }

    @ApiOperation({ summary: 'Get Audit Logs for Report Master' })
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

            const logs = await this.reportMasterService.getAuditLogs(tableName, recordId);

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

    @ApiOperation({ summary: 'Get Report Parameters by Report ID' })
    @ApiCreatedResponse({ description: 'Get report parameters', type: ResponseData })
    @HttpCode(HttpStatus.OK)
    @Get(':id/parameters')
    async getReportParameters(@Param('id', ParseIntPipe) id: number) {
        const resp = new ResponseData();
        try {
            const res = await this.reportMasterService.getReportParameters(id);
            this.logger.log(`getReportParameters: ${JSON.stringify(res)}`);
            resp.data = res;
            resp.message = `Parameters for Report with id: ${id} fetched successfully`;
        } catch (error) {
            this.logger.warn(`getReportParametersError: ${JSON.stringify(error)}`);
            resp.status = false;
            resp.message = error instanceof BadRequestException || error instanceof UnauthorizedException
                ? error.message
                : 'Internal Server Error';
        }
        return resp;
    }

    @ApiOperation({ summary: 'Add Report Parameter' })
    @ApiCreatedResponse({ description: 'Add new parameter to report', type: ResponseData })
    @HttpCode(HttpStatus.CREATED)
    @Post(':id/parameters')
    async addReportParameter(@Param('id', ParseIntPipe) id: number, @Body() parameterData: any) {
        const resp = new ResponseData();
        this.logger.log(`addReportParameter: ${JSON.stringify(parameterData)}`);
        try {
            const res = await this.reportMasterService.addReportParameter(id, parameterData);
            this.logger.debug(`Created Parameter: ${JSON.stringify(res)}`);
            if (!res) throw 'Something went wrong';
            resp.data = res;
            resp.message = 'Report parameter added successfully';
        } catch (error) {
            this.logger.warn(`addReportParameterError: ${JSON.stringify(error)}`);
            resp.status = false;
            resp.message = error instanceof BadRequestException || error instanceof UnauthorizedException
                ? error.message
                : 'Internal Server Error';
        }
        return resp;
    }

    @ApiOperation({ summary: 'Update Report Parameter' })
    @ApiCreatedResponse({ description: 'Update report parameter', type: ResponseData })
    @HttpCode(HttpStatus.OK)
    @Patch('parameters/:parameterId')
    async updateReportParameter(
        @Param('parameterId', ParseIntPipe) parameterId: number,
        @Body() parameterData: any
    ) {
        const resp = new ResponseData();
        this.logger.log(`updateReportParameter: ${JSON.stringify(parameterData)}`);
        try {
            const res = await this.reportMasterService.updateReportParameter(parameterId, parameterData);
            this.logger.log(`updateReportParameter: ${JSON.stringify(res)}`);
            if (!res) throw 'Something went wrong';
            resp.data = res;
            resp.message = `Parameter with id: ${parameterId} updated successfully`;
        } catch (error) {
            this.logger.warn(`updateReportParameterError: ${JSON.stringify(error)}`);
            resp.status = false;
            resp.message = error instanceof BadRequestException || error instanceof UnauthorizedException
                ? error.message
                : 'Internal Server Error';
        }
        return resp;
    }

    @ApiOperation({ summary: 'Delete Report Parameter' })
    @ApiCreatedResponse({ description: 'Delete report parameter', type: ResponseData })
    @HttpCode(HttpStatus.OK)
    @Delete('parameters/:parameterId')
    async deleteReportParameter(@Param('parameterId', ParseIntPipe) parameterId: number) {
        const resp = new ResponseData();
        this.logger.log(`Deleting Parameter with id: ${parameterId}`);
        try {
            const res = await this.reportMasterService.deleteReportParameter(parameterId);
            this.logger.log(`Deleted Parameter: ${JSON.stringify(res)}`);
            if (!res) throw 'Something went wrong';
            resp.data = res;
            resp.message = `Parameter with id: ${parameterId} deleted successfully`;
        } catch (error) {
            this.logger.warn(`deleteReportParameterError: ${JSON.stringify(error)}`);
            resp.status = false;
            resp.message = error instanceof BadRequestException || error instanceof UnauthorizedException
                ? error.message
                : 'Internal Server Error';
        }
        return resp;
    }

    @ApiOperation({ summary: 'Get Reports by Menu ID' })
    @ApiCreatedResponse({ description: 'Get active reports for a specific menu', type: ResponseData })
    @HttpCode(HttpStatus.OK)
    @Get('by-menu/:menuId')
    async getReportsByMenu(
        @Param('menuId', ParseIntPipe) menuId: number,
        @Query('companyId') companyId?: string,
    ) {
        const resp = new ResponseData();
        try {
            const res = await this.reportMasterService.getByMenu(
                menuId,
                companyId ? parseInt(companyId, 10) : undefined,
            );
            resp.data = res;
            resp.message = `Reports for menu: ${menuId} fetched successfully`;
        } catch (error) {
            this.logger.warn(`getReportsByMenuError: ${JSON.stringify(error)}`);
            resp.status = false;
            resp.message = error instanceof BadRequestException || error instanceof UnauthorizedException
                ? error.message
                : 'Internal Server Error';
        }
        return resp;
    }

    @ApiOperation({ summary: 'Get Reports by Company ID' })
    @ApiCreatedResponse({ description: 'Get reports filtered by company', type: ResponseData })
    @HttpCode(HttpStatus.OK)
    @Get('company/:companyId')
    async getReportsByCompany(@Param('companyId', ParseIntPipe) companyId: number) {
        const resp = new ResponseData();
        try {
            const res = await this.reportMasterService.getReportsByCompany(companyId);
            this.logger.log(`getReportsByCompany: ${JSON.stringify(res)}`);
            resp.data = res;
            resp.message = `Reports for company: ${companyId} fetched successfully`;
        } catch (error) {
            this.logger.warn(`getReportsByCompanyError: ${JSON.stringify(error)}`);
            resp.status = false;
            resp.message = error instanceof BadRequestException || error instanceof UnauthorizedException
                ? error.message
                : 'Internal Server Error';
        }
        return resp;
    }

    @ApiOperation({ summary: 'Get All Menus' })
        @ApiCreatedResponse({
            description: 'Get All Menus',
            type: ResponseData
        })
        @HttpCode(HttpStatus.OK)
        @Get('menu')
        async getAllMenus() {
            let output = new ResponseData;
            try {
                let menuData = await this.reportMasterService.getAllMenus();
                this.logger.log(`getAllmenus: ${JSON.stringify(menuData)}`)
                output.data = menuData;
                output.message = "All Menu are successfully fetched";
            } catch (error) {
                this.logger.warn(`getAllmenus: ${JSON.stringify(error)}`)
                output.status = false;
                if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                    output.message = error.message;
                } else {
                    output.message = 'Internal Server Error';
                }
            }
            return output
        }
}
