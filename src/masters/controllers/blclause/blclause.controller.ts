import { BadRequestException, Body, Controller, Delete, Get, HttpCode, HttpStatus, Logger, Param, ParseIntPipe, Patch, Post, UnauthorizedException } from '@nestjs/common';
import { ApiCreatedResponse, ApiOperation } from '@nestjs/swagger';
import { Prisma } from '@prisma/client';
import { ResponseData } from 'src/common/response-data';
import { SearchListDto } from 'src/masters/DTO/search-list.dto';
import { BlclauseService } from 'src/masters/services/blclause/blclause.service';


@Controller('blclause')
export class BlclauseController {
    constructor(private blClauseService: BlclauseService, private logger: Logger) { }


    @ApiOperation({ summary: 'Create new BlClause' })
    @ApiCreatedResponse({
        description: 'Create new BlClause',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Post('create')
    async createNewBlClause(@Body() newData: Prisma.BLClauseMasterCreateInput) {
        let resp = new ResponseData();
        try {
            let res = await this.blClauseService.createNewBlclause(newData);
            this.logger.log(`New BlClause Created : ${JSON.stringify(res)}`);
            resp.data = res;
            resp.message = "New BlClause is successfully created"
        } catch (error) {
            this.logger.warn(`BlClause Creation Error : ${JSON.stringify(error), error}`);
            resp.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                resp.message = error.message;
            } else {
                resp.message = "Internal Server Error";
            }
        }
        return resp;
    }



    @ApiOperation({ summary: 'Get All BlClause' })
    @ApiCreatedResponse({
        description: 'Get All BlClause',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Get()
    async getAllBlClause() {
        let resp = new ResponseData();
        try {
            let res = await this.blClauseService.getAllBlclause();
            this.logger.log(`All BlClause Fetched : ${JSON.stringify(res)}`);
            resp.data = res;
            resp.message = "All BlClause are successfully fetched";
        } catch (error) {
            this.logger.warn(`Get All BlClause Error : ${JSON.stringify(error), error}`);
            resp.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                resp.message = error.message;
            } else {
                resp.message = "Internal Server Error";
            }
        }
        return resp;
    }



    @ApiOperation({ summary: 'Get BlClause by Id' })
    @ApiCreatedResponse({
        description: 'Get BlClause by Id',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Get('fetch/:BLClauseMasterSid')
    async getBlClauseById(@Param('BLClauseMasterSid', ParseIntPipe) BLClauseMasterSid: number) {
        let resp = new ResponseData();
        try {
            this.logger.log(`Getting BlClause with id : ${BLClauseMasterSid}`);
            let res = await this.blClauseService.fetchBlclauseById(BLClauseMasterSid);
            this.logger.debug(`Fetched BlClasue : ${JSON.stringify(res)}`);
            resp.data = res;
            resp.message = `BlClause with id : ${BLClauseMasterSid} is successfully fetched`;
        } catch (error) {
            this.logger.warn(`Get BlClause by Id Error : ${JSON.stringify(error), error}`);
            resp.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                resp.message = error.message;
            } else {
                resp.message = "Internal Server Error";
            }
        }
        return resp;
    }



    @ApiOperation({ summary: 'Update BlClause by Id' })
    @ApiCreatedResponse({
        description: 'Update BlClause by Id',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Patch('update/:BLClauseMasterSid')
    async updateBlClauseById(@Param('BLClauseMasterSid', ParseIntPipe) BLClauseMasterSid: number, @Body() payload: Prisma.BLClauseMasterUpdateInput) {
        let resp = new ResponseData();
        try {
            this.logger.log(`Updating BlClause with id : ${BLClauseMasterSid}`);
            let res = await this.blClauseService.updateBlclauseById(BLClauseMasterSid, payload);
            this.logger.debug(`Updated BlClause : ${JSON.stringify(res)}`);
            resp.data = res;
            resp.message = `BlClause with id : ${BLClauseMasterSid} is successfully updated`;
        } catch (error) {
            this.logger.warn(`BlClause Updation Error : ${JSON.stringify(error), error}`);
            resp.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                resp.message = error.message;
            } else {
                resp.message = "Internal Server Error";
            }
        }
        return resp;
    }



    @ApiOperation({ summary: 'Delete BlClause by Id' })
    @ApiCreatedResponse({
        description: 'Delete BlClause by Id',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Delete('delete/:BLClauseMasterSid')
    async deleteBlClauseById(@Param('BLClauseMasterSid', ParseIntPipe) BLClauseMasterSid: number) {
        let resp = new ResponseData();
        try {
            this.logger.log(`Deleting BlClause with id : ${BLClauseMasterSid}`);
            let res = await this.blClauseService.deleteBlClause(BLClauseMasterSid);
            this.logger.debug(`Deleted BlClause : ${JSON.stringify(res)}`);
            resp.data = res;
            resp.message = `
            BlClause with id : ${BLClauseMasterSid} is successfully deleted`;
        } catch (error) {
            this.logger.warn(`BlClause Deletion Error : ${JSON.stringify(error), error}`);
            resp.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                resp.message = error.message;
            } else {
                resp.message = "Internal Server Error";
            }
        }
        return resp;
    }



    @ApiOperation({ summary: 'Search List of BlClause' })
    @ApiCreatedResponse({
        description: 'Search List of BlClause',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Post('search-list')
    async searchBlClause(@Body() searchData: SearchListDto) {
        let resp = new ResponseData();
        try {
            let res = await this.blClauseService.searchBlclause(searchData);
            this.logger.log(`BlClause Search Results :${JSON.stringify(res)}`);
            resp.data = res;
            resp.message = "BlClause Search results are successfully fetched"
        } catch (error) {
            this.logger.warn(`BlClause Search Error : ${JSON.stringify(error), error}`);
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
