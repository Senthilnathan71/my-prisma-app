import { BadRequestException, Body, Controller, Delete, Get, HttpCode, HttpStatus, Logger, Param, ParseIntPipe, Patch, Post, UnauthorizedException } from '@nestjs/common';
import { ApiCreatedResponse, ApiOperation } from '@nestjs/swagger';
import { CoaService } from 'src/accounts/services/coa/coa.service';
import { Auth } from 'src/common/decorators/auth.decorator';
import { UserData } from 'src/common/decorators/user.decorator';
import { ResponseData } from 'src/common/response-data';
import { SearchVesselDto } from 'src/masters/DTO/search-vessel.dto';


@Controller('coa')
@Auth()
export class CoaController {
    constructor(private coaService: CoaService, private logger: Logger) { }


    @ApiOperation({ summary: 'Create new Coa' })
    @ApiCreatedResponse({
        description: 'Create new Coa',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Post('create')
    async createNewCoa(@Body() newData: any,@UserData() user:any) {
        let resp = new ResponseData();
        console.log(user);
        try {
            let res = await this.coaService.createNewCoa(newData,user);
            this.logger.log(`New Coa Created : ${JSON.stringify(res)}`);
            resp.data = res;
            resp.message = "New Coa is successfully created"
        } catch (error) {
            this.logger.warn(`Coa Creation Error : ${JSON.stringify(error), error}`);
            resp.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                resp.message = error.message;
            } else {
                resp.message = "Internal Server Error";
            }
        }
        return resp;
    }



    @ApiOperation({ summary: 'Get All Coa' })
    @ApiCreatedResponse({
        description: 'Get All Coa',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Get()
    async getAllCoa(@UserData() user:any) {
        let resp = new ResponseData();
        try {
            let res = await this.coaService.getAllCoa(user);
            this.logger.log(`All Coa Fetched : ${JSON.stringify(res)}`);
            resp.data = res;
            resp.message = "All Coa are successfully fetched";
        } catch (error) {
            this.logger.warn(`Get All Coa Error : ${JSON.stringify(error), error}`);
            resp.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                resp.message = error.message;
            } else {
                resp.message = "Internal Server Error";
            }
        }
        return resp;
    }



    @ApiOperation({ summary: 'Get Coa by Id' })
    @ApiCreatedResponse({
        description: 'Get Coa by Id',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Get('fetch/:COAMasterSid')
    async getCoaById(@Param('COAMasterSid', ParseIntPipe) COAMasterSid: number,@UserData() user:any) {
        let resp = new ResponseData();
        try {
            this.logger.log(`Getting Coa with id : ${COAMasterSid}`);
            let res = await this.coaService.fetchCoaById(COAMasterSid,user);
            this.logger.debug(`Fetched Coa : ${JSON.stringify(res)}`);
            resp.data = res;
            resp.message = `Coa with id : ${COAMasterSid} is successfully fetched`;
        } catch (error) {
            this.logger.warn(`Get Coa by Id Error : ${JSON.stringify(error), error}`);
            resp.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                resp.message = error.message;
            } else {
                resp.message = "Internal Server Error";
            }
        }
        return resp;
    }



    @ApiOperation({ summary: 'Update Coa by Id' })
    @ApiCreatedResponse({
        description: 'Update Coa by Id',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Patch('update/:COAMasterSid')
    async updateCoaById(@Param('COAMasterSid', ParseIntPipe) COAMasterSid: number, @Body() payload: any,@UserData() user:any) {
        let resp = new ResponseData();
        try {
            this.logger.log(`Updating Coa with id : ${COAMasterSid}`);
            let res = await this.coaService.updateCoaById(COAMasterSid, payload,user);
            this.logger.debug(`Updated Coa : ${JSON.stringify(res)}`);
            resp.data = res;
            resp.message = `Coa with id : ${COAMasterSid} is successfully updated`;
        } catch (error) {
            this.logger.warn(`Coa Updation Error : ${JSON.stringify(error), error}`);
            resp.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                resp.message = error.message;
            } else {
                resp.message = "Internal Server Error";
            }
        }
        return resp;
    }



    // @ApiOperation({ summary: 'Delete Coa by Id' })
    // @ApiCreatedResponse({
    //     description: 'Delete Coa by Id',
    //     type: ResponseData
    // })
    // @HttpCode(HttpStatus.OK)
    // @Delete('delete/:COAMasterSid')
    // async deleteCoaById(@Param('COAMasterSid', ParseIntPipe) COAMasterSid: number) {
    //     let resp = new ResponseData();
    //     try {
    //         this.logger.log(`Deleting Coa with id : ${COAMasterSid}`);
    //         let res = await this.coaService.deleteCoa(COAMasterSid);
    //         this.logger.debug(`Deleted Coa : ${JSON.stringify(res)}`);
    //         resp.data = res;
    //         resp.message = `Coa with id : ${COAMasterSid} is successfully deleted`;
    //     } catch (error) {
    //         this.logger.warn(`Coa Deletion Error : ${JSON.stringify(error), error}`);
    //         resp.status = false;
    //         if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
    //             resp.message = error.message;
    //         } else {
    //             resp.message = "Internal Server Error";
    //         }
    //     }
    //     return resp;
    // }



    @ApiOperation({ summary: 'Search List of Coa' })
    @ApiCreatedResponse({
        description: 'Search List of Coa',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Post('search-list')
    async searchCoa(@Body() searchData: SearchVesselDto,@UserData() user:any) {
        let resp = new ResponseData();
        try {
            let res = await this.coaService.searchCoa(searchData,user);
            this.logger.log(`Coa Search Results :${JSON.stringify(res)}`);
            resp.data = res;
            resp.message = "Coa Search results are successfully fetched"
        } catch (error) {
            this.logger.warn(`Coa Search Error : ${JSON.stringify(error), error}`);
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
