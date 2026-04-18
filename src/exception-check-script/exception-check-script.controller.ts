import {
  Controller, Get, Post, Patch, Delete, Body, Param, Query,
  ParseIntPipe, HttpCode, HttpStatus, Res, Logger,
  BadRequestException, NotFoundException,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { ResponseData } from 'src/common/response-data';
import { ExceptionCheckScriptService } from './exception-check-script.service';
import { ExceptionCheckScriptExecutorService, ExecutionTimeoutError } from './exception-check-script-executor.service';
import { CreateExceptionCheckScriptDto } from './dto/create-exception-check-script.dto';
import { UpdateExceptionCheckScriptDto } from './dto/update-exception-check-script.dto';

@ApiTags('Exception Check Script')
@Controller('exception-check-script')
export class ExceptionCheckScriptController {
  constructor(
    private readonly svc: ExceptionCheckScriptService,
    private readonly executor: ExceptionCheckScriptExecutorService,
    private readonly logger: Logger,
  ) {}

  // ─── CRUD ───────────────────────────────────────────

  @ApiOperation({ summary: 'List scripts' })
  @HttpCode(HttpStatus.OK)
  @Get()
  async findAll(@Query('search') search?: string) {
    const resp = new ResponseData();
    try {
      resp.data = await this.svc.findAll(search);
      resp.message = 'Exception-check scripts fetched';
    } catch (e: any) {
      this.logger.warn(`findAll: ${e.message}`);
      resp.status = false;
      resp.message = 'Internal Server Error';
    }
    return resp;
  }

  @ApiOperation({ summary: 'Get one script' })
  @HttpCode(HttpStatus.OK)
  @Get(':id')
  async findOne(@Param('id', ParseIntPipe) id: number) {
    const resp = new ResponseData();
    try {
      resp.data = await this.svc.findOne(id);
      resp.message = 'Script fetched';
    } catch (e: any) {
      this.logger.warn(`findOne: ${e.message}`);
      resp.status = false;
      resp.message = e instanceof NotFoundException ? e.message : 'Internal Server Error';
    }
    return resp;
  }

  @ApiOperation({ summary: 'Create script' })
  @HttpCode(HttpStatus.CREATED)
  @Post()
  async create(@Body() dto: CreateExceptionCheckScriptDto, @Query('username') username: string) {
    const resp = new ResponseData();
    try {
      resp.data = await this.svc.create(dto, username || 'system');
      resp.message = 'Script created';
    } catch (e: any) {
      this.logger.warn(`create: ${e.message}`);
      resp.status = false;
      resp.message = e instanceof BadRequestException ? e.message : 'Internal Server Error';
    }
    return resp;
  }

  @ApiOperation({ summary: 'Update script' })
  @HttpCode(HttpStatus.OK)
  @Patch(':id')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateExceptionCheckScriptDto,
    @Query('username') username: string,
  ) {
    const resp = new ResponseData();
    try {
      resp.data = await this.svc.update(id, dto, username || 'system');
      resp.message = 'Script updated';
    } catch (e: any) {
      this.logger.warn(`update: ${e.message}`);
      resp.status = false;
      resp.message = e instanceof BadRequestException || e instanceof NotFoundException ? e.message : 'Internal Server Error';
    }
    return resp;
  }

  @ApiOperation({ summary: 'Soft-delete script' })
  @HttpCode(HttpStatus.OK)
  @Delete(':id')
  async remove(@Param('id', ParseIntPipe) id: number, @Query('username') username: string) {
    const resp = new ResponseData();
    try {
      resp.data = await this.svc.remove(id, username || 'system');
      resp.message = 'Script deleted';
    } catch (e: any) {
      this.logger.warn(`remove: ${e.message}`);
      resp.status = false;
      resp.message = e instanceof NotFoundException ? e.message : 'Internal Server Error';
    }
    return resp;
  }

  @ApiOperation({ summary: 'Toggle active' })
  @HttpCode(HttpStatus.OK)
  @Patch(':id/toggle-active')
  async toggleActive(@Param('id', ParseIntPipe) id: number, @Query('username') username: string) {
    const resp = new ResponseData();
    try {
      resp.data = await this.svc.toggleActive(id, username || 'system');
      resp.message = 'Script toggled';
    } catch (e: any) {
      this.logger.warn(`toggleActive: ${e.message}`);
      resp.status = false;
      resp.message = e instanceof NotFoundException ? e.message : 'Internal Server Error';
    }
    return resp;
  }

  // ─── EXECUTION ─────────────────────────────────────

  @ApiOperation({ summary: 'Manual execute — returns rows' })
  @HttpCode(HttpStatus.OK)
  @Post(':id/execute')
  async execute(@Param('id', ParseIntPipe) id: number, @Query('username') username: string) {
    const resp = new ResponseData();
    try {
      resp.data = await this.executor.executeManual(id, username || 'system');
      resp.message = 'Script executed';
    } catch (e: any) {
      this.logger.warn(`execute: ${e.message}`);
      resp.status = false;
      resp.message = e instanceof ExecutionTimeoutError
        ? 'Query timed out after 30 seconds'
        : (e.message || 'Internal Server Error');
    }
    return resp;
  }

  @ApiOperation({ summary: 'Manual execute — streams Excel' })
  @HttpCode(HttpStatus.OK)
  @Post(':id/execute/export')
  async executeExport(
    @Param('id', ParseIntPipe) id: number,
    @Query('username') username: string,
    @Res() res: Response,
  ) {
    try {
      const { excel, filename } = await this.executor.executeManualAndExport(id, username || 'system');
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.end(excel);
    } catch (e: any) {
      this.logger.warn(`executeExport: ${e.message}`);
      res.status(500).json({
        status: false,
        message: e instanceof ExecutionTimeoutError ? 'Query timed out after 30 seconds' : (e.message || 'Internal Server Error'),
      });
    }
  }

  @ApiOperation({ summary: 'Validate script text (dry-run)' })
  @HttpCode(HttpStatus.OK)
  @Post('validate')
  async validate(@Body() body: { ScriptText: string }) {
    const resp = new ResponseData();
    try {
      resp.data = this.svc.validateSqlOnly(body?.ScriptText ?? '');
      resp.message = 'Validated';
    } catch (e: any) {
      this.logger.warn(`validate: ${e.message}`);
      resp.status = false;
      resp.message = 'Internal Server Error';
    }
    return resp;
  }

  @ApiOperation({ summary: 'Get run history' })
  @HttpCode(HttpStatus.OK)
  @Get(':id/runs')
  async runs(@Param('id', ParseIntPipe) id: number, @Query('limit') limit?: string) {
    const resp = new ResponseData();
    try {
      resp.data = await this.svc.getRuns(id, limit ? Number(limit) : 50);
      resp.message = 'Run history fetched';
    } catch (e: any) {
      this.logger.warn(`runs: ${e.message}`);
      resp.status = false;
      resp.message = e instanceof NotFoundException ? e.message : 'Internal Server Error';
    }
    return resp;
  }
}
