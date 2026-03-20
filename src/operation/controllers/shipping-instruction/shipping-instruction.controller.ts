import { Body, Controller, HttpCode, HttpStatus, Logger, Post } from '@nestjs/common';
import { ApiCreatedResponse, ApiOperation } from '@nestjs/swagger';
import { Auth } from 'src/common/decorators/auth.decorator';
import { ResponseData } from 'src/common/response-data';
import { ShippingInstructionService } from 'src/operation/services/shipping-instruction/shipping-instruction.service';

@Auth()
@Controller('shipping-instruction')
export class ShippingInstructionController {
    constructor(
        private shippingInstructionService: ShippingInstructionService,
        private logger: Logger
    ) { }

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
}
