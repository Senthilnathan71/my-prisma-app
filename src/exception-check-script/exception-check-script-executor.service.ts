import { Injectable, Logger } from '@nestjs/common';
import { DatabaseService } from 'src/database/database.service';
import { EmailService } from 'src/email/email.service';
import {
  ReportExportService,
  ExcelExportConfig,
} from 'src/common/services/report-export.service';

export interface ExecutionResult {
  columns: string[];
  rows: Record<string, any>[];
  rowCount: number;
  durationMs: number;
  truncated: boolean;
}

export class ExecutionTimeoutError extends Error {
  constructor(msg: string) { super(msg); this.name = 'ExecutionTimeoutError'; }
}

export class ExecutionDbError extends Error {
  public sqlstate?: string;
  constructor(msg: string, sqlstate?: string) {
    super(msg);
    this.name = 'ExecutionDbError';
    this.sqlstate = sqlstate;
  }
}

const ROW_CAP = 10_000;

@Injectable()
export class ExceptionCheckScriptExecutorService {
  constructor(
    private readonly db: DatabaseService,
    private readonly emailService: EmailService,
    private readonly reportExportService: ReportExportService,
    private readonly logger: Logger,
  ) {}

  // ─── SHARED CORE ──────────────────────────────────────────

  /**
   * Execute the user's script inside a READ ONLY transaction,
   * with statement_timeout and a row cap. Throws typed errors on failure.
   */
  async runSqlReadOnly(scriptText: string): Promise<ExecutionResult> {
    const started = Date.now();
    const wrapped = this.wrapWithRowCap(scriptText);

    try {
      const rows = await this.db.$transaction(async (tx) => {
        await tx.$executeRawUnsafe(`SET TRANSACTION READ ONLY`);
        await tx.$executeRawUnsafe(`SET LOCAL statement_timeout = '30s'`);
        await tx.$executeRawUnsafe(`SET LOCAL lock_timeout = '2s'`);
        await tx.$executeRawUnsafe(`SET LOCAL idle_in_transaction_session_timeout = '35s'`);
        return (await tx.$queryRawUnsafe<Record<string, any>[]>(wrapped)) ?? [];
      });

      const durationMs = Date.now() - started;
      const truncated = rows.length > ROW_CAP;
      const trimmed = truncated ? rows.slice(0, ROW_CAP) : rows;
      const columns = trimmed.length > 0 ? Object.keys(trimmed[0]) : [];

      return {
        columns,
        rows: trimmed,
        rowCount: trimmed.length,
        durationMs,
        truncated,
      };
    } catch (err: any) {
      const message: string = err?.message ?? String(err);
      const sqlstate: string | undefined = err?.code ?? err?.meta?.code;

      if (/statement timeout/i.test(message) || sqlstate === '57014') {
        throw new ExecutionTimeoutError('Query exceeded 30s timeout');
      }
      throw new ExecutionDbError(message, sqlstate);
    }
  }

  private wrapWithRowCap(scriptText: string): string {
    // Strip trailing semicolon(s) + whitespace so the subquery is valid SQL.
    const cleaned = scriptText.replace(/[;\s]+$/g, '');
    return `SELECT * FROM ( ${cleaned} ) AS _ec_cap LIMIT ${ROW_CAP + 1}`;
  }

  // ─── MANUAL EXECUTION ────────────────────────────────────

  /**
   * Run a script on demand. Writes a run-log row (success or failure)
   * and updates LastRun* on the script.
   */
  async executeManual(scriptSid: number, executedBy: string): Promise<ExecutionResult> {
    const script = await this.db.exceptionCheckScript.findFirst({
      where: { ExceptionCheckScriptSid: scriptSid, Status: 'A' },
    });
    if (!script) {
      throw new ExecutionDbError(`Exception-check script #${scriptSid} not found`);
    }

    try {
      const result = await this.runSqlReadOnly(script.ScriptText);
      await this.logRun(scriptSid, {
        ExecutedBy: executedBy,
        ExecutionMode: 'MANUAL',
        Status: 'SUCCESS',
        RowCount: result.rowCount,
        DurationMs: result.durationMs,
      });
      await this.updateLastRun(scriptSid, 'SUCCESS', `Returned ${result.rowCount} row(s)`);
      return result;
    } catch (err: any) {
      const status = err instanceof ExecutionTimeoutError ? 'TIMEOUT' : 'FAILED';
      await this.logRun(scriptSid, {
        ExecutedBy: executedBy,
        ExecutionMode: 'MANUAL',
        Status: status,
        ErrorMessage: err.message?.slice(0, 2000),
      });
      await this.updateLastRun(scriptSid, status, err.message?.slice(0, 500));
      throw err;
    }
  }

