import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Logger,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiBody, ApiCreatedResponse, ApiOperation } from '@nestjs/swagger';
import { Auth } from 'src/common/decorators/auth.decorator';
import { UserData } from 'src/common/decorators/user.decorator';
import { ResponseData } from 'src/common/response-data';
import { DocReferenceService } from 'src/common/services/doc-reference/doc-reference.service';
import { CreateDocReferenceDto, UpdateDocReferenceDto } from './dto/create-doc-reference.dto';

@Controller('doc-reference')
export class DocReferenceController {
  constructor(
    private docReferenceService: DocReferenceService,
    private logger: Logger,
  ) {}

  @ApiOperation({ summary: 'Create new Doc Reference'})
  @ApiCreatedResponse({
    description: 'Create new Doc Refernce',
    type: ResponseData
  })
  @HttpCode(HttpStatus.OK)
  @Post('create')
  async createDocReference(@Body() newData:any) {
    let resp = new ResponseData();
    try {
      let res = await this.docReferenceService.createDocReference(newData);
      this.logger.log(`New Doc Reference Created: ${JSON.stringify(res)}`);
      resp.data = res;
      resp.message = "New Doc Reference is successflly created"
    } catch (error) {
      this.logger.warn(`Doc Reference Creation Error: ${JSON.stringify(error),error}`);
      resp.status = false;
      if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
        resp.message = error.message;
      } else {
        resp.message = "Internal Server Error";
      }
    }
    return resp;
  }

  @ApiOperation({ summary: 'Get All Doc Reference' })
  @ApiCreatedResponse({
    description: 'Get All Doc Reference',
    type: ResponseData
  })
  @HttpCode(HttpStatus.OK)
  @Post()
  async getAllDocReference(@Body() body: any) {
    let resp = new ResponseData();
    try {
      let res = await this.docReferenceService.getAllDocReference(body);
      this.logger.log(`All Doc Reference Fetched: ${JSON.stringify(res)}`);
      resp.data = res;
      resp.message = "All Doc Reference are successfully fetched";
    } catch (error) {
      this.logger.warn(`Doc Reference Fetch Error: ${JSON.stringify(error), error}`);
      resp.status = false;
      if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
        resp.message = error.message;
      } else {
        resp.message = "Internal Server Error";
      }
    }
    return resp;
  }

  @ApiOperation({ summary: 'Get Doc Reference by Id' })
  @ApiCreatedResponse({
    description: 'Get Doc Reference by Id',
    type: ResponseData
  })
  @HttpCode(HttpStatus.OK)
  @Get('fetch/:RefDocumentSid')
  async getDocReferenceById(@Param('RefDocumentSid', ParseIntPipe) RefDocumentSid: number) {
    let resp = new ResponseData();
    try {
      this.logger.log(`Getting Doc Reference with id: ${RefDocumentSid}`);
      let res = await this.docReferenceService.fetchDocReferenceById(RefDocumentSid);
      this.logger.debug(`Fetched Doc Reference: ${JSON.stringify(res)}`);
      resp.data = res;
      resp.message = `Doc Reference with id: ${RefDocumentSid} is successfully fetched`;
    } catch (error) {
      this.logger.warn(`Get Doc Reference by Id Error: ${JSON.stringify(error), error}`);
      resp.status =false;
      if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
        resp.message = error.message;
      } else {
        resp.message = "Internal Server Error";
      }
    }
    return resp;
  }

  @ApiOperation({ summary: 'Update Doc Reference' })
  @ApiCreatedResponse({
    description: 'Update Doc Reference',
    type: ResponseData
  })
  @HttpCode(HttpStatus.OK)
  @Patch('update/:RefDocumentSid')
  async updateDocReference(@Param('RefDocumentSid', ParseIntPipe) RefDocumentSid: number, @Body() payload: any, @UserData() user:any) {
    let resp = new ResponseData();
    try {
      this.logger.log(`Updating Doc Reference with id : ${RefDocumentSid}`);
      let res = await this.docReferenceService.updateDocReferenceById(RefDocumentSid, payload);
      this.logger.debug(`Updated Doc Reference : ${JSON.stringify(res)}`);
      resp.data = res;
      resp.message = `Doc Reference with id: ${RefDocumentSid} is successfully updated`;
    }  catch (error) {
      this.logger.warn(`Doc Reference Updation Error : ${JSON.stringify(error), error}`);
      resp.status = false;
      if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
        resp.message = error.message;
      } else {
        resp.message = "Internal Server Error";
      }
    }
    return resp;
  }

  @ApiOperation({ summary: 'Delete Doc Reference by Id' })
  @ApiCreatedResponse({
    description: 'Delete Doc Reference by Id',
    type: ResponseData
  })
  @HttpCode(HttpStatus.OK)
  @Delete('delete/:RefDocumentSid')
  async deleteDocReference(@Param('RefDocumentSid', ParseIntPipe) RefDocumentSid: number) {
    let resp = new ResponseData();
    try {
      this.logger.log(`Deleting Doc Reference with id : ${RefDocumentSid}`);
      let res = await this.docReferenceService.deleteDocReference(RefDocumentSid);
      this.logger.debug(`Deleted Doc Reference: ${JSON.stringify(res)}`);
      resp.data = res;
      resp.message = `Doc Reference with id: ${RefDocumentSid} is successfully deleted`;
    } catch (error) {
      this.logger.warn(`Doc Reference Deletion Error: ${JSON.stringify(error), error}`);
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
