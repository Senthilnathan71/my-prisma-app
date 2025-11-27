import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { DatabaseService } from 'src/database/database.service';
import { Prisma } from '@prisma/client';
import { AgeingReportQueryDto } from 'src/accounts/dto/accounts-reports.dto';
import { toNumber } from 'src/common/helper';

@Injectable()
export class AccountsReportsService {
  constructor(
    private _db: DatabaseService,
    private logger: Logger
  ) { }

  async getAvailableReports(companyId: number) {
    try {
      // Get all accounts reports
      const accountsMenu = await this._db.menuMaster.findFirst({
        where: {
          MenuName: 'Accounts Reports',
          status: 'A'
        }
      });

      if (!accountsMenu) {
        return [];
      }

      const allReports = await this._db.reportMaster.findMany({
        where: {
          ReportMenuSid: accountsMenu.MenuMasterSid,
          Status: 'A'
        },
        include: {
          ReportMasterDetail: {
            where: { Status: 'A' },
            orderBy: { ReportMasterDetailSid: 'asc' }
          }
        },
        orderBy: { ReportMasterSid: 'asc' }
      });

      // Filter by company exclusion
      const filteredReports = allReports.filter(report => {
        if (!report.ReportExcludedCompany) return true;
        const excludedCompanies = Array.isArray(report.ReportExcludedCompany)
          ? report.ReportExcludedCompany
          : [];
        return !excludedCompanies.includes(companyId);
      });

      return filteredReports;
    } catch (error) {
      this.logger.error(`getAvailableReportsError: ${error}`);
      throw error;
    }
  }

  async getReportParameters(reportName: string) {
    try {
      const report = await this._db.reportMaster.findFirst({
        where: {
          ReportName: reportName,
          Status: 'A'
        },
        include: {
          ReportMasterDetail: {
            where: { Status: 'A' },
            orderBy: { ReportMasterDetailSid: 'asc' }
          }
        }
      });

      if (!report) {
        throw new BadRequestException(`Report ${reportName} not found`);
      }

      return report.ReportMasterDetail;
    } catch (error) {
      throw error;
    }
  }

  async generateReport(reportName: string, parameters: any) {
    try {
      // Route to specific report generator
      switch (reportName) {
        case 'ageing-report':
          return await this.getAgeingReport(parameters);
        case 'outstanding-report':
          return await this.generateOutstandingReport(parameters);
        case 'statement-ledger-report':
          return await this.generateStatementLedgerReport(parameters);
        case 'trial-balance':
          return await this.generateTrialBalance(parameters);
        case 'profit-loss':
          return await this.generateProfitLoss(parameters);
        case 'balance-sheet':
          return await this.generateBalanceSheet(parameters);
        case 'vat-receivable-report':
          return await this.generateVATReceivableReport(parameters);
        case 'vat-payable-report':
          return await this.generateVATPayableReport(parameters);
        case 'profit-summary-report':
          return await this.generateProfitSummaryReport(parameters);
        case 'matching-list-report':
          return await this.generateMatchingListReport(parameters);
        case 'top-n-customer':
          return await this.generateTopNCustomerReport(parameters);
        default:
          throw new BadRequestException(`Report ${reportName} not implemented`);
      }
    } catch (error) {
      throw error;
    }
  }

