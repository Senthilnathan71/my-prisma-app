import { Injectable, Logger } from '@nestjs/common';
import { DatabaseService } from 'src/database/database.service';
import { AccountsReportsService } from 'src/accounts/services/accounts-reports/accounts-reports.service';
import { ReportExportService, ExcelExportConfig, PDFExportConfig } from 'src/common/services/report-export.service';
import { EmailService } from 'src/email/email.service';

@Injectable()
export class ReportScheduleExecutorService {
  constructor(
    private readonly db: DatabaseService,
    private readonly accountsReportsService: AccountsReportsService,
    private readonly reportExportService: ReportExportService,
    private readonly emailService: EmailService,
    private readonly logger: Logger,
  ) {}

  /**
   * Execute a scheduled report: generate → export → email → update run status
   */
  async execute(reportScheduleSid: number): Promise<void> {
    const schedule = await this.db.reportSchedule.findUnique({
      where: { ReportScheduleSid: reportScheduleSid },
      include: {
        ReportMaster: true,
        CompanyMaster: true,
        SubledgerMaster: true,
      },
    });

    if (!schedule || schedule.Status !== 'A' || !schedule.IsActive) {
      this.logger.warn(`Schedule ${reportScheduleSid} not found or inactive, skipping`);
      return;
    }

    const reportName = schedule.ReportMaster.ReportName;
    const reportDisplayName = schedule.ReportMaster.ReportDisplayName;

    try {
      this.logger.log(
        `Executing schedule "${schedule.ScheduleName}" (ID: ${reportScheduleSid}) — Report: ${reportName}`,
      );

      // 1. Build report parameters
      const params = this.buildReportParams(schedule);

      // 2. Generate the report data
      const reportData = await this.accountsReportsService.generateReport(reportName, params);

      // 3. Extract tabular data and columns for export
      const { data, columns } = this.extractExportData(reportName, reportData);

      // 4. Get company info for the report header
      const companyInfo = {
        name: schedule.CompanyMaster.companyName,
        address: schedule.CompanyMaster.addressLine1 || '',
        email: schedule.CompanyMaster.email || '',
      };

      // 5. Export to buffer (Excel or PDF)
      const format = schedule.ReportFormat as 'EXCEL' | 'PDF';
      let reportBuffer: Buffer;

      if (format === 'PDF') {
        const pdfConfig: PDFExportConfig = {
          reportName: reportDisplayName,
          data,
          columns: columns.map((c) => ({ header: c.header, key: c.key, width: c.width })),
          title: reportDisplayName,
          subtitle: `Generated on ${new Date().toLocaleDateString()}`,
          companyInfo,
          orientation: 'landscape',
        };
        reportBuffer = await this.reportExportService.exportToPDF(pdfConfig);
      } else {
        const excelConfig: ExcelExportConfig = {
          reportName: reportDisplayName,
          data,
          columns,
          title: reportDisplayName,
          subtitle: `Generated on ${new Date().toLocaleDateString()}`,
          companyInfo,
        };
        reportBuffer = await this.reportExportService.exportToExcel(excelConfig);
      }

      // 6. Build filename
      const dateStr = new Date().toISOString().slice(0, 10);
      const ext = format === 'PDF' ? 'pdf' : 'xlsx';
      const filename = `${reportDisplayName.replace(/\s+/g, '_')}_${dateStr}.${ext}`;

      // 7. Send email
      await this.emailService.sendReportEmail({
        companyId: schedule.CompanyMasterSid,
        to: schedule.ToEmails,
        cc: schedule.CcEmails || undefined,
        subject: `Scheduled Report: ${reportDisplayName} — ${dateStr}`,
        reportName,
        reportDisplayName,
        message: `This is an automated scheduled report "${schedule.ScheduleName}".`,
        reportBuffer,
        filename,
        format,
      });

      // 8. Update last run status
      await this.db.reportSchedule.update({
        where: { ReportScheduleSid: reportScheduleSid },
        data: {
          LastRunAt: new Date(),
          LastRunStatus: 'SUCCESS',
          LastRunMessage: `Report sent to ${schedule.ToEmails}`,
        },
      });

      this.logger.log(`Schedule "${schedule.ScheduleName}" executed successfully`);
    } catch (error) {
      this.logger.error(
        `Schedule "${schedule.ScheduleName}" execution failed: ${error.message}`,
        error.stack,
      );

      await this.db.reportSchedule.update({
        where: { ReportScheduleSid: reportScheduleSid },
        data: {
          LastRunAt: new Date(),
          LastRunStatus: 'FAILED',
          LastRunMessage: (error.message || 'Unknown error').substring(0, 500),
        },
      });
    }
  }

