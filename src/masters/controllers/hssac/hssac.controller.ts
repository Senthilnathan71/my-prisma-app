import { BadRequestException, Body, Controller, Delete, Get, HttpCode, HttpStatus, Logger, Param, ParseIntPipe, Patch, Post, UnauthorizedException } from '@nestjs/common';
import { ApiOperation, ApiCreatedResponse } from '@nestjs/swagger';
import { UserData } from 'src/common/decorators/user.decorator';
import { ResponseData } from 'src/common/response-data';
import { SearchListDto } from 'src/masters/DTO/search-list.dto';
import { HssacService } from 'src/masters/services/hssac/hssac.service';

@Controller('hssac')
export class HssacController {
    constructor(private hssacService: HssacService, private logger: Logger) { }

    @ApiOperation({ summary: 'Hssac Creation' })
    @ApiCreatedResponse({
        description: 'Hssac Creation',
        type: ResponseData
    })
    @HttpCode(HttpStatus.CREATED)
    @Post('create')
    async createHssac(@Body() body: any, @UserData() user: any) {
        this.logger.log(`createHssacdata: ${JSON.stringify(body)}`)
        let output = new ResponseData
        try {
            let Hssac = await this.hssacService.createHssac(body, user);
            this.logger.debug(`createHssac: ${JSON.stringify(Hssac)}`)
            if (!Hssac) {
                this.logger.warn(`createHssac!!: ${JSON.stringify(Hssac)}`)
                throw 'Something went wrong'
            }
            output.data = Hssac
            output.message = 'Hssac Created Successfully'
        } catch (error) {
            this.logger.warn(`createHssacError: ${error}`)
            output.status = false;
            // Handle error message based on the type of error
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                output.message = error.message;
                this.logger.warn(`createHssacError: ${error.message}`)
            } else {
                this.logger.warn(`createHssacError: ${error}`)
                output.message = error;
            }
        }
        return output
    }


    @ApiOperation({ summary: 'Get All Hssac' })
    @ApiCreatedResponse({
        description: 'Get All Hssac',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Get()
    async getAllHssac() {
        let output = new ResponseData;
        try {
            let HssacData = await this.hssacService.getAllHssac();
            this.logger.log(`getAllHssac: ${JSON.stringify(HssacData)}`)
            output.data = HssacData;
        } catch (error) {
            this.logger.warn(`getAllHssac: ${JSON.stringify(error)}`)
            output.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                output.message = error.message;
            } else {
                output.message = 'Internal Server Error';
            }
        }
        return output
    }



    @ApiOperation({ summary: 'Get Hssac By Id' })
    @ApiCreatedResponse({
        description: 'Get Hssac By Id',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Get('fetch/:id')
    async getHssacById(@Param('id', ParseIntPipe) HssacId: number) {
        const output = new ResponseData;
        try {
            const Hssac = await this.hssacService.findOne(HssacId)
            this.logger.log(`getHssacById: ${JSON.stringify(Hssac)}`)
            output.data = Hssac
        } catch (error) {
            this.logger.warn(`getHssacById: ${JSON.stringify(error)}`)
            output.status = false;
            output.message = error
        }
        return output;
    }


    @ApiOperation({ summary: 'Update Hssac By Id' })
    @ApiCreatedResponse({
        description: 'Update Hssac By Id',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Patch('update/:id')
    async editHssac(@Param('id', ParseIntPipe) id: number, @Body() body: any, @UserData() user: any) {
        this.logger.log(`editHssacbody: ${JSON.stringify(body)}`)
        let output = new ResponseData
        try {
            let Hssac = await this.hssacService.updateHssac(id, body, user);
            this.logger.log(`editHssac: ${JSON.stringify(Hssac)}`)

            if (!Hssac) {
                this.logger.log(`editHssac!!: ${JSON.stringify(Hssac)}`)
                throw 'Something went wrong'
            } else {
                this.logger.log(`editHssacelse: ${Hssac}`)
            }
            output.data = Hssac;
            output.message = 'Hssac Updated Successfully'
        } catch (error) {
            this.logger.warn(`editHssacerror: ${JSON.stringify(error), error}`)
            output.status = false;
            // Handle error message based on the type of error
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                this.logger.warn(`editHssacbadrequest: ${error}`)
                output.message = error.message;
            } else {
                output.message = error;
            }
        }
        this.logger.log(`editHssacmessage: ${output.message}`)
        return output
    }



    @ApiOperation({ summary: 'Delete Hssac By Id' })
    @ApiCreatedResponse({
        description: 'Delete Hssac By Id',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Delete('delete/:id')
    async softDelete(@Param('id', ParseIntPipe) id: number) {
        return this.hssacService.softDelete(id);
    }



    @ApiOperation({ summary: 'Search List of Hssac' })
    @ApiCreatedResponse({
        description: 'Search List',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Post('search-list')
    async searchHssac(@Body() body: SearchListDto) {
        let output = new ResponseData;
        try {
            this.logger.log(`searchHssac: ${JSON.stringify(body)}`)
            const HssacList = await this.hssacService.searchList(body);
            output.data = HssacList
            output.message = "Hssac List fetched Successfully"
        } catch (err) {
            output.status = false;
            this.logger.warn(`searchHssac: ${JSON.stringify(err)}`)
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