  async getAgeingReport(params: AgeingReportQueryDto) {
    const {
      companyId: CompanyMasterSid,
      Ledger: COAMasterSid,
      ToDate,
      ageingType: AgeingType,
    } = params;

    const toDateObj = new Date(ToDate);

    // -------------------------------------------------
    // 1. Fetch Voucher
    // -------------------------------------------------
    const vouchers = await this._db.voucherTransaction.findMany({
      where: {
        CompanyMasterSid,
        COAMasterSid,
        Status: 'A',
        VoucherDate: { lte: toDateObj }
      },
      include: {
        coaMaster: true,
        subledgerMaster: true,
        voucherMatchings: {
          where: { Status: 'A' },
        },
      },
      orderBy: [
        { LedgerMasterSid: 'asc' },
        { CurrencyCode: 'asc' },
        { VoucherDate: 'asc' },
        { VoucherTransactionSid: 'asc' }
      ],
    });

    // -------------------------------------------------
    // 2. Transform Prisma results to original fields
    // -------------------------------------------------
    const reportData = vouchers.map(v => {
      const matchLocal = v.voucherMatchings.reduce(
        (acc, m) => acc + (m.DrCr === 'D' ? toNumber(m.LocalAmount) : -toNumber(m.LocalAmount)),
        0,
      );
      const matchCurr = v.voucherMatchings.reduce(
        (acc, m) => acc + (m.DrCr === 'D' ? toNumber(m.Amount) : -toNumber(m.Amount)),
        0,
      );

      const ageing =
        Math.floor((+new Date() - +new Date(v.VoucherDate)) / (1000 * 60 * 60 * 24)) + 1;

      return {
        LedgerName: v.coaMaster?.LedgerName,
        SubledgerName: v.subledgerMaster?.SubledgerName,
        SubledgerMasterSid: v.LedgerMasterSid,
        VoucherTransactionSid: v.VoucherTransactionSid,
        VoucherDate: v.VoucherDate,
        CurrencyCode: v.CurrencyCode,
        Ageing: ageing,
        OriginalCurrAmount: v.Amount,
        OriginalLocalAmount: v.LocalAmount,
        MatchingCurrAmt: matchCurr,
        MatchingLocalAmt: matchLocal,
        OSCurrencyAmount: toNumber(v.Amount) - Math.abs(matchCurr),
        OSLocalAmount: toNumber(v.LocalAmount) - Math.abs(matchLocal),
      };
    });

    // -------------------------------------------------
    // 3. Ageing Bucket Logic
    // -------------------------------------------------
    let bucketRanges: number[] = [];

    if (AgeingType === '30_60_90') bucketRanges = [30, 60, 90];
    else if (AgeingType === '15_30_45_60') bucketRanges = [15, 30, 45, 60];
    else if (AgeingType.includes('-')) {
      bucketRanges = AgeingType.split('-').map(n => +n.trim());
      bucketRanges.sort((a, b) => a - b);
    } else throw new BadRequestException('Invalid ageingType');

    const bucketLabels: any[] = [];
    for (let i = 0; i < bucketRanges.length; i++) {
      if (i === 0) bucketLabels.push(`0-${bucketRanges[i]}`);
      else bucketLabels.push(`${bucketRanges[i - 1] + 1}-${bucketRanges[i]}`);
    }
    bucketLabels.push(`${bucketRanges[bucketRanges.length - 1] + 1}+`);

    // -------------------------------------------------
    // 4. Group by Subledger > CurrencyCode + Apply Buckets
    // -------------------------------------------------
    const subledgerMap = new Map();

    for (const row of reportData) {
      const subId = row.SubledgerMasterSid;
      const currCode = row.CurrencyCode;

      // Initialize Subledger if not exists
      if (!subledgerMap.has(subId)) {
        subledgerMap.set(subId, {
          SubledgerMasterSid: subId,
          SubledgerName: row.SubledgerName,
          LedgerName: row.LedgerName,
          currencies: new Map(),
          totalOutstanding: 0,
          voucherCount: 0,
        });
      }

      const sub = subledgerMap.get(subId);

      // Initialize Currency under this Subledger if not exists
      if (!sub.currencies.has(currCode)) {
        const bucketData = {};
        bucketLabels.forEach(b => (bucketData[b] = 0));

        sub.currencies.set(currCode, {
          CurrencyCode: currCode,
          totalOutstandingCurrency: 0,
          totalOutstandingLocal: 0,
          voucherCount: 0,
          buckets: bucketData,
        });
      }

      const currGroup = sub.currencies.get(currCode);

      // Add voucher to this currency group
      currGroup.totalOutstandingCurrency += row.OSCurrencyAmount;
      currGroup.totalOutstandingLocal += row.OSLocalAmount;
      currGroup.voucherCount++;

      // Update subledger totals
      sub.totalOutstanding += row.OSLocalAmount;
      sub.voucherCount++;

      // Bucket Allocation (using Local Amount)
      let placed = false;
      for (let i = 0; i < bucketRanges.length; i++) {
        if (row.Ageing <= bucketRanges[i]) {
          currGroup.buckets[bucketLabels[i]] += row.OSLocalAmount;
          placed = true;
          break;
        }
      }
      if (!placed) {
        const last = bucketLabels[bucketLabels.length - 1];
        currGroup.buckets[last] += row.OSLocalAmount;
      }
    }

    // Convert Map to Array for response
    const ageingResult = Array.from(subledgerMap.values()).map(sub => ({
      SubledgerMasterSid: sub.SubledgerMasterSid,
      SubledgerName: sub.SubledgerName,
      LedgerName: sub.LedgerName,
      totalOutstanding: sub.totalOutstanding,
      voucherCount: sub.voucherCount,
      currencies: Array.from(sub.currencies.values()),
    }));

    // -------------------------------------------------
    // 5. Grand Totals (across all subledgers and currencies)
    // -------------------------------------------------
    const grandTotal = ageingResult.reduce((a, b) => a + b.totalOutstanding, 0);
    const totalVouchers = ageingResult.reduce((a, b) => a + b.voucherCount, 0);

    const bucketTotals: Record<string, number> = {};
    bucketLabels.forEach(b => {
      bucketTotals[b] = 0;
      ageingResult.forEach(sub => {
        sub.currencies.forEach((curr: any) => {
          bucketTotals[b] += curr.buckets[b];
        });
      });
    });

    // -------------------------------------------------
    // 6. Currency-wise Grand Totals
    // -------------------------------------------------
    const currencyTotalsMap = new Map<string, any>();

    ageingResult.forEach(sub => {
      sub.currencies.forEach((curr: any) => {
        if (!currencyTotalsMap.has(curr.CurrencyCode)) {
          const bucketData: Record<string, number> = {};
          bucketLabels.forEach(b => (bucketData[b] = 0));

          currencyTotalsMap.set(curr.CurrencyCode, {
            CurrencyCode: curr.CurrencyCode,
            totalOutstandingCurrency: 0,
            totalOutstandingLocal: 0,
            voucherCount: 0,
            buckets: bucketData,
          });
        }

        const currTotal = currencyTotalsMap.get(curr.CurrencyCode);
        currTotal.totalOutstandingCurrency += curr.totalOutstandingCurrency;
        currTotal.totalOutstandingLocal += curr.totalOutstandingLocal;
        currTotal.voucherCount += curr.voucherCount;

        bucketLabels.forEach(b => {
          currTotal.buckets[b] += curr.buckets[b];
        });
      });
    });

    const currencyTotals = Array.from(currencyTotalsMap.values());

    // -------------------------------------------------
    // 7. Final Return
    // -------------------------------------------------
    return {
      bucketLabels,
      subledgerCount: ageingResult.length,
      totalVouchers,
      grandTotal,
      bucketTotals,
      currencyTotals,
      ageingResult,
    };
  }

