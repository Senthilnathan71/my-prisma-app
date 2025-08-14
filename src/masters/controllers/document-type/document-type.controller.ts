import { BadRequestException, Body, Controller, Delete, Get, HttpCode, HttpStatus, Logger, Param, ParseIntPipe, Patch, Post, UnauthorizedException } from '@nestjs/common';
import { ApiCreatedResponse, ApiOperation } from '@nestjs/swagger';
import { ResponseData } from 'src/common/response-data';
import { SearchListDto } from 'src/masters/DTO/search-list.dto';
import { SearchVesselDto } from 'src/masters/DTO/search-vessel.dto';
import { DocumentTypeService } from 'src/masters/services/document-type/document-type.service';


@Controller('document-type')
export class DocumentTypeController {
    constructor(private documentTypeService: DocumentTypeService, private logger: Logger) { }


    @ApiOperation({ summary: 'Create new Document Type' })
    @ApiCreatedResponse({
        description: 'Create new Document Type',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Post('create')
    async createNewDocType(@Body() newData: any) {
        let resp = new ResponseData();
        try {
            let res = await this.documentTypeService.createNewDocType(newData);
            this.logger.log(`New Document Type Created : ${JSON.stringify(res)}`);
            resp.data = res;
            resp.message = "New Document Type is successfully created"
        } catch (error) {
            this.logger.warn(`Document Type Creation Error : ${JSON.stringify(error), error}`);
            resp.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                resp.message = error.message;
            } else {
                resp.message = "Internal Server Error";
            }
        }
        return resp;
    }



    @ApiOperation({ summary: 'Get All Document Type' })
    @ApiCreatedResponse({
        description: 'Get All Document Type',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Get()
    async getAllDocType() {
        let resp = new ResponseData();
        try {
            let res = await this.documentTypeService.getAllDocType();
            this.logger.log(`All Document Type Fetched : ${JSON.stringify(res)}`);
            resp.data = res;
            resp.message = "All Document Type are successfully fetched";
        } catch (error) {
            this.logger.warn(`Get All Document Type Error : ${JSON.stringify(error), error}`);
            resp.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                resp.message = error.message;
            } else {
                resp.message = "Internal Server Error";
            }
        }
        return resp;
    }



    @ApiOperation({ summary: 'Get Document Type by Id' })
    @ApiCreatedResponse({
        description: 'Get Document Type by Id',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Get('fetch/:DocumentTypeMasterSid')
    async getDocTypeById(@Param('DocumentTypeMasterSid', ParseIntPipe) DocumentTypeMasterSid: number) {
        let resp = new ResponseData();
        try {
            this.logger.log(`Getting Document Type with id : ${DocumentTypeMasterSid}`);
            let res = await this.documentTypeService.fetchDocTypeById(DocumentTypeMasterSid);
            this.logger.debug(`Fetched Document Type : ${JSON.stringify(res)}`);
            resp.data = res;
            resp.message = `Document Type with id : ${DocumentTypeMasterSid} is successfully fetched`;
        } catch (error) {
            this.logger.warn(`Get Document Type by Id Error : ${JSON.stringify(error), error}`);
            resp.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                resp.message = error.message;
            } else {
                resp.message = "Internal Server Error";
            }
        }
        return resp;
    }



    @ApiOperation({ summary: 'Update Document Type by Id' })
    @ApiCreatedResponse({
        description: 'Update Document Type by Id',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Patch('update/:DocumentTypeMasterSid')
    async updateDocTypeById(@Param('DocumentTypeMasterSid', ParseIntPipe) DocumentTypeMasterSid: number, @Body() payload: any) {
        let resp = new ResponseData();
        try {
            this.logger.log(`Updating Document Type with id : ${DocumentTypeMasterSid}`);
            let res = await this.documentTypeService.updateDocTypeById(DocumentTypeMasterSid, payload);
            this.logger.debug(`Updated Document Type : ${JSON.stringify(res)}`);
            resp.data = res;
            resp.message = `Document Type with id : ${DocumentTypeMasterSid} is successfully updated`;
        } catch (error) {
            this.logger.warn(`Document Type Updation Error : ${JSON.stringify(error), error}`);
            resp.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                resp.message = error.message;
            } else {
                resp.message = "Internal Server Error";
            }
        }
        return resp;
    }



    @ApiOperation({ summary: 'Delete Document Type by Id' })
    @ApiCreatedResponse({
        description: 'Delete Document Type by Id',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Delete('delete/:DocumentTypeMasterSid')
    async deleteDocTypeById(@Param('DocumentTypeMasterSid', ParseIntPipe) DocumentTypeMasterSid: number) {
        let resp = new ResponseData();
        try {
            this.logger.log(`Deleting Document Type with id : ${DocumentTypeMasterSid}`);
            let res = await this.documentTypeService.deleteDocType(DocumentTypeMasterSid);
            this.logger.debug(`Deleted Document Type : ${JSON.stringify(res)}`);
            resp.data = res;
            resp.message = `
            Document Type with id : ${DocumentTypeMasterSid} is successfully deleted`;
        } catch (error) {
            this.logger.warn(`Document Type Deletion Error : ${JSON.stringify(error), error}`);
            resp.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                resp.message = error.message;
            } else {
                resp.message = "Internal Server Error";
            }
        }
        return resp;
    }



    @ApiOperation({ summary: 'Search List of Document Types' })
@ApiCreatedResponse({
    description: 'Search List of Document Types',
    type: ResponseData,
})
@HttpCode(HttpStatus.OK)
@Post('search-list')
async searchDocTypeNew(@Body() searchParams: SearchVesselDto) {
    const resp = new ResponseData();
    try {
        const res = await this.documentTypeService.searchDocType(searchParams);
        this.logger.log(`Document Type Search Data: ${JSON.stringify(res)}`);
        resp.data = res;
        resp.message = 'Document Type Search is successfully fetched';
    } catch (error) {
        this.logger.warn(`Search Document Type Error: ${error}`);
        resp.status = false;
        if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
            resp.message = error.message;
        } else {
            resp.message = 'Internal Server Error'; 
        }
    }
    return resp;
}


@ApiOperation({ summary: 'Get Subledgers by COA Master ID' })
@ApiCreatedResponse({
    description: 'Get Subledgers by COA Master ID',
    type: ResponseData
})
@HttpCode(HttpStatus.OK)
@Get('subledgers/:COAMasterSid')
async getSubledgersByCOA(@Param('COAMasterSid', ParseIntPipe) COAMasterSid: number) {
    let resp = new ResponseData();
    try {
        this.logger.log(`Getting Subledgers for COA Master ID: ${COAMasterSid}`);
        let res = await this.documentTypeService.getSubledgersByCOA(COAMasterSid);
        this.logger.debug(`Fetched Subledgers: ${JSON.stringify(res)}`);
        resp.data = res;
        resp.message = `Subledgers for COA Master ID: ${COAMasterSid} are successfully fetched`;
    } catch (error) {
        this.logger.warn(`Get Subledgers by COA Error: ${JSON.stringify(error), error}`);
        resp.status = false;
        if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
            resp.message = error.message;
        } else {
            resp.message = "Internal Server Error";
        }
    }
    return resp;
}
}
