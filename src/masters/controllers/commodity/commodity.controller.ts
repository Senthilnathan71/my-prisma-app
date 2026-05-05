import { BadRequestException, Body, Controller, Delete, Get, HttpCode, HttpStatus, Logger, Param, ParseIntPipe, Patch, Post, UnauthorizedException } from '@nestjs/common';
import { ApiCreatedResponse, ApiOperation } from '@nestjs/swagger';
import { Auth } from 'src/common/decorators/auth.decorator';
import { ResponseData } from 'src/common/response-data';
import { SearchListDto } from 'src/masters/DTO/search-list.dto';
import { filterDto } from 'src/masters/DTO/search-vessel.dto';
import { CommodityService } from 'src/masters/services/commodity/commodity.service';
@Auth()
@Controller('commodity')
export class CommodityController {
    constructor(private commodityService: CommodityService, private logger: Logger) { }

    @ApiOperation({ summary: 'Create new Commodity' })
    @ApiCreatedResponse({
        description: 'Create new Commodity',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Post('create')
    async createNewCommodity(@Body() newData: any) {
        let resp = new ResponseData();
        try {
            let res = await this.commodityService.createNewCommodity(newData);
            this.logger.log(`New Commodity Created : ${JSON.stringify(res)}`);
            resp.data = res;
            resp.message = "New commodity is successfully created";
        } catch (error) {
            this.logger.warn(`Create new Commodity Error : ${error}`);
            resp.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                resp.message = error.message;
            } else {
                resp.message = "Internal Server Error";
            }
        }
        return resp;
    }


    @ApiOperation({ summary: 'Get All Commodity' })
    @ApiCreatedResponse({
        description: 'Get All Commodity',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Get()
    async getAllCommodity() {
        let resp = new ResponseData();
        try {
            let res = await this.commodityService.getAllCommodity();
            this.logger.log(`All Commodities Data : ${JSON.stringify(res)}`);
            resp.data = res;
            resp.message = "All commodities are successfully fetched";
        } catch (error) {
            this.logger.warn(`Fetching All Commodities Error :${JSON.stringify(error)}`);
            resp.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                resp.message = error.message;
            } else {
                resp.message = "Internal Server Error";
            }
        }
        return resp;
    }

    @ApiOperation({ summary: 'Get Commodity by Id' })
    @ApiCreatedResponse({
        description: 'Get Commodity by Id',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Get('fetch/:CommodityMasterSid')
    async getCommodityById(@Param('CommodityMasterSid', ParseIntPipe) CommodityMasterSid: number) {
        let resp = new ResponseData();
        try {
            this.logger.log(`Getting Commodity with id : ${CommodityMasterSid}`);
            let res = await this.commodityService.getCommodityById(CommodityMasterSid);
            this.logger.debug(`Fetched Commodity : ${JSON.stringify(res)}`);
            resp.data = res;
            resp.message = `Commodity with id :${CommodityMasterSid} is successfully fetched`;
        } catch (error) {
            this.logger.warn(`Get Commodity By Id Error : ${JSON.stringify(error)}`);
            resp.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                resp.message = error.message;
            } else {
                resp.message = "Internal Server Error";
            }
        }
        return resp;
    }


    @ApiOperation({ summary: "Updating Commodity by Id" })
    @ApiCreatedResponse({
        description: "Update Commodity by Id",
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Patch('update/:CommodityMasterSid')
    async updateCommodityById(@Param('CommodityMasterSid', ParseIntPipe) CommodityMasterSid: number, @Body() updateData: any) {
        let resp = new ResponseData();
        try {
            this.logger.log(`Updating Commodity with id : ${CommodityMasterSid}`)
            let res = await this.commodityService.updateCommodityById(CommodityMasterSid, updateData);
            this.logger.debug(`Updated Data : ${JSON.stringify(res)}`);
            resp.data = res;
            resp.message = `Commodity with id :${CommodityMasterSid} is successfully updated`;
        } catch (error) {
            this.logger.warn(`Commodity Update Error: ${JSON.stringify(error), error}`);
            resp.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                resp.message = error.message;
            } else {
                resp.message = "Internal Server Error";
            }
        }
        return resp;
    }


    @ApiOperation({ summary: "Delete Commodity by Id" })
    @ApiCreatedResponse({
        description: "Delete Commodity by Id",
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Delete('delete/:CommodityMasterSid')
    async deleteCommodityById(@Param('CommodityMasterSid', ParseIntPipe) CommodityMasterSid: number) {
        let resp = new ResponseData();
        try {
            this.logger.log(`Deleting Commodity with id : ${CommodityMasterSid}`)
            let res = await this.commodityService.deleteCommodityById(CommodityMasterSid);
            this.logger.debug(`Deleted Data : ${JSON.stringify(res)}`);
            resp.data = res;
            resp.message = `Commodity with id :${CommodityMasterSid} is successfully deleted`;
        } catch (error) {
            this.logger.warn(`Commodity Deletion Error: ${JSON.stringify(error)}`);
            resp.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                resp.message = error.message;
            } else {
                resp.message = "Internal Server Error";
            }
        }
        return resp;
    }



    @ApiOperation({ summary: 'Search List of Commodity' })
    @ApiCreatedResponse({
        description: 'Search List of Commodity',
        type: ResponseData,
    })
    @HttpCode(HttpStatus.OK)
    @Post('search-list')
    async searchCommodity(@Body() searchParams: filterDto) {
        const resp = new ResponseData();
        try {
            const res = await this.commodityService.searchCommodity(searchParams);
            this.logger.log(`Commodity Search Data: ${JSON.stringify(res)}`);
            resp.data = res;
            resp.message = 'Commodity Search is successfully fetched';
        } catch (error) {
            this.logger.warn(`Search Commodity Error: ${error}`);
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