  /**
   * Same as executeManual, but returns both the ExecutionResult AND an Excel buffer.
   * Logs a separate MANUAL run entry (caller gets a clean buffer to stream).
   */
  async executeManualAndExport(
    scriptSid: number,
    executedBy: string,
  ): Promise<{ result: ExecutionResult; excel: Buffer; filename: string; scriptName: string }> {
    const script = await this.db.exceptionCheckScript.findFirst({
      where: { ExceptionCheckScriptSid: scriptSid, Status: 'A' },
    });
    if (!script) {
      throw new ExecutionDbError(`Exception-check script #${scriptSid} not found`);
    }

    const result = await this.executeManual(scriptSid, executedBy);
    const excel = await this.buildExcel(script.ScriptName, result);
    const dateStr = new Date().toISOString().slice(0, 10);
    const filename = `${script.ScriptName.replace(/\s+/g, '_')}_${dateStr}.xlsx`;
    return { result, excel, filename, scriptName: script.ScriptName };
  }

  // ─── SCHEDULED EXECUTION ─────────────────────────────────

  /**
   * Called by the cron callback. NEVER throws — failures land in run-log + email.
   */
  async executeScheduled(scriptSid: number): Promise<void> {
    const script = await this.db.exceptionCheckScript.findFirst({
      where: { ExceptionCheckScriptSid: scriptSid },
    });
    if (!script || script.Status !== 'A' || !script.IsActive || script.ExecutionMode !== 'SCHEDULED') {
      this.logger.warn(`executeScheduled: skipping script ${scriptSid} (missing/inactive/non-scheduled)`);
      return;
    }

    const today = new Date().toISOString().slice(0, 10);
    const toEmails = script.ToEmails ?? '';
    const ccEmails = script.CcEmails ?? undefined;

    try {
      const result = await this.runSqlReadOnly(script.ScriptText);

      if (result.rowCount > 0) {
        const excel = await this.buildExcel(script.ScriptName, result);
        const filename = `${script.ScriptName.replace(/\s+/g, '_')}_${today}.xlsx`;
        await this.sendEmailWithAttachment({
          to: toEmails,
          cc: ccEmails,
          subject: `[Exception Check] ${script.ScriptName} — ${result.rowCount} row(s) found (${today})`,
          html: this.buildHtmlPreview(script.ScriptName, result),
          filename,
          content: excel,
        });
      } else {
        await this.sendEmail({
          to: toEmails,
          cc: ccEmails,
          subject: `[Exception Check] ${script.ScriptName} — No Exception Found (${today})`,
          html: `<p>Script <b>${escapeHtml(script.ScriptName)}</b> ran successfully.</p>
                 <p><b>No exceptions found.</b></p>
                 <p>Duration: ${result.durationMs} ms</p>`,
        });
      }

      await this.logRun(scriptSid, {
        ExecutedBy: 'SCHEDULER',
        ExecutionMode: 'SCHEDULED',
        Status: 'SUCCESS',
        RowCount: result.rowCount,
        DurationMs: result.durationMs,
        EmailSentTo: ccEmails ? `${toEmails}; cc=${ccEmails}` : toEmails,
      });
      await this.updateLastRun(
        scriptSid,
        'SUCCESS',
        result.rowCount === 0
          ? 'No exceptions found'
          : `Emailed ${result.rowCount} row(s) to ${toEmails}`,
      );
    } catch (err: any) {
      const status = err instanceof ExecutionTimeoutError ? 'TIMEOUT' : 'FAILED';
      this.logger.error(`Scheduled execution failed for script ${scriptSid}: ${err.message}`);

      // Best-effort failure notification — swallow any email failure.
      try {
        await this.sendEmail({
          to: toEmails,
          cc: ccEmails,
          subject: `[Exception Check] ${script.ScriptName} — FAILED (${today})`,
          html: `<p>Scheduled exception-check <b>${escapeHtml(script.ScriptName)}</b> failed.</p>
                 <p><b>Status:</b> ${status}</p>
                 <p><b>Error:</b> ${escapeHtml(err.message ?? '')}</p>
                 <p>Check the run history in the admin UI for details.</p>`,
        });
      } catch (emailErr: any) {
        this.logger.error(`Failed to send failure-notification email: ${emailErr.message}`);
      }

      await this.logRun(scriptSid, {
        ExecutedBy: 'SCHEDULER',
        ExecutionMode: 'SCHEDULED',
        Status: status,
        ErrorMessage: err.message?.slice(0, 2000),
        EmailSentTo: toEmails || null,
      });
      await this.updateLastRun(scriptSid, status, err.message?.slice(0, 500));
    }
  }

