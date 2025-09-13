import { BadRequestException, Body, Controller, Delete, Get, HttpCode, HttpStatus, Logger, Param, ParseIntPipe, Patch, Post, UnauthorizedException, Query } from "@nestjs/common";
import { ApiOperation, ApiCreatedResponse } from "@nestjs/swagger";
import { UserData } from "src/common/decorators/user.decorator";
import { ResponseData } from "src/common/response-data";
import { SearchListDto } from "src/masters/DTO/search-list.dto";
import { filterDto } from "src/masters/DTO/search-vessel.dto";
import { IncoService } from "src/masters/services/inco/inco.service";

@Controller('inco')
export class IncoController {
    constructor(private incoService: IncoService, private logger: Logger) { }

    @ApiOperation({ summary: 'Inco Creation' })
    @ApiCreatedResponse({
        description: 'Inco Creation',
        type: ResponseData
    })
    @HttpCode(HttpStatus.CREATED)
    @Post('create')
    async createInco(@Body() body: any) {
        this.logger.log(`createIncoData: ${JSON.stringify(body)}`)
        let output = new ResponseData
        try {
            let Inco = await this.incoService.createInco(body);
            this.logger.debug(`createInco: ${JSON.stringify(Inco)}`)
            if (!Inco) {
                this.logger.warn(`createInco!!: ${JSON.stringify(Inco)}`)
                throw 'Something went wrong'
            }
            output.data = Inco
            output.message = 'Inco Created Successfully'
        } catch (error) {
            this.logger.warn(`createIncoError: ${error}`)
            output.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                output.message = error.message;
                this.logger.warn(`createIncoError: ${error.message}`)
            } else {
                output.message = 'Internal Server Error';
            }
        }
        return output
    }

    @ApiOperation({ summary: 'Get All Inco' })
    @ApiCreatedResponse({
        description: 'Get All Inco',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Get()
    async getAllInco() {
        let output = new ResponseData;
        try {
            let IncoData = await this.incoService.getAllInco();
            this.logger.log(`getAllInco: ${JSON.stringify(IncoData)}`)
            output.data = IncoData;
            output.message = "All Inco are successfully fetched";
        } catch (error) {
            this.logger.warn(`getAllInco: ${JSON.stringify(error)}`)
            output.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                output.message = error.message;
            } else {
                output.message = 'Internal Server Error';
            }
        }
        return output
    }

    @ApiOperation({ summary: 'Get Inco By Id' })
    @ApiCreatedResponse({
        description: 'Get Inco By Id',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Get('fetch/:id')
    async getIncoById(@Param('id', ParseIntPipe) IncoId: number) {
        const output = new ResponseData;
        try {
            const Inco = await this.incoService.findOne(IncoId)
            this.logger.log(`getIncoById: ${JSON.stringify(Inco)}`)
            output.data = Inco
            output.message = `HAWB Stock with id : ${IncoId} is successfully fetched`;
        } catch (error) {
            this.logger.warn(`getIncoById: ${JSON.stringify(error)}`)
            output.status = false;
            output.message = error
        }
        return output;
    }

    @ApiOperation({ summary: 'Update Inco By Id' })
    @ApiCreatedResponse({
        description: 'Update Inco By id',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Patch('update/:id')
    async editInco(@Param('id', ParseIntPipe) id: number, @Body() body: any) {
        this.logger.log(`editIncobody: ${JSON.stringify(body)}`)
        let output = new ResponseData
        try {
            let Inco = await this.incoService.updateInco(id, body);
            this.logger.log(`editInco: ${JSON.stringify(Inco)}`)
            if (!Inco) {
                this.logger.log(`editInco!!: ${JSON.stringify(Inco)}`)
                throw 'Something went wrong'
            } else {
                this.logger.log(`editIncoelse: ${Inco}`)
            }
            output.data = Inco;
            output.message = `Inco with id : ${id} is successfully updated`;
        } catch (error) {
            this.logger.warn(`editIncoError: ${JSON.stringify(error), error}`)
            output.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                this.logger.warn(`editIncobadrequest: ${error}`)
                output.message = error.message;
            } else {
                output.message = 'Internal Server Error';
            }
        }
        this.logger.log(`editIncomessage: ${output.message}`)
        return output
    }

    @ApiOperation({ summary: 'Delete Inco By Id' })
    @ApiCreatedResponse({
        description: 'Delete Inco By Id',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Delete('delete/:id')
    async softDelete(@Param('id', ParseIntPipe) id: number) {
        return this.incoService.softDelete(id);
    }

    @ApiOperation({ summary: 'Search List of Inco' })
    @ApiCreatedResponse({
        description: 'Search List of Inco',
        type: ResponseData,
    })
    @HttpCode(HttpStatus.OK)
    @Post('search-list')
    async searchIncoNew(@Body() searchParams: filterDto) {
        const resp = new ResponseData();
        try {
            const res = await this.incoService.searchList(searchParams);
            this.logger.log(`Inco Search Data: ${JSON.stringify(res)}`);
            resp.data = res;
            resp.message = 'Inco Search is successfully fetched';
        } catch (error) {
            this.logger.warn(`Search Inco Error: ${error}`);
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

            const logs = await this.incoService.getAuditLogs(tableName, recordId);

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