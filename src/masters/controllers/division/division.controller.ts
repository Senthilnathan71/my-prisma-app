import { BadRequestException, Body, Controller, Delete, Get, HttpCode, HttpStatus, Logger, Param, ParseIntPipe, Patch, Post, UnauthorizedException } from '@nestjs/common';
import { ApiCreatedResponse, ApiOperation } from '@nestjs/swagger';
import { UserData } from 'src/common/decorators/user.decorator';
import { ResponseData } from 'src/common/response-data';
import { SearchListDto } from 'src/masters/DTO/search-list.dto';
import { SearchVesselDto } from 'src/masters/DTO/search-vessel.dto';
import { DivisionService } from 'src/masters/services/division/division.service';

@Controller('division')
export class DivisionController {
    constructor(private divisionService: DivisionService, private logger: Logger) { }

    @ApiOperation({ summary: 'Create new Division' })
    @ApiCreatedResponse({
        description: 'Create New Division',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Post('create')
    async createNewDivision(@Body() body: any,@UserData() user: any) {
        this.logger.log(`createNewDivision: ${JSON.stringify(body)}`)
        let resp = new ResponseData();
        try {
            let res = await this.divisionService.createNewDivision(body, user);
            this.logger.log(`New Division Created : ${JSON.stringify(res)}`);
            resp.data = res;
            resp.message = "New Division is successfully created"
        } catch (error) {
            this.logger.warn(`Create Division Error : ${JSON.stringify(error), error}`);
            resp.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                resp.message = error.message
            } else {
                resp.message = "Internal Server Error";
            }
        }
        return resp;
    }

    @ApiOperation({ summary: 'Get All Divisions' })
    @ApiCreatedResponse({
        description: 'Get All Divisions',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Get()
    async getAllDivisions() {
        let resp = new ResponseData();
        try {
            let res = await this.divisionService.getAllDivisions();
            this.logger.log(`getAllDivision Data :${JSON.stringify(res)}`);
            resp.data = res;
            resp.message = "All Divisions are fetched";
        } catch (error) {
            this.logger.warn(`Get All Divisions Error: ${JSON.stringify(error)}`);
            resp.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                resp.message = error.message;
            } else {
                resp.message = "Internal Server Error";
            }
        }
        return resp;
    }

    @ApiOperation({ summary: 'Get Division By Id' })
    @ApiCreatedResponse({
        description: 'Get Division by Id',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Get('fetch/:DivisionMasterSid')
    async getDivisionById(@Param('DivisionMasterSid', ParseIntPipe) DivisionMasterSid: number) {
        let resp = new ResponseData();
        try {
            this.logger.log(`Getting Division with Id : ${DivisionMasterSid}`);
            let res = await this.divisionService.getDivisionById(DivisionMasterSid);
            this.logger.debug(`GetDivisionById Data : ${JSON.stringify(res)}`);
            resp.data = res;
            resp.message = `Division with Id : ${DivisionMasterSid} is fetched`
        } catch (error) {
            this.logger.warn(`Division Fetch By Id Error: ${JSON.stringify(error)}`);
            resp.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                resp.message = error.message;
            } else {
                resp.message = "Internal Server Error";
            }
        }
        return resp;
    }

    @ApiOperation({ summary: 'Update Division By Id' })
    @ApiCreatedResponse({
        description: "Update Division By Id",
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Patch('update/:DivisionMasterSid')
    async updateDivisionById(@Param('DivisionMasterSid', ParseIntPipe) DivisionMasterSid: number, @Body() body: any) {
        let resp = new ResponseData();
        try {
            this.logger.log(`Updating Division with Id : ${DivisionMasterSid}`);
            let res = await this.divisionService.editDivisionById(DivisionMasterSid, body);
            this.logger.debug(`Updated Division Data : ${JSON.stringify(res)}`);
            resp.data = res;
            resp.message = `Division with id : ${DivisionMasterSid} is successfully updated`
        } catch (error) {
            this.logger.warn(`Update Division By Id Error : ${JSON.stringify(error)}`);
            resp.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                resp.message = error.message;
            } else {
                resp.message = "Internal Server Error";
            }
        }
        return resp;
    }

    @ApiOperation({ summary: 'Deleting Division with Id' })
    @ApiCreatedResponse({
        description: 'Deleting Division by Id',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Delete('delete/:DivisionMasterSid')
    async deleteDivision(@Param('DivisionMasterSid', ParseIntPipe) DivisionMasterSid: number) {
        let resp = new ResponseData();
        try {
            this.logger.log(`Deleting Division with id : ${DivisionMasterSid}`);
            let res = await this.divisionService.softDeleteDivision(DivisionMasterSid);
            this.logger.debug(`Deleted Division : ${JSON.stringify(res)}`);
            resp.data = res;
            resp.message = "Division is successfully deleted"
        } catch (error) {
            this.logger.warn(`Division Delete Error : ${JSON.stringify(error)}`);
            resp.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                resp.message = error.message;
            } else {
                resp.message = "Internal Server Error";
            }
        }
        return resp;
    }

    @ApiOperation({ summary: 'Search List of Divisions' })
    @ApiCreatedResponse({
        description: 'Search List of Divisions',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Post("search-list")
    async searchDivision(@Body() seachParams: SearchVesselDto) {
        const resp = new ResponseData();
        try {
            const res = await this.divisionService.searchDivisionNew(seachParams);
            this.logger.log(`Division Search Result : ${JSON.stringify(res)}`);
            resp.data = res;
            resp.message = "Search Division is successfully fetched"
        } catch (error) {
            this.logger.warn(`Division Search Error ${error}`);
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
