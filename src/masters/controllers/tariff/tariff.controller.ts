import { BadRequestException, Body, Controller, Delete, Get, HttpCode, HttpStatus, Logger, Param, ParseIntPipe, Patch, Post, Query, UnauthorizedException } from '@nestjs/common';
import { ApiCreatedResponse, ApiOperation } from '@nestjs/swagger';
import { Auth } from 'src/common/decorators/auth.decorator';
import { UserData } from 'src/common/decorators/user.decorator';
import { ResponseData } from 'src/common/response-data';
import { SearchListDto } from 'src/masters/DTO/search-list.dto';
import { filterDto } from 'src/masters/DTO/search-vessel.dto';
import { TariffService } from 'src/masters/services/tariff/tariff.service';
class CompanyIdDto {
    CompanyMasterSid: number;
}
@Auth()
@Controller('tariff')

export class TariffController {
    constructor(private tariffServ: TariffService, private logger: Logger) { }


    @ApiOperation({ summary: 'Create new Tariff' })
    @ApiCreatedResponse({
        description: 'Create new Tariff',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Post('create')
    async createNewTariff(@Body() newData: any) {
        let resp = new ResponseData();
        try {
            let res = await this.tariffServ.createNewTariff(newData);
            this.logger.log(`New Tariff Created : ${JSON.stringify(res)}`);
            resp.data = res;
            resp.message = "New Tariff is successfully created"
        } catch (error) {
            this.logger.warn(`Tariff Creation Error : ${JSON.stringify(error), error}`);
            resp.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                resp.message = error.message;
            } else {
                resp.message = "Internal Server Error";
            }
        }
        return resp;
    }



    @ApiOperation({ summary: 'Get All Tariff' })
    @ApiCreatedResponse({
        description: 'Get All Tariff',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Post()
    async getAllTariff(@Body() body: CompanyIdDto) {
        let resp = new ResponseData();
        try {
            let res = await this.tariffServ.getAllTariff(body.CompanyMasterSid);
            this.logger.log(`All Tariff Fetched : ${JSON.stringify(res)}`);
            resp.data = res;
            resp.message = "ALl Tariff are successfully fetched";
        } catch (error) {
            this.logger.warn(`Get All Tariff Error : ${JSON.stringify(error), error}`);
            resp.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                resp.message = error.message;
            } else {
                resp.message = "Internal Server Error";
            }
        }
        return resp;
    }



    @ApiOperation({ summary: 'Get Tariff by Id' })
    @ApiCreatedResponse({
        description: 'Get Tariff by Id',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Get('fetch/:TariffHeaderSid')
    async getTariffById(@Param('TariffHeaderSid', ParseIntPipe) TariffHeaderSid: number) {
        let resp = new ResponseData();
        try {
            this.logger.log(`Getting Tariff with id : ${TariffHeaderSid}`);
            let res = await this.tariffServ.getTariffById(TariffHeaderSid);
            this.logger.debug(`Fetched Tariff : ${JSON.stringify(res)}`);
            resp.data = res;
            resp.message = `Tariff with id : ${TariffHeaderSid} is successfully fetched`;
        } catch (error) {
            this.logger.warn(`Get Tariff by Id Error : ${JSON.stringify(error), error}`);
            resp.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                resp.message = error.message;
            } else {
                resp.message = "Internal Server Error";
            }
        }
        return resp;
    }



    @ApiOperation({ summary: 'Update Tariff by Id' })
    @ApiCreatedResponse({
        description: 'Update Tariff by Id',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Patch('update/:TariffHeaderSid')
    async updateTariffById(@Param('TariffHeaderSid', ParseIntPipe) TariffHeaderSid: number, @Body() payload: any, @UserData() user: any) {
        let resp = new ResponseData();
        try {
            this.logger.log(`Updating Tariff with id : ${TariffHeaderSid}`);
            let res = await this.tariffServ.updateTariffById(TariffHeaderSid, payload);
            this.logger.debug(`Updated Tariff : ${JSON.stringify(res)}`);
            resp.data = res;
            resp.message = `Tariff with id : ${TariffHeaderSid} is successfully updated`;
        } catch (error) {
            this.logger.warn(`Tariff Updation Error : ${JSON.stringify(error), error}`);
            resp.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                resp.message = error.message;
            } else {
                resp.message = "Internal Server Error";
            }
        }
        return resp;
    }



    @ApiOperation({ summary: 'Delete Tariff by Id' })
    @ApiCreatedResponse({
        description: 'Delete Tariff by Id',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Delete('delete/:TariffHeaderSid')
    async deleteTariffById(@Param('TariffHeaderSid', ParseIntPipe) TariffHeaderSid: number) {
        let resp = new ResponseData();
        try {
            this.logger.log(`Deleting Tariff with id : ${TariffHeaderSid}`);
            let res = await this.tariffServ.deleteTariffById(TariffHeaderSid);
            this.logger.debug(`Deleted Tariff : ${JSON.stringify(res)}`);
            resp.data = res;
            resp.message = `Tariff with id : ${TariffHeaderSid} is successfully deleted`;
        } catch (error) {
            this.logger.warn(`Tariff Deletion Error : ${JSON.stringify(error), error}`);
            resp.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                resp.message = error.message;
            } else {
                resp.message = "Internal Server Error";
            }
        }
        return resp;
    }



    @ApiOperation({ summary: 'Search List of Tariff' })
    @ApiCreatedResponse({
        description: 'Search List of Tariff',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Post('search-list')
    async searchTariffNew(@Body() searchParams: filterDto) {
        const resp = new ResponseData();
        try {
            const res = await this.tariffServ.searchTariffNew(searchParams);
            this.logger.log(`Tariff Search Results :${JSON.stringify(res)}`);
            resp.data = res;
            resp.message = "Tariff Search results are successfully fetched"
        } catch (error) {
            this.logger.warn(`Tariff Search Error : ${JSON.stringify(error), error}`);
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

            const logs = await this.tariffServ.getAuditLogs(tableName, recordId);

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
            resp.message = 'Internal Server Error';
        }
        return resp;
    }
}
