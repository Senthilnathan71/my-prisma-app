import { BadRequestException, Body, Controller, Delete, Get, HttpCode, HttpStatus, Logger, Param, ParseIntPipe, Patch, Post, UnauthorizedException } from '@nestjs/common';
import { ApiCreatedResponse, ApiOperation } from '@nestjs/swagger';
import { Prisma } from '@prisma/client';
import { ResponseData } from 'src/common/response-data';
import { SearchListDto } from 'src/masters/DTO/search-list.dto';
import { TariffDetailService } from 'src/masters/services/tariff-detail/tariff-detail.service';

@Controller('tariff-detail')
export class TariffDetailController {
    constructor(private tariffDetailServ: TariffDetailService, private logger: Logger) { }


    @ApiOperation({ summary: 'Create new Tariff' })
    @ApiCreatedResponse({
        description: 'Create new Tariff',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Post('create')
    async createNewTariffDetail(@Body() newData: Prisma.TariffDetailCreateInput) {
        let resp = new ResponseData();
        try {
            let res = await this.tariffDetailServ.createNewTariffDetail(newData);
            this.logger.log(`New Tariff Detail Created : ${JSON.stringify(res)}`);
            resp.data = res;
            resp.message = "New Tariff Detail is successfully created"
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



    @ApiOperation({ summary: 'Get All Tariff Detail' })
    @ApiCreatedResponse({
        description: 'Get All Tariff Detail',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Get()
    async getAllTariffDetail() {
        let resp = new ResponseData();
        try {
            let res = await this.tariffDetailServ.getAllTariffDetails();
            this.logger.log(`All Tariff Details Fetched : ${JSON.stringify(res)}`);
            resp.data = res;
            resp.message = "All Tariff Details are successfully fetched";
        } catch (error) {
            this.logger.warn(`Get All Tariff Details Error : ${JSON.stringify(error), error}`);
            resp.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                resp.message = error.message;
            } else {
                resp.message = "Internal Server Error";
            }
        }
        return resp;
    }



    @ApiOperation({ summary: 'Get Tariff Detail by Id' })
    @ApiCreatedResponse({
        description: 'Get Tariff Detail by Id',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Get('fetch/:TariffDetailSid')
    async getTariffDetailById(@Param('TariffDetailSid', ParseIntPipe) TariffDetailSid: number) {
        let resp = new ResponseData();
        try {
            this.logger.log(`Getting Tariff Detail with id : ${TariffDetailSid}`);
            let res = await this.tariffDetailServ.fetchTariffDetail(TariffDetailSid);
            this.logger.debug(`Fetched Tariff Detail : ${JSON.stringify(res)}`);
            resp.data = res;
            resp.message = `Tariff Detail with id : ${TariffDetailSid} is successfully fetched`;
        } catch (error) {
            this.logger.warn(`Get Tariff Detail by Id Error : ${JSON.stringify(error), error}`);
            resp.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                resp.message = error.message;
            } else {
                resp.message = "Internal Server Error";
            }
        }
        return resp;
    }



    @ApiOperation({ summary: 'Update Tariff Detail by Id' })
    @ApiCreatedResponse({
        description: 'Update Tariff Detail by Id',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Patch('update/:TariffDetailSid')
    async updateTariffById(@Param('TariffDetailSid', ParseIntPipe) TariffDetailSid: number, @Body() payload: Prisma.TariffDetailUpdateInput) {
        let resp = new ResponseData();
        try {
            this.logger.log(`Updating Tariff Detail with id : ${TariffDetailSid}`);
            let res = await this.tariffDetailServ.updateTariffDetailById(TariffDetailSid, payload);
            this.logger.debug(`Updated Tariff Detail : ${JSON.stringify(res)}`);
            resp.data = res;
            resp.message = `Tariff Detail with id : ${TariffDetailSid} is successfully updated`;
        } catch (error) {
            this.logger.warn(`Tariff Detail Updation Error : ${JSON.stringify(error), error}`);
            resp.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                resp.message = error.message;
            } else {
                resp.message = "Internal Server Error";
            }
        }
        return resp;
    }



    @ApiOperation({ summary: 'Delete Tariff Detail by Id' })
    @ApiCreatedResponse({
        description: 'Delete Tariff Detail by Id',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Delete('delete/:TariffDetailSid')
    async deleteTariffDetailById(@Param('TariffDetailSid', ParseIntPipe) TariffDetailSid: number) {
        let resp = new ResponseData();
        try {
            this.logger.log(`Deleting Tariff Detail with id : ${TariffDetailSid}`);
            let res = await this.tariffDetailServ.deleteTariffDetails(TariffDetailSid);
            this.logger.debug(`Deleted Tariff Detail : ${JSON.stringify(res)}`);
            resp.data = res;
            resp.message = `Tariff Detail with id : ${TariffDetailSid} is successfully deleted`;
        } catch (error) {
            this.logger.warn(`Tariff Detail Deletion Error : ${JSON.stringify(error), error}`);
            resp.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                resp.message = error.message;
            } else {
                resp.message = "Internal Server Error";
            }
        }
        return resp;
    }



    @ApiOperation({ summary: 'Search List of Tariff Detail' })
    @ApiCreatedResponse({
        description: 'Search List of Tariff Detail',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Post('search-list')
    async searchTariff(@Body() searchData: SearchListDto) {
        let resp = new ResponseData();
        try {
            let res = await this.tariffDetailServ.searchTariffDetail(searchData);
            this.logger.log(`Tariff Detail Search Results :${JSON.stringify(res)}`);
            resp.data = res;
            resp.message = "Tariff Detail Search results are successfully fetched"
        } catch (error) {
            this.logger.warn(`Tariff Detail Search Error : ${JSON.stringify(error), error}`);
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
