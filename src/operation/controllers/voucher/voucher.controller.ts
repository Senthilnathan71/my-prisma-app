import { BadRequestException, Body, Controller, Delete, HttpCode, HttpStatus, Logger, Param, ParseIntPipe, Post, UnauthorizedException, UsePipes, ValidationPipe } from "@nestjs/common";
import { ApiCreatedResponse, ApiOperation } from "@nestjs/swagger";
import { CreateVoucherPayload } from "src/accounts/dto/voucher.dto";
import { ResponseData } from "src/common/response-data";
import { VoucherService } from "src/operation/services/voucher/voucher.service";

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
            this.logger.log(`createVoucher request body: ${JSON.stringify(body)}`);
            const result = await this.voucherService.createVoucher(body);
            this.logger.debug(`createVoucher result: ${JSON.stringify(result)}`);
            response.data = result;
            response.message = "Voucher created successfully";
        } catch (error) {
            this.logger.warn(`createVoucher error: ${JSON.stringify(error), error}`);
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
        this.logger.log(`generateVoucherFromJobs request body: ${JSON.stringify(body)}`);

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
            this.logger.debug(`postVoucher result: ${JSON.stringify(result)}`);
            output.data = result;
            output.message = "Voucher posted successfully";
        } catch (error) {
            this.logger.warn(`postVoucher error: ${JSON.stringify(error), error}`);
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
        this.logger.log(`deleteVoucherDetail request body: ${JSON.stringify(VoucherDetailSid)}`);
        try {
            if(!VoucherDetailSid){
                throw new BadRequestException('Voucher Detail SID is required');
            }
            const result = await this.voucherService.softDeleteVoucherDetail(VoucherDetailSid);
            this.logger.debug(`deleteVoucherDetail result: ${JSON.stringify(result)}`);
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
}
