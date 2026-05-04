import { BadRequestException, Body, Controller, Delete, Get,Res, HttpCode, HttpStatus, Logger, Param, ParseIntPipe, Patch, Post, Query, UnauthorizedException, UploadedFiles, Req } from '@nestjs/common';
import { ApiCreatedResponse, ApiOperation } from '@nestjs/swagger';
import { FilesUploadInterceptor } from 'src/common/decorators/file-upload.decorator';
import { ResponseData } from 'src/common/response-data';
import { SearchListDto } from 'src/masters/DTO/search-list.dto';
import { AttachDocumentService } from 'src/common/services/attach-document/attach-document.service';
import { CreateAttachDocumentDto } from 'src/common/dto/attach-document.dto';
import * as fs from "fs";
import * as pug from 'pug';
import * as path from "path";
import { ConfigService } from '@nestjs/config';
import { MenuService } from 'src/settings/services/menu/menu.service';
import { DynamicFilesUploadInterceptor } from 'src/common/decorators/edoc.decorator';
import { UserData } from 'src/common/decorators/user.decorator';
import { EmailService } from 'src/email/email.service';
import { Response,Request } from 'express'; // 👈 import this
import { Auth } from 'src/common/decorators/auth.decorator';

@Auth()
@Controller('attach-document')
export class AttachDocumentController {
    constructor(private configService: ConfigService,
        private emailService: EmailService,
        private menuMasterService: MenuService, private attachDocumentService: AttachDocumentService, private logger: Logger) { }

    @Post('create')
@ApiOperation({ summary: 'Create new Attach Document' })
@ApiCreatedResponse({ description: 'Create new Attach Document', type: ResponseData })
@DynamicFilesUploadInterceptor("files", 10, 20)
@HttpCode(HttpStatus.CREATED)
async createNewAttachDocument(
  @UploadedFiles() files: Express.Multer.File[],
  @Body() newData: any,
  @UserData() user: any
) {
  const resp = new ResponseData();
  try {
    if (!files || files.length === 0) throw new BadRequestException("No files uploaded");

    const menu:any = await this.menuMasterService.findOne(Number(newData.MenuMasterSid));

    const res = await this.attachDocumentService.createNewAttachDocumentGroup(files, newData, menu.MenuName, user);

    resp.data = res;
    resp.message = "New Attach Document(s) successfully created";
    this.logger.log(`New Attach Document Group Created: ${JSON.stringify(res)}`);
  } catch (error) {
    this.logger.warn(`Attach Document Creation Error : ${error.message}`);
    resp.status = false;
    resp.message = error.message || "Internal Server Error";
  }
  return resp;
}


    

@Patch('update/:AttachDocumentSid')
@ApiOperation({ summary: 'Update Attach Document by Id' })
@ApiCreatedResponse({ description: 'Update Attach Document by Id', type: ResponseData })
@DynamicFilesUploadInterceptor("files", 10, 20)
@HttpCode(HttpStatus.OK)
async updateAttachDocumentById(
  @UploadedFiles() files: Express.Multer.File[],
  @Param('AttachDocumentSid', ParseIntPipe) AttachDocumentSid: number,
  @Body() payload: any
) {
  const resp = new ResponseData();
  try {
    this.logger.log(`Updating Attach Document with id: ${AttachDocumentSid}`);
    const res = await this.attachDocumentService.updateAttachDocumentById(files, AttachDocumentSid, payload);
    resp.data = res;
    resp.message = `Attach Document with id: ${AttachDocumentSid} successfully updated`;
  } catch (error) {
    this.logger.warn(`Attach Document Updation Error: ${error.message}`);
    resp.status = false;
    resp.message = error.message || "Internal Server Error";
  }
  return resp;
}


    @Post('fetch-by-folder')
@ApiOperation({ summary: 'Fetch Attach Document by Folder Structure' })
@ApiCreatedResponse({ description: 'Fetch Attach Document by Folder Structure', type: ResponseData })
@HttpCode(HttpStatus.OK)
async fetchAttachDocumentByFolder(@Body() body: { menuMasterSid: number; DocumentSid: number }) {
  const resp = new ResponseData();
  try {
    const { menuMasterSid, DocumentSid } = body;
    this.logger.log(`Fetching AttachDocument for MenuMasterSid: ${menuMasterSid}, DocumentSid: ${DocumentSid}`);

    const result = await this.attachDocumentService.fetchAttachDocumentByFolder(menuMasterSid, DocumentSid);

    resp.data = result;
    resp.message = 'Attach Document successfully fetched from folder structure';
  } catch (error) {
    this.logger.warn(`Fetch Attach Document by Folder Error: ${error.message}`);
    resp.status = false;
    resp.message = error.message || 'Internal Server Error';
  }
  return resp;
}




@Post('download')
  @ApiOperation({ summary: 'Download file by name (POST body)' })
  @HttpCode(HttpStatus.OK)
  async downloadFile(
    @Body() body: { menuMasterSid: number; documentSid: number; fileName: string },
    @Res() res: Response,
  ) {
    try {
      const { menuMasterSid, documentSid, fileName } = body;

      const fileData = await this.attachDocumentService.downloadFileByName(
        menuMasterSid,
        documentSid,
        fileName,
      );

      res.setHeader('Content-Type', fileData.mimeType);
      res.setHeader('Content-Disposition', `attachment; filename="${fileData.fileName}"`);
      res.send(fileData.buffer);
    } catch (error) {
      this.logger.error(`File download error: ${error.message}`);
      res.status(500).send({ message: 'Error downloading file' });
    }
  }

