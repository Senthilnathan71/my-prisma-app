import { BadRequestException, Controller, Get, HttpCode, HttpStatus, Logger, UnauthorizedException } from '@nestjs/common';
import { ApiCreatedResponse, ApiOperation } from '@nestjs/swagger';
import { Auth } from 'src/common/decorators/auth.decorator';
import { ResponseData } from 'src/common/response-data';
import { SectorService } from 'src/masters/services/sector/sector.service';

@Controller('sector')
@Auth()
export class SectorController {

    constructor(private sectorService: SectorService, private logger: Logger) { }

    @ApiOperation({ summary: 'Get All Sectors' })
    @ApiCreatedResponse({
        description: 'Get All Sectors',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Get()
    async getAllSector() {
        let output = new ResponseData;
        try {
            let sectorData = await this.sectorService.getAllSector();
            this.logger.log(`getAllSector: ${JSON.stringify(sectorData)}`)
            output.data = sectorData;
        } catch (error) {
            this.logger.log(`getAllSector: ${JSON.stringify(error)}`)
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
