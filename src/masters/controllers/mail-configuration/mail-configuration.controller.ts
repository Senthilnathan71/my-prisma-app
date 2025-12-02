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
import { ApiCreatedResponse, ApiOperation } from '@nestjs/swagger';
import { Auth } from 'src/common/decorators/auth.decorator';
import { UserData } from 'src/common/decorators/user.decorator';
import { ResponseData } from 'src/common/response-data';
import {
    CreateMailConfigurationDto,
    SearchMailConfigurationDto,
    UpdateMailConfigurationDto,
} from 'src/masters/DTO/mail-configuration.dto';
import { MailConfigurationService } from 'src/masters/services/mail-configuration/mail-configuration.service';

@Controller('mail-configuration')
@Auth()
export class MailConfigurationController {
    constructor(
        private mailConfigService: MailConfigurationService,
        private logger: Logger
    ) {}

    @ApiOperation({ summary: 'Create new Mail Configuration' })
    @ApiCreatedResponse({
        description: 'Create new Mail Configuration',
        type: ResponseData,
    })
    @HttpCode(HttpStatus.OK)
    @Post('create')
    async create(
        @UserData() userInfo: any,
        @Body() dto: CreateMailConfigurationDto
    ) {
        const resp = new ResponseData();
        try {
            const userEmail = userInfo?.userEmail || userInfo?.email;
            const res = await this.mailConfigService.create(dto, userEmail);
            this.logger.log(`Mail Configuration created: ${JSON.stringify(res)}`);
            resp.data = res;
            resp.message = 'Mail Configuration created successfully';
        } catch (error) {
            this.logger.warn(`Mail Configuration creation error: ${error}`);
            resp.status = false;
            if (
                error instanceof BadRequestException ||
                error instanceof UnauthorizedException
            ) {
                resp.message = error.message;
            } else {
                resp.message = 'Internal Server Error';
            }
        }
        return resp;
    }

    @ApiOperation({ summary: 'Get all Mail Configurations by Company' })
    @ApiCreatedResponse({
        description: 'Get all Mail Configurations by Company',
        type: ResponseData,
    })
    @HttpCode(HttpStatus.OK)
    @Get('company/:companyId')
    async findAllByCompany(
        @Param('companyId', ParseIntPipe) companyId: number
    ) {
        const resp = new ResponseData();
        try {
            const res = await this.mailConfigService.findAll(companyId);
            this.logger.log(`Mail Configurations fetched for company: ${companyId}`);
            resp.data = res;
            resp.message = 'Mail Configurations fetched successfully';
        } catch (error) {
            this.logger.warn(`Mail Configuration fetch error: ${error}`);
            resp.status = false;
            if (
                error instanceof BadRequestException ||
                error instanceof UnauthorizedException
            ) {
                resp.message = error.message;
            } else {
                resp.message = 'Internal Server Error';
            }
        }
        return resp;
    }

    @ApiOperation({ summary: 'Get Mail Configuration by ID' })
    @ApiCreatedResponse({
        description: 'Get Mail Configuration by ID',
        type: ResponseData,
    })
    @HttpCode(HttpStatus.OK)
    @Get('fetch/:id')
    async findById(@Param('id', ParseIntPipe) id: number) {
        const resp = new ResponseData();
        try {
            const res = await this.mailConfigService.findById(id);
            this.logger.log(`Mail Configuration fetched: ${id}`);
            resp.data = res;
            resp.message = 'Mail Configuration fetched successfully';
        } catch (error) {
            this.logger.warn(`Mail Configuration fetch by ID error: ${error}`);
            resp.status = false;
            if (
                error instanceof BadRequestException ||
                error instanceof UnauthorizedException
            ) {
                resp.message = error.message;
            } else {
                resp.message = 'Internal Server Error';
            }
        }
        return resp;
    }