  private async generateOutstandingReport(params: any) {
    // TODO: Implement outstanding report logic
    this.logger.log('generateOutstandingReport called with params:', params);
    throw new BadRequestException('Outstanding Report generator not yet implemented');
  }

  private async generateStatementLedgerReport(params: any) {
    // TODO: Implement statement/ledger report logic
    this.logger.log('generateStatementLedgerReport called with params:', params);
    throw new BadRequestException('Statement/Ledger Report generator not yet implemented');
  }

  private async generateTrialBalance(params: any) {
    // TODO: Use existing trial balance service
    this.logger.log('generateTrialBalance called with params:', params);
    throw new BadRequestException('Trial Balance generator not yet integrated');
  }

  private async generateProfitLoss(params: any) {
    // TODO: Implement P&L report logic
    this.logger.log('generateProfitLoss called with params:', params);
    throw new BadRequestException('Profit & Loss Report generator not yet implemented');
  }

  private async generateBalanceSheet(params: any) {
    // TODO: Implement balance sheet logic
    this.logger.log('generateBalanceSheet called with params:', params);
    throw new BadRequestException('Balance Sheet generator not yet implemented');
  }

  private async generateVATReceivableReport(params: any) {
    // TODO: Implement VAT receivable logic
    this.logger.log('generateVATReceivableReport called with params:', params);
    throw new BadRequestException('VAT Receivable Report generator not yet implemented');
  }

