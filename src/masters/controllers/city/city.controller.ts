import { Controller, Logger } from '@nestjs/common';
import { CityService } from 'src/masters/services/city/city.service';

@Controller('city')
export class CityController {
    constructor(private cityService: CityService, private logger: Logger) { }
}
