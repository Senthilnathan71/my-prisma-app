import { BadRequestException, Controller, Get, UnauthorizedException } from '@nestjs/common';
import { Auth } from 'src/common/decorators/auth.decorator';
import { ResponseData } from 'src/common/response-data';
import { CountryService } from 'src/masters/services/country/country.service';

@Controller('country')
@Auth()
export class CountryController {

    constructor(private countryService : CountryService){}

    @Get()
    async getAllCountry(){
        let output = new ResponseData;
        try {
            let countryData = await this.countryService.getAllCountry();
            output.data = countryData;
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
