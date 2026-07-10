import { BadRequestException, Body, Controller, Delete, HttpCode, HttpStatus, Logger, Param, ParseIntPipe, Post, Query, UnauthorizedException, UsePipes, ValidationPipe } from "@nestjs/common";
import { ApiCreatedResponse, ApiOperation } from "@nestjs/swagger";
import { CheckAutoPostingDto, CreateVoucherPayload, DeleteVoucherPayload } from "src/accounts/dto/voucher.dto";
import { ResponseData } from "src/common/response-data";
import { VoucherService } from "src/accounts/services/voucher/voucher.service";
import { Auth } from "src/common/decorators/auth.decorator";
import { extractVoucherValidationMessage, DbTriggerValidationException } from "src/common/db-validation-error.helper";

@Auth()
@Controller('voucher')
export class VoucherController {
    constructor(
        private voucherService: VoucherService,
        private logger: Logger
    ) { }

    // @ApiOperation({ summary: 'Generate Voucher from Booking Rates' })
    // @ApiCreatedResponse({
    //     description: 'Voucher generated successfully from booking rates',
    //     type: ResponseData
    // })
    // @HttpCode(HttpStatus.CREATED)
    // @Post('generate-from-booking')
    // async generateVoucherFromBooking(@Body() body: any) {
    //     let output = new ResponseData();
    //     this.logger.log(`generateVoucherFromBooking request body: ${JSON.stringify(body)}`);

    //     try {
    //         // Validate required fields
    //         if (!body.ParentSid) {
    //             throw new BadRequestException('Booking Header SID is required');
    //         }
    //         if (!body.selectedRateIds || !Array.isArray(body.selectedRateIds) || body.selectedRateIds.length === 0) {
    //             throw new BadRequestException('Selected rate IDs are required');
    //         }
    //         if (!body.companyMasterSid) {
    //             throw new BadRequestException('Company Master SID is required');
    //         }
    //         if (!body.branchMasterSid) {
    //             throw new BadRequestException('Branch Master SID is required');
    //         }
    //         if (!body.billingPartySid) {
    //             throw new BadRequestException('Billing Party SID is required');
    //         }

    //         this.logger.log(`Billing Party SID from request: ${body.billingPartySid} (type: ${typeof body.billingPartySid})`);

    //         if (!body.voucherType || !['Invoice', 'Vendor Invoice'].includes(body.voucherType)) {
    //             throw new BadRequestException('Valid voucher type is required (Invoice or Vendor Invoice)');
    //         }

    //         const result = await this.voucherService.createVoucherFromBookingRates({
    //             bookingHeaderSid: Number(body.ParentSid),
    //             companyMasterSid: Number(body.companyMasterSid),
    //             branchMasterSid: Number(body.branchMasterSid),
    //             voucherTypeMasterSid: body.voucherTypeMasterSid ? Number(body.voucherTypeMasterSid) : undefined,
    //             voucherType: body.voucherType,
    //             selectedRateIds: body.selectedRateIds.map(id => Number(id)),
    //             billingPartySid: Number(body.billingPartySid),
    //             customerBranchSid: body.customerBranchSid ? Number(body.customerBranchSid) : undefined,
    //             createdBy: body.createdBy || 'System',
    //             invoiceHeader: body.invoiceHeader,
    //             chargeTaxGroups: body.chargeTaxGroups,
    //             DepartmentMasterSid: body.DepartmentMasterSid,
    //         });

    //         this.logger.debug(`generateVoucherFromBooking result: ${JSON.stringify(result)}`);
    //         output.data = result;
    //         output.message = "Voucher generated successfully";
    //     } catch (error) {
    //         this.logger.warn(`generateVoucherFromBooking error: ${JSON.stringify(error), error}`);
    //         output.status = false;
    //         if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
    //             output.message = error.message;
    //         } else {
    //             output.message = "Internal Server Error";
    //         }
    //     }
    //     return output;
    // }

