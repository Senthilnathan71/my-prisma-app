import { BadRequestException, Body, Controller, Delete, Get, HttpCode, HttpStatus, Logger, Param, ParseIntPipe, Patch, Post, UnauthorizedException } from "@nestjs/common";
import { ApiCreatedResponse, ApiOperation } from "@nestjs/swagger";
import { Auth } from "src/common/decorators/auth.decorator";
import { UserData } from "src/common/decorators/user.decorator";
import { ResponseData } from "src/common/response-data";
import { EnquiryHeaderService } from "src/crm/services/enquiry/enquiry-header.service";

@Controller('enquiry')
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
    async createEnquiryHeader(@Body() body: any, @UserData() user: any) {
        let output = new ResponseData
        this.logger.debug(`createEnquiryHeader: Enquiry Header Creation payload- ${JSON.stringify(body)}`)
        try {
            let enquiry = await this.enquiryHeaderService.createEnquiry(body, user);
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
    async editEnquiry(@Param('id', ParseIntPipe) id: number, @Body() body: any, @UserData() user: any) {
        this.logger.debug(`editEnquiry: Enquiry Header update payload- ${JSON.stringify(body), id}`)
        let output = new ResponseData
        try {
            let enquiry = await this.enquiryHeaderService.updateEnquiry(id, body, user);
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


    @ApiOperation({ summary: 'Delete Enquiry Route' })
    @ApiCreatedResponse({
        description: 'Enquiry Route Deleted Successfully',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Delete('deleteRoute/:EnquiryRouteSid')
    async deleteEnqRouteById(@Param('EnquiryRouteSid',ParseIntPipe) EnquiryRouteSid : number) {
        const output = new ResponseData
        try {
            const route = await this.enquiryHeaderService.softDeleteRoute(EnquiryRouteSid)
            output.data = route;
            output.message = 'Enquiry Route Deleted Successfully'
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

    @ApiOperation({ summary: 'Delete Enquiry Cargo' })
    @ApiCreatedResponse({
        description: 'Enquiry Cargo Deleted Successfully',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Delete('deleteCargo/:EnquiryRouteSid')
    async deleteEnqCargoById(@Param('EnquiryRouteSid', ParseIntPipe) EnquiryRouteSid: number) {
        const output = new ResponseData
        try {
            const cargo = await this.enquiryHeaderService.softDeleteCargo(EnquiryRouteSid)
            output.data = cargo;
            output.message = 'Enquiry Cargo Deleted Successfully'
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
            this.logger.error('Error loading ContainerType',JSON.stringify(error),error)
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                output.message = error.message;
            } else {
                output.message = 'Internal Server Error';
            }
        }
        return output;
    }


}