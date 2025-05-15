import { BadRequestException, Body, Controller, Delete, Get, HttpCode, HttpStatus, Logger, Param, ParseIntPipe, Patch, Post, UnauthorizedException } from '@nestjs/common';
import { ApiCreatedResponse, ApiOperation } from '@nestjs/swagger';
import { Prisma } from '@prisma/client';
import { ResponseData } from 'src/common/response-data';
import { SearchListDto } from 'src/masters/DTO/search-list.dto';
import { TariffService } from 'src/masters/services/tariff/tariff.service';

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
    async createNewTariff(@Body() newData: Prisma.TariffHeaderCreateInput) {
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
    @Get()
    async getAllTariff() {
        let resp = new ResponseData();
        try {
            let res = await this.tariffServ.getAllTariff();
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
    async updateTariffById(@Param('TariffHeaderSid', ParseIntPipe) TariffHeaderSid: number, @Body() payload: Prisma.TariffHeaderUpdateInput) {
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
    async searchTariff(@Body() searchData: SearchListDto) {
        let resp = new ResponseData();
        try {
            let res = await this.tariffServ.searchTariff(searchData);
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












}
