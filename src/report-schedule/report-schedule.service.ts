import { Injectable, Logger, OnModuleInit, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { DatabaseService } from 'src/database/database.service';
import { SchedulerService } from 'src/common/services/scheduler/scheduler.service';
import { ReportScheduleExecutorService } from './report-schedule-executor.service';
import { CreateReportScheduleDto } from './dto/create-report-schedule.dto';
import { UpdateReportScheduleDto } from './dto/update-report-schedule.dto';

@Injectable()
export class ReportScheduleService implements OnModuleInit {
  private readonly CRON_PREFIX = 'report-schedule-';

  constructor(
    private readonly db: DatabaseService,
    private readonly schedulerService: SchedulerService,
    private readonly executor: ReportScheduleExecutorService,
    private readonly logger: Logger,
  ) {}

  /**
   * On startup, load all active schedules and register cron jobs.
   */
  async onModuleInit(): Promise<void> {
    try {
      const activeSchedules = await this.db.reportSchedule.findMany({
        where: { Status: 'A', IsActive: true },
      });

      this.logger.log(`Registering ${activeSchedules.length} active report schedule(s)`);

      for (const schedule of activeSchedules) {
        this.registerCronJob(schedule);
      }
    } catch (error) {
      this.logger.error(`Failed to initialize report schedules: ${error.message}`);
    }
  }

  /**
   * List all schedules for a company.
   */
  async findAll(companyId: number) {
    return this.db.reportSchedule.findMany({
      where: {
        CompanyMasterSid: companyId,
        Status: 'A',
      },
      include: {
        ReportMaster: {
          select: {
            ReportMasterSid: true,
            ReportName: true,
            ReportDisplayName: true,
          },
        },
        SubledgerMaster: {
          select: {
            SubledgerMasterSid: true,
            SubledgerName: true,
          },
        },
      },
      orderBy: { CreatedOn: 'desc' },
    });
  }

  /**
   * Get one schedule by ID.
   */
  async findOne(id: number, companyId: number) {
    const schedule = await this.db.reportSchedule.findFirst({
      where: {
        ReportScheduleSid: id,
        CompanyMasterSid: companyId,
        Status: 'A',
      },
      include: {
        ReportMaster: {
          select: {
            ReportMasterSid: true,
            ReportName: true,
            ReportDisplayName: true,
          },
        },
        SubledgerMaster: {
          select: {
            SubledgerMasterSid: true,
            SubledgerName: true,
          },
        },
      },
    });

    if (!schedule) {
      throw new NotFoundException(`Report schedule #${id} not found`);
    }

    return schedule;
  }

  /**
   * Get all reports available for scheduling (from ReportMaster).
   */
  async getAvailableReports(companyId: number) {
    const allReports = await this.db.reportMaster.findMany({
      where: { Status: 'A' },
      include: {
        ReportMasterDetail: {
          where: { Status: 'A' },
          orderBy: { ReportMasterDetailSid: 'asc' },
        },
      },
      orderBy: { ReportMasterSid: 'asc' },
    });

    // Filter out reports excluded for this company
    return allReports.filter((report) => {
      if (!report.ReportExcludedCompany) return true;
      const excluded = Array.isArray(report.ReportExcludedCompany)
        ? report.ReportExcludedCompany
        : [];
      return !excluded.includes(companyId);
    });
  }

  /**
   * Create a new schedule and register its cron job.
   */
  async create(dto: CreateReportScheduleDto, username: string) {
    const schedule = await this.db.reportSchedule.create({
      data: {
        CompanyMasterSid: dto.CompanyMasterSid,
        ScheduleName: dto.ScheduleName,
        ReportMasterSid: dto.ReportMasterSid,
        SubledgerMasterSid: dto.SubledgerMasterSid || null,
        COAMasterSid: dto.COAMasterSid || null,
        BranchFilter: dto.BranchFilter || Prisma.DbNull,
        Frequency: dto.Frequency,
        DayOfWeek: dto.DayOfWeek ?? null,
        DayOfMonth: dto.DayOfMonth ?? null,
        ScheduleTime: dto.ScheduleTime,
        TimeZone: dto.TimeZone || null,
        ToEmails: dto.ToEmails,
        CcEmails: dto.CcEmails || null,
        ReportFormat: dto.ReportFormat,
        ReportParams: dto.ReportParams || Prisma.DbNull,
        IsActive: dto.IsActive ?? true,
        CreatedBy: username,
        UpdatedBy: username,
      },
      include: {
        ReportMaster: {
          select: { ReportMasterSid: true, ReportName: true, ReportDisplayName: true },
        },
      },
    });

    if (schedule.IsActive) {
      this.registerCronJob(schedule);
    }

    return schedule;
  }

  /**
   * Update an existing schedule (re-register cron if needed).
   */
  async update(id: number, dto: UpdateReportScheduleDto, username: string) {
    const existing = await this.db.reportSchedule.findFirst({
      where: { ReportScheduleSid: id, Status: 'A' },
    });

    if (!existing) {
      throw new NotFoundException(`Report schedule #${id} not found`);
    }

    // Remove old cron job
    this.removeCronJobSafe(id);

    const schedule = await this.db.reportSchedule.update({
      where: { ReportScheduleSid: id },
      data: {
        ...this.buildUpdateData(dto),
        UpdatedBy: username,
        UpdatedOn: new Date(),
      },
      include: {
        ReportMaster: {
          select: { ReportMasterSid: true, ReportName: true, ReportDisplayName: true },
        },
      },
    });

    if (schedule.IsActive && schedule.Status === 'A') {
      this.registerCronJob(schedule);
    }

    return schedule;
  }

  /**
   * Soft delete a schedule and remove its cron job.
   */
  async remove(id: number, username: string) {
    const existing = await this.db.reportSchedule.findFirst({
      where: { ReportScheduleSid: id, Status: 'A' },
    });

    if (!existing) {
      throw new NotFoundException(`Report schedule #${id} not found`);
    }

    this.removeCronJobSafe(id);

    return this.db.reportSchedule.update({
      where: { ReportScheduleSid: id },
      data: {
        Status: 'D',
        UpdatedBy: username,
        UpdatedOn: new Date(),
      },
    });
  }

  /**
   * Toggle active/inactive status.
   */
  async toggleActive(id: number, username: string) {
    const schedule = await this.db.reportSchedule.findFirst({
      where: { ReportScheduleSid: id, Status: 'A' },
    });

    if (!schedule) {
      throw new NotFoundException(`Report schedule #${id} not found`);
    }

    const newActive = !schedule.IsActive;

    if (newActive) {
      this.registerCronJob(schedule);
    } else {
      this.removeCronJobSafe(id);
    }

    return this.db.reportSchedule.update({
      where: { ReportScheduleSid: id },
      data: {
        IsActive: newActive,
        UpdatedBy: username,
        UpdatedOn: new Date(),
      },
    });
  }

  /**
   * Immediately execute a schedule (test send).
   */
  async testSend(id: number, companyId: number) {
    const schedule = await this.db.reportSchedule.findFirst({
      where: { ReportScheduleSid: id, CompanyMasterSid: companyId, Status: 'A' },
    });

    if (!schedule) {
      throw new NotFoundException(`Report schedule #${id} not found`);
    }

    await this.executor.execute(id);
    return { message: 'Test report sent successfully' };
  }

  // ─── CRON HELPERS ───────────────────────────────────────────

  private registerCronJob(schedule: any): void {
    const jobName = this.getCronJobName(schedule.ReportScheduleSid);
    const cronExpr = this.buildCronExpression(
      schedule.Frequency,
      schedule.ScheduleTime,
      schedule.DayOfWeek,
      schedule.DayOfMonth,
    );

    try {
      // Remove existing job with same name (if any)
      this.removeCronJobSafe(schedule.ReportScheduleSid);

      this.schedulerService.addCronJob(jobName, cronExpr, () => {
        this.executor.execute(schedule.ReportScheduleSid).catch((err) => {
          this.logger.error(`Cron callback error for ${jobName}: ${err.message}`);
        });
      });

      this.logger.log(
        `Registered cron job "${jobName}" with expression "${cronExpr}" for schedule "${schedule.ScheduleName || schedule.ReportScheduleSid}"`,
      );
    } catch (error) {
      this.logger.error(`Failed to register cron job ${jobName}: ${error.message}`);
    }
  }

  private removeCronJobSafe(scheduleId: number): void {
    const jobName = this.getCronJobName(scheduleId);
    try {
      this.schedulerService.removeCronJob(jobName);
    } catch {
      // Job may not exist — safe to ignore
    }
  }

  private getCronJobName(scheduleId: number): string {
    return `${this.CRON_PREFIX}${scheduleId}`;
  }

  /**
   * Convert Frequency + Time + DayOfWeek/DayOfMonth to a cron expression.
   *
   * Cron format: second minute hour dayOfMonth month dayOfWeek
   * - DAILY:   0 {min} {hr} * * *
   * - WEEKLY:  0 {min} {hr} * * {dow}
   * - MONTHLY: 0 {min} {hr} {dom} * *
   */
  buildCronExpression(
    frequency: string,
    scheduleTime: string,
    dayOfWeek?: number | null,
    dayOfMonth?: number | null,
  ): string {
    const [hr, min] = scheduleTime.split(':').map(Number);

    switch (frequency) {
      case 'DAILY':
        return `0 ${min} ${hr} * * *`;
      case 'WEEKLY':
        return `0 ${min} ${hr} * * ${dayOfWeek ?? 1}`;
      case 'MONTHLY':
        return `0 ${min} ${hr} ${dayOfMonth ?? 1} * *`;
      default:
        return `0 ${min} ${hr} * * *`;
    }
  }

  /**
   * Build a Prisma update data object from the DTO, omitting undefined fields.
   */
  private buildUpdateData(dto: UpdateReportScheduleDto): Record<string, any> {
    const data: Record<string, any> = {};
    const fields: (keyof UpdateReportScheduleDto)[] = [
      'CompanyMasterSid',
      'ScheduleName',
      'ReportMasterSid',
      'SubledgerMasterSid',
      'COAMasterSid',
      'BranchFilter',
      'Frequency',
      'DayOfWeek',
      'DayOfMonth',
      'ScheduleTime',
      'TimeZone',
      'ToEmails',
      'CcEmails',
      'ReportFormat',
      'ReportParams',
      'IsActive',
    ];

    for (const field of fields) {
      if (dto[field] !== undefined) {
        data[field] = dto[field];
      }
    }

    return data;
  }
}
