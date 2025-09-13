import { BadRequestException, Body, Controller, Delete, Get, HttpCode, HttpStatus, Logger, Param, ParseIntPipe, Patch, Post, Query, UnauthorizedException } from '@nestjs/common';
import { ApiOperation, ApiCreatedResponse } from '@nestjs/swagger';
import { UserData } from 'src/common/decorators/user.decorator';
import { ResponseData } from 'src/common/response-data';
import { SearchListDto } from 'src/masters/DTO/search-list.dto';
import { filterDto } from 'src/masters/DTO/search-vessel.dto';
import { ProfitCenterService } from 'src/masters/services/profit-center/profit-center.service';

@Controller('profit-center')
export class ProfitCenterController {
    constructor(private profitCenterService: ProfitCenterService, private logger: Logger) { }

    @ApiOperation({ summary: 'Profit-Center Creation' })
    @ApiCreatedResponse({
        description: 'Profit-Center Creation',
        type: ResponseData
    })
    @HttpCode(HttpStatus.CREATED)
    @Post('create')
    async createProfitCenter(@Body() body: any, @UserData() user: any) {
        this.logger.log(`createProfitCenterData: ${JSON.stringify(body)}`)
        let output = new ResponseData
        try {
            let ProfitCenter = await this.profitCenterService.createProfitCenter(body, user);
            this.logger.debug(`createProfitCenter: ${JSON.stringify(ProfitCenter)}`)
            if (!ProfitCenter) {
                this.logger.warn(`createProfitCenter!!: ${JSON.stringify(ProfitCenter)}`)
                throw 'Something went wrong'
            }
            output.data = ProfitCenter
            output.message = 'Profit-Center Created Successfully'
        } catch (error) {
            this.logger.warn(`createProfitCenterError: ${error}`)
            output.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                output.message = error.message;
                this.logger.warn(`createProfitCenterError: ${error.message}`)
            } else {
                output.message = "Internal Server Error";
            }
        }
        return output
    }

    @ApiOperation({ summary: 'Get All Profit-Center' })
    @ApiCreatedResponse({
        description: 'Get All Profit-Center',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Get()
    async getAllProfitCenter() {
        let output = new ResponseData;
        try {
            let createProfitCenterData = await this.profitCenterService.getAllProfitCenter();
            this.logger.log(`getAllProfitCenter: ${JSON.stringify(createProfitCenterData)}`)
            output.data = createProfitCenterData;
        } catch (error) {
            this.logger.warn(`getAllProfitCenter: ${JSON.stringify(error)}`)
            output.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                output.message = error.message;
            } else {
                output.message = 'Internal Server Error';
            }
        }
        return output
    }

    @ApiOperation({ summary: 'Get Profit-Center By Id' })
    @ApiCreatedResponse({
        description: 'Get Profit-Center By Id',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Get('fetch/:id')
    async getProfitCenterById(@Param('id', ParseIntPipe) ProfitCenterId: number) {
        const output = new ResponseData;
        try {
            const ProfitCenter = await this.profitCenterService.findOne(ProfitCenterId)
            this.logger.log(`getProfitCenterById: ${JSON.stringify(ProfitCenter)}`)
            output.data = ProfitCenter;
            output.message = `Profit Center with id : ${ProfitCenterId} is successfully fetched`;
        } catch (error) {
            this.logger.warn(`getProfitCenterById: ${JSON.stringify(error)}`)
            output.status = false;
            output.message = error
        }
        return output;
    }

    @ApiOperation({ summary: 'Update Profit-Center By Id' })
    @ApiCreatedResponse({
        description: 'Update Profit-Center By id',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Patch('update/:id')
    async editProfitCenter(@Param('id', ParseIntPipe) id: number, @Body() body: any, @UserData() user: any) {
        this.logger.log(`editProfitCenterbody: ${JSON.stringify(body)}`)
        let output = new ResponseData
        try {
            let ProfitCenter = await this.profitCenterService.updateProfitCenter(id, body, user);
            this.logger.log(`editProfitCenter: ${JSON.stringify(ProfitCenter)}`)
            if (!ProfitCenter) {
                this.logger.log(`editProfitCenter!!: ${JSON.stringify(ProfitCenter)}`)
                throw 'Something went wrong'
            } else {
                this.logger.log(`editProfitCenterelse: ${ProfitCenter}`)
            }
            output.data = ProfitCenter;
            output.message = 'Profit-Center Updated Successfully'
        } catch (error) {
            this.logger.warn(`editProfitCenterError: ${JSON.stringify(error), error}`)
            output.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                this.logger.warn(`editProfitCenterbadrequest: ${error}`)
                output.message = error.message;
            } else {
                output.message = "Internal Server Error";
            }
        }
        this.logger.log(`editProfitCentermessage: ${output.message}`)
        return output
    }

    @ApiOperation({ summary: 'Delete Profit-Center By Id' })
    @ApiCreatedResponse({
        description: 'Delete Profit-Center By Id',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Delete('delete/:id')
    async softDelete(@Param('id', ParseIntPipe) id: number) {
        return this.profitCenterService.softDelete(id);
    }

    @ApiOperation({ summary: 'Search List of Profit-Center' })
    @ApiCreatedResponse({
        description: 'Search List of Profit-Center',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Post('search-list')
    async searchProfitCenterNew(@Body() searchParams: filterDto) {
        const resp = new ResponseData;
        try {
            const res = await this.profitCenterService.searchProfitCenterNew(searchParams);
            this.logger.log(`Profit-Center Search Data: ${JSON.stringify(res)}`);
            resp.data = res;
            resp.message = "Profit-Center List fetched Successfully"
        } catch (error) {
            this.logger.warn(`searchProfitCenter: ${JSON.stringify(error)}`)
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

            const logs = await this.profitCenterService.getAuditLogs(tableName, recordId);

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