  private async generateVATPayableReport(params: any) {
    // TODO: Implement VAT payable logic
    this.logger.log('generateVATPayableReport called with params:', params);
    throw new BadRequestException('VAT Payable Report generator not yet implemented');
  }

  private async generateProfitSummaryReport(params: any) {
    // TODO: Implement profit summary logic
    this.logger.log('generateProfitSummaryReport called with params:', params);
    throw new BadRequestException('Profit Summary Report generator not yet implemented');
  }

  private async generateMatchingListReport(params: any) {
    // TODO: Implement matching list logic
    this.logger.log('generateMatchingListReport called with params:', params);
    throw new BadRequestException('Matching List Report generator not yet implemented');
  }

  private async generateTopNCustomerReport(params: any) {
    // TODO: Implement top N customer logic
    this.logger.log('generateTopNCustomerReport called with params:', params);
    throw new BadRequestException('TOP N Customer Report generator not yet implemented');
  }

  async exportReport(reportName: string, exportParams: any) {
    try {
      // Generate report first
      const reportData = await this.generateReport(reportName, exportParams.parameters);

      // Format and export based on format
      const format = exportParams.format || 'EXCEL';

      // TODO: Implement actual export logic using report-export service
      return {
        reportName,
        format,
        data: reportData,
        exportedAt: new Date(),
        message: `Export to ${format} will be implemented by report-export service`
      };
    } catch (error) {
      throw error;
    }
  }

  async emailReport(reportName: string, emailParams: any) {
    try {
      // Generate and export report
      const exportData = await this.exportReport(reportName, {
        parameters: emailParams.parameters,
        format: emailParams.format || 'PDF'
      });

      // TODO: Implement email service integration
      this.logger.log(`Email report to: ${emailParams.email}`);

      return {
        success: true,
        message: 'Email service integration pending'
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Execute parameter query to get dynamic dropdown options
   */
  async executeParameterQuery(
    parameterId: number,
    context: { companyId?: number; branchId?: number }
  ): Promise<Array<{ value: any; label: string }>> {
    try {
      // Fetch the parameter details
      const parameter = await this._db.reportMasterDetail.findFirst({
        where: {
          ReportMasterDetailSid: parameterId,
          Status: 'A'
        }
      });

      if (!parameter) {
        throw new BadRequestException(`Parameter with ID ${parameterId} not found`);
      }

      if (!parameter.ParameterQuery) {
        throw new BadRequestException(
          `Parameter ${parameter.ParameterName} does not have a query defined`
        );
      }

      // Validate and sanitize the query
      this.validateQuery(parameter.ParameterQuery);

      // Substitute context variables in the query
      let query = parameter.ParameterQuery;
      if (context.companyId) {
        query = query.replace(/\{companyId\}/g, context.companyId.toString());
      }
      if (context.branchId) {
        query = query.replace(/\{branchId\}/g, context.branchId.toString());
      }

      // Execute the query
      this.logger.log(`Executing parameter query: ${query}`);
      const results = await this._db.$queryRawUnsafe<Array<{ value: any; label: string }>>(query);

      return results;
    } catch (error) {
      this.logger.error(`executeParameterQueryError: ${error}`);
      throw error;
    }
  }

  /**
   * Validate SQL query for security
   */
  private validateQuery(query: string): void {
    const trimmedQuery = query.trim().toUpperCase();

    // Must start with SELECT
    if (!trimmedQuery.startsWith('SELECT')) {
      throw new BadRequestException('Only SELECT queries are allowed');
    }

    // Check for dangerous keywords
    const dangerousKeywords = [
      'DROP',
      'DELETE',
      'UPDATE',
      'INSERT',
      'ALTER',
      'EXEC',
      'EXECUTE',
      'CREATE',
      'TRUNCATE',
      'GRANT',
      'REVOKE',
      ';--',
      'XP_',
      'SP_',
    ];

    for (const keyword of dangerousKeywords) {
      if (trimmedQuery.includes(keyword)) {
        throw new BadRequestException(`Query contains forbidden keyword: ${keyword}`);
      }
    }

    // Additional security: check for multiple statements
    const statements = query.split(';').filter(s => s.trim().length > 0);
    if (statements.length > 1) {
      throw new BadRequestException('Multiple SQL statements are not allowed');
    }
  }
}