  @Post('preview')
async previewFile(
  @Body() body: { menuMasterSid: number; documentSid: number; fileName: string },
  @Req() req: Request,
  @Res() res: Response,
) {
  const { menuMasterSid, documentSid, fileName } = body;

  const fileData = await this.attachDocumentService.downloadFileByName(
    menuMasterSid,
    documentSid,
    fileName,
  );
    const menu:any = await this.menuMasterService.findOne(Number(menuMasterSid));

  

  // All files → send blob (client-side rendering for Office files)
  res.setHeader('Content-Type', fileData.mimeType);
  res.setHeader('Content-Disposition', `inline; filename="${fileData.fileName}"`);
  res.send(fileData.buffer);
}



  @Delete('delete/:AttachDocumentSid')
@ApiOperation({ summary: 'Delete attach document file' })
@HttpCode(HttpStatus.OK)
async deleteAttachDocumentFile(
    @Param('AttachDocumentSid', ParseIntPipe) AttachDocumentSid: number
) {
    const resp = new ResponseData();
    try {
        const result = await this.attachDocumentService.deleteAttachDocumentFile(AttachDocumentSid);
        resp.data = result;
        resp.message = result.message;
        this.logger.log(`File deleted: ${AttachDocumentSid}`);
    } catch (error) {
        this.logger.error(`Delete error: ${error.message}`);
        resp.status = false;
        resp.message = error.message || 'Delete failed';
    }
    return resp;
}


// @ApiOperation({ summary: 'Get All Attach Documents' })
    // @ApiCreatedResponse({
    //     description: 'Get All Attach Documents',
    //     type: ResponseData
    // })
    // @HttpCode(HttpStatus.OK)
    // @Get()
    // async getAllAttachDocuments() {
    //     let resp = new ResponseData();
    //     try {
    //         let res = await this.attachDocumentService.getAllAttachDocuments();
    //         this.logger.log(`All Attach Documents Fetched : ${JSON.stringify(res)}`);
    //         resp.data = res;
    //         resp.message = "All Attach Documents are successfully fetched";
    //     } catch (error) {
    //         this.logger.warn(`Get All Attach Documents Error : ${JSON.stringify(error)}`);
    //         resp.status = false;
    //         if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
    //             resp.message = error.message;
    //         } else {
    //             resp.message = "Internal Server Error";
    //         }
    //     }
    //     return resp;
    // }

    // @ApiOperation({ summary: 'Get Attach Document by Id' })
    // @ApiCreatedResponse({
    //     description: 'Get Attach Document by Id',
    //     type: ResponseData
    // })
    // @HttpCode(HttpStatus.OK)
    // @Get('fetch/:AttachDocumentSid')
    // async getAttachDocumentById(@Param('AttachDocumentSid', ParseIntPipe) AttachDocumentSid: number) {
    //     let resp = new ResponseData();
    //     try {
    //         this.logger.log(`Getting Attach Document with id : ${AttachDocumentSid}`);
    //         let res = await this.attachDocumentService.fetchAttachDocumentById(AttachDocumentSid);
    //         this.logger.debug(`Fetched Attach Document : ${JSON.stringify(res)}`);
    //         resp.data = res;
    //         resp.message = `Attach Document with id : ${AttachDocumentSid} is successfully fetched`;
    //     } catch (error) {
    //         this.logger.warn(`Get Attach Document by Id Error : ${JSON.stringify(error)}`);
    //         resp.status = false;
    //         if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
    //             resp.message = error.message;
    //         } else {
    //             resp.message = "Internal Server Error";
    //         }
    //     }
    //     return resp;
    // }

    // @ApiOperation({ summary: 'Delete Attach Document by Id' })
    // @ApiCreatedResponse({
    //     description: 'Delete Attach Document by Id',
    //     type: ResponseData
    // })
    // @HttpCode(HttpStatus.OK)
    // @Delete('delete/:AttachDocumentSid')
    // async deleteAttachDocumentById(@Param('AttachDocumentSid', ParseIntPipe) AttachDocumentSid: number) {
    //     let resp = new ResponseData();
    //     try {
    //         this.logger.log(`Deleting Attach Document with id : ${AttachDocumentSid}`);
    //         let res = await this.attachDocumentService.deleteAttachDocument(AttachDocumentSid);
    //         this.logger.debug(`Deleted Attach Document : ${JSON.stringify(res)}`);
    //         resp.data = res;
    //         resp.message = `Attach Document with id : ${AttachDocumentSid} is successfully deleted`;
    //     } catch (error) {
    //         this.logger.warn(`Attach Document Deletion Error : ${JSON.stringify(error)}`);
    //         resp.status = false;
    //         if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
    //             resp.message = error.message;
    //         } else {
    //             resp.message = "Internal Server Error";
    //         }
    //     }
    //     return resp;
    // }

    // @ApiOperation({ summary: 'Search List of Attach Documents' })
    // @ApiCreatedResponse({
    //     description: 'Search List of Attach Documents',
    //     type: ResponseData
    // })
    // @HttpCode(HttpStatus.OK)
    // @Post('search-list')
    // async searchAttachDocument(@Body() searchData: SearchListDto) {
    //     let resp = new ResponseData();
    //     try {
    //         let res = await this.attachDocumentService.searchAttachDocument(searchData);
    //         this.logger.log(`Attach Document Search Results :${JSON.stringify(res)}`);
    //         resp.data = res;
    //         resp.message = "Attach Document Search results are successfully fetched"
    //     } catch (error) {
    //         this.logger.warn(`Attach Document Search Error : ${JSON.stringify(error)}`);
    //         resp.status = false;
    //         if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
    //             resp.message = error.message;
    //         } else {
    //             resp.message = "Internal Server Error";
    //         }
    //     }
    //     return resp;
    // }



}