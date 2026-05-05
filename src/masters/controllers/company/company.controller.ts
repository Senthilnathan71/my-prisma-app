import { BadRequestException, Body, Controller, Delete, Get, HttpCode, HttpStatus, Logger, Param, ParseIntPipe, Patch, Post, Query, Res, UnauthorizedException, UploadedFiles } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiCreatedResponse, ApiOperation } from '@nestjs/swagger';
import { Auth } from 'src/common/decorators/auth.decorator';
import { FilesUploadInterceptor } from 'src/common/decorators/file-upload.decorator';
import { ImageUploadInterceptor } from 'src/common/decorators/image-upload.decorator';
import { UserData } from 'src/common/decorators/user.decorator';
import { checkIfFileExists } from 'src/common/helper';
import { ResponseData } from 'src/common/response-data';
import { SearchListDto } from 'src/masters/DTO/search-list.dto';
import { filterDto } from 'src/masters/DTO/search-vessel.dto';
import { CompanyService } from 'src/masters/services/company/company.service';
@Auth()
@Controller('company')
export class CompanyController {
    constructor(private companyService: CompanyService, private logger: Logger, private configService: ConfigService) { }

    @ApiOperation({ summary: 'Create new Company' })
    @ApiCreatedResponse({
        description: "Create new Company",
        type: ResponseData
    })
    @ImageUploadInterceptor('images', 'UPLOAD_IMAGE_PATH')
    @HttpCode(HttpStatus.OK)
    @Post('Create')
    async createNewCompany(@UserData() userInfo, @Body() newData: any, @UploadedFiles() logo: Express.Multer.File[] | undefined) {
        let resp = new ResponseData();
          const payload = JSON.parse(newData.data); // 🔥 required

        try {
            let res = await this.companyService.createCompany(payload, userInfo, logo);
            this.logger.log(`New Company Added : ${JSON.stringify(res)}`);
            resp.data = res;
            resp.message = "New Company is successfully created";
        } catch (error) {
            this.logger.warn(`Company Creation Error : ${JSON.stringify(error), error}`)
            resp.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                resp.message = error.message;
            } else {
                resp.message = "Internal Server Error";
            }
        }
        return resp;
    }

    @ApiOperation({ summary: 'Get Bank Details for Currency' })
    @ApiCreatedResponse({
        description: "Get Bank Details for Currency",
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Post('bank-details')
    async getBankDetails(
        @Body() payload: any,
    ){
        const resp = new ResponseData();
        try {
            const res = await this.companyService.getBankDetails(payload);
            this.logger.log(`Bank Details fetched: ${JSON.stringify(res)}`);
            resp.data = res;
            resp.message = "Bank Details fetched successfully";
        } catch (error) {
            this.logger.warn(`Bank Details fetch error: ${error}`);
            resp.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                resp.message = error.message;
            } else {
                resp.message = "Internal Server Error";
            }
        }
        return resp;
    }


    @ApiOperation({ summary: 'Get All Company' })
    @ApiCreatedResponse({
        description: "Get All Company",
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Get()
    async getAllCompany() {
        let resp = new ResponseData();
        try {
            let res = await this.companyService.getAllCompany();
            this.logger.log(`All Companies are fetched : ${JSON.stringify(res)}`);
            resp.data = res;
            resp.message = "All Companies are successfully fetched";
        } catch (error) {
            this.logger.warn(`Get All Company Error : ${JSON.stringify(error), error}`)
            resp.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                resp.message = error.message;
            } else {
                resp.message = "Internal Server Error";
            }
        }
        return resp;
    }
    @ApiOperation({ summary: 'Get All Company for search' })
    @ApiCreatedResponse({
        description: "Get All Company for search",
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Get('search')
    async getAllCompanySearch() {
        let resp = new ResponseData();
        try {
            let res = await this.companyService.newSearch();
            this.logger.log(`All Companies are fetched : ${JSON.stringify(res)}`);
            resp.data = res;
            resp.message = "All Companies are successfully fetched";
        } catch (error) {
            this.logger.warn(`Get All Company Error : ${JSON.stringify(error), error}`)
            resp.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                resp.message = error.message;
            } else {
                resp.message = "Internal Server Error";
            }
        }
        return resp;
    }



    @ApiOperation({ summary: 'Get Company by Id' })
    @ApiCreatedResponse({
        description: "Get Company by Id",
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Get('fetch/:CompanyMasterSid')
    async getCompanyById(@Param('CompanyMasterSid', ParseIntPipe) CompanyMasterSid: number) {
        let resp = new ResponseData();
        try {
            this.logger.log(`Fetching Company with id : ${CompanyMasterSid}`);
            let res = await this.companyService.getCompanyById(CompanyMasterSid);
            this.logger.debug(`Fetched Company : ${JSON.stringify(res)}`);
            resp.data = res;
            resp.message = `Company with id : ${CompanyMasterSid} is successfully fetched`;
        } catch (error) {
            this.logger.warn(`Get Company by Id Error : ${JSON.stringify(error), error}`)
            resp.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                resp.message = error.message;
            } else {
                resp.message = "Internal Server Error";
            }
        }
        return resp;
    }



    @ApiOperation({ summary: 'Update Company by Id' })
    @ApiCreatedResponse({
        description: "Update Company by Id",
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @ImageUploadInterceptor('images', 'UPLOAD_IMAGE_PATH')
    @Patch('update/:CompanyMasterSid')
    async updateCompanyById(@Param('CompanyMasterSid', ParseIntPipe) CompanyMasterSid: number, @Body() updateData: any, @UserData() user: any, @UploadedFiles() logo: Express.Multer.File[] | undefined) {
        let resp = new ResponseData();
          const payload = JSON.parse(updateData.data); // 🔥 required
        try {
            this.logger.log(`Updating Company with id:${CompanyMasterSid}`);
            let res = await this.companyService.updateCompany(CompanyMasterSid, payload, user, logo);
            this.logger.debug(`Updated Company :${JSON.stringify(res)}`);
            resp.data = res;
            resp.message = `Company with id : ${CompanyMasterSid} is successfully updated`;
        } catch (error) {
            this.logger.warn(`Company Updation Error : ${JSON.stringify(error), error}`)
            resp.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                resp.message = error.message;
            } else {
                resp.message = "Internal Server Error";
            }
        }
        return resp;
    }




    @ApiOperation({ summary: 'Delete Company by Id' })
    @ApiCreatedResponse({
        description: "Delete Company by Id",
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Delete('delete/:CompanyMasterSid')
    async deleteCurrencyExById(@Param('CompanyMasterSid', ParseIntPipe) CompanyMasterSid: number) {
        let resp = new ResponseData();
        try {
            this.logger.log(`Deleting Company with id : ${CompanyMasterSid}`);
            let res = await this.companyService.softDeleteCompanyById(CompanyMasterSid);
            this.logger.debug(`Deleted Company : ${JSON.stringify(res)}`);
            resp.data = res;
            resp.message = `Company with id : ${CompanyMasterSid} is successfully deleted`;
        } catch (error) {
            this.logger.warn(`Company Deletion Error : ${JSON.stringify(error), error}`)
            resp.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                resp.message = error.message;
            } else {
                resp.message = "Internal Server Error";
            }
        }
        return resp;
    }

    @ApiOperation({ summary: 'Get company config' })
    @ApiCreatedResponse({
        description: "Get company config",
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Get(':id/config')
    async getCompanyConfig(@Param('id', ParseIntPipe) companyId: number) {
        let resp = new ResponseData();
        try {
            let res = await this.companyService.getCompanyConfig(companyId);
            this.logger.log(`Company config fetched: ${JSON.stringify(res)}`);
            resp.data = res;
            resp.message = "Company config fetched successfully";
        } catch (error) {
            this.logger.warn(`Company config fetch error: ${error}`);
            resp.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                resp.message = error.message;
            } else {
                resp.message = "Internal Server Error";
            }
        }
        return resp;
    }

    @ApiOperation({ summary: 'Save company config' })
    @ApiCreatedResponse({
        description: "Save company config",
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Post(':id/config')
    async saveCompanyConfig(
        @Param('id', ParseIntPipe) companyId: number,
        @Body() configData: any,
        @UserData() userInfo
    ) {
        let resp = new ResponseData();
        try {
            let res = await this.companyService.saveCompanyConfig(companyId, configData, userInfo);
            this.logger.log(`Company config saved: ${JSON.stringify(res)}`);
            resp.data = res;
            resp.message = "Company config saved successfully";
        } catch (error) {
            this.logger.warn(`Company config save error: ${error}`);
            resp.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                resp.message = error.message;
            } else {
                resp.message = "Internal Server Error";
            }
        }
        return resp;
    }

    @ApiOperation({ summary: 'Get Field Configuration' })
    @ApiCreatedResponse({
        description: "Get Field Configuration",
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Get('field-configuration')
    async getFieldConfiguration() {
        let resp = new ResponseData();
        try {
            const res = await this.companyService.getFieldConfiguration();
            this.logger.log(`Field Configuration fetched: ${JSON.stringify(res)}`);
            resp.data = res;
            resp.message = "Field Configuration successfully fetched";
        } catch (error) {
            this.logger.warn(`Get Field Configuration Error: ${error}`);
            resp.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                resp.message = error.message;
            } else {
                resp.message = "Internal Server Error";
            }
        }
        return resp;
    }


    @ApiOperation({ summary: 'Search List of Company' })
    @ApiCreatedResponse({
        description: "Search List of Company",
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Post('search-list')
    async searchCompanyNew(@Body() searchParams: filterDto) {
        const resp = new ResponseData();
        try {
            const res = await this.companyService.searchCompany(searchParams);
            this.logger.log(`Company Search Data: ${JSON.stringify(res)}`);
            resp.data = res;
            resp.message = 'Company Search is successfully fetched';
        } catch (error) {
            this.logger.warn(`Search Company Error: ${error}`);
            resp.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                resp.message = error.message;
            } else {
                resp.message = 'Internal Server Error';
            }
        }
        return resp;
    }


    @Get('logo/:logoId')
    async getCompanyLogo(
        @Param('logoId') logoId: string,
        @Res() res,
    ): Promise<any> {
        const companyLogoPath = this.configService.get('UPLOAD_IMAGE_PATH');
        const filePath = `${companyLogoPath}/${logoId}`;

        // Try original filename
        if (checkIfFileExists(filePath)) {
            return res.sendFile(logoId, { root: companyLogoPath });
        }

        // Try .png if .jpg not found
        const pngLogoId = logoId.replace('.jpg', '.png');
        const pngFilePath = `${companyLogoPath}/${pngLogoId}`;
        if (checkIfFileExists(pngFilePath)) {
            return res.sendFile(pngLogoId, { root: companyLogoPath });
        }

        // Return 404 if file not found
        return res.status(404).json({ message: 'Logo not found' });
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

            const logs = await this.companyService.getAuditLogs(tableName, recordId);

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

    @ApiOperation({ summary: 'Get job close milestone config for a company' })
    @ApiCreatedResponse({ description: "Get job close milestone config", type: ResponseData })
    @HttpCode(HttpStatus.OK)
    @Get(':id/job-close-milestones')
    async getJobCloseMilestoneConfig(@Param('id', ParseIntPipe) companyId: number) {
        const resp = new ResponseData();
        try {
            resp.data = await this.companyService.getJobCloseMilestoneConfig(companyId);
            resp.message = 'Job close milestone config fetched successfully';
        } catch (error) {
            this.logger.warn(`getJobCloseMilestoneConfig error: ${error}`);
            resp.status = false;
            resp.message = error.message || 'Internal Server Error';
        }
        return resp;
    }

    @ApiOperation({ summary: 'Save job close milestone config for a company' })
    @ApiCreatedResponse({ description: "Save job close milestone config", type: ResponseData })
    @HttpCode(HttpStatus.OK)
    @Post(':id/job-close-milestones')
    async saveJobCloseMilestoneConfig(
        @Param('id', ParseIntPipe) companyId: number,
        @Body() configData: any,
        @UserData() userInfo
    ) {
        const resp = new ResponseData();
        try {
            resp.data = await this.companyService.saveJobCloseMilestoneConfig(companyId, configData, userInfo);
            resp.message = 'Job close milestone config saved successfully';
        } catch (error) {
            this.logger.warn(`saveJobCloseMilestoneConfig error: ${error}`);
            resp.status = false;
            resp.message = error.message || 'Internal Server Error';
        }
        return resp;
    }
}
