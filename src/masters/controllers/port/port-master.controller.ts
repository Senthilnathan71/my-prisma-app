import { BadRequestException, Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, UnauthorizedException } from "@nestjs/common";
import { Auth } from "src/common/decorators/auth.decorator";
import { UserData } from "src/common/decorators/user.decorator";
import { ResponseData } from "src/common/response-data";
import { EnquiryHeaderService } from "src/masters/services/enquiry/enquiry-header.service";
import { PortService } from "src/masters/services/port/port-master.service";

@Controller('port')
@Auth()
export class PortMasterController {
    constructor(private portService: PortService) { }

    @Get()
    async getAllPorts(@UserData() UserData: any) {
        const output = new ResponseData
        try {
            const ports = await this.portService.getAllPorts()
            output.data = ports;
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
    @Post()
    async createPort(@Body() body: any, @UserData() user: any) {
        let output = new ResponseData
        try {
            let port = await this.portService.createPort(body, user);
            if (!port) {
                throw 'Something went wrong'
            }
            output.data = port
        } catch (error) {
            console.log("controler error::", error);
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



    @Get(':id')
    async getPortById(@Param('id', ParseIntPipe) portId: number) {
        const output = new ResponseData;
        try {
            output.data = await this.portService.findOne(portId)
        } catch (error) {
            output.status = false;
            output.message = error
        }
        return output;
    }



    @Patch(':id')
    async editPort(@Param('id', ParseIntPipe) id: number, @Body() body: any, @UserData() user: any) {
        let output = new ResponseData
        try {
            let port = await this.portService.updatePort(id, body, user);
            if (!port) {
                throw 'Something went wrong'
            }
            output.data = port;

        } catch (error) {
            console.log("controler error::", error);
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


    @Delete(':id')
    async softDelete(@Param('id', ParseIntPipe) id: number) {
        return this.portService.softDelete(id);
    }

}