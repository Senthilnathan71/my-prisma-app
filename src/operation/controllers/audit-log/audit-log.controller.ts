import { Controller, Get, HttpCode, HttpStatus, Logger, Query } from '@nestjs/common';
import { ApiOperation, ApiCreatedResponse } from '@nestjs/swagger';
import { ResponseData } from 'src/common/response-data';
import { AuditLogService } from 'src/operation/services/audit-log/audit-log.service';

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
}
