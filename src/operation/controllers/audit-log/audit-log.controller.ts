import { BadRequestException, Body, Controller, Get, HttpCode, HttpStatus, Logger, Post, Query, UnauthorizedException } from '@nestjs/common';
import { ApiOperation, ApiCreatedResponse } from '@nestjs/swagger';
import { ResponseData } from 'src/common/response-data';
import { Auth } from 'src/common/decorators/auth.decorator';
import { AuditLogService } from 'src/operation/services/audit-log/audit-log.service';

@Auth()
@Controller('audit-log')
export class AuditLogController {
    constructor(
        private auditLogService: AuditLogService,
        private logger: Logger,
    ) { }

    @ApiOperation({ summary: 'Get Audit Logs for a Table/Record' })
    @ApiCreatedResponse({ description: 'Fetch audit logs', type: ResponseData })
    @HttpCode(HttpStatus.OK)
    @Get('logs')
    async getAuditLogs(
        @Query('tableName') tableName: string,
        @Query('recordId') recordId?: string,
        @Query('screenName') screenName?: string
    ) {
        const resp = new ResponseData();
        try {
            if (!tableName) throw new Error('tableName query parameter is required');

            const logs = await this.auditLogService.getAuditLogs(tableName, recordId,screenName);

            resp.data = logs
            resp.message = 'Audit logs fetched successfully';
        } catch (error) {
            this.logger.warn(`getAuditLogsError: ${error}`);
            resp.status = false;
            resp.message = error.message || 'Internal Server Error';
        }
        return resp;
    }

    @ApiOperation({ summary: 'Create AuditLog'})
      @ApiCreatedResponse({
        description: 'Create AuditLog',
        type: ResponseData
      })
      @HttpCode(HttpStatus.OK)
      @Post('create')
      async createAuditLog(@Body() body:any) {
        let resp = new ResponseData();
        try {
          let res = await this.auditLogService.createManualAuditLog(body);
          this.logger.log(`New AuditLog Created: ${JSON.stringify(res)}`);
          resp.data = res;
          resp.message = "New AuditLog is successflly created"
        } catch (error) {
          this.logger.warn(`AuditLog Creation Error: ${JSON.stringify(error),error}`);
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
