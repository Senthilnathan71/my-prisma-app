import { BadRequestException, Body, Controller, Delete, Get, HttpCode, HttpStatus, Logger, Param, ParseIntPipe, Patch, Post, UnauthorizedException } from '@nestjs/common';
import { Auth } from 'src/common/decorators/auth.decorator';
import { UserData } from "src/common/decorators/user.decorator";
import { ResponseData } from 'src/common/response-data';
import { UnitService } from 'src/masters/services/unit/unit.service';
import { ApiCreatedResponse, ApiOperation } from "@nestjs/swagger";
import { SearchListDto } from 'src/masters/DTO/search-list.dto';
import { SearchVesselDto } from 'src/masters/DTO/search-vessel.dto';

@Controller('unit')
@Auth()
export class UnitController {

    constructor(private unitService: UnitService, private logger: Logger
    ) { }

    @ApiOperation({ summary: 'Get All Unit' })
        @ApiCreatedResponse({
            description: 'Get All Unit',
            type: ResponseData
        })
    @HttpCode(HttpStatus.OK)
    @Get()
    async getAllUnit() { 
        let output = new ResponseData;
        try {
            let countryData = await this.unitService.getAllUnit();
            this.logger.log(`getAllUnit: ${JSON.stringify(countryData)}`)
            output.data = countryData;
        } catch (error) {
            this.logger.warn(`getAllUnit: ${JSON.stringify(error)}`)
            output.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                output.message = error.message;
            } else {
                output.message = 'Internal Server Error';
            }
        }
        return output
    }

    @ApiOperation({ summary: 'Unit Creation' })
        @ApiCreatedResponse({
            description: 'Unit Creation',
            type: ResponseData
        })
        @HttpCode(HttpStatus.CREATED)
        @Post()
        async createUnit(@Body() body: any, @UserData() user: any) { 
            this.logger.log(`createUnit: ${JSON.stringify(body)}`)
            let output = new ResponseData
            try {
                let Unit = await this.unitService.createUnit(body, user);
                this.logger.debug(`createUnit: ${JSON.stringify(Unit)}`)
                if (!Unit) {
                    this.logger.warn(`createUnit: ${JSON.stringify(Unit)}`)
                    throw 'Something went wrong'
                }
                output.data = Unit
            } catch (error) {
                this.logger.warn(`createUnit: ${JSON.stringify(error)}`)
                output.status = false;
                // Handle error message based on the type of error
                if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                    output.message = error.message;
                } else {
                    output.message = error;
                }
            }
            return output
        }
    
    
    
        @ApiOperation({ summary: 'Get Unit By Id' })
        @ApiCreatedResponse({
            description: 'Get Unit By Id',
            type: ResponseData
        })
        @HttpCode(HttpStatus.OK)
        @Get(':id')
        async getUnitById(@Param('id', ParseIntPipe) unitId: number) {
            const output = new ResponseData;
            try {
                const Unit = await this.unitService.findOne(unitId)
                this.logger.log(`getUnitById: ${JSON.stringify(Unit)}`)
                output.data = Unit
            } catch (error) {
                this.logger.warn(`getUnitById: ${JSON.stringify(error)}`)
                output.status = false;
                output.message = error
            }
            return output;
        }
    
    
    
        @ApiOperation({ summary: 'Update Unit By Id' })
        @ApiCreatedResponse({
            description: 'Update Unit By Id',
            type: ResponseData
        })
        @HttpCode(HttpStatus.OK)
        @Patch(':id')
        async editUnit(@Param('id', ParseIntPipe) id: number, @Body() body: any, @UserData() user: any) {
            this.logger.log(`editUnit: ${JSON.stringify(body)}`)
            let output = new ResponseData
            try {
                let Unit = await this.unitService.updateUnit(id, body, user);
                this.logger.log(`editUnit: ${JSON.stringify(Unit)}`)
    
                if (!Unit) {
                    this.logger.log(`editUnit: ${JSON.stringify(Unit)}`)
                    throw 'Something went wrong'
                }
                output.data = Unit;
    
            } catch (error) {
                this.logger.warn(`editUnit: ${JSON.stringify(error)}`)
                output.status = false;
                // Handle error message based on the type of error
                if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                    output.message = error.message;
                } else {
                    output.message = error;
                }
            }
            return output
        }
    
    
        @ApiOperation({ summary: 'Delete Unit By Id' })
        @ApiCreatedResponse({
            description: 'Delete Unit By Id',
            type: ResponseData
        })
        @HttpCode(HttpStatus.OK) @Delete(':id')
        async softDelete(@Param('id', ParseIntPipe) id: number) {
            return this.unitService.softDelete(id);
        }

        @ApiOperation({summary:'Search List of Unit'})
        @ApiCreatedResponse({
            description:'Search List of Unit',
            type:ResponseData
        })
        @HttpCode(HttpStatus.OK)
        @Post('search-list')
        async searchUnitNew(@Body() searchParams:SearchVesselDto){
            const resp=new ResponseData();
            try {
                const res=await this.unitService.searchUnitNew(searchParams);
                this.logger.log(`Unit Search Data : ${JSON.stringify(res)}`);
                resp.data=res;
                resp.message='Unit Search is successfully fetched';
            } catch (error) {
                this.logger.warn(`Unit Search Error : ${error}`);
                resp.status=false;
                if(error instanceof BadRequestException || error instanceof UnauthorizedException){
                    resp.message=error.message
                } else {
                    resp.message='Internal Server Error;'
                }
            }
            return resp;
        }
}
