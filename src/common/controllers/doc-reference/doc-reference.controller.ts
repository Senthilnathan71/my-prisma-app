import {
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
} from '@nestjs/common';
import { ApiBody, ApiCreatedResponse, ApiOperation } from '@nestjs/swagger';
import { Auth } from 'src/common/decorators/auth.decorator';
import { UserData } from 'src/common/decorators/user.decorator';
import { ResponseData } from 'src/common/response-data';
import { DocReferenceService } from 'src/common/services/doc-reference/doc-reference.service';
import { CreateDocReferenceDto, UpdateDocReferenceDto } from './dto/create-doc-reference.dto';

@Controller('doc-reference')
@Auth()
export class DocReferenceController {
  constructor(
    private docReferenceService: DocReferenceService,
    private logger: Logger,
  ) {}

  @ApiOperation({ summary: 'Create or Update Document Reference' })
  @ApiCreatedResponse({
    description: 'Document Reference Creation/Update',
    type: ResponseData,
  })
  @ApiBody({ type: CreateDocReferenceDto })
  @HttpCode(HttpStatus.CREATED)
  @Post('create')
  async create(@Body() body: CreateDocReferenceDto, @UserData() user: any) {
    const output = new ResponseData();
    this.logger.log(`📝 createDocReference body: ${JSON.stringify(body)}`);

    try {
      // DTO validation handles these checks automatically via class-validator
      const result = await this.docReferenceService.create(body, user);

      if (result && result.data) {
        output.status = result.Status ?? true;
        output.data = result.data;
        output.message = result.message || 'Document Reference created successfully';
      } else {
        output.status = false;
        output.message = 'Failed to create document reference';
        output.data = null;
      }
    } catch (error: any) {
      this.logger.error(`❌ createDocReference error: ${error.message}`);
      output.status = false;
      output.message = error.message || 'Internal Server Error';
      output.data = null;
    }

    return output;
  }

  @ApiOperation({ summary: 'Get All Document References' })
  @HttpCode(HttpStatus.OK)
  @Get('list')
  async findAll(@Query() filter: any) {
    const output = new ResponseData();

    try {
      const parsedFilter: any = {};

      if (filter.CompanyMasterSid) {
        parsedFilter.CompanyMasterSid = parseInt(filter.CompanyMasterSid, 10);
      }

      if (filter.BranchMasterSid) {
        parsedFilter.BranchMasterSid = parseInt(filter.BranchMasterSid, 10);
      }

      if (filter.Status) {
        parsedFilter.Status = filter.Status;
      }

      if (filter.search) parsedFilter.search = filter.search;
      if (filter.RefDocumentNo) parsedFilter.RefDocumentNo = filter.RefDocumentNo;
      if (filter.Remarks) parsedFilter.Remarks = filter.Remarks;
      if (filter.searchTerm) parsedFilter.searchTerm = filter.searchTerm;

      this.logger.log(`📤 list filter: ${JSON.stringify(parsedFilter)}`);

      const result = await this.docReferenceService.findAll(parsedFilter);

      output.status = result.Status ?? true;
      output.data = result.data || [];
      output.message = result.message || `Found ${result.data?.length || 0} documents`;
    } catch (error: any) {
      this.logger.error(`❌ findAll error: ${error.message}`);
      output.status = false;
      output.message = error.message || 'Internal Server Error';
      output.data = [];
    }

    return output;
  }

  @ApiOperation({ summary: 'Get Document Reference By Id' })
  @HttpCode(HttpStatus.OK)
  @Get('fetch/:id')
  async findOne(@Param('id', ParseIntPipe) id: number) {
    const output = new ResponseData();

    try {
      const result = await this.docReferenceService.findOne(id);
      output.status = result.Status ?? true;
      output.data = result.data || null;
      output.message = result.message || 'Document found';
    } catch (error: any) {
      this.logger.error(`❌ findOne error: ${error.message}`);
      output.status = false;
      output.message = error.message || 'Internal Server Error';
      output.data = null;
    }

    return output;
  }

  @ApiOperation({ summary: 'Update Document Reference' })
  @ApiBody({ type: UpdateDocReferenceDto })
  @HttpCode(HttpStatus.OK)
  @Patch('update/:id')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: UpdateDocReferenceDto,
    @UserData() user: any,
  ) {
    const output = new ResponseData();
    this.logger.log(`🔄 updateDocReference id=${id} body=${JSON.stringify(body)}`);

    try {
      const result = await this.docReferenceService.update(id, body, user);
      output.status = result.Status ?? true;
      output.data = result.data || null;
      output.message = result.message || 'Document Reference updated successfully';
    } catch (error: any) {
      this.logger.error(`❌ update error: ${error.message}`);
      output.status = false;
      output.message = error.message || 'Internal Server Error';
      output.data = null;
    }

    return output;
  }

  @ApiOperation({ summary: 'Delete Document Reference' })
  @HttpCode(HttpStatus.OK)
  @Delete('delete/:id')
  async delete(@Param('id', ParseIntPipe) id: number) {
    const output = new ResponseData();
    this.logger.log(`🗑️ deleteDocReference id=${id}`);

    try {
      const result = await this.docReferenceService.softDelete(id);
      output.status = result.Status ?? true;
      output.data = result.data || null;
      output.message = result.message || 'Document Reference deleted successfully';
    } catch (error: any) {
      this.logger.error(`❌ delete error: ${error.message}`);
      output.status = false;
      output.message = error.message || 'Internal Server Error';
      output.data = null;
    }

    return output;
  }
}
