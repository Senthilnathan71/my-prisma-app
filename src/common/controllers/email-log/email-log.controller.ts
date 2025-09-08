import { BadRequestException, Body, Controller, Delete, Get, HttpCode, HttpStatus, Logger, Param, ParseIntPipe, Patch, Post, UnauthorizedException, UploadedFiles } from '@nestjs/common';
import { ApiOperation, ApiCreatedResponse } from '@nestjs/swagger';
import { Auth } from 'src/common/decorators/auth.decorator';
import { FilesUploadInterceptor } from 'src/common/decorators/file-upload.decorator';
import { UserData } from 'src/common/decorators/user.decorator';
import { ResponseData } from 'src/common/response-data';
import { EmailLogService } from 'src/common/services/email-log/email-log.service';
import { SearchListDto } from 'src/masters/DTO/search-list.dto';


@Controller('emailLog')
@Auth()
export class emailLogController {
    constructor(private emailLogService: EmailLogService, private logger: Logger) { }

    @ApiOperation({ summary: 'emailLog Creation' })
    @ApiCreatedResponse({
        description: 'emailLog Creation',
        type: ResponseData
    })
    @HttpCode(HttpStatus.CREATED)
    @Post('create')
    async createEmailLog(@Body() body:any, @UserData() user: any) {
        this.logger.log(`createemailLogdata: ${JSON.stringify(body)}`)
        let output = new ResponseData
        try {
            let emailLog = await this.emailLogService.createEmailLog(body, user);
            this.logger.debug(`createemailLog: ${JSON.stringify(emailLog)}`)
            if (!emailLog) {
                this.logger.warn(`createemailLog!!: ${JSON.stringify(emailLog)}`)
                throw 'Something went wrong'
            }
            output.data = emailLog
            output.message = 'emailLog Created Successfully'
        } catch (error) {
            this.logger.warn(`createemailLogError: ${error}`)
            output.status = false;
            // Handle error message based on the type of error
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                output.message = error.message;
                this.logger.warn(`createemailLogError: ${error.message}`)
            } else {
                this.logger.warn(`createemailLogError: ${error}`)
                output.message = error;
            }
        }
        return output
    }


    @ApiOperation({ summary: 'Get All emailLog' })
    @ApiCreatedResponse({
        description: 'Get All emailLogs',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Get()
    async getAllEmailLogs() {
        let output = new ResponseData;
        try {
            let emailLogData = await this.emailLogService.getAllEmailLogs();
            this.logger.log(`getAllemailLogs: ${JSON.stringify(emailLogData)}`)
            output.data = emailLogData;
        } catch (error) {
            this.logger.warn(`getAllemailLogs: ${JSON.stringify(error)}`)
            output.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                output.message = error.message;
            } else {
                output.message = 'Internal Server Error';
            }
        }
        return output
    }


    @ApiOperation({ summary: 'Get emailLog By Id' })
    @ApiCreatedResponse({
        description: 'Get emailLog By Id',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Get('fetch/:id')
    async getemailLogById(@Param('id', ParseIntPipe) emailLogId: number) {
        const output = new ResponseData;
        try {
            const emailLog = await this.emailLogService.findOne(emailLogId)
            this.logger.log(`getemailLogById: ${JSON.stringify(emailLog)}`)
            output.data = emailLog
        } catch (error) {
            this.logger.warn(`getemailLogById: ${JSON.stringify(error)}`)
            output.status = false;
            output.message = error
        }
        return output;
    }


    @ApiOperation({ summary: 'Update emailLog By Id' })
    @ApiCreatedResponse({
        description: 'Update emailLog By Id',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Patch('update/:id')
    async editEmailLog(@Param('id', ParseIntPipe) id: number, @Body() body: any, @UserData() user: any) {
        this.logger.log(`editemailLogbody: ${JSON.stringify(body)}`)
        let output = new ResponseData
        try {
            let emailLog = await this.emailLogService.updateEmailLog(id, body, user);
            this.logger.log(`editemailLog: ${JSON.stringify(emailLog)}`)

            if (!emailLog) {
                this.logger.log(`editemailLog!!: ${JSON.stringify(emailLog)}`)
                throw 'Something went wrong'
            } else {
                this.logger.log(`editemailLogelse: ${emailLog}`)
            }
            output.data = emailLog;
            output.message = 'emailLog Updated Successfully'
        } catch (error) {
            this.logger.warn(`editemailLogerror: ${JSON.stringify(error), error}`)
            output.status = false;
            // Handle error message based on the type of error
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                this.logger.warn(`editemailLogbadrequest: ${error}`)
                output.message = error.message;
            } else {
                output.message = error;
            }
        }
        this.logger.log(`editemailLogmessage: ${output.message}`)
        return output
    }



    @ApiOperation({ summary: 'Delete emailLog By Id' })
    @ApiCreatedResponse({
        description: 'Delete emailLog By Id',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Delete('delete/:id')
    async softDelete(@Param('id', ParseIntPipe) id: number) {
        return this.emailLogService.softDelete(id);
    }


    @ApiOperation({ summary: 'emailLog Creation' })
    @ApiCreatedResponse({
        description: 'emailLog Creation',
        type: ResponseData
    })
    @FilesUploadInterceptor('attachments', 'UPLOAD_DOC_PATH') 
    @HttpCode(HttpStatus.CREATED)
    @Post('createWithAttachment')
    async newCreateEmailLog(
        @Body() body: any,
        @UploadedFiles() files: Express.Multer.File[], 
        @UserData() user: any
    ) {
        this.logger.log(`createemailLogdata: ${JSON.stringify(body)}`);
        this.logger.log(`uploaded files count: ${files?.length || 0}`);

        let output = new ResponseData();
        try {
            let emailLog = await this.emailLogService.createNewEmailLog(body, files, user);
            this.logger.debug(`createemailLog: ${JSON.stringify(emailLog)}`);
            if (!emailLog) {
                this.logger.warn(`createemailLog!!: ${JSON.stringify(emailLog)}`);
                throw 'Something went wrong';
            }
            output.data = emailLog;
            output.message = 'emailLog Created Successfully';
        } catch (error) {
            this.logger.warn(`createemailLogError: ${error}`);
            output.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                output.message = error.message;
                this.logger.warn(`createemailLogError: ${error.message}`);
            } else {
                this.logger.warn(`createemailLogError: ${error}`);
                output.message = error.message;
            }
        }
        return output;
    }

}
