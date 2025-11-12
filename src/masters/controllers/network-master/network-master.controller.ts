import { BadRequestException, Body, Controller, Delete, Get, HttpCode, HttpStatus, Logger, Param, ParseIntPipe, Patch, Post, Query, UnauthorizedException } from '@nestjs/common';
import { ApiCreatedResponse, ApiOperation } from '@nestjs/swagger';
import { Auth } from 'src/common/decorators/auth.decorator';
import { UserData } from 'src/common/decorators/user.decorator';
import { ResponseData } from 'src/common/response-data';
import { SearchListDto } from 'src/masters/DTO/search-list.dto';
import { filterDto } from 'src/masters/DTO/search-vessel.dto';
import { NetworkMasterService } from 'src/masters/services/network-master/network-master.service';

class CompanyIdDto {
    CompanyMasterSid: number;
}

@Controller('network-master')
export class NetworkMasterController {
    constructor(private networkMasterService: NetworkMasterService, private logger: Logger) { }

    @ApiOperation({ summary: 'Network Creation' })
    @ApiCreatedResponse({
        description: 'Network Creation',
        type: ResponseData
    })
    @HttpCode(HttpStatus.CREATED)
    @Post('create')
    async createNetwork(@Body() body: any) {
        this.logger.log(`createNetwork data: ${JSON.stringify(body)}`)
        let output = new ResponseData
        try {
            let network = await this.networkMasterService.createNetwork(body);
            this.logger.debug(`createNetwork: ${JSON.stringify(network)}`)
            if (!network) {
                this.logger.warn(`createNetwork!!: ${JSON.stringify(network)}`)
                throw 'Something went wrong'
            }
            output.data = network
            output.message = 'Network Created Successfully'
        } catch (error) {
            this.logger.warn(`createNetworkError: ${error}`)
            output.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                output.message = error.message;
            } else {
                output.message = "Internal Server Error";
            }
        }
        return output;
    }

    @ApiOperation({ summary: 'Get All Networks' })
    @ApiCreatedResponse({
        description: 'Get All Networks',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Post()
    async getAllNetworks(@Body() body: CompanyIdDto) {
        let output = new ResponseData;
        try {
            let NetworkData = await this.networkMasterService.getAllNetworks(body.CompanyMasterSid);
            this.logger.log(`getAllNetworks: ${JSON.stringify(NetworkData)}`)
            output.data = NetworkData;
            output.message = "All Networks are successfully fetched";
        } catch (error) {
            this.logger.warn(`getAllNetworks: ${JSON.stringify(error)}`)
            output.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                output.message = error.message;
            } else {
                output.message = 'Internal Server Error';
            }
        }
        return output
    }

    @ApiOperation({ summary: 'Get Network by type' })
    @ApiCreatedResponse({ description: 'Get Network by type', type: ResponseData })
    @HttpCode(HttpStatus.OK)
    @Post('network-type') 
    async getNetworkByType(
        @Query('type') type: string,
        @Body() body: CompanyIdDto
    ) {
        const resp = new ResponseData();
        try {
            const res = await this.networkMasterService.getNetworkByType(type, body.CompanyMasterSid);
            this.logger.log(`Network by type : ${JSON.stringify(res)}`);
            resp.data = res;
            resp.message = "Network by type is successfully fetched";
        } catch (error) {
            this.logger.warn(`Network by type Error : ${JSON.stringify(error)}`, error);
            resp.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                resp.message = error.message;
            } else {
                resp.message = "Internal Server Error";
            }
        }
        return resp;
    }

    @ApiOperation({ summary: 'Get Network By Id' })
    @ApiCreatedResponse({
        description: 'Get Network By Id',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Get('fetch/:id')
    async getNetworkById(@Param('id', ParseIntPipe) NetworkMasterSid: number) {
        const output = new ResponseData;
        try {
            const Network = await this.networkMasterService.findOne(NetworkMasterSid)
            this.logger.log(`getNetworkById: ${JSON.stringify(Network)}`)
            output.data = Network;
            output.message = `Network with id : ${NetworkMasterSid} is successfully fetched`;

        } catch (error) {
            this.logger.warn(`getNetworkById Error: ${JSON.stringify(error)}`)
            output.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                output.message = error.message;
            } else {
                output.message = "Internal Server Error";
            }
        }
        return output;
    }

    @ApiOperation({ summary: 'Update Network By Id' })
    @ApiCreatedResponse({
        description: 'Update Network By Id',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Patch('update/:id')
    async editNetwork(@Param('id', ParseIntPipe) id: number, @Body() body: any) {
        this.logger.log(`editNetwork body: ${JSON.stringify(body)}`)
        let output = new ResponseData
        try {
            let Network = await this.networkMasterService.updateNetwork(id, body);
            this.logger.log(`editNetwork: ${JSON.stringify(Network)}`)

            if (!Network) {
                this.logger.log(`editNetwork!!: ${JSON.stringify(Network)}`)
                throw 'Something went wrong'
            } else {
                this.logger.log(`editNetwork else: ${Network}`)
            }
            output.data = Network;
            output.message = `Network with id : ${id} is successfully updated`;
        } catch (error) {
            this.logger.warn(`editNetwork error: ${JSON.stringify(error), error}`)
            output.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                this.logger.warn(`editNetwork badrequest: ${error}`)
                output.message = error.message;
            } else {
                output.message = "Internal Server Error";
            }
        }
        this.logger.log(`editNetwork message: ${output.message}`)
        return output
    }

    @ApiOperation({ summary: 'Delete Network By Id' })
    @ApiCreatedResponse({
        description: 'Delete Network By Id',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Delete('delete/:id')
    async softDelete(@Param('id', ParseIntPipe) id: number) {
        return this.networkMasterService.softDelete(id);
    }

    @ApiOperation({ summary: 'Search List of Network' })
    @ApiCreatedResponse({
        description: 'Search List of Networks',
        type: ResponseData,
    })
    @HttpCode(HttpStatus.OK)
    @Post('search-list')
    async searchNetwork(@Body() searchParams: filterDto) {
        const resp = new ResponseData();
        try {
            const res = await this.networkMasterService.searchListUsingView(searchParams);
            this.logger.log(`Network Search Data: ${JSON.stringify(res)}`);
            resp.data = res;
            resp.message = 'Network Search is successfully fetched';
        } catch (error) {
            this.logger.warn(`Search Network Error: ${error}`);
            resp.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                resp.message = error.message;
            } else {
                resp.message = 'Internal Server Error';
            }
        }
        return resp;
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

            const logs = await this.networkMasterService.getAuditLogs(tableName, recordId);

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