  /**
   * Build report parameters from the schedule record.
   * Merges the saved ReportParams JSON with standard fields.
   */
  private buildReportParams(schedule: any): Record<string, any> {
    const params: Record<string, any> = {
      companyId: schedule.CompanyMasterSid,
      ...(schedule.ReportParams as Record<string, any> || {}),
    };

    // Subledger → map to the 'Subledger' parameter many reports expect
    if (schedule.SubledgerMasterSid) {
      params.Subledger = schedule.SubledgerMasterSid;
    }

    // COA (Ledger) → map to 'Ledger'
    if (schedule.COAMasterSid) {
      params.Ledger = schedule.COAMasterSid;
    }

    // Branch filter → map to 'Branch' (array of BranchMasterSid)
    if (schedule.BranchFilter && Array.isArray(schedule.BranchFilter)) {
      params.Branch = schedule.BranchFilter;
    }

    // Default ToDate to now if not already set
    if (!params.ToDate) {
      params.ToDate = new Date().toISOString();
    }

    return params;
  }

  /**
   * Extract tabular rows and column definitions from the report result.
   * Each report type returns slightly different shapes — normalize here.
   */
  private extractExportData(
    reportName: string,
    reportData: any,
  ): { data: any[]; columns: { header: string; key: string; width?: number }[] } {
    // Most reports return { transactions: [...] } or { data: [...] } or are arrays themselves
    let data: any[] = [];

    if (Array.isArray(reportData)) {
      data = reportData;
    } else if (reportData?.transactions && Array.isArray(reportData.transactions)) {
      data = reportData.transactions;
    } else if (reportData?.data && Array.isArray(reportData.data)) {
      data = reportData.data;
    } else if (reportData?.rows && Array.isArray(reportData.rows)) {
      data = reportData.rows;
    } else if (reportData?.items && Array.isArray(reportData.items)) {
      data = reportData.items;
    }

    // If no data found, try to use the reportData itself if it has entries
    if (data.length === 0 && typeof reportData === 'object' && reportData !== null) {
      // Check for nested group structures (e.g., ageing report returns groups)
      if (reportData.groups && Array.isArray(reportData.groups)) {
        data = reportData.groups;
      }
    }

    // Auto-generate columns from the first row's keys
    const columns = this.autoGenerateColumns(data);

    return { data, columns };
  }

  /**
   * Automatically generate export columns from the first data row.
   * Skips internal/complex fields and formats header labels.
   */
  private autoGenerateColumns(
    data: any[],
  ): { header: string; key: string; width: number }[] {
    if (!data || data.length === 0) {
      return [{ header: 'No Data', key: 'noData', width: 30 }];
    }

    const firstRow = data[0];
    const columns: { header: string; key: string; width: number }[] = [];

    for (const key of Object.keys(firstRow)) {
      const value = firstRow[key];

      // Skip complex objects, arrays, and internal fields
      if (value !== null && typeof value === 'object' && !Array.isArray(value)) continue;
      if (Array.isArray(value)) continue;
      if (key.startsWith('_')) continue;

      // Convert camelCase/PascalCase to readable header
      const header = key
        .replace(/([A-Z])/g, ' $1')
        .replace(/^./, (s) => s.toUpperCase())
        .trim();

      columns.push({ header, key, width: Math.max(15, header.length + 5) });
    }

    return columns;
  }
}
