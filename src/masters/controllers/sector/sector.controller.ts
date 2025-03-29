import { BadRequestException, Controller, Get, UnauthorizedException } from '@nestjs/common';
import { Auth } from 'src/common/decorators/auth.decorator';
import { ResponseData } from 'src/common/response-data';
import { SectorService } from 'src/masters/services/sector/sector.service';

@Controller('sector')
@Auth()
export class SectorController {

    constructor(private sectorService : SectorService){}

    @Get()
    async getAllSector(){
        let output = new ResponseData;
        try {
            let sectorData = await this.sectorService.getAllSector();
            output.data = sectorData;
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
