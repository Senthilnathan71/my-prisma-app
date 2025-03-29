import { BadRequestException, Controller, Get, HttpCode, HttpStatus, Logger, UnauthorizedException } from '@nestjs/common';
import { ApiCreatedResponse, ApiOperation } from '@nestjs/swagger';
import { Auth } from 'src/common/decorators/auth.decorator';
import { ResponseData } from 'src/common/response-data';
import { CityService } from 'src/masters/services/city/city.service';

@Controller('region')
@Auth()
export class RegionController {

    constructor(private cityService: CityService, private logger: Logger) { }

    @ApiOperation({ summary: 'Get All Cities' })
    @ApiCreatedResponse({
        description: 'Get All Cities',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Get()
    async getAllCity() {
        let output = new ResponseData;
        try {
            let cityData = await this.cityService.getAllCity();
            this.logger.debug(`getAllCity: ${JSON.stringify(cityData)}`)
            output.data = cityData;
        } catch (error) {
            this.logger.warn(`getAllCity: ${JSON.stringify(error)}`)
            output.status = false;
            // Handle error message based on the type of error
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                output.message = error.message;
            } else {
                output.message = 'Internal Server Error';
            }
        }
        return output
    }
}
