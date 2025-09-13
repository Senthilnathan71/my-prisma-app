import { BadRequestException, Body, Controller, HttpCode, HttpStatus, Logger, Post, UnauthorizedException } from '@nestjs/common';
import { ApiCreatedResponse, ApiOperation } from '@nestjs/swagger';
import { ResponseData } from 'src/common/response-data';
import { LoadingPlanService } from 'src/operation/services/loading-plan/loading-plan.service';

@Controller('loading-plan')
export class LoadingPlanController {

    constructor(
        private logger : Logger,
        private loadingPlanService : LoadingPlanService,
    ) { }

    @ApiOperation({ summary: 'Get matching bookings' })
    @ApiCreatedResponse({
        description : 'Booking data fetched successfully',
        type : ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Post('get-matching-bookings')
    async getMatchingBookings(@Body() body:LoadingPlanDTO) {
        let resp = new ResponseData();
        try {
            this.logger.log(`getMatchingBookings: ${JSON.stringify(body)}`)
            const matchingBookings = await this.loadingPlanService.getAllAvailableBookings(body);
            this.logger.debug(`getMatchingBookings: Fetch matching bookings- ${JSON.stringify(matchingBookings)}`)
            resp.data = matchingBookings;
            resp.message = 'Booking data fetched successfully';
        } catch (error) {
            resp.status = false;
            this.logger.error('Error loading matching bookings',JSON.stringify(error),error)
            if(error instanceof BadRequestException || error instanceof UnauthorizedException){
                resp.message = error.message;
            } else {
                resp.message = 'Internal Server Error';
            }
        }
        return resp;
    }

    // @ApiOperation({ summary: 'Shift booking to house' })
    // @ApiCreatedResponse({
    //     description : 'House created successfully',
    //     type : ResponseData
    // })
    // @HttpCode(HttpStatus.OK)
    // @Post('booking-to-house')
    // async shiftBookingToHouse(@Body() body:number[]) {
    //     let resp = new ResponseData();
    //     try {
    //         this.logger.log(`shiftBookingToHouse: ${JSON.stringify(body)}`)
    //         const allHouses = await this.loadingPlanService.shiftBookingToHouse(body);
    //         this.logger.debug(`shiftBookingToHouse: ${JSON.stringify(allHouses)}`)
    //         resp.data = allHouses;
    //         resp.message = 'Houses are created successfully';
    //     } catch (error) {
    //         resp.status = false;
    //         this.logger.error('Error creating houses',JSON.stringify(error),error)
    //         if(error instanceof BadRequestException || error instanceof UnauthorizedException){
    //             resp.message = error.message;
    //         } else {
    //             resp.message = 'Internal Server Error';
    //         }
    //     }
    //     return resp;
    // }

    @ApiOperation({ summary: 'Get all vessel with voyage' })
    @ApiCreatedResponse({
        description : 'Vessel with voyage fetched successfully',
        type : ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Post('vesselWithVoyage')
    async getVesselWithVoyage(@Body() body:VesselVoyageDTO) {
        let resp = new ResponseData();
        try {
            this.logger.log(`getVesselWithVoyage: ${JSON.stringify(body)}`)
            const vesselWithVoyage = await this.loadingPlanService.getAllVesselWithVoyage(body);
            this.logger.debug(`getVesselWithVoyage: ${JSON.stringify(vesselWithVoyage)}`)
            resp.data = vesselWithVoyage;
            resp.message = 'Vessel with voyage fetched successfully';
        } catch (error) {
            resp.status = false;
            this.logger.error('Error loading vessel with voyage',JSON.stringify(error),error)
            if(error instanceof BadRequestException || error instanceof UnauthorizedException){
                resp.message = error.message;
            } else {
                resp.message = 'Internal Server Error';
            }
        }
        return resp;
    }

}
interface LoadingPlanDTO {
    CompanyMasterSid : number,
    BranchMasterSid : number,
    DepartmentMasterSid : number,
    POL : string,
    POD : string,
    VesselName : string,
    VoyageNo : string,
}
interface VesselVoyageDTO {
    POL : number,
    POD : number
}