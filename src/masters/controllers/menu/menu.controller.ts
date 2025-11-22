import { BadRequestException, Body, Controller, Delete, Get, HttpCode, HttpStatus, Logger, Param, ParseIntPipe, Patch, Post, Query, UnauthorizedException } from '@nestjs/common';
import { ApiOperation, ApiCreatedResponse } from '@nestjs/swagger';
import { Auth } from 'src/common/decorators/auth.decorator';
import { UserData } from 'src/common/decorators/user.decorator';
import { ResponseData } from 'src/common/response-data';
import { SearchListDto } from 'src/masters/DTO/search-list.dto';
import { filterDto } from 'src/masters/DTO/search-vessel.dto';
import { MenuService } from 'src/masters/services/menu/menu.service';

@Controller('menu')
@Auth()
export class MenuController {
    constructor(private menuService: MenuService, private logger: Logger) { }

    @ApiOperation({ summary: 'Menu Creation' })
    @ApiCreatedResponse({
        description: 'Menu Creation',
        type: ResponseData
    })
    @HttpCode(HttpStatus.CREATED)
    @Post('create')
    async createMenu(@Body() body: any, @UserData() user: any) {
        this.logger.log(`createmenudata: ${JSON.stringify(body)}`)
        let output = new ResponseData
        try {
            let menu = await this.menuService.createMenu(body, user);
            this.logger.debug(`createmenu: ${JSON.stringify(menu)}`)
            if (!menu) {
                this.logger.warn(`createmenu!!: ${JSON.stringify(menu)}`)
                throw 'Something went wrong'
            }
            output.data = menu
            output.message = 'Menu Created Successfully'
        } catch (error) {
            this.logger.warn(`createmenuError: ${error}`)
            output.status = false;
            // Handle error message based on the type of error
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                output.message = error.message;
                this.logger.warn(`createmenuError: ${error.message}`)
            } else {
                this.logger.warn(`createmenuError: ${error}`)
                output.message = error;
            }
        }
        return output
    }

    @ApiOperation({ summary: 'Get Main Menus' })
    @ApiCreatedResponse({
        description: 'Get Main Menus',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Get('main-menus')
    async getMainMenus() {
        let output = new ResponseData;
        try {
            let menuData = await this.menuService.getMainMenus();
            output.data = menuData;
            output.status = true;
            output.message = 'Main menus fetched successfully';
        } catch (error) {
            output.status = false;
            output.message = 'Error fetching main menus';
            this.logger.error('Error in getMainMenus:', error);
        }
        return output;
    }

    
    @ApiOperation({ summary: 'Get Menu Id By Menu Name' })
    @ApiCreatedResponse({
        description: 'Get Menu Id By Menu Name',
        type: ResponseData,
    })
    @HttpCode(HttpStatus.OK)
    @Get('get-by-name')
    async getMenuSidByName(@Query('menuName') menuName: string) {
        const output = new ResponseData();
        try {
            const menu = await this.menuService.getMenuSidByName(menuName);
            this.logger.log(`getMenuSidByName: ${JSON.stringify(menu)}`);
            output.data = menu;
            output.message = `Menu with name: ${menuName} is successfully fetched`;
        } catch (error) {
            this.logger.warn(`getMenuSidByName: ${JSON.stringify(error),error}`);
            output.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                output.message = error.message;
            } else {
                output.message = 'Internal Server Error';
            }
        }
        return output;
    }



    @ApiOperation({ summary: 'Get All Menus' })
    @ApiCreatedResponse({
        description: 'Get All Menus',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Get()
    async getAllMenus(@UserData() user:any) {
        let output = new ResponseData;
        try {
            let menuData = await this.menuService.getAllMenus(user);
            this.logger.log(`getAllmenus: ${JSON.stringify(menuData)}`)
            output.data = menuData;
            output.message = "All Menu are successfully fetched";
        } catch (error) {
            this.logger.warn(`getAllmenus: ${JSON.stringify(error)}`)
            output.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                output.message = error.message;
            } else {
                output.message = 'Internal Server Error';
            }
        }
        return output
    }


    @ApiOperation({ summary: 'Get Menu By Id' })
    @ApiCreatedResponse({
        description: 'Get menu By Id',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Get('fetch/:id')
    async getMenuById(@Param('id', ParseIntPipe) menuId: number) {
        const output = new ResponseData;
        try {
            const menu = await this.menuService.findOne(menuId)
            this.logger.log(`getmenuById: ${JSON.stringify(menu)}`)
            output.data = menu
            output.message = `Menu with id : ${menuId} is successfully fetched`;
        } catch (error) {
            this.logger.warn(`getmenuById: ${JSON.stringify(error)}`)
            output.status = false;
            output.message = error
        }
        return output;
    }


    @ApiOperation({ summary: 'Get Menu Permissions By Id' })
    @ApiCreatedResponse({
        description: 'Get menu permissions By Id',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Get('fetch/menu-permissions/:id')
    async getMenuPermissionsById(@Param('id', ParseIntPipe) menuId: number) {
        const output = new ResponseData;
        try {
            const menu = await this.menuService.getAllMenuPermissions(menuId)
            this.logger.log(`getMenuPermissionsById: ${JSON.stringify(menu)}`)
            output.data = menu
            output.message = `Menu with id : ${menuId} is successfully fetched`;
        } catch (error) {
            this.logger.warn(`getMenuPermissionsById: ${JSON.stringify(error)}`)
            output.status = false;
            output.message = error
        }
        return output;
    }


    @ApiOperation({ summary: 'Update menu By Id' })
    @ApiCreatedResponse({
        description: 'Update menu By Id',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Patch('update/:id')
    async editmenu(@Param('id', ParseIntPipe) id: number, @Body() body: any, @UserData() user: any) {
        this.logger.log(`editmenubody: ${JSON.stringify(body)}`)
        let output = new ResponseData
        try {
            let menu = await this.menuService.updateMenu(id, body, user);
            this.logger.log(`editmenu: ${JSON.stringify(menu)}`)

            if (!menu) {
                this.logger.log(`editmenu!!: ${JSON.stringify(menu)}`)
                throw 'Something went wrong'
            } else {
                this.logger.log(`editmenuelse: ${menu}`)
            }
            output.data = menu;
            output.message = `Menu with id : ${id} is successfully updated`;
        } catch (error) {
            this.logger.warn(`editmenuerror: ${JSON.stringify(error), error}`)
            output.status = false;
            // Handle error message based on the type of error
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                this.logger.warn(`editmenubadrequest: ${error}`)
                output.message = error.message;
            } else {
                output.message = error;
            }
        }
        this.logger.log(`editmenumessage: ${output.message}`)
        return output
    }



    @ApiOperation({ summary: 'Delete menu By Id' })
    @ApiCreatedResponse({
        description: 'Delete menu By Id',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Delete('delete/:id')
    async softDelete(@Param('id', ParseIntPipe) id: number) {
        return this.menuService.softDelete(id);
    }



    @ApiOperation({ summary: 'Search List of Menus' })
    @ApiCreatedResponse({
        description: 'Search List of Menus',
        type: ResponseData,
    })
    @HttpCode(HttpStatus.OK)
    @Post('search-list')
    async searchMenuNew(@Body() searchParams: filterDto) {
        const resp = new ResponseData();
        try {
            const res = await this.menuService.searchList(searchParams);
            this.logger.log(`Menu Search Data: ${JSON.stringify(res)}`);
            resp.data = res;
            resp.message = 'Menu Search is successfully fetched';
        } catch (error) {
            this.logger.warn(`Search Menu Error: ${error}`);
            resp.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                resp.message = error.message;
            } else {
                resp.message = 'Internal Server Error';
            }
        }
        return resp;
    }

    @ApiOperation({ summary: 'Get Menu By Module Id' })
    @ApiCreatedResponse({
        description: 'Get Menu By Module Id',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Get('fetchByModule/:ModuleMasterSid')
    async getMenuByModuleId(@Param('ModuleMasterSid', ParseIntPipe) moduleId: number) {
        const output = new ResponseData;
        try {
            this.logger.log(`Getting Menus with Module Id : ${moduleId}`)
            const menu = await this.menuService.getMenusByModule(moduleId)
            this.logger.debug(`getMenusByModuleId: ${JSON.stringify(menu)}`)
            output.data = menu
            output.message = `Menus with Module Id : ${moduleId} are successfully fetched`
        } catch (error) {
            this.logger.warn(`getMenusByModuleId: ${JSON.stringify(error)}`)
            output.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                output.message = error.message
            } else {
                output.message = "Internal Server Error"
            }
        }
        return output;
    }


    @Post('fetchByModules')
async getMenusByModuleIds(@Body() body: { moduleIds: number[] }) {
  const output = new ResponseData();
  try {
    const { moduleIds } = body;
    
    if (!moduleIds || !Array.isArray(moduleIds) || moduleIds.length === 0) {
      throw new BadRequestException('moduleIds array is required and cannot be empty');
    }

    this.logger.log(`Getting Menus with Module Ids: ${moduleIds.join(', ')}`);
    const menus = await this.menuService.getMenusByModules(moduleIds);
    this.logger.debug(`getMenusByModuleIds: ${JSON.stringify(menus)}`);
    
    output.data = menus;
    output.message = `Menus for ${moduleIds.length} module(s) successfully fetched`;
  } catch (error) {
    this.logger.warn(`getMenusByModuleIds: ${JSON.stringify(error)}`);
    output.status = false;
    if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
      output.message = error.message;
    } else {
      output.message = "Internal Server Error";
    }
  }
  return output;
}


    @ApiOperation({ summary: 'Get Sub Menus' })
    @ApiCreatedResponse({
        description: 'Get sub menus',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Get('sub-menu/list/:ModuleMasterSid')
    async getSubMenuList(@Param('ModuleMasterSid', ParseIntPipe) moduleId: number) {
        const output = new ResponseData;
        try {
            const menu = await this.menuService.getSubMenuList(moduleId)
            this.logger.log(`getSubMenuList: ${JSON.stringify(menu)}`)
            output.data = menu
        } catch (error) {
            this.logger.warn(`getSubMenuList: ${JSON.stringify(error)}`)
            output.status = false;
            output.message = error
        }
        return output;
    }

}
