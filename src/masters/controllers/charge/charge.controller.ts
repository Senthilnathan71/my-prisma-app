import { BadRequestException, Body, Controller, Delete, Get, HttpCode, HttpStatus, Logger, Param, ParseIntPipe, Patch, Post, UnauthorizedException } from '@nestjs/common';
import { ApiOperation, ApiCreatedResponse } from '@nestjs/swagger';
import { UserData } from 'src/common/decorators/user.decorator';
import { ResponseData } from 'src/common/response-data';
import { SearchListDto } from 'src/masters/DTO/search-list.dto';
import { SearchVesselDto } from 'src/masters/DTO/search-vessel.dto';
import { ChargeService } from 'src/masters/services/charge/charge.service';

@Controller('charge')
export class ChargeController {
    constructor(private chargeService: ChargeService, private logger: Logger) { }

    @ApiOperation({ summary: 'Charge Creation' })
    @ApiCreatedResponse({
        description: 'Charge Creation',
        type: ResponseData
    })
    @HttpCode(HttpStatus.CREATED)
    @Post('create')
    async createCharge(@Body() body: any, @UserData() user: any) {
        this.logger.log(`createChargedata: ${JSON.stringify(body)}`)
        let output = new ResponseData
        try {
            let Charge = await this.chargeService.createCharge(body, user);
            this.logger.debug(`createCharge: ${JSON.stringify(Charge)}`)
            if (!Charge) {
                this.logger.warn(`createCharge!!: ${JSON.stringify(Charge)}`)
                throw 'Something went wrong'
            }
            output.data = Charge
            output.message = 'Charge Created Successfully'
        } catch (error) {
            this.logger.warn(`createChargeError: ${error}`)
            output.status = false;
            // Handle error message based on the type of error
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                output.message = error.message;
                this.logger.warn(`createChargeError: ${error.message}`)
            } else {
                this.logger.warn(`createChargeError: ${error}`)
                output.message = error;
            }
        }
        return output
    }


    @ApiOperation({ summary: 'Get All Charge' })
    @ApiCreatedResponse({
        description: 'Get All Charges',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Get()
    async getAllCharges() {
        let output = new ResponseData;
        try {
            let ChargeData = await this.chargeService.getAllCharges();
            this.logger.log(`getAllCharges: ${JSON.stringify(ChargeData)}`)
            output.data = ChargeData;
        } catch (error) {
            this.logger.warn(`getAllCharges: ${JSON.stringify(error)}`)
            output.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                output.message = error.message;
            } else {
                output.message = 'Internal Server Error';
            }
        }
        return output
    }



    @ApiOperation({ summary: 'Get All Charge Group' })
    @ApiCreatedResponse({
        description: 'Get All Charge Group',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Get('charge-group')
    async getAllChargeGroups() {
        let output = new ResponseData;
        try {
            let ChargeGroupData = await this.chargeService.getAllChargeGroups();
            this.logger.log(`getAllChargeGroup: ${JSON.stringify(ChargeGroupData)}`)
            output.data = ChargeGroupData;
        } catch (error) {
            this.logger.warn(`getAllChargeGroup: ${JSON.stringify(error)}`)
            output.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                output.message = error.message;
            } else {
                output.message = 'Internal Server Error';
            }
        }
        return output
    }



    @ApiOperation({ summary: 'Get Charge By Id' })
    @ApiCreatedResponse({
        description: 'Get Charge By Id',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Get('fetch/:id')
    async getChargeById(@Param('id', ParseIntPipe) ChargeId: number) {
        const output = new ResponseData;
        try {
            const Charge = await this.chargeService.findOne(ChargeId)
            this.logger.log(`getChargeById: ${JSON.stringify(Charge)}`)
            output.data = Charge
        } catch (error) {
            this.logger.warn(`getChargeById: ${JSON.stringify(error)}`)
            output.status = false;
            output.message = error
        }
        return output;
    }


    @ApiOperation({ summary: 'Update Charge By Id' })
    @ApiCreatedResponse({
        description: 'Update Charge By Id',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Patch('update/:id')
    async editCharge(@Param('id', ParseIntPipe) id: number, @Body() body: any, @UserData() user: any) {
        this.logger.log(`editChargebody: ${JSON.stringify(body)}`)
        let output = new ResponseData
        try {
            let Charge = await this.chargeService.updateCharge(id, body, user);
            this.logger.log(`editCharge: ${JSON.stringify(Charge)}`)

            if (!Charge) {
                this.logger.log(`editCharge!!: ${JSON.stringify(Charge)}`)
                throw 'Something went wrong'
            } else {
                this.logger.log(`editChargeelse: ${Charge}`)
            }
            output.data = Charge;
            output.message = 'Charge Updated Successfully'
        } catch (error) {
            this.logger.warn(`editChargeerror: ${JSON.stringify(error), error}`)
            output.status = false;
            // Handle error message based on the type of error
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                this.logger.warn(`editChargebadrequest: ${error}`)
                output.message = error.message;
            } else {
                output.message = error;
            }
        }
        this.logger.log(`editChargemessage: ${output.message}`)
        return output
    }



    @ApiOperation({ summary: 'Delete Charge By Id' })
    @ApiCreatedResponse({
        description: 'Delete Charge By Id',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Delete('delete/:id')
    async softDelete(@Param('id', ParseIntPipe) id: number) {
        return this.chargeService.softDelete(id);
    }



    @ApiOperation({ summary: 'Search List of Charges' })
@ApiCreatedResponse({
    description: 'Search List of Charges',
    type: ResponseData,
})
@HttpCode(HttpStatus.OK)
@Post('search-list')
async searchCharge(@Body() searchParams: SearchVesselDto) {
    const resp = new ResponseData();
    try {
        const res = await this.chargeService.searchList(searchParams);
        this.logger.log(`Charge Search Data : ${JSON.stringify(res)}`);
        resp.data = res;
        
        resp.message = 'Charge search completed successfully';
    } catch (error) {
        this.logger.warn(`Search Charge Error : ${error}`);
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