    // @ApiOperation({ summary: 'Generate Voucher from Jobs' })
    // @ApiCreatedResponse({
    //     description: 'Voucher generated successfully from jobs',
    //     type: ResponseData
    // })
    // @HttpCode(HttpStatus.CREATED)
    // @Post('generate-from-jobs')
    // async generateVoucherFromJobs(@Body() body: any) {
    //     let output = new ResponseData();
    //     this.logger.log(`generateVoucherFromJobs request body: ${JSON.stringify(body)}`);

    //     try {
    //         // Validate required fields
    //         if (!body.ParentSid) {
    //             throw new BadRequestException('Job SID is required');
    //         }
    //         if (!body.selectedRateIds || !Array.isArray(body.selectedRateIds) || body.selectedRateIds.length === 0) {
    //             throw new BadRequestException('Selected Rate IDs are required');
    //         }
    //         if (!body.companyMasterSid) {
    //             throw new BadRequestException('Company Master SID is required');
    //         }
    //         if (!body.branchMasterSid) {
    //             throw new BadRequestException('Branch Master SID is required');
    //         }
    //         if (!body.billingPartySid) {
    //             throw new BadRequestException('Billing Party SID is required');
    //         }

    //         this.logger.log(`Billing Party SID from request: ${body.billingPartySid} (type: ${typeof body.billingPartySid})`);

    //         if (!body.voucherType || !['Invoice', 'Vendor Invoice'].includes(body.voucherType)) {
    //             throw new BadRequestException('Valid voucher type is required (Invoice or Vendor Invoice)');
    //         }

    //         const result = await this.voucherService.createVoucherFromJobs({
    //             jobSid: Number(body.ParentSid),
    //             companyMasterSid: Number(body.companyMasterSid),
    //             branchMasterSid: Number(body.branchMasterSid),
    //             menuMasterSid: body.MenuMasterSid,
    //             modelName : body.modelName,
    //             voucherTypeMasterSid: body.voucherTypeMasterSid ? Number(body.voucherTypeMasterSid) : undefined,
    //             masterJobSid : body.MasterJobSid || null,
    //             houseJobSid : body.HouseJobSid || null,
    //             houseNumber : body.HouseNumber || null,
    //             masterNumber : body.MasterNumber || null,
    //             voucherType: body.voucherType,
    //             selectedRateIds: body.selectedRateIds.map(id => Number(id)),
    //             billingPartySid: Number(body.billingPartySid),
    //             customerBranchSid: body.customerBranchSid ? Number(body.customerBranchSid) : undefined,
    //             createdBy: body.createdBy || 'System',
    //             invoiceHeader: body.invoiceHeader,
    //             chargeTaxGroups: body.chargeTaxGroups,
    //             DepartmentMasterSid: body.DepartmentMasterSid,
    //         });

    //         this.logger.debug(`generateVoucherFromJobs result: ${JSON.stringify(result)}`);
    //         output.data = result;
    //         output.message = "Voucher generated successfully";
    //     } catch (error) {
    //         this.logger.warn(`generateVoucherFromJobs error: ${JSON.stringify(error), error}`);
    //         output.status = false;
    //         if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
    //             output.message = error.message;
    //         } else {
    //             output.message = error;
    //         }
    //     }
    //     return output;
    // }

