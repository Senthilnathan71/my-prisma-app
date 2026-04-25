import { BadRequestException, Body, Controller, Delete, HttpCode, HttpStatus, Logger, Param, ParseIntPipe, Post, UnauthorizedException } from '@nestjs/common';
import { ApiCreatedResponse, ApiOperation } from '@nestjs/swagger';
import { ResponseData } from 'src/common/response-data';
import { OperationCommonService } from 'src/operation/services/operation-common/operation-common.service';

interface CostRevenueDTO {
    MenuMasterSid : number,
    CompanyMasterSid : number,
    BranchMasterSid : number,
    TransactionSid : number,
    ShipmentNo : string  
}

interface ShipmentMilestoneDTO {
    CompanyMasterSid ?: number,
    BranchMasterSid ?: number,
    ShipmentNo ?: string
}

@Controller('operation-common')
export class OperationCommonController {
    constructor(
        private commonService: OperationCommonService,
        private logger: Logger
    ) { }

    @ApiOperation({ summary: 'Create Cost Revenue Charge' })
    @ApiCreatedResponse({
        description: 'Cost Revenue created successfully',
        type: ResponseData
    })
    @HttpCode(HttpStatus.CREATED)
    @Post('cost-revenue/create')
    async createCostRevenue(@Body() payload: any) {
        let output = new ResponseData()
        try {
            let lookupDatas = await this.commonService.createCostRevenueCharges(payload);
            this.logger.debug(`createCostRevenue: ${JSON.stringify(lookupDatas)}`)
            output.data = lookupDatas;
            output.message = "Cost Revenue Charge created successfully";

        } catch (error) {
            this.logger.warn(`createCostRevenue error: ${JSON.stringify(error), error}`)
            output.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                output.message = error.message;
            } else {
                output.message = error;
            }
        }
        return output
    }

    @ApiOperation({ summary: 'Get All Cost Revenue Charge' })
    @ApiCreatedResponse({
        description: 'All Cost Revenue Charge are fetched successfully',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Post('cost-revenue/fetchAll')
    async getAllCostRevenueCharge(@Body() payload: CostRevenueDTO) {
        let output = new ResponseData()
        try {
            console.log(payload);
            let lookupDatas = await this.commonService.getAllCostRevenueCharges(payload);
            this.logger.debug(`getAllCostRevenueCharge: ${JSON.stringify(lookupDatas)}`)
            output.data = lookupDatas;
            output.message = "All Cost Revenue charges are fetched successfully";

        } catch (error) {
            this.logger.warn(`getAllCostRevenueCharge error: ${JSON.stringify(error), error}`)
            output.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                output.message = error.message;
            } else {
                output.message = error;
            }
        }
        return output
    }

    @ApiOperation({ summary: 'Get All Cost Revenue Charge with details' })
    @ApiCreatedResponse({
        description: 'All Cost Revenue Charge with details are fetched successfully',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Post('cost-revenue/fetchWithDetails')
    async getAllCostRevenueChargeWithDetails(
        @Body() payload:{ 
            TransactionSid:number,
            menuName:string
        } ) {
        let output = new ResponseData()
        try {

            let lookupDatas = await this.commonService.getCostRevenueChargesWithDetails(payload);
            this.logger.debug(`getAllCostRevenueChargeWithDetails: ${JSON.stringify(lookupDatas)}`)
            output.data = lookupDatas;
            output.message = "All Cost Revenue Charge with details are fetched successfully";
            
        } catch (error) {
            this.logger.warn(`getAllCostRevenueChargeWithDetails error: ${JSON.stringify(error), error}`)
            output.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                output.message = error.message;
            } else {
                output.message = error;
            }
        }
        return output
    }

    @ApiOperation({ summary: 'Create Shipment Milestone' })
    @ApiCreatedResponse({
        description: 'Shipment Milestone created successfully',
        type: ResponseData
    })
    @HttpCode(HttpStatus.CREATED)
    @Post('shipment-milestone/create')
    async createShipmentMilestone(@Body() payload: any) {
        let output = new ResponseData()
        try {
            let lookupDatas = await this.commonService.createShipmentMilestone(payload);
            this.logger.debug(`createShipmentMilestone: ${JSON.stringify(lookupDatas)}`)
            output.data = lookupDatas;
            output.message = "Shipment Milestone created successfully";

        } catch (error) {
            this.logger.warn(`createShipmentMilestone error: ${JSON.stringify(error), error}`)
            output.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                output.message = error.message;
            } else {
                output.message = error;
            }
        }
        return output
    }

    @ApiOperation({ summary: 'Get All Shipment Milestone' })
    @ApiCreatedResponse({
        description: 'All Shipment Milestone are fetched successfully',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Post('shipment-milestone/fetchAll')
    async getShipmentMilestoneByShipmentNo(@Body() payload: ShipmentMilestoneDTO) {
        let output = new ResponseData()
        try {
            let lookupDatas = await this.commonService.getAllShipmentMilestones(payload);
            this.logger.debug(`getShipmentMilestoneByShipmentNo: ${JSON.stringify(lookupDatas)}`)
            output.data = lookupDatas;
            output.message = "All Shipment Milestone with provided shipment no. fetched successfully";

        } catch (error) {
            this.logger.warn(`getShipmentMilestoneByShipmentNo error: ${JSON.stringify(error), error}`)
            output.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                output.message = error.message;
            } else {
                output.message = error;
            }
        }
        return output
    }

    @ApiOperation({ summary: 'Soft Delete Cost Revenue Charge by CostRevenueChargesSid' })
    @ApiCreatedResponse({
        description: 'Cost Revenue Charge soft deleted successfully',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Delete('delete-cost-revenue/:CostRevenueChargesSid')
    async softDeleteCostRevenueCharge(@Param('CostRevenueChargesSid',ParseIntPipe) CostRevenueChargesSid: number,
    @Body('updatedBy') updatedBy: string) {
        let output = new ResponseData()
        try {
            let lookupDatas = await this.commonService.softDeleteCostRevenueCharges(CostRevenueChargesSid,updatedBy);
            this.logger.debug(`softDeleteCostRevenueCharge: ${JSON.stringify(lookupDatas)}`)
            output.data = lookupDatas;
            output.message = "Cost Revenue Charge soft deleted successfully";

        } catch (error) {
            this.logger.warn(`softDeleteCostRevenueCharge error: ${JSON.stringify(error), error}`)
            output.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                output.message = error.message;
            } else {
                output.message = error;
            }
        }
        return output
    }

}
