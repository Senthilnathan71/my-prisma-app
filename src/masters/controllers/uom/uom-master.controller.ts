import { BadRequestException, Body, Controller, Delete, Get, HttpCode, HttpStatus, Logger, Param, ParseIntPipe, Patch, Post, UnauthorizedException } from "@nestjs/common";
import { ApiCreatedResponse, ApiOperation } from "@nestjs/swagger";
import { Auth } from "src/common/decorators/auth.decorator";
import { UserData } from "src/common/decorators/user.decorator";
import { ResponseData } from "src/common/response-data";
import { EnquiryHeaderService } from "src/masters/services/enquiry/enquiry-header.service";
import { UomService } from "src/masters/services/uom/uom-master.service";

@Controller('uom')
@Auth()
export class UomMasterController {
    constructor(private UomService: UomService, private logger: Logger) { }

    @ApiOperation({ summary: 'Get All Uom' })
    @ApiCreatedResponse({
        description: 'Get All Uom',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Get()
    async getAllUom(@UserData() UserData: any) {
        const output = new ResponseData
        try {
            const uom = await this.UomService.getAllUom()
            this.logger.log(`getAllUom: ${JSON.stringify(uom)}`)
            output.data = uom;
        } catch (error) {
            this.logger.warn(`getAllUom: ${JSON.stringify(error)}`)
            output.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                output.message = error.message;
            } else {
                output.message = 'Internal Server Error';
            }
        }
        return output;
    }


    @ApiOperation({ summary: 'Uom Creation' })
    @ApiCreatedResponse({
        description: 'Uom Creation',
        type: ResponseData
    })
    @HttpCode(HttpStatus.CREATED)
    @Post()
    async createUom(@Body() body: any, @UserData() user: any) { 
        this.logger.log(`createUom: ${JSON.stringify(body)}`)
        let output = new ResponseData
        try {
            let Uom = await this.UomService.createUom(body, user);
            this.logger.debug(`createUom: ${JSON.stringify(Uom)}`)
            if (!Uom) {
                this.logger.warn(`createUom: ${JSON.stringify(Uom)}`)
                throw 'Something went wrong'
            }
            output.data = Uom
        } catch (error) {
            this.logger.warn(`createUom: ${JSON.stringify(error)}`)
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



    @ApiOperation({ summary: 'Get Uom By Id' })
    @ApiCreatedResponse({
        description: 'Get Uom By Id',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Get(':id')
    async getUomById(@Param('id', ParseIntPipe) uomId: number) {
        const output = new ResponseData;
        try {
            const Uom = await this.UomService.findOne(uomId)
            this.logger.log(`getUomById: ${JSON.stringify(Uom)}`)
            output.data = Uom
        } catch (error) {
            this.logger.warn(`getUomById: ${JSON.stringify(error)}`)
            output.status = false;
            output.message = error
        }
        return output;
    }



    @ApiOperation({ summary: 'Update Uom By Id' })
    @ApiCreatedResponse({
        description: 'Update Uom By Id',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Patch(':id')
    async editUom(@Param('id', ParseIntPipe) id: number, @Body() body: any, @UserData() user: any) {
        this.logger.log(`editUom: ${JSON.stringify(body)}`)
        let output = new ResponseData
        try {
            let Uom = await this.UomService.updateUom(id, body, user);
            this.logger.log(`editUom: ${JSON.stringify(Uom)}`)

            if (!Uom) {
                this.logger.log(`editUom: ${JSON.stringify(Uom)}`)
                throw 'Something went wrong'
            }
            output.data = Uom;

        } catch (error) {
            this.logger.warn(`editUom: ${JSON.stringify(error)}`)
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


    @ApiOperation({ summary: 'Delete Uom By Id' })
    @ApiCreatedResponse({
        description: 'Delete Uom By Id',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK) @Delete(':id')
    async softDelete(@Param('id', ParseIntPipe) id: number) {
        return this.UomService.softDelete(id);
    }

}