import { BadRequestException, Body, Controller, Delete, Get, HttpCode, HttpStatus, Logger, Param, ParseIntPipe, Patch, Post, Query, UnauthorizedException } from '@nestjs/common';
import { ApiCreatedResponse, ApiOperation } from '@nestjs/swagger';
import { ResponseData } from 'src/common/response-data';
import { SearchListDto } from 'src/masters/DTO/search-list.dto';
import { filterDto } from 'src/masters/DTO/search-vessel.dto';
import { FfUserMasterService } from 'src/masters/services/ff-user-master/ff-user-master.service';
class CompanyIdDto {
    CompanyMasterSid: number;
}

@Controller('ff-user')
export class FfUserMasterController {
    constructor(private ffUserMasterService: FfUserMasterService, private logger: Logger) { }


    @ApiOperation({ summary: 'Create new User' })
    @ApiCreatedResponse({
        description: 'Create new User',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Post('create')
    async createNewUser(@Body() newData: any) {
        let resp = new ResponseData();
        try {
            let res = await this.ffUserMasterService.createNewFfUser(newData);
            this.logger.log(`New User Created : ${JSON.stringify(res)}`);
            const userName = newData?.userName || 'User';
            resp.data = res;
            resp.message = `User ${userName} is successfully created`;
        } catch (error) {
            this.logger.warn(`User Creation Error : ${JSON.stringify(error), error}`);
            resp.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                resp.message = error.message;
            } else {
                resp.message = "Internal Server Error";
            }
        }
        return resp;
    }

    @ApiOperation({ summary: 'Get All Docs' })
    @ApiCreatedResponse({
        description: 'Get All Docs',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Post('docs')
    async getAllDocs(@Body() body: CompanyIdDto) {
        let resp = new ResponseData();
        try {
            let res = await this.ffUserMasterService.getAllDocs(body.CompanyMasterSid);
            this.logger.log(`All Docs Fetched : ${JSON.stringify(res)}`);
            resp.data = res;
            resp.message = "All Docs are successfully fetched";
        } catch (error) {
            this.logger.warn(`Get All Docs Error : ${JSON.stringify(error), error}`);
            resp.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                resp.message = error.message;
            } else {
                resp.message = "Internal Server Error";
            }
        }
        return resp;
    }

    @ApiOperation({ summary: 'Get All CS' })
    @ApiCreatedResponse({
        description: 'Get All CS',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Post('cs')
    async getAllCS(@Body() body: CompanyIdDto) {
        let resp = new ResponseData();
        try {
            let res = await this.ffUserMasterService.getAllCS(body.CompanyMasterSid);
            this.logger.log(`All CS Fetched : ${JSON.stringify(res)}`);
            resp.data = res;
            resp.message = "All CS are successfully fetched";
        } catch (error) {
            this.logger.warn(`Get All CS Error : ${JSON.stringify(error), error}`);
            resp.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                resp.message = error.message;
            } else {
                resp.message = "Internal Server Error";
            }
        }
        return resp;
    }


    @ApiOperation({ summary: 'Get All User' })
    @ApiCreatedResponse({
        description: 'Get All User',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Get()
    async getAllUser() {
        let resp = new ResponseData();
        try {
            let res = await this.ffUserMasterService.getAllFfUser();
            this.logger.log(`All User Fetched : ${JSON.stringify(res)}`);
            resp.data = res;
            resp.message = "All User are successfully fetched";
        } catch (error) {
            this.logger.warn(`Get All User Error : ${JSON.stringify(error), error}`);
            resp.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                resp.message = error.message;
            } else {
                resp.message = "Internal Server Error";
            }
        }
        return resp;
    }



    @ApiOperation({ summary: 'Get User by Id' })
    @ApiCreatedResponse({
        description: 'Get User by Id',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Get('fetch/:UserMasterSid')
    async getUserById(@Param('UserMasterSid', ParseIntPipe) UserMasterSid: number) {
        let resp = new ResponseData();
        try {
            this.logger.log(`Getting User with id : ${UserMasterSid}`);
            let res = await this.ffUserMasterService.fetchFfUserById(UserMasterSid);
            this.logger.debug(`Fetched ffUser : ${JSON.stringify(res)}`);
            resp.data = res;
            resp.message = `User with id : ${UserMasterSid} is successfully fetched`;
        } catch (error) {
            this.logger.warn(`Get User by Id Error : ${JSON.stringify(error), error}`);
            resp.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                resp.message = error.message;
            } else {
                resp.message = "Internal Server Error";
            }
        }
        return resp;
    }



    @ApiOperation({ summary: 'Update User by Id' })
    @ApiCreatedResponse({
        description: 'Update User by Id',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Patch('update/:UserMasterSid')
    async updateUserById(@Param('UserMasterSid', ParseIntPipe) UserMasterSid: number, @Body() payload: any) {
        let resp = new ResponseData();
        try {
            this.logger.log(`Updating User with id : ${UserMasterSid}`);
            let res = await this.ffUserMasterService.updateFfUserById(UserMasterSid, payload);
            this.logger.debug(`Updated User : ${JSON.stringify(res)}`);
            const userName = payload?.userName || 'User';
            resp.data = res;
            resp.message = `User ${userName} is successfully updated`;
        } catch (error) {
            this.logger.warn(`User Updation Error : ${JSON.stringify(error), error}`);
            resp.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                resp.message = error.message;
            } else {
                resp.message = "Internal Server Error";
            }
        }
        return resp;
    }



    @ApiOperation({ summary: 'Delete User by Id' })
    @ApiCreatedResponse({
        description: 'Delete User by Id',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Delete('delete/:UserMasterSid')
    async deleteUserById(@Param('UserMasterSid', ParseIntPipe) UserMasterSid: number) {
        let resp = new ResponseData();
        try {
            this.logger.log(`Deleting User with id : ${UserMasterSid}`);
            let res = await this.ffUserMasterService.deleteFfUser(UserMasterSid);
            this.logger.debug(`Deleted User : ${JSON.stringify(res)}`);
            resp.data = res;
            resp.message = `
            User with id : ${UserMasterSid} is successfully deleted`;
        } catch (error) {
            this.logger.warn(`User Deletion Error : ${JSON.stringify(error), error}`);
            resp.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                resp.message = error.message;
            } else {
                resp.message = "Internal Server Error";
            }
        }
        return resp;
    }



    @ApiOperation({ summary: 'Search List of User' })
    @ApiCreatedResponse({
        description: 'Search List of User',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Post('search-list')
    async searchUserNew(@Body() searchParams: filterDto) {
        const resp = new ResponseData();
        try {
            const res = await this.ffUserMasterService.searchFfUserNew(searchParams);
            this.logger.log(`User Search Results :${JSON.stringify(res)}`);
            resp.data = res;
            resp.message = "User Search results are successfully fetched"
        } catch (error) {
            this.logger.warn(`User Search Error : ${JSON.stringify(error), error}`);
            resp.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                resp.message = error.message;
            } else {
                resp.message = "Internal Server Error";
            }
        }
        return resp;
    }

    @ApiOperation({ summary: 'Get Audit Logs for a Table/Record' })
    @ApiCreatedResponse({ description: 'Fetch audit logs', type: ResponseData })
    @HttpCode(HttpStatus.OK)
    @Get('audit-logs')
    async getAuditLogs(
        @Query('tableName') tableName: string,
        @Query('recordId') recordId?: string,
    ) {
        const resp = new ResponseData();
        try {
            if (!tableName) throw new Error('tableName query parameter is required');

            const logs = await this.ffUserMasterService.getAuditLogs(tableName, recordId);

            // Remove updatedOn from oldVal and newVal
            resp.data = logs.map((log: any) => {
                const oldVal = log.oldVal ? { ...log.oldVal } : null;
                const newVal = log.newVal ? { ...log.newVal } : null;
                if (oldVal && 'updatedOn' in oldVal) delete oldVal.updatedOn;
                if (newVal && 'updatedOn' in newVal) delete newVal.updatedOn;
                return { ...log, oldVal, newVal };
            });

            resp.message = 'Audit logs fetched successfully';
        } catch (error) {
            this.logger.warn(`getAuditLogsError: ${error}`);
            resp.status = false;
            resp.message = error.message || 'Internal Server Error';
        }
        return resp;
    }

    @ApiOperation({ summary: 'Reset User Password' })
    @ApiCreatedResponse({
        description: 'Reset User Password',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Post('reset/:id')
    async resetPassword(@Param('id', ParseIntPipe) UserMasterSid, @Body() payload: any) {
        let resp = new ResponseData();
        try {
            let res = await this.ffUserMasterService.resetPassword(UserMasterSid, payload);
            this.logger.log(`User Password Reset Results :${JSON.stringify(res)}`);
            resp.data = res;
            resp.message = "User Password Reset results are successfully fetched"
        } catch (error) {
            this.logger.warn(`User Password Reset Error : ${JSON.stringify(error), error}`);
            resp.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                resp.message = error.message;
            } else {
                resp.message = "Internal Server Error";
            }
        }
        return resp;
    }

    @ApiOperation({ summary: 'Get User Based on User Type' })
    @ApiCreatedResponse({
        description: 'Get User Based on User Type',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Get('user-type/:userType')
    async getUserBasedOnUserType(@Param('userType') userType: string) {
        let resp = new ResponseData();
        try {
            this.logger.log(`Getting User Based on User Type : ${userType}`);
            let res = await this.ffUserMasterService.getUserBasedOnUserType(userType);
            this.logger.debug(`Fetched ffUser : ${JSON.stringify(res)}`);
            resp.data = res;
            resp.message = `User Based on User Type : ${userType} is successfully fetched`;
        } catch (error) {
            this.logger.warn(`Get User Based on User Type Error : ${JSON.stringify(error), error}`);
            resp.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                resp.message = error.message;
            } else {
                resp.message = "Internal Server Error";
            }
        }
        return resp;
    }

    @ApiOperation({ summary: 'Get All Salesperson' })
    @ApiCreatedResponse({
        description: 'Get All Salesperson',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Post('salesperson')
    async getAllSalesperson(@Body() body: CompanyIdDto) {
        let resp = new ResponseData();
        try {
            this.logger.log(`Getting All Salesperson`);
            let res = await this.ffUserMasterService.getAllSalesperson(body.CompanyMasterSid);
            this.logger.debug(`Fetched ffUser : ${JSON.stringify(res)}`);
            resp.data = res;
            resp.message = "All Salesperson are successfully fetched";
        } catch (error) {
            this.logger.warn(`Get All Salesperson Error : ${JSON.stringify(error), error}`);
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
