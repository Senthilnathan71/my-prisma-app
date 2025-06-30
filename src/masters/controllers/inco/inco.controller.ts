import { BadRequestException, Body, Controller, Delete, Get, HttpCode, HttpStatus, Logger, Param, ParseIntPipe, Patch, Post, UnauthorizedException } from '@nestjs/common';
import { ApiCreatedResponse, ApiOperation } from '@nestjs/swagger';
import { ResponseData } from 'src/common/response-data';
import { SearchListDto } from 'src/masters/DTO/search-list.dto';
import { IncoService } from 'src/masters/services/inco/inco.service';

@Controller('inco')
export class IncoController {
    constructor(
        private incoService: IncoService,
        private logger: Logger
    ) { }

   @ApiOperation({ summary: 'Create new Inco' })
    @ApiCreatedResponse({
        description: 'Create new Inco',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Post('create')
    async createNewInco(@Body() newData: any) {
        let resp = new ResponseData();
        try {
            let res = await this.incoService.createNewInco(newData);
            this.logger.log(`New Inco Created : ${JSON.stringify(res)}`);
            resp.data = res;
            resp.message = "New Inco is successfully created."
        } catch (error) {
            this.logger.warn(`Inco Creation Error : ${JSON.stringify(error), error}`);
            resp.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                resp.message = error.message;
            } else {
                resp.message = "Internal Server Error";
            }
        }
        return resp;
    }

    @ApiOperation({ summary: 'Get All Inco' })
    @ApiCreatedResponse({
        description: 'Get All Inco',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Get()
    async getAllInco() {
        let resp = new ResponseData();
        try {
            let res = await this.incoService.getAllInco();
            this.logger.log(`All Inco Fetched : ${JSON.stringify(res)}`);
            resp.data = res;
            resp.message = "All Inco are successfully fetched.";
        } catch (error) {
            this.logger.warn(`Get All Inco Error : ${JSON.stringify(error), error}`);
            resp.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                resp.message = error.message;
            } else {
                resp.message = "Internal Server Error";
            }
        }
        return resp;
    }



    @ApiOperation({ summary: 'Get Inco by Id' })
    @ApiCreatedResponse({
        description: 'Get Inco by Id',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Get('fetch/:IncoMasterSid')
    async getIncoById(@Param('IncoMasterSid', ParseIntPipe) IncoMasterSid: number) {
        let resp = new ResponseData();
        try {
            this.logger.log(`Getting Inco with id : ${IncoMasterSid}`);
            let res = await this.incoService.fetchIncoById(IncoMasterSid);
            this.logger.debug(`Fetched BlClasue : ${JSON.stringify(res)}`);
            resp.data = res;
            resp.message = `Inco with id : ${IncoMasterSid} is successfully fetched`;
        } catch (error) {
            this.logger.warn(`Get Inco by Id Error : ${JSON.stringify(error), error}`);
            resp.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                resp.message = error.message;
            } else {
                resp.message = "Internal Server Error";
            }
        }
        return resp;
    }



    @ApiOperation({ summary: 'Update Inco by Id' })
    @ApiCreatedResponse({
        description: 'Update Inco by Id',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Patch('update/:IncoMasterSid')
    async updateIncoById(@Param('IncoMasterSid', ParseIntPipe) IncoMasterSid: number, @Body() payload: any) {
        let resp = new ResponseData();
        try {
            this.logger.log(`Updating Inco with id : ${IncoMasterSid}`);
            let res = await this.incoService.updateIncoById(IncoMasterSid, payload);
            this.logger.debug(`Updated Inco : ${JSON.stringify(res)}`);
            resp.data = res;
            resp.message = `Inco with id : ${IncoMasterSid} is successfully updated`;
        } catch (error) {
            this.logger.warn(`Inco Updation Error : ${JSON.stringify(error), error}`);
            resp.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                resp.message = error.message;
            } else {
                resp.message = "Internal Server Error";
            }
        }
        return resp;
    }



    @ApiOperation({ summary: 'Delete Inco by Id' })
    @ApiCreatedResponse({
        description: 'Delete Inco by Id',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Delete('delete/:IncoMasterSid')
    async deleteIncoById(@Param('IncoMasterSid', ParseIntPipe) IncoMasterSid: number) {
        let resp = new ResponseData();
        try {
            this.logger.log(`Deleting Inco with id : ${IncoMasterSid}`);
            let res = await this.incoService.deleteInco(IncoMasterSid);
            this.logger.debug(`Deleted Inco : ${JSON.stringify(res)}`);
            resp.data = res;
            resp.message = `
            Inco with id : ${IncoMasterSid} is successfully deleted`;
        } catch (error) {
            this.logger.warn(`Inco Deletion Error : ${JSON.stringify(error), error}`);
            resp.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                resp.message = error.message;
            } else {
                resp.message = "Internal Server Error";
            }
        }
        return resp;
    }



    @ApiOperation({ summary: 'Search List of Inco' })
    @ApiCreatedResponse({
        description: 'Search List of Inco',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Post('search-list')
    async searchInco(@Body() searchData: SearchListDto) {
        let resp = new ResponseData();
        try {
            let res = await this.incoService.searchInco(searchData);
            this.logger.log(`Inco Search Results :${JSON.stringify(res)}`);
            resp.data = res;
            resp.message = "Inco Search results are successfully fetched"
        } catch (error) {
            this.logger.warn(`Inco Search Error : ${JSON.stringify(error), error}`);
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
