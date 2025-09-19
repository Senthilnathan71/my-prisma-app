import { BadRequestException, Body, Controller, Delete, Get, HttpCode, HttpStatus, Logger, Param, ParseIntPipe, Patch, Post, Query, UnauthorizedException, UploadedFile, UseInterceptors } from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { ApiCreatedResponse, ApiOperation } from "@nestjs/swagger";
import { ResponseData } from "src/common/response-data";
import { EmailService } from "src/email/email.service";
import { filterDto } from "src/masters/DTO/search-vessel.dto";
import { BookingService } from "src/operation/services/booking/booking.service";

@Controller('ff-booking')
export class BookingController {
    constructor(private bookingService: BookingService, private logger: Logger,private emailService:EmailService) { }

    @ApiOperation({ summary: 'Create Booking' })
    @ApiCreatedResponse({
        description: 'Booking Header, Cargo, Products, Others, Connections created successfully',
        type: ResponseData
    })
    @HttpCode(HttpStatus.CREATED)
    @Post('create')
    async createBooking(@Body() body: any) {
        let output = new ResponseData()
        this.logger.log(`createBooking: ${JSON.stringify(body)}`)
        try {
            let booking = await this.bookingService.createBooking(body);
            this.logger.debug(`createBooking: ${JSON.stringify(booking)}`)
            output.data = booking;
            output.message = "Booking created successfully";
        } catch (error) {
            this.logger.warn(`createBooking: ${JSON.stringify(error), error}`)
            output.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                output.message = error.message;
            } else {
                output.message = "Internal Server Error";
            }
        }
        return output
    }

    @ApiOperation({ summary: 'Get All Bookings' })
    @ApiCreatedResponse({
        description: 'All Bookings fetched successfully',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Get()
    async getAllBookings() {
        const output = new ResponseData();
        try {
            const bookings = await this.bookingService.getAllBooking()
            this.logger.debug(`getAllBookings: ${JSON.stringify(bookings)}`)
            output.data = bookings;
            output.message = "All Bookings fetched successfully"
        } catch (error) {
            this.logger.warn(`getAllBookings: ${JSON.stringify(error)}`)
            output.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                output.message = error.message;
            } else {
                output.message = 'Internal Server Error';
            }
        }
        return output;
    }

    @ApiOperation({ summary: 'Get Booking by ID' })
    @ApiCreatedResponse({
        description: 'Booking data fetched successfully by ID',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Get('fetch/:BookingHeaderSid')
    async getBookingById(@Param('BookingHeaderSid', ParseIntPipe) BookingHeaderSid: number) {
        const output = new ResponseData();
        try {
            const booking = await this.bookingService.findBookingById(BookingHeaderSid)
            this.logger.debug(`getBookingById: ${JSON.stringify(booking)}`)
            output.data = booking
            output.message = "Booking data fetched successfully by ID"
        } catch (error) {
            this.logger.warn(`getBookingById: ${JSON.stringify(error),error}`)
            output.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                output.message = error.message;
            } else {
                output.message = error;
            }
        }
        return output;
    }

    @ApiOperation({ summary: 'Update Booking' })
    @ApiCreatedResponse({
        description: 'Booking Header, Cargo, Products, Others, Connections updated successfully',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Patch('update/:BookingHeaderSid')
    async updateBooking(@Param('BookingHeaderSid', ParseIntPipe) BookingHeaderSid: number, @Body() body: any) {
        let output = new ResponseData
        try {
            let booking = await this.bookingService.updateBookingById(BookingHeaderSid, body);
            this.logger.debug(`updateBooking: ${JSON.stringify(booking)}`)
            output.data = booking;
            output.message = "Booking updated successfully";

        } catch (error) {
            this.logger.warn(`updateBooking: ${JSON.stringify(error), error}`)
            output.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                output.message = error.message;
            } else {
                output.message = error;
            }
        }
        return output
    }

    @ApiOperation({ summary: 'Delete Booking By ID' })
    @ApiCreatedResponse({
        description: 'Booking deleted successfully',
        type: ResponseData
    })
    @Delete('deleteBooking/:BookingHeaderSid')
    async deleteBooking(@Param('BookingHeaderSid', ParseIntPipe) BookingHeaderSid: number) {
        let output = new ResponseData
        try {
            let booking = await this.bookingService.deleteBooking(BookingHeaderSid);
            this.logger.debug(`deleteBooking: ${JSON.stringify(BookingHeaderSid)}`)
            output.data = booking;
            output.message = "Booking deleted successfully";

        } catch (error) {
            this.logger.warn(`deleteBooking: ${JSON.stringify(error), error}`)
            output.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                output.message = error.message;
            } else {
                output.message = error;
            }
        }
        return output
    }

    @ApiOperation({ summary: 'Search List of Bookings' })
    @ApiCreatedResponse({
        description: 'Search List of Bookings',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Post('search-list')
    async searchBooking(@Body() body: filterDto) {
        let resp = new ResponseData();
        try {
            let res = await this.bookingService.searchBooking(body);
            this.logger.log(`Booking Search Result : ${JSON.stringify(res)}`);
            resp.data = res;
            resp.message = "Booking Search is successfully fetched";
        } catch (error) {
            this.logger.warn(`Booking Search Error : ${error}`)
            resp.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                resp.message = error.message;
            } else {
                resp.message = "Internal Server Error";
            }
        }
        return resp;
    }

    @ApiOperation({ summary: 'Delete Booking Product By ID' })
    @ApiCreatedResponse({
        description: 'Booking Product deleted successfully',
        type: ResponseData
    })
    @Delete('product/:BookingProductSid')
    async deleteBookingProduct(@Param('BookingProductSid', ParseIntPipe) BookingProductSid: number) {
        let output = new ResponseData
        try {
            let bookingProduct = await this.bookingService.softDeleteBookingProduct(BookingProductSid);
            this.logger.debug(`deleteBookingProduct: ${JSON.stringify(bookingProduct)}`)
            output.data = bookingProduct;
            output.message = "Booking Product deleted successfully";

        } catch (error) {
            this.logger.warn(`deleteBookingProduct: ${JSON.stringify(error), error}`)
            output.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                output.message = error.message;
            } else {
                output.message = error;
            }
        }
        return output
    }

    @ApiOperation({ summary: 'Delete Booking Connection By ID' })
    @ApiCreatedResponse({
        description: 'Booking Connection deleted successfully',
        type: ResponseData
    })
    @Delete('connection/:BookingConnectionSid')
    async deleteBookingConnection(@Param('BookingConnectionSid', ParseIntPipe) BookingConnectionSid: number) {
        let output = new ResponseData
        try {
            let bookingConnection = await this.bookingService.softDeleteBookingConnection(BookingConnectionSid);
            this.logger.debug(`deleteBookingConnection: ${JSON.stringify(bookingConnection)}`)
            output.data = bookingConnection;
            output.message = "Booking Connection deleted successfully";

        } catch (error) {
            this.logger.warn(`deleteBookingConnection: ${JSON.stringify(error), error}`)
            output.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                output.message = error.message;
            } else {
                output.message = error;
            }
        }
        return output
    }

    @ApiOperation({ summary: 'Delete Booking Rates By ID' })
    @ApiCreatedResponse({
        description: 'Booking Rates deleted successfully',
        type: ResponseData
    })
    @Delete('rates/:BookingRatesSid')
    async deleteBookingRate(@Param('BookingRatesSid', ParseIntPipe) BookingRatesSid: number) {
        let output = new ResponseData
        try {
            let bookingConnection = await this.bookingService.softDeleteBookingRates(BookingRatesSid);
            this.logger.debug(`deleteBookingRates: ${JSON.stringify(bookingConnection)}`)
            output.data = bookingConnection;
            output.message = "Booking Rates deleted successfully";

        } catch (error) {
            this.logger.warn(`deleteBookingRates: ${JSON.stringify(error), error}`)
            output.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                output.message = error.message;
            } else {
                output.message = error;
            }
        }
        return output
    }

    @ApiOperation({ summary: 'Get All Booking Header Lookups' })
    @ApiCreatedResponse({
        description: 'All Booking Header Lookups are fetched successfully',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Post('header-lookup')
    async getAllHeaderLookups(@Body() payload: any) {
        const output = new ResponseData();
        try {
            const bookings = await this.bookingService.getAllHeaderLookups(payload)
            this.logger.debug(`getAllHeaderLookups: ${JSON.stringify(bookings)}`)
            output.data = bookings;
            output.message = "All Header Lookups fetched successfully"
        } catch (error) {
            this.logger.warn(`getAllHeaderLookups: ${JSON.stringify(error), error}`)
            output.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                output.message = error.message;
            } else {
                output.message = 'Internal Server Error';
            }
        }
        return output;
    }


    @ApiOperation({ summary: 'Get Customer Related Lookups' })
    @ApiCreatedResponse({
        description: 'Customer Related Lookups fetched successfully',
        type: ResponseData
    })
    @Post('customer-lookup')
    async getCustomerLookupData(@Body() payload: any) {
        let output = new ResponseData()
        try {
            let lookupDatas = await this.bookingService.getCustomerRelatedLookups(payload);
            this.logger.debug(`CustomerRelatedLookupData: ${JSON.stringify(lookupDatas)}`)
            output.data = lookupDatas;
            output.message = "Customer related lookups fetched successfully";

        } catch (error) {
            this.logger.warn(`Fetching CustomerRelatedLookupData error: ${JSON.stringify(error), error}`)
            output.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                output.message = error.message;
            } else {
                output.message = error;
            }
        }
        return output
    }

    @ApiOperation({ summary: 'Get All Container Type' })
    @ApiCreatedResponse({
        description: 'All Container Types are fetched successfully',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Get('container-type')
    async getAllContainerTypes() {
        const output = new ResponseData();
        try {
            const containerTypes = await this.bookingService.getAllContainerTypes()
            this.logger.debug(`getAllContainerTypes: ${JSON.stringify(containerTypes)}`)
            output.data = containerTypes;
            output.message = "All Container Types fetched successfully"
        } catch (error) {
            this.logger.warn(`getAllContainerTypes: ${JSON.stringify(error), error}`)
            output.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                output.message = error.message;
            } else {
                output.message = 'Internal Server Error';
            }
        }
        return output;
    }

    @ApiOperation({ summary: 'Get All Currencies' })
    @ApiCreatedResponse({
        description: 'All Currencies are fetched successfully',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Get('currency')
    async getAllCurrencies() {
        const output = new ResponseData();
        try {
            const currencies = await this.bookingService.getAllCurrencies()
            this.logger.debug(`getAllCurrencies: ${JSON.stringify(currencies)}`)
            output.data = currencies;
            output.message = "All Currencies are fetched successfully"
        } catch (error) {
            this.logger.warn(`getAllCurrencies: ${JSON.stringify(error), error}`)
            output.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                output.message = error.message;
            } else {
                output.message = 'Internal Server Error';
            }
        }
        return output;
    }

    @ApiOperation({ summary: 'Get Product Lookups' })
    @ApiCreatedResponse({
        description: 'Booking Product Lookups fetched successfully',
        type: ResponseData
    })
    @Post('product-lookup')
    async getProductLookups(@Body() payload: any) {
        let output = new ResponseData()
        try {
            let lookupDatas = await this.bookingService.getAllProductLookups(payload);
            this.logger.debug(`getProductLookups: ${JSON.stringify(lookupDatas)}`)
            output.data = lookupDatas;
            output.message = "Product lookups fetched successfully";

        } catch (error) {
            this.logger.warn(`getProductLookups error: ${JSON.stringify(error), error}`)
            output.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                output.message = error.message;
            } else {
                output.message = error;
            }
        }
        return output
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
    
          const logs = await this.bookingService.getAuditLogs(tableName, recordId);
    
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

    @ApiOperation({ summary: 'Get All Milestone' })
    @ApiCreatedResponse({
        description: 'All Milestones are fetched successfully',
        type: ResponseData
    })
    @Post('milestone')
    async getAllMilestones(@Body() payload: any) {
        let output = new ResponseData()
        try {
            let lookupDatas = await this.bookingService.getAllMilestones(payload);
            this.logger.debug(`getAllMilestones: ${JSON.stringify(lookupDatas)}`)
            output.data = lookupDatas;
            output.message = "All Milestone fetched successfully";

        } catch (error) {
            this.logger.warn(`getAllMilestones error: ${JSON.stringify(error), error}`)
            output.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                output.message = error.message;
            } else {
                output.message = error;
            }
        }
        return output
    }


    @ApiOperation({ summary: 'Get Shipment Milestone by Shipment No' })
    @ApiCreatedResponse({
        description: 'All Shipment Milestone by Shipment No are fetched successfully',
        type: ResponseData
    })
    @Post('shipment-milestone')
    async getShipmentMilestoneByShipmentNo(@Body() payload: any) {
        let output = new ResponseData()
        try {
            let lookupDatas = await this.bookingService.getShipmentMilestoneByShipmentNo(payload);
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

    @ApiOperation({ summary: 'Get Rate Lookups' })
    @ApiCreatedResponse({
        description: 'Booking Rate Lookups fetched successfully',
        type: ResponseData
    })
    @Post('rate-lookup')
    async getRateLookups(@Body() payload: any) {
        let output = new ResponseData()
        try {
            let lookupDatas = await this.bookingService.getAllRateLookups(payload);
            this.logger.debug(`getRateLookups: ${JSON.stringify(lookupDatas)}`)
            output.data = lookupDatas;
            output.message = "Rate lookups fetched successfully";

        } catch (error) {
            this.logger.warn(`getRateLookups error: ${JSON.stringify(error), error}`)
            output.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                output.message = error.message;
            } else {
                output.message = error;
            }
        }
        return output
    }

    @ApiOperation({ summary: 'Get Tariff Details by Booking Details' })
    @ApiCreatedResponse({
        description: 'Getting Tariff Details by Booking Details',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Post('tariffDetails')
    async getTariffDetails(@Body() bookingDetails: any) {
        const output = new ResponseData()
        try {
            const tariffs = await this.bookingService.getTariffByBookingDetails(bookingDetails)
            this.logger.debug(`getTariffDetails: ${JSON.stringify(tariffs)}`)
            output.data = tariffs;
            output.message = "All tariff details are successfully fetched for respective routes"
        } catch (error) {
            this.logger.warn(`getTariffDetails: ${JSON.stringify(error), error}`)

            output.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                output.message = error.message;
            } else {
                output.message = 'Internal Server Error';
            }
        }
        return output;
    }

    @ApiOperation({ summary: 'Booking Print' })
    @ApiCreatedResponse({
        description: 'Booking Print Sent successfully',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @UseInterceptors(FileInterceptor('file'))
    @Post('send/email')
    async bookingPrint(@UploadedFile() file: Express.Multer.File,
        @Body() body: any) {
        let output = new ResponseData();
        try {
            const reportPayload = {
                email: body.EmailTo,
                cc: body.EmailCC,
                subject: body.Subject,
                html: body.Mailbody,
                file, // this is the PDF file from FormData
            };
            console.log(reportPayload);
            let res = await this.emailService.sendReportEmail(reportPayload);
            this.logger.log(`Booking Print Sent Successfully : ${JSON.stringify(res)}`);
            output.data = res;
            output.message = "Booking Print Sent successfully";
        } catch (error) {
            this.logger.warn(`Booking Print Error : ${error}`)
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