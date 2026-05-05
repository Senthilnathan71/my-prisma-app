import { BadRequestException, Body, Controller, Delete, Get, HttpCode, HttpStatus, Logger, Param, ParseIntPipe, Patch, Post, UnauthorizedException } from '@nestjs/common';
import { ApiCreatedResponse, ApiOperation } from '@nestjs/swagger';
import { Auth } from 'src/common/decorators/auth.decorator';
import { ResponseData } from 'src/common/response-data';
import { SearchListDto } from 'src/masters/DTO/search-list.dto';
import { filterDto } from 'src/masters/DTO/search-vessel.dto';
import { TaxGroupService } from 'src/masters/services/tax-group/tax-group.service';

@Auth()
@Controller('tax-group')
export class TaxGroupController {
        constructor(private TaxGroupService:TaxGroupService, private logger: Logger) { }


    @ApiOperation({ summary: 'Create new Tax-Group' })
    @ApiCreatedResponse({
        description: 'Create new Tax-Group',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Post('create')
    async createNewTaxGroup(@Body() newData: any) {
        let resp = new ResponseData();
        try {
            let res = await this.TaxGroupService.createNewTaxGroup(newData);
            this.logger.log(`New Tax-Group Created : ${JSON.stringify(res)}`);
            resp.data = res;
            resp.message = "New Tax-Group is successfully created"
        } catch (error) {
            this.logger.warn(`Tax-Group Creation Error : ${JSON.stringify(error), error}`);
            resp.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                resp.message = error.message;
            } else {
                resp.message = "Internal Server Error";
            }
        }
        return resp;
    }



    @ApiOperation({ summary: 'Get All Tax-Group' })
    @ApiCreatedResponse({
        description: 'Get All Tax-Group',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Get()
    async getAllTaxGroup() {
        let resp = new ResponseData();
        try {
            let res = await this.TaxGroupService.getAllTaxGroup();
            this.logger.log(`All Tax-Group Fetched : ${JSON.stringify(res)}`);
            resp.data = res;
            resp.message = "All Tax-Group are successfully fetched";
        } catch (error) {
            this.logger.warn(`Get All Tax-Group Error : ${JSON.stringify(error), error}`);
            resp.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                resp.message = error.message;
            } else {
                resp.message = "Internal Server Error";
            }
        }
        return resp;
    }



    @ApiOperation({ summary: 'Get Tax-Group by Id' })
    @ApiCreatedResponse({
        description: 'Get Tax-Group by Id',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Get('fetch/:TaxGroupSid')
    async getTaxGroupById(@Param('TaxGroupSid', ParseIntPipe) TaxGroupSid: number) {
        let resp = new ResponseData();
        try {
            this.logger.log(`Getting Tax-Group with id : ${TaxGroupSid}`);
            let res = await this.TaxGroupService.fetchTaxGroupById(TaxGroupSid);
            this.logger.debug(`Fetched Tax-Group : ${JSON.stringify(res)}`);
            resp.data = res;
            resp.message = `Tax-Group with id : ${TaxGroupSid} is successfully fetched`;
        } catch (error) {
            this.logger.warn(`Get Tax-Group by Id Error : ${JSON.stringify(error), error}`);
            resp.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                resp.message = error.message;
            } else {
                resp.message = "Internal Server Error";
            }
        }
        return resp;
    }



    @ApiOperation({ summary: 'Update Tax-Group by Id' })
    @ApiCreatedResponse({
        description: 'Update Tax-Group by Id',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Patch('update/:TaxGroupSid')
    async updateTaxGroupById(@Param('TaxGroupSid', ParseIntPipe) TaxGroupSid: number, @Body() payload: any) {
        let resp = new ResponseData();
        try {
            this.logger.log(`Updating Tax-Group with id : ${TaxGroupSid}`);
            let res = await this.TaxGroupService.updateTaxGroupById(TaxGroupSid, payload);
            this.logger.debug(`Updated Tax-Group : ${JSON.stringify(res)}`);
            resp.data = res;
            resp.message = `Tax-Group with id : ${TaxGroupSid} is successfully updated`;
        } catch (error) {
            this.logger.warn(`Tax-Group Updation Error : ${JSON.stringify(error), error}`);
            resp.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                resp.message = error.message;
            } else {
                resp.message = "Internal Server Error";
            }
        }
        return resp;
    }



    @ApiOperation({ summary: 'Delete Tax-Group by Id' })
    @ApiCreatedResponse({
        description: 'Delete Tax-Group by Id',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Delete('delete/:TaxGroupSid')
    async deleteTaxGroupById(@Param('TaxGroupSid', ParseIntPipe) TaxGroupSid: number) {
        let resp = new ResponseData();
        try {
            this.logger.log(`Deleting Tax-Group with id : ${TaxGroupSid}`);
            let res = await this.TaxGroupService.deleteTaxGroup(TaxGroupSid);
            this.logger.debug(`Deleted Tax-Group : ${JSON.stringify(res)}`);
            resp.data = res;
            resp.message = `Tax-Group with id : ${TaxGroupSid} is successfully deleted`;
        } catch (error) {
            this.logger.warn(`Tax-Group Deletion Error : ${JSON.stringify(error), error}`);
            resp.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                resp.message = error.message;
            } else {
                resp.message = "Internal Server Error";
            }
        }
        return resp;
    }



    @ApiOperation({ summary: 'Search List of Tax-Group' })
    @ApiCreatedResponse({
        description: 'Search List of Tax-Group',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Post('search-list')
    async searchTaxGroupMaster(@Body() searchData: filterDto) {
        let resp = new ResponseData();
        try {
            let res = await this.TaxGroupService.searchTaxGroupMaster(searchData);
            this.logger.log(`Tax-Group Search Results :${JSON.stringify(res)}`);
            resp.data = res;
            resp.message = "Tax-Group Search results are successfully fetched"
        } catch (error) {
            this.logger.warn(`Tax-Group Search Error : ${JSON.stringify(error), error}`);
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
