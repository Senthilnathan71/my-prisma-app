import { Body, Controller, Get, HttpCode, HttpStatus, Logger, Post, Query } from '@nestjs/common';
import { ApiCreatedResponse, ApiOperation } from '@nestjs/swagger';
import { JwtService } from '@nestjs/jwt';
import { Auth } from 'src/common/decorators/auth.decorator';
import { ResponseData } from 'src/common/response-data';
import { ShippingInstructionService } from 'src/operation/services/shipping-instruction/shipping-instruction.service';
import { HouseJobService } from 'src/operation/services/house-job/house-job.service';

@Controller('shipping-instruction')
export class ShippingInstructionController {
    constructor(
        private shippingInstructionService: ShippingInstructionService,
        private houseJobService: HouseJobService,
        private logger: Logger,
        private jwtService: JwtService
    ) { }

    @Auth()
    @ApiOperation({ summary: 'Create Shipping Instruction' })
    @ApiCreatedResponse({
        description: 'Shipping Instruction Created Successfully',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Post('create')
    async createShippingInstruction(@Body() body: {
        CompanyMasterSid: number;
        BranchMasterSid: number;
        HouseJobSid: number;
        Remarks?: string;
        CreatedBy: string;
    }) {
        let output = new ResponseData();
        try {
            const result = await this.shippingInstructionService.createShippingInstruction(body);
            output.data = result;
            output.message = 'Shipping Instruction Created Successfully';
        } catch (error) {
            this.logger.error(`Shipping Instruction Creation Failed - ${error.message}`);
            output.status = false;
            output.message = error.message || 'Internal Server Error';
        }
        return output;
    }

    @Auth()
    @ApiOperation({ summary: 'Send SI Mail' })
    @HttpCode(HttpStatus.OK)
    @Post('send-mail')
    async sendSIMail(@Body() body: {
        CompanyMasterSid: number;
        BranchMasterSid: number;
        HouseJobSid: number;
        appBaseUrl: string;
        userEmail?: string;
        userName?: string;
    }) {
        let output = new ResponseData();
        try {
            const result = await this.shippingInstructionService.sendSIMail(body);
            output.data = result;
            output.message = 'SI Mail sent successfully';
        } catch (error) {
            this.logger.error(`Send SI Mail Failed - ${error.message}`);
            output.status = false;
            output.message = error.message || 'Failed to send SI Mail';
        }
        return output;
    }

    @ApiOperation({ summary: 'Fetch SI data via public token' })
    @HttpCode(HttpStatus.OK)
    @Get('public/fetch')
    async getPublicSIData(@Query('token') token: string) {
        let output = new ResponseData();
        try {
            if (!token) {
                output.status = false;
                output.message = 'Token is required';
                return output;
            }

            // Verify JWT token
            let decoded: any;
            try {
                decoded = this.jwtService.verify(token);
            } catch (err) {
                output.status = false;
                output.message = 'Invalid or expired token';
                return output;
            }

            // Validate token type
            if (decoded.type !== 'si-public') {
                output.status = false;
                output.message = 'Invalid token type';
                return output;
            }

            // Fetch house job data
            const houseJobData = await this.shippingInstructionService.getHouseJobBySid(decoded.HouseJobSid);
            output.data = houseJobData;
            output.message = 'SI data fetched successfully';
        } catch (error) {
            this.logger.error(`Public SI Data Fetch Failed - ${error.message}`);
            output.status = false;
            output.message = error.message || 'Failed to fetch SI data';
        }
        return output;
    }

    @ApiOperation({ summary: 'Save SI data via public token' })
    @HttpCode(HttpStatus.OK)
    @Post('public/save')
    async savePublicSI(@Body() body: {
        token: string;
        houseJobPayload: any;
        siPayload: {
            CompanyMasterSid: number;
            BranchMasterSid: number;
            HouseJobSid: number;
            Remarks?: string;
            CreatedBy: string;
        };
    }) {
        let output = new ResponseData();
        try {
            if (!body.token) {
                output.status = false;
                output.message = 'Token is required';
                return output;
            }

            let decoded: any;
            try {
                decoded = this.jwtService.verify(body.token);
            } catch (err) {
                output.status = false;
                output.message = 'Invalid or expired token';
                return output;
            }

            if (decoded.type !== 'si-public') {
                output.status = false;
                output.message = 'Invalid token type';
                return output;
            }

            // Update house job
            const HouseJobSid = decoded.HouseJobSid;
            await this.houseJobService.updateHouseJobById(HouseJobSid, body.houseJobPayload);

            // Create/update shipping instruction
            const siResult = await this.shippingInstructionService.createShippingInstruction({
                ...body.siPayload,
                HouseJobSid
            });

            output.data = siResult;
            output.message = 'Shipment instruction saved successfully';
        } catch (error) {
            this.logger.error(`Public SI Save Failed - ${error.message}`);
            output.status = false;
            output.message = error.message || 'Failed to save shipment instruction';
        }
        return output;
    }
}
