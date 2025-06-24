import { BadRequestException, Body, Controller, Delete, Get, HttpCode, HttpStatus, Logger, Param, ParseIntPipe, Patch, Post, UnauthorizedException } from '@nestjs/common';
import { ApiCreatedResponse, ApiOperation } from '@nestjs/swagger';
import { ResponseData } from 'src/common/response-data';
import { SearchListDto } from 'src/masters/DTO/search-list.dto';
import { AuthorityDetailService } from 'src/masters/services/authority-detail/authority-detail.service';

@Controller('authority-detail')
export class AuthorityDetailController {
    constructor(private authorityDetailService: AuthorityDetailService, private logger: Logger) { }

    @ApiOperation({ summary: 'Create new Authority Detail' })
    @ApiCreatedResponse({
        description: 'Create new Authority Detail',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Post('create')
    async createNewAuthorityDetail(@Body() newData: any) {
        let resp = new ResponseData();
        try {
            let res = await this.authorityDetailService.createNewAuthorityDetail(newData);
            this.logger.log(`New Authority Detail Created : ${JSON.stringify(res)}`);
            resp.data = res;
            resp.message = "New Authority Detail is successfully created";
        } catch (error) {
            this.logger.warn(`Authority Detail Creation Error : ${JSON.stringify(error)}`, error);
            resp.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                resp.message = error.message;
            } else {
                resp.message = "Internal Server Error";
            }
        }
        return resp;
    }

    @ApiOperation({ summary: 'Get All Authority Details' })
    @ApiCreatedResponse({
        description: 'Get All Authority Details',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Get()
    async getAllAuthorityDetails() {
        let resp = new ResponseData();
        try {
            let res = await this.authorityDetailService.getAllAuthorityDetails();
            this.logger.log(`All Authority Details Fetched : ${JSON.stringify(res)}`);
            resp.data = res;
            resp.message = "All Authority Details are successfully fetched";
        } catch (error) {
            this.logger.warn(`Get All Authority Details Error : ${JSON.stringify(error)}`, error);
            resp.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                resp.message = error.message;
            } else {
                resp.message = "Internal Server Error";
            }
        }
        return resp;
    }

    @ApiOperation({ summary: 'Get Authority Detail by Id' })
    @ApiCreatedResponse({
        description: 'Get Authority Detail by Id',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Get('fetch/:AuthorityDetailSid')
    async getAuthorityDetailById(@Param('AuthorityDetailSid', ParseIntPipe) AuthorityDetailSid: number) {
        let resp = new ResponseData();
        try {
            this.logger.log(`Getting Authority Detail with id : ${AuthorityDetailSid}`);
            let res = await this.authorityDetailService.fetchAuthorityDetailById(AuthorityDetailSid);
            this.logger.debug(`Fetched Authority Detail : ${JSON.stringify(res)}`);
            resp.data = res;
            resp.message = `Authority Detail with id : ${AuthorityDetailSid} is successfully fetched`;
        } catch (error) {
            this.logger.warn(`Get Authority Detail by Id Error : ${JSON.stringify(error)}`, error);
            resp.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                resp.message = error.message;
            } else {
                resp.message = "Internal Server Error";
            }
        }
        return resp;
    }

    @ApiOperation({ summary: 'Update Authority Detail by Id' })
    @ApiCreatedResponse({
        description: 'Update Authority Detail by Id',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Patch('update/:AuthorityDetailSid')
    async updateAuthorityDetailById(@Param('AuthorityDetailSid', ParseIntPipe) AuthorityDetailSid: number, @Body() payload: any) {
        let resp = new ResponseData();
        try {
            this.logger.log(`Updating Authority Detail with id : ${AuthorityDetailSid}`);
            let res = await this.authorityDetailService.updateAuthorityDetailById(AuthorityDetailSid, payload);
            this.logger.debug(`Updated Authority Detail : ${JSON.stringify(res)}`);
            resp.data = res;
            resp.message = `Authority Detail with id : ${AuthorityDetailSid} is successfully updated`;
        } catch (error) {
            this.logger.warn(`Authority Detail Updation Error : ${JSON.stringify(error)}`, error);
            resp.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                resp.message = error.message;
            } else {
                resp.message = "Internal Server Error";
            }
        }
        return resp;
    }

    @ApiOperation({ summary: 'Delete Authority Detail by Id' })
    @ApiCreatedResponse({
        description: 'Delete Authority Detail by Id',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Delete('delete/:AuthorityDetailSid')
    async deleteAuthorityDetailById(@Param('AuthorityDetailSid', ParseIntPipe) AuthorityDetailSid: number) {
        let resp = new ResponseData();
        try {
            this.logger.log(`Deleting Authority Detail with id : ${AuthorityDetailSid}`);
            let res = await this.authorityDetailService.deleteAuthorityDetail(AuthorityDetailSid);
            this.logger.debug(`Deleted Authority Detail : ${JSON.stringify(res)}`);
            resp.data = res;
            resp.message = `Authority Detail with id : ${AuthorityDetailSid} is successfully deleted`;
        } catch (error) {
            this.logger.warn(`Authority Detail Deletion Error : ${JSON.stringify(error)}`, error);
            resp.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                resp.message = error.message;
            } else {
                resp.message = "Internal Server Error";
            }
        }
        return resp;
    }

    @ApiOperation({ summary: 'Search List of Authority Details' })
    @ApiCreatedResponse({
        description: 'Search List of Authority Details',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Post('search-list')
    async searchAuthorityDetails(@Body() searchData: SearchListDto) {
        let resp = new ResponseData();
        try {
            let res = await this.authorityDetailService.searchAuthorityDetails(searchData);
            this.logger.log(`Authority Detail Search Results : ${JSON.stringify(res)}`);
            resp.data = res;
            resp.message = "Authority Detail Search results are successfully fetched";
        } catch (error) {
            this.logger.warn(`Authority Detail Search Error : ${JSON.stringify(error)}`, error);
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