import { BadRequestException, Body, Controller, HttpCode, HttpStatus, Logger, Post, UnauthorizedException } from '@nestjs/common';
import { ApiCreatedResponse, ApiOperation } from '@nestjs/swagger';
import { Auth } from 'src/common/decorators/auth.decorator';
import { ResponseData } from 'src/common/response-data';
import { LookupsService } from 'src/common/services/lookups/lookups.service';

@Auth()
@Controller('lookups')
export class LookupsController {
    constructor(
        private lookupService:LookupsService,
        private logger :Logger
    ) { }

    @ApiOperation({ summary: 'Get all departments' })
    @ApiCreatedResponse({ 
        description: 'List of all departments.',
        type : ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Post('departments')
    async getAllDepartments(@Body() payload:any) {
        let resp = new ResponseData();
        try {
            const data = await this.lookupService.getAllDepartments(payload);
            this.logger.log(`getAllDepartments: ${JSON.stringify(data)}`);
            resp.data = data;
            resp.message = 'Departments fetched successfully';
        } catch (error) {
            resp.status = false;
            this.logger.error(`getAllDepartments: ${JSON.stringify(error),error}`);
            if(error instanceof BadRequestException || error instanceof UnauthorizedException){
                resp.message = error.message;
            } else {
                resp.message = 'Internal server error';
            }
        }
        return resp;
    }
}
