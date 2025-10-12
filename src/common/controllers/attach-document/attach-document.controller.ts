import { BadRequestException, Body, Controller, Delete, Get, HttpCode, HttpStatus, Logger, Param, ParseIntPipe, Patch, Post, UnauthorizedException, UploadedFiles } from '@nestjs/common';
import { ApiCreatedResponse, ApiOperation } from '@nestjs/swagger';
import { FilesUploadInterceptor } from 'src/common/decorators/file-upload.decorator';
import { ResponseData } from 'src/common/response-data';
import { SearchListDto } from 'src/masters/DTO/search-list.dto';
import { AttachDocumentService } from 'src/common/services/attach-document/attach-document.service';
import { DynamicFilesUploadInterceptor } from 'src/common/decorators/attach-document.decorator';
import { CreateAttachDocumentDto } from 'src/common/dto/attach-document.dto';
import * as fs from "fs";
import * as path from "path";
import { ConfigService } from '@nestjs/config';
@Controller('attach-document')
export class AttachDocumentController {
    constructor(private configService:ConfigService,private attachDocumentService: AttachDocumentService, private logger: Logger) { }

    @ApiOperation({ summary: 'Create new Attach Document' })
    @ApiCreatedResponse({
        description: 'Create new Attach Document',
        type: ResponseData
    })
    @DynamicFilesUploadInterceptor("files", 10, 20)
    @HttpCode(HttpStatus.CREATED)
    @Post('create')
    async createNewAttachDocument(@UploadedFiles() files: Express.Multer.File[], @Body() newData: CreateAttachDocumentDto) {
        let resp = new ResponseData();
        try {
            if (!files || files.length === 0) {
      throw new BadRequestException("No files uploaded");
    }

    // 1️⃣ Save DB record
    const res = await this.attachDocumentService.createNewAttachDocument(files, newData);

    // 2️⃣ Save files to disk after DB success
    const baseDestination = this.configService.get("UPLOAD_EDOC_PATH");

    files.forEach(file => {
      const componentName:any = newData.menuName;
      const recordId:any = newData.DocumentSid; // Use DB-generated ID

      const folderPath = path.join(baseDestination, componentName, recordId.toString());
      if (!fs.existsSync(folderPath)) fs.mkdirSync(folderPath, { recursive: true });

      const ext = path.extname(file.originalname);
      const name = file.originalname
        .replace(/[^\w\s.]/g, "")
        .replace(/\s+/g, "_");
      const timestamp = Date.now();
      const rand = Math.floor(1000 + Math.random() * 9000);
      const fileName = `${name.split(".")[0]}_${timestamp}_${rand}${ext}`;

      fs.writeFileSync(path.join(folderPath, fileName), file.buffer);
    });

    resp.data = res;
    resp.message = "New Attach Document is successfully created";
    this.logger.log(`New Attach Document Created: ${JSON.stringify(res)}`);
        } catch (error) {
            this.logger.warn(`Attach Document Creation Error : ${JSON.stringify(error)}`);
            resp.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                resp.message = error.message;
            } else {
                resp.message = "Internal Server Error";
            }
        }
        return resp;
    }

    @ApiOperation({ summary: 'Get All Attach Documents' })
    @ApiCreatedResponse({
        description: 'Get All Attach Documents',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Get()
    async getAllAttachDocuments() {
        let resp = new ResponseData();
        try {
            let res = await this.attachDocumentService.getAllAttachDocuments();
            this.logger.log(`All Attach Documents Fetched : ${JSON.stringify(res)}`);
            resp.data = res;
            resp.message = "All Attach Documents are successfully fetched";
        } catch (error) {
            this.logger.warn(`Get All Attach Documents Error : ${JSON.stringify(error)}`);
            resp.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                resp.message = error.message;
            } else {
                resp.message = "Internal Server Error";
            }
        }
        return resp;
    }

    @ApiOperation({ summary: 'Get Attach Document by Id' })
    @ApiCreatedResponse({
        description: 'Get Attach Document by Id',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Get('fetch/:AttachDocumentSid')
    async getAttachDocumentById(@Param('AttachDocumentSid', ParseIntPipe) AttachDocumentSid: number) {
        let resp = new ResponseData();
        try {
            this.logger.log(`Getting Attach Document with id : ${AttachDocumentSid}`);
            let res = await this.attachDocumentService.fetchAttachDocumentById(AttachDocumentSid);
            this.logger.debug(`Fetched Attach Document : ${JSON.stringify(res)}`);
            resp.data = res;
            resp.message = `Attach Document with id : ${AttachDocumentSid} is successfully fetched`;
        } catch (error) {
            this.logger.warn(`Get Attach Document by Id Error : ${JSON.stringify(error)}`);
            resp.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                resp.message = error.message;
            } else {
                resp.message = "Internal Server Error";
            }
        }
        return resp;
    }

    @ApiOperation({ summary: 'Update Attach Document by Id' })
    @ApiCreatedResponse({
        description: 'Update Attach Document by Id',
        type: ResponseData
    })
    @FilesUploadInterceptor('documents', 'UPLOAD_DOC_PATH')
    @HttpCode(HttpStatus.OK)
    @Patch('update/:AttachDocumentSid')
    async updateAttachDocumentById(@Param('AttachDocumentSid', ParseIntPipe) AttachDocumentSid: number, @Body() payload: any) {
        let resp = new ResponseData();
        try {
            this.logger.log(`Updating Attach Document with id : ${AttachDocumentSid}`);
            let res = await this.attachDocumentService.updateAttachDocumentById(AttachDocumentSid, payload);
            this.logger.debug(`Updated Attach Document : ${JSON.stringify(res)}`);
            resp.data = res;
            resp.message = `Attach Document with id : ${AttachDocumentSid} is successfully updated`;
        } catch (error) {
            this.logger.warn(`Attach Document Updation Error : ${JSON.stringify(error)}`);
            resp.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                resp.message = error.message;
            } else {
                resp.message = "Internal Server Error";
            }
        }
        return resp;
    }

    @ApiOperation({ summary: 'Delete Attach Document by Id' })
    @ApiCreatedResponse({
        description: 'Delete Attach Document by Id',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Delete('delete/:AttachDocumentSid')
    async deleteAttachDocumentById(@Param('AttachDocumentSid', ParseIntPipe) AttachDocumentSid: number) {
        let resp = new ResponseData();
        try {
            this.logger.log(`Deleting Attach Document with id : ${AttachDocumentSid}`);
            let res = await this.attachDocumentService.deleteAttachDocument(AttachDocumentSid);
            this.logger.debug(`Deleted Attach Document : ${JSON.stringify(res)}`);
            resp.data = res;
            resp.message = `Attach Document with id : ${AttachDocumentSid} is successfully deleted`;
        } catch (error) {
            this.logger.warn(`Attach Document Deletion Error : ${JSON.stringify(error)}`);
            resp.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                resp.message = error.message;
            } else {
                resp.message = "Internal Server Error";
            }
        }
        return resp;
    }

    @ApiOperation({ summary: 'Search List of Attach Documents' })
    @ApiCreatedResponse({
        description: 'Search List of Attach Documents',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Post('search-list')
    async searchAttachDocument(@Body() searchData: SearchListDto) {
        let resp = new ResponseData();
        try {
            let res = await this.attachDocumentService.searchAttachDocument(searchData);
            this.logger.log(`Attach Document Search Results :${JSON.stringify(res)}`);
            resp.data = res;
            resp.message = "Attach Document Search results are successfully fetched"
        } catch (error) {
            this.logger.warn(`Attach Document Search Error : ${JSON.stringify(error)}`);
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