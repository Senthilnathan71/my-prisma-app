import { BadRequestException, Body, Controller, Delete, Get, HttpCode, HttpStatus, Logger, Param, ParseIntPipe, Patch, Post, UnauthorizedException } from "@nestjs/common";
import { ApiCreatedResponse, ApiOperation } from "@nestjs/swagger";
import { ResponseData } from "src/common/response-data";
import { SearchVesselDto } from "src/masters/DTO/search-vessel.dto";
import { BookingService } from "src/operation/services/booking/booking.service";

@Controller('ff-booking')
export class BookingController {
    constructor(private bookingService: BookingService, private logger: Logger) { }

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
            this.logger.warn(`getBookingById: ${JSON.stringify(error)}`)
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
    async searchBooking(@Body() body: SearchVesselDto) {
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
}