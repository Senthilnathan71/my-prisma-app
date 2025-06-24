import { BadRequestException, Body, Controller, Delete, Get, HttpCode, HttpStatus, Logger, Param, ParseIntPipe, Patch, Post, UnauthorizedException } from '@nestjs/common';
import { ApiOperation, ApiCreatedResponse } from '@nestjs/swagger';
import { Auth } from 'src/common/decorators/auth.decorator';
import { UserData } from 'src/common/decorators/user.decorator';
import { ResponseData } from 'src/common/response-data';
import { SearchListDto } from 'src/masters/DTO/search-list.dto';
import { ModuleService } from 'src/masters/services/module/module.service';

@Controller('module')
@Auth()
export class ModuleController {
    constructor(private moduleService: ModuleService, private logger: Logger) { }

    @ApiOperation({ summary: 'module Creation' })
    @ApiCreatedResponse({
        description: 'module Creation',
        type: ResponseData
    })
    @HttpCode(HttpStatus.CREATED)
    @Post('create')
    async createmodule(@Body() body: any, @UserData() user: any) {
        this.logger.log(`createmoduledata: ${JSON.stringify(body)}`)
        let output = new ResponseData
        try {
            let module = await this.moduleService.createModule(body, user);
            this.logger.debug(`createmodule: ${JSON.stringify(module)}`)
            if (!module) {
                this.logger.warn(`createmodule!!: ${JSON.stringify(module)}`)
                throw 'Something went wrong'
            }
            output.data = module
            output.message = 'module Created Successfully'
        } catch (error) {
            this.logger.warn(`createmoduleError: ${error}`)
            output.status = false;
            // Handle error message based on the type of error
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                output.message = error.message;
                this.logger.warn(`createmoduleError: ${error.message}`)
            } else {
                this.logger.warn(`createmoduleError: ${error}`)
                output.message = error;
            }
        }
        return output
    }


    @ApiOperation({ summary: 'Get All Module' })
    @ApiCreatedResponse({
        description: 'Get All Modules',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Get()
    async getAllModules(@UserData() user: any) {
        let output = new ResponseData;
        try {
            let moduleData = await this.moduleService.getAllModules()
            this.logger.log(`getAllmodules: ${JSON.stringify(moduleData)}`)
            output.data = moduleData;
        } catch (error) {
            this.logger.warn(`getAllmodules: ${JSON.stringify(error)}`)
            output.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                output.message = error.message;
            } else {
                output.message = 'Internal Server Error';
            }
        }
        return output
    }


    @ApiOperation({ summary: 'Get All Modules with menus for navigation' })
    @ApiCreatedResponse({
        description: 'Get All Modules with menus for navigation',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Get('navigation-list')
    async getAllModulesAndMenus(@UserData() user: any) {
        let output = new ResponseData;
        console.log(user, 'userData')
        try {
            let moduleData
            if (user.userType.code === "admin") {
                moduleData = await this.moduleService.getAllModulesWithMenusAsRoutes();
            } else {
                moduleData = await this.moduleService.getModulesWithMenusByRoles(user)
            }
            this.logger.log(`getAllmodules: ${JSON.stringify(moduleData)}`)
            output.data = moduleData;
        } catch (error) {
            this.logger.warn(`getAllmodules: ${JSON.stringify(error)}`)
            output.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                output.message = error.message;
            } else {
                output.message = 'Internal Server Error';
            }
        }
        return output
    }


    @ApiOperation({ summary: 'Get Module By Id' })
    @ApiCreatedResponse({
        description: 'Get Module By Id',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Get('fetch/:id')
    async getModuleById(@Param('id', ParseIntPipe) moduleId: number) {
        const output = new ResponseData;
        try {
            const module = await this.moduleService.findOne(moduleId)
            this.logger.log(`getmoduleById: ${JSON.stringify(module)}`)
            output.data = module
        } catch (error) {
            this.logger.warn(`getmoduleById: ${JSON.stringify(error)}`)
            output.status = false;
            output.message = error
        }
        return output;
    }


    @ApiOperation({ summary: 'Update module By Id' })
    @ApiCreatedResponse({
        description: 'Update module By Id',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Patch('update/:id')
    async editModule(@Param('id', ParseIntPipe) id: number, @Body() body: any, @UserData() user: any) {
        this.logger.log(`editmodulebody: ${JSON.stringify(body)}`)
        let output = new ResponseData
        try {
            let module = await this.moduleService.updateModule(id, body, user);
            this.logger.log(`editmodule: ${JSON.stringify(module)}`)

            if (!module) {
                this.logger.log(`editmodule!!: ${JSON.stringify(module)}`)
                throw 'Something went wrong'
            } else {
                this.logger.log(`editmoduleelse: ${module}`)
            }
            output.data = module;
            output.message = 'module Updated Successfully'
        } catch (error) {
            this.logger.warn(`editmoduleerror: ${JSON.stringify(error), error}`)
            output.status = false;
            // Handle error message based on the type of error
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                this.logger.warn(`editmodulebadrequest: ${error}`)
                output.message = error.message;
            } else {
                output.message = error;
            }
        }
        this.logger.log(`editmodulemessage: ${output.message}`)
        return output
    }



    @ApiOperation({ summary: 'Delete module By Id' })
    @ApiCreatedResponse({
        description: 'Delete module By Id',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Delete('delete/:id')
    async softDelete(@Param('id', ParseIntPipe) id: number) {
        return this.moduleService.softDelete(id);
    }



    @ApiOperation({ summary: 'Search List of module' })
    @ApiCreatedResponse({
        description: 'Search List',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Post('search-list')
    async searchmodule(@Body() body: SearchListDto) {
        let output = new ResponseData;
        try {
            this.logger.log(`searchmodule: ${JSON.stringify(body)}`)
            const moduleList = await this.moduleService.searchList(body);
            output.data = moduleList
            output.message = "module List fetched Successfully"
        } catch (err) {
            output.status = false;
            this.logger.warn(`searchmodule: ${JSON.stringify(err)}`)
            output.status = false;
            if (err instanceof BadRequestException || err instanceof UnauthorizedException) {
                output.message = err.message;
            } else {
                output.message = 'Internal Server Error';
            }
        }
        return output
    }
}
