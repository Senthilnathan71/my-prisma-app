import { BadRequestException, Body, Controller, Delete, Get, HttpCode, HttpStatus, Logger, Param, ParseIntPipe, Patch, Post, UnauthorizedException } from '@nestjs/common';
import { ApiCreatedResponse, ApiOperation } from '@nestjs/swagger';
import { ResponseData } from 'src/common/response-data';
import { SearchListDto } from 'src/masters/DTO/search-list.dto';
import { ChargeGroupService } from 'src/masters/services/charge-group/charge-group.service';


@Controller('charge-group')
export class ChargeGroupController {
    constructor(private chargeGroupService: ChargeGroupService, private logger: Logger) { }

    @ApiOperation({ summary: 'Create new Charge Group' })
    @ApiCreatedResponse({
        description: 'Create new Charge Group',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Post('create')
    async createNewChargeGroup(@Body() newData: any) {
        let resp = new ResponseData();
        try {
            let res = await this.chargeGroupService.createNewChargeGroup(newData);
            this.logger.log(`New Charge Group Created: ${JSON.stringify(res)}`);
            resp.data = res;
            resp.message = "New charge group is successfully created";
        } catch (error) {
            this.logger.warn(`Create new Charge Group Error: ${error}`);
            resp.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                resp.message = error.message;
            } else {
                resp.message = "Internal Server Error";
            }
        }
        return resp;
    }

    @ApiOperation({ summary: 'Get All Charge Groups' })
    @ApiCreatedResponse({
        description: 'Get All Charge Groups',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Get()
    async getAllChargeGroups() {
        let resp = new ResponseData();
        try {
            let res = await this.chargeGroupService.getAllChargeGroups();
            this.logger.log(`All Charge Groups Data: ${JSON.stringify(res)}`);
            resp.data = res;
            resp.message = "All charge groups are successfully fetched";
        } catch (error) {
            this.logger.warn(`Fetching All Charge Groups Error: ${JSON.stringify(error)}`);
            resp.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                resp.message = error.message;
            } else {
                resp.message = "Internal Server Error";
            }
        }
        return resp;
    }

    @ApiOperation({ summary: 'Get Charge Group by Id' })
    @ApiCreatedResponse({
        description: 'Get Charge Group by Id',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Get('fetch/:ChargeGroupSid')
    async getChargeGroupById(@Param('ChargeGroupSid', ParseIntPipe) ChargeGroupSid: number) {
        let resp = new ResponseData();
        try {
            this.logger.log(`Getting Charge Group with id: ${ChargeGroupSid}`);
            let res = await this.chargeGroupService.getChargeGroupById(ChargeGroupSid);
            this.logger.debug(`Fetched Charge Group: ${JSON.stringify(res)}`);
            resp.data = res;
            resp.message = `Charge group with id: ${ChargeGroupSid} is successfully fetched`;
        } catch (error) {
            this.logger.warn(`Get Charge Group By Id Error: ${JSON.stringify(error)}`);
            resp.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                resp.message = error.message;
            } else {
                resp.message = "Internal Server Error";
            }
        }
        return resp;
    }

    @ApiOperation({ summary: "Updating Charge Group by Id" })
    @ApiCreatedResponse({
        description: "Update Charge Group by Id",
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Patch('update/:ChargeGroupSid')
    async updateChargeGroupById(@Param('ChargeGroupSid', ParseIntPipe) ChargeGroupSid: number, @Body() updateData: any) {
        let resp = new ResponseData();
        try {
            this.logger.log(`Updating Charge Group with id: ${ChargeGroupSid}`);
            let res = await this.chargeGroupService.updateChargeGroupById(ChargeGroupSid, updateData);
            this.logger.debug(`Updated Data: ${JSON.stringify(res)}`);
            resp.data = res;
            resp.message = `Charge group with id: ${ChargeGroupSid} is successfully updated`;
        } catch (error) {
            this.logger.warn(`Charge Group Update Error: ${JSON.stringify(error)}`);
            resp.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                resp.message = error.message;
            } else {
                resp.message = "Internal Server Error";
            }
        }
        return resp;
    }

    @ApiOperation({ summary: "Delete Charge Group by Id" })
    @ApiCreatedResponse({
        description: "Delete Charge Group by Id",
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Delete('delete/:ChargeGroupSid')
    async deleteChargeGroupById(@Param('ChargeGroupSid', ParseIntPipe) ChargeGroupSid: number) {
        let resp = new ResponseData();
        try {
            this.logger.log(`Deleting Charge Group with id: ${ChargeGroupSid}`);
            let res = await this.chargeGroupService.deleteChargeGroupById(ChargeGroupSid);
            this.logger.debug(`Deleted Data: ${JSON.stringify(res)}`);
            resp.data = res;
            resp.message = `Charge group with id: ${ChargeGroupSid} is successfully deleted`;
        } catch (error) {
            this.logger.warn(`Charge Group Deletion Error: ${JSON.stringify(error)}`);
            resp.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                resp.message = error.message;
            } else {
                resp.message = "Internal Server Error";
            }
        }
        return resp;
    }

    @ApiOperation({ summary: 'Search List of Charge Groups' })
    @ApiCreatedResponse({
        description: "Search List of Charge Groups",
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Post('search-list')
    async searchChargeGroups(@Body() body: SearchListDto) {
        let resp = new ResponseData();
        try {
            let res = await this.chargeGroupService.searchChargeGroups(body);
            this.logger.log(`Search Charge Groups results: ${JSON.stringify(res)}`);
            resp.data = res;
            resp.message = "Search Charge Groups is successfully fetched";
        } catch (error) {
            this.logger.warn(`Search Charge Groups Error: ${error}`);
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