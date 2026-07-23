import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Logger,
  Param,
  ParseIntPipe,
  Post,
  Query,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiCreatedResponse, ApiOperation } from '@nestjs/swagger';
import { Auth } from 'src/common/decorators/auth.decorator';
import { ResponseData } from 'src/common/response-data';
import { PendingApprovalDto } from 'src/masters/DTO/pending-approval.dto';
import {
  ApproveDocumentDto,
  AutoApproveDto,
  BulkApproveDto,
} from 'src/masters/DTO/approve-document.dto';
import { AuthorizationApprovalService } from 'src/masters/services/authorization-approval/authorization-approval.service';

@Auth()
@Controller('authorization-approval')
export class AuthorizationApprovalController {
  constructor(
    private authorizationApprovalService: AuthorizationApprovalService,
    private logger: Logger,
  ) {}

  @ApiOperation({ summary: 'Menus assigned to the logged-in user (approval dropdown)' })
  @ApiCreatedResponse({ description: 'List of the user approval menus', type: ResponseData })
  @HttpCode(HttpStatus.OK)
  @Get('menus/:UserMasterSid')
  async getAvailableMenus(
    @Param('UserMasterSid', ParseIntPipe) UserMasterSid: number,
    @Query('CompanyMasterSid') CompanyMasterSid: string,
    @Query('BranchMasterSid') BranchMasterSid: string,
  ) {
    const resp = new ResponseData();
    try {
      resp.data = await this.authorizationApprovalService.getAvailableMenus(
        UserMasterSid,
        Number(CompanyMasterSid),
        Number(BranchMasterSid),
      );
      resp.message = 'Approval menus fetched successfully';
    } catch (error) {
      this.logger.warn(`Approval Menus Error: ${error}`);
      resp.status = false;
      resp.message = this.errorMessage(error);
    }
    return resp;
  }

  @ApiOperation({ summary: 'Pending documents awaiting the logged-in user approval' })
  @ApiCreatedResponse({ description: 'Paginated pending documents', type: ResponseData })
  @HttpCode(HttpStatus.OK)
  @Post('pending')
  async getPendingDocuments(@Body() param: PendingApprovalDto) {
    const resp = new ResponseData();
    try {
      resp.data = await this.authorizationApprovalService.getPendingDocuments(param);
      resp.message = 'Pending approvals fetched successfully';
    } catch (error) {
      this.logger.warn(`Pending Approvals Error: ${error}`);
      resp.status = false;
      resp.message = this.errorMessage(error);
    }
    return resp;
  }

  @ApiOperation({ summary: 'Approval timeline for one document under a menu' })
  @ApiCreatedResponse({ description: 'Multi-level approval log', type: ResponseData })
  @HttpCode(HttpStatus.OK)
  @Get('details/:MenuMasterSid/:DocumentSid')
  async getApprovalDetails(
    @Param('MenuMasterSid', ParseIntPipe) MenuMasterSid: number,
    @Param('DocumentSid', ParseIntPipe) DocumentSid: number,
    @Query('CompanyMasterSid') CompanyMasterSid?: string,
    @Query('BranchMasterSid') BranchMasterSid?: string,
    @Query('DepartmentMasterSid') DepartmentMasterSid?: string,
  ) {
    const resp = new ResponseData();
    try {
      resp.data = await this.authorizationApprovalService.getApprovalDetails(
        MenuMasterSid,
        DocumentSid,
        CompanyMasterSid ? Number(CompanyMasterSid) : undefined,
        BranchMasterSid ? Number(BranchMasterSid) : undefined,
        DepartmentMasterSid ? Number(DepartmentMasterSid) : undefined,
      );
      resp.message = 'Approval details fetched successfully';
    } catch (error) {
      this.logger.warn(`Approval Details Error: ${error}`);
      resp.status = false;
      resp.message = this.errorMessage(error);
    }
    return resp;
  }

  @ApiOperation({ summary: 'Approve one document' })
  @ApiCreatedResponse({ description: 'Refreshed approval status', type: ResponseData })
  @HttpCode(HttpStatus.OK)
  @Post('approve')
  async approve(@Body() payload: ApproveDocumentDto) {
    const resp = new ResponseData();
    try {
      resp.data = await this.authorizationApprovalService.decide(payload, 'Approved');
      resp.message = 'Document approved successfully';
    } catch (error) {
      this.logger.warn(`Approve Error: ${error}`);
      resp.status = false;
      resp.message = this.errorMessage(error);
    }
    return resp;
  }

  @ApiOperation({ summary: 'Reject one document' })
  @ApiCreatedResponse({ description: 'Refreshed approval status', type: ResponseData })
  @HttpCode(HttpStatus.OK)
  @Post('reject')
  async reject(@Body() payload: ApproveDocumentDto) {
    const resp = new ResponseData();
    try {
      resp.data = await this.authorizationApprovalService.decide(payload, 'Rejected');
      resp.message = 'Document rejected successfully';
    } catch (error) {
      this.logger.warn(`Reject Error: ${error}`);
      resp.status = false;
      resp.message = this.errorMessage(error);
    }
    return resp;
  }

  @ApiOperation({ summary: 'Bulk approve selected documents' })
  @ApiCreatedResponse({ description: 'Per-document approve result', type: ResponseData })
  @HttpCode(HttpStatus.OK)
  @Post('bulk-approve')
  async bulkApprove(@Body() payload: BulkApproveDto) {
    const resp = new ResponseData();
    try {
      resp.data = await this.authorizationApprovalService.bulkDecide(payload, 'Approved');
      resp.message = 'Bulk approval processed';
    } catch (error) {
      this.logger.warn(`Bulk Approve Error: ${error}`);
      resp.status = false;
      resp.message = this.errorMessage(error);
    }
    return resp;
  }

  @ApiOperation({ summary: 'Bulk reject selected documents' })
  @ApiCreatedResponse({ description: 'Per-document reject result', type: ResponseData })
  @HttpCode(HttpStatus.OK)
  @Post('bulk-reject')
  async bulkReject(@Body() payload: BulkApproveDto) {
    const resp = new ResponseData();
    try {
      resp.data = await this.authorizationApprovalService.bulkDecide(payload, 'Rejected');
      resp.message = 'Bulk rejection processed';
    } catch (error) {
      this.logger.warn(`Bulk Reject Error: ${error}`);
      resp.status = false;
      resp.message = this.errorMessage(error);
    }
    return resp;
  }

  @ApiOperation({ summary: 'System auto-approval for a document (config-driven)' })
  @ApiCreatedResponse({ description: 'Auto approval result', type: ResponseData })
  @HttpCode(HttpStatus.OK)
  @Post('auto-approve')
  async autoApprove(@Body() payload: AutoApproveDto) {
    const resp = new ResponseData();
    try {
      resp.data = await this.authorizationApprovalService.autoApprove(payload);
      resp.message = resp.data?.message || 'Auto approval processed';
    } catch (error) {
      this.logger.warn(`Auto Approve Error: ${error}`);
      resp.status = false;
      resp.message = this.errorMessage(error);
    }
    return resp;
  }

  private errorMessage(error: any): string {
    return error instanceof BadRequestException || error instanceof UnauthorizedException
      ? error.message
      : 'Internal Server Error';
  }
}
