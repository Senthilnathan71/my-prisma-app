import { BadRequestException, Controller, Get, Logger, UnauthorizedException } from '@nestjs/common';
import { Auth } from 'src/common/decorators/auth.decorator';
import { ResponseData } from 'src/common/response-data';
import { CountryService } from 'src/masters/services/country/country.service';

@Controller('country')
@Auth()
export class CountryController {

    constructor(private countryService: CountryService, private logger: Logger
    ) { }

    @Get()
    async getAllCountry() {
        let output = new ResponseData;
        try {
            let countryData = await this.countryService.getAllCountry();
            this.logger.log(`getAllCountry: ${JSON.stringify(countryData)}`)
            output.data = countryData;
        } catch (error) {
            this.logger.warn(`getAllCountry: ${JSON.stringify(error)}`)
            output.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                output.message = error.message;
            } else {
                output.message = 'Internal Server Error';
            }
        }
        return output
    }
}
