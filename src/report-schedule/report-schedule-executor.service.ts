import { Injectable, Logger } from '@nestjs/common';
import { DatabaseService } from 'src/database/database.service';
import { AccountsReportsService } from 'src/accounts/services/accounts-reports/accounts-reports.service';
import {
  ReportExportService,
  StyledReportConfig,
  StyledReportRow,
  ReportHeaderConfig,
} from 'src/common/services/report-export.service';
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

      // 3. Build styled report config (report-specific data + header metadata)
      const styledConfig = this.getStyledReportConfig(reportName, reportData, params, schedule);

      // 4. Export to buffer (Excel or PDF)
      const format = schedule.ReportFormat as 'EXCEL' | 'PDF';
      let reportBuffer: Buffer;

      if (format === 'PDF') {
        reportBuffer = await this.reportExportService.exportStyledPDF(styledConfig);
      } else {
        reportBuffer = await this.reportExportService.exportStyledExcel(styledConfig);
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
        reportDetails : {
          companyName : schedule.CompanyMaster?.companyName,
        }
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

    // Compute date range based on schedule frequency
    const { from, to } = this.computeDateRange(schedule.Frequency);
    const fromISO = from.toISOString();
    const toISO = to.toISOString();

    // Set all known date parameter variants (preserve user-overridden values)
    // camelCase — used in seed data ParameterName
    params.fromDate = params.fromDate || fromISO;
    params.toDate = params.toDate || toISO;
    // PascalCase — used in some report DTOs (Ageing, Outstanding, etc.)
    params.FromDate = params.FromDate || fromISO;
    params.ToDate = params.ToDate || toISO;
    // Voucher date variants — used by VAT reports
    params.VoucherFromDate = params.VoucherFromDate || fromISO;
    params.VoucherToDate = params.VoucherToDate || toISO;
    // asOfDate — used by balance-sheet report
    params.asOfDate = params.asOfDate || toISO;

    return params;
  }

  /**
   * Compute the date range (from/to) based on the schedule frequency.
   * DAILY:   today 00:00 → today 23:59:59
   * WEEKLY:  start of week (Sunday) → end of week (Saturday)
   * MONTHLY: 1st of month → last day of month
   */
  private computeDateRange(frequency: string): { from: Date; to: Date } {
    const now = new Date();
    let from: Date;
    let to: Date;

    switch (frequency) {
      case 'DAILY':
        from = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
        to = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
        break;
      case 'WEEKLY': {
        const dayOfWeek = now.getDay(); // 0=Sun
        from = new Date(now.getFullYear(), now.getMonth(), now.getDate() - dayOfWeek, 0, 0, 0);
        to = new Date(from.getFullYear(), from.getMonth(), from.getDate() + 6, 23, 59, 59, 999);
        break;
      }
      case 'MONTHLY':
        from = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0);
        to = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
        break;
      default:
        from = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
        to = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    }

    return { from, to };
  }

  /**
   * Build a StyledReportConfig with header metadata, styled rows, and summary table.
   * Replaces the old getReportExportConfig that returned flat data[].
   */
  private getStyledReportConfig(
    reportName: string,
    reportData: any,
    params: Record<string, any>,
    schedule: any,
  ): StyledReportConfig {
    // Build report header with company/branch/parameter metadata
    const reportHeader: ReportHeaderConfig = {
      companyName: schedule.CompanyMaster?.companyName || '',
      branchName: reportData?.brancesInvoled || reportData?.branchNames || '',
      address: schedule.CompanyMaster?.addressLine1 || '',
      phone: schedule.CompanyMaster?.phone || '',
      reportTitle: schedule.ReportMaster?.ReportDisplayName || reportName,
      additionalInfo: this.buildAdditionalInfo(reportName, reportData, params),
    };

    switch (reportName) {
      case 'outstanding-report':
      case 'outstanding-local':
        return this.configOutstandingReport(reportData, reportHeader);
      case 'ageing-report':
        return this.configAgeingReport(reportData, reportHeader);
      case 'statement-ledger-report':
        return this.configStatementReport(reportData, reportHeader);
      case 'ledger-report':
        return this.configLedgerReport(reportData, reportHeader);
      case 'profit-loss':
        return this.configProfitLossReport(reportData, reportHeader);
      case 'balance-sheet':
        return this.configBalanceSheetReport(reportData, reportHeader);
      case 'vat-receivable-report':
        return this.configVATReport(reportData, 'outputTax', reportHeader);
      case 'vat-payable-report':
        return this.configVATReport(reportData, 'inputTax', reportHeader);
      case 'vat-report':
        return this.configVat201Report(reportData, reportHeader);
      case 'profit-summary-report':
        return this.configProfitSummaryReport(reportData, reportHeader);
      case 'matching-list-report':
        return this.configMatchingListReport(reportData, reportHeader);
      case 'top-n-customer':
        return this.configTopNCustomerReport(reportData, reportHeader);
      case 'unposted-voucher-list':
        return this.configUnpostedVoucherListReport(reportData, reportHeader);
      default:
        return this.configFallback(reportData, reportHeader);
    }
  }

  /**
   * Build additionalInfo labels from report metadata (dates, branch, subledger, ledger).
   */
  private buildAdditionalInfo(
    reportName: string,
    reportData: any,
    params: Record<string, any>,
  ): { label: string; value: string }[] {
    const info: { label: string; value: string }[] = [];

    // Date parameters
    if (params.ToDate || params.toDate) {
      info.push({ label: 'To Date', value: this.fmtDate(params.ToDate || params.toDate) });
    }
    if (params.FromDate || params.fromDate) {
      info.push({ label: 'From Date', value: this.fmtDate(params.FromDate || params.fromDate) });
    }

    // Branch
    const branchNames = reportData?.brancesInvoled || reportData?.branchNames || '';
    if (branchNames) {
      info.push({ label: 'Branch', value: branchNames });
    }

    // Subledger
    const subledgerName = reportData?.subledgerName || '';
    if (subledgerName) {
      info.push({ label: 'Subledger', value: subledgerName });
    }

    // Ledger
    const ledgerName = reportData?.ledgerName || '';
    if (ledgerName) {
      info.push({ label: 'Ledger', value: ledgerName });
    }

    return info;
  }

  /**
   * Helper: convert flat data row (key-value object) to StyledReportRow cells
   * in the order defined by tableHeaders.
   */
  private toStyledRow(
    dataRow: Record<string, any>,
    headers: { key: string; label: string }[],
    style: StyledReportRow['style'] = 'data',
  ): StyledReportRow {
    return {
      cells: headers.map((h) => ({ value: dataRow[h.key] ?? '' })),
      style,
    };
  }

  // ─── Outstanding Report ─────────────────────────────────────
  private configOutstandingReport(reportData: any, reportHeader: ReportHeaderConfig): StyledReportConfig {
    const tableHeaders = [
      { key: 'voucherNo', label: 'Voucher No' },
      { key: 'voucherDate', label: 'Voucher Date' },
      { key: 'voucherType', label: 'Type' },
      { key: 'desc', label: 'Narration' },
      { key: 'drCr', label: 'Dr/Cr' },
      { key: 'currency', label: 'Cur' },
      { key: 'amt', label: 'Amt' },
      { key: 'localAmt', label: 'Local Amt' },
      { key: 'osCurrAmt', label: 'O/S Currency Amt' },
      { key: 'osLocalAmt', label: 'O/S Local Amt' },
      { key: 'cumulative', label: 'Cumulative' },
      { key: 'ageingDays', label: 'Ageing' },
    ];
    const columnWidths = [15, 8, 3, 25, 3, 3, 10, 10, 10, 10, 10, 4];

    const transactions = reportData?.transactions || [];
    const rows: StyledReportRow[] = [];

    for (const item of transactions) {
      rows.push({
        cells: [
          { value: item.voucherNumber || '' },
          { value: this.fmtDate(item.voucherDate) },
          { value: item.voucherType || '' },
          { value: item.naration || '' },
          { value: item.drCr || '' },
          { value: item.currencyCode || '' },
          { value: this.fmtNum(item.signedOriginalCurrency) },
          { value: this.fmtNum(item.signedOriginalLocal) },
          { value: this.fmtNum(item.signedOutstandingCurrency) },
          { value: this.fmtNum(item.signedOutstandingLocal) },
          { value: this.fmtNum(item.cumulativeOutstanding) },
          { value: item.ageingDays ?? '' },
        ],
        style: 'data',
      });
    }

    // Total row
    if (transactions.length > 0) {
      const totalLocal = transactions.reduce((sum: number, t: any) => sum + (Number(t.signedOriginalLocal) || 0), 0);
      const totalOsLocal = transactions.reduce((sum: number, t: any) => sum + (Number(t.signedOutstandingLocal) || 0), 0);
      const lastCumulative = transactions[transactions.length - 1]?.cumulativeOutstanding || 0;

      rows.push({
        cells: [
          { value: 'TOTAL :', colspan: 7 },
          { value: this.fmtNum(totalLocal) },
          { value: '' },
          { value: this.fmtNum(totalOsLocal) },
          { value: this.fmtNum(lastCumulative) },
          { value: '' },
        ],
        style: 'total',
      });
    }

    // Summary table (currency-wise)
    const currencySummary = reportData?.currencyWiseSummary || [];
    let summaryTable: StyledReportConfig['summaryTable'] = undefined;
    if (currencySummary.length > 0) {
      summaryTable = {
        title: 'Currency-wise Summary',
        headers: ['Currency', 'Total Outstanding', '0-30 Days', '31-60 Days', '61-90 Days', '91-120 Days', '121+ Days'],
        rows: currencySummary.map((cur: any) => ({
          cells: [
            { value: cur.currencyCode || '' },
            { value: this.fmtNum(cur.totalOutstanding || 0) },
            { value: this.fmtNum(cur.bucket_0_30 || 0) },
            { value: this.fmtNum(cur.bucket_31_60 || 0) },
            { value: this.fmtNum(cur.bucket_61_90 || 0) },
            { value: this.fmtNum(cur.bucket_91_120 || 0) },
            { value: this.fmtNum(cur.bucket_121_above || 0) },
          ],
          style: 'data' as const,
        })),
        columnWidths: [12, 18, 14, 14, 14, 14, 14],
      };
    }

    return { reportName: 'Outstanding Report', reportHeader, tableHeaders, rows, columnWidths, summaryTable };
  }

  // ─── Ageing Report ──────────────────────────────────────────
  private configAgeingReport(reportData: any, reportHeader: ReportHeaderConfig): StyledReportConfig {
    const bucketLabels: string[] = reportData?.bucketLabels || [];

    const tableHeaders = [
      { key: 'subledger', label: 'Subledger' },
      { key: 'osLocal', label: 'OS in Local' },
      { key: 'osCurr', label: 'OS in Curr' },
      ...bucketLabels.map((label) => ({ key: label, label })),
      { key: 'onAccLocal', label: 'On Acc Local' },
      { key: 'onAccCurr', label: 'On Acc Curr' },
    ];
    const columnWidths = [25, 15, 15, ...bucketLabels.map(() => 15), 15, 15];

    const rows: StyledReportRow[] = [];
    const ageingResult = reportData?.ageingResult || [];

    for (const group of ageingResult) {
      if (group.CurrencyCode) {
        const sectionCells: any[] = [{ value: `Currency: ${group.CurrencyCode}`, colspan: tableHeaders.length }];
        rows.push({ cells: sectionCells, style: 'section' });
      }

      for (const sub of group.subledgers || []) {
        const rowData: Record<string, any> = {
          subledger: sub.SubledgerName || sub.subledgerName || '',
          osLocal: this.fmtNum(sub.totalOutstandingLocal),
          osCurr: this.fmtNum(sub.totalOutstandingCurrency),
          onAccLocal: this.fmtNum(sub.totalOnAccountCreditLocal),
          onAccCurr: this.fmtNum(sub.totalOnAccountCreditCurr),
        };
        for (const label of bucketLabels) {
          rowData[label] = this.fmtNum(sub.buckets?.[label]);
        }
        rows.push(this.toStyledRow(rowData, tableHeaders, 'data'));
      }

      // Currency subtotal
      const totalData: Record<string, any> = {
        subledger: `Total (${group.CurrencyCode || 'Local'})`,
        osLocal: this.fmtNum(group.totalOutstandingLocal),
        osCurr: this.fmtNum(group.totalOutstandingCurrency),
        onAccLocal: this.fmtNum(group.totalOnAccountCreditLocal),
        onAccCurr: this.fmtNum(group.totalOnAccountCreditCurr),
      };
      for (const label of bucketLabels) {
        totalData[label] = this.fmtNum(group.bucketTotals?.[label]);
      }
      rows.push(this.toStyledRow(totalData, tableHeaders, 'total'));
    }

    // Grand total
    if (reportData?.grandTotalLocal !== undefined) {
      const grandData: Record<string, any> = {
        subledger: 'Grand Total',
        osLocal: this.fmtNum(reportData.grandTotalLocal),
        osCurr: this.fmtNum(reportData.grandTotalCurrency),
        onAccLocal: this.fmtNum(reportData.grandTotalOnAccountCreditLocal),
        onAccCurr: this.fmtNum(reportData.grandTotalOnAccountCreditCurr),
      };
      for (const label of bucketLabels) {
        grandData[label] = this.fmtNum(reportData.overallBucketTotals?.[label]);
      }
      rows.push(this.toStyledRow(grandData, tableHeaders, 'grandTotal'));
    }

    return { reportName: 'Ageing Report', reportHeader, tableHeaders, rows, columnWidths };
  }

  // ─── Statement Report ──────────────────────────────────────
  private configStatementReport(reportData: any, reportHeader: ReportHeaderConfig): StyledReportConfig {
    const tableHeaders = [
      { key: 'voucherNo', label: 'Voucher No' },
      { key: 'voucherDate', label: 'Voucher Date' },
      { key: 'voucherType', label: 'Type' },
      { key: 'desc', label: 'Narration' },
      { key: 'drCr', label: 'Dr/Cr' },
      { key: 'currency', label: 'Cur' },
      { key: 'amt', label: 'Amt' },
      { key: 'localAmt', label: 'Local Amt' },
      { key: 'osCurrAmt', label: 'O/S Currency Amt' },
      { key: 'osLocalAmt', label: 'O/S Local Amt' },
      { key: 'cumulative', label: 'Cumulative' },
    ];
    const columnWidths = [15, 10, 6, 25, 5, 5, 12, 12, 12, 12, 12];

    const transactions = reportData?.transactions || [];
    const rows: StyledReportRow[] = [];

    if (reportData?.openingBalance && reportData.openingBalance !== 0) {
      rows.push(this.toStyledRow({
        voucherNo: '', voucherDate: '', voucherType: '', desc: 'Opening Balance',
        drCr: '', currency: '', amt: '',
        localAmt: this.fmtNum(reportData.openingBalance),
        osCurrAmt: '', osLocalAmt: '',
        cumulative: this.fmtNum(reportData.openingBalance),
      }, tableHeaders, 'section'));
    }

    for (const item of transactions) {
      rows.push(this.toStyledRow({
        voucherNo: item.voucherNumber || '',
        voucherDate: this.fmtDate(item.voucherDate),
        voucherType: item.voucherType || '',
        desc: item.naration || '',
        drCr: (item.drCr || '').toUpperCase(),
        currency: item.currencyCode || '',
        amt: this.fmtNum(item.signedOriginalCurrency),
        localAmt: this.fmtNum(item.signedLocalAmt),
        osCurrAmt: this.fmtNum(item.signedOutstandingCurrency),
        osLocalAmt: this.fmtNum(item.signedoutstandingLocalAmount),
        cumulative: this.fmtNum(item.cumulativeOutstanding),
      }, tableHeaders, 'data'));
    }

    return { reportName: 'Statement Ledger Report', reportHeader, tableHeaders, rows, columnWidths };
  }

  // ─── Ledger Report ─────────────────────────────────────────
  private configLedgerReport(reportData: any, reportHeader: ReportHeaderConfig): StyledReportConfig {
    const tableHeaders = [
      { key: 'voucherNo', label: 'Voucher No' },
      { key: 'voucherDate', label: 'Voucher Date' },
      { key: 'voucherType', label: 'Type' },
      { key: 'desc', label: 'Narration' },
      { key: 'drCr', label: 'Dr/Cr' },
      { key: 'currency', label: 'Cur' },
      { key: 'amt', label: 'Amt' },
      { key: 'localAmt', label: 'Local Amt' },
      { key: 'cumulative', label: 'Cumulative' },
    ];
    const columnWidths = [15, 10, 6, 30, 5, 5, 12, 12, 12];

    const transactions = reportData?.transactions || [];
    const rows: StyledReportRow[] = [];

    if (reportData?.openingBalance && reportData.openingBalance !== 0) {
      rows.push(this.toStyledRow({
        voucherNo: '', voucherDate: '', voucherType: '', desc: 'Opening Balance',
        drCr: '', currency: '', amt: '',
        localAmt: this.fmtNum(reportData.openingBalance),
        cumulative: this.fmtNum(reportData.openingBalance),
      }, tableHeaders, 'section'));
    }

    for (const item of transactions) {
      rows.push(this.toStyledRow({
        voucherNo: item.voucherNumber || '',
        voucherDate: this.fmtDate(item.voucherDate),
        voucherType: item.voucherType || '',
        desc: item.naration || '',
        drCr: (item.drCr || '').toUpperCase(),
        currency: item.currencyCode || '',
        amt: this.fmtNum(item.signedOriginalCurrency),
        localAmt: this.fmtNum(item.signedLocalAmt),
        cumulative: this.fmtNum(item.cumulativeOutstanding),
      }, tableHeaders, 'data'));
    }

    return { reportName: 'Ledger Report', reportHeader, tableHeaders, rows, columnWidths };
  }

  // ─── Profit & Loss Report ──────────────────────────────────
  private configProfitLossReport(reportData: any, reportHeader: ReportHeaderConfig): StyledReportConfig {
    const profitLoss: any[] = reportData?.profitLoss || [];
    const yearKeys: string[] = [];
    if (profitLoss.length > 0 && profitLoss[0].amounts) {
      for (const key of Object.keys(profitLoss[0].amounts)) {
        yearKeys.push(key);
      }
    }

    const tableHeaders = [
      { key: 'subgroup', label: 'SubGroup' },
      { key: 'ledger', label: 'Ledger' },
      ...yearKeys.map((y) => ({ key: String(y), label: String(y) })),
    ];
    const columnWidths = [20, 25, ...yearKeys.map(() => 18)];

    const rows: StyledReportRow[] = [];
    let currentSubGroup = '';

    for (const item of profitLoss) {
      const rowData: Record<string, any> = {
        subgroup: item.SubGroupName !== currentSubGroup ? item.SubGroupName : '',
        ledger: item.LedgerName || '',
      };
      currentSubGroup = item.SubGroupName;
      for (const y of yearKeys) {
        rowData[y] = this.fmtNum(item.amounts?.[y]);
      }
      rows.push(this.toStyledRow(rowData, tableHeaders, 'data'));
    }

    return { reportName: 'Profit & Loss', reportHeader, tableHeaders, rows, columnWidths };
  }

  // ─── Balance Sheet Report ──────────────────────────────────
  private configBalanceSheetReport(reportData: any, reportHeader: ReportHeaderConfig): StyledReportConfig {
    const tableHeaders = [
      { key: 'category', label: 'Category' },
      { key: 'groupName', label: 'Group' },
      { key: 'subgroupName', label: 'Sub Group' },
      { key: 'ledgerName', label: 'Ledger' },
      { key: 'amount', label: 'Amount' },
    ];
    const columnWidths = [18, 20, 20, 25, 18];

    const items: any[] = reportData?.data || [];
    const rows: StyledReportRow[] = items.map((item: any) =>
      this.toStyledRow({
        category: item.category || '',
        groupName: item.groupName || '',
        subgroupName: item.subgroupName || '',
        ledgerName: item.ledgerName || '',
        amount: this.fmtNum(item.LocalAmt),
      }, tableHeaders, 'data'),
    );

    return { reportName: 'Balance Sheet', reportHeader, tableHeaders, rows, columnWidths };
  }

  // ─── VAT Receivable/Payable Report ─────────────────────────
  private configVATReport(reportData: any, taxType: 'outputTax' | 'inputTax', reportHeader: ReportHeaderConfig): StyledReportConfig {
    const tableHeaders = [
      { key: 'date', label: 'Date' },
      { key: 'particulars', label: 'Particulars' },
      { key: 'trn', label: 'TRN' },
      { key: 'voucherType', label: 'Voucher Type' },
      { key: 'voucherNo', label: 'Voucher No.' },
      { key: 'supplierRef', label: 'Supplier Inv / Ref No / Date' },
      { key: 'taxableAmt', label: 'Taxable Amt' },
      { key: 'taxAmt', label: 'Tax Amt' },
    ];
    const columnWidths = [12, 20, 15, 12, 15, 22, 12, 12];

    const taxData: any[] = reportData?.data?.[taxType] || [];
    const rows: StyledReportRow[] = taxData.map((item: any) => {
      let supplierRef = '';
      if (item.documentNo && item.documentDate) {
        supplierRef = `${item.documentNo} - ${this.fmtDate(item.documentDate)}`;
      } else if (item.documentNo) {
        supplierRef = item.documentNo;
      }

      return this.toStyledRow({
        date: this.fmtDate(item.voucherDate),
        particulars: item.subledgerName || '',
        trn: item.panType || '',
        voucherType: item.vocuherType || '',
        voucherNo: item.voucherNo || '',
        supplierRef,
        taxableAmt: this.fmtNum(item.taxableAmt),
        taxAmt: this.fmtNum(item.taxAmt),
      }, tableHeaders, 'data');
    });

    return { reportName: taxType === 'outputTax' ? 'VAT Receivable Report' : 'VAT Payable Report', reportHeader, tableHeaders, rows, columnWidths };
  }

  // ─── VAT 201 Report ────────────────────────────────────────
  private configVat201Report(reportData: any, reportHeader: ReportHeaderConfig): StyledReportConfig {
    const tableHeaders = [
      { key: 'section', label: 'Section' },
      { key: 'ledger', label: 'Ledger' },
      { key: 'taxableAmt', label: 'Taxable Amount' },
      { key: 'taxAmt', label: 'Tax Amount' },
      { key: 'voucherCount', label: 'Voucher Count' },
    ];
    const columnWidths = [15, 25, 18, 18, 15];

    const rows: StyledReportRow[] = [];
    const sections = [
      { key: 'outputTax', label: 'Output Tax' },
      { key: 'inputTax', label: 'Input Tax' },
    ];

    for (const section of sections) {
      const sectionData = reportData?.[section.key];
      if (!sectionData) continue;

      for (const locality of ['local', 'overseas']) {
        const items = sectionData[locality] || [];
        for (const item of items) {
          rows.push(this.toStyledRow({
            section: `${section.label} (${locality})`,
            ledger: item.LedgerName || item.ledgerName || '',
            taxableAmt: this.fmtNum(item.TaxableAmount || item.taxableAmount),
            taxAmt: this.fmtNum(item.TaxAmount || item.taxAmount),
            voucherCount: item.VoucherCount || item.voucherCount || '',
          }, tableHeaders, 'data'));
        }
      }
    }

    return { reportName: 'VAT 201 Report', reportHeader, tableHeaders, rows, columnWidths };
  }

  // ─── Profit Summary Report ─────────────────────────────────
  private configProfitSummaryReport(reportData: any, reportHeader: ReportHeaderConfig): StyledReportConfig {
    const tableHeaders = [
      { key: 'JobNo', label: 'Job No' },
      { key: 'Dept', label: 'Dept' },
      { key: 'MBLNo', label: 'MBL No' },
      { key: 'HouseNo', label: 'House No' },
      { key: 'HBLNo', label: 'HBL No' },
      { key: 'HouseStatus', label: 'House Status' },
      { key: 'JobType', label: 'Job Type' },
      { key: 'Customer', label: 'Customer' },
      { key: 'OriginAgent', label: 'Origin Agent' },
      { key: 'DestinationAgent', label: 'Destination Agent' },
      { key: 'OriginPort', label: 'Origin Port' },
      { key: 'DestPort', label: 'Destination Port' },
      { key: 'LoadPort', label: 'Load Port' },
      { key: 'DischargePort', label: 'Discharge Port' },
      { key: 'ETA', label: 'ETA' },
      { key: 'ETD', label: 'ETD' },
      { key: 'ATA', label: 'ATA' },
      { key: 'ATD', label: 'ATD' },
      { key: 'ModeOfTransport', label: 'Mode of Transport' },
      { key: 'Salesperson', label: 'Salesperson' },
      { key: 'PPCC', label: 'PP/CC' },
      { key: 'PSale', label: 'P.Sale' },
      { key: 'PCost', label: 'P.Cost' },
      { key: 'PGP', label: 'P.GP' },
      { key: 'ASale', label: 'A.Sale' },
      { key: 'ACost', label: 'A.Cost' },
      { key: 'AGP', label: 'A.GP' },
    ];
    const columnWidths = [15, 12, 18, 15, 18, 14, 12, 20, 18, 18, 15, 15, 15, 15, 12, 12, 12, 12, 18, 15, 8, 12, 12, 12, 12, 12, 12];

    const masterJobs: any[] = reportData?.data || [];
    const rows: StyledReportRow[] = [];

    for (const job of masterJobs) {
      const cr = job.costRevenues?.masterCrSummary || {};
      rows.push(this.toStyledRow({
        JobNo: job.JobNo || '', Dept: job.deptName || '', MBLNo: job.MBLNo || '',
        HouseNo: '', HBLNo: '', HouseStatus: '', JobType: job.jobType || '',
        Customer: job.customerName || '', OriginAgent: job.OriginAgent || '',
        DestinationAgent: job.DestinationAgent || '', OriginPort: job.POO || '',
        DestPort: job.FPD || '', LoadPort: job.POL || '', DischargePort: job.POD || '',
        ETA: this.fmtDate(job.ETA), ETD: this.fmtDate(job.ETD),
        ATA: this.fmtDate(job.ATA), ATD: this.fmtDate(job.ATD),
        ModeOfTransport: job.ModeOfTransport || '', Salesperson: job.salesPerson || '',
        PPCC: job.PPCC || '',
        PSale: this.fmtNum(cr.pSale), PCost: this.fmtNum(cr.pCost), PGP: this.fmtNum(cr.pGp),
        ASale: this.fmtNum(cr.aSale), ACost: this.fmtNum(cr.aCost), AGP: this.fmtNum(cr.aGp),
      }, tableHeaders, 'data'));

      for (const hj of (job.houseWithCR || [])) {
        const hjCr = hj.costRevenues?.houseCrSummary || hj.costRevenues?.masterCrSummary || {};
        rows.push(this.toStyledRow({
          JobNo: '', Dept: '', MBLNo: '',
          HouseNo: hj.houseNo || '', HBLNo: hj.HBLNo || '', HouseStatus: hj.houseStatus || '',
          JobType: '', Customer: hj.customerName || '',
          OriginAgent: '', DestinationAgent: '', OriginPort: '', DestPort: '',
          LoadPort: '', DischargePort: '',
          ETA: '', ETD: '', ATA: '', ATD: '', ModeOfTransport: '',
          Salesperson: hj.salesPerson || '', PPCC: hj.PPCC || '',
          PSale: this.fmtNum(hjCr.pSale), PCost: this.fmtNum(hjCr.pCost), PGP: this.fmtNum(hjCr.pGp),
          ASale: this.fmtNum(hjCr.aSale), ACost: this.fmtNum(hjCr.aCost), AGP: this.fmtNum(hjCr.aGp),
        }, tableHeaders, 'data'));
      }
    }

    return { reportName: 'Profit Summary Report', reportHeader, tableHeaders, rows, columnWidths };
  }

  // ─── Matching List Report ──────────────────────────────────
  private configMatchingListReport(reportData: any, reportHeader: ReportHeaderConfig): StyledReportConfig {
    const tableHeaders = [
      { key: 'VoucherNumber', label: 'Voucher No' },
      { key: 'VoucherType', label: 'Voucher Type' },
      { key: 'VoucherDate', label: 'Voucher Date' },
      { key: 'VoucherMatchingNo', label: 'Voucher Matching No' },
      { key: 'VoucherMatchingDate', label: 'Voucher Matching Date' },
      { key: 'CurrencyCode', label: 'Curr' },
      { key: 'ExRate', label: 'Ex.Rate' },
      { key: 'DrCr', label: 'DrCr' },
      { key: 'Amount', label: 'Amt' },
      { key: 'LocalAmount', label: 'Local Amt' },
    ];
    const columnWidths = [18, 15, 15, 20, 20, 8, 10, 8, 15, 15];

    const rawData: any[] = reportData?.data || [];
    const rows: StyledReportRow[] = rawData.map((item: any) =>
      this.toStyledRow({
        VoucherNumber: item.VoucherNumber || '',
        VoucherType: item.VoucherType || item.VoucherName || '',
        VoucherDate: this.fmtDate(item.VoucherDate),
        VoucherMatchingNo: item.VoucherMactingNo || '',
        VoucherMatchingDate: this.fmtDate(item.VoucherMatchingDate),
        CurrencyCode: item.CurrencyCode || '',
        ExRate: this.fmtNum(item.ExRate),
        DrCr: item.DrCr || '',
        Amount: this.fmtNum(item.Amount),
        LocalAmount: this.fmtNum(item.LocalAmount),
      }, tableHeaders, 'data'),
    );

    return { reportName: 'Matching List Report', reportHeader, tableHeaders, rows, columnWidths };
  }

  // ─── Top N Customer Report ─────────────────────────────────
  private configTopNCustomerReport(reportData: any, reportHeader: ReportHeaderConfig): StyledReportConfig {
    const tableHeaders = [
      { key: 'Rank', label: 'Rank' },
      { key: 'customer', label: 'Customer' },
      { key: 'gp', label: 'GP' },
      { key: 'revenue', label: 'Revenue' },
      { key: 'volume', label: 'Volume' },
      { key: 'weight', label: 'Weight' },
      { key: 'volumeWt', label: 'Volume Wt' },
      { key: 'chargeableWt', label: 'Chargeable Wt' },
      { key: 'noOfHouse', label: 'No of House' },
    ];
    const columnWidths = [8, 25, 15, 15, 12, 12, 12, 14, 12];

    const rawData: any[] = reportData?.data || [];
    const rows: StyledReportRow[] = rawData.map((item: any, index: number) =>
      this.toStyledRow({
        Rank: index + 1,
        customer: item.customerName || '',
        gp: this.fmtNum(item.GP),
        revenue: this.fmtNum(item.totalRevenue),
        volume: this.fmtNum(item.Vol),
        weight: this.fmtNum(item.Weight),
        volumeWt: this.fmtNum(item.netwt),
        chargeableWt: this.fmtNum(item.chargeable),
        noOfHouse: item.noOfShipment ?? '',
      }, tableHeaders, 'data'),
    );

    return { reportName: 'Top N Customer Report', reportHeader, tableHeaders, rows, columnWidths };
  }

  // ─── Unposted Voucher List Report ──────────────────────────
  private configUnpostedVoucherListReport(reportData: any, reportHeader: ReportHeaderConfig): StyledReportConfig {
    const tableHeaders = [
      { key: 'Branch', label: 'Branch' },
      { key: 'VoucherNo', label: 'Voucher No' },
      { key: 'VoucherDate', label: 'Voucher Date' },
      { key: 'VoucherType', label: 'Voucher Type' },
      { key: 'Party', label: 'Party' },
      { key: 'CreatedBy', label: 'Created On' },
      { key: 'CreatedOn', label: 'Created Date' },
      { key: 'PostStatus', label: 'Post Status' },
    ];
    const columnWidths = [15, 18, 15, 15, 20, 18, 15, 12];

    const rawData: any[] = reportData?.tableData || [];
    const rows: StyledReportRow[] = rawData.map((item: any) =>
      this.toStyledRow({
        Branch: item.branch || '',
        VoucherNo: item.voucherNo || '',
        VoucherDate: this.fmtDate(item.voucherDate),
        VoucherType: item.voucherType || '',
        Party: item.party || '',
        CreatedBy: item.createdBy || '',
        CreatedOn: this.fmtDate(item.createdOn),
        PostStatus: item.postStatus || '',
      }, tableHeaders, 'data'),
    );

    return { reportName: 'Unposted Voucher List', reportHeader, tableHeaders, rows, columnWidths };
  }

  // ─── Fallback: auto-generate from data ─────────────────────
  private configFallback(reportData: any, reportHeader: ReportHeaderConfig): StyledReportConfig {
    let rawData: any[] = [];

    if (Array.isArray(reportData)) {
      rawData = reportData;
    } else if (reportData?.transactions) {
      rawData = reportData.transactions;
    } else if (reportData?.data && Array.isArray(reportData.data)) {
      rawData = reportData.data;
    } else if (reportData?.tableData) {
      rawData = reportData.tableData;
    } else if (reportData?.rows) {
      rawData = reportData.rows;
    } else if (reportData?.items) {
      rawData = reportData.items;
    }

    if (!rawData || rawData.length === 0) {
      return {
        reportName: 'Report',
        reportHeader,
        tableHeaders: [{ key: 'noData', label: 'No Data' }],
        rows: [],
        columnWidths: [30],
      };
    }

    const firstRow = rawData[0];
    const tableHeaders: { key: string; label: string }[] = [];
    const columnWidths: number[] = [];

    for (const key of Object.keys(firstRow)) {
      const value = firstRow[key];
      if (value !== null && typeof value === 'object') continue;
      if (key.startsWith('_')) continue;

      const label = key
        .replace(/([A-Z])/g, ' $1')
        .replace(/^./, (s) => s.toUpperCase())
        .trim();
      tableHeaders.push({ key, label });
      columnWidths.push(Math.max(15, label.length + 5));
    }

    const rows: StyledReportRow[] = rawData.map((item) =>
      this.toStyledRow(item, tableHeaders, 'data'),
    );

    return { reportName: 'Report', reportHeader, tableHeaders, rows, columnWidths };
  }

  // ─── Formatting helpers ────────────────────────────────────
  private fmtDate(value: any): string {
    if (!value) return '';
    try {
      return new Date(value).toLocaleDateString('en-GB');
    } catch {
      return String(value);
    }
  }

  private fmtNum(value: any): string | number {
    if (value === null || value === undefined) return '';
    const num = Number(value);
    if (isNaN(num)) return '';
    return Number(num.toFixed(2));
  }
}
