import { BadRequestException, Body, Controller, Delete, Get, HttpCode, HttpStatus, Logger, Param, ParseIntPipe, Patch, Post, UnauthorizedException } from '@nestjs/common';
import { ApiCreatedResponse, ApiOperation } from '@nestjs/swagger';
import { Auth } from 'src/common/decorators/auth.decorator';
import { UserData } from 'src/common/decorators/user.decorator';
import { ResponseData } from 'src/common/response-data';
import { CompanyConfigService } from 'src/masters/services/company/company-config.service';
import { CreateCompanyConfigDto, UpdateCompanyConfigDto } from 'src/masters/DTO/company-config.dto';

@Auth()
@Controller('company-config')
export class CompanyConfigController {
    constructor(private companyConfigService: CompanyConfigService, private logger: Logger) { }

    @ApiOperation({ summary: 'Create new Company Configuration' })
    @ApiCreatedResponse({
        description: 'Create new Company Configuration',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Post('create')
    async createCompanyConfig(@UserData() userInfo, @Body() newData: CreateCompanyConfigDto) {
        const resp = new ResponseData();
        try {
            const res = await this.companyConfigService.createCompanyConfig(newData, userInfo);
            this.logger.log(`New Company Configuration Added : ${JSON.stringify(res)}`);
            resp.data = res;
            resp.message = 'New Company Configuration is successfully created';
        } catch (error) {
            this.logger.warn(`Company Configuration Creation Error : ${JSON.stringify(error), error}`);
            resp.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                resp.message = error.message;
            } else {
                resp.message = 'Internal Server Error';
            }
        }
        return resp;
    }

    @ApiOperation({ summary: 'Create Bulk Company Configurations' })
    @ApiCreatedResponse({
        description: 'Create Bulk Company Configurations',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Post('bulk-create')
    async createBulkCompanyConfigs(@UserData() userInfo, @Body() companyConfigs: any[]) {
        const resp = new ResponseData();
        try {
            const res = await this.companyConfigService.createBulkCompanyConfigs(companyConfigs, userInfo);
            this.logger.log(`Bulk Company Configurations Added : ${JSON.stringify(res)}`);
            resp.data = res;
            resp.message = 'Bulk Company Configurations are successfully created';
        } catch (error) {
            this.logger.warn(`Bulk Company Configuration Creation Error : ${JSON.stringify(error), error}`);
            resp.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                resp.message = error.message;
            } else {
                resp.message = 'Internal Server Error';
            }
        }
        return resp;
    }

    @ApiOperation({ summary: 'Get Eligible Companies by Configuration Name' })
    @ApiCreatedResponse({
        description: 'Get Eligible Companies by Configuration Name',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Get('eligible-companies/:ConfigurationName')
    async getEligibleCompaniesForConfiguration(@Param('ConfigurationName') ConfigurationName: string) {
        const resp = new ResponseData();
        try {
            const res = await this.companyConfigService.getEligibleCompaniesForConfiguration(ConfigurationName);
            this.logger.log(`Eligible companies fetched : ${JSON.stringify(res)}`);
            resp.data = res;
            resp.message = 'Eligible companies fetched successfully';
        } catch (error) {
            this.logger.warn(`Eligible company lookup error : ${JSON.stringify(error), error}`);
            resp.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                resp.message = error.message;
            } else {
                resp.message = 'Internal Server Error';
            }
        }
        return resp;
    }

    @ApiOperation({ summary: 'Get All Company Configurations by Company ID' })
    @ApiCreatedResponse({
        description: 'Get All Company Configurations by Company ID',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Get('company/:CompanyMasterSid')
    async getCompanyConfigsByCompanyId(@Param('CompanyMasterSid', ParseIntPipe) CompanyMasterSid: number) {
        const resp = new ResponseData();
        try {
            const res = await this.companyConfigService.getCompanyConfigsByCompanyId(CompanyMasterSid);
            this.logger.log(`Company Configurations fetched : ${JSON.stringify(res)}`);
            resp.data = res;
            resp.message = 'Company Configurations are successfully fetched';
        } catch (error) {
            this.logger.warn(`Get Company Configurations Error : ${JSON.stringify(error), error}`);
            resp.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                resp.message = error.message;
            } else {
                resp.message = 'Internal Server Error';
            }
        }
        return resp;
    }

    @ApiOperation({ summary: 'Get Company Configuration by Id' })
    @ApiCreatedResponse({
        description: 'Get Company Configuration by Id',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Get('fetch/:CompanyConfigurationSid')
    async getCompanyConfigById(@Param('CompanyConfigurationSid', ParseIntPipe) CompanyConfigurationSid: number) {
        const resp = new ResponseData();
        try {
            this.logger.log(`Fetching Company Configuration with id : ${CompanyConfigurationSid}`);
            const res = await this.companyConfigService.getCompanyConfigById(CompanyConfigurationSid);
            this.logger.debug(`Fetched Company Configuration : ${JSON.stringify(res)}`);
            resp.data = res;
            resp.message = `Company Configuration with id : ${CompanyConfigurationSid} is successfully fetched`;
        } catch (error) {
            this.logger.warn(`Get Company Configuration by Id Error : ${JSON.stringify(error), error}`);
            resp.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                resp.message = error.message;
            } else {
                resp.message = 'Internal Server Error';
            }
        }
        return resp;
    }

    @ApiOperation({ summary: 'Update Company Configuration by Id' })
    @ApiCreatedResponse({
        description: 'Update Company Configuration by Id',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Patch('update/:CompanyConfigurationSid')
    async updateCompanyConfigById(
        @Param('CompanyConfigurationSid', ParseIntPipe) CompanyConfigurationSid: number,
        @Body() updateData: UpdateCompanyConfigDto,
        @UserData() user: any
    ) {
        const resp = new ResponseData();
        try {
            this.logger.log(`Updating Company Configuration with id:${CompanyConfigurationSid}`);
            const res = await this.companyConfigService.updateCompanyConfig(CompanyConfigurationSid, updateData, user);
            this.logger.debug(`Updated Company Configuration :${JSON.stringify(res)}`);
            resp.data = res;
            resp.message = `Company Configuration with id : ${CompanyConfigurationSid} is successfully updated`;
        } catch (error) {
            this.logger.warn(`Company Configuration Updation Error : ${JSON.stringify(error), error}`);
            resp.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                resp.message = error.message;
            } else {
                resp.message = 'Internal Server Error';
            }
        }
        return resp;
    }

    @ApiOperation({ summary: 'Delete Company Configuration by Id' })
    @ApiCreatedResponse({
        description: 'Delete Company Configuration by Id',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Delete('delete/:CompanyConfigurationSid')
    async deleteCompanyConfigById(@Param('CompanyConfigurationSid', ParseIntPipe) CompanyConfigurationSid: number) {
        const resp = new ResponseData();
        try {
            this.logger.log(`Deleting Company Configuration with id : ${CompanyConfigurationSid}`);
            const res = await this.companyConfigService.softDeleteCompanyConfigById(CompanyConfigurationSid);
            this.logger.debug(`Deleted Company Configuration : ${JSON.stringify(res)}`);
            resp.data = res;
            resp.message = `Company Configuration with id : ${CompanyConfigurationSid} is successfully deleted`;
        } catch (error) {
            this.logger.warn(`Company Configuration Deletion Error : ${JSON.stringify(error), error}`);
            resp.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                resp.message = error.message;
            } else {
                resp.message = 'Internal Server Error';
            }
        }
        return resp;
    }

    @ApiOperation({ summary: 'Bulk Update Company Configurations' })
    @ApiCreatedResponse({
        description: 'Bulk Update Company Configurations',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Post('bulk-update')
    async bulkUpdateCompanyConfigs(@Body() bulkData: any, @UserData() user: any) {
        const resp = new ResponseData();
        try {
            this.logger.log(`Bulk updating Company Configurations`);
            const res = await this.companyConfigService.bulkUpdateCompanyConfigs(bulkData, user);
            this.logger.debug(`Bulk Updated Company Configurations :${JSON.stringify(res)}`);
            resp.data = res;
            resp.message = 'Company Configurations are successfully bulk updated';
        } catch (error) {
            this.logger.warn(`Company Configuration Bulk Update Error : ${JSON.stringify(error), error}`);
            resp.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                resp.message = error.message;
            } else {
                resp.message = 'Internal Server Error';
            }
        }
        return resp;
    }

    @ApiOperation({ summary: 'Get Configuration Value by Company and Name' })
    @ApiCreatedResponse({
        description: 'Get Configuration Value by Company and Name',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Get('value/:CompanyMasterSid/:ConfigurationName')
    async getConfigurationValue(
        @Param('CompanyMasterSid', ParseIntPipe) CompanyMasterSid: number,
        @Param('ConfigurationName') ConfigurationName: string
    ) {
        const resp = new ResponseData();
        try {
            this.logger.log(`Getting Configuration Value for Company:${CompanyMasterSid}, Name:${ConfigurationName}`);
            const res = await this.companyConfigService.getConfigurationValue(CompanyMasterSid, ConfigurationName);
            this.logger.debug(`Configuration Value : ${JSON.stringify(res)}`);
            resp.data = res;
            resp.message = 'Configuration value retrieved successfully';
        } catch (error) {
            this.logger.warn(`Get Configuration Value Error : ${JSON.stringify(error), error}`);
            resp.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                resp.message = error.message;
            } else {
                resp.message = 'Internal Server Error';
            }
        }
        return resp;
    }
}
