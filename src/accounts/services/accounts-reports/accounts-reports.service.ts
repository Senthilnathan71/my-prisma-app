import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { DatabaseService } from 'src/database/database.service';
import { Prisma } from '@prisma/client';
import { AgeingReportQueryDto } from 'src/accounts/dto/accounts-reports.dto';
import { toNumber } from 'src/common/helper';
// -------------------------
// Helper types (local)
// -------------------------
type BucketMap = Record<string, number>;

interface SubledgerGroup {
  SubledgerMasterSid: number;
  SubledgerName?: string | null;
  LedgerName?: string | null;
  totalOutstandingCurrency: number;
  totalOutstandingLocal: number;
  voucherCount: number;
  buckets: BucketMap;
}

interface CurrencyGroup {
  CurrencyCode: string | null;
  subledgers: Map<number, SubledgerGroup>;
  totalOutstandingCurrency: number;
  totalOutstandingLocal: number;
  voucherCount: number;
  bucketTotals: BucketMap;
}

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
      Branch: SelectedBranches,
      Ledger: COAMasterSid,
      ToDate,
      CurrencyWise = true,
      ageingType: AgeingType = '30_60_90',
    } = params;

    const toDateObj = new Date(ToDate);

    // -------------------------------------------
    // 1. Build where clause
    // -------------------------------------------
    const whereClause: any = {
      CompanyMasterSid,
      COAMasterSid,
      Status: 'A',
      VoucherDate: { lte: toDateObj },
    };

    const coa = await this._db.cOAMaster.findFirst({
      where: {
        CompanyMasterSid,
        COAMasterSid,
        Status: 'A',
      },
      select: {
        LedgerName: true,
      },
    });

    if (!coa) {
      throw new BadRequestException('No ledger found for this company');
    }

    const branchSet = new Set<string>();
    if (SelectedBranches && SelectedBranches.length > 0) {
      whereClause.BranchMasterSid = { in: SelectedBranches };
      const allBranches = await this._db.branchMaster.findMany({
        where: {
          CompanyMasterSid,
          status: 'A',
          BranchMasterSid: { in: SelectedBranches },
        },
        select: {
          BranchMasterSid: true,
          branchName: true,
        },
      });
      allBranches.forEach(branch => branchSet.add(branch.branchName));
    } else {
      const allBranches = await this._db.branchMaster.findMany({
        where: {
          CompanyMasterSid,
          status: 'A',
        },
        select: {
          BranchMasterSid: true,
          branchName: true,
        },
      });
      allBranches.forEach(branch => branchSet.add(branch.branchName));
    }

    // -------------------------------------------
    // 2. Fetch vouchers
    // -------------------------------------------
    const vouchers = await this._db.voucherTransaction.findMany({
      where: whereClause,
      include: {
        subledgerMaster: true,
        voucherMatchings: { where: { Status: 'A' } },
      },
      orderBy: [
        { CurrencyCode: 'asc' },
        { LedgerMasterSid: 'asc' },
        { VoucherDate: 'asc' },
        { VoucherTransactionSid: 'asc' },
      ],
    });

    if (!vouchers || vouchers.length === 0) {
      throw new BadRequestException('No vouchers found for the given criteria');
    }

    // -------------------------------------------
    // 3. Transform rows
    // -------------------------------------------
    const reportData = vouchers.map(v => {
      const matchLocal = v.voucherMatchings.reduce(
        (acc, m) => acc + (m.DrCr === 'D' ? +m.LocalAmount : -m.LocalAmount),
        0,
      );
      const matchCurr = v.voucherMatchings.reduce(
        (acc, m) => acc + (m.DrCr === 'D' ? +m.Amount : -m.Amount),
        0,
      );

      const ageing =
        Math.floor((+new Date() - +new Date(v.VoucherDate)) / (1000 * 60 * 60 * 24)) + 1;

      return {
        LedgerName: coa.LedgerName,
        SubledgerName: v.subledgerMaster?.SubledgerName ?? null,
        SubledgerMasterSid: v.LedgerMasterSid ?? null,
        VoucherDate: v.VoucherDate,
        CurrencyCode: v.CurrencyCode ?? null,
        Ageing: ageing,
        OriginalCurrAmount: toNumber(v.Amount),
        OriginalLocalAmount: toNumber(v.LocalAmount),
        OSCurrencyAmount: toNumber(v.Amount) - Math.abs(matchCurr),
        OSLocalAmount: toNumber(v.LocalAmount) - Math.abs(matchLocal),
      };
    });

    // -------------------------------------------
    // 4. Bucket Logic
    // -------------------------------------------
    let bucketRanges: number[] = [];

    if (AgeingType === '30_60_90') bucketRanges = [30, 60, 90];
    else if (AgeingType === '15_30_45_60') bucketRanges = [15, 30, 45, 60];
    else if (AgeingType.includes('-')) {
      bucketRanges = AgeingType.split('-').map(s => +s);
      bucketRanges.sort((a, b) => a - b);
    } else {
      throw new BadRequestException('Invalid ageingType');
    }

    const bucketLabels: string[] = [];
    for (let i = 0; i < bucketRanges.length; i++) {
      if (i === 0) bucketLabels.push(`0-${bucketRanges[i]}`);
      else bucketLabels.push(`${bucketRanges[i - 1] + 1}-${bucketRanges[i]}`);
    }
    bucketLabels.push(`${bucketRanges[bucketRanges.length - 1] + 1}+`);

    // -------------------------------------------
    // 5. Grouping Logic - Currency -> Subledger
    // -------------------------------------------
    const currencyMap = new Map<string, CurrencyGroup>();

    // helpers to create/get groups safely
    const getOrCreateCurrencyGroup = (key: string, currencyCode: string | null) => {
      let cg = currencyMap.get(key);
      if (!cg) {
        const bucketTotals: BucketMap = {};
        bucketLabels.forEach(b => (bucketTotals[b] = 0));

        cg = {
          CurrencyCode: currencyCode,
          subledgers: new Map<number, SubledgerGroup>(),
          totalOutstandingCurrency: 0,
          totalOutstandingLocal: 0,
          voucherCount: 0,
          bucketTotals,
        };
        currencyMap.set(key, cg);
      }
      return cg;
    };

    const getOrCreateSubledger = (group: CurrencyGroup, sid: number, row: any) => {
      let sl = group.subledgers.get(sid);
      if (!sl) {
        const buckets: BucketMap = {};
        bucketLabels.forEach(b => (buckets[b] = 0));
        sl = {
          SubledgerMasterSid: sid,
          SubledgerName: row.SubledgerName ?? null,
          LedgerName: row.LedgerName ?? null,
          totalOutstandingCurrency: 0,
          totalOutstandingLocal: 0,
          voucherCount: 0,
          buckets,
        };
        group.subledgers.set(sid, sl);
      }
      return sl;
    };

    for (const row of reportData) {
      // skip rows without a valid subledger id
      const subIdRaw = row.SubledgerMasterSid;
      if (subIdRaw == null) continue;
      const subId = Number(subIdRaw);
      if (Number.isNaN(subId)) continue;

      const currCode = row.CurrencyCode;
      const currKey = currCode ?? 'NULL';

      if (CurrencyWise) {
        const currGroup = getOrCreateCurrencyGroup(currKey, currCode);

        const subledger = getOrCreateSubledger(currGroup, subId, row);

        // Update subledger totals (currency amounts)
        subledger.totalOutstandingCurrency += row.OSCurrencyAmount ?? 0;
        subledger.totalOutstandingLocal += row.OSLocalAmount ?? 0;
        subledger.voucherCount += 1;

        // Update currency group totals
        currGroup.totalOutstandingCurrency += row.OSCurrencyAmount ?? 0;
        currGroup.totalOutstandingLocal += row.OSLocalAmount ?? 0;
        currGroup.voucherCount += 1;

        // Bucket allocation (use OSCurrencyAmount here by your requirement)
        let placed = false;
        for (let i = 0; i < bucketRanges.length; i++) {
          if (row.Ageing <= bucketRanges[i]) {
            const label = bucketLabels[i];
            subledger.buckets[label] += row.OSCurrencyAmount ?? 0;
            currGroup.bucketTotals[label] += row.OSCurrencyAmount ?? 0;
            placed = true;
            break;
          }
        }
        if (!placed) {
          const last = bucketLabels[bucketLabels.length - 1];
          subledger.buckets[last] += row.OSCurrencyAmount ?? 0;
          currGroup.bucketTotals[last] += row.OSCurrencyAmount ?? 0;
        }
      } else {
        // Combined mode: use a single group key
        const combinedKey = 'ALL_CURRENCIES';
        const combinedGroup = getOrCreateCurrencyGroup(combinedKey, null);

        const subledger = getOrCreateSubledger(combinedGroup, subId, row);

        // Update subledger totals (we still record OSCurrencyAmount & OSLocalAmount)
        subledger.totalOutstandingCurrency += row.OSCurrencyAmount ?? 0;
        subledger.totalOutstandingLocal += row.OSLocalAmount ?? 0;
        subledger.voucherCount += 1;

        combinedGroup.totalOutstandingCurrency += row.OSCurrencyAmount ?? 0;
        combinedGroup.totalOutstandingLocal += row.OSLocalAmount ?? 0;
        combinedGroup.voucherCount += 1;

        // Bucket allocation (we still use OSCurrencyAmount for buckets per your previous logic)
        let placed = false;
        for (let i = 0; i < bucketRanges.length; i++) {
          if (row.Ageing <= bucketRanges[i]) {
            const label = bucketLabels[i];
            subledger.buckets[label] += row.OSCurrencyAmount ?? 0;
            combinedGroup.bucketTotals[label] += row.OSCurrencyAmount ?? 0;
            placed = true;
            break;
          }
        }
        if (!placed) {
          const last = bucketLabels[bucketLabels.length - 1];
          subledger.buckets[last] += row.OSCurrencyAmount ?? 0;
          combinedGroup.bucketTotals[last] += row.OSCurrencyAmount ?? 0;
        }
      }
    }

    // -------------------------------------------
    // 6. Convert Map to Array - Currency -> Subledgers
    // -------------------------------------------
    const ageingResult = Array.from(currencyMap.values()).map(currGroup => ({
      CurrencyCode: currGroup.CurrencyCode,
      totalOutstandingCurrency: currGroup.totalOutstandingCurrency,
      totalOutstandingLocal: currGroup.totalOutstandingLocal,
      voucherCount: currGroup.voucherCount,
      bucketTotals: currGroup.bucketTotals,
      subledgers: Array.from(currGroup.subledgers.values()).filter(
        sub => (sub.totalOutstandingLocal ?? 0) > 0 || (sub.totalOutstandingCurrency ?? 0) > 0,
      ),
    }));

    // -------------------------------------------
    // 7. Grand Totals
    // -------------------------------------------
    const grandTotalLocal = ageingResult.reduce((a, b) => a + (b.totalOutstandingLocal ?? 0), 0);
    const grandTotalCurrency = ageingResult.reduce((a, b) => a + (b.totalOutstandingCurrency ?? 0), 0);
    const totalVouchers = ageingResult.reduce((a, b) => a + (b.voucherCount ?? 0), 0);
    const totalSubledgers = ageingResult.reduce((a, b) => a + (b.subledgers?.length ?? 0), 0);

    // -------------------------------------------
    // 8. Overall Bucket Totals (across all currencies)
    // -------------------------------------------
    const overallBucketTotals: Record<string, number> = {};
    bucketLabels.forEach(b => {
      overallBucketTotals[b] = ageingResult.reduce((acc, curr) => acc + (curr.bucketTotals[b] ?? 0), 0);
    });

    // -------------------------------------------
    // 9. Final Response
    // -------------------------------------------
    return {
      concludedUpto: ToDate,
      LedgerName: coa.LedgerName || '',
      params: params,
      branchInvolved: Array.from(branchSet).join(', '),
      bucketLabels,
      currencyCount: ageingResult.length,
      subledgerCount: totalSubledgers,
      totalVouchers,
      grandTotalLocal,
      grandTotalCurrency,
      overallBucketTotals,
      ageingResult, // Currency -> Subledgers structure
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
