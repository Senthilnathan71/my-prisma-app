import { BadRequestException, Body, Controller, Delete, Get, HttpCode, HttpStatus, Logger, Param, ParseIntPipe, Patch, Post, UnauthorizedException } from '@nestjs/common';
import { ApiCreatedResponse, ApiOperation } from '@nestjs/swagger';
import { ResponseData } from 'src/common/response-data';
import { SearchListDto } from 'src/masters/DTO/search-list.dto';
import { VoyageDetailService } from 'src/masters/services/voyage-detail/voyage-detail.service';


@Controller('voyage-detail')
export class VoyageDetailController {
    constructor(private voyageDetailService: VoyageDetailService, private logger: Logger) { }


    @ApiOperation({ summary: 'Create new Voyage Detail' })
    @ApiCreatedResponse({
        description: 'Create new Voyage Detail',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Post('create')
    async createNewVoyageDetail(@Body() newData: any) {
        let resp = new ResponseData();
        try {
            let res = await this.voyageDetailService.createVoyageDetail(newData);
            this.logger.log(`New Voyage Detail Created : ${JSON.stringify(res)}`);
            resp.data = res;
            resp.message = "New Voyage Detail is successfully created"
        } catch (error) {
            this.logger.warn(`Voyage Detail Creation Error : ${JSON.stringify(error), error}`);
            resp.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                resp.message = error.message;
            } else {
                resp.message = "Internal Server Error";
            }
        }
        return resp;
    }



    @ApiOperation({ summary: 'Get All Voyage Detail' })
    @ApiCreatedResponse({
        description: 'Get All Voyage Detail',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Get()
    async getAllVoyageDetail() {
        let resp = new ResponseData();
        try {
            let res = await this.voyageDetailService.getAllVoyageDetails();
            this.logger.log(`All Voyage Details Fetched : ${JSON.stringify(res)}`);
            resp.data = res;
            resp.message = "All Voyage Details are successfully fetched";
        } catch (error) {
            this.logger.warn(`Get All Voyage Details Error : ${JSON.stringify(error), error}`);
            resp.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                resp.message = error.message;
            } else {
                resp.message = "Internal Server Error";
            }
        }
        return resp;
    }



    @ApiOperation({ summary: 'Get Voyage Detail by Id' })
    @ApiCreatedResponse({
        description: 'Get Voyage Detail by Id',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Get('fetch/:VoyageMasterDetailSid')
    async getVoyageDetailById(@Param('VoyageMasterDetailSid', ParseIntPipe) VoyageMasterDetailSid: number) {
        let resp = new ResponseData();
        try {
            this.logger.log(`Getting Voyage Detail with id : ${VoyageMasterDetailSid}`);
            let res = await this.voyageDetailService.findOne(VoyageMasterDetailSid);
            this.logger.debug(`Fetched Voyage Detail : ${JSON.stringify(res)}`);
            resp.data = res;
            resp.message = `Voyage Detail with id : ${VoyageMasterDetailSid} is successfully fetched`;
        } catch (error) {
            this.logger.warn(`Get Voyage Detail by Id Error : ${JSON.stringify(error), error}`);
            resp.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                resp.message = error.message;
            } else {
                resp.message = "Internal Server Error";
            }
        }
        return resp;
    }



    @ApiOperation({ summary: 'Update Voyage Detail by Id' })
    @ApiCreatedResponse({
        description: 'Update Voyage Detail by Id',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Patch('update/:VoyageMasterDetailSid')
    async updateVoyageDetailById(@Param('VoyageMasterDetailSid', ParseIntPipe) VoyageMasterDetailSid: number, @Body() payload: any) {
        let resp = new ResponseData();
        try {
            this.logger.log(`Updating Voyage Detail with id : ${VoyageMasterDetailSid}`);
            let res = await this.voyageDetailService.updateVoyageDetail(VoyageMasterDetailSid, payload);
            this.logger.debug(`Updated Voyage Detail : ${JSON.stringify(res)}`);
            resp.data = res;
            resp.message = `Voyage Detail with id : ${VoyageMasterDetailSid} is successfully updated`;
        } catch (error) {
            this.logger.warn(`Voyage Detail Updation Error : ${JSON.stringify(error), error}`);
            resp.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                resp.message = error.message;
            } else {
                resp.message = "Internal Server Error";
            }
        }
        return resp;
    }



    @ApiOperation({ summary: 'Delete Voyage Detail by Id' })
    @ApiCreatedResponse({
        description: 'Delete Voyage Detail by Id',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Delete('delete/:VoyageMasterDetailSid')
    async deleteVoyageDetailById(@Param('VoyageMasterDetailSid', ParseIntPipe) VoyageMasterDetailSid: number) {
        let resp = new ResponseData();
        try {
            this.logger.log(`Deleting Voyage Detail with id : ${VoyageMasterDetailSid}`);
            let res = await this.voyageDetailService.softDelete(VoyageMasterDetailSid);
            this.logger.debug(`Deleted Voyage Detail : ${JSON.stringify(res)}`);
            resp.data = res;
            resp.message = `
            Voyage Detail with id : ${VoyageMasterDetailSid} is successfully deleted`;
        } catch (error) {
            this.logger.warn(`Voyage Detail Deletion Error : ${JSON.stringify(error), error}`);
            resp.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                resp.message = error.message;
            } else {
                resp.message = "Internal Server Error";
            }
        }
        return resp;
    }



    @ApiOperation({ summary: 'Search List of Voyage Details' })
    @ApiCreatedResponse({
        description: 'Search List of Voyage Details',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Post('search-list')
    async searchVoyageDetails(@Body() searchData: SearchListDto) {
        let resp = new ResponseData();
        try {
            let res = await this.voyageDetailService.searchVoyageDetail(searchData);
            this.logger.log(`Voyage Details Search Results :${JSON.stringify(res)}`);
            resp.data = res;
            resp.message = "Voyage Details Search results are successfully fetched"
        } catch (error) {
            this.logger.warn(`Voyage Details Search Error : ${JSON.stringify(error), error}`);
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
