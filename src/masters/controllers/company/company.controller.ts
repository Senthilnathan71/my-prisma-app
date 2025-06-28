import { BadRequestException, Body, Controller, Delete, Get, HttpCode, HttpStatus, Logger, Param, ParseIntPipe, Patch, Post, Res, UnauthorizedException, UploadedFiles } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiCreatedResponse, ApiOperation } from '@nestjs/swagger';
import { FilesUploadInterceptor } from 'src/common/decorators/file-upload.decorator';
import { ImageUploadInterceptor } from 'src/common/decorators/image-upload.decorator';
import { UserData } from 'src/common/decorators/user.decorator';
import { checkIfFileExists } from 'src/common/helper';
import { ResponseData } from 'src/common/response-data';
import { SearchListDto } from 'src/masters/DTO/search-list.dto';
import { CompanyService } from 'src/masters/services/company/company.service';

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
        try {
            let res = await this.companyService.createCompany(newData, userInfo, logo);
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
    async updateCompanyById(@Param('CompanyMasterSid', ParseIntPipe) CompanyMasterSid: number, @Body() updateData: any) {
        let resp = new ResponseData();
        try {
            this.logger.log(`Updating Company with id:${CompanyMasterSid}`);
            let res = await this.companyService.updateCompanyById(CompanyMasterSid, updateData);
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



    @ApiOperation({ summary: 'Search List of Company' })
    @ApiCreatedResponse({
        description: "Search List of Company",
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Post('search-list')
    async searchCompany(@Body() searchData: SearchListDto) {
        let resp = new ResponseData();
        try {
            let res = await this.companyService.searchCompany(searchData);
            this.logger.log(`Company Search Results : ${JSON.stringify(res)}`);
            resp.data = res;
            resp.message = "Company search is successfully implemented";
        } catch (error) {
            this.logger.warn(`Company Search Error : ${error}`)
            resp.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                resp.message = error.message;
            } else {
                resp.message = "Internal Server Error";
            }
        }
        return resp;
    }


    @Get('logo')
    async getCompanyLogo(
        @Param('logoId') logoId,
        @Res() res,
    ): Promise<any> {
        const companyLogoPath = this.configService.get('COMPANY_LOGO')
        if (checkIfFileExists(`${companyLogoPath}/` + logoId)) {
            res.sendFile(logoId, { root: companyLogoPath });
        } else {
            logoId = logoId.replace('.jpg', '.png', '.pdf', '.PDF', '.doc')
            res.sendFile(logoId, { root: companyLogoPath })
        }
    }
}
