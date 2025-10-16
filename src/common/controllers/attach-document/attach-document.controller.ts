import { BadRequestException, Body, Controller, Delete, Get, HttpCode, HttpStatus, Logger, Param, ParseIntPipe, Patch, Post, UnauthorizedException, UploadedFiles } from '@nestjs/common';
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
import { MenuService } from 'src/masters/services/menu/menu.service';
import { DynamicFilesUploadInterceptor } from 'src/common/decorators/edoc.decorator';
import { UserData } from 'src/common/decorators/user.decorator';
import { EmailService } from 'src/email/email.service';
@Controller('attach-document')
export class AttachDocumentController {
    constructor(private configService: ConfigService,
        private emailService: EmailService,
        private menuMasterService: MenuService, private attachDocumentService: AttachDocumentService, private logger: Logger) { }

    @ApiOperation({ summary: 'Create new Attach Document' })
    @ApiCreatedResponse({
        description: 'Create new Attach Document',
        type: ResponseData
    })
    @DynamicFilesUploadInterceptor("files", 10, 20)
    @HttpCode(HttpStatus.CREATED)
    @Post('create')
    async createNewAttachDocument(@UploadedFiles() files: Express.Multer.File[], @Body() newData: any, @UserData() user: any) {
        let resp = new ResponseData();
        try {
            if (!files || files.length === 0) {
                throw new BadRequestException("No files uploaded");
            }
            const menuName: any = await this.menuMasterService.findOne(Number(newData.MenuMasterSid))
            // 1️⃣ Save DB record
            const res = await this.attachDocumentService.createNewAttachDocument(files, newData, menuName?.MenuName, user);

            // 2️⃣ Get config and directory info
            const baseDestination = this.configService.get('UPLOAD_EDOC_PATH');
            const componentName: any = menuName?.MenuName;
            const recordId: any = newData.DocumentSid;

            // Ensure base folder exists
            const folderPath = path.join(baseDestination, componentName, recordId.toString());
            if (!fs.existsSync(folderPath)) fs.mkdirSync(folderPath, { recursive: true });

            // 3️⃣ Save each file with the DB file name
            res.forEach(async (docRecord, index) => {
                const file = files[index];
                const dbFileName = docRecord.FileName; // ✅ take file name from DB
                const savePath = path.join(folderPath, dbFileName);

                fs.writeFileSync(savePath, file.buffer);
                // Step 3: Send email if sentEmail is 'Y'
                if (newData.sentEmail === 'Y') {
                    // Render Pug template
                    const templatePath = path.join(process.cwd(), 'src', 'email', 'templates', 'followup-email.pug');
                    const html = pug.renderFile(templatePath, {
                        recipientName: 'User',
                        fileName: file.originalname,
                        link: '#',
                        followupDate: newData.FollowupDate
                            ? new Date(newData.FollowupDate).toLocaleDateString()
                            : 'N/A',
                        remarks: newData.FollowupRemarks || '',
                    });
                    // Send email
                    await this.emailService.sendFollowupEmail({
                        email: 'developer1@dofi.co',  //for testing use your email
                        cc: '',
                        subject: newData.emailSubject || 'Follow-up Document',
                        html: html,
                        file: file,
                    });
                }
                console.log(`✅ File saved: ${savePath}`);
            });

            resp.data = res;
            resp.message = "New Attach Document is successfully created";
            this.logger.log(`New Attach Document Created: ${JSON.stringify(res)}`);
        } catch (error) {
            console.log(error.stack)
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
    @DynamicFilesUploadInterceptor("files", 10, 20)
    @HttpCode(HttpStatus.OK)
    @Patch('update/:AttachDocumentSid')
    async updateAttachDocumentById(@UploadedFiles() files: Express.Multer.File[], @Param('AttachDocumentSid', ParseIntPipe) AttachDocumentSid: number, @Body() payload: any) {
        let resp = new ResponseData();
        try {
            this.logger.log(`Updating Attach Document with id : ${AttachDocumentSid}`);
            let res = await this.attachDocumentService.updateAttachDocumentById(files, AttachDocumentSid, payload);
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

    @ApiOperation({ summary: 'Fetch Attach Document by Folder Structure' })
    @ApiCreatedResponse({
        description: 'Fetch Attach Document by Folder Structure',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Post('fetch-by-folder')
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

}