    @ApiOperation({ summary: 'Update Mail Configuration' })
    @ApiCreatedResponse({
        description: 'Update Mail Configuration',
        type: ResponseData,
    })
    @HttpCode(HttpStatus.OK)
    @Patch('update/:id')
    async update(
        @Param('id', ParseIntPipe) id: number,
        @Body() dto: UpdateMailConfigurationDto,
        @UserData() userInfo: any
    ) {
        const resp = new ResponseData();
        try {
            const userEmail = userInfo?.userEmail || userInfo?.email;
            const res = await this.mailConfigService.update(id, dto, userEmail);
            this.logger.log(`Mail Configuration updated: ${id}`);
            resp.data = res;
            resp.message = 'Mail Configuration updated successfully';
        } catch (error) {
            this.logger.warn(`Mail Configuration update error: ${error}`);
            resp.status = false;
            if (
                error instanceof BadRequestException ||
                error instanceof UnauthorizedException
            ) {
                resp.message = error.message;
            } else {
                resp.message = 'Internal Server Error';
            }
        }
        return resp;
    }

    @ApiOperation({ summary: 'Delete Mail Configuration' })
    @ApiCreatedResponse({
        description: 'Delete Mail Configuration',
        type: ResponseData,
    })
    @HttpCode(HttpStatus.OK)
    @Delete('delete/:id')
    async delete(
        @Param('id', ParseIntPipe) id: number,
        @UserData() userInfo: any
    ) {
        const resp = new ResponseData();
        try {
            const userEmail = userInfo?.userEmail || userInfo?.email;
            const res = await this.mailConfigService.softDelete(id, userEmail);
            this.logger.log(`Mail Configuration deleted: ${id}`);
            resp.data = res;
            resp.message = 'Mail Configuration deleted successfully';
        } catch (error) {
            this.logger.warn(`Mail Configuration delete error: ${error}`);
            resp.status = false;
            if (
                error instanceof BadRequestException ||
                error instanceof UnauthorizedException
            ) {
                resp.message = error.message;
            } else {
                resp.message = 'Internal Server Error';
            }
        }
        return resp;
    }

    @ApiOperation({ summary: 'Search Mail Configurations' })
    @ApiCreatedResponse({
        description: 'Search Mail Configurations',
        type: ResponseData,
    })
    @HttpCode(HttpStatus.OK)
    @Post('search-list')
    async search(@Body() params: SearchMailConfigurationDto) {
        const resp = new ResponseData();
        try {
            const res = await this.mailConfigService.search(params);
            this.logger.log(`Mail Configuration search completed`);
            resp.data = res;
            resp.message = 'Search completed successfully';
        } catch (error) {
            this.logger.warn(`Mail Configuration search error: ${error}`);
            resp.status = false;
            if (
                error instanceof BadRequestException ||
                error instanceof UnauthorizedException
            ) {
                resp.message = error.message;
            } else {
                resp.message = 'Internal Server Error';
            }
        }
        return resp;
    }

    @ApiOperation({ summary: 'Get Audit Logs for Mail Configuration' })
    @ApiCreatedResponse({
        description: 'Fetch audit logs',
        type: ResponseData,
    })
    @HttpCode(HttpStatus.OK)
    @Get('audit-logs')
    async getAuditLogs(
        @Query('tableName') tableName: string,
        @Query('recordId') recordId?: string
    ) {
        const resp = new ResponseData();
        try {
            if (!tableName)
                throw new Error('tableName query parameter is required');

            const logs = await this.mailConfigService.getAuditLogs(
                tableName,
                recordId
            );

            resp.data = logs.map((log: any) => {
                const oldVal = log.oldVal ? { ...log.oldVal } : null;
                const newVal = log.newVal ? { ...log.newVal } : null;
                if (oldVal && 'updatedOn' in oldVal) delete oldVal.updatedOn;
                if (newVal && 'updatedOn' in newVal) delete newVal.updatedOn;
                return { ...log, oldVal, newVal };
            });

            resp.message = 'Audit logs fetched successfully';
        } catch (error) {
            this.logger.warn(`getAuditLogsError: ${error}`);
            resp.status = false;
            resp.message = error.message || 'Internal Server Error';
        }
        return resp;
    }
}
