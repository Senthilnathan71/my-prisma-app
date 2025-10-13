import { BadRequestException, Body, Controller, Delete, Get, HttpCode, HttpStatus, Logger, Param, ParseIntPipe, Patch, Post, Query, UnauthorizedException } from '@nestjs/common';
import { ApiOperation, ApiCreatedResponse } from '@nestjs/swagger';
import { UserData } from 'src/common/decorators/user.decorator';
import { ResponseData } from 'src/common/response-data';
import { SearchListDto } from 'src/masters/DTO/search-list.dto';
import { filterDto } from 'src/masters/DTO/search-vessel.dto';
import { VoyageService } from 'src/masters/services/voyage/voyage.service';

@Controller('voyage')
export class VoyageController {
    constructor(private voyageService: VoyageService, private logger: Logger) { }

    @ApiOperation({ summary: 'Voyage Creation' })
    @ApiCreatedResponse({
        description: 'Voyage Creation',
        type: ResponseData
    })
    @HttpCode(HttpStatus.CREATED)
    @Post('create')
    async createVoyage(@Body() body: any, @UserData() user: any) {
        this.logger.log(`createVoyagedata: ${JSON.stringify(body)}`)
        let output = new ResponseData
        try {
            let Voyage = await this.voyageService.createVoyage(body, user);
            this.logger.debug(`createVoyage: ${JSON.stringify(Voyage)}`)
            if (!Voyage) {
                this.logger.warn(`createVoyage!!: ${JSON.stringify(Voyage)}`)
                throw 'Something went wrong'
            }
            output.data = Voyage
        } catch (error) {
            this.logger.warn(`createVoyageError: ${error}`)
            output.status = false;
            // Handle error message based on the type of error
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                output.message = error.message;
                this.logger.warn(`createVoyageError: ${error.message}`)
            } else {
                this.logger.warn(`createVoyageError: ${error}`)
                output.message = error;
            }
        }
        return output
    }

    
    @ApiOperation({ summary: 'Get all vessel with voyage' })
    @ApiCreatedResponse({
        description: 'Vessel with voyage fetched successfully',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Post('vesselWithVoyage')
    async getVesselWithVoyage(@Body() body: VesselVoyageDTO) {
        let resp = new ResponseData();
        try {
            this.logger.log(`getVesselWithVoyage: ${JSON.stringify(body)}`)
            const vesselWithVoyage = await this.voyageService.getAllVesselWithVoyage(body);
            this.logger.debug(`getVesselWithVoyage: ${JSON.stringify(vesselWithVoyage)}`)
            resp.data = vesselWithVoyage;
            resp.message = 'Vessel with voyage fetched successfully';
        } catch (error) {
            resp.status = false;
            this.logger.error('Error loading vessel with voyage', JSON.stringify(error), error)
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                resp.message = error.message;
            } else {
                resp.message = 'Internal Server Error';
            }
        }
        return resp;
    }

    @ApiOperation({ summary: 'Get All Voyage' })
    @ApiCreatedResponse({
        description: 'Get All Voyages',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Get()
    async getAllVoyages() {
        let output = new ResponseData;
        try {
            let VoyageData = await this.voyageService.getAllVoyages();
            this.logger.log(`getAllVoyages: ${JSON.stringify(VoyageData)}`)
            output.data = VoyageData;
        } catch (error) {
            this.logger.warn(`getAllVoyages: ${JSON.stringify(error)}`)
            output.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                output.message = error.message;
            } else {
                output.message = 'Internal Server Error';
            }
        }
        return output
    }


    @ApiOperation({ summary: 'Get Voyage By Id' })
    @ApiCreatedResponse({
        description: 'Get Voyage By Id',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Get('fetch/:id')
    async getVoyageById(@Param('id', ParseIntPipe) VoyageId: number) {
        const output = new ResponseData;
        try {
            const Voyage = await this.voyageService.findOne(VoyageId)
            this.logger.log(`getVoyageById: ${JSON.stringify(Voyage)}`)
            output.data = Voyage
        } catch (error) {
            this.logger.warn(`getVoyageById: ${JSON.stringify(error)}`)
            output.status = false;
            output.message = error
        }
        return output;
    }


    @ApiOperation({ summary: 'Update Voyage By Id' })
    @ApiCreatedResponse({
        description: 'Update Voyage By Id',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Patch('update/:id')
    async editVoyage(@Param('id', ParseIntPipe) id: number, @Body() body: any, @UserData() user: any) {
        this.logger.log(`editVoyagebody: ${JSON.stringify(body)}`)
        let output = new ResponseData
        try {
            let Voyage = await this.voyageService.updateVoyage(id, body, user);
            this.logger.log(`editVoyage: ${JSON.stringify(Voyage)}`)

            if (!Voyage) {
                this.logger.log(`editVoyage!!: ${JSON.stringify(Voyage)}`)
                throw 'Something went wrong'
            } else {
                this.logger.log(`editVoyageelse: ${Voyage}`)
            }
            output.data = Voyage;

        } catch (error) {
            this.logger.warn(`editVoyageerror: ${JSON.stringify(error), error}`)
            output.status = false;
            // Handle error message based on the type of error
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                this.logger.warn(`editVoyagebadrequest: ${error}`)
                output.message = error.message;
            } else {
                output.message = error;
            }
        }
        this.logger.warn(`editVoyagemessage: ${output.message}`)
        return output
    }



    @ApiOperation({ summary: 'Delete Voyage By Id' })
    @ApiCreatedResponse({
        description: 'Delete Voyage By Id',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Delete('delete/:id')
    async softDelete(@Param('id', ParseIntPipe) id: number) {
        let resp = new ResponseData();
        try {
            let res = await this.voyageService.softDelete(id);
            this.logger.log(`Voyage Deleted Data : ${JSON.stringify(res)}`);
            resp.data = res;
            resp.message = 'Voyage is successfully deleted.'
        } catch (error) {
            this.logger.warn(`Voyage Deletion Error : ${error}`)
            resp.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                resp.message = error.message;
            } else {
                resp.message = "Internal Server Error"
            }
        }
        return resp;
    }

    @ApiOperation({ summary: 'Search list of Voyage' })
    @ApiCreatedResponse({
        description: 'Search List of Voyage',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Post('search-list')
    async searchList(@Body() searchParams: filterDto) {
        const resp = new ResponseData();
        try {
            const res = await this.voyageService.searchList(searchParams);
            this.logger.log(`Voyage Search Data : ${JSON.stringify(res)}`);
            resp.data = res;
            resp.message = 'Voyage Search is successfully fetched'
        } catch (error) {
            this.logger.warn(`Voyage Search Error : ${error}`)
            resp.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                resp.message = error.message;
            } else {
                resp.message = "Internal Server Error"
            }
        }
        return resp;
    }
    @ApiOperation({ summary: 'Search Voyage with POL and POD' })
    @ApiCreatedResponse({
        description: 'Search Voyage with POL and POD',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Post('searchBy')
    async searchVoyageByPolPod(@Body() body: any) {
        let resp = new ResponseData();
        try {
            let res = await this.voyageService.specialSearch(body);
            this.logger.log(`Voyage Special Search Data : ${JSON.stringify(res)}`);
            resp.data = res;
            resp.message = 'Voyage Special Search is successfully fetched'
        } catch (error) {
            this.logger.warn(`Voyage Special Search Error : ${error}`)
            resp.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                resp.message = error.message;
            } else {
                resp.message = "Internal Server Error"
            }
        }
        return resp;
    }
    @ApiOperation({ summary: 'Get Audit Logs for a Table/Record' })
    @ApiCreatedResponse({ description: 'Fetch audit logs', type: ResponseData })
    @HttpCode(HttpStatus.OK)
    @Get('audit-logs')
    async getAuditLogs(
        @Query('tableName') tableName: string,
        @Query('recordId') recordId?: string,
    ) {
        const resp = new ResponseData();
        try {
            if (!tableName) throw new Error('tableName query parameter is required');

            const logs = await this.voyageService.getAuditLogs(tableName, recordId);

            // Remove updatedOn from oldVal and newVal
            resp.data = logs.map((log: any) => {
                const oldVal = log.oldVal ? { ...log.oldVal } : null;
                const newVal = log.newVal ? { ...log.newVal } : null;
                if (oldVal && 'updatedOn' in oldVal) delete oldVal.updatedOn;
                if (newVal && 'updatedOn' in newVal) delete newVal.updatedOn;
                return { ...log, oldVal, newVal };
            });

            resp.message = 'Audit logs fetched successfully';
        } catch (error) {
            this.logger.warn(`getAuditLogsError: ${error}`);
            resp.status = false;
            resp.message = error.message || 'Internal Server Error';
        }
        return resp;
    }

    @ApiOperation({ summary: 'Get Voyage By Vessel Id' })
    @ApiCreatedResponse({
        description: 'Get Voyage By Vessel Id',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Get('fetchByVessel/:VesselMasterSid')
    async getVoyageByVesselId(@Param('VesselMasterSid', ParseIntPipe) VesselMasterSid: number) {
        const output = new ResponseData;
        try {
            const Voyage = await this.voyageService.getVoyagesByVesselId(VesselMasterSid)
            this.logger.log(`getVoyageByVesselId: ${JSON.stringify(Voyage)}`)
            output.data = Voyage
        } catch (error) {
            this.logger.warn(`getVoyageByVesselId: ${JSON.stringify(error), error}`)
            output.status = false;
            output.message = error
        }
        return output;
    }

    @ApiOperation({ summary: 'Get Vessels based On Ports' })
    @ApiCreatedResponse({
        description: 'Vessels sailing specified Ports are successfully fetched',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Post('fetchVesselsByPorts')
    async fetchVesselsByPorts(@Body() payload: any) {
        const output = new ResponseData;
        try {
            const Voyage = await this.voyageService.getAvailableVessels(payload.POL, payload.POD, payload.MovementType)
            this.logger.log(`fetchVesselsByPorts: ${JSON.stringify(Voyage)}`)
            output.data = Voyage
        } catch (error) {
            this.logger.warn(`fetchVesselsByPorts: ${JSON.stringify(error), error}`)
            output.status = false;
            output.message = error
        }
        return output;
    }
    @ApiOperation({ summary: 'Get Voyage By Vessel and Ports' })
    @ApiCreatedResponse({
        description: 'Get Voyage By Vessel and Ports',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Post('fetchByVesselAndPorts')
    async fetchByVesselAndPorts(@Body() payload: any) {
        const output = new ResponseData;
        try {
            const Voyage = await this.voyageService.getAvailableVoyagesWithPorts(payload.VesselMasterSid, payload.POL, payload.POD, payload.MovementType)
            this.logger.log(`fetchByVesselAndPorts: ${JSON.stringify(Voyage)}`)
            output.data = Voyage
        } catch (error) {
            this.logger.warn(`fetchByVesselAndPorts: ${JSON.stringify(error), error}`)
            output.status = false;
            output.message = error
        }
        return output;
    }

}
interface VesselVoyageDTO {
    POL : number,
    POD : number,
    segment : 'Sea' | 'Air' | 'Road'
}