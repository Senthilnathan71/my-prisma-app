import { BadRequestException, Body, Controller, Delete, Get, HttpCode, HttpStatus, Logger, Param, ParseIntPipe, Patch, Post, UnauthorizedException } from '@nestjs/common';
import { ApiCreatedResponse, ApiOperation } from '@nestjs/swagger';
import { Auth } from 'src/common/decorators/auth.decorator';
import { ResponseData } from 'src/common/response-data';
import { SearchListDto } from 'src/masters/DTO/search-list.dto';
import { UserTypeService } from 'src/masters/services/user-type/user-type.service';

@Auth()
@Controller('user-type')
export class UserTypeController {
    constructor(private userTypeService: UserTypeService, private logger: Logger) { }


    @ApiOperation({ summary: 'Create new UserType' })
    @ApiCreatedResponse({
        description: 'Create new UserType',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Post('create')
    async createNewUserType(@Body() newData: any) {
        let resp = new ResponseData();
        try {
            let res = await this.userTypeService.createNewUserType(newData);
            this.logger.log(`New UserType Created : ${JSON.stringify(res)}`);
            resp.data = res;
            resp.message = "New UserType is successfully created"
        } catch (error) {
            this.logger.warn(`UserType Creation Error : ${JSON.stringify(error), error}`);
            resp.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                resp.message = error.message;
            } else {
                resp.message = "Internal Server Error";
            }
        }
        return resp;
    }



    @ApiOperation({ summary: 'Get All UserType' })
    @ApiCreatedResponse({
        description: 'Get All UserType',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Get()
    async getAllUserType() {
        let resp = new ResponseData();
        try {
            let res = await this.userTypeService.getAllUserType();
            this.logger.log(`All UserType Fetched : ${JSON.stringify(res)}`);
            resp.data = res;
            resp.message = "All UserType are successfully fetched";
        } catch (error) {
            this.logger.warn(`Get All UserType Error : ${JSON.stringify(error), error}`);
            resp.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                resp.message = error.message;
            } else {
                resp.message = "Internal Server Error";
            }
        }
        return resp;
    }



    @ApiOperation({ summary: 'Get UserType by Id' })
    @ApiCreatedResponse({
        description: 'Get UserType by Id',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Get('fetch/:UserTypeSid')
    async getUserTypeById(@Param('UserTypeSid', ParseIntPipe) UserTypeSid: number) {
        let resp = new ResponseData();
        try {
            this.logger.log(`Getting UserType with id : ${UserTypeSid}`);
            let res = await this.userTypeService.fetchUserTypeById(UserTypeSid);
            this.logger.debug(`Fetched UserType : ${JSON.stringify(res)}`);
            resp.data = res;
            resp.message = `UserType with id : ${UserTypeSid} is successfully fetched`;
        } catch (error) {
            this.logger.warn(`Get UserType by Id Error : ${JSON.stringify(error), error}`);
            resp.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                resp.message = error.message;
            } else {
                resp.message = "Internal Server Error";
            }
        }
        return resp;
    }



    @ApiOperation({ summary: 'Update UserType by Id' })
    @ApiCreatedResponse({
        description: 'Update UserType by Id',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Patch('update/:UserTypeSid')
    async updateUserTypeById(@Param('UserTypeSid', ParseIntPipe) UserTypeSid: number, @Body() payload: any) {
        let resp = new ResponseData();
        try {
            this.logger.log(`Updating UserType with id : ${UserTypeSid}`);
            let res = await this.userTypeService.updateUserTypeById(UserTypeSid, payload);
            this.logger.debug(`Updated UserType : ${JSON.stringify(res)}`);
            resp.data = res;
            resp.message = `UserType with id : ${UserTypeSid} is successfully updated`;
        } catch (error) {
            this.logger.warn(`UserType Updation Error : ${JSON.stringify(error), error}`);
            resp.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                resp.message = error.message;
            } else {
                resp.message = "Internal Server Error";
            }
        }
        return resp;
    }



    @ApiOperation({ summary: 'Delete UserType by Id' })
    @ApiCreatedResponse({
        description: 'Delete UserType by Id',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Delete('delete/:UserTypeSid')
    async deleteUserTypeById(@Param('UserTypeSid', ParseIntPipe) UserTypeSid: number) {
        let resp = new ResponseData();
        try {
            this.logger.log(`Deleting UserType with id : ${UserTypeSid}`);
            let res = await this.userTypeService.deleteUserType(UserTypeSid);
            this.logger.debug(`Deleted UserType : ${JSON.stringify(res)}`);
            resp.data = res;
            resp.message = `
            UserType with id : ${UserTypeSid} is successfully deleted`;
        } catch (error) {
            this.logger.warn(`UserType Deletion Error : ${JSON.stringify(error), error}`);
            resp.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                resp.message = error.message;
            } else {
                resp.message = "Internal Server Error";
            }
        }
        return resp;
    }



    @ApiOperation({ summary: 'Search List of UserType' })
    @ApiCreatedResponse({
        description: 'Search List of UserType',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Post('search-list')
    async searchUserType(@Body() searchData: SearchListDto) {
        let resp = new ResponseData();
        try {
            let res = await this.userTypeService.searchUserType(searchData);
            this.logger.log(`UserType Search Results :${JSON.stringify(res)}`);
            resp.data = res;
            resp.message = "UserType Search results are successfully fetched"
        } catch (error) {
            this.logger.warn(`UserType Search Error : ${JSON.stringify(error), error}`);
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