    @ApiOperation({ summary: 'Create Voucher' })
    @ApiCreatedResponse({
        description: 'Voucher has been created successfully',
        type: ResponseData
    })
    @HttpCode(HttpStatus.CREATED)
    @UsePipes(new ValidationPipe({ 
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true,
    }))
    @Post('create')
    async createVoucher(@Body() body: CreateVoucherPayload) {
        let response = new ResponseData();
        try {

            const result = await this.voucherService.createVoucher(body);

            response.data = result;
            response.message = "Voucher created successfully";
        } catch (error) {
            if (!(error instanceof DbTriggerValidationException)) {
                this.logger.warn(`createVoucher error: ${JSON.stringify(error), error}`);
            }
            response.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                response.message = error.message;
            } else {
                response.message = error;
            }
        }
        return response;
    }

    @ApiOperation({ summary: 'Post Voucher' })
    @ApiCreatedResponse({
        description: 'Voucher has been posted successfully',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Post('post-voucher')
    async postVoucher(@Body() body: any) {
        let output = new ResponseData();

        try {
            if(!body.VoucherHeaderSid){
                throw new BadRequestException('Voucher Header SID is required');
            }
            if(!body.CompanyMasterSid){
                throw new BadRequestException('Company Master SID is required');
            }
            if(!body.BranchMasterSid){
                throw new BadRequestException('Branch Master SID is required');
            }
            if(!body.YearMasterSid){
                throw new BadRequestException('Financial year Sid is required');
            }
            if(!body.PostedBy){
                throw new BadRequestException('Posted By is required');
            }
            const result = await this.voucherService.postVoucherByVoucherSid({
                voucherHeaderSid : Number(body.VoucherHeaderSid),
                companyMasterSid : Number(body.CompanyMasterSid),
                branchMasterSid : Number(body.BranchMasterSid),
                yearMasterSid : Number(body.YearMasterSid),
                localCurrencyMasterSid : Number(body.LocalCurrencyMasterSid),
                localCurrencyCode : body.LocalCurrencyCode,
                postedBy : body.PostedBy,
                taxDetails : body.TaxDetails
            });

            output.data = result;
            output.message = "Voucher posted successfully";
        } catch (error) {
            output.status = false;
            const vmsg = extractVoucherValidationMessage(error);
            if (vmsg) {
                // extractVoucherValidationMessage already logged one clean
                // [DbTriggerValidation] line — don't also emit the noisy generic warn
                output.message = vmsg;
            } else if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                this.logger.warn(`postVoucher error: ${JSON.stringify(error), error}`);
                output.message = error.message;
            } else {
                this.logger.warn(`postVoucher error: ${JSON.stringify(error), error}`);
                output.message = error;
            }
        }
        return output;
    }

    @ApiOperation({ summary: 'Delete Voucher' })
    @ApiCreatedResponse({
        description: 'Voucher has been deleted successfully',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @UsePipes(new ValidationPipe({ 
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true,
    }))
    @Post('delete-voucher')
    async deleteVoucher(
        @Body() payload: DeleteVoucherPayload
    ) {
        let output = new ResponseData();

        try {
            const result = await this.voucherService.deleteVoucher(payload);

            output.data = result;
            output.message = "Voucher has been deleted successfully";
        } catch (error) {
            this.logger.warn(`deleteVoucher error: ${JSON.stringify(error), error}`);
            output.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                output.message = error.message;
            } else {
                output.message = error;
            }
        }
        return output;
    }


    @ApiOperation({ summary : 'Delete Voucher Detail By VoucherDetailSid'})
    @ApiCreatedResponse({
        description: 'Voucher Detail has been deleted successfully',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Delete('delete-detail/:id')
    async deleteVoucherDetail(@Param('id', ParseIntPipe) VoucherDetailSid: number) {
        let output = new ResponseData();

        try {
            if(!VoucherDetailSid){
                throw new BadRequestException('Voucher Detail SID is required');
            }
            const result = await this.voucherService.softDeleteVoucherDetail(VoucherDetailSid);

            output.data = result;
            output.message = "Voucher Detail has been deleted successfully";
        } catch (error) {
            this.logger.warn(`deleteVoucherDetail error: ${JSON.stringify(error), error}`);
            output.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                output.message = error.message;
            } else {
                output.message = error;
            }
        }
        return output;
    }

    @ApiOperation({ summary : 'Check Posting mechanism for a voucher type'})
    @ApiCreatedResponse({
        description: 'Posting mechanism for a voucher type',
        type: ResponseData
    })
    @UsePipes(new ValidationPipe({ 
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true,
    }))
    @HttpCode(HttpStatus.OK)
    @Post('check-auto-posting')
    async checkAutoPosting(@Body() payload: CheckAutoPostingDto) {
        let output = new ResponseData();

        try {
            const result = await this.voucherService.checkAutoPosting(payload);

            output.data = result;
            output.message = `Posting mechanism for this voucher type : ${result ? 'Auto Posting' : 'Manual Posting'}`;
        } catch (error) {
            this.logger.warn(`checkAutoPosting error: ${JSON.stringify(error), error}`);
            output.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                output.message = error.message;
            } else {
                output.message = error;
            }
        }
        return output;
    }
}
