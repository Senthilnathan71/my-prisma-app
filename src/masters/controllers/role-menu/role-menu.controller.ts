import { BadRequestException, Body, Controller, Get, HttpCode, HttpStatus, Logger, NotFoundException, Param, ParseIntPipe, Patch, Post, UnauthorizedException, UsePipes, ValidationPipe } from '@nestjs/common';
import { ApiCreatedResponse, ApiOperation } from '@nestjs/swagger';
import { ResponseData } from 'src/common/response-data';
import { RoleMenuPayload } from 'src/masters/DTO/role-menu.dto';
import { filterDto } from 'src/masters/DTO/search-vessel.dto';
import { RoleMenuService } from 'src/masters/services/role-menu/role-menu.service';

@Controller('role-menu')
export class RoleMenuController {
    private readonly logger = new Logger(RoleMenuController.name);

    constructor(
        private roleMenuService: RoleMenuService
    ) { }
    
    @ApiOperation({ summary: 'Create new RoleMenu' })
    @ApiCreatedResponse({
        description: 'Create new RoleMenu',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @UsePipes(new ValidationPipe({ whitelist: true }))
    @Post('create')
    async createNewRoleMenu(@Body() newData: RoleMenuPayload) {
        let resp = new ResponseData();
        this.logger.log(`createNewRoleMenu: ${JSON.stringify(newData)}`);
        try {
            let res = await this.roleMenuService.createRoleMenu(newData);
            this.logger.log(`New RoleMenu Created : ${JSON.stringify(res)}`);
            resp.data = res;
            resp.message = "New Role menu is successfully created."
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

    @ApiOperation({ summary: 'Search Role Menu' })
    @ApiCreatedResponse({
        description: 'Search Role Menu',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Post('search-list')
    async searchRoleMenu(
        @Body() searchData: filterDto
    ){
        let resp = new ResponseData();
        try {
            this.logger.log(`Searching RoleMenus with params: ${JSON.stringify(searchData)}`);
            let res = await this.roleMenuService.searchRoleMenu(searchData);
            this.logger.debug(`RoleMenu Search Results :${JSON.stringify(res)}`);
            resp.data = res;
            resp.message = "RoleMenu Search results are successfully fetched"
        } catch (error) {
            this.logger.warn(`Search RoleMenu Error : ${JSON.stringify(error), error}`);
            resp.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                resp.message = error.message;
            } else {
                resp.message = "Internal Server Error";
            }
        }
        return resp;
    }

    @ApiOperation({ summary: 'Update Role Menu' })
    @ApiCreatedResponse({
        description: 'Update Role Menu',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Patch('update')
    async updateRoleMenu(
        @Body() payload: RoleMenuPayload
    ){
        let resp = new ResponseData();
        try {
            this.logger.log(`Updating RoleMenu with id : ${payload.RoleMenuHeaderSid}`);
            let res = await this.roleMenuService.updateRoleMenu(payload);
            this.logger.debug(`Updated RoleMenu : ${JSON.stringify(res)}`);
            resp.data = res;
            resp.message = `Rolemenu updated successfully.`;
        } catch (error) {
            this.logger.warn(`Update RoleMenu by Id Error : ${JSON.stringify(error), error}`);
            resp.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                resp.message = error.message;
            } else {
                resp.message = "Internal Server Error";
            }
        }
        return resp;
    }

    @ApiOperation({ summary: 'Get Role Menu' })
    @ApiCreatedResponse({
        description: 'Get Role Menu',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Get('fetch/:CompanyMasterSid/:RoleMenuHeaderSid')
    async getRoleMenuByRoleMenuId(
        @Param('CompanyMasterSid', ParseIntPipe) CompanyMasterSid: number, 
        @Param('RoleMenuHeaderSid', ParseIntPipe) RoleMenuHeaderSid: number
    ) {
        let resp = new ResponseData();
        try {
            this.logger.log(`Getting RoleMenu with id : ${RoleMenuHeaderSid}`);
            let res = await this.roleMenuService.getRoleMenuByRoleId({
                RoleMenuHeaderSid: RoleMenuHeaderSid,
                CompanyMasterSid: CompanyMasterSid
            });
            this.logger.debug(`Fetched RoleMenu : ${JSON.stringify(res)}`);
            resp.data = res;
            resp.message = `RoleMenu fetched successfully.`;
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

    @ApiOperation({ summary: 'Get All Menu with Modules'})
    @ApiCreatedResponse({
        description: 'Get All Menu with Modules',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Get('menu-with-modules')
    async getAllMenuWithModules(){
        let resp = new ResponseData();
        try {
            const menus = await this.roleMenuService.getAllMenuWithModules();
            this.logger.debug(`getAllMenuWithModules: ${JSON.stringify(menus)}`);
            resp.data = menus;
            resp.message = "All Menu with Modules are successfully fetched";
        } catch (error) {
            this.logger.warn(`getAllMenuWithModules: ${JSON.stringify(error)}`);
            resp.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                resp.message = error.message;
            } else {
                resp.message = "Internal Server Error";
            }
        }
        return resp;
    }

    @ApiOperation({ summary: 'Get Menu Permission' })
    @ApiCreatedResponse({
        description: 'Get Menu Permission',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Post('menu-permissions')
    async getMenuPermission(
        @Body() payload : {
            CompanyMasterSid:number,
            RoleMasterSid:number,
            MenuMasterSid:number,
        }
    ){
        let resp = new ResponseData();
        try {
            this.logger.log(`Getting Menu Permission : ${JSON.stringify(payload)}`);
            let res = await this.roleMenuService.getMenuPermission(payload);
            this.logger.debug(`Fetched Menu Permission : ${JSON.stringify(res)}`);
            resp.data = res;
            resp.message = `Menu Permission fetched successfully.`;
        } catch (error) {
            this.logger.warn(`Get Menu Permission Error : ${JSON.stringify(error), error}`);
            resp.status = false;
            if (error instanceof BadRequestException || 
                error instanceof UnauthorizedException ||
                error instanceof NotFoundException
            ) {
                resp.message = error.message;
            } else {
                resp.message = "Internal Server Error";
            }
        }
        return resp;
    }


    // Needs to be removed
    @Get('permissions/:menuId/:roleId')
    async getRoleMenuPermissions(
        @Param('menuId', ParseIntPipe) menuId: number,
        @Param('roleId', ParseIntPipe) roleId: number
    ) {
        let resp = new ResponseData();
        try {
            const permissions = await this.roleMenuService.getRoleMenuPermissions(menuId, roleId);
            resp.data = permissions;
            resp.message = "Permissions fetched successfully";
        } catch (error) {
            this.logger.warn(`Error fetching permissions: ${error}`);
            resp.status = false;
            resp.message = "Error fetching permissions";
        }
        return resp;
    }

}
