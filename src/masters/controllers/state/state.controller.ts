import { BadRequestException, Controller, Get, Param, ParseIntPipe, UnauthorizedException } from '@nestjs/common';
import { Auth } from 'src/common/decorators/auth.decorator';
import { ResponseData } from 'src/common/response-data';
import { StateService } from 'src/masters/services/state/state.service';

@Controller('state')
@Auth()
export class StateController {

    constructor(private stateService : StateService){}

     @Get('/:CountryMasterSid')
        async getAllStates(@Param('CountryMasterSid', ParseIntPipe) enquiryId: number) {
            const output = new ResponseData;
            try {
                output.data = await this.stateService.getAllState(enquiryId)
            } catch (error) {
                output.status = false;
                if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                    output.message = error.message;
                } else {
                    output.message = 'Internal Server Error';
                }
            }
            return output;
        }

    
}
