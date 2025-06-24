import { BadRequestException, Body, Controller, Delete, Get, HttpCode, HttpStatus, Logger, Param, ParseIntPipe, Patch, Post, UnauthorizedException } from '@nestjs/common';
import { ApiCreatedResponse, ApiOperation } from '@nestjs/swagger';
import { ResponseData } from 'src/common/response-data';
import { SearchListDto } from 'src/masters/DTO/search-list.dto';
import { AuthorityService } from 'src/masters/services/authority/authority.service';


@Controller('authority')
export class AuthorityController {
    constructor(private authorityService: AuthorityService, private logger: Logger) { }

    @ApiOperation({ summary: 'Create new Authority' })
    @ApiCreatedResponse({
        description: 'Create new Authority',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Post('create')
    async createNewAuthority(@Body() newData: any) {
        let resp = new ResponseData();
        try {
            let res = await this.authorityService.createNewAuthority(newData);
            this.logger.log(`New Authority Created : ${JSON.stringify(res)}`);
            resp.data = res;
            resp.message = "New Authority is successfully created"
        } catch (error) {
            this.logger.warn(`Authority Creation Error : ${JSON.stringify(error), error}`);
            resp.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                resp.message = error.message;
            } else {
                resp.message = "Internal Server Error";
            }
        }
        return resp;
    }

    @ApiOperation({ summary: 'Get All Authorities' })
    @ApiCreatedResponse({
        description: 'Get All Authorities',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Get()
    async getAllAuthorities() {
        let resp = new ResponseData();
        try {
            let res = await this.authorityService.getAllAuthorities();
            this.logger.log(`All Authorities Fetched : ${JSON.stringify(res)}`);
            resp.data = res;
            resp.message = "All Authorities are successfully fetched";
        } catch (error) {
            this.logger.warn(`Get All Authorities Error : ${JSON.stringify(error), error}`);
            resp.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                resp.message = error.message;
            } else {
                resp.message = "Internal Server Error";
            }
        }
        return resp;
    }

    @ApiOperation({ summary: 'Get Authority by Id' })
    @ApiCreatedResponse({
        description: 'Get Authority by Id',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Get('fetch/:AuthorityMasterSid')
    async getAuthorityById(@Param('AuthorityMasterSid', ParseIntPipe) AuthorityMasterSid: number) {
        let resp = new ResponseData();
        try {
            this.logger.log(`Getting Authority with id : ${AuthorityMasterSid}`);
            let res = await this.authorityService.fetchAuthorityById(AuthorityMasterSid);
            this.logger.debug(`Fetched Authority : ${JSON.stringify(res)}`);
            resp.data = res;
            resp.message = `Authority with id : ${AuthorityMasterSid} is successfully fetched`;
        } catch (error) {
            this.logger.warn(`Get Authority by Id Error : ${JSON.stringify(error), error}`);
            resp.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                resp.message = error.message;
            } else {
                resp.message = "Internal Server Error";
            }
        }
        return resp;
    }

    @ApiOperation({ summary: 'Update Authority by Id' })
    @ApiCreatedResponse({
        description: 'Update Authority by Id',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Patch('update/:AuthorityMasterSid')
    async updateAuthorityById(@Param('AuthorityMasterSid', ParseIntPipe) AuthorityMasterSid: number, @Body() payload: any) {
        let resp = new ResponseData();
        try {
            this.logger.log(`Updating Authority with id : ${AuthorityMasterSid}`);
            let res = await this.authorityService.updateAuthorityById(AuthorityMasterSid, payload);
            this.logger.debug(`Updated Authority : ${JSON.stringify(res)}`);
            resp.data = res;
            resp.message = `Authority with id : ${AuthorityMasterSid} is successfully updated`;
        } catch (error) {
            this.logger.warn(`Authority Update Error : ${JSON.stringify(error), error}`);
            resp.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                resp.message = error.message;
            } else {
                resp.message = "Internal Server Error";
            }
        }
        return resp;
    }

    @ApiOperation({ summary: 'Delete Authority by Id' })
    @ApiCreatedResponse({
        description: 'Delete Authority by Id',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Delete('delete/:AuthorityMasterSid')
    async deleteAuthorityById(@Param('AuthorityMasterSid', ParseIntPipe) AuthorityMasterSid: number) {
        let resp = new ResponseData();
        try {
            this.logger.log(`Deleting Authority with id : ${AuthorityMasterSid}`);
            let res = await this.authorityService.deleteAuthority(AuthorityMasterSid);
            this.logger.debug(`Deleted Authority : ${JSON.stringify(res)}`);
            resp.data = res;
            resp.message = `Authority with id : ${AuthorityMasterSid} is successfully deleted`;
        } catch (error) {
            this.logger.warn(`Authority Deletion Error : ${JSON.stringify(error), error}`);
            resp.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                resp.message = error.message;
            } else {
                resp.message = "Internal Server Error";
            }
        }
        return resp;
    }

    @ApiOperation({ summary: 'Search List of Authorities' })
    @ApiCreatedResponse({
        description: 'Search List of Authorities',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Post('search-list')
    async searchAuthority(@Body() searchData: SearchListDto) {
        let resp = new ResponseData();
        try {
            let res = await this.authorityService.searchAuthority(searchData);
            this.logger.log(`Authority Search Results :${JSON.stringify(res)}`);
            resp.data = res;
            resp.message = "Authority Search results are successfully fetched"
        } catch (error) {
            this.logger.warn(`Authority Search Error : ${JSON.stringify(error), error}`);
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