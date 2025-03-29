import { BadRequestException, Controller, Get, HttpCode, HttpStatus, Logger, Param, ParseIntPipe, UnauthorizedException } from '@nestjs/common';
import { ApiCreatedResponse, ApiOperation } from '@nestjs/swagger';
import { Auth } from 'src/common/decorators/auth.decorator';
import { ResponseData } from 'src/common/response-data';
import { StateService } from 'src/masters/services/state/state.service';

@Controller('state')
@Auth()
export class StateController {

    constructor(private stateService: StateService, private logger: Logger) { }

    @ApiOperation({ summary: 'Get states by CountryMasterSid' })
    @ApiCreatedResponse({
        description: 'Get states by CountryMasterSid',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Get('/:CountryMasterSid')
    async getAllStates(@Param('CountryMasterSid', ParseIntPipe) CountryMasterSid: number) {
        const output = new ResponseData;
        try {
            const state = await this.stateService.getAllState(CountryMasterSid)
            this.logger.log(`getAllStates: ${JSON.stringify(state)}`)
            output.data = state
        } catch (error) {
            this.logger.warn(`getAllStates: ${JSON.stringify(error)}`)
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
