import {
  Injectable,
  Logger,
  OnModuleInit,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { DatabaseService } from 'src/database/database.service';
import { SchedulerService } from 'src/common/services/scheduler/scheduler.service';
import { ExceptionCheckScriptExecutorService } from './exception-check-script-executor.service';
import { CreateExceptionCheckScriptDto } from '../../DTO/create-exception-check-script.dto';
import { UpdateExceptionCheckScriptDto } from '../../DTO/update-exception-check-script.dto';
import { validateReadOnlySql } from 'src/settings/controllers/exception-check-script/exception-check-script-validator';

@Injectable()
export class ExceptionCheckScriptService implements OnModuleInit {
  private readonly CRON_PREFIX = 'exception-check-';

  constructor(
    private readonly db: DatabaseService,
    private readonly scheduler: SchedulerService,
    private readonly executor: ExceptionCheckScriptExecutorService,
    private readonly logger: Logger,
  ) {}

  // ─── LIFECYCLE ───────────────────────────────────────────

  async onModuleInit(): Promise<void> {
    try {
      const scripts = await this.db.exceptionCheckScript.findMany({
        where: { Status: 'A', IsActive: true, ExecutionMode: 'SCHEDULED' },
      });
      this.logger.log(`Registering ${scripts.length} active exception-check schedule(s)`);
      for (const s of scripts) this.registerCron(s);
    } catch (err: any) {
      this.logger.error(`Failed to initialise exception-check schedules: ${err.message}`);
    }
  }

  // ─── CRUD ────────────────────────────────────────────────

  async findAll(search?: string) {
    return this.db.exceptionCheckScript.findMany({
      where: {
        Status: 'A',
        ...(search ? { ScriptName: { contains: search, mode: 'insensitive' } } : {}),
      },
      orderBy: { CreatedOn: 'desc' },
    });
  }

  async findOne(id: number) {
    const script = await this.db.exceptionCheckScript.findFirst({
      where: { ExceptionCheckScriptSid: id, Status: 'A' },
    });
    if (!script) throw new NotFoundException(`Script #${id} not found`);
    return script;
  }

  async create(dto: CreateExceptionCheckScriptDto, username: string) {
    this.assertValidSql(dto.ScriptText);
    await this.assertNameUnique(dto.ScriptName.trim());

    const script = await this.db.exceptionCheckScript.create({
      data: {
        ScriptName: dto.ScriptName.trim(),
        ScriptDescription: dto.ScriptDescription ?? null,
        ScriptText: dto.ScriptText,
        ExecutionMode: dto.ExecutionMode,
        Frequency: dto.Frequency ?? null,
        DayOfWeek: dto.DayOfWeek ?? null,
        DayOfMonth: dto.DayOfMonth ?? null,
        ScheduleTime: dto.ScheduleTime ?? null,
        TimeZone: dto.TimeZone ?? null,
        ToEmails: dto.ToEmails ?? null,
        CcEmails: dto.CcEmails ?? null,
        IsActive: dto.IsActive ?? true,
        CreatedBy: username,
        UpdatedBy: username,
      },
    });

    if (this.shouldRegister(script)) this.registerCron(script);
    return script;
  }

  async update(id: number, dto: UpdateExceptionCheckScriptDto, username: string) {
    const existing = await this.findOne(id);

    if (dto.ScriptText !== undefined) this.assertValidSql(dto.ScriptText);
    if (dto.ScriptName !== undefined && dto.ScriptName.trim() !== existing.ScriptName) {
      await this.assertNameUnique(dto.ScriptName.trim(), id);
    }

    this.removeCronSafe(id);

    const updated = await this.db.exceptionCheckScript.update({
      where: { ExceptionCheckScriptSid: id },
      data: {
        ...this.buildUpdateData(dto),
        UpdatedBy: username,
        UpdatedOn: new Date(),
      },
    });

    if (this.shouldRegister(updated)) this.registerCron(updated);
    return updated;
  }

  async remove(id: number, username: string) {
    await this.findOne(id);
    this.removeCronSafe(id);
    return this.db.exceptionCheckScript.update({
      where: { ExceptionCheckScriptSid: id },
      data: { Status: 'D', UpdatedBy: username, UpdatedOn: new Date() },
    });
  }

  async toggleActive(id: number, username: string) {
    const script = await this.findOne(id);
    const next = !script.IsActive;
    const updated = await this.db.exceptionCheckScript.update({
      where: { ExceptionCheckScriptSid: id },
      data: { IsActive: next, UpdatedBy: username, UpdatedOn: new Date() },
    });
    if (next && updated.ExecutionMode === 'SCHEDULED') this.registerCron(updated);
    else this.removeCronSafe(id);
    return updated;
  }

  async getRuns(id: number, limit = 50) {
    await this.findOne(id);
    return this.db.exceptionCheckScriptRun.findMany({
      where: { ExceptionCheckScriptSid: id },
      orderBy: { ExecutedOn: 'desc' },
      take: Math.min(Math.max(limit, 1), 500),
    });
  }

  validateSqlOnly(scriptText: string): { valid: boolean; reason?: string } {
    const r = validateReadOnlySql(scriptText);
    if (r.valid) return { valid: true };
    return { valid: false, reason: r.reason };
  }

  // ─── CRON HELPERS ────────────────────────────────────────

  private registerCron(script: any): void {
    if (script.ExecutionMode !== 'SCHEDULED' || !script.IsActive || script.Status !== 'A') return;
    if (!script.Frequency || !script.ScheduleTime) {
      this.logger.warn(`Script ${script.ExceptionCheckScriptSid} is SCHEDULED but missing Frequency/ScheduleTime — skipping cron registration`);
      return;
    }

    const name = this.jobName(script.ExceptionCheckScriptSid);
    const expr = this.buildCronExpression(
      script.Frequency,
      script.ScheduleTime,
      script.DayOfWeek,
      script.DayOfMonth,
    );

    try {
      this.removeCronSafe(script.ExceptionCheckScriptSid);
      this.scheduler.addCronJob(name, expr, () => {
        this.executor.executeScheduled(script.ExceptionCheckScriptSid).catch((err) => {
          this.logger.error(`Cron callback error (${name}): ${err.message}`);
        });
      });
      this.logger.log(`Registered cron "${name}" (${expr}) for "${script.ScriptName}"`);
    } catch (err: any) {
      this.logger.error(`Failed to register cron ${name}: ${err.message}`);
    }
  }

  private removeCronSafe(scriptSid: number): void {
    try { this.scheduler.removeCronJob(this.jobName(scriptSid)); }
    catch { /* not registered — ignore */ }
  }

  private jobName(sid: number) { return `${this.CRON_PREFIX}${sid}`; }

  buildCronExpression(frequency: string, time: string, dow?: number | null, dom?: number | null): string {
    const [hr, min] = time.split(':').map(Number);
    switch (frequency) {
      case 'DAILY':   return `0 ${min} ${hr} * * *`;
      case 'WEEKLY':  return `0 ${min} ${hr} * * ${dow ?? 1}`;
      case 'MONTHLY': return `0 ${min} ${hr} ${dom ?? 1} * *`;
      default:        return `0 ${min} ${hr} * * *`;
    }
  }

  private shouldRegister(script: any): boolean {
    return script.Status === 'A' && script.IsActive && script.ExecutionMode === 'SCHEDULED';
  }

  // ─── VALIDATION HELPERS ─────────────────────────────────

  private assertValidSql(scriptText: string): void {
    const r = validateReadOnlySql(scriptText);
    if (!r.valid) throw new BadRequestException(r.reason);
  }

  private async assertNameUnique(name: string, excludeId?: number): Promise<void> {
    const dup = await this.db.exceptionCheckScript.findFirst({
      where: {
        ScriptName: { equals: name, mode: 'insensitive' },
        Status: 'A',
        ...(excludeId ? { NOT: { ExceptionCheckScriptSid: excludeId } } : {}),
      },
    });
    if (dup) throw new BadRequestException('Script name already exists');
  }

  private buildUpdateData(dto: UpdateExceptionCheckScriptDto): Record<string, any> {
    const data: Record<string, any> = {};
    const fields: (keyof UpdateExceptionCheckScriptDto)[] = [
      'ScriptName', 'ScriptDescription', 'ScriptText', 'ExecutionMode',
      'Frequency', 'DayOfWeek', 'DayOfMonth', 'ScheduleTime', 'TimeZone',
      'ToEmails', 'CcEmails', 'IsActive',
    ];
    for (const f of fields) {
      if (dto[f] !== undefined) data[f] = dto[f];
    }
    // Trim ScriptName if present
    if (typeof data.ScriptName === 'string') data.ScriptName = (data.ScriptName as string).trim();
    // If switching to MANUAL, null-out scheduler fields
    if (dto.ExecutionMode === 'MANUAL') {
      data.Frequency = null;
      data.DayOfWeek = null;
      data.DayOfMonth = null;
      data.ScheduleTime = null;
      data.ToEmails = null;
      data.CcEmails = null;
    }
    return data;
  }
}
