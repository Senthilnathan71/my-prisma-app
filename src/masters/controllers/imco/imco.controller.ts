import { BadRequestException, Body, Controller, Delete, Get, HttpCode, HttpStatus, Logger, Param, ParseIntPipe, Patch, Post, UnauthorizedException } from '@nestjs/common';
import { ApiCreatedResponse, ApiOperation } from '@nestjs/swagger';
import { Prisma } from '@prisma/client';
import { ResponseData } from 'src/common/response-data';
import { SearchListDto } from 'src/masters/DTO/search-list.dto';
import { ImcoService } from 'src/masters/services/imco/imco.service';

@Controller('imco')
export class ImcoController {
    constructor(private imcoService: ImcoService, private logger: Logger) { }


    @ApiOperation({ summary: 'Create new IMCO' })
    @ApiCreatedResponse({
        description: 'Create new IMCO',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Post('create')
    async createNewImco(@Body() newData: Prisma.ImcoMasterCreateInput) {
        let resp = new ResponseData();
        try {
            let res = await this.imcoService.createNewIMCO(newData);
            this.logger.log(`New IMCO Created : ${JSON.stringify(res)}`);
            resp.data = res;
            resp.message = "New IMCO is successfully created"
        } catch (error) {
            this.logger.warn(`IMCO Creation Error : ${JSON.stringify(error), error}`);
            resp.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                resp.message = error.message;
            } else {
                resp.message = "Internal Server Error";
            }
        }
        return resp;
    }



    @ApiOperation({ summary: 'Get All IMCO' })
    @ApiCreatedResponse({
        description: 'Get All IMCO',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Get()
    async getAllIMCO() {
        let resp = new ResponseData();
        try {
            let res = await this.imcoService.getAllIMCO();
            this.logger.log(`All IMCO Fetched : ${JSON.stringify(res)}`);
            resp.data = res;
            resp.message = "ALl IMCO are successfully fetched";
        } catch (error) {
            this.logger.warn(`Get All IMCO Error : ${JSON.stringify(error), error}`);
            resp.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                resp.message = error.message;
            } else {
                resp.message = "Internal Server Error";
            }
        }
        return resp;
    }



    @ApiOperation({ summary: 'Get IMCO by Id' })
    @ApiCreatedResponse({
        description: 'Get IMCO by Id',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Get('fetch/:ImcoMasterSid')
    async getIMCOById(@Param('ImcoMasterSid', ParseIntPipe) ImcoMasterSid: number) {
        let resp = new ResponseData();
        try {
            this.logger.log(`Getting IMCO with id : ${ImcoMasterSid}`);
            let res = await this.imcoService.fetchIMCOById(ImcoMasterSid);
            this.logger.debug(`Fetched IMCO : ${JSON.stringify(res)}`);
            resp.data = res;
            resp.message = `IMCO with id : ${ImcoMasterSid} is successfully fetched`;
        } catch (error) {
            this.logger.warn(`Get IMCO by Id Error : ${JSON.stringify(error), error}`);
            resp.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                resp.message = error.message;
            } else {
                resp.message = "Internal Server Error";
            }
        }
        return resp;
    }



    @ApiOperation({ summary: 'Update IMCO by Id' })
    @ApiCreatedResponse({
        description: 'Update IMCO by Id',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Patch('update/:ImcoMasterSid')
    async updateIMCOById(@Param('ImcoMasterSid', ParseIntPipe) ImcoMasterSid: number, @Body() payload: Prisma.ImcoMasterUpdateInput) {
        let resp = new ResponseData();
        try {
            this.logger.log(`Updating IMCO with id : ${ImcoMasterSid}`);
            let res = await this.imcoService.updateimcoMasterById(ImcoMasterSid, payload);
            this.logger.debug(`Updated IMCO : ${JSON.stringify(res)}`);
            resp.data = res;
            resp.message = `IMCO with id : ${ImcoMasterSid} is successfully updated`;
        } catch (error) {
            this.logger.warn(`IMCO Updation Error : ${JSON.stringify(error), error}`);
            resp.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                resp.message = error.message;
            } else {
                resp.message = "Internal Server Error";
            }
        }
        return resp;
    }



    @ApiOperation({ summary: 'Delete IMCO by Id' })
    @ApiCreatedResponse({
        description: 'Delete IMCO by Id',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Delete('delete/:ImcoMasterSid')
    async deleteIMCOById(@Param('ImcoMasterSid', ParseIntPipe) ImcoMasterSid: number) {
        let resp = new ResponseData();
        try {
            this.logger.log(`Deleting IMCO with id : ${ImcoMasterSid}`);
            let res = await this.imcoService.deleteimcoMasters(ImcoMasterSid);
            this.logger.debug(`Deleted IMCO : ${JSON.stringify(res)}`);
            resp.data = res;
            resp.message = `IMCO with id : ${ImcoMasterSid} is successfully deleted`;
        } catch (error) {
            this.logger.warn(`IMCO Deletion Error : ${JSON.stringify(error), error}`);
            resp.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                resp.message = error.message;
            } else {
                resp.message = "Internal Server Error";
            }
        }
        return resp;
    }



    @ApiOperation({ summary: 'Search List of IMCO' })
    @ApiCreatedResponse({
        description: 'Search List of IMCO',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Post('search-list')
    async searchIMCO(@Body() searchData: SearchListDto) {
        let resp = new ResponseData();
        try {
            let res = await this.imcoService.searchimcoMaster(searchData);
            this.logger.log(`IMCO Search Results :${JSON.stringify(res)}`);
            resp.data = res;
            resp.message = "IMCO Search results are successfully fetched"
        } catch (error) {
            this.logger.warn(`IMCO Search Error : ${JSON.stringify(error), error}`);
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
