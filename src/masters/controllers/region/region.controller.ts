import { BadRequestException, Controller, Get, UnauthorizedException } from '@nestjs/common';
import { Auth } from 'src/common/decorators/auth.decorator';
import { ResponseData } from 'src/common/response-data';
import { CityService } from 'src/masters/services/city/city.service';

@Controller('region')
@Auth()
export class RegionController {

    constructor(private cityService : CityService){}

    @Get()
    async getAllCity(){
        let output = new ResponseData;
        try {
            let cityData = await this.cityService.getAllCity();
            output.data = cityData;
        } catch (error) {
             console.log("controler error::", error);
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
