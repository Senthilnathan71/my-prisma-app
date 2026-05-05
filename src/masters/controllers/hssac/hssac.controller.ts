import { BadRequestException, Body, Controller, Delete, Get, HttpCode, HttpStatus, Logger, Param, ParseIntPipe, Patch, Post, UnauthorizedException, Query } from '@nestjs/common';
import { ApiOperation, ApiCreatedResponse } from '@nestjs/swagger';
import { Auth } from 'src/common/decorators/auth.decorator';
import { UserData } from 'src/common/decorators/user.decorator';
import { ResponseData } from 'src/common/response-data';
import { SearchListDto } from 'src/masters/DTO/search-list.dto';
import { filterDto } from 'src/masters/DTO/search-vessel.dto';
import { HssacService } from 'src/masters/services/hssac/hssac.service';
@Auth()
@Controller('hssac')
export class HssacController {
    constructor(private hssacService: HssacService, private logger: Logger) { }

    @ApiOperation({ summary: 'Hssac Creation' })
    @ApiCreatedResponse({
        description: 'Hssac Creation',
        type: ResponseData
    })
    @HttpCode(HttpStatus.CREATED)
    @Post('create')
    async createHssac(@Body() body: any, @UserData() user: any) {
        this.logger.log(`createHssacdata: ${JSON.stringify(body)}`)
        let output = new ResponseData
        try {
            let Hssac = await this.hssacService.createHssac(body, user);
            this.logger.debug(`createHssac: ${JSON.stringify(Hssac)}`)
            if (!Hssac) {
                this.logger.warn(`createHssac!!: ${JSON.stringify(Hssac)}`)
                throw 'Something went wrong'
            }
            output.data = Hssac
            output.message = 'Hssac Created Successfully'
        } catch (error) {
            this.logger.warn(`createHssacError: ${error}`)
            output.status = false;
            // Handle error message based on the type of error
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                output.message = error.message;
                this.logger.warn(`createHssacError: ${error.message}`)
            } else {
                output.message = "Internal Server Error";
            }
        }
        return output
    }


    @ApiOperation({ summary: 'Get All Hssac' })
    @ApiCreatedResponse({
        description: 'Get All Hssac',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Get()
    async getAllHssac() {
        let output = new ResponseData;
        try {
            let HssacData = await this.hssacService.getAllHssac();
            this.logger.log(`getAllHssac: ${JSON.stringify(HssacData)}`)
            output.data = HssacData;
            output.message = "All AllHssac are successfully fetched";
        } catch (error) {
            this.logger.warn(`getAllHssac: ${JSON.stringify(error)}`)
            output.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                output.message = error.message;
            } else {
                output.message = 'Internal Server Error';
            }
        }
        return output
    }



    @ApiOperation({ summary: 'Get Hssac By Id' })
    @ApiCreatedResponse({
        description: 'Get Hssac By Id',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Get('fetch/:id')
    async getHssacById(@Param('id', ParseIntPipe) HssacId: number) {
        const output = new ResponseData;
        try {
            const Hssac = await this.hssacService.findOne(HssacId)
            this.logger.log(`getHssacById: ${JSON.stringify(Hssac)}`)
            output.data = Hssac;
            output.message = `Hssac with id : ${HssacId} is successfully fetched`;
        } catch (error) {
            this.logger.warn(`getHssacById: ${JSON.stringify(error)}`)
            output.status = false;
            output.message = error
        }
        return output;
    }


    @ApiOperation({ summary: 'Update Hssac By Id' })
    @ApiCreatedResponse({
        description: 'Update Hssac By Id',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Patch('update/:id')
    async editHssac(@Param('id', ParseIntPipe) id: number, @Body() body: any, @UserData() user: any) {
        this.logger.log(`editHssacbody: ${JSON.stringify(body)}`)
        let output = new ResponseData
        try {
            let Hssac = await this.hssacService.updateHssac(id, body, user);
            this.logger.log(`editHssac: ${JSON.stringify(Hssac)}`)

            if (!Hssac) {
                this.logger.log(`editHssac!!: ${JSON.stringify(Hssac)}`)
                throw 'Something went wrong'
            } else {
                this.logger.log(`editHssacelse: ${Hssac}`)
            }
            output.data = Hssac;
            output.message = 'Hssac Updated Successfully'
        } catch (error) {
            this.logger.warn(`editHssacerror: ${JSON.stringify(error), error}`)
            output.status = false;
            // Handle error message based on the type of error
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                this.logger.warn(`editHssacbadrequest: ${error}`)
                output.message = error.message;
            } else {
                output.message = "Internal Server Error";
            }
        }
        this.logger.log(`editHssacmessage: ${output.message}`)
        return output
    }



    @ApiOperation({ summary: 'Delete Hssac By Id' })
    @ApiCreatedResponse({
        description: 'Delete Hssac By Id',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Delete('delete/:id')
    async softDelete(@Param('id', ParseIntPipe) id: number) {
        return this.hssacService.softDelete(id);
    }



    @ApiOperation({ summary: 'Search List of HSSACs' })
    @ApiCreatedResponse({
        description: 'Search List of HSSACs',
        type: ResponseData,
    })
    @HttpCode(HttpStatus.OK)
    @Post('search-list')
    async searchHssac(@Body() searchParams: filterDto) {
        const resp = new ResponseData();
        try {
            const res = await this.hssacService.searchList(searchParams);
            this.logger.log(`HSSAC Search Data: ${JSON.stringify(res)}`);
            resp.data = res;
            resp.message = 'HSSAC Search is successfully fetched';
        } catch (error) {
            this.logger.warn(`Search HSSAC Error: ${error}`);
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

            const logs = await this.hssacService.getAuditLogs(tableName, recordId);

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
