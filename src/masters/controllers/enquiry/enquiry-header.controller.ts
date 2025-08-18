import { BadRequestException, Body, Controller, Delete, Get, HttpCode, HttpStatus, Logger, Param, ParseIntPipe, Patch, Post, Query, UnauthorizedException } from "@nestjs/common";
import { ApiCreatedResponse, ApiOperation } from "@nestjs/swagger";
import { Auth } from "src/common/decorators/auth.decorator";
import { UserData } from "src/common/decorators/user.decorator";
import { ResponseData } from "src/common/response-data";
import { SearchVesselDto } from "src/masters/DTO/search-vessel.dto";
import { EnquiryHeaderService } from "src/masters/services/enquiry/enquiry-header.service";

@Controller('ff-enquiry')
@Auth()
export class EnquiryHeaderController {
    constructor(
        private enquiryHeaderService: EnquiryHeaderService,
        private logger: Logger
    ) { }

    @ApiOperation({ summary: 'Enquiry header' })
    @ApiCreatedResponse({
        description: 'Enquiry Header,Route,cargo created successfully',
        type: ResponseData
    })
    @HttpCode(HttpStatus.CREATED)
    @Post()
    async createEnquiryHeader(@Body() body: any) {
        let output = new ResponseData
        this.logger.debug(`createEnquiryHeader: Enquiry Header Creation payload- ${JSON.stringify(body)}`)
        try {
            let enquiry = await this.enquiryHeaderService.createEnquiry(body);
            this.logger.debug(`createEnquiryHeader: Enquiry Header Creation- ${JSON.stringify(enquiry)}`)
            if (!enquiry) {
                this.logger.log(`createEnquiryHeader: Something went wrong`)
                throw 'Something went wrong'
            }
            output.data = enquiry.data;
            output.message = enquiry.message;
            output.status = true

        } catch (error) {
            this.logger.warn(`createEnquiryHeader:Enquiry Header Failed - ${error}`)
            output.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                output.message = error.message;
            } else {
                output.message = error;
            }
        }
        return output
    }

    @ApiOperation({ summary: 'Get All Enquiry Header, Route, Cargo' })
    @ApiCreatedResponse({
        description: 'Enquiry Header,Route,cargo Fetch All Data',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Get()
    async getAllEnquiries(@UserData() UserData: any) {
        const output = new ResponseData
        try {
            const enquiries = await this.enquiryHeaderService.getAllEnquiries()
            output.data = enquiries;
            this.logger.debug(`getAllEnquiries: Fetch Enquiry Data- ${JSON.stringify(enquiries)}`)

        } catch (error) {
            this.logger.debug(`getAllEnquiries: Enquiry data fetch failed- ${JSON.stringify(error)}`)
            output.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                output.message = error.message;
            } else {
                output.message = 'Internal Server Error';
            }
        }
        return output;
    }

    @ApiOperation({ summary: 'Enquiry Header by id' })
    @ApiCreatedResponse({
        description: 'Enquiry Header,Route,cargo Fetch Data By Id',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Get('header/:id')
    async getEnquiryById(@Param('id', ParseIntPipe) enquiryId: number) {
        const output = new ResponseData;
        try {
            const enquiry = await this.enquiryHeaderService.findOne(enquiryId)
            output.data = enquiry
            this.logger.debug(`getEnquiryById: Fetch Enquiry Data- ${JSON.stringify(enquiry)}`)

        } catch (error) {
            this.logger.debug(`getEnquiryById: Enquiry Fetching failed - ${JSON.stringify(error)}`)

            output.status = false;
            output.message = error
        }
        return output;
    }



    @ApiOperation({ summary: 'Update Enquiry header' })
    @ApiCreatedResponse({
        description: 'Enquiry Header,Route,cargo updated successfully',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Patch('header/:id')
    async editEnquiry(@Param('id', ParseIntPipe) id: number, @Body() body: any) {
        this.logger.debug(`editEnquiry: Enquiry Header update payload- ${JSON.stringify(body), id}`)
        let output = new ResponseData
        try {
            let enquiry = await this.enquiryHeaderService.updateEnquiry(id, body);
            if (!enquiry) {
                this.logger.log(`editEnquiry: Update Enquiry Header ${enquiry}`)
                throw 'Something went wrong'
            }
            output.data = enquiry.data;
            output.message = enquiry.message;
            output.status = enquiry.status
            this.logger.log(`editEnquiry: Update Enquiry Header ${enquiry}`)
        } catch (error) {
            this.logger.warn(`editEnquiry:  Update Enquiry Header failed ${error}`)
            output.status = false;
            // Handle error message based on the type of error
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                output.message = error.message;
            } else {
                output.message = error;
            }
        }
        return output
    }


    @ApiOperation({ summary: 'Delete Enquiry header' })
    @ApiCreatedResponse({
        description: 'Enquiry Header,Route,cargo deleted successfully',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Delete('header/:id')
    async softDelete(@Param('id', ParseIntPipe) id: number) {
        return this.enquiryHeaderService.softDelete(id);
    }


    @ApiOperation({ summary: 'Get Department' })
    @ApiCreatedResponse({
        description: 'Department Data Fetch Successfully',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Get('department')
    async getAllDepartments(@UserData() UserData: any) {
        const output = new ResponseData
        try {
            const department = await this.enquiryHeaderService.getAllDepartment()
            output.data = department;
        } catch (error) {
            output.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                output.message = error.message;
            } else {
                output.message = 'Internal Server Error';
            }
        }
        return output;
    }


    @ApiOperation({ summary: 'Fetch Package Type Data' })
    @ApiCreatedResponse({
        description: 'Package Type Data Fetch Successfully',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Get('package-type')
    async getAllCargoTypes(@UserData() UserData: any) {
        const output = new ResponseData
        try {
            const cargoType = await this.enquiryHeaderService.getAllCargoTypes()
            output.data = cargoType;
        } catch (error) {
            output.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                output.message = error.message;
            } else {
                output.message = 'Internal Server Error';
            }
        }
        return output;
    }


    @ApiOperation({ summary: 'Get container type' })
    @ApiCreatedResponse({
        description: 'Fetch Container Type data',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Get('container-type')
    async getAllContainers(@UserData() UserData: any) {
        const output = new ResponseData
        try {
            const containerType = await this.enquiryHeaderService.getAllContainerTypes()
            output.data = containerType;
        } catch (error) {
            output.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                output.message = error.message;
            } else {
                output.message = 'Internal Server Error';
            }
        }
        return output;
    }

    @ApiOperation({ summary: 'Search List of Enquiry' })
    @ApiCreatedResponse({
        description: 'Search List of Enquiry',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Post('search-list')
    async searchEnquiry(@Body() param: SearchVesselDto) {
        let resp = new ResponseData();
        try {
            let res = await this.enquiryHeaderService.searchEnquiry(param);
            this.logger.log(`Enquiry Search Data : ${JSON.stringify(res)}`);
            resp.data = res;
            resp.message = "Enquiry Search is successfully fetched";
        } catch (error) {
            this.logger.warn(`Enquiry Search Error : ${JSON.stringify(error),error}`);
            resp.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                resp.message = error.message;
            } else {
                resp.message = "Internal Server Error";
            }
        }
        return resp;
    }
    
    @ApiOperation({ summary: 'Get Audit Logs for a Table/Record' })
      @ApiCreatedResponse({ description: 'Fetch audit logs', type: ResponseData })
      @HttpCode(HttpStatus.OK)
      @Get('fetch/audit-logs')
      async getAuditLogs(
        @Query('tableName') tableName: string,
        @Query('recordId') recordId?: string,
      ) {
        const resp = new ResponseData();
        try {
          if (!tableName) throw new Error('tableName query parameter is required');
    
          const logs = await this.enquiryHeaderService.getAuditLogs(tableName, recordId);
    
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
    
}