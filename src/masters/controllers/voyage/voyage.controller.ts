import { BadRequestException, Body, Controller, Delete, Get, HttpCode, HttpStatus, Logger, Param, ParseIntPipe, Patch, Post, UnauthorizedException } from '@nestjs/common';
import { ApiOperation, ApiCreatedResponse } from '@nestjs/swagger';
import { UserData } from 'src/common/decorators/user.decorator';
import { ResponseData } from 'src/common/response-data';
import { SearchListDto } from 'src/masters/DTO/search-list.dto';
import { VoyageService } from 'src/masters/services/voyage/voyage.service';

@Controller('voyage')
export class VoyageController {
    constructor(private voyageService: VoyageService, private logger: Logger) { }

    @ApiOperation({ summary: 'Voyage Creation' })
    @ApiCreatedResponse({
        description: 'Voyage Creation',
        type: ResponseData
    })
    @HttpCode(HttpStatus.CREATED)
    @Post('create')
    async createVoyage(@Body() body:any, @UserData() user: any) {
        this.logger.log(`createVoyagedata: ${JSON.stringify(body)}`)
        let output = new ResponseData
        try {
            let Voyage = await this.voyageService.createVoyage(body, user);
            this.logger.debug(`createVoyage: ${JSON.stringify(Voyage)}`)
            if (!Voyage) {
                this.logger.warn(`createVoyage!!: ${JSON.stringify(Voyage)}`)
                throw 'Something went wrong'
            }
            output.data = Voyage
        } catch (error) {
            this.logger.warn(`createVoyageError: ${error}`)
            output.status = false;
            // Handle error message based on the type of error
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                output.message = error.message;
                this.logger.warn(`createVoyageError: ${error.message}`)
            } else {
                this.logger.warn(`createVoyageError: ${error}`)
                output.message = error;
            }
        }
        return output
    }


    @ApiOperation({ summary: 'Get All Voyage' })
    @ApiCreatedResponse({
        description: 'Get All Voyages',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Get()
    async getAllVoyages() {
        let output = new ResponseData;
        try {
            let VoyageData = await this.voyageService.getAllVoyages();
            this.logger.log(`getAllVoyages: ${JSON.stringify(VoyageData)}`)
            output.data = VoyageData;
        } catch (error) {
            this.logger.warn(`getAllVoyages: ${JSON.stringify(error)}`)
            output.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                output.message = error.message;
            } else {
                output.message = 'Internal Server Error';
            }
        }
        return output
    }


    @ApiOperation({ summary: 'Get Voyage By Id' })
    @ApiCreatedResponse({
        description: 'Get Voyage By Id',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Get('fetch/:id')
    async getVoyageById(@Param('id', ParseIntPipe) VoyageId: number) {
        const output = new ResponseData;
        try {
            const Voyage = await this.voyageService.findOne(VoyageId)
            this.logger.log(`getVoyageById: ${JSON.stringify(Voyage)}`)
            output.data = Voyage
        } catch (error) {
            this.logger.warn(`getVoyageById: ${JSON.stringify(error)}`)
            output.status = false;
            output.message = error
        }
        return output;
    }


    @ApiOperation({ summary: 'Update Voyage By Id' })
    @ApiCreatedResponse({
        description: 'Update Voyage By Id',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Patch('update/:id')
    async editVoyage(@Param('id', ParseIntPipe) id: number, @Body() body: any, @UserData() user: any) {
        this.logger.log(`editVoyagebody: ${JSON.stringify(body)}`)
        let output = new ResponseData
        try {
            let Voyage = await this.voyageService.updateVoyage(id, body, user);
            this.logger.log(`editVoyage: ${JSON.stringify(Voyage)}`)

            if (!Voyage) {
                this.logger.log(`editVoyage!!: ${JSON.stringify(Voyage)}`)
                throw 'Something went wrong'
            } else {
                this.logger.log(`editVoyageelse: ${Voyage}`)
            }
            output.data = Voyage;

        } catch (error) {
            this.logger.warn(`editVoyageerror: ${JSON.stringify(error), error}`)
            output.status = false;
            // Handle error message based on the type of error
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                this.logger.warn(`editVoyagebadrequest: ${error}`)
                output.message = error.message;
            } else {
                output.message = error;
            }
        }
        this.logger.warn(`editVoyagemessage: ${output.message}`)
        return output
    }



    @ApiOperation({ summary: 'Delete Voyage By Id' })
    @ApiCreatedResponse({
        description: 'Delete Voyage By Id',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Delete('delete/:id')
    async softDelete(@Param('id', ParseIntPipe) id: number) {
        return this.voyageService.softDelete(id);
    }

    @ApiOperation({summary:'Search list of Voyage'})
    @ApiCreatedResponse({
        description:'Search List of Voyage',
        type:ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Post('search-list')
    async searchVoyage(@Body() body:SearchListDto){
        let resp=new ResponseData();
        try {
            let res=await this.voyageService.searchVoyage(body);
            this.logger.log(`Voyage Search Data : ${JSON.stringify(res)}`);
            resp.data=res;
            resp.message='Voyage Search is successfully fetched'
        } catch (error) {
            this.logger.warn(`Voyage Search Error : ${error}`)
            resp.status=false;
            if(error instanceof BadRequestException || error instanceof UnauthorizedException){
                resp.message=error.message;
            } else {
                resp.message="Internal Server Error"
            }
        }
        return resp;
    }
}
