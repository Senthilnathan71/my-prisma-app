import { BadRequestException, Body, Controller, Delete, Get, HttpCode, HttpStatus, Logger, Param, ParseIntPipe, Patch, Post, UnauthorizedException } from "@nestjs/common";
import { ApiCreatedResponse, ApiOperation } from "@nestjs/swagger";
import { Auth } from "src/common/decorators/auth.decorator";
import { UserData } from "src/common/decorators/user.decorator";
import { ResponseData } from "src/common/response-data";
import { EnquiryHeaderService } from "src/masters/services/enquiry/enquiry-header.service";
import { PortService } from "src/masters/services/port/port-master.service";

@Controller('port')
@Auth()
export class PortMasterController {
    constructor(private portService: PortService, private logger: Logger) { }

    @ApiOperation({ summary: 'Get All Ports' })
    @ApiCreatedResponse({
        description: 'Get All Ports',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Get()
    async getAllPorts(@UserData() UserData: any) {
        const output = new ResponseData
        try {
            const ports = await this.portService.getAllPorts()
            this.logger.log(`getAllPorts: ${JSON.stringify(ports)}`)
            output.data = ports;
        } catch (error) {
            this.logger.warn(`getAllPorts: ${JSON.stringify(error)}`)
            output.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                output.message = error.message;
            } else {
                output.message = 'Internal Server Error';
            }
        }
        return output;
    }


    @ApiOperation({ summary: 'Port Creation' })
    @ApiCreatedResponse({
        description: 'Port Creation',
        type: ResponseData
    })
    @HttpCode(HttpStatus.CREATED)
    @Post()
    async createPort(@Body() body: any, @UserData() user: any) {
        this.logger.log(`createPortdata: ${JSON.stringify(body)}`)
        let output = new ResponseData
        try {
            let port = await this.portService.createPort(body, user);
            this.logger.debug(`createPorttry: ${JSON.stringify(port)}`)
            if (!port) {
                this.logger.warn(`createPorterror!!: ${JSON.stringify(port)}`)
                throw 'Something went wrong'
            }
            output.data = port
        } catch (error) {
            this.logger.warn(`createporterror: ${error}`)
            output.status = false;
            // Handle error message based on the type of error
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                output.message = error.message;
                this.logger.warn(`createportexception: ${error.message}`)
            } else {
                this.logger.warn(`createportelse: ${error}`)
                output.message = error;
            }
        }
        return output
    }



    @ApiOperation({ summary: 'Get Port By Id' })
    @ApiCreatedResponse({
        description: 'Get Port By Id',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Get(':id')
    async getPortById(@Param('id', ParseIntPipe) portId: number) {
        const output = new ResponseData;
        try {
            const port = await this.portService.findOne(portId)
            this.logger.log(`getPortById: ${JSON.stringify(port)}`)
            output.data = port
        } catch (error) {
            this.logger.warn(`getPortById: ${JSON.stringify(error)}`)
            output.status = false;
            output.message = error
        }
        return output;
    }



    @ApiOperation({ summary: 'Update Port By Id' })
    @ApiCreatedResponse({
        description: 'Update Port By Id',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Patch(':id')
    async editPort(@Param('id', ParseIntPipe) id: number, @Body() body: any, @UserData() user: any) {
        this.logger.log(`editPortbody: ${JSON.stringify(body)}`)
        let output = new ResponseData
        try {
            let port = await this.portService.updatePort(id, body, user);
            this.logger.log(`editPort: ${JSON.stringify(port)}`)

            if (!port) {
                this.logger.log(`editPort!!: ${JSON.stringify(port)}`)
                throw 'Something went wrong'
            }else{
                this.logger.log(`editPortelse: ${port}`)
            }
            output.data = port;

        } catch (error) {
            this.logger.warn(`editPorterror: ${JSON.stringify(error),error}`)
            output.status = false;
            // Handle error message based on the type of error
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                  this.logger.warn(`editPortbadrequest: ${error}`)
                output.message = error.message;
            } else {
                output.message = error;
            }
        }
        this.logger.warn(`editPortmessage: ${output.message}`)
        return output
    }


    @ApiOperation({ summary: 'Delete Port By Id' })
    @ApiCreatedResponse({
        description: 'Delete Port By Id',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK) @Delete(':id')
    async softDelete(@Param('id', ParseIntPipe) id: number) {
        return this.portService.softDelete(id);
    }

}