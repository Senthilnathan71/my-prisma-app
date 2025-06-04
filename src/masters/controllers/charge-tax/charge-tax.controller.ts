import { BadRequestException, Controller, Get, HttpCode, HttpStatus, Logger, UnauthorizedException } from '@nestjs/common';
import { ApiCreatedResponse, ApiOperation } from '@nestjs/swagger';
import { ResponseData } from 'src/common/response-data';
import { ChargeTaxService } from 'src/masters/services/charge-tax/charge-tax.service';

@Controller('charge-tax')
export class ChargeTaxController {
    constructor(private logger:Logger,private chargeTaxService:ChargeTaxService){}

    @ApiOperation({summary:'Get All Charge Taxes'})
    @ApiCreatedResponse({
        description:'Get All Charge Taxes',
        type : ResponseData
    })
    @Get()
    @HttpCode(HttpStatus.OK)
    async getAllChargeTaxes(){
        let resp = new ResponseData();
        try {
            this.logger.log('Getting All Charge Taxes');
            let res = await this.chargeTaxService.getAllChargeTax();
            this.logger.debug(`All Charge Taxes are fetched : ${JSON.stringify(res)}`);
            resp.data = res;
            resp.message = "All Charge Taxes are fetched successfully";
        } catch (error) {
            resp.status = false;
            this.logger.warn(`Error Fetching All Charge Taxes : ${JSON.stringify(error),error}`);
            if(error instanceof BadRequestException || error instanceof UnauthorizedException){
                resp.message = error.message
            } else {
                resp.message = 'Internal Server Error';
            }
        }
        return resp;
    }
}
