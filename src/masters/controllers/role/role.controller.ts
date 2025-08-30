import { BadRequestException, Body, Controller, Delete, Get, HttpCode, HttpStatus, Logger, Param, ParseIntPipe, Patch, Post, UnauthorizedException } from '@nestjs/common';
import { ApiOperation, ApiCreatedResponse } from '@nestjs/swagger';
import { UserData } from 'src/common/decorators/user.decorator';
import { ResponseData } from 'src/common/response-data';
import { SearchListDto } from 'src/masters/DTO/search-list.dto';
import { SearchVesselDto } from 'src/masters/DTO/search-vessel.dto';
import { RoleService } from 'src/masters/services/role/role.service';
class CompanyIdDto {
  CompanyMasterSid: number;
}
@Controller('role')
export class RoleController {
    constructor(private roleService: RoleService, private logger: Logger) { }

    @ApiOperation({ summary: 'role Creation' })
    @ApiCreatedResponse({
        description: 'role Creation',
        type: ResponseData
    })
    @HttpCode(HttpStatus.CREATED)
    @Post('create')
    async createRole(@Body() body: any, @UserData() user: any) {
        this.logger.log(`createroledata: ${JSON.stringify(body)}`)
        let output = new ResponseData
        try {
            let role = await this.roleService.createRole(body, user);
            this.logger.debug(`createrole: ${JSON.stringify(role)}`)
            if (!role) {
                this.logger.warn(`createrole!!: ${JSON.stringify(role)}`)
                throw 'Something went wrong'
            }
            output.data = role
            output.message = 'Role created successfully.'
        } catch (error) {
            this.logger.warn(`createroleError: ${error}`)
            output.status = false;
            // Handle error message based on the type of error
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                output.message = error.message;
                this.logger.warn(`createroleError: ${error.message}`)
            } else {
                this.logger.warn(`createroleError: ${error}`)
                output.message = error;
            }
        }
        return output
    }


    @ApiOperation({ summary: 'Get All role' })
    @ApiCreatedResponse({
        description: 'Get All roles',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Post()
    async getAllRoles(@Body() body: CompanyIdDto) {
        let output = new ResponseData;
        try {
            let roleData = await this.roleService.getAllRoles(body.CompanyMasterSid);
            this.logger.log(`getAllroles: ${JSON.stringify(roleData)}`)
            output.data = roleData;
            output.message = "All Role are successfully fetched";
        } catch (error) {
            this.logger.warn(`getAllroles: ${JSON.stringify(error)}`)
            output.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                output.message = error.message;
            } else {
                output.message = 'Internal Server Error';
            }
        }
        return output
    }


    @ApiOperation({ summary: 'Get role By Id' })
    @ApiCreatedResponse({
        description: 'Get role By Id',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Get('fetch/:id')
    async getRoleById(@Param('id', ParseIntPipe) roleId: number) {
        const output = new ResponseData;
        try {
            const role = await this.roleService.findOne(roleId)
            this.logger.log(`getroleById: ${JSON.stringify(role)}`)
            output.data = role;
            output.message = `Role with id : ${roleId} is successfully fetched`;
        } catch (error) {
            this.logger.warn(`getroleById: ${JSON.stringify(error)}`)
            output.status = false;
            output.message = error
        }
        return output;
    }


    @ApiOperation({ summary: 'Update role By Id' })
    @ApiCreatedResponse({
        description: 'Update role By Id',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Patch('update/:id')
    async editRole(@Param('id', ParseIntPipe) id: number, @Body() body: any, @UserData() user: any) {
        this.logger.log(`editrolebody: ${JSON.stringify(body)}`)
        let output = new ResponseData
        try {
            let role = await this.roleService.updateRole(id, body, user);
            this.logger.log(`editrole: ${JSON.stringify(role)}`)

            if (!role) {
                this.logger.log(`editrole!!: ${JSON.stringify(role)}`)
                throw 'Something went wrong'
            } else {
                this.logger.log(`editroleelse: ${role}`)
            }
            output.data = role;
            output.message = `Role with id : ${id} is successfully updated`;
        } catch (error) {
            this.logger.warn(`editroleerror: ${JSON.stringify(error), error}`)
            output.status = false;
            // Handle error message based on the type of error
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                this.logger.warn(`editrolebadrequest: ${error}`)
                output.message = error.message;
            } else {
                output.message = error;
            }
        }
        this.logger.log(`editrolemessage: ${output.message}`)
        return output
    }



    @ApiOperation({ summary: 'Delete role By Id' })
    @ApiCreatedResponse({
        description: 'Delete role By Id',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Delete('delete/:id')
    async softDelete(@Param('id', ParseIntPipe) id: number) {
        return this.roleService.softDelete(id);
    }



    @ApiOperation({ summary: 'Search List of Roles' })
@ApiCreatedResponse({
    description: 'Search List of Roles',
    type: ResponseData,
})
@HttpCode(HttpStatus.OK)
@Post('search-list')
async searchRoleNew(@Body() searchParams: SearchVesselDto) {
    const resp = new ResponseData();
    try {
        const res = await this.roleService.searchList(searchParams);
        this.logger.log(`Role Search Data: ${JSON.stringify(res)}`);
        resp.data = res;
        resp.message = 'Role Search is successfully fetched';
    } catch (error) {
        this.logger.warn(`Search Role Error: ${error}`);
        resp.status = false;
        if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
            resp.message = error.message;
        } else {
            resp.message = 'Internal Server Error';
        }
    }
    return resp;
}
}
