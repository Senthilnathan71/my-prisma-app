import { BadRequestException, Body, Controller, Delete, Get, HttpCode, HttpStatus, Logger, Param, ParseIntPipe, Patch, Post, UnauthorizedException } from '@nestjs/common';
import { ApiCreatedResponse, ApiOperation } from '@nestjs/swagger';
import { ResponseData } from 'src/common/response-data';
import { SearchListDto } from 'src/masters/DTO/search-list.dto';
import { RoleMenuService } from 'src/masters/services/role-menu/role-menu.service';


@Controller('role-menu')
export class RoleMenuController {
    constructor(private RoleMenuService: RoleMenuService, private logger: Logger) { }


    @ApiOperation({ summary: 'Create new RoleMenu' })
    @ApiCreatedResponse({
        description: 'Create new RoleMenu',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Post('create')
    async createNewRoleMenu(@Body() newData: any) {
        let resp = new ResponseData();
        try {
            let res = await this.RoleMenuService.createNewRoleMenu(newData);
            this.logger.log(`New RoleMenu Created : ${JSON.stringify(res)}`);
            resp.data = res;
            resp.message = "New RoleMenu is successfully created"
        } catch (error) {
            this.logger.warn(`RoleMenu Creation Error : ${JSON.stringify(error), error}`);
            resp.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                resp.message = error.message;
            } else {
                resp.message = "Internal Server Error";
            }
        }
        return resp;
    }



    @ApiOperation({ summary: 'Get All RoleMenu' })
    @ApiCreatedResponse({
        description: 'Get All RoleMenu',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Get()
    async getAllRoleMenu() {
        let resp = new ResponseData();
        try {
            let res = await this.RoleMenuService.getAllRoleMenu();
            this.logger.log(`All RoleMenu Fetched : ${JSON.stringify(res)}`);
            resp.data = res;
            resp.message = "All RoleMenu are successfully fetched";
        } catch (error) {
            this.logger.warn(`Get All RoleMenu Error : ${JSON.stringify(error), error}`);
            resp.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                resp.message = error.message;
            } else {
                resp.message = "Internal Server Error";
            }
        }
        return resp;
    }



    @ApiOperation({ summary: 'Get RoleMenu by Id' })
    @ApiCreatedResponse({
        description: 'Get RoleMenu by Id',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Get('fetch/:RoleMenuMasterSid')
    async getRoleMenuById(@Param('RoleMenuMasterSid', ParseIntPipe) RoleMenuMasterSid: number) {
        let resp = new ResponseData();
        try {
            this.logger.log(`Getting RoleMenu with id : ${RoleMenuMasterSid}`);
            let res = await this.RoleMenuService.fetchroleMenuById(RoleMenuMasterSid);
            this.logger.debug(`Fetched RoleMenu : ${JSON.stringify(res)}`);
            resp.data = res;
            resp.message = `RoleMenu with id : ${RoleMenuMasterSid} is successfully fetched`;
        } catch (error) {
            this.logger.warn(`Get RoleMenu by Id Error : ${JSON.stringify(error), error}`);
            resp.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                resp.message = error.message;
            } else {
                resp.message = "Internal Server Error";
            }
        }
        return resp;
    }



    @ApiOperation({ summary: 'Update RoleMenu by Id' })
    @ApiCreatedResponse({
        description: 'Update RoleMenu by Id',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Patch('update/:RoleMenuMasterSid')
    async updateRoleMenuById(@Param('RoleMenuMasterSid', ParseIntPipe) RoleMenuMasterSid: number, @Body() payload: any) {
        let resp = new ResponseData();
        try {
            this.logger.log(`Updating RoleMenu with id : ${RoleMenuMasterSid}`);
            let res = await this.RoleMenuService.updateRoleMenuById(RoleMenuMasterSid, payload);
            this.logger.debug(`Updated RoleMenu : ${JSON.stringify(res)}`);
            resp.data = res;
            resp.message = `RoleMenu with id : ${RoleMenuMasterSid} is successfully updated`;
        } catch (error) {
            this.logger.warn(`RoleMenu Updation Error : ${JSON.stringify(error), error}`);
            resp.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                resp.message = error.message;
            } else {
                resp.message = "Internal Server Error";
            }
        }
        return resp;
    }



    @ApiOperation({ summary: 'Delete RoleMenu by Id' })
    @ApiCreatedResponse({
        description: 'Delete RoleMenu by Id',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Delete('delete/:RoleMenuMasterSid')
    async deleteRoleMenuById(@Param('RoleMenuMasterSid', ParseIntPipe) RoleMenuMasterSid: number) {
        let resp = new ResponseData();
        try {
            this.logger.log(`Deleting RoleMenu with id : ${RoleMenuMasterSid}`);
            let res = await this.RoleMenuService.deleteRoleMenu(RoleMenuMasterSid);
            this.logger.debug(`Deleted RoleMenu : ${JSON.stringify(res)}`);
            resp.data = res;
            resp.message = `
            RoleMenu with id : ${RoleMenuMasterSid} is successfully deleted`;
        } catch (error) {
            this.logger.warn(`RoleMenu Deletion Error : ${JSON.stringify(error), error}`);
            resp.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                resp.message = error.message;
            } else {
                resp.message = "Internal Server Error";
            }
        }
        return resp;
    }



    @ApiOperation({ summary: 'Search List of RoleMenu' })
    @ApiCreatedResponse({
        description: 'Search List of RoleMenu',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Post('search-list')
    async searchRoleMenu(@Body() searchData: SearchListDto) {
        let resp = new ResponseData();
        try {
            let res = await this.RoleMenuService.searchroleMenu(searchData);
            this.logger.log(`RoleMenu Search Results :${JSON.stringify(res)}`);
            resp.data = res;
            resp.message = "RoleMenu Search results are successfully fetched"
        } catch (error) {
            this.logger.warn(`RoleMenu Search Error : ${JSON.stringify(error), error}`);
            resp.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                resp.message = error.message;
            } else {
                resp.message = "Internal Server Error";
            }
        }
        return resp;
    }


    @ApiOperation({ summary: 'Role Menu Special Search' })
    @ApiCreatedResponse({
        description: 'Role Menu Special Search',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Post('special-search')
    async roleMenuSpecialSearch(@Body() body: any) {
        let resp = new ResponseData();
        try {
            this.logger.log(`Getting RoleMenu by special search : ${JSON.stringify(body)}`);
            let res = await this.RoleMenuService.roleMenuSpecialSearch(body);
            this.logger.debug(`Fetched RoleMenus : ${JSON.stringify(res)}`);
            resp.data = res;
            resp.message = `RoleMenus : ${JSON.stringify(body)} is successfully fetched`;
        } catch (error) {
            this.logger.warn(`Get RoleMenu by special search Error : ${JSON.stringify(error), error}`);
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

