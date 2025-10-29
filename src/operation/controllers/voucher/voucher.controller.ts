import { BadRequestException, Body, Controller, HttpCode, HttpStatus, Logger, Post, UnauthorizedException } from "@nestjs/common";
import { ApiCreatedResponse, ApiOperation } from "@nestjs/swagger";
import { ResponseData } from "src/common/response-data";
import { VoucherService } from "src/operation/services/voucher/voucher.service";

@Controller('voucher')
export class VoucherController {
    constructor(
        private voucherService: VoucherService,
        private logger: Logger
    ) { }

    @ApiOperation({ summary: 'Generate Voucher from Booking Rates' })
    @ApiCreatedResponse({
        description: 'Voucher generated successfully from booking rates',
        type: ResponseData
    })
    @HttpCode(HttpStatus.CREATED)
    @Post('generate-from-booking')
    async generateVoucherFromBooking(@Body() body: any) {
        let output = new ResponseData();
        this.logger.log(`generateVoucherFromBooking request body: ${JSON.stringify(body)}`);

        try {
            // Validate required fields
            if (!body.ParentSid) {
                throw new BadRequestException('Booking Header SID is required');
            }
            if (!body.selectedRateIds || !Array.isArray(body.selectedRateIds) || body.selectedRateIds.length === 0) {
                throw new BadRequestException('Selected rate IDs are required');
            }
            if (!body.companyMasterSid) {
                throw new BadRequestException('Company Master SID is required');
            }
            if (!body.branchMasterSid) {
                throw new BadRequestException('Branch Master SID is required');
            }
            if (!body.billingPartySid) {
                throw new BadRequestException('Billing Party SID is required');
            }

            this.logger.log(`Billing Party SID from request: ${body.billingPartySid} (type: ${typeof body.billingPartySid})`);

            if (!body.voucherType || !['Invoice', 'Vendor Invoice'].includes(body.voucherType)) {
                throw new BadRequestException('Valid voucher type is required (Invoice or Vendor Invoice)');
            }

            const result = await this.voucherService.createVoucherFromBookingRates({
                bookingHeaderSid: Number(body.ParentSid),
                companyMasterSid: Number(body.companyMasterSid),
                branchMasterSid: Number(body.branchMasterSid),
                voucherTypeMasterSid: body.voucherTypeMasterSid ? Number(body.voucherTypeMasterSid) : undefined,
                voucherType: body.voucherType,
                selectedRateIds: body.selectedRateIds.map(id => Number(id)),
                billingPartySid: Number(body.billingPartySid),
                customerBranchSid: body.customerBranchSid ? Number(body.customerBranchSid) : undefined,
                createdBy: body.createdBy || 'System',
                invoiceHeader: body.invoiceHeader,
                chargeTaxGroups: body.chargeTaxGroups
            });

            this.logger.debug(`generateVoucherFromBooking result: ${JSON.stringify(result)}`);
            output.data = result;
            output.message = "Voucher generated successfully";
        } catch (error) {
            this.logger.warn(`generateVoucherFromBooking error: ${JSON.stringify(error), error}`);
            output.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                output.message = error.message;
            } else {
                output.message = "Internal Server Error";
            }
        }
        return output;
    }
}
