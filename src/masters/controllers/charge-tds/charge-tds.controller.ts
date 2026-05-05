import { BadRequestException, Body, Controller, Delete, Get, HttpCode, HttpStatus, Logger, Param, ParseIntPipe, Patch, Post, UnauthorizedException } from '@nestjs/common';
import { ApiCreatedResponse, ApiOperation } from '@nestjs/swagger';
import { ResponseData } from 'src/common/response-data';
import { ChargeTdsService } from 'src/masters/services/charge-tds/charge-tds.service';
import { SearchListDto } from 'src/masters/DTO/search-list.dto';
import { filterDto } from 'src/masters/DTO/search-vessel.dto';
import { Auth } from 'src/common/decorators/auth.decorator';
@Auth()
@Controller('charge-tds')
export class ChargeTdsController {
    constructor(private chargeTdsService: ChargeTdsService, private logger: Logger) { }

    @ApiOperation({ summary: 'Create new Charge TDS' })
    @ApiCreatedResponse({
        description: 'Create new Charge TDS',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Post('create')
    async createNewChargeTds(@Body() newData: any) {
        let resp = new ResponseData();
        try {
            let res = await this.chargeTdsService.createNewChargeTds(newData);
            this.logger.log(`New Charge TDS Created : ${JSON.stringify(res)}`);
            resp.data = res;
            resp.message = "New Charge TDS is successfully created";
        } catch (error) {
            this.logger.warn(`Charge TDS Creation Error : ${JSON.stringify(error), error}`);
            resp.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                resp.message = error.message;
            } else {
                resp.message = "Internal Server Error";
            }
        }
        return resp;
    }

    @ApiOperation({ summary: 'Get All Charge TDS' })
    @ApiCreatedResponse({
        description: 'Get All Charge TDS',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Get()
    async getAllChargeTds() {
        let resp = new ResponseData();
        try {
            let res = await this.chargeTdsService.getAllChargeTds();
            this.logger.log(`All Charge TDS Fetched : ${JSON.stringify(res)}`);
            resp.data = res;
            resp.message = "All Charge TDS are successfully fetched";
        } catch (error) {
            this.logger.warn(`Get All Charge TDS Error : ${JSON.stringify(error), error}`);
            resp.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                resp.message = error.message;
            } else {
                resp.message = "Internal Server Error";
            }
        }
        return resp;
    }

    @ApiOperation({ summary: 'Get Charge TDS by Id' })
    @ApiCreatedResponse({
        description: 'Get Charge TDS by Id',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Get('fetch/:ChargeTdsSid')
    async getChargeTdsById(@Param('ChargeTdsSid', ParseIntPipe) ChargeTdsSid: number) {
        let resp = new ResponseData();
        try {
            this.logger.log(`Getting Charge TDS with id : ${ChargeTdsSid}`);
            let res = await this.chargeTdsService.fetchChargeTdsById(ChargeTdsSid);
            this.logger.debug(`Fetched Charge TDS : ${JSON.stringify(res)}`);
            resp.data = res;
            resp.message = `Charge TDS with id : ${ChargeTdsSid} is successfully fetched`;
        } catch (error) {
            this.logger.warn(`Get Charge TDS by Id Error : ${JSON.stringify(error), error}`);
            resp.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                resp.message = error.message;
            } else {
                resp.message = "Internal Server Error";
            }
        }
        return resp;
    }

    @ApiOperation({ summary: 'Update Charge TDS by Id' })
    @ApiCreatedResponse({
        description: 'Update Charge TDS by Id',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Patch('update/:ChargeTdsSid')
    async updateChargeTdsById(@Param('ChargeTdsSid', ParseIntPipe) ChargeTdsSid: number, @Body() payload: any) {
        let resp = new ResponseData();
        try {
            this.logger.log(`Updating Charge TDS with id : ${ChargeTdsSid}`);
            let res = await this.chargeTdsService.updateChargeTdsById(ChargeTdsSid, payload);
            this.logger.debug(`Updated Charge TDS : ${JSON.stringify(res)}`);
            resp.data = res;
            resp.message = `Charge TDS with id : ${ChargeTdsSid} is successfully updated`;
        } catch (error) {
            this.logger.warn(`Charge TDS Updation Error : ${JSON.stringify(error), error}`);
            resp.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                resp.message = error.message;
            } else {
                resp.message = "Internal Server Error";
            }
        }
        return resp;
    }

    @ApiOperation({ summary: 'Delete Charge TDS by Id' })
    @ApiCreatedResponse({
        description: 'Delete Charge TDS by Id',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Delete('delete/:ChargeTdsSid')
    async deleteChargeTdsById(@Param('ChargeTdsSid', ParseIntPipe) ChargeTdsSid: number) {
        let resp = new ResponseData();
        try {
            this.logger.log(`Deleting Charge TDS with id : ${ChargeTdsSid}`);
            let res = await this.chargeTdsService.deleteChargeTds(ChargeTdsSid);
            this.logger.debug(`Deleted Charge TDS : ${JSON.stringify(res)}`);
            resp.data = res;
            resp.message = `Charge TDS with id : ${ChargeTdsSid} is successfully deleted`;
        } catch (error) {
            this.logger.warn(`Charge TDS Deletion Error : ${JSON.stringify(error), error}`);
            resp.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                resp.message = error.message;
            } else {
                resp.message = "Internal Server Error";
            }
        }
        return resp;
    }

    @ApiOperation({ summary: 'Search List of Charge TDS' })
    @ApiCreatedResponse({
        description: 'Search List of Charge TDS',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Post('search-list')
    async searchChargeTds(@Body() searchParams: filterDto) {
        const resp = new ResponseData();
        try {
            const res = await this.chargeTdsService.searchChargeTds(searchParams);
            this.logger.log(`Charge TDS Search Data: ${JSON.stringify(res)}`);
            resp.data = res;
            resp.message = 'Charge TDS Search is successfully fetched';
        } catch (error) {
            this.logger.warn(`Search Charge TDS Error: ${error}`);
            resp.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                resp.message = error.message;
            } else {
                resp.message = 'Internal Server Error';
            }
        }
        return resp;
    }
}