  // ─── HELPERS ─────────────────────────────────────────────

  private async buildExcel(scriptName: string, result: ExecutionResult): Promise<Buffer> {
    const cfg: ExcelExportConfig = {
      reportName: scriptName,
      title: scriptName,
      data: result.rows,
      columns: result.columns.map((k) => ({ header: k, key: k })),
    };
    return this.reportExportService.exportToExcel(cfg);
  }

  private buildHtmlPreview(scriptName: string, result: ExecutionResult): string {
    const previewRows = result.rows.slice(0, 20);
    const th = result.columns.map((c) => `<th style="border:1px solid #ccc;padding:4px 8px;background:#f3f3f3;text-align:left">${escapeHtml(c)}</th>`).join('');
    const trs = previewRows.map((r) => {
      const tds = result.columns.map((c) => {
        const v = r[c];
        return `<td style="border:1px solid #ccc;padding:4px 8px">${escapeHtml(v == null ? '' : String(v))}</td>`;
      }).join('');
      return `<tr>${tds}</tr>`;
    }).join('');

    const footer = result.rowCount > previewRows.length
      ? `<p style="color:#555">Showing first ${previewRows.length} of ${result.rowCount} row(s). Full results attached as Excel.</p>`
      : '';
    const truncNote = result.truncated
      ? `<p style="color:#b26a00"><b>Note:</b> The script returned more than ${ROW_CAP.toLocaleString()} rows. Only the first ${ROW_CAP.toLocaleString()} are attached. Refine the script if you need more.</p>`
      : '';

    return `
      <p>Scheduled exception-check <b>${escapeHtml(scriptName)}</b> returned <b>${result.rowCount}</b> row(s).</p>
      ${truncNote}
      <table style="border-collapse:collapse;font-family:Arial,sans-serif;font-size:13px">
        <thead><tr>${th}</tr></thead>
        <tbody>${trs}</tbody>
      </table>
      ${footer}
    `;
  }

  private async sendEmail(opts: { to: string; cc?: string; subject: string; html: string }): Promise<void> {
    await this.emailService.sendEmail({
      email: opts.to,
      cc: opts.cc,
      subject: opts.subject,
      html: opts.html,
    });
  }

  private async sendEmailWithAttachment(opts: {
    to: string; cc?: string; subject: string; html: string;
    filename: string; content: Buffer;
  }): Promise<void> {
    await this.emailService.sendEmailWithFileAttachment({
      email: opts.to,
      cc: opts.cc,
      subject: opts.subject,
      html: opts.html,
      file: {
        originalname: opts.filename,
        buffer: opts.content,
        mimetype: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      },
    });
  }

  private async logRun(
    scriptSid: number,
    data: {
      ExecutedBy: string;
      ExecutionMode: 'MANUAL' | 'SCHEDULED';
      Status: 'SUCCESS' | 'FAILED' | 'TIMEOUT' | 'VALIDATION_FAILED';
      RowCount?: number;
      DurationMs?: number;
      ErrorMessage?: string;
      EmailSentTo?: string | null;
    },
  ): Promise<void> {
    try {
      await this.db.exceptionCheckScriptRun.create({
        data: {
          ExceptionCheckScriptSid: scriptSid,
          ExecutedBy: data.ExecutedBy,
          ExecutionMode: data.ExecutionMode,
          Status: data.Status,
          RowCount: data.RowCount ?? null,
          DurationMs: data.DurationMs ?? null,
          ErrorMessage: data.ErrorMessage ?? null,
          EmailSentTo: data.EmailSentTo ?? null,
        },
      });
    } catch (err: any) {
      this.logger.error(`Failed to write run log for script ${scriptSid}: ${err.message}`);
    }
  }

  private async updateLastRun(
    scriptSid: number,
    status: string,
    message?: string,
  ): Promise<void> {
    try {
      await this.db.exceptionCheckScript.update({
        where: { ExceptionCheckScriptSid: scriptSid },
        data: {
          LastRunAt: new Date(),
          LastRunStatus: status,
          LastRunMessage: message ?? null,
        },
      });
    } catch (err: any) {
      this.logger.error(`Failed to update LastRun on script ${scriptSid}: ${err.message}`);
    }
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
