import { BadRequestException, Injectable, Logger, NotFoundException, Post } from '@nestjs/common';
import { DatabaseService } from 'src/database/database.service';
import { ApprovalStatus, Prisma } from '@prisma/client';
import { AgeingReportQueryDto, BalanceSheetReportQueryDto, LedgerReportQueryDto, OutstandingReportQueryDto, ProfitLossReportQueryDto, StatementLedgerReportQueryDto, TopNCustomerReportQueryDto, TrialBalanceReportQueryDto, UnpostedVoucherListReportQueryDto, VATReportQueryDto } from 'src/accounts/dto/accounts-reports.dto';
import { roundAmount, toNumber } from 'src/common/helper';
import { CustomerOutstandingResponseDto, CustomerOutstandingTransactionDto } from 'src/accounts/dto/outstanding.dto';
import { transcode } from 'buffer';
import { Decimal } from '@prisma/client/runtime/library';
import { ProfitSummaryReportQueryDto } from 'src/operation/DTO/operation-reports.dto';
import { DOC_TYPE_CODE } from 'src/common/config/voucher-type.config';
import { error } from 'console';
import { ProRateService } from 'src/operation/services/pro-rate/pro-rate.service';
import { VoucherService } from 'src/accounts/services/voucher/voucher.service';
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
  totalOnAccountCreditCurr: number;
  totalOnAccountCreditLocal: number;
  CreditDays: number;
  CreditLimit: number;
  // rows : any[];
  voucherCount: number;
  buckets: BucketMap;
}

interface CurrencyGroup {
  CurrencyCode: string | null;
  subledgers: Map<number, SubledgerGroup>;
  totalOutstandingCurrency: number;
  totalOutstandingLocal: number;
  totalOnAccountCreditCurr: number;
  totalOnAccountCreditLocal: number;
  voucherCount: number;
  bucketTotals: BucketMap;
}

@Injectable()
export class AccountsReportsService {
  constructor(
    private _db: DatabaseService,
    private logger: Logger,
    private readonly proRateService: ProRateService,
    private readonly voucherService: VoucherService,
  ) {}

  async getAvailableReports(companyId: number) {
    try {
      // Get all accounts reports
      const accountsMenu = await this._db.menuMaster.findFirst({
        where: {
          MenuName: 'Accounts Reports',
          status: 'A',
        },
      });

      if (!accountsMenu) {
        return [];
      }

      const allReports = await this._db.reportMaster.findMany({
        where: {
          ReportMenuSid: accountsMenu.MenuMasterSid,
          Status: 'A',
        },
        include: {
          ReportMasterDetail: {
            where: { Status: 'A' },
            orderBy: { ReportMasterDetailSid: 'asc' },
          },
        },
        orderBy: { ReportMasterSid: 'asc' },
      });

      // Filter by company exclusion
      const filteredReports = allReports.filter((report) => {
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
          Status: 'A',
        },
        include: {
          ReportMasterDetail: {
            where: { Status: 'A' },
            orderBy: { ReportMasterDetailSid: 'asc' },
          },
        },
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
        // case 'trial-balance':
        //   return await this.generateTrialBalance(parameters);
        case 'profit-loss':
          return await this.generateProfitLoss(parameters);
        case 'balance-sheet':
          return await this.generateBalanceSheet(parameters);
        case 'vat-receivable-report':
          return await this.generateVATReceivableReport(parameters);
        case 'vat-payable-report':
          return await this.generateVATPayableReport(parameters);
        case 'Vat-Summary-Report':
          return await this.generateVatSummaryReport(parameters);
        case 'profit-summary-report':
          return await this.generateProfitSummaryReport(parameters);
        case 'matching-list-report':
          return await this.generateMatchingListReport(parameters);
        case 'top-n-customer':
          return await this.generateTopNCustomerReport(parameters);
        case 'ledger-report':
          return await this.generateLedgerReport(parameters);
        case 'ledger-report-currenecy':
          return await this.generateLedgerCurrencyReport(parameters);
        case 'unposted-voucher-list':
          return await this.generateUnpostedVoucherList(parameters);
        case 'vat-report':
          return await this.vat201(parameters);
        case 'outstanding-local':
          return await this.gernerateOustandingLocal(parameters);
        case 'GST-inward':
          return await this.generateGSTInward(parameters);
        case 'GST-outward':
          return await this.generateGSTOutward(parameters);
        case 'GSTR':
          return await this.generateGSTR(parameters);
        case 'cash-flow':
          return await this.gernerateCashFlow(parameters);
           case 'subledger-outstanding':
        return await this.gernerateSubledgerOutstanding(parameters);
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
        LedgerType: true,
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
      allBranches.forEach((branch) => branchSet.add(branch.branchName));
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
      allBranches.forEach((branch) => branchSet.add(branch.branchName));
    }
    const branchInvolvedText =
      SelectedBranches && SelectedBranches.length > 0
        ? Array.from(branchSet).join(', ')
        : 'All Branches';

    // -------------------------------------------
    // 2. Fetch vouchers
    // -------------------------------------------
    const vouchers = await this._db.voucherTransaction.findMany({
      where: whereClause,
      include: {
        subledgerMaster: true,
        voucherMatchings: { where: { Status: 'A' , VoucherMatchingDate:{lte:toDateObj}} },
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
    const reportData = vouchers.map((v) => {
      const matchLocal = v.voucherMatchings.reduce(
        (acc, m) => acc + (m.DrCr === 'D' ? +m.LocalAmount : -m.LocalAmount),
        0,
      );
      const matchCurr = v.voucherMatchings.reduce(
        (acc, m) => acc + (m.DrCr === 'D' ? +m.Amount : -m.Amount),
        0,
      );

      const ageing =
        Math.floor(
          (+toDateObj - +new Date(v.VoucherDate)) / (1000 * 60 * 60 * 24),
        ) + 1;

      const outstandingCurr = toNumber(v.Amount) - Math.abs(matchCurr);
      const outstandingLocal = toNumber(v.LocalAmount) - Math.abs(matchLocal);
      const drCr = v.DrCr?.trim().toUpperCase();
      let sign = 1;
      if (
        (coa.LedgerType?.trim() === 'Sy Cr' && drCr === 'D') ||
        (coa.LedgerType?.trim() === 'Sy Dr' && drCr === 'C')
      ) {
        sign = -1;
      }

      const signedOSCurrencyAmount = sign * outstandingCurr;
      const signedOSLocalAmount = sign * outstandingLocal;
      const signedOnAccountCreditCurr =
        drCr === 'C' ? sign * outstandingCurr : 0;
      const signedOnAccountCreditLocal =
        drCr === 'C' ? sign * outstandingLocal : 0;

      return {
        VoucherTransactionSid: v.VoucherTransactionSid,
        LedgerName: coa.LedgerName,
        SubledgerName: v.subledgerMaster?.SubledgerName ?? null,
        SubledgerMasterSid: v.LedgerMasterSid ?? null,
        VoucherDate: v.VoucherDate,
        CurrencyCode: v.CurrencyCode ?? null,
        DrCr: v.DrCr,
        Ageing: ageing,
        OriginalCurrAmount: toNumber(v.Amount),
        OriginalLocalAmount: toNumber(v.LocalAmount),
        OSCurrencyAmount: signedOSCurrencyAmount,
        OSLocalAmount: signedOSLocalAmount,
        OnAccountCreditCurr: signedOnAccountCreditCurr,
        OnAccountCreditLocal: signedOnAccountCreditLocal,
      };
    });

    // -------------------------------------------
    // 4. Bucket Logic
    // -------------------------------------------
    let bucketRanges: number[] = [];

    if (AgeingType === '30_60_90') bucketRanges = [30, 60, 90];
    else if (AgeingType === '15_30_45_60') bucketRanges = [15, 30, 45, 60];
    else if (AgeingType.includes('-')) {
      bucketRanges = AgeingType.split('-').map((s) => +s);
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
    const getOrCreateCurrencyGroup = (
      key: string,
      currencyCode: string | null,
    ) => {
      let cg = currencyMap.get(key);
      if (!cg) {
        const bucketTotals: BucketMap = {};
        bucketLabels.forEach((b) => (bucketTotals[b] = 0));

        cg = {
          CurrencyCode: currencyCode,
          subledgers: new Map<number, SubledgerGroup>(),
          totalOutstandingCurrency: 0,
          totalOutstandingLocal: 0,
          totalOnAccountCreditCurr: 0,
          totalOnAccountCreditLocal: 0,
          voucherCount: 0,
          bucketTotals,
        };
        currencyMap.set(key, cg);
      }
      return cg;
    };

    const getOrCreateSubledger = (
      group: CurrencyGroup,
      sid: number,
      row: any,
    ) => {
      let sl = group.subledgers.get(sid);
      if (!sl) {
        const buckets: BucketMap = {};
        bucketLabels.forEach((b) => (buckets[b] = 0));
        sl = {
          SubledgerMasterSid: sid,
          SubledgerName: row.SubledgerName ?? null,
          LedgerName: row.LedgerName ?? null,
          totalOutstandingCurrency: 0,
          totalOutstandingLocal: 0,
          totalOnAccountCreditCurr: 0,
          totalOnAccountCreditLocal: 0,
          CreditDays: 0,
          CreditLimit: 0,
          voucherCount: 0,
          // rows : [],
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
        subledger.totalOutstandingCurrency += row.OSCurrencyAmount;
        subledger.totalOutstandingLocal += row.OSLocalAmount;
        subledger.totalOnAccountCreditCurr += row.OnAccountCreditCurr;
        subledger.totalOnAccountCreditLocal += row.OnAccountCreditLocal;
        // subledger.rows?.push(row);
        subledger.voucherCount += 1;

        // Update currency group totals
        currGroup.totalOutstandingCurrency += row.OSCurrencyAmount;
        currGroup.totalOutstandingLocal += row.OSLocalAmount;
        currGroup.totalOnAccountCreditCurr += row.OnAccountCreditCurr;
        currGroup.totalOnAccountCreditLocal += row.OnAccountCreditLocal;
        currGroup.voucherCount += 1;

        // Bucket allocation follows the same signed OS rule as totals.
        let placed = false;
        const bucketAmount = row.OSCurrencyAmount;
        for (let i = 0; i < bucketRanges.length; i++) {
          if (row.Ageing <= bucketRanges[i]) {
            const label = bucketLabels[i];
            subledger.buckets[label] += bucketAmount;
            currGroup.bucketTotals[label] += bucketAmount;
            placed = true;
            break;
          }
        }
        if (!placed) {
          const last = bucketLabels[bucketLabels.length - 1];
          subledger.buckets[last] += bucketAmount;
          currGroup.bucketTotals[last] += bucketAmount;
        }
      } else {
        // Combined mode: use a single group key
        const combinedKey = 'ALL_CURRENCIES';
        const combinedGroup = getOrCreateCurrencyGroup(combinedKey, null);

        const subledger = getOrCreateSubledger(combinedGroup, subId, row);

        // Update subledger totals using the same signed OS values.
        subledger.totalOutstandingCurrency += row.OSCurrencyAmount;
        subledger.totalOutstandingLocal += row.OSLocalAmount;
        subledger.totalOnAccountCreditCurr += row.OnAccountCreditCurr;
        subledger.totalOnAccountCreditLocal += row.OnAccountCreditLocal;
        subledger.voucherCount += 1;

        combinedGroup.totalOutstandingCurrency += row.OSCurrencyAmount;
        combinedGroup.totalOutstandingLocal += row.OSLocalAmount;
        combinedGroup.totalOnAccountCreditCurr += row.OnAccountCreditCurr;
        combinedGroup.totalOnAccountCreditLocal += row.OnAccountCreditLocal;
        combinedGroup.voucherCount += 1;

        // Bucket allocation follows the same signed OS rule as totals.
        let placed = false;
        const bucketAmount = row.OSCurrencyAmount;
        for (let i = 0; i < bucketRanges.length; i++) {
          if (row.Ageing <= bucketRanges[i]) {
            const label = bucketLabels[i];
            subledger.buckets[label] += bucketAmount;
            combinedGroup.bucketTotals[label] += bucketAmount;
            placed = true;
            break;
          }
        }
        if (!placed) {
          const last = bucketLabels[bucketLabels.length - 1];
          subledger.buckets[last] += bucketAmount;
          combinedGroup.bucketTotals[last] += bucketAmount;
        }
      }
    }

    // -------------------------------------------
    // 6. Convert Map to Array - Currency -> Subledgers
    // -------------------------------------------
    const ageingResult = Array.from(currencyMap.values()).map((currGroup) => ({
      CurrencyCode: currGroup.CurrencyCode,
      totalOutstandingCurrency: currGroup.totalOutstandingCurrency,
      totalOutstandingLocal: currGroup.totalOutstandingLocal,
      totalOnAccountCreditCurr: currGroup.totalOnAccountCreditCurr,
      totalOnAccountCreditLocal: currGroup.totalOnAccountCreditLocal,
      voucherCount: currGroup.voucherCount,
      bucketTotals: currGroup.bucketTotals,
      subledgers: Array.from(currGroup.subledgers.values()).filter(
        (sl) =>
          sl.totalOutstandingCurrency !== 0 || sl.totalOutstandingLocal !== 0,
      ),
    }));

    // -------------------------------------------
    // 7. Grand Totals
    // -------------------------------------------
    const grandTotalLocal = ageingResult.reduce(
      (a, b) => a + (b.totalOutstandingLocal ?? 0),
      0,
    );
    const grandTotalCurrency = ageingResult.reduce(
      (a, b) => a + (b.totalOutstandingCurrency ?? 0),
      0,
    );
    const grandTotalOnAccountCreditCurr = ageingResult.reduce(
      (a, b) => a + (b.totalOnAccountCreditCurr ?? 0),
      0,
    );
    const grandTotalOnAccountCreditLocal = ageingResult.reduce(
      (a, b) => a + (b.totalOnAccountCreditLocal ?? 0),
      0,
    );
    const totalVouchers = ageingResult.reduce(
      (a, b) => a + (b.voucherCount ?? 0),
      0,
    );
    const totalSubledgers = ageingResult.reduce(
      (a, b) => a + (b.subledgers?.length ?? 0),
      0,
    );

    // -------------------------------------------
    // 8. Overall Bucket Totals (across all currencies)
    // -------------------------------------------
    const overallBucketTotals: Record<string, number> = {};
    bucketLabels.forEach((b) => {
      overallBucketTotals[b] = ageingResult.reduce(
        (acc, curr) => acc + (curr.bucketTotals[b] ?? 0),
        0,
      );
    });

    // -------------------------------------------
    // 8.5 Fetch Credit Days & Limit for each Subledger
    // -------------------------------------------
    for (const currencyGroup of ageingResult) {
      for (const sl of currencyGroup.subledgers) {
        try {
          const credit = await this.getCreditRequest(sl.SubledgerMasterSid);
          sl.CreditDays = credit.CreditDays;
          sl.CreditLimit = credit.CreditLimit;
        } catch (e) {
          sl.CreditDays = 0;
          sl.CreditLimit = 0;
        }
      }
    }

    // -------------------------------------------
    // 9. Final Response
    // -------------------------------------------
    return {
      concludedUpto: ToDate,
      LedgerName: coa.LedgerName || '',
      params: params,
      branchInvolvedText,
      branchInvolved: Array.from(branchSet).join(', '),
      bucketLabels,
      currencyCount: ageingResult.length,
      subledgerCount: totalSubledgers,
      totalVouchers,
      grandTotalLocal,
      grandTotalCurrency,
      grandTotalOnAccountCreditCurr,
      grandTotalOnAccountCreditLocal,
      overallBucketTotals,
      ageingResult, // Currency -> Subledgers structure
    };
  }

  async getCreditRequest(SubledgerMasterSid: number) {
    try {
      const subledger = await this._db.subledgerMaster.findUnique({
        where: {
          SubledgerMasterSid: SubledgerMasterSid,
          SubledgerType: 'Customer',
          Status: 'A',
        },
        select: { SubledgerMappingSid: true },
      });

      if (!subledger) {
        throw new BadRequestException('No subledger found.');
      }

      if (!subledger.SubledgerMappingSid) {
        throw new BadRequestException('No mapping found.');
      }

      const customer = await this._db.customerMaster.findUnique({
        where: {
          CustomerMasterSid: subledger.SubledgerMappingSid!,
        },
        include: {
          customerCreditRequest: {
            where: {
              ApprovalStatus: ApprovalStatus.Approved,
              Status: 'A',
            },
          },
        },
      });

      if (!customer) {
        throw new BadRequestException('No customer found.');
      }

      if (
        customer.CashCredit === 'C' ||
        customer.customerCreditRequest.length === 0
      ) {
        return {
          CreditDays: 0,
          CreditLimit: 0,
        };
      }

      const allCreditReq = customer.customerCreditRequest || [];
      const reqWithHighestLimit = allCreditReq.reduce((acc, req) => {
        if (req.CreditLimit > acc.CreditLimit) return req;
        return acc;
      });

      return {
        CreditDays: reqWithHighestLimit.CreditDays,
        CreditLimit: reqWithHighestLimit.CreditLimit,
      };
    } catch (error) {
      throw error;
    }
  }

  private async gernerateSubledgerOutstanding(params: any) {
    const {
      ToDate,
      Subledger,
      Branch: branchId,
      companyId: CompanyMasterSid,
    } = params;

    const branches =
      branchId && branchId.length > 0
        ? await this._db.branchMaster.findMany({
            where: { BranchMasterSid: { in: branchId } },
            select: { BranchMasterSid: true, branchName: true },
          })
        : await this._db.branchMaster.findMany({
            where: { CompanyMasterSid },
            select: { BranchMasterSid: true, branchName: true },
          });

    const resolvedBranchIds = branches.map((b) => b.BranchMasterSid);
    const resolvedBranchNames = branches.map((b) => b.branchName);
    const branchInvolved =
      branchId && branchId.length > 0
        ? resolvedBranchNames.join(', ')
        : 'All Branches';

    const subledgerMaster = await this._db.subledgerMaster.findUnique({
      where: { SubledgerMasterSid: Subledger },
      select: { SubledgerName: true },
    });

    const ledgerRows = await this._db.voucherTransaction.findMany({
      where: {
        CompanyMasterSid,
        LedgerMasterSid: Subledger,
        BranchMasterSid: { in: resolvedBranchIds },
        Status: 'A',
      },
      select: {
        COAMasterSid: true,
      },
      distinct: ['COAMasterSid'],
    });

    const ledgerIds = ledgerRows
      .map((r) => r.COAMasterSid)
      .filter((id): id is number => !!id);

    if (!ledgerIds.length) {
      throw new BadRequestException(
        'No ledgers found for the selected subledger',
      );
    }

    const reports: any[] = await Promise.all(
      ledgerIds.map((ledgerId) =>
        this.generateOutstandingReport({
          ...params,
          Ledger: ledgerId,
        }),
      ),
    );

    const ledgerWiseData = reports.map((r) => ({
      ledgerMasterSid: r?.ledgerMasterSid ?? null,
      ledgerName: r?.ledgerName ?? null,
      totalOutstandingCurrency: roundAmount(
        toNumber(r?.totalOutstandingCurrency || 0),
        2,
      ),
      totalOutstandingLocal: roundAmount(
        toNumber(r?.totalOutstandingLocal || 0),
        2,
      ),
      voucherCount: r?.voucherCount ?? 0,
      transactions: r?.transactions || [],
      ageingSummary: r?.ageingSummary || null,
      currencyWiseSummary: r?.currencyWiseSummary || [],
    }));

    return {
      companyMasterSid: CompanyMasterSid,
      subledgerMasterSid: Subledger,
      subledgerName: subledgerMaster?.SubledgerName || null,
      branchInvolved,
      branchNames: resolvedBranchNames.join(', '),
      totalLedgers: ledgerWiseData.length,
      ledgerWiseData,
      params: {
        ...params,
        Ledger: null,
      },
      ledgerIds,
    };
  }

  async generateOutstandingReport(params: OutstandingReportQueryDto) {
    const {
      ToDate,
      Subledger: ledgerMasterSid,
      Ledger: coaMasterSid,
      Branch: branchId,
      companyId: CompanyMasterSid,
    } = params;

    try {
      this.logger.log(
        `Getting customer outstanding: CompanySid=${CompanyMasterSid}, LedgerMasterSid=${ledgerMasterSid}`,
      );

      const branches =
        branchId && branchId.length > 0
          ? await this._db.branchMaster.findMany({
              where: { BranchMasterSid: { in: branchId } },
              select: {
                BranchMasterSid: true,
                branchName: true,
              },
            })
          : await this._db.branchMaster.findMany({
              where: { CompanyMasterSid },
              select: {
                BranchMasterSid: true,
                branchName: true,
              },
            });

      const resolvedBranchIds = branches.map((b) => b.BranchMasterSid);
      const resolvedBranchNames = branches.map((b) => b.branchName);
      const brancesInvoled =
        branchId && branchId.length > 0
          ? branches.map((b) => b.branchName).join(', ')
          : 'All Branches';

      const subledger = await this._db.subledgerMaster.findUnique({
        where: { SubledgerMasterSid: ledgerMasterSid },
      });

      const ledger = await this._db.cOAMaster.findUnique({
        where: { COAMasterSid: coaMasterSid },
      });

      const userMaster = await this._db.userMaster.findMany({
        select: {
          UserMasterSid: true,
          userName: true,
        },
      });

      const voucherTransactions = await this._db.voucherTransaction.findMany({
        where: {
          CompanyMasterSid: CompanyMasterSid,
          BranchMasterSid: { in: resolvedBranchIds },
          VoucherDate: { lte: ToDate },
          COAMasterSid: coaMasterSid,
          LedgerMasterSid: ledgerMasterSid,
          Status: 'A',
        },
        include: {
          VoucherHeader: true,
          masterJob: true,
          houseJob: true,
          departmentMaster: {
            select: { departmentName: true },
          },
          voucherMatchings: {
            where: {
              Status: 'A',
              VoucherMatchingDate:{
                lte:ToDate
              }
            },
          },
          voucherTypeMaster: {
            select: { DocumentTypeCode: true },
          },
        },
        orderBy: {
          VoucherDate: 'asc',
        },
      });

      if (voucherTransactions.length === 0) {
        this.logger.log(
          `No outstanding vouchers found for LedgerMasterSid ${ledgerMasterSid}`,
        );
        return {
          companyMasterSid: CompanyMasterSid,
          BranchMasterSid: branchId,
          branchNames: resolvedBranchNames.join(', '),
          ledgerMasterSid: ledgerMasterSid,
          subledgerName: subledger?.SubledgerName,
          ledgerName: ledger?.LedgerName,
          totalOutstandingCurrency: 0,
          totalOutstandingLocal: 0,
          voucherCount: 0,
          transactions: [],
        };
      }

      const transactions: any[] = [];
      let totalOutstandingCurrency = 0;
      let totalOutstandingLocal = 0;
      let cumulativeTotal = 0;
      let localAmt = 0;
      let oscurrenecyAmt = 0;
      const ageingSummary = {
        totalOutstanding: 0,
        bucket_0_30: 0,
        bucket_31_60: 0,
        bucket_61_90: 0,
        bucket_91_120: 0,
        bucket_121_above: 0,
      };

      const currencyWiseSummary: Record<string, any> = {};
      for (const vt of voucherTransactions) {
        const originalCurrencyAmount = toNumber(vt.Amount);
        const originalLocalAmount = toNumber(vt.LocalAmount);

        let matchedCurrencyAmount = 0;
        let matchedLocalAmount = 0;

        if (vt.voucherMatchings && vt.voucherMatchings.length > 0) {
          matchedCurrencyAmount = vt.voucherMatchings.reduce(
            (sum, m) => sum + toNumber(m.Amount),
            0,
          );
          matchedLocalAmount = vt.voucherMatchings.reduce(
            (sum, m) => sum + toNumber(m.LocalAmount),
            0,
          );
        }

        const outstandingCurrencyAmount = roundAmount(
          originalCurrencyAmount - matchedCurrencyAmount,
          2,
        );

        const outstandingLocalAmount = roundAmount(
          originalLocalAmount - matchedLocalAmount,
          2,
        );

        const exchangeRate =
          originalCurrencyAmount !== 0
            ? roundAmount(originalLocalAmount / originalCurrencyAmount, 4)
            : 1.0;

        const voucherDate = new Date(vt.VoucherDate);
        const reportToDate = new Date(ToDate);

        const ageingDays =
          Math.floor(
            (reportToDate.getTime() - voucherDate.getTime()) /
              (1000 * 60 * 60 * 24),
          ) + 1;

        const drCr = vt.DrCr?.toUpperCase();
        let signedAmount = outstandingLocalAmount;
        if (ledger?.LedgerType?.trim() === 'Sy Cr') {
          if (drCr === 'C') signedAmount = +outstandingLocalAmount;
          if (drCr === 'D') signedAmount = -outstandingLocalAmount;
        } else if (ledger?.LedgerType?.trim() === 'Sy Dr') {
          if (drCr === 'D') signedAmount = +outstandingLocalAmount;
          if (drCr === 'C') signedAmount = -outstandingLocalAmount;
        }

        cumulativeTotal += signedAmount;
        cumulativeTotal = roundAmount(cumulativeTotal, 2);

        if (ledger?.LedgerType?.trim() === 'Sy Cr') {
          if (drCr === 'C') signedAmount = +outstandingLocalAmount;
          if (drCr === 'D') signedAmount = -outstandingLocalAmount;
        } else if (ledger?.LedgerType?.trim() === 'Sy Dr') {
          if (drCr === 'D') signedAmount = +outstandingLocalAmount;
          if (drCr === 'C') signedAmount = -outstandingLocalAmount;
        }
        localAmt += signedAmount;
        localAmt = roundAmount(localAmt, 2);

        const ledgerType = ledger?.LedgerType?.trim();
        const drCrValue = vt.DrCr?.trim().toUpperCase();

        let sign = 1;
        if (
          (ledgerType === 'Sy Cr' && drCrValue === 'D') ||
          (ledgerType === 'Sy Dr' && drCrValue === 'C')
        ) {
          sign = -1;
        }

        const signedOriginalCurrency = sign * originalCurrencyAmount;
        const signedOriginalLocal = sign * originalLocalAmount;
        const signedOutstandingCurrency = sign * outstandingCurrencyAmount;
        const signedOutstandingLocal = sign * outstandingLocalAmount;
        let oscurramt = originalLocalAmount;
        if (ledger?.LedgerType?.trim() === 'Sy Cr') {
          if (drCr === 'C') oscurramt = +signedOriginalLocal;
          if (drCr === 'D') oscurramt = -originalLocalAmount;
        } else if (ledger?.LedgerType?.trim() === 'Sy Dr') {
          if (drCr === 'D') oscurramt = +originalLocalAmount;
          if (drCr === 'C') oscurramt = -originalLocalAmount;
        }

        oscurrenecyAmt += oscurramt;

        if (
          Math.abs(outstandingCurrencyAmount) > 0 ||
          Math.abs(outstandingLocalAmount) > 0
        ) {
          let ageingBucket = '';

          if (ageingDays <= 30) ageingBucket = '0 - 30 Days';
          else if (ageingDays <= 60) ageingBucket = '31 - 60 Days';
          else if (ageingDays <= 90) ageingBucket = '61 - 90 Days';
          else if (ageingDays <= 120) ageingBucket = '91 - 120 Days';
          else ageingBucket = '121+ Above';

          const currency = vt.CurrencyCode || '';
          if (!currencyWiseSummary[currency]) {
            currencyWiseSummary[currency] = {
              currencyCode: currency,
              totalOutstanding: 0,
              bucket_0_30: 0,
              bucket_31_60: 0,
              bucket_61_90: 0,
              bucket_91_120: 0,
              bucket_121_above: 0,
            };
          }

          currencyWiseSummary[currency].totalOutstanding += oscurramt;

          if (ageingDays <= 30)
            currencyWiseSummary[currency].bucket_0_30 += oscurramt;
          else if (ageingDays <= 60)
            currencyWiseSummary[currency].bucket_31_60 += oscurramt;
          else if (ageingDays <= 90)
            currencyWiseSummary[currency].bucket_61_90 += oscurramt;
          else if (ageingDays <= 120)
            currencyWiseSummary[currency].bucket_91_120 += oscurramt;
          else currencyWiseSummary[currency].bucket_121_above += oscurramt;

          transactions.push({
            voucherTransactionSid: vt.VoucherTransactionSid,
            voucherHeaderSid: vt.VoucherHeaderSid,
            voucherDetailSid: vt.VoucherDetailSid,
            voucherNumber: vt.VoucherNumber,
            voucherDate: vt.VoucherDate,
            voucherTypeMasterSid: vt.VoucherTypeMasterSid,
            ledgerMasterSid: vt.LedgerMasterSid!,
            coaMasterSid: vt.COAMasterSid!,
            MasterJobNumber: vt.masterJob?.MasterJobNumber,
            HouseJobNumber: vt.houseJob?.HBLNo,
            voucherType: vt.voucherTypeMaster?.DocumentTypeCode,
            originalCurrencyAmount: toNumber(originalCurrencyAmount),
            originalLocalAmount: toNumber(originalLocalAmount),
            matchedCurrencyAmount: toNumber(matchedCurrencyAmount),
            matchedLocalAmount: toNumber(matchedLocalAmount),
            outstandingCurrencyAmount: outstandingCurrencyAmount,
            outstandingLocalAmount: outstandingLocalAmount,
            signedOriginalCurrency: toNumber(signedOriginalCurrency),
            signedOriginalLocal: toNumber(signedOriginalLocal),
            signedOutstandingCurrency: toNumber(signedOutstandingCurrency),
            signedOutstandingLocal: toNumber(signedOutstandingLocal),
            currencyCode: vt.CurrencyCode || '',
            exchangeRate: toNumber(vt.ExchangeRate || 1),
            drCr: vt.DrCr,
            chargeDescription: vt.ChargeDescription || '',
            deptname: vt.departmentMaster?.departmentName,
            salesmanSid:
              userMaster.find(
                (u) => u.UserMasterSid === vt.houseJob?.SalesmanSid,
              )?.userName || '',
            naration: vt.Narration,
            ageingDays: ageingDays,
            ageingBucket: ageingSummary,
            cumulativeOutstanding: cumulativeTotal,
            localAmt: localAmt,
          });

          totalOutstandingCurrency += signedOriginalCurrency;
          totalOutstandingLocal += signedOutstandingLocal;
        }
        ageingSummary.totalOutstanding = roundAmount(
          ageingSummary.totalOutstanding,
          2,
        );
        ageingSummary.bucket_0_30 = roundAmount(ageingSummary.bucket_0_30, 2);
        ageingSummary.bucket_31_60 = roundAmount(ageingSummary.bucket_31_60, 2);
        ageingSummary.bucket_61_90 = roundAmount(ageingSummary.bucket_61_90, 2);
        ageingSummary.bucket_91_120 = roundAmount(
          ageingSummary.bucket_91_120,
          2,
        );
        ageingSummary.bucket_121_above = roundAmount(
          ageingSummary.bucket_121_above,
          2,
        );
      }

      const response = {
        companyMasterSid: CompanyMasterSid,
        branchMasterSid: branchId,
        branchNames: resolvedBranchNames.join(', '),
        brancesInvoled,
        ledgerMasterSid: ledgerMasterSid!,
        subledgerName: subledger?.SubledgerName,
        ledgerName: ledger?.LedgerName,
        ledgerType: ledger?.LedgerType,
        totalOutstandingCurrency: roundAmount(totalOutstandingCurrency, 2),
        totalOutstandingLocal: roundAmount(totalOutstandingLocal, 2),
        voucherCount: transactions.length,
        transactions: transactions,
        params: params,
        ageingSummary,
        currencyWiseSummary: Object.values(currencyWiseSummary),
      };

      this.logger.log(
        `Customer outstanding calculated: ${transactions.length} transactions, Total=${response.totalOutstandingLocal}`,
      );

      return response;
    } catch (error) {
      throw error;
    }
  }

  private async gernerateOustandingLocal(params: OutstandingReportQueryDto) {
    const {
      ToDate,
      Subledger: ledgerMasterSid,
      Ledger: coaMasterSid,
      Branch: branchId,
      companyId: CompanyMasterSid,
    } = params;

    try {
      this.logger.log(
        `Getting customer outstanding: CompanySid=${CompanyMasterSid}, LedgerMasterSid=${ledgerMasterSid}`,
      );

      const branches =
        branchId && branchId.length > 0
          ? await this._db.branchMaster.findMany({
              where: { BranchMasterSid: { in: branchId } },
              select: {
                BranchMasterSid: true,
                branchName: true,
              },
            })
          : await this._db.branchMaster.findMany({
              where: { CompanyMasterSid },
              select: {
                BranchMasterSid: true,
                branchName: true,
              },
            });

      const resolvedBranchIds = branches.map((b) => b.BranchMasterSid);
      const resolvedBranchNames = branches.map((b) => b.branchName);
      const brancesInvoled =
        branchId && branchId.length > 0
          ? branches.map((b) => b.branchName).join(', ')
          : 'All Branches';

      const subledger = await this._db.subledgerMaster.findUnique({
        where: { SubledgerMasterSid: ledgerMasterSid },
      });

      const ledger = await this._db.cOAMaster.findUnique({
        where: { COAMasterSid: coaMasterSid },
        select: {
          LedgerName: true,
          LedgerType: true,
        },
      });

      const userMaster = await this._db.userMaster.findMany({
        select: {
          UserMasterSid: true,
          userName: true,
        },
      });

      const voucherTransactions = await this._db.voucherTransaction.findMany({
        where: {
          CompanyMasterSid: CompanyMasterSid,
          BranchMasterSid: { in: resolvedBranchIds },
          VoucherDate: { lte: ToDate },
          COAMasterSid: coaMasterSid,
          LedgerMasterSid: ledgerMasterSid,
          Status: 'A',
        },
        include: {
          VoucherHeader: true,
          masterJob: true,
          houseJob: true,
          departmentMaster: {
            select: { departmentName: true },
          },
          voucherMatchings: {
            where: {
              Status: 'A',
              VoucherMatchingDate:{lte:ToDate}
            },
          },
          voucherTypeMaster: {
            select: { DocumentTypeCode: true },
          },
        },
        orderBy: {
          VoucherDate: 'asc',
        },
      });

      if (voucherTransactions.length === 0) {
        this.logger.log(
          `No outstanding vouchers found for LedgerMasterSid ${ledgerMasterSid}`,
        );
        return {
          companyMasterSid: CompanyMasterSid,
          BranchMasterSid: branchId,
          branchNames: resolvedBranchNames.join(', '),
          ledgerMasterSid: ledgerMasterSid,
          subledgerName: subledger?.SubledgerName,
          ledgerName: ledger?.LedgerName,
          totalOutstandingCurrency: 0,
          totalOutstandingLocal: 0,
          voucherCount: 0,
          transactions: [],
        };
      }

      const transactions: any[] = [];
      let totalOutstandingCurrency = 0;
      let totalOutstandingLocal = 0;
      let cumulativeTotal = 0;

      const ageingSummary = {
        totalOutstanding: 0,
        bucket_0_30: 0,
        bucket_31_60: 0,
        bucket_61_90: 0,
        bucket_91_120: 0,
        bucket_121_above: 0,
      };

      const currencyWiseSummary: Record<string, any> = {};
      const currencyCumulative: Record<string, number> = {};
      for (const vt of voucherTransactions) {
        const originalCurrencyAmount = toNumber(vt.Amount);
        const originalLocalAmount = toNumber(vt.LocalAmount);
        const currency = vt.CurrencyCode || '';
        if (!currencyCumulative[currency]) {
          currencyCumulative[currency] = 0;
        }
        let matchedCurrencyAmount = 0;
        let matchedLocalAmount = 0;

        if (vt.voucherMatchings && vt.voucherMatchings.length > 0) {
          matchedCurrencyAmount = vt.voucherMatchings.reduce(
            (sum, m) => sum + toNumber(m.Amount),
            0,
          );
          matchedLocalAmount = vt.voucherMatchings.reduce(
            (sum, m) => sum + toNumber(m.LocalAmount),
            0,
          );
        }

        const outstandingCurrencyAmount = roundAmount(
          originalCurrencyAmount - matchedCurrencyAmount,
          2,
        );
        const outstandingLocalAmount = roundAmount(
          originalLocalAmount - matchedLocalAmount,
          2,
        );

        const drCr = vt.DrCr?.toUpperCase();
        let signedAmount = outstandingCurrencyAmount;
        if (ledger?.LedgerType?.trim() === 'Sy Cr') {
          if (drCr === 'C') signedAmount = outstandingCurrencyAmount;
          if (drCr === 'D')
            signedAmount = -1 * toNumber(outstandingCurrencyAmount);
        } else if (ledger?.LedgerType?.trim() === 'Sy Dr') {
          if (drCr === 'D') signedAmount = outstandingCurrencyAmount;
          if (drCr === 'C')
            signedAmount = -1 * toNumber(outstandingCurrencyAmount);
        }
        cumulativeTotal += signedAmount;
        currencyCumulative[currency] += signedAmount;
        const exchangeRate =
          originalCurrencyAmount !== 0
            ? roundAmount(originalLocalAmount / originalCurrencyAmount, 4)
            : 1.0;

        const voucherDate = new Date(vt.VoucherDate);
        const reportToDate = new Date(ToDate);

        const ageingDays =
          Math.floor(
            (reportToDate.getTime() - voucherDate.getTime()) /
              (1000 * 60 * 60 * 24),
          ) + 1;

        const ledgerType = ledger?.LedgerType?.trim();
        const drCrValue = vt.DrCr?.trim().toUpperCase();

        let sign = 1;
        if (
          (ledgerType === 'Sy Cr' && drCrValue === 'D') ||
          (ledgerType === 'Sy Dr' && drCrValue === 'C')
        ) {
          sign = -1;
        }
        const signedOriginalCurrency = sign * originalCurrencyAmount;
        const signedOutstandingCurrency = sign * outstandingCurrencyAmount;

        if (
          Math.abs(outstandingCurrencyAmount) > 0 ||
          Math.abs(outstandingLocalAmount) > 0
        ) {
          let ageingBucket = '';

          if (ageingDays <= 30) ageingBucket = '0 - 30 Days';
          else if (ageingDays <= 60) ageingBucket = '31 - 60 Days';
          else if (ageingDays <= 90) ageingBucket = '61 - 90 Days';
          else if (ageingDays <= 120) ageingBucket = '91 - 120 Days';
          else ageingBucket = '121+ Above';

          const currency = vt.CurrencyCode || '';

          if (!currencyWiseSummary[currency]) {
            currencyWiseSummary[currency] = {
              currencyCode: currency,
              totalOutstanding: 0,
              bucket_0_30: 0,
              bucket_31_60: 0,
              bucket_61_90: 0,
              bucket_91_120: 0,
              bucket_121_above: 0,
            };
          }

          ageingSummary.totalOutstanding += outstandingCurrencyAmount;

          if (ageingDays <= 30)
            ageingSummary.bucket_0_30 += outstandingCurrencyAmount;
          else if (ageingDays <= 60)
            ageingSummary.bucket_31_60 += outstandingCurrencyAmount;
          else if (ageingDays <= 90)
            ageingSummary.bucket_61_90 += outstandingCurrencyAmount;
          else if (ageingDays <= 120)
            ageingSummary.bucket_91_120 += outstandingCurrencyAmount;
          else ageingSummary.bucket_121_above += outstandingCurrencyAmount;

          currencyWiseSummary[currency].totalOutstanding += signedAmount;

          if (ageingDays <= 30)
            currencyWiseSummary[currency].bucket_0_30 += signedAmount;
          else if (ageingDays <= 60)
            currencyWiseSummary[currency].bucket_31_60 += signedAmount;
          else if (ageingDays <= 90)
            currencyWiseSummary[currency].bucket_61_90 += signedAmount;
          else if (ageingDays <= 120)
            currencyWiseSummary[currency].bucket_91_120 += signedAmount;
          else currencyWiseSummary[currency].bucket_121_above += signedAmount;

          transactions.push({
            voucherTransactionSid: vt.VoucherTransactionSid,
            voucherHeaderSid: vt.VoucherHeaderSid,
            voucherDetailSid: vt.VoucherDetailSid,
            voucherNumber: vt.VoucherNumber,
            voucherDate: vt.VoucherDate,
            voucherTypeMasterSid: vt.VoucherTypeMasterSid,
            ledgerMasterSid: vt.LedgerMasterSid!,
            coaMasterSid: vt.COAMasterSid!,
            MasterJobNumber: vt.masterJob?.MasterJobNumber,
            HouseJobNumber: vt.houseJob?.HBLNo,
            voucherType: vt.voucherTypeMaster?.DocumentTypeCode,
            originalCurrencyAmount: toNumber(originalCurrencyAmount),
            originalLocalAmount: toNumber(originalLocalAmount),
            matchedCurrencyAmount: toNumber(matchedCurrencyAmount),
            matchedLocalAmount: toNumber(matchedLocalAmount),
            outstandingCurrencyAmount: outstandingCurrencyAmount,
            outstandingLocalAmount: outstandingLocalAmount,
            currencyCode: vt.CurrencyCode || '',
            exchangeRate: toNumber(vt.ExchangeRate || 1),
            drCr: vt.DrCr,
            chargeDescription: vt.ChargeDescription || '',
            deptname: vt.departmentMaster?.departmentName,
            salesmanSid:
              userMaster.find(
                (u) => u.UserMasterSid === vt.houseJob?.SalesmanSid,
              )?.userName || '',
            naration: vt.Narration,
            ageingDays: ageingDays,
            ageingBucket: ageingBucket,
            cumulativeOutstanding: cumulativeTotal,
            currencyWiseCumulative: currencyCumulative[currency],
            signedOriginalCurrency: toNumber(signedOriginalCurrency),
            signedOutstandingCurrency: toNumber(signedOutstandingCurrency),
          });

          totalOutstandingCurrency += outstandingCurrencyAmount;
          totalOutstandingLocal += outstandingLocalAmount;
        }
        ageingSummary.totalOutstanding = roundAmount(
          ageingSummary.totalOutstanding,
          2,
        );
        ageingSummary.bucket_0_30 = roundAmount(ageingSummary.bucket_0_30, 2);
        ageingSummary.bucket_31_60 = roundAmount(ageingSummary.bucket_31_60, 2);
        ageingSummary.bucket_61_90 = roundAmount(ageingSummary.bucket_61_90, 2);
        ageingSummary.bucket_91_120 = roundAmount(
          ageingSummary.bucket_91_120,
          2,
        );
        ageingSummary.bucket_121_above = roundAmount(
          ageingSummary.bucket_121_above,
          2,
        );
      }

      transactions.sort((a, b) => a.currencyCode.localeCompare(b.currencyCode));

      const response = {
        companyMasterSid: CompanyMasterSid,
        branchMasterSid: branchId,
        branchNames: resolvedBranchNames.join(', '),
        brancesInvoled,
        ledgerMasterSid: ledgerMasterSid!,
        subledgerName: subledger?.SubledgerName,
        ledgerName: ledger?.LedgerName,
        totalOutstandingCurrency: roundAmount(totalOutstandingCurrency, 2),
        totalOutstandingLocal: roundAmount(totalOutstandingLocal, 2),
        voucherCount: transactions.length,
        transactions: transactions,
        params: params,
        ageingSummary,
        currencyWiseSummary: Object.values(currencyWiseSummary),
      };

      this.logger.log(
        `Customer outstanding calculated: ${transactions.length} transactions, Total=${response.totalOutstandingLocal}`,
      );

      return response;
    } catch (error) {
      this.logger.error(
        `Error getting customer outstanding for ${ledgerMasterSid}: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  private async generateStatementLedgerReport(
    params: StatementLedgerReportQueryDto,
  ) {
    const {
      FromDate,
      ToDate,
      Subledger: ledgerMasterSid,
      Ledger: coaMasterSid,
      Branch: branchId,
      companyId: CompanyMasterSid,
    } = params;

    try {
      this.logger.log(
        `Getting customer outstanding: CompanySid=${CompanyMasterSid}, LedgerMasterSid=${ledgerMasterSid}`,
      );

      const branches =
        branchId && branchId.length > 0
          ? await this._db.branchMaster.findMany({
              where: { BranchMasterSid: { in: branchId } },
              select: {
                BranchMasterSid: true,
                branchName: true,
              },
            })
          : await this._db.branchMaster.findMany({
              where: { CompanyMasterSid },
              select: {
                BranchMasterSid: true,
                branchName: true,
              },
            });

      const resolvedBranchIds = branches.map((b) => b.BranchMasterSid);
      const resolvedBranchNames = branches.map((b) => b.branchName);
      const BranchInvolved =
        branchId && branchId.length > 0
          ? branches.map((b) => b.branchName).join(', ')
          : 'All Branches';

      // Get customer/subledger information
      const subledger = await this._db.subledgerMaster.findUnique({
        where: { SubledgerMasterSid: ledgerMasterSid },
      });

      const ledger = await this._db.cOAMaster.findUnique({
        where: { COAMasterSid: coaMasterSid },
      });

      const userMaster = await this._db.userMaster.findMany({
        select: {
          UserMasterSid: true,
          userName: true,
        },
      });

      const openingTransactions = await this._db.voucherTransaction.findMany({
        where: {
          CompanyMasterSid,
          BranchMasterSid: { in: resolvedBranchIds },
          VoucherDate: { lt: FromDate },
          ...(coaMasterSid && { COAMasterSid: coaMasterSid }),
          ...(ledgerMasterSid && { LedgerMasterSid: ledgerMasterSid }),
          VoucherHeader: {
            PostStatus: 'P',
          },
          Status: 'A',
        },
      });

      let openingBalance = 0;

      for (const vt of openingTransactions) {
        // opening balance before take from date and  Amt
        const amt = toNumber(vt.LocalAmount);
        const drCr = vt.DrCr?.trim().toUpperCase();
        let signedAmt = amt;
        if (ledger?.LedgerType?.trim() === 'Sy Cr') {
          if (drCr === 'D') signedAmt = -amt;
          if (drCr === 'C') signedAmt = +amt;
        }

        if (ledger?.LedgerType?.trim() === 'Sy Dr') {
          if (drCr === 'C') signedAmt = -amt;
          if (drCr === 'D') signedAmt = +amt;
        }
        openingBalance += signedAmt;
      }

      openingBalance = roundAmount(openingBalance, 2);

      const voucherTransactions = await this._db.voucherTransaction.findMany({
        where: {
          CompanyMasterSid: CompanyMasterSid,
          BranchMasterSid: { in: resolvedBranchIds },
          AND: [
            { VoucherDate: { gte: FromDate } },
            { VoucherDate: { lte: ToDate } },
          ],
          COAMasterSid: coaMasterSid,
          LedgerMasterSid: ledgerMasterSid,
          VoucherHeader: {
            PostStatus: 'P',
          },
          Status: 'A',
        },
        include: {
          VoucherHeader: {
            select: {
              PostStatus: true,
            },
          },
          masterJob: true,
          houseJob: true,
          departmentMaster: {
            select: { departmentName: true },
          },
          voucherMatchings: {
            where: {
              Status: 'A',
            },
          },
          voucherTypeMaster: {
            select: { DocumentTypeCode: true },
          },
        },
        orderBy: {
          VoucherDate: 'asc',
        },
      });

      if (voucherTransactions.length === 0) {
        this.logger.log(
          `No outstanding vouchers found for LedgerMasterSid ${ledgerMasterSid}`,
        );
        return {
          companyMasterSid: CompanyMasterSid,
          branchMasterSid: branchId,
          ledgerMasterSid: ledgerMasterSid,
          COAMasterSid: coaMasterSid,
          subledgerName: subledger?.SubledgerName,
          ledgerName: ledger?.LedgerName,
          ledgerType: ledger?.LedgerType,
          totalOutstandingCurrency: 0,
          totalOutstandingLocal: 0,
          openingBalance: openingBalance,
          voucherCount: 0,
          transactions: [],
          branchNames: resolvedBranchNames.join(', '),
          BranchInvolved,
          params: params,
        };
      }

      // Calculate outstanding for each transaction
      const transactions: any[] = [];
      let totalOutstandingCurrency = 0;
      let totalOutstandingLocal = 0;
      let cumulativeTotal = openingBalance;
      for (const vt of voucherTransactions) {
        const originalCurrencyAmount = toNumber(vt.Amount);
        const originalLocalAmount = toNumber(vt.LocalAmount);

        // Sum matched amounts for this transaction
        let matchedCurrencyAmount = 0;
        let matchedLocalAmount = 0;

        if (vt.voucherMatchings && vt.voucherMatchings.length > 0) {
          matchedCurrencyAmount = vt.voucherMatchings.reduce(
            (sum, m) => sum + toNumber(m.Amount),
            0,
          );
          matchedLocalAmount = vt.voucherMatchings.reduce(
            (sum, m) => sum + toNumber(m.LocalAmount),
            0,
          );
        }

        const outstandingCurrencyAmount = roundAmount(
          originalCurrencyAmount - matchedCurrencyAmount,
          2,
        );
        const outstandingLocalAmount = roundAmount(
          originalLocalAmount - matchedLocalAmount,
          2,
        );
        const ledgerType = ledger?.LedgerType?.trim();
        const drCrValue = vt.DrCr?.trim().toUpperCase();

        const drCr = vt.DrCr?.toUpperCase();
        let signedAmount = originalLocalAmount;
        if (ledger?.LedgerType?.trim() === 'Sy Cr') {
          if (drCr === 'C') signedAmount = +originalLocalAmount;
          if (drCr === 'D') signedAmount = -originalLocalAmount;
        } else if (ledger?.LedgerType?.trim() === 'Sy Dr') {
          if (drCr === 'D') signedAmount = +originalLocalAmount;
          if (drCr === 'C') signedAmount = -originalLocalAmount;
        }

        cumulativeTotal += signedAmount;
        cumulativeTotal = roundAmount(cumulativeTotal, 2);

        let sign = 1;
        if (
          (ledgerType === 'Sy Cr' && drCrValue === 'D') ||
          (ledgerType === 'Sy Dr' && drCrValue === 'C')
        ) {
          sign = -1;
        }
        const signedOriginalCurrency = sign * originalCurrencyAmount;
        const signedOutstandingCurrency = sign * outstandingCurrencyAmount;
        const signedLocalAmt = sign * originalLocalAmount;
        const signedoutstandingLocalAmount = sign * outstandingLocalAmount;
        // Calculate exchange rate
        const exchangeRate =
          originalCurrencyAmount !== 0
            ? roundAmount(originalLocalAmount / originalCurrencyAmount, 4)
            : 1.0;

        // Only include if there's outstanding balance
        // if (Math.abs(outstandingCurrencyAmount) > 0 || Math.abs(outstandingLocalAmount) > 0) {
        transactions.push({
          voucherTransactionSid: vt.VoucherTransactionSid,
          voucherHeaderSid: vt.VoucherHeaderSid,
          voucherDetailSid: vt.VoucherDetailSid,
          voucherNumber: vt.VoucherNumber,
          voucherDate: vt.VoucherDate,
          voucherTypeMasterSid: vt.VoucherTypeMasterSid,
          ledgerMasterSid: vt.LedgerMasterSid!,
          coaMasterSid: vt.COAMasterSid!,
          MasterJobNumber: vt.masterJob?.MasterJobNumber,
          HouseJobNumber: vt.houseJob?.HBLNo,
          voucherType: vt.voucherTypeMaster?.DocumentTypeCode,
          originalCurrencyAmount: toNumber(originalCurrencyAmount),
          originalLocalAmount: toNumber(originalLocalAmount),
          matchedCurrencyAmount: toNumber(matchedCurrencyAmount),
          matchedLocalAmount: toNumber(matchedLocalAmount),
          outstandingCurrencyAmount: outstandingCurrencyAmount,
          outstandingLocalAmount: outstandingLocalAmount,
          currencyCode: vt.CurrencyCode || 'USD',
          exchangeRate: toNumber(vt.ExchangeRate || 1),
          drCr: vt.DrCr,
          chargeDescription: vt.ChargeDescription || '',
          deptname:
            vt.departmentMaster?.departmentName &&
            !vt.departmentMaster.departmentName.toLowerCase().includes('air')
              ? vt.departmentMaster.departmentName
              : null,
          salesmanSid:
            userMaster.find((u) => u.UserMasterSid === vt.houseJob?.SalesmanSid)
              ?.userName || '',
          naration: vt.Narration,
          // currency amt
          signedOriginalCurrency: toNumber(signedOriginalCurrency),
          signedOutstandingCurrency: toNumber(signedOutstandingCurrency),
          // local amt
          signedLocalAmt: toNumber(signedLocalAmt),
          signedoutstandingLocalAmount: toNumber(signedoutstandingLocalAmount),
          cumulativeOutstanding: cumulativeTotal,
        });

        totalOutstandingCurrency += outstandingCurrencyAmount;
        totalOutstandingLocal += outstandingLocalAmount;
      }
      // }

      const response = {
        companyMasterSid: CompanyMasterSid,
        branchMasterSid: branchId,
        ledgerMasterSid: ledgerMasterSid!,
        subledgerName: subledger?.SubledgerName,
        ledgerName: ledger?.LedgerName,
        ledgerType: ledger?.LedgerType,
        totalOutstandingCurrency: roundAmount(totalOutstandingCurrency, 2),
        totalOutstandingLocal: roundAmount(totalOutstandingLocal, 2),
        openingBalance: openingBalance,
        voucherCount: transactions.length,
        transactions: transactions,
        branchNames: resolvedBranchNames.join(', '),
        BranchInvolved,
        params: params,
      };

      this.logger.log(
        `Customer outstanding calculated: ${transactions.length} transactions, Total=${response.totalOutstandingLocal}`,
      );

      return response;
    } catch (error) {
      this.logger.error(
        `Error getting customer outstanding for ${ledgerMasterSid}: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  private async generateProfitLoss(params: ProfitLossReportQueryDto) {
    const {
      ToDate,
      FromDate,
      Branch: branchId,
      companyId: CompanyMasterSid,
      COAMasterSid,
    } = params;

    try {
      this.logger.log(
        `Getting customer profit and loss: CompanySid=${CompanyMasterSid}`,
      );

      const branches =
        branchId && branchId.length > 0
          ? await this._db.branchMaster.findMany({
              where: { BranchMasterSid: { in: branchId } },
              select: {
                BranchMasterSid: true,
                branchName: true,
              },
            })
          : await this._db.branchMaster.findMany({
              where: { CompanyMasterSid },
              select: {
                BranchMasterSid: true,
                branchName: true,
              },
            });

      const resolvedBranchIds = branches.map((b) => b.BranchMasterSid);
      const resolvedBranchNames = branches.map((b) => b.branchName);
      const BranchInvolved =
        branchId && branchId.length > 0
          ? branches.map((b) => b.branchName).join(', ')
          : 'All Branches';
      const voucherTransactions = await this._db.voucherTransaction.findMany({
        where: {
          CompanyMasterSid,
          BranchMasterSid: { in: resolvedBranchIds },
          VoucherDate: {
            gte: FromDate,
            lte: ToDate,
          },
          Status: 'A',

          ...(COAMasterSid?.length
            ? { COAMasterSid: { in: COAMasterSid } }
            : {}),

          coaMaster: {
            Category: {
              in: ['Income', 'Expense'],
            },
          },
        },
        include: {
          coaMaster: {
            select: {
              Category: true,
              GroupName: true,
              SubGroupName: true,
              LedgerName: true,
              LedgerType: true,
            },
          },
          yearMaster: {
            select: {
              YearCode: true,
            },
          },
        },
        orderBy: { VoucherDate: 'asc' },
      });

      const profitLossMap = new Map<string, any>();
      const yearKeySet = new Set<string>();

      const normalizeText = (value?: string | null) =>
        String(value || '').trim().toLowerCase();

      const hasDirectKeyword = (value?: string | null) =>
        /\bdirect\b/.test(normalizeText(value));

      const resolveProfitSection = (
        category?: string | null,
        groupName?: string | null,
        subGroupName?: string | null,
        ledgerName?: string | null,
        ledgerType?: string | null,
      ) => {
        const normalizedLedgerType = normalizeText(ledgerType);

        if (category === 'Income' && (hasDirectKeyword(subGroupName) || hasDirectKeyword(ledgerName))) {
          return 'DirectIncome';
        }

        if (category === 'Expense' && (hasDirectKeyword(subGroupName) || hasDirectKeyword(ledgerName))) {
          return 'DirectExpense';
        }

        // For non-direct rows, let LedgerType decide the bucket first.
        if (normalizedLedgerType.includes('other revenue')) {
          return 'OtherRevenue';
        }

        if (
          normalizedLedgerType.includes('other cost') ||
          normalizedLedgerType.includes('expense')
        ) {
          return 'OtherCost';
        }

        if (category === 'Income') {
          return 'OtherRevenue';
        }

        if (category === 'Expense') {
          return 'OtherCost';
        }

        return 'Unknown';
      };

      const getDisplayGroupName = (
        category?: string | null,
        groupName?: string | null,
        subGroupName?: string | null,
      ) => subGroupName || groupName || category || '';

      const createAmountMap = (yearKeys: string[]) =>
        yearKeys.reduce(
          (acc, yearKey) => {
            acc[yearKey] = 0;
            return acc;
          },
          {} as Record<string, number>,
        );

      const addAmounts = (
        target: Record<string, number>,
        source: Record<string, number>,
      ) => {
        for (const [yearKey, amount] of Object.entries(source)) {
          target[yearKey] = roundAmount(
            (target[yearKey] || 0) + amount,
            2,
          );
        }
      };

      for (const vt of voucherTransactions) {
        if (!vt.coaMaster) continue;

        const { Category, GroupName, SubGroupName, LedgerName, LedgerType } =
          vt.coaMaster;
        const yearCode = String(
          vt.yearMaster?.YearCode ?? new Date(vt.VoucherDate).getFullYear(),
        );
        yearKeySet.add(yearCode);

        const profitSection = resolveProfitSection(
          Category,
          GroupName,
          SubGroupName,
          LedgerName,
          LedgerType,
        );

        const amount = vt.LocalAmount.toNumber();
        const drCr = vt.DrCr?.trim().toUpperCase();
        let signedAmount = amount;

        if (Category === 'Income') {
          signedAmount = drCr === 'C' ? amount : -amount;
        } else if (Category === 'Expense') {
          signedAmount = drCr === 'D' ? amount : -amount;
        }

        const key = [
          Category,
          profitSection,
          GroupName,
          SubGroupName,
          LedgerName,
        ].join('|');

        if (!profitLossMap.has(key)) {
          profitLossMap.set(key, {
            Category,
            ProfitSection: profitSection,
            GroupName,
            SubGroupName,
            DisplayGroupName: getDisplayGroupName(
              Category,
              GroupName,
              SubGroupName,
            ),
            LedgerName,
            LedgerType,
            amounts: {} as Record<string, number>,
          });
        }

        const row = profitLossMap.get(key);
        row.amounts[yearCode] = roundAmount(
          (row.amounts[yearCode] || 0) + signedAmount,
          2,
        );
      }

      const yearKeys = Array.from(yearKeySet).sort((a, b) => Number(a) - Number(b));

      const groupedRows = Array.from(profitLossMap.values()).sort((a, b) => {
        if (a.ProfitSection !== b.ProfitSection) {
          return a.ProfitSection.localeCompare(b.ProfitSection);
        }

        if (a.DisplayGroupName !== b.DisplayGroupName) {
          return a.DisplayGroupName.localeCompare(b.DisplayGroupName);
        }

        return (a.LedgerName || '').localeCompare(b.LedgerName || '');
      });

      const bucketedRows = {
        DirectIncome: [] as any[],
        DirectExpense: [] as any[],
        OtherRevenue: [] as any[],
        OtherCost: [] as any[],
      };

      for (const row of groupedRows) {
        if (row.ProfitSection in bucketedRows) {
          bucketedRows[row.ProfitSection as keyof typeof bucketedRows].push(row);
        }
      }

      const toDetailRows = (rows: any[]) => {
        let previousGroupLabel = '';

        return rows.map((row) => {
          const currentGroupLabel = row.DisplayGroupName || '';
          const groupLabel =
            currentGroupLabel === previousGroupLabel ? '' : currentGroupLabel;

          previousGroupLabel = currentGroupLabel;

          return {
            rowType: 'detail',
            sectionLabel: '',
            groupLabel,
            ledgerLabel: row.LedgerName || '',
            amounts: row.amounts,
            Category: row.Category,
            ProfitSection: row.ProfitSection,
            GroupName: row.GroupName,
            SubGroupName: row.SubGroupName,
            LedgerName: row.LedgerName,
            LedgerType: row.LedgerType,
          };
        });
      };

      const buildTotalRow = (ledgerLabel: string, rows: any[]) => {
        const amounts = createAmountMap(yearKeys);
        for (const row of rows) {
          addAmounts(amounts, row.amounts || {});
        }

        return {
          rowType: 'total',
          sectionLabel: '',
          groupLabel: '',
          ledgerLabel,
          amounts,
        };
      };

      const directIncomeRows = bucketedRows.DirectIncome;
      const directExpenseRows = bucketedRows.DirectExpense;
      const otherRevenueRows = bucketedRows.OtherRevenue;
      const otherCostRows = bucketedRows.OtherCost;

      const totalIncomeRow = buildTotalRow('Total Income', directIncomeRows);
      const totalExpenseRow = buildTotalRow('Total Expenses', directExpenseRows);
      const totalOtherRevenueRow = buildTotalRow(
        'Total Other Revenue',
        otherRevenueRows,
      );
      const totalOtherCostRow = buildTotalRow(
        'Total Other Cost',
        otherCostRows,
      );

      const grossProfitAmounts = createAmountMap(yearKeys);
      const netProfitAmounts = createAmountMap(yearKeys);

      for (const yearKey of yearKeys) {
        grossProfitAmounts[yearKey] = roundAmount(
          (totalIncomeRow.amounts[yearKey] || 0) -
            (totalExpenseRow.amounts[yearKey] || 0),
          2,
        );

        netProfitAmounts[yearKey] = roundAmount(
          grossProfitAmounts[yearKey] +
            (totalOtherRevenueRow.amounts[yearKey] || 0) -
            (totalOtherCostRow.amounts[yearKey] || 0),
          2,
        );
      }

      const grossProfitRow = {
        rowType: 'summary',
        sectionLabel: '',
        groupLabel: '',
        ledgerLabel: 'Gross Profit',
        amounts: grossProfitAmounts,
      };

      const netProfitRow = {
        rowType: 'summary',
        sectionLabel: '',
        groupLabel: '',
        ledgerLabel: 'Net Profit',
        amounts: netProfitAmounts,
      };

      const profitLoss: any[] = [
        {
          rowType: 'section',
          sectionLabel: 'Income',
          groupLabel: '',
          ledgerLabel: '',
          amounts: createAmountMap(yearKeys),
        },
        ...toDetailRows(directIncomeRows),
        totalIncomeRow,
        {
          rowType: 'section',
          sectionLabel: 'Expenses',
          groupLabel: '',
          ledgerLabel: '',
          amounts: createAmountMap(yearKeys),
        },
        ...toDetailRows(directExpenseRows),
        totalExpenseRow,
        grossProfitRow,
        netProfitRow,
      ];

      if (otherRevenueRows.length > 0) {
        profitLoss.splice(
          profitLoss.length - 1,
          0,
          {
            rowType: 'section',
            sectionLabel: 'Other Revenue',
            groupLabel: '',
            ledgerLabel: '',
            amounts: createAmountMap(yearKeys),
          },
          ...toDetailRows(otherRevenueRows),
          totalOtherRevenueRow,
        );
      }

      if (otherCostRows.length > 0) {
        profitLoss.splice(
          profitLoss.length - 1,
          0,
          {
            rowType: 'section',
            sectionLabel: 'Other Cost',
            groupLabel: '',
            ledgerLabel: '',
            amounts: createAmountMap(yearKeys),
          },
          ...toDetailRows(otherCostRows),
          totalOtherCostRow,
        );
      }

      return {
        CompanyMasterSid,
        branchNames: resolvedBranchNames.join(', '),
        BranchInvolved,
        fromDate: FromDate,
        toDate: ToDate,
        yearKeys,
        params,
        profitLoss,
        summary: {
          totalIncome: totalIncomeRow.amounts,
          totalExpenses: totalExpenseRow.amounts,
          grossProfit: grossProfitRow.amounts,
          totalOtherRevenue: totalOtherRevenueRow.amounts,
          totalOtherCost: totalOtherCostRow.amounts,
          netProfit: netProfitRow.amounts,
        },
      };
    } catch (error) {
      throw error;
    }
  }

  private async generateLedgerReport(params: LedgerReportQueryDto) {
    const {
      FromDate,
      ToDate,
      Subledger: ledgerMasterSid,
      Ledger: coaMasterSid,
      Branch: branchId,
      companyId: CompanyMasterSid,
      VoucherType: voucherType,
    } = params;

    try {
      this.logger.log(
        `Getting ledger report: CompanySid=${CompanyMasterSid}, LedgerMasterSid=${ledgerMasterSid}`,
      );

      const branches =
        branchId && branchId.length > 0
          ? await this._db.branchMaster.findMany({
              where: { BranchMasterSid: { in: branchId } },
              select: {
                BranchMasterSid: true,
                branchName: true,
              },
            })
          : await this._db.branchMaster.findMany({
              where: { CompanyMasterSid },
              select: {
                BranchMasterSid: true,
                branchName: true,
              },
            });

      const resolvedBranchIds = branches.map((b) => b.BranchMasterSid);
      const resolvedBranchNames = branches.map((b) => b.branchName);
      const branchInvolved =
        branchId && branchId.length > 0
          ? branches.map((b) => b.branchName).join(', ')
          : 'All Branches';
      const subledger = ledgerMasterSid
        ? await this._db.subledgerMaster.findUnique({
            where: { SubledgerMasterSid: ledgerMasterSid },
          })
        : null;

      const ledger = coaMasterSid
        ? await this._db.cOAMaster.findUnique({
            where: { COAMasterSid: coaMasterSid },
          })
        : null;

      const userMaster = await this._db.userMaster.findMany({
        select: {
          UserMasterSid: true,
          userName: true,
        },
      });

      const voucherTypeMaster = voucherType
        ? await this._db.voucherTypeMaster.findUnique({
            where: { VoucherTypeMasterSid: Number(voucherType) },
            select: {
              VoucherTypeMasterSid: true,
              DocumentTypeCode: true,
            },
          })
        : null;

      const openingTransactions = await this._db.voucherTransaction.findMany({
        where: {
          CompanyMasterSid,
          BranchMasterSid: { in: resolvedBranchIds },
          VoucherDate: { lt: FromDate },
          ...(coaMasterSid && { COAMasterSid: coaMasterSid }),
          ...(ledgerMasterSid && { LedgerMasterSid: ledgerMasterSid }),
          ...(voucherType && {
            VoucherTypeMasterSid: Number(voucherType),
          }),
          VoucherHeader: {
            PostStatus: 'P',
          },
          Status: 'A',
        },
      });

      let openingBalance = 0;

      for (const vt of openingTransactions) {
        // opening balance before take from date and  Amt
        const amt = toNumber(vt.LocalAmount);
        const drCr = vt.DrCr?.trim().toUpperCase();
        let signedAmt = amt;
        if (ledger?.LedgerType?.trim() === 'Sy Cr') {
          if (drCr === 'D') signedAmt = -amt;
          if (drCr === 'C') signedAmt = +amt;
        } else if (ledger?.LedgerType?.trim() === 'Sy Dr') {
          if (drCr === 'C') signedAmt = -amt;
          if (drCr === 'D') signedAmt = +amt;
        } else {
          if (drCr === 'D') signedAmt = +amt;
          if (drCr === 'C') signedAmt = -amt;
        }
        openingBalance += signedAmt;
      }

      openingBalance = roundAmount(openingBalance, 2);

      const voucherTransactions = await this._db.voucherTransaction.findMany({
        where: {
          CompanyMasterSid: CompanyMasterSid,
          BranchMasterSid: { in: resolvedBranchIds },
          AND: [
            { VoucherDate: { gte: FromDate } },
            { VoucherDate: { lte: ToDate } },
          ],
          ...(coaMasterSid && { COAMasterSid: coaMasterSid }),
          ...(ledgerMasterSid && { LedgerMasterSid: ledgerMasterSid }),
          ...(voucherType && {
            VoucherTypeMasterSid: Number(voucherType),
          }),
          VoucherHeader: {
            PostStatus: 'P',
          },

          Status: 'A',
        },
        include: {
          VoucherHeader: {
            select: {
              PostStatus: true,
            },
          },
          masterJob: true,
          houseJob: true,
          departmentMaster: {
            select: { departmentName: true },
          },
          voucherMatchings: {
            where: {
              Status: 'A',
              VoucherMatchingDate: {
                lte: ToDate,
              },
            },
          },
          voucherTypeMaster: {
            select: { DocumentTypeCode: true },
          },
        },
        orderBy: {
          VoucherDate: 'asc',
        },
      });

      if (voucherTransactions.length === 0) {
        this.logger.log(
          `No Ledger Report found for LedgerMasterSid ${ledgerMasterSid}`,
        );
        return {
          companyMasterSid: CompanyMasterSid,
          branchMasterSid: branchId,
          ledgerMasterSid: ledgerMasterSid || null,
          COAMasterSid: coaMasterSid || null,
          subledgerName: subledger?.SubledgerName,
          ledgerName: ledger?.LedgerName,
          ledgerType: ledger?.LedgerType,
          totalOutstandingCurrency: 0,
          totalOutstandingLocal: 0,
          openingBalance: openingBalance,
          voucherCount: 0,
          transactions: [],
          branchNames: resolvedBranchNames.join(', '),
          voucherTypeName: voucherTypeMaster?.DocumentTypeCode || 'All Vouchers',
          branchInvolved,
          params: params,
        };
      }

      // Calculate outstanding for each transaction
      const transactions: any[] = [];
      let totalOutstandingCurrency = 0;
      let totalOutstandingLocal = 0;
      let cumulativeTotal = openingBalance;
      for (const vt of voucherTransactions) {
        const originalCurrencyAmount = toNumber(vt.Amount);
        let originalLocalAmount = toNumber(vt.LocalAmount);
        const localAmt = toNumber(vt.LocalAmount)
      
        // Sum matched amounts for this transaction
        let matchedCurrencyAmount = 0;
        let matchedLocalAmount = 0;

        if (vt.voucherMatchings && vt.voucherMatchings.length > 0) {
          matchedCurrencyAmount = vt.voucherMatchings.reduce(
            (sum, m) => sum + toNumber(m.Amount),
            0,
          );
          matchedLocalAmount = vt.voucherMatchings.reduce(
            (sum, m) => sum + toNumber(m.LocalAmount),
            0,
          );
        }

        const outstandingCurrencyAmount = roundAmount(
          originalCurrencyAmount - matchedCurrencyAmount,
          2,
        );
        const outstandingLocalAmount = roundAmount(
          originalLocalAmount - matchedLocalAmount,
          2,
        );
        const ledgerType = ledger?.LedgerType?.trim();
        const drCrValue = vt.DrCr?.trim().toUpperCase();

        const drCr = vt.DrCr?.toUpperCase();
        let signedAmount = localAmt;
        if (ledger?.LedgerType?.trim() === 'Sy Cr') {
          if (drCr === 'C') signedAmount = +localAmt;
          if (drCr === 'D') signedAmount = -localAmt;
        } else if (ledger?.LedgerType?.trim() === 'Sy Dr') {
          if (drCr === 'D') signedAmount = +localAmt;
          if (drCr === 'C') signedAmount = -localAmt;
        } else {
          if (drCr === 'D') signedAmount = +localAmt;
          if (drCr === 'C') signedAmount = -localAmt;
        }

        cumulativeTotal += signedAmount;
        cumulativeTotal = roundAmount(cumulativeTotal, 2);

        let sign = 1;
        if (
          (ledgerType === 'Sy Cr' && drCrValue === 'D') ||
          (ledgerType === 'Sy Dr' && drCrValue === 'C')
        ) {
          sign = -1;
        }
        const signedOriginalCurrency = sign * originalCurrencyAmount;
        const signedOutstandingCurrency = sign * outstandingCurrencyAmount;
        const signedLocalAmt = sign * originalLocalAmount;
        const signedoutstandingLocalAmount = sign * outstandingLocalAmount;

        // Calculate exchange rate
        const exchangeRate =
          originalCurrencyAmount !== 0
            ? roundAmount(originalLocalAmount / originalCurrencyAmount, 4)
            : 1.0;

        // Only include if there's outstanding balance

        transactions.push({
          voucherTransactionSid: vt.VoucherTransactionSid,
          voucherHeaderSid: vt.VoucherHeaderSid,
          voucherDetailSid: vt.VoucherDetailSid,
          voucherNumber: vt.VoucherNumber,
          voucherDate: vt.VoucherDate,
          voucherTypeMasterSid: vt.VoucherTypeMasterSid,
          ledgerMasterSid: vt.LedgerMasterSid!,
          coaMasterSid: vt.COAMasterSid!,
          MasterJobNumber: vt.masterJob?.MasterJobNumber,
          HouseJobNumber: vt.houseJob?.HBLNo,
          voucherType: vt.voucherTypeMaster?.DocumentTypeCode,
          originalCurrencyAmount: toNumber(originalCurrencyAmount),
          originalLocalAmount: toNumber(originalLocalAmount),
          matchedCurrencyAmount: toNumber(matchedCurrencyAmount),
          matchedLocalAmount: toNumber(matchedLocalAmount),
          outstandingCurrencyAmount: outstandingCurrencyAmount,
          outstandingLocalAmount: outstandingLocalAmount,
          currencyCode: vt.CurrencyCode || 'USD',
          exchangeRate: toNumber(vt.ExchangeRate || 1),
          drCr: vt.DrCr,
          chargeDescription: vt.ChargeDescription || '',
          deptname:
            vt.departmentMaster?.departmentName &&
            !vt.departmentMaster.departmentName.toLowerCase().includes('air')
              ? vt.departmentMaster.departmentName
              : null,
          salesmanSid:
            userMaster.find((u) => u.UserMasterSid === vt.houseJob?.SalesmanSid)
              ?.userName || '',
          naration: vt.Narration,
          cumulativeOutstanding: cumulativeTotal,
          signedOriginalCurrency: toNumber(signedOriginalCurrency),
          signedOutstandingCurrency: toNumber(signedOutstandingCurrency),
          signedLocalAmt: toNumber(signedLocalAmt),
          signedoutstandingLocalAmount: toNumber(signedoutstandingLocalAmount),
        });

        totalOutstandingCurrency += outstandingCurrencyAmount;
        totalOutstandingLocal += outstandingLocalAmount;
      }

      const response = {
        companyMasterSid: CompanyMasterSid,
        branchMasterSid: branchId,
        branchInvolved,
        ledgerMasterSid: ledgerMasterSid!,
        subledgerName: subledger?.SubledgerName,
        ledgerName: ledger?.LedgerName,
        ledgerType: ledger?.LedgerType,
        totalOutstandingCurrency: roundAmount(totalOutstandingCurrency, 2),
        totalOutstandingLocal: roundAmount(totalOutstandingLocal, 2),
        openingBalance: openingBalance,
        voucherCount: transactions.length,
        transactions: transactions,
        branchNames: resolvedBranchNames.join(', '),
        voucherTypeName: voucherTypeMaster?.DocumentTypeCode || 'All Vouchers',
        params: params,
      };

      this.logger.log(
        `ledger calculated: ${transactions.length} transactions, Total=${response.totalOutstandingLocal}`,
      );

      return response;
    } catch (error) {
      throw error;
    }
  }

  private async generateLedgerCurrencyReport(params: LedgerReportQueryDto) {
    const {
      FromDate,
      ToDate,
      Subledger: ledgerMasterSid,
      Ledger: coaMasterSid,
      Branch: branchId,
      companyId: CompanyMasterSid,
      VoucherType: voucherType,
      Currency: currency,
    } = params;

    try {
      this.logger.log(
        `Getting ledger report: CompanySid=${CompanyMasterSid}, LedgerMasterSid=${ledgerMasterSid}`,
      );

      const branches =
        branchId && branchId.length > 0
          ? await this._db.branchMaster.findMany({
              where: { BranchMasterSid: { in: branchId } },
              select: {
                BranchMasterSid: true,
                branchName: true,
              },
            })
          : await this._db.branchMaster.findMany({
              where: { CompanyMasterSid },
              select: {
                BranchMasterSid: true,
                branchName: true,
              },
            });

      const resolvedBranchIds = branches.map((b) => b.BranchMasterSid);
      const resolvedBranchNames = branches.map((b) => b.branchName);
      const branchInvolved =
        branchId && branchId.length > 0
          ? branches.map((b) => b.branchName).join(', ')
          : 'All Branches';
      const subledger = ledgerMasterSid
        ? await this._db.subledgerMaster.findUnique({
            where: { SubledgerMasterSid: ledgerMasterSid },
          })
        : null;

      const ledger = coaMasterSid
        ? await this._db.cOAMaster.findUnique({
            where: { COAMasterSid: coaMasterSid },
          })
        : null;

      const userMaster = await this._db.userMaster.findMany({
        select: {
          UserMasterSid: true,
          userName: true,
        },
      });

      const voucherTypeMaster = voucherType
        ? await this._db.voucherTypeMaster.findUnique({
            where: { VoucherTypeMasterSid: Number(voucherType) },
            select: {
              VoucherTypeMasterSid: true,
              DocumentTypeCode: true,
            },
          })
        : null;

      let resolvedCurrencyCode: string | undefined;
      if (currency !== undefined && currency !== null) {
        const currencyMasterSid = Number(currency);
        const currencyMaster = await this._db.currencyMaster.findUnique({
          where: { CurrencyMasterSid: currencyMasterSid },
          select: { currencyCode: true },
        });

        if (!currencyMaster?.currencyCode) {
          throw new BadRequestException(`Invalid Currenecy: ${currency}`);
        }

        resolvedCurrencyCode = currencyMaster.currencyCode;
      }

      const openingTransactions = await this._db.voucherTransaction.findMany({
        where: {
          CompanyMasterSid,
          BranchMasterSid: { in: resolvedBranchIds },
          VoucherDate: { lt: FromDate },
          ...(coaMasterSid && { COAMasterSid: coaMasterSid }),
          ...(ledgerMasterSid && { LedgerMasterSid: ledgerMasterSid }),
          ...(voucherType && {
            VoucherTypeMasterSid: Number(voucherType),
          }),
          ...(resolvedCurrencyCode && { CurrencyCode: resolvedCurrencyCode }),
          VoucherHeader: {
            PostStatus: 'P',
          },
          Status: 'A',
        },
      });

      let openingBalance = 0;

      for (const vt of openingTransactions) {
        // opening balance before take from date and  Amt
        const amt = toNumber(vt.Amount);
        const drCr = vt.DrCr?.trim().toUpperCase();
        let signedAmt = amt;
        if (ledger?.LedgerType?.trim() === 'Sy Cr') {
          if (drCr === 'D') signedAmt = -amt;
          if (drCr === 'C') signedAmt = +amt;
        } else if (ledger?.LedgerType?.trim() === 'Sy Dr') {
          if (drCr === 'C') signedAmt = -amt;
          if (drCr === 'D') signedAmt = +amt;
        } else {
          if (drCr === 'D') signedAmt = +amt;
          if (drCr === 'C') signedAmt = -amt;
        }
        openingBalance += signedAmt;
      }

      openingBalance = roundAmount(openingBalance, 2);

      const voucherTransactions = await this._db.voucherTransaction.findMany({
        where: {
          CompanyMasterSid: CompanyMasterSid,
          BranchMasterSid: { in: resolvedBranchIds },
          AND: [
            { VoucherDate: { gte: FromDate } },
            { VoucherDate: { lte: ToDate } },
          ],
          ...(coaMasterSid && { COAMasterSid: coaMasterSid }),
          ...(ledgerMasterSid && { LedgerMasterSid: ledgerMasterSid }),
          ...(voucherType && {
            VoucherTypeMasterSid: Number(voucherType),
          }),
          ...(resolvedCurrencyCode && { CurrencyCode: resolvedCurrencyCode }),
          VoucherHeader: {
            PostStatus: 'P',
          },

          Status: 'A',
        },
        include: {
          VoucherHeader: {
            select: {
              PostStatus: true,
            },
          },
          masterJob: true,
          houseJob: true,
          departmentMaster: {
            select: { departmentName: true },
          },
          voucherMatchings: {
            where: {
              Status: 'A',
              VoucherMatchingDate: {
                lte: ToDate,
              },
            },
          },
          voucherTypeMaster: {
            select: { DocumentTypeCode: true },
          },
        },
        orderBy: {
          VoucherDate: 'asc',
        },
      });

      if (voucherTransactions.length === 0) {
        this.logger.log(
          `No Ledger Report found for LedgerMasterSid ${ledgerMasterSid}`,
        );
        return {
          companyMasterSid: CompanyMasterSid,
          branchMasterSid: branchId,
          ledgerMasterSid: ledgerMasterSid || null,
          COAMasterSid: coaMasterSid || null,
          subledgerName: subledger?.SubledgerName,
          ledgerName: ledger?.LedgerName,
          ledgerType: ledger?.LedgerType,
          totalOutstandingCurrency: 0,
          totalOutstandingLocal: 0,
          openingBalance: openingBalance,
          voucherCount: 0,
          transactions: [],
          branchNames: resolvedBranchNames.join(', '),
          voucherTypeName: voucherTypeMaster?.DocumentTypeCode || 'All Vouchers',
          currencyCode: resolvedCurrencyCode || 'All Currencies',
          branchInvolved,
          params: params,
        };
      }

      // Calculate outstanding for each transaction
      const transactions: any[] = [];
      let totalOutstandingCurrency = 0;
      let totalOutstandingLocal = 0;
      let cumulativeTotal = openingBalance;
      for (const vt of voucherTransactions) {
        const originalCurrencyAmount = toNumber(vt.Amount);
        let originalLocalAmount = toNumber(vt.LocalAmount);
        const localAmt = toNumber(vt.LocalAmount)
      
        // Sum matched amounts for this transaction
        let matchedCurrencyAmount = 0;
        let matchedLocalAmount = 0;

        if (vt.voucherMatchings && vt.voucherMatchings.length > 0) {
          matchedCurrencyAmount = vt.voucherMatchings.reduce(
            (sum, m) => sum + toNumber(m.Amount),
            0,
          );
          matchedLocalAmount = vt.voucherMatchings.reduce(
            (sum, m) => sum + toNumber(m.LocalAmount),
            0,
          );
        }

        const outstandingCurrencyAmount = roundAmount(
          originalCurrencyAmount - matchedCurrencyAmount,
          2,
        );
        const outstandingLocalAmount = roundAmount(
          originalLocalAmount - matchedLocalAmount,
          2,
        );
        const ledgerType = ledger?.LedgerType?.trim();
        const drCrValue = vt.DrCr?.trim().toUpperCase();

        const drCr = vt.DrCr?.toUpperCase();
        let signedAmount = originalCurrencyAmount;
        if (ledger?.LedgerType?.trim() === 'Sy Cr') {
          if (drCr === 'C') signedAmount = +originalCurrencyAmount;
          if (drCr === 'D') signedAmount = -originalCurrencyAmount;
        } else if (ledger?.LedgerType?.trim() === 'Sy Dr') {
          if (drCr === 'D') signedAmount = +originalCurrencyAmount;
          if (drCr === 'C') signedAmount = -originalCurrencyAmount;
        } else {
          if (drCr === 'D') signedAmount = +originalCurrencyAmount;
          if (drCr === 'C') signedAmount = -originalCurrencyAmount;
        }

        cumulativeTotal += signedAmount;
        cumulativeTotal = roundAmount(cumulativeTotal, 2);

        let sign = 1;
        if (
          (ledgerType === 'Sy Cr' && drCrValue === 'D') ||
          (ledgerType === 'Sy Dr' && drCrValue === 'C')
        ) {
          sign = -1;
        }
        const signedOriginalCurrency = sign * originalCurrencyAmount;
        const signedOutstandingCurrency = sign * outstandingCurrencyAmount;
        const signedLocalAmt = sign * originalLocalAmount;
        const signedoutstandingLocalAmount = sign * outstandingLocalAmount;

        // Calculate exchange rate
        const exchangeRate =
          originalCurrencyAmount !== 0
            ? roundAmount(originalLocalAmount / originalCurrencyAmount, 4)
            : 1.0;

        // Only include if there's outstanding balance

        transactions.push({
          voucherTransactionSid: vt.VoucherTransactionSid,
          voucherHeaderSid: vt.VoucherHeaderSid,
          voucherDetailSid: vt.VoucherDetailSid,
          voucherNumber: vt.VoucherNumber,
          voucherDate: vt.VoucherDate,
          voucherTypeMasterSid: vt.VoucherTypeMasterSid,
          ledgerMasterSid: vt.LedgerMasterSid!,
          coaMasterSid: vt.COAMasterSid!,
          MasterJobNumber: vt.masterJob?.MasterJobNumber,
          HouseJobNumber: vt.houseJob?.HBLNo,
          voucherType: vt.voucherTypeMaster?.DocumentTypeCode,
          originalCurrencyAmount: toNumber(originalCurrencyAmount),
          originalLocalAmount: toNumber(originalLocalAmount),
          matchedCurrencyAmount: toNumber(matchedCurrencyAmount),
          matchedLocalAmount: toNumber(matchedLocalAmount),
          outstandingCurrencyAmount: outstandingCurrencyAmount,
          outstandingLocalAmount: outstandingLocalAmount,
          currencyCode: vt.CurrencyCode || 'USD',
          exchangeRate: toNumber(vt.ExchangeRate || 1),
          drCr: vt.DrCr,
          chargeDescription: vt.ChargeDescription || '',
          deptname:
            vt.departmentMaster?.departmentName &&
            !vt.departmentMaster.departmentName.toLowerCase().includes('air')
              ? vt.departmentMaster.departmentName
              : null,
          salesmanSid:
            userMaster.find((u) => u.UserMasterSid === vt.houseJob?.SalesmanSid)
              ?.userName || '',
          naration: vt.Narration,
          cumulativeOutstanding: cumulativeTotal,
          signedOriginalCurrency: toNumber(signedOriginalCurrency),
          signedOutstandingCurrency: toNumber(signedOutstandingCurrency),
          signedLocalAmt: toNumber(signedLocalAmt),
          signedoutstandingLocalAmount: toNumber(signedoutstandingLocalAmount),
        });

        totalOutstandingCurrency += outstandingCurrencyAmount;
        totalOutstandingLocal += outstandingLocalAmount;
      }

      const response = {
        companyMasterSid: CompanyMasterSid,
        branchMasterSid: branchId,
        branchInvolved,
        ledgerMasterSid: ledgerMasterSid!,
        subledgerName: subledger?.SubledgerName,
        ledgerName: ledger?.LedgerName,
        ledgerType: ledger?.LedgerType,
        totalOutstandingCurrency: roundAmount(totalOutstandingCurrency, 2),
        totalOutstandingLocal: roundAmount(totalOutstandingLocal, 2),
        openingBalance: openingBalance,
        voucherCount: transactions.length,
        transactions: transactions,
        branchNames: resolvedBranchNames.join(', '),
        voucherTypeName: voucherTypeMaster?.DocumentTypeCode || 'All Vouchers',
        currencyCode: resolvedCurrencyCode || 'All Currencies',
        params: params,
      };

      this.logger.log(
        `ledger calculated: ${transactions.length} transactions, Total=${response.totalOutstandingLocal}`,
      );

      return response;
    } catch (error) {
      throw error;
    }
  }

  private async generateBalanceSheet(params: BalanceSheetReportQueryDto) {
    const {
      companyId: CompanyMasterSid,
      FromDate,
      ToDate,
      Branch: branchId,
    } = params;

    try {
      this.logger.log(`Getting Balance Sheet : CompanySid=${CompanyMasterSid}`);

      const branches =
        branchId && branchId.length > 0
          ? await this._db.branchMaster.findMany({
              where: { BranchMasterSid: { in: branchId } },
              select: {
                BranchMasterSid: true,
                branchName: true,
              },
            })
          : await this._db.branchMaster.findMany({
              where: { CompanyMasterSid },
              select: {
                BranchMasterSid: true,
                branchName: true,
              },
            });

      const resolvedBranchIds = branches.map((b) => b.BranchMasterSid);
      const resolvedBranchNames = branches.map((b) => b.branchName);
      const branchInvolved =
        branchId && branchId.length > 0
          ? branches.map((b) => b.branchName).join(', ')
          : 'All Branches';
      const voucherData = await this._db.voucherTransaction.findMany({
        where: {
          CompanyMasterSid,
          BranchMasterSid: { in: resolvedBranchIds },
          VoucherDate: {
            gte: FromDate,
            lte: ToDate,
          },
          Status: 'A',
        },
        include: {
          coaMaster: {
            select: {
              Category: true,
              GroupName: true,
              SubGroupName: true,
              LedgerName: true,
              LedgerType: true,
            },
          },
          yearMaster: true,
        },
      });

      let totalIncome = 0;
      let totalExpense = 0;
      let totalOtherRevenue = 0;
      let totalOtherCost = 0;

      const groupedMap = new Map<string, any>();
      const data: any[] = [];

      const normalizeText = (value?: string | null) =>
        String(value || '').trim().toLowerCase();

      const hasDirectKeyword = (value?: string | null) =>
        /\bdirect\b/.test(normalizeText(value));

      const resolveProfitSection = (
        category?: string | null,
        groupName?: string | null,
        subGroupName?: string | null,
        ledgerName?: string | null,
        ledgerType?: string | null,
      ) => {
        const normalizedLedgerType = normalizeText(ledgerType);

        if (
          category === 'Income' &&
          (hasDirectKeyword(subGroupName) || hasDirectKeyword(ledgerName))
        ) {
          return 'DirectIncome';
        }

        if (
          category === 'Expense' &&
          (hasDirectKeyword(subGroupName) || hasDirectKeyword(ledgerName))
        ) {
          return 'DirectExpense';
        }

        if (normalizedLedgerType.includes('other revenue')) {
          return 'OtherRevenue';
        }

        if (
          normalizedLedgerType.includes('other cost') ||
          normalizedLedgerType.includes('expense')
        ) {
          return 'OtherCost';
        }

        if (category === 'Income') {
          return 'OtherRevenue';
        }

        if (category === 'Expense') {
          return 'OtherCost';
        }

        return 'Unknown';
      };

      voucherData.forEach((v) => {
        if (!v.coaMaster) return;

        const amount = v.LocalAmount.toNumber();
        const drCr = v.DrCr?.trim().toUpperCase();

        const category = v.coaMaster.Category;
        const profitSection = resolveProfitSection(
          category,
          v.coaMaster.GroupName,
          v.coaMaster.SubGroupName,
          v.coaMaster.LedgerName,
          v.coaMaster.LedgerType,
        ); 

        let signedAmount = amount;
        if (category === 'Income') {
          signedAmount = drCr === 'C' ? amount : -amount;
        } else if (category === 'Expense') {
          signedAmount = drCr === 'D' ? amount : -amount;
        } else {
          signedAmount = drCr === 'C' ? amount : drCr === 'D' ? amount * -1 : 0;
        }

        if (category === 'Income') {
          if (profitSection === 'OtherRevenue') {
            totalOtherRevenue += signedAmount;
          } else {
            totalIncome += signedAmount;
          }
          return;
        }

        if (category === 'Expense') {
          if (profitSection === 'OtherCost') {
            totalOtherCost += signedAmount;
          } else {
            totalExpense += signedAmount;
          }
          return;
        }

        if (category === 'Asset' || category === 'Liability') {
          const key = [
            category,
            v.coaMaster.GroupName,
            v.coaMaster.SubGroupName,
            v.coaMaster.LedgerName,
          ].join('|');

          if (!groupedMap.has(key)) {
            groupedMap.set(key, {
              category,
              groupName: v.coaMaster.GroupName,
              subgroupName: v.coaMaster.SubGroupName,
              ledgerName: v.coaMaster.LedgerName,
              LocalAmt: signedAmount,
            });
          } else {
            groupedMap.get(key).LocalAmt += signedAmount;
          }
        }
      });

      data.push(...groupedMap.values());

      const incomeTotal = roundAmount(totalIncome, 2);
      const expenseTotal = roundAmount(totalExpense, 2);
      const otherRevenueTotal = roundAmount(totalOtherRevenue, 2);
      const otherCostTotal = roundAmount(totalOtherCost, 2);
      const grossProfit = roundAmount(incomeTotal - expenseTotal, 2);
      const netProfit = roundAmount(
        grossProfit + otherRevenueTotal - otherCostTotal,
        2,
      );

      return {
        incomeTotal,
        expenseTotal,
        grossProfit,
        otherRevenueTotal,
        otherCostTotal,
        retained: netProfit,
        data,
        CompanyMasterSid,
        BranchMasterSid: branchId,
        branchInvolved,
        params,
        branchNames: resolvedBranchNames.join(', '),
      };
    } catch (error) {
      this.logger.error(
        `Error generating Balance sheet report: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  private async generateVATReceivableReport(params: VATReportQueryDto) {
    const {
      VoucherFromDate: FromDate,
      VoucherToDate: ToDate,
      companyId: CompanyMasterSid,
      coamasterSid,
    } = params;

    try {
      this.logger.log(`Getting VAT Report: CompanySid=${CompanyMasterSid}`);

      // oragnizaton master

      const oragnizatonMaster = await this._db.customerMaster.findMany({
        select: {
          CustomerMasterSid: true,
          CustomerName: true,
          PanType: true,
        },
      });

      /* STEP 1: Customer subledger per voucher */
      const customerSubledger = await this._db.voucherTransaction.findMany({
        where: {
          CompanyMasterSid,
          subledgerMaster: {
            SubledgerType: 'Customer',
          },
        },
        select: {
          VoucherHeaderSid: true,
          subledgerMaster: {
            select: {
              SubledgerName: true,
            },
          },
        },
      });

      const subledgerMap = new Map<number, string>();
      customerSubledger.forEach((v) => {
        if (v.subledgerMaster?.SubledgerName) {
          subledgerMap.set(v.VoucherHeaderSid, v.subledgerMaster.SubledgerName);
        }
      });

      const panTypeMap = new Map<string, string>();

      oragnizatonMaster.forEach((c) => {
        if (c.CustomerName) {
          panTypeMap.set(c.CustomerName.trim(), c.PanType || '');
        }
      });

      /* STEP 2: VAT transactions */
      const voucherData = await this._db.voucherTransaction.findMany({
        where: {
          CompanyMasterSid,
          AND: [
            { VoucherDate: { gte: FromDate } },
            { VoucherDate: { lte: ToDate } },
          ],
          Status: 'A',
          COAMasterSid: coamasterSid,
          voucherTypeMaster: {
            DocumentTypeCode: {
              in: [
                DOC_TYPE_CODE.VENDOR_INVOICE,
                DOC_TYPE_CODE.VENDOR_CREDIT_NOTE,
              ],
            },
          },
        },
        include: {
          VoucherHeader: {
            select: {
              VoucherNumber: true,
              VoucherDate: true,
              VoucherType: true,
              VoucherTypeMasterSid: true,
              DocumentDate: true,
              DocumentNumber: true,
            },
          },
          voucherTypeMaster: {
            select: {
              DocumentTypeCode: true,
              DocumentTypeName: true,
            },
          },
          coaMaster: {
            select: {
              COAMasterSid: true,
              GroupName: true,
              LedgerType: true,
            },
          },
        },
        orderBy: { VoucherDate: 'asc' },
      });

      const inputTax: any[] = [];
      const outputTax: any[] = [];

      voucherData.forEach((v) => {
        const ledgerType = v.coaMaster?.LedgerType;

        const voucherType1 = v.VoucherTypeMasterSid === 2 ? 'Sales' : '';

        const voucherType2 =
          v.VoucherTypeMasterSid === 2 ? 'Purchase' : 'Journal';
        const invoiceTypes = ['VIN', 'VRN'];

        const isVendorInvoice = invoiceTypes.includes(
          v.voucherTypeMaster?.DocumentTypeCode,
        );

        // const isVendorInvoice =
        //   v.voucherTypeMaster?.DocumentTypeCode === 'VIN';

        const documentNo = isVendorInvoice
          ? (v.VoucherHeader?.DocumentNumber ?? '')
          : '';

        const documentDate = isVendorInvoice
          ? (v.VoucherHeader?.DocumentDate ?? null)
          : null;

        const subledgerName = subledgerMap.get(v.VoucherHeaderSid) || '';

        const panType = panTypeMap.get(subledgerName.trim()) || '';

        const row = {
          subledgerName,
          voucherNo: v.VoucherNumber,
          voucherMasterSid: v.VoucherTransactionSid,
          voucherDate: v.VoucherDate,
          coaMasterSid: v.COAMasterSid,
          taxableAmt: v.TaxableAmount,
          taxAmt: v.LocalAmount,
          chargeDescription: v.ChargeDescription,
          ledgerType,
          groupname: v.coaMaster?.GroupName,
          voucherType1,
          voucherType2,
          panType,
          documentNo,
          documentDate,
          vocuherType: v.voucherTypeMaster?.DocumentTypeName,
        };

        if (ledgerType === 'Input Tax') {
          inputTax.push(row);
        }

        if (ledgerType === 'Output Tax') {
          outputTax.push(row);
        }
      });

      return {
        params,
        CompanyMasterSid,
        data: {
          inputTax,
          outputTax,
        },
      };
    } catch (error) {
      throw error;
    }
  }

  private async generateUnpostedVoucherList(
    params: UnpostedVoucherListReportQueryDto,
  ) {
    const {
      VoucherFromDate: FromDate,
      VoucherToDate: ToDate,
      companyId: CompanyMasterSid,
      Branch: branchId,
    } = params;

    try {
      this.logger.log(
        `Getting Unposted Voucher List : companySid=${CompanyMasterSid}`,
      );

      const branches =
        branchId && branchId.length > 0
          ? await this._db.branchMaster.findMany({
              where: { BranchMasterSid: { in: branchId } },
              select: {
                BranchMasterSid: true,
                branchName: true,
              },
            })
          : await this._db.branchMaster.findMany({
              where: { CompanyMasterSid },
              select: {
                BranchMasterSid: true,
                branchName: true,
              },
            });

      const resolvedBranchIds = branches.map((b) => b.BranchMasterSid);
      const resolvedBranchNames = branches.map((b) => b.branchName);
      const brancesInvoled =
        branchId && branchId.length > 0
          ? branches.map((b) => b.branchName).join(', ')
          : 'All Branches';

      const voucherData = await this._db.voucherHeader.findMany({
        where: {
          CompanyMasterSid,
          BranchMasterSid: { in: resolvedBranchIds },
          VoucherDate: {
            gte: FromDate,
            lte: ToDate,
          },
          Status: 'A',
        },
        include: {
          voucherTypeMaster: {
            select: {
              DocumentTypeName: true,
              DocumentTypeCode: true,
            },
          },
        },
        orderBy: [
          { voucherTypeMaster: { DocumentTypeName: 'asc' } },
          { VoucherDate: 'asc' },
        ],
      });

      const data = voucherData
        .filter((v) => v.PostStatus === 'U')

        .map((v) => ({
          VoucherHeaderSid: v.VoucherHeaderSid,
          voucherNo: v.VoucherNumber,
          voucherDate: v.VoucherDate,
          voucherTypeId: v.VoucherTypeMasterSid,
          voucherType: v.voucherTypeMaster?.DocumentTypeName,
          voucherCode: v.voucherTypeMaster?.DocumentTypeCode,
          createdBy: v.CreatedBy,
          createdOn: v.CreatedOn,
          postStatus: v.PostStatus,
          branch:
            branches.find((b) => b.BranchMasterSid === v.BranchMasterSid)
              ?.branchName || '',
          party: v.PartyName,
        }));

      return {
        tableData: data,
        brancesInvoled,
        params,
        CompanyMasterSid,
        branchNames: resolvedBranchNames.join(', '),
      };
    } catch (error) {
      this.logger.error(error);
      throw error;
    }
  }

  private async generateVATPayableReport(params: any) {
    const {
      VoucherFromDate: FromDate,
      VoucherToDate: ToDate,
      companyId: CompanyMasterSid,
      coamasterSid,
    } = params;

    try {
      this.logger.log(`Getting VAT Report: CompanySid=${CompanyMasterSid}`);

      // oragnizaton master

      const oragnizatonMaster = await this._db.customerMaster.findMany({
        select: {
          CustomerMasterSid: true,
          CustomerName: true,
          PanType: true,
        },
      });

      /* STEP 1: Customer subledger per voucher */
      const customerSubledger = await this._db.voucherTransaction.findMany({
        where: {
          CompanyMasterSid,
          subledgerMaster: {
            SubledgerType: 'Customer',
          },
        },
        select: {
          VoucherHeaderSid: true,
          subledgerMaster: {
            select: {
              SubledgerName: true,
            },
          },
        },
      });

      const subledgerMap = new Map<number, string>();
      customerSubledger.forEach((v) => {
        if (v.subledgerMaster?.SubledgerName) {
          subledgerMap.set(v.VoucherHeaderSid, v.subledgerMaster.SubledgerName);
        }
      });

      const panTypeMap = new Map<string, string>();

      oragnizatonMaster.forEach((c) => {
        if (c.CustomerName) {
          panTypeMap.set(c.CustomerName.trim(), c.PanType || '');
        }
      });

      /* STEP 2: VAT transactions */
      const voucherData = await this._db.voucherTransaction.findMany({
        where: {
          CompanyMasterSid,
          AND: [
            { VoucherDate: { gte: FromDate } },
            { VoucherDate: { lte: ToDate } },
          ],
          Status: 'A',
          COAMasterSid: coamasterSid,
          voucherTypeMaster: {
            DocumentTypeCode: {
              in: [
                DOC_TYPE_CODE.INVOICE,
                DOC_TYPE_CODE.JOURNAL_VOUCHER,
                DOC_TYPE_CODE.CREDIT_NOTE,
              ],
            },
          },
        },
        include: {
          VoucherHeader: {
            select: {
              VoucherNumber: true,
              VoucherDate: true,
              VoucherType: true,
              VoucherTypeMasterSid: true,
              DocumentDate: true,
              DocumentNumber: true,
            },
          },
          coaMaster: {
            select: {
              COAMasterSid: true,
              GroupName: true,
              LedgerType: true,
            },
          },
          voucherTypeMaster: {
            select: {
              DocumentTypeName: true,
              DocumentTypeCode: true,
            },
          },
        },
        orderBy: { VoucherDate: 'asc' },
      });

      const inputTax: any[] = [];
      const outputTax: any[] = [];

      voucherData.forEach((v) => {
        const ledgerType = v.coaMaster?.LedgerType;

        const voucherType1 = v.VoucherTypeMasterSid === 1 ? 'Sales' : '';

        const voucherType2 =
          v.VoucherTypeMasterSid === 1 ? 'Purchase' : 'Journal';
        const invoiceTypes = ['INV', 'CRN', 'JV'];

        const isInvoice = invoiceTypes.includes(
          v.voucherTypeMaster?.DocumentTypeCode,
        );

        const documentNo = isInvoice
          ? (v.VoucherHeader?.DocumentNumber ?? '')
          : '';

        const documentDate = isInvoice
          ? (v.VoucherHeader?.DocumentDate ?? null)
          : null;

        const subledgerName = subledgerMap.get(v.VoucherHeaderSid) || '';

        const panType = panTypeMap.get(subledgerName.trim()) || '';

        const row = {
          subledgerName,
          voucherNo: v.VoucherNumber,
          voucherMasterSid: v.VoucherTransactionSid,
          voucherDate: v.VoucherDate,
          coaMasterSid: v.COAMasterSid,
          taxableAmt: v.TaxableAmount,
          taxAmt: v.LocalAmount,
          chargeDescription: v.ChargeDescription,
          vocuherType: v.voucherTypeMaster?.DocumentTypeName,
          ledgerType,
          groupname: v.coaMaster?.GroupName,
          voucherType1,
          voucherType2,
          panType,
          documentNo,
          documentDate,
        };

        if (ledgerType === 'Input Tax') {
          inputTax.push(row);
        }

        if (ledgerType === 'Output Tax') {
          outputTax.push(row);
        }
      });

      return {
        params,
        CompanyMasterSid,
        data: {
          inputTax,
          outputTax,
        },
      };
    } catch (error) {
      throw error;
    }
  }

   private async generateProfitSummaryReport(
    params: ProfitSummaryReportQueryDto,
  ) {
    try {
      const {
        companyId: CompanyMasterSid,
        ToJobDt,
        FromJobDt,
        Branch: branchId,
        Dept: dept,
        WithProrate
      } = params;
      const prorateEnabled =
        WithProrate ??
        (params as any).withProrate ??
        (params as any)['With Pro Rate'] ??
        (params as any).WithProRate ??
        false;

      this.logger.log(
        `Getting Profit Summary Report for CompanySid=${CompanyMasterSid}, From=${FromJobDt}, To=${ToJobDt}`,
      );

      /* ===================== MASTERS ===================== */

      const allBranches = await this.getBranchNames(CompanyMasterSid, branchId);

      const allBranchIds = allBranches.map((b) => b.BranchMasterSid);

      const brancesInvoled =
        branchId && branchId.length > 0
          ? allBranches.map((b) => b.branchName).join(', ')
          : 'All Branches';
      const [departments, customer, user] =
        await Promise.all([
          dept && dept.length > 0
            ? this._db.departmentMaster.findMany({
                where: { DepartmentMasterSid: { in: dept } },
                select: { DepartmentMasterSid: true, departmentName: true },
              })
            : this._db.departmentMaster.findMany({
                where: { CompanyMasterSid },
                select: { DepartmentMasterSid: true, departmentName: true },
              }),
          this._db.customerMaster.findMany({
            select: { CustomerMasterSid: true, CustomerName: true },
          }),
          this._db.userMaster.findMany({
            select: { UserMasterSid: true, userName: true },
          }),
        ]);
      const resolvedDeptIds = departments.map((d) => d.DepartmentMasterSid);
      const profitSummaryMenus = await this._db.menuMaster.findMany({
        where: {
          status: 'A',
          OR: [
            { MenuName: { equals: 'Master Job', mode: 'insensitive' } },
            { MenuName: { contains: 'Master Air Way', mode: 'insensitive' } },
            { MenuName: { equals: 'House Job', mode: 'insensitive' } },
            { MenuName: { contains: 'House Air Way', mode: 'insensitive' } },
            {
              MenuName: {
                contains: 'Agent Master Air Way',
                mode: 'insensitive',
              },
            },
            {
              MenuName: { contains: 'AgentMaster Air Way', mode: 'insensitive' },
            },
          ],
        },
        select: { MenuMasterSid: true, MenuName: true },
      });

      const allMasterMenuSids = profitSummaryMenus
        .filter((m) => {
          const menuName = m.MenuName.toLowerCase();
          return (
            menuName === 'master job' || menuName.includes('master air way')
          );
        })
        .map((m) => m.MenuMasterSid);

      const allHouseMenuSids = profitSummaryMenus
        .filter((m) => {
          const menuName = m.MenuName.toLowerCase();
          return (
            menuName === 'house job' ||
            menuName.includes('house air way') ||
            menuName.includes('agent master air way') ||
            menuName.includes('agentmaster air way')
          );
        })
        .map((m) => m.MenuMasterSid);

      if (!allMasterMenuSids.length || !allHouseMenuSids.length) {
        throw new BadRequestException('Menu not found');
      }

      /* ===================== MASTER JOBS ===================== */

      const masterJob = await this._db.masterJob.findMany({
        where: {
          CompanyMasterSid,
          BranchMasterSid: { in: allBranchIds },
          AND: [{ MBLDate: { gte: FromJobDt } }, { MBLDate: { lte: ToJobDt } }],
          Status: 'A',
          DepartmentMasterSid: { in: resolvedDeptIds },
        },
        include: {
          voyages: {
            select: {
              ETA: true,
              ETD: true,
              ATA: true,
              ATD: true,
            },
          },
          houseJob: {
            where: { status: 'A' },
            include: {
              Cargo: true,
            },
          },
        },
        orderBy: { MBLDate: 'asc' },
      });

      if (!masterJob.length) {
        return {
          companyMasterSid: CompanyMasterSid,
          branchMasterSid: branchId,
          data: [],
        };
      }

      // ================= COST REVENUE LOAD =================

      // Collect all MasterJob and HouseJob IDs
      const masterJobIds = masterJob.map((mj) => mj.MasterJobSid);
      const houseJobIds = masterJob.flatMap((mj) =>
        mj.houseJob.map((hj) => hj.HouseJobSid),
      );

      const allMasterCR = await this._db.costRevenueCharges.findMany({
        where: {
          status: 'A',
          MenuMasterSid: { in: allMasterMenuSids },
          TransactionSid: { in: masterJobIds },
        },
        select: {
          TransactionSid: true,
          MenuMasterSid: true,
          CostRevenueChargesSid: true,
          RevenueVoucherHeaderSid: true,
          RevenueDrCr: true,
          RevenueLocalAmount: true,
          CostVoucherHeaderSid: true,
          CostDrCr: true,
          CostLocalAmount: true,
        },
      });

      // Create Maps for quick lookup
      const masterCRMap = new Map<number, any[]>();
      const houseCRMap = new Map<number, any[]>();
      const masterMenuSet = new Set(allMasterMenuSids);

      allMasterCR.forEach((cr) => {
        const key = cr.TransactionSid!;
        if (masterMenuSet.has(cr.MenuMasterSid!)) {
          if (!masterCRMap.has(key)) masterCRMap.set(key, []);
          masterCRMap.get(key)!.push(cr);
        }
      });

      const houseJobMenu = await this._db.menuMaster.findFirst({
        where: { MenuName: 'House Job', status: 'A' },
        select: { MenuMasterSid: true },
      });

      if (!houseJobMenu) {
        throw new BadRequestException('House Job menu not found');
      }

      const allHouseCR = await this._db.costRevenueCharges.findMany({
        where: {
          status: 'A',
          MenuMasterSid: houseJobMenu.MenuMasterSid,
          TransactionSid: { in: houseJobIds },
        },
        select: {
          TransactionSid: true,
          MenuMasterSid: true,
          CostRevenueChargesSid: true,
          RevenueVoucherHeaderSid: true,
          RevenueDrCr: true,
          RevenueLocalAmount: true,
          CostVoucherHeaderSid: true,
          CostDrCr: true,
          CostLocalAmount: true,
        },
      });

      allHouseCR.forEach((cr) => {
        const key = cr.TransactionSid!;
        if (!houseCRMap.has(key)) {
          houseCRMap.set(key, []);
        }
        houseCRMap.get(key)!.push(cr);
      });

      const houseProrateMap = new Map<
        number,
        { totalRevenue: number; totalCost: number; count: number }
      >();

      if (prorateEnabled && masterJobIds.length > 0) {
        const jobToSubjobMasters = await this._db.masterJobOthers.findMany({
          where: {
            MasterJobSid: { in: masterJobIds },
            Status: 'A',
            JobtoSubjob: 'Y',
          },
          select: {
            MasterJobSid: true,
          },
        });

        const masterJobMap = new Map(
          masterJob.map((mj) => [mj.MasterJobSid, mj]),
        );

        for (const { MasterJobSid } of jobToSubjobMasters) {
          const selectedMaster = masterJobMap.get(MasterJobSid);

          if (!selectedMaster?.CompanyMasterSid || !selectedMaster?.BranchMasterSid) {
            continue;
          }

          const proRateData = await this.proRateService.calculateProRate({
            CompanyMasterSid: selectedMaster.CompanyMasterSid,
            BranchMasterSid: selectedMaster.BranchMasterSid,
            MasterJobSid,
          });

          for (const proratedHouse of proRateData.houses || []) {
            const houseJobSid = proratedHouse.houseJob?.HouseJobSid;

            if (!houseJobSid) {
              continue;
            }

            for (const charge of proratedHouse.proratedCharges || []) {
              const current = houseProrateMap.get(houseJobSid) || {
                totalRevenue: 0,
                totalCost: 0,
                count: 0,
              };
              current.totalRevenue += Number(charge.revenueLocalAmount || 0);
              current.totalCost += Number(charge.costLocalAmount || 0);
              current.count += 1;
              houseProrateMap.set(houseJobSid, current);
            }
          }
        }
      }

      const getDepartmentName = (deptId: number) =>
        departments.find((d) => d.DepartmentMasterSid === deptId)
          ?.departmentName || '';

      const getActualsFromCharges = async (charges: any[]) => {
        const actuals = await Promise.all(
          charges
            .filter((cr) => cr.CostRevenueChargesSid)
            .map((cr) =>
              this.voucherService.getActualAmountForCostRevenue(
                cr.CostRevenueChargesSid,
              ),
            ),
        );

        return actuals.reduce(
          (sum, item) => {
            sum.aSale += Number(item.ActualRevenue || 0);
            sum.aCost += Number(item.ActualCost || 0);
            return sum;
          },
          { aSale: 0, aCost: 0 },
        );
      };

      const calculateProfitMetrics = (totalSales: number, totalCost: number) => {
        let profit = 0;
        let profitPercent = 0;

        if (totalSales > totalCost) {
          profit = totalSales - totalCost;
          profitPercent = totalSales !== 0 ? (profit / totalSales) * 100 : 0;
        } else {
          profit = -(totalCost - totalSales);
          profitPercent = totalCost !== 0 ? (profit / totalCost) * 100 : 0;
        }

        return { profit, profitPercent };
      };

      /* ===================== FINAL DATA ===================== */

      const data = await Promise.all(
        masterJob.map(async (mj) => {
        const masterCR = masterCRMap.get(mj.MasterJobSid) || [];

          const linkedRev = masterCR.filter((cr) => cr.RevenueVoucherHeaderSid);
          const linkedCost = masterCR.filter((cr) => cr.CostVoucherHeaderSid);

          const calc = (arr: any[], type: 'R' | 'C') =>
            arr.reduce((sum, cr) => {
              if (type === 'R') {
                return cr.RevenueDrCr === 'C'
                  ? sum + Number(cr.RevenueLocalAmount || 0)
                  : sum - Number(cr.RevenueLocalAmount || 0);
              }
              return cr.CostDrCr === 'D'
                ? sum + Number(cr.CostLocalAmount || 0)
                : sum - Number(cr.CostLocalAmount || 0);
            }, 0);

          const pSale = calc(masterCR, 'R');
          const pCost = calc(masterCR, 'C');
          const masterActuals = await getActualsFromCharges(masterCR);
          const aSale = masterActuals.aSale;
          const aCost = masterActuals.aCost;

          const houseWithCR = await Promise.all(
            mj.houseJob.map(async (hj) => {
             const houseCR = houseCRMap.get(hj.HouseJobSid) || [];
              const houseProrate = houseProrateMap.get(hj.HouseJobSid) || {
                totalRevenue: 0,
                totalCost: 0,
                count: 0,
              };

              const linkedRevH = houseCR.filter(
                (cr) => cr.RevenueVoucherHeaderSid,
              );
              const linkedCostH = houseCR.filter(
                (cr) => cr.CostVoucherHeaderSid,
              );

              const hpSale = calc(houseCR, 'R') + houseProrate.totalRevenue;
              const hpCost = calc(houseCR, 'C') + houseProrate.totalCost;
              const houseActuals = await getActualsFromCharges(houseCR);
              const haSale = houseActuals.aSale;
              const haCost = houseActuals.aCost;
              const housePlannedProfit = calculateProfitMetrics(hpSale, hpCost);
              const houseActualProfit = calculateProfitMetrics(haSale, haCost);

              return {
                HouseJobSid: hj.HouseJobSid,
                HBLNo: hj.HBLNo,
                houseStatus: hj.HouseStatus,
                jobType: hj.JobType,
                customerName: customer.find(
                  (d) => d.CustomerMasterSid === hj.CustomerMasterSid,
                )?.CustomerName,
                OriginAgent: hj.AgentName,
                DestinationAgent: customer.find(
                  (d) => d.CustomerMasterSid === hj.DestinationAgent,
                )?.CustomerName,
                ModeOfTransport: mj.houseJob
                    ?.flatMap(h => h.Cargo ?? [])
                    .map(c => c?.ModeOfTransport)
                    .filter(Boolean)
                    .join(', ') || '',
                salesPerson: user.find(
                  (u) => u.UserMasterSid === hj.SalesmanSid,
                )?.userName,
                PPCC: hj.FreightTerms,
                POO: hj.POO,
                FPD: hj.FPD,
                costRevenues: {
                  totalNoOfCostRevenues: houseCR.length + houseProrate.count,
                  linkedRevenueRecords: linkedRevH.map(
                    (cr) => cr.CostRevenueChargesSid,
                  ),
                  linkedCostRecords: linkedCostH.map(
                    (cr) => cr.CostRevenueChargesSid,
                  ),
                  houseCrSummary: {
                    pSale: hpSale,
                    pCost: hpCost,
                    pGp: housePlannedProfit.profit,
                    pGpPercent: housePlannedProfit.profitPercent,
                    aSale: haSale,
                    aCost: haCost,
                    aGp: houseActualProfit.profit,
                    aGpPercent: houseActualProfit.profitPercent,
                  },
                },
              };
            }),
          );

          const masterPlannedProfit = calculateProfitMetrics(pSale, pCost);
          const masterActualProfit = calculateProfitMetrics(aSale, aCost);

          return {
            JobNo: mj.MasterJobNumber,
            MBLNo: mj.MBLNo,
            MBLDate: mj.MBLDate,
            OriginAgent:
              customer.find((o) => o.CustomerMasterSid === mj.OriginAgent)
                ?.CustomerName || '',
            DestinationAgent:
              customer.find((d) => d.CustomerMasterSid === mj.DestinationAgent)
                ?.CustomerName || '',
            customerName:
              customer.find(
                (c) =>
                  c.CustomerMasterSid === mj.houseJob?.[0]?.CustomerMasterSid,
              )?.CustomerName || '',
            jobType: mj.houseJob?.[0]?.JobType,
            houseNo: mj.houseJob?.[0]?.HouseNo,
            HBLNo: mj.houseJob?.[0]?.HBLNo,
            houseStatus: mj.houseJob?.[0]?.HouseStatus,
            ModeOfTransport: mj.houseJob?.[0]?.Cargo?.[0]?.ModeOfTransport,
            PPCC: mj.houseJob?.[0]?.FreightTerms,
            salesPerson:
              user.find(
                (u) => u.UserMasterSid === mj.houseJob?.[0]?.SalesmanSid,
              )?.userName || '',
            POO: mj.POO,
            POL: mj.POL,
            POD: mj.POD,
            FPD: mj.FPD,
            ETA: mj.voyages[0]?.ETA,
            ETD: mj.voyages[0]?.ETD,
            ATA: mj.voyages[0]?.ATA,
            ATD: mj.voyages[0]?.ATD,
            deptName: getDepartmentName(mj.DepartmentMasterSid),
            costRevenues: {
              totalNoOfCostRevenues: masterCR.length,
              linkedRevenueRecords: linkedRev.map(
                (cr) => cr.CostRevenueChargesSid,
              ),
              linkedCostRecords: linkedCost.map(
                (cr) => cr.CostRevenueChargesSid,
              ),
              masterCrSummary: {
                pSale,
                pCost,
                pGp: masterPlannedProfit.profit,
                pGpPercent: masterPlannedProfit.profitPercent,
                aSale,
                aCost,
                aGp: masterActualProfit.profit,
                aGpPercent: masterActualProfit.profitPercent,
              },
            },
            houseWithCR,
          };
        }),
      );

      return {
        companyMasterSid: CompanyMasterSid,
        branchMasterSid: branchId,
        BranchInvolved: allBranches.map((b) => b.branchName).join(', '),
        brancesInvoled,
        DeptNames: departments.map((d) => d.departmentName).join(', '),
        data,
        params,
      };
    } catch (error) {
      throw error;
    }
  }

  private async generateMatchingListReport(params: any) {
    const {
      FromDate: fromDate,
      ToDate: toDate,
      companyId: CompanyMasterSid,
      Subledger: ledgerMasterSid,
      Ledger: coaMasterSid,
      branch: branchId,
    } = params;

    try {
      this.logger.log(
        `Getting matching list report: CompanySid=${CompanyMasterSid}, From=${fromDate}, To=${toDate}`,
      );

      const branches =
        branchId && branchId.length > 0
          ? await this._db.branchMaster.findMany({
              where: { BranchMasterSid: { in: branchId } },
              select: {
                BranchMasterSid: true,
                branchName: true,
              },
            })
          : await this._db.branchMaster.findMany({
              where: { CompanyMasterSid },
              select: {
                BranchMasterSid: true,
                branchName: true,
              },
            });

      const resolvedBranchIds = branches.map((b) => b.BranchMasterSid);
      const resolvedBranchNames = branches.map((b) => b.branchName);
      const branchInvolved =
        branchId && branchId.length > 0
          ? branches.map((b) => b.branchName).join(', ')
          : 'All Branches';

      const subledgerMaster = await this._db.subledgerMaster.findUnique({
        where: { SubledgerMasterSid: ledgerMasterSid },
      });

      const ledger = await this._db.cOAMaster.findUnique({
        where: { COAMasterSid: coaMasterSid },
      });
      const matchingList = await this._db.voucherMatching.findMany({
        where: {
          CompanyMasterSid,
          BranchMasterSid: { in: resolvedBranchIds },
          VoucherMatchingDate: {
            gte: new Date(fromDate),
            lte: new Date(toDate),
          },
          Status: 'A',
          COAMasterSid: coaMasterSid,
          LedgerMasterSid: ledgerMasterSid,
        },
        include: {
          VoucherTransaction: {
            select: {
              VoucherDate: true,
              VoucherNumber: true,
              VoucherType: true,
            },
          },
          header: {
            select: {
              VoucherMatchingNo: true,
            },
          },
          VoucherHeader: {
            select: {
              VoucherDate: true,
              VoucherNumber: true,
              VoucherType: true,
              PostStatus: true,
              voucherTypeMaster: {
                select: {
                  DocumentTypeName: true,
                  DocumentTypeCode: true,
                },
              },
            },
          },
        },
        orderBy: {
          VoucherMatchingDate: 'asc',
        },
      });

      const data = matchingList.map((v) => ({
        VoucherHeaderSid: v.VoucherHeaderSid,
        VoucherNumber: v.VoucherTransaction?.VoucherNumber,
        VoucherDate: v.VoucherTransaction?.VoucherDate,
        VoucherType: v.VoucherTransaction?.VoucherType,
        VoucherName: v.VoucherHeader?.voucherTypeMaster?.DocumentTypeName,
        VoucherCode: v.VoucherHeader?.voucherTypeMaster?.DocumentTypeCode,
        VoucherMatchingSid: v.VoucherMatchingSid,
        VoucherMatchingHeaderSid: v?.VoucherMatchingHeaderSid,
        VoucherMatchingDate: v?.VoucherMatchingDate,
        VoucherMactingNo: v.header?.VoucherMatchingNo,
        DrCr:v.DrCr,
        CurrencyCode: v.CurrencyCode,
        Amount: v.Amount,
        LocalAmount: v.LocalAmount,
        MatchingType: v?.MatchingType,
        ExRate : v.ExchangeRate
      }));

      return {
        data,
        params,
        branchInvolved,
        ledgerMasterSid: subledgerMaster?.SubledgerName,
        coaMasterSid: ledger?.LedgerName,
      };
    } catch {
      throw error;
    }
  }

  private async generateTopNCustomerReport(params: TopNCustomerReportQueryDto) {
    const {
      FromDate,
      ToDate,
      companyId: CompanyMasterSid,
      Branch: branchId,
      Dept: deptId,
      TopN: topN,
      CalculationType,
      Volume,
      Gp,
    } = params;

    try {
      this.logger.log(`Getting top N Customer: CompanySid=${CompanyMasterSid}`);

      const branches =
        branchId && branchId.length > 0
          ? await this._db.branchMaster.findMany({
              where: { BranchMasterSid: { in: branchId } },
              select: {
                BranchMasterSid: true,
                branchName: true,
              },
            })
          : await this._db.branchMaster.findMany({
              where: { CompanyMasterSid },
              select: {
                BranchMasterSid: true,
                branchName: true,
              },
            });

      const resolvedBranchIds = branches.map((b) => b.BranchMasterSid);
      const resolvedBranchNames = branches.map((b) => b.branchName);
      const branchInvolved =
        branchId && branchId.length > 0
          ? branches.map((b) => b.branchName).join(', ')
          : 'All Branches';
      const excludedDepartments = ['Air Export', 'Air Import'];
      const departments =
        deptId && deptId.length > 0
          ? await this._db.departmentMaster.findMany({
              where: {
                DepartmentMasterSid: { in: deptId },
                departmentName: { notIn: excludedDepartments },
              },
              select: { DepartmentMasterSid: true, departmentName: true },
            })
          : await this._db.departmentMaster.findMany({
              where: {
                CompanyMasterSid,
                departmentName: { notIn: excludedDepartments },
              },
              select: { DepartmentMasterSid: true, departmentName: true },
            });

      const resolvedDeptIds = departments.map((d) => d.DepartmentMasterSid);
      const resolvedDeptNames = departments.map((d) => d.departmentName);
      const departmentInvoled =
        deptId && deptId.length > 0
          ? departments.map((d) => d.departmentName).join(', ')
          : 'All Departments';
      const customerMaster = await this._db.customerMaster.findMany({
        select: { CustomerMasterSid: true, CustomerName: true },
      });

      const masterJobs = await this._db.masterJob.findMany({
        where: {
          CompanyMasterSid,
          AND: [{ MBLDate: { gte: FromDate } }, { MBLDate: { lte: ToDate } }],
          Status: 'A',
          BranchMasterSid: { in: resolvedBranchIds },
          DepartmentMasterSid: { in: resolvedDeptIds },
        },
        include: {
          houseJob: {
            where: { status: 'A' },
          },
        },
        orderBy: { MBLDate: 'asc' },
      });

      if (!masterJobs.length) {
        return {
          companyMasterSid: CompanyMasterSid,
          branchMasterSid: branchId,
          data: [],
        };
      }

      let data = await Promise.all(
        masterJobs.map(async (job) => {
          const relatedCR = await this._db.costRevenueCharges.findMany({
            where: {
              MenuMasterSid: job.MenuMasterSid!,
              TransactionSid: job.MasterJobSid,
              status: 'A',
            },
            select: {
              CostLocalAmount: true,
              RevenueLocalAmount: true,
              RevenueCustomerMasterSid: true,
              CostDrCr: true,
              RevenueDrCr: true,
            },
          });

          const customerWiseMap = new Map<
            number,
            { cost: number; revenue: number }
          >();

          const addToCustomerMap = (
            customerSid: number,
            cost: number,
            revenue: number,
          ) => {
            if (!customerWiseMap.has(customerSid)) {
              customerWiseMap.set(customerSid, { cost: 0, revenue: 0 });
            }
            const existing = customerWiseMap.get(customerSid)!;
            existing.cost += cost;
            existing.revenue += revenue;
          };

          let totalCost = 0;
          let totalRevenue = 0;

          relatedCR.forEach((cr) => {
            const customerSid = cr.RevenueCustomerMasterSid;
            if (!customerSid) return;

            const cost =
              cr.CostDrCr === 'D'
                ? Number(cr.CostLocalAmount ?? 0)
                : -Number(cr.CostLocalAmount ?? 0);

            const revenue =
              cr.RevenueDrCr === 'C'
                ? Number(cr.RevenueLocalAmount ?? 0)
                : -Number(cr.RevenueLocalAmount ?? 0);

            totalCost += cost;
            totalRevenue += revenue;

            addToCustomerMap(customerSid, cost, revenue);
          });

          const houseJobs = job.houseJob || [];
          const houseJobIds = houseJobs.map((h) => h.HouseJobSid);

          const houseJobMenu = await this._db.menuMaster.findFirst({
            where: { MenuName: 'House Job' },
            select: { MenuMasterSid: true },
          });

          if (!houseJobMenu) {
            throw new BadRequestException('House Job not found in MenuMaster');
          }

          const allHouseCR = await this._db.costRevenueCharges.findMany({
            where: {
              MenuMasterSid: houseJobMenu.MenuMasterSid,
              TransactionSid: { in: houseJobIds },
              status: 'A',
            },
            select: {
              TransactionSid: true,
              CostLocalAmount: true,
              RevenueLocalAmount: true,
              RevenueCustomerMasterSid: true,
              CostDrCr: true,
              RevenueDrCr: true,
            },
          });

          const houseRateMap = new Map<number, any[]>();

          allHouseCR.forEach((cr) => {
            const key = cr.TransactionSid!;
            if (!houseRateMap.has(key)) {
              houseRateMap.set(key, []);
            }
            houseRateMap.get(key)!.push(cr);
          });

          let totalHouseCost = 0;
          let totalHouseRevenue = 0;

          const houseJobsData = houseJobs.map((house) => {
            const costRevenues = houseRateMap.get(house.HouseJobSid) || [];

            let houseCost = 0;
            let houseRevenue = 0;

            costRevenues.forEach((cr) => {
              const customerSid = cr.RevenueCustomerMasterSid;
              if (!customerSid) return;

              const cost =
                cr.CostDrCr === 'D'
                  ? Number(cr.CostLocalAmount ?? 0)
                  : -Number(cr.CostLocalAmount ?? 0);

              const revenue =
                cr.RevenueDrCr === 'C'
                  ? Number(cr.RevenueLocalAmount ?? 0)
                  : -Number(cr.RevenueLocalAmount ?? 0);

              houseCost += cost;
              houseRevenue += revenue;
              addToCustomerMap(customerSid, cost, revenue);
            });

            totalHouseCost += houseCost;
            totalHouseRevenue += houseRevenue;

            return {
              HouseJobSid: house.HouseJobSid,
              HouseNo: house.HouseNo,
              HBLNo: house.HBLNo,
              totalCost: houseCost,
              totalRevenue: houseRevenue,
            };
          });

          const totalCostWithHouse = totalCost + totalHouseCost;
          const totalRevenueWithHouse = totalRevenue + totalHouseRevenue;
          const GP = totalRevenueWithHouse - totalCostWithHouse;
          const customerSummary = Array.from(customerWiseMap.entries()).map(
            ([customerSid, val]) => ({
              customerSid,
              customerName:
                customerMaster.find((c) => c.CustomerMasterSid === customerSid)
                  ?.CustomerName || '',
              totalCost: val.cost,
              totalRevenue: val.revenue,
              GP: val.revenue - val.cost,
            }),
          );

          return {
            MasterJobSid: job?.MasterJobSid,
            MBLNo: job?.MBLNo,
            HBLNo: job?.houseJob?.[0]?.HBLNo,
            chargeable: job?.ChargeableWeight ?? 0,
            netwt: job?.NetWeight,
            Weight: job?.GrossWeight,
            Vol: job?.Volume ?? 0,
            noOfShipment: houseJobs.length,
            GP,
            totalCost,
            totalRevenue,
            totalCostWithHouse,
            totalRevenueWithHouse,
            customerSummary,
            houseJobs: houseJobsData,
          };
        }),
      );

      /* ================= CUSTOMER FINAL MERGE ================= */
      const customerFinalMap = new Map<
        number,
        {
          customerSid: number;
          customerName: string;
          totalCost: number;
          totalRevenue: number;
          GP: number;
          chargeable: number;
          netwt: number;
          Weight: number;
          Vol: number;
          noOfShipment: number;
        }
      >();

      data.forEach((job) => {
        job.customerSummary.forEach((cust) => {
          if (!customerFinalMap.has(cust.customerSid)) {
            customerFinalMap.set(cust.customerSid, {
              customerSid: cust.customerSid,
              customerName: cust.customerName,
              totalCost: 0,
              totalRevenue: 0,
              GP: 0,
              chargeable: 0,
              netwt: 0,
              Weight: 0,
              Vol: 0,
              noOfShipment: 0,
            });
          }

          const existing = customerFinalMap.get(cust.customerSid)!;

          existing.totalCost += cust.totalCost;
          existing.totalRevenue += cust.totalRevenue;
          existing.GP += cust.GP;

          /* 🔥 CUSTOMER-WISE SUM FROM MASTER JOB */
          existing.chargeable += Number(job.chargeable ?? 0);
          existing.netwt += Number(job.netwt ?? 0);
          existing.Weight += Number(job.Weight ?? 0);
          existing.Vol += Number(job.Vol ?? 0);
          existing.noOfShipment += Number(job.noOfShipment ?? 0);
        });
      });

      /* FINAL CUSTOMER DATA */
      const finalCustomerData = Array.from(customerFinalMap.values());

      /* ================= APPLY TOP N ON CUSTOMER DATA ================= */
      let customerData = finalCustomerData;

      const calculationType = params.CalculationType?.toUpperCase();

      switch (calculationType) {
        case 'GP':
          customerData.sort((a, b) => b.GP - a.GP);
          break;

        case 'VOLUME':
          customerData.sort((a, b) => b.Vol - a.Vol);
          break;

        default:
          // fallback to GP
          customerData.sort((a, b) => b.GP - a.GP);
      }

      const limit = Number(topN) || customerData.length;
      customerData = customerData.slice(0, limit);

      return {
        companyMasterSid: CompanyMasterSid,
        branchMasterSid: branchId,
        branchInvolved,
        departmentInvoled,
        data: customerData,
        branchNames: resolvedBranchNames.join(', '),
        departmentNames: resolvedDeptNames.join(', '),
        params,
        topN,
      };
    } catch (error) {
      this.logger.error(
        `Error getting Top N Customer for ${CompanyMasterSid}: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  private getVatSummaryDefaultOutputRows() {
    return [
      { code: '1a', description: 'Standard rated supplies in Abu Dhabi', amount: 0, vatAmount: 0, adjustment: 0 },
      { code: '1b', description: 'Standard rated supplies in Dubai', amount: 0, vatAmount: 0, adjustment: 0 },
      { code: '1c', description: 'Standard rated supplies in Sharjah', amount: 0, vatAmount: 0, adjustment: 0 },
      { code: '1d', description: 'Standard rated supplies in Ajman', amount: 0, vatAmount: 0, adjustment: 0 },
      { code: '1e', description: 'Standard rated supplies in Umm Al Quwain', amount: 0, vatAmount: 0, adjustment: 0 },
      { code: '1f', description: 'Standard rated supplies in Ras Al Khaimah', amount: 0, vatAmount: 0, adjustment: 0 },
      { code: '1g', description: 'Standard rated supplies in Fujairah', amount: 0, vatAmount: 0, adjustment: 0 },
      { code: '2', description: 'Tax refunds provided to tourists under the Tax Refunds for Tourists Scheme', amount: 0, vatAmount: 0, adjustment: 0 },
      { code: '3', description: 'Supplies subject to the reverse charge provisions', amount: 0, vatAmount: 0, adjustment: 0 },
      { code: '4', description: 'Zero rated supplies', amount: 0, vatAmount: 0, adjustment: 0 },
      { code: '5', description: 'Exempt supplies', amount: 0, vatAmount: 0, adjustment: 0 },
      { code: '6', description: 'Goods imported into the UAE', amount: 0, vatAmount: 0, adjustment: 0 },
      { code: '7', description: 'Adjustments to goods imported into the UAE', amount: 0, vatAmount: 0, adjustment: 0 },
    ];
  }

  private getVatSummaryDefaultInputRows() {
    return [
      { code: '9', description: 'Standard rated expenses', amount: 0, vatAmount: 0, adjustment: 0 },
      { code: '10', description: 'Supplies subject to the reverse charge provisions', amount: 0, vatAmount: 0, adjustment: 0 },
    ];
  }

  private addVatSummaryAmount(
    row: { amount: number; vatAmount: number; adjustment: number } | undefined,
    taxableAmount: number,
    vatAmount: number,
  ) {
    if (!row) {
      return;
    }

    row.amount += taxableAmount;
    row.vatAmount += vatAmount;
  }

  private normaliseVatText(value: any): string {
    return String(value ?? '').trim().toUpperCase();
  }

  private isReverseChargeVat(header: any, detail?: any): boolean {
    const values = [
      header?.GSTType,
      header?.InvoiceType,
      header?.TaxType,
      detail?.InvoiceType,
    ]
      .map((value) => this.normaliseVatText(value))
      .join(' ');

    return values.includes('RCM') || values.includes('REVERSE');
  }

  private getVatSummaryOutputCode(header: any, detail?: any): string | null {
    const values = [
      header?.InvoiceType,
      header?.GSTType,
      header?.TaxType,
      detail?.InvoiceType,
    ]
      .map((value) => this.normaliseVatText(value))
      .join(' ');

    if (values.includes('OOS') || values.includes('OUT OF SCOPE')) {
      return null;
    }

    if (this.isReverseChargeVat(header, detail)) {
      return '3';
    }

    if (
      values.includes('EXEMPT') ||
      values.includes('EXE')
    ) {
      return '5';
    }

    if (
      values.includes('ZERO') ||
      values.includes('EXPORT') ||
      values.includes('NONGST') ||
      values.includes('NON GST')
    ) {
      return '4';
    }

    return this.getVatSummaryEmirateCode(
      header?.PlaceOfSupply ||
        header?.State ||
        header?.customerBranch?.stateMaster?.stateName,
    );
  }

  private getVatSummaryEmirateCode(value: any): string {
    const emirate = String(value ?? '')
      .trim()
      .toLowerCase()
      .replace(/[^a-z]/g, '');

    if (emirate.includes('abudhabi')) return '1a';
    if (emirate.includes('dubai')) return '1b';
    if (emirate.includes('sharjah')) return '1c';
    if (emirate.includes('ajman')) return '1d';
    if (emirate.includes('ummalquwain') || emirate.includes('ummalqaiwain')) return '1e';
    if (emirate.includes('rasalkhaimah')) return '1f';
    if (emirate.includes('fujairah')) return '1g';

    return '1b';
  }

  private getVatSummaryTaxSign(documentTypeCode: any, taxType: any, drCr: any): number {
    const code = this.normaliseVatText(documentTypeCode);
    const ledgerTaxType = this.normaliseVatText(taxType);
    const debitCredit = this.normaliseVatText(drCr);

    if (code === DOC_TYPE_CODE.CREDIT_NOTE || code === DOC_TYPE_CODE.VENDOR_CREDIT_NOTE) {
      return -1;
    }

    if (code === DOC_TYPE_CODE.JOURNAL_VOUCHER || code === DOC_TYPE_CODE.REVERSAL_JOURNAL_VOUCHER) {
      if (ledgerTaxType === 'OUTPUT') {
        return debitCredit === 'D' ? -1 : 1;
      }

      if (ledgerTaxType === 'INPUT') {
        return debitCredit === 'C' ? -1 : 1;
      }
    }

    return 1;
  }

  private async generateVatSummaryReport(params: any) {
    const {
      companyId: CompanyMasterSid,
      VoucherFromDate,
      VoucherToDate,
      FromDate,
      ToDate,
    } = params;

    const fromDate = VoucherFromDate || FromDate;
    const toDate = VoucherToDate || ToDate;

    if (!CompanyMasterSid) {
      throw new BadRequestException('companyId is required');
    }

    if (!fromDate || !toDate) {
      throw new BadRequestException('VoucherFromDate and VoucherToDate are required');
    }

    const selectedBranches = [
      ...(Array.isArray(params.Branch) ? params.Branch : params.Branch ? [params.Branch] : []),
      ...(Array.isArray(params.BranchMasterSid)
        ? params.BranchMasterSid
        : params.BranchMasterSid
          ? [params.BranchMasterSid]
          : []),
      ...(params.branchId ? [params.branchId] : []),
    ]
      .map((branch) => Number(branch))
      .filter((branch) => Number.isFinite(branch) && branch > 0);

    const branches = await this._db.branchMaster.findMany({
      where: {
        CompanyMasterSid,
        status: 'A',
        ...(selectedBranches.length
          ? { BranchMasterSid: { in: selectedBranches } }
          : {}),
      },
      select: {
        BranchMasterSid: true,
        branchName: true,
        taxRegistrationNo: true,
        addressLine1: true,
        addressLine2: true,
        postalCode: true,
        email: true,
        phoneNumber: true,
        cityMaster: { select: { cityName: true } },
        stateMaster: { select: { stateName: true } },
        countryMaster: { select: { countryName: true } },
      },
    });

    const branchIds = branches.map((branch) => branch.BranchMasterSid);

    if (!branchIds.length) {
      throw new BadRequestException('No active branch found for VAT Summary Report');
    }

    const company = await this._db.companyMaster.findFirst({
      where: {
        CompanyMasterSid,
        status: 'A',
      },
      select: {
        companyName: true,
        addressLine1: true,
        addressLine2: true,
        postal_code: true,
        email: true,
        phoneNumber: true,
        Pan: true,
        cityMaster: { select: { cityName: true } },
        stateMaster: { select: { stateName: true } },
        countryMaster: { select: { countryName: true } },
      },
    });

    const outputRows = this.getVatSummaryDefaultOutputRows();
    const inputRows = this.getVatSummaryDefaultInputRows();
    const outputRowMap = new Map(outputRows.map((row) => [row.code, row]));
    const inputRowMap = new Map(inputRows.map((row) => [row.code, row]));

    const voucherHeaderWhere = {
      CompanyMasterSid,
      BranchMasterSid: { in: branchIds },
      VoucherDate: {
        gte: new Date(fromDate),
        lte: new Date(toDate),
      },
      Status: 'A',
      PostStatus: 'P',
      voucherTypeMaster: {
        DocumentTypeCode: {
          in: [
            DOC_TYPE_CODE.INVOICE,
            DOC_TYPE_CODE.VENDOR_INVOICE,
            DOC_TYPE_CODE.CREDIT_NOTE,
            DOC_TYPE_CODE.VENDOR_CREDIT_NOTE,
            DOC_TYPE_CODE.JOURNAL_VOUCHER,
            DOC_TYPE_CODE.REVERSAL_JOURNAL_VOUCHER,
          ],
        },
      },
    };

    const taxDetails = await this._db.voucherDetail.findMany({
      where: {
        Status: 'A',
        CompanyMasterSid,
        BranchMasterSid: { in: branchIds },
        subledgerMaster: {
          SubledgerType: 'Tax',
        },
        VoucherHeader: voucherHeaderWhere,
      },
      select: {
        DrCr: true,
        TaxableAmount: true,
        LocalAmount: true,
        InvoiceType: true,
        subledgerMaster: {
          select: {
            TaxType: true,
            SubledgerName: true,
          },
        },
        VoucherHeader: {
          select: {
            GSTType: true,
            InvoiceType: true,
            TaxType: true,
            PlaceOfSupply: true,
            State: true,
            voucherTypeMaster: {
              select: {
                DocumentTypeCode: true,
              },
            },
            customerBranch: {
              select: {
                stateMaster: { select: { stateName: true } },
              },
            },
          },
        },
      },
    });

    for (const detail of taxDetails) {
      const header = detail.VoucherHeader;
      const documentTypeCode = header?.voucherTypeMaster?.DocumentTypeCode;
      const taxType = detail.subledgerMaster?.TaxType;
      const sign = this.getVatSummaryTaxSign(documentTypeCode, taxType, detail.DrCr);
      const taxableAmount = roundAmount(toNumber(detail.TaxableAmount) * sign, 2);
      const vatAmount = roundAmount(toNumber(detail.LocalAmount) * sign, 2);

      if (this.normaliseVatText(taxType) === 'INPUT') {
        const inputCode = this.isReverseChargeVat(header, detail) ? '10' : '9';
        this.addVatSummaryAmount(inputRowMap.get(inputCode), taxableAmount, vatAmount);
        continue;
      }

      if (this.normaliseVatText(taxType) === 'OUTPUT') {
        const outputCode = this.getVatSummaryOutputCode(header, detail);
        if (outputCode && outputRowMap.has(outputCode)) {
          this.addVatSummaryAmount(outputRowMap.get(outputCode), taxableAmount, vatAmount);
        }
      }
    }

    const nonTaxOutputDetails = await this._db.voucherDetail.findMany({
      where: {
        Status: 'A',
        CompanyMasterSid,
        BranchMasterSid: { in: branchIds },
        VoucherHeader: {
          ...voucherHeaderWhere,
          voucherTypeMaster: {
            DocumentTypeCode: {
              in: [DOC_TYPE_CODE.INVOICE, DOC_TYPE_CODE.CREDIT_NOTE],
            },
          },
        },
      },
      select: {
        DrCr: true,
        TaxableAmount: true,
        Amount: true,
        LocalAmount: true,
        TaxAmount1: true,
        TaxAmount2: true,
        InvoiceType: true,
        subledgerMaster: {
          select: {
            SubledgerType: true,
          },
        },
        VoucherHeader: {
          select: {
            GSTType: true,
            InvoiceType: true,
            TaxType: true,
            PlaceOfSupply: true,
            State: true,
            voucherTypeMaster: {
              select: {
                DocumentTypeCode: true,
              },
            },
            customerBranch: {
              select: {
                stateMaster: { select: { stateName: true } },
              },
            },
          },
        },
      },
    });

    for (const detail of nonTaxOutputDetails) {
      if (this.normaliseVatText(detail.subledgerMaster?.SubledgerType) === 'TAX') {
        continue;
      }

      const outputCode = this.getVatSummaryOutputCode(detail.VoucherHeader, detail);
      if (outputCode !== '4' && outputCode !== '5') {
        continue;
      }

      const sign = this.getVatSummaryTaxSign(
        detail.VoucherHeader?.voucherTypeMaster?.DocumentTypeCode,
        'Output',
        detail.DrCr,
      );
      const taxableAmount = roundAmount(toNumber(detail.TaxableAmount || detail.LocalAmount || detail.Amount) * sign, 2);
      const vatAmount = roundAmount((toNumber(detail.TaxAmount1) + toNumber(detail.TaxAmount2)) * sign, 2);
      this.addVatSummaryAmount(outputRowMap.get(outputCode), taxableAmount, vatAmount);
    }

    for (const row of [...outputRows, ...inputRows]) {
      row.amount = roundAmount(row.amount, 2);
      row.vatAmount = roundAmount(row.vatAmount, 2);
      row.adjustment = roundAmount(row.adjustment, 2);
    }

    const outputTotal = {
      amount: roundAmount(outputRows.reduce((sum, row) => sum + row.amount, 0), 2),
      vatAmount: roundAmount(outputRows.reduce((sum, row) => sum + row.vatAmount, 0), 2),
      adjustment: roundAmount(outputRows.reduce((sum, row) => sum + row.adjustment, 0), 2),
    };

    const inputTotal = {
      amount: roundAmount(inputRows.reduce((sum, row) => sum + row.amount, 0), 2),
      vatAmount: roundAmount(inputRows.reduce((sum, row) => sum + row.vatAmount, 0), 2),
      adjustment: roundAmount(inputRows.reduce((sum, row) => sum + row.adjustment, 0), 2),
    };

    const primaryBranch = branches[0];
    const branchNames = branches.map((branch) => branch.branchName).join(', ');
    const addressParts = [
      primaryBranch?.addressLine1 || company?.addressLine1,
      primaryBranch?.addressLine2 || company?.addressLine2,
      primaryBranch?.cityMaster?.cityName || company?.cityMaster?.cityName,
      primaryBranch?.stateMaster?.stateName || company?.stateMaster?.stateName,
      primaryBranch?.countryMaster?.countryName || company?.countryMaster?.countryName,
      primaryBranch?.postalCode || company?.postal_code,
    ].filter(Boolean);

    return {
      params,
      company: {
        companyName: company?.companyName || '',
        nameEnglish: company?.companyName || '',
        nameArabic: '',
        trn: primaryBranch?.taxRegistrationNo || company?.Pan || '',
        address: addressParts.join(', '),
        email: primaryBranch?.email || company?.email || '',
        phoneNumber: primaryBranch?.phoneNumber || company?.phoneNumber || '',
      },
      branch: {
        branchIds,
        branchNames,
      },
      period: {
        fromDate,
        toDate,
        taxYearEnd: params.TaxYearEnd || '',
        dueDate: params.VatReturnDueDate || '',
        referenceNumber: params.VatReturnReferenceNumber || '',
      },
      outputRows,
      inputRows,
      summary: {
        outputTotal,
        inputTotal,
        totalDueTax: outputTotal.vatAmount,
        totalRecoverableTax: inputTotal.vatAmount,
        netVatDue: roundAmount(outputTotal.vatAmount - inputTotal.vatAmount, 2),
        refundRequested: '',
      },
      additionalReporting: {
        profitMarginScheme: 'No',
      },
      declaration: {
        nameEnglish: '',
        designation: '',
        authorizedSignatory: '',
      },
    };
  }

  private async vat201(param: any) {
    let {
      companyId: CompanyId,
      Branch: BranchId,
      FromDate: fromDate,
      ToDate: toDate,
    } = param;
    try {
      /* -------------------- BRANCH NAME (SELECTED / ALL) -------------------- */
      let branchName = 'All Branches';

      if (Array.isArray(BranchId) && BranchId.length > 0) {
        const branches = await this._db.branchMaster.findMany({
          where: {
            BranchMasterSid: { in: BranchId },
            CompanyMasterSid: CompanyId,
            status: 'A',
          },
          select: {
            branchName: true,
          },
        });

        branchName =
          branches && branches.length > 1
            ? branches.map((b) => b.branchName).join(', ')
            : branches[0].branchName;
      } else {
        const branches = await this._db.branchMaster.findMany({
          where: {
            CompanyMasterSid: CompanyId,
            status: 'A',
          },
          select: {
            BranchMasterSid: true,
            branchName: true,
          },
        });
        BranchId = branches.map((b) => b.BranchMasterSid);
      }

      const baseHeaderWhere = {
        CompanyMasterSid: CompanyId,
        ...(BranchId ? { BranchMasterSid: { in: BranchId } } : {}),
        VoucherDate: {
          gte: fromDate,
          lte: toDate,
        },
        voucherTypeMaster: {
          DocumentTypeCode: {
            in: [
              DOC_TYPE_CODE.INVOICE,
              DOC_TYPE_CODE.VENDOR_INVOICE,
              DOC_TYPE_CODE.CREDIT_NOTE,
              DOC_TYPE_CODE.VENDOR_CREDIT_NOTE,
            ],
          },
        },
        PostStatus: {
          in: ['P', 'U'],
        },
        Status: 'A',
      };

      // Summary counts

      const totalVouchers = await this._db.voucherHeader.count({
        where: baseHeaderWhere,
      });

      const vouchersWithTaxLedger = await this._db.voucherHeader.count({
        where: {
          ...baseHeaderWhere,
          VoucherDetail: {
            some: {
              subledgerMaster: {
                SubledgerType: 'Tax',
              },
            },
          },
        },
      });

      const vouchersWithoutTaxLedger = totalVouchers - vouchersWithTaxLedger;

      // Ledger summary type (clean output)

      type LedgerSummary = {
        COAMasterSid: number;
        LedgerName: string;
        TaxableAmount: number;
        TaxAmount: number;
        details: any[];
      };

      // Aggregation helper – handles null safety & grouping

      const aggregateByLedger = (
        details: Array<{
          subledgerMaster: {
            SubledgerMasterSid: number | null;
            SubledgerName: string | null;
          } | null;
          TaxableAmount?: any | null;
          // TaxPercentage1: Decimal | null,
          // TaxAmount1?: any | null;
          // TaxPercentage2: Decimal | null,
          // TaxAmount2?: any | null;
          Amount: Decimal | null;
          LocalAmount: Decimal | null;
          VoucherHeader?: {
            customerBranch?: {
              customerMaster?: {
                countryMaster?: { countryCode: string | null } | null;
              } | null;
            } | null;
          } | null;
        }>,
      ): { local: LedgerSummary[]; overseas: LedgerSummary[] } => {
        const localMap = new Map<number, LedgerSummary>();
        const overseasMap = new Map<number, LedgerSummary>();

        for (const detail of details) {
          const sid = detail.subledgerMaster?.SubledgerMasterSid;
          if (sid == null) continue;

          const ledgerName =
            detail.subledgerMaster?.SubledgerName ?? 'Unknown Tax Ledger';

          const countryCode =
            detail.VoucherHeader?.customerBranch?.customerMaster?.countryMaster
              ?.countryCode ?? 'UNKNOWN';

          const isLocal = ['AE', 'SA', 'QA', 'OM', 'KW'].includes(countryCode);

          const targetMap = isLocal ? localMap : overseasMap;

          const taxableAmount = toNumber(detail.TaxableAmount);
          const taxAmount = toNumber(detail.LocalAmount);

          if (targetMap.has(sid)) {
            const entry = targetMap.get(sid)!;
            entry.TaxableAmount += taxableAmount;
            entry.TaxAmount += taxAmount;
            entry.details = [...entry.details, detail];
          } else {
            targetMap.set(sid, {
              COAMasterSid: sid,
              LedgerName: ledgerName,
              TaxableAmount: taxableAmount,
              TaxAmount: taxAmount,
              details: [detail],
            });
          }
        }

        return {
          local: Array.from(localMap.values()),
          overseas: Array.from(overseasMap.values()),
        };
      };

      // INPUT TAX – Purchases / Input VAT

      const inputTaxDetails = await this._db.voucherDetail.findMany({
        where: {
          Status: 'A',
          subledgerMaster: {
            SubledgerType: 'Tax',
            TaxType: 'Input',
          },
          VoucherHeader: baseHeaderWhere,
        },
        select: {
          TaxableAmount: true,
          Amount: true,
          LocalAmount: true,
          // TaxPercentage1: true,
          // TaxAmount1: true,
          // TaxPercentage2: true,
          // TaxAmount2: true,
          subledgerMaster: {
            select: {
              SubledgerMasterSid: true,
              SubledgerName: true,
            },
          },
          VoucherHeader: {
            select: {
              VoucherNumber: true,
              customerBranch: {
                select: {
                  customerMaster: {
                    select: {
                      countryMaster: {
                        select: {
                          countryCode: true,
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      });

      const inputTax = aggregateByLedger(inputTaxDetails);

      // OUTPUT TAX – Sales / Output VAT (also classified local/overseas)

      const outputTaxDetails = await this._db.voucherDetail.findMany({
        where: {
          Status: 'A',
          subledgerMaster: {
            SubledgerType: 'Tax',
            TaxType: 'Output',
          },
          VoucherHeader: baseHeaderWhere,
        },
        select: {
          TaxableAmount: true,
          // TaxPercentage1: true,
          // TaxAmount1: true,
          // TaxPercentage2: true,
          // TaxAmount2: true,
          Amount: true,
          LocalAmount: true,
          subledgerMaster: {
            select: {
              SubledgerMasterSid: true,
              SubledgerName: true,
            },
          },
          VoucherHeader: {
            select: {
              customerBranch: {
                select: {
                  customerMaster: {
                    select: {
                      countryMaster: {
                        select: {
                          countryCode: true,
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      });

      const outputTax = aggregateByLedger(outputTaxDetails);

      // Unposted Voucher

      const unpostedVoucher = await this._db.voucherHeader.count({
        where: {
          CompanyMasterSid: CompanyId,
          BranchMasterSid: { in: BranchId },
          Status: 'A',
          VoucherDate: {
            gte: fromDate,
            lte: toDate,
          },
          PostStatus: 'U',
          voucherTypeMaster: {
            DocumentTypeCode: {
              in: [
                DOC_TYPE_CODE.INVOICE,
                DOC_TYPE_CODE.VENDOR_INVOICE,
                DOC_TYPE_CODE.CREDIT_NOTE,
                DOC_TYPE_CODE.VENDOR_CREDIT_NOTE,
              ],
            },
          },
        },
      });

      // Payment Details

      const totalPayment = await this._db.voucherHeader.count({
        where: {
          Status: 'A',
          CompanyMasterSid: CompanyId,
          ...(BranchId ? { BranchMasterSid: { in: BranchId } } : {}),
          VoucherDate: {
            gte: fromDate,
            lte: toDate,
          },
          PostStatus: {
            in: ['P', 'U'],
          },
          voucherTypeMaster: {
            DocumentTypeCode: DOC_TYPE_CODE.PAYMENT,
          },
        },
      });

      const totalPaymentVoucher = await this._db.voucherHeader.count({
        where: {
          Status: 'A',
          CompanyMasterSid: CompanyId,
          ...(BranchId ? { BranchMasterSid: { in: BranchId } } : {}),
          VoucherDate: {
            gte: fromDate,
            lte: toDate,
          },
          PostStatus:{
            in:['P' , 'U']
          },
          voucherTypeMaster: {
            DocumentTypeCode: DOC_TYPE_CODE.PAYMENT,
          },
          VoucherDetail: {
            some: {
              subledgerMaster: {
                SubledgerType: 'Tax',
              },
            },
          },
        },
      });

      const totalWithoutPayment = totalPayment - totalPaymentVoucher;

      return {
        summary: {
          totalVouchers,
          vouchersWithTaxLedger,
          vouchersWithoutTaxLedger,
          unpostedVoucher,
        },
        param,
        BranchName: branchName,
        inputTax,
        outputTax,
        payment: {
          totalPayment,
          totalPaymentVoucher,
          totalWithoutPayment,
        },
      };
    } catch (error) {
      console.error('VAT 201 report generation failed:', error);
      throw error;
    }
  }

  private async gernerateCashFlow(params: any) {
    try {
      const { companyId: CompanyMasterSid, FromDate, ToDate, Branch: branchId } =
        params;

      const currentFromDate = new Date(FromDate);
      const currentToDate = new Date(ToDate);
      const previousFromDate = new Date(currentFromDate);
      previousFromDate.setFullYear(previousFromDate.getFullYear() - 1);
      const previousToDate = new Date(currentToDate);
      previousToDate.setFullYear(previousToDate.getFullYear() - 1);

      const toNumberValue = (value: any): number => {
        const num = Number(value ?? 0);
        return isNaN(num) ? 0 : num;
      };

      const round = (value: number, decimals = 2): number => {
        return Number(toNumberValue(value).toFixed(decimals));
      };

      const normalizeText = (value?: string | null) =>
        String(value ?? '')
          .trim()
          .toLowerCase();

      const includesAny = (value: string, keywords: string[]) =>
        keywords.some((keyword) => value.includes(keyword));

      const formatYearLabel = (date: Date) => {
        const year = date.getFullYear();
        const financialYearStart = date.getMonth() >= 3 ? year : year - 1;
        return `${financialYearStart} - ${String((financialYearStart + 1) % 100).padStart(2, '0')}`;
      };

      const formatLongDate = (date: Date) =>
        date.toLocaleDateString('en-GB', {
          day: '2-digit',
          month: 'long',
          year: 'numeric',
        });

      const formatPeriodLabel = (from: Date, to: Date) =>
        `For the Period : ${formatLongDate(from)} to ${formatLongDate(to)}`;

      const toTitleCase = (value?: string | null) =>
        String(value || '')
          .toLowerCase()
          .replace(/\b\w/g, (char) => char.toUpperCase());

      const yearKeys = [formatYearLabel(currentToDate), formatYearLabel(previousToDate)];

      const resolvedBranchIds =
        Array.isArray(branchId) && branchId.length
          ? branchId.map((id: number | string) => Number(id)).filter(Boolean)
          : [];

      const buildEmptyReport = () => ({
        data: {
          operatingActivities: [],
          investingActivities: [],
          financingActivities: [],
          netChangeInCashAndCashEquivalents: [],
          cashReconciliation: [],
          supplementalIncomeExpenseSummary: [],
          workingCapitalBreakup: {
            receivables: [],
            otherCurrentAssets: [],
            currentLiabilities: [],
          },
          cashAndCashEquivalents: [],
          fixedAssetsBreakup: [],
          financingBreakup: [],
          profitBreakup: {
            incomeTotal: 0,
            expenseTotal: 0,
            depreciation: 0,
            netProfit: 0,
          },
        },
        summary: {
          netProfit: 0,
          depreciation: 0,
          receivablesChange: 0,
          otherCurrentAssetsChange: 0,
          currentLiabilitiesChange: 0,
          netCashFromOperatingActivities: 0,
          netCashFromInvestingActivities: 0,
          netCashFromFinancingActivities: 0,
          netIncreaseInCashAndCashEquivalents: 0,
          openingCashAndCashEquivalents: 0,
          closingCashAndCashEquivalents: 0,
          changeInCashAndCashEquivalents: 0,
          isReconciled: true,
        },
      });

      const ledgers = await this._db.cOAMaster.findMany({
        where: {
          CompanyMasterSid,
          Status: 'A',
          LedgerCategory: 'Ledger',
        },
        select: {
          COAMasterSid: true,
          LedgerCode: true,
          LedgerName: true,
          Category: true,
          GroupName: true,
          SubGroupName: true,
          LedgerType: true,
        },
      });

      if (!ledgers.length) {
        const emptyReport = buildEmptyReport();
        return {
          params,
          method: 'Indirect',
          source: 'Trial Balance Based',
          reportTitle: 'Cash Flow Statement',
          currencyLabel: 'Currency: AED | Method: Indirect',
          yearKeys,
          reportSubTitle: formatPeriodLabel(currentFromDate, currentToDate),
          ...emptyReport,
        };
      }

      const maxToDate = currentToDate > previousToDate ? currentToDate : previousToDate;

      const transactions = await this._db.voucherTransaction.findMany({
        where: {
          CompanyMasterSid,
          Status: 'A',
          VoucherDate: {
            lte: maxToDate,
          },
          ...(resolvedBranchIds.length
            ? { BranchMasterSid: { in: resolvedBranchIds } }
            : {}),
        },
        select: {
          COAMasterSid: true,
          VoucherDate: true,
          DrCr: true,
          LocalAmount: true,
        },
        orderBy: { VoucherDate: 'asc' },
      });

      const transactionMap = new Map<number, typeof transactions>();

      for (const txn of transactions) {
        if (txn.COAMasterSid == null) continue;

        if (!transactionMap.has(txn.COAMasterSid)) {
          transactionMap.set(txn.COAMasterSid, []);
        }

        transactionMap.get(txn.COAMasterSid)!.push(txn);
      }

      const isIncomeLedger = (ledger: any) => {
        const category = normalizeText(ledger.Category);
        const group = normalizeText(ledger.GroupName);
        const subGroup = normalizeText(ledger.SubGroupName);
        const name = normalizeText(ledger.LedgerName);

        return (
          includesAny(category, ['income', 'revenue']) ||
          includesAny(group, ['income', 'revenue']) ||
          includesAny(subGroup, ['income', 'revenue']) ||
          includesAny(name, ['income', 'sales', 'revenue'])
        );
      };

      const isExpenseLedger = (ledger: any) => {
        const category = normalizeText(ledger.Category);
        const group = normalizeText(ledger.GroupName);
        const subGroup = normalizeText(ledger.SubGroupName);
        const name = normalizeText(ledger.LedgerName);

        return (
          includesAny(category, ['expense', 'expenses']) ||
          includesAny(group, ['expense', 'expenses']) ||
          includesAny(subGroup, ['expense', 'expenses']) ||
          includesAny(name, ['expense', 'charges', 'cost'])
        );
      };

      const isReceivableLedger = (ledger: any) => {
        const group = normalizeText(ledger.GroupName);
        const subGroup = normalizeText(ledger.SubGroupName);
        const name = normalizeText(ledger.LedgerName);

        return (
          !includesAny(group, ['tax receivable']) &&
          !includesAny(subGroup, ['tax receivable']) &&
          !includesAny(name, ['vat receivable', 'tax receivable']) &&
          (
            includesAny(group, ['debtor', 'receivable']) ||
            includesAny(subGroup, ['debtor', 'receivable']) ||
            includesAny(name, ['debtor', 'receivable'])
          )
        );
      };

      const isCashAndBankLedger = (ledger: any) => {
        const category = normalizeText(ledger.Category);
        const group = normalizeText(ledger.GroupName);
        const subGroup = normalizeText(ledger.SubGroupName);
        const name = normalizeText(ledger.LedgerName);
        const type = normalizeText(ledger.LedgerType);

        if (includesAny(name, ['bank charges'])) {
          return false;
        }

        return (
          includesAny(name, ['petty cash']) ||
          (
            includesAny(category, ['current asset']) &&
            (
              includesAny(group, ['cash', 'bank']) ||
              includesAny(subGroup, ['cash', 'bank']) ||
              includesAny(name, ['bank']) ||
              includesAny(type, ['cash', 'bank'])
            )
          )
        );
      };

      const isOtherCurrentAssetLedger = (ledger: any) => {
        const category = normalizeText(ledger.Category);
        const group = normalizeText(ledger.GroupName);
        const subGroup = normalizeText(ledger.SubGroupName);
        const name = normalizeText(ledger.LedgerName);

        return (
          (
            includesAny(category, ['current asset']) &&
            !isReceivableLedger(ledger) &&
            !isCashAndBankLedger(ledger)
          ) ||
          includesAny(group, ['other assets', 'prepayments']) ||
          includesAny(group, ['tax receivable', 'prepaid', 'advance', 'deposit']) ||
          includesAny(subGroup, ['tax receivable', 'prepaid', 'advance', 'deposit']) ||
          includesAny(name, [
            'vat receivable',
            'tax receivable',
            'prepaid',
            'advance',
            'deposit',
            'cash account',
            'employee receivable',
          ])
        );
      };

      const isCurrentLiabilityLedger = (ledger: any) => {
        const category = normalizeText(ledger.Category);
        const group = normalizeText(ledger.GroupName);
        const subGroup = normalizeText(ledger.SubGroupName);
        const name = normalizeText(ledger.LedgerName);

        if (includesAny(name, ['vat receivable', 'tax receivable'])) {
          return false;
        }

        return (
          includesAny(category, ['current liability']) ||
          includesAny(group, ['creditor', 'payable', 'tax', 'accrued', 'outstanding']) ||
          includesAny(subGroup, ['creditor', 'payable', 'tax', 'accrued', 'outstanding']) ||
          includesAny(name, ['creditor', 'payable', 'vat payable', 'accrued', 'outstanding'])
        );
      };

      const isDepreciationLedger = (ledger: any) => {
        const name = normalizeText(ledger.LedgerName);
        const subGroup = normalizeText(ledger.SubGroupName);
        return (
          includesAny(name, ['depreciation', 'amortization']) ||
          includesAny(subGroup, ['depreciation', 'amortization'])
        );
      };

      const isFixedAssetLedger = (ledger: any) => {
        const category = normalizeText(ledger.Category);
        const group = normalizeText(ledger.GroupName);
        const subGroup = normalizeText(ledger.SubGroupName);
        const name = normalizeText(ledger.LedgerName);

        return (
          (
            includesAny(category, ['non current asset', 'fixed asset']) ||
            includesAny(group, ['fixed asset', 'property plant', 'equipment']) ||
            includesAny(subGroup, ['fixed asset', 'property plant', 'equipment']) ||
            includesAny(name, [
              'vehicle',
              'furniture',
              'equipment',
              'computer',
              'building',
              'office equipment',
              'fixed asset',
            ])
          ) && !includesAny(name, ['depreciation', 'accumulated depreciation'])
        );
      };

      const isFinancingLedger = (ledger: any) => {
        const category = normalizeText(ledger.Category);
        const group = normalizeText(ledger.GroupName);
        const subGroup = normalizeText(ledger.SubGroupName);
        const name = normalizeText(ledger.LedgerName);

        return (
          includesAny(category, ['equity', 'liability']) &&
          (
            includesAny(group, ['loan', 'capital', 'borrowing', 'drawing', 'dividend']) ||
            includesAny(subGroup, ['loan', 'capital', 'borrowing', 'drawing', 'dividend']) ||
            includesAny(name, ['loan', 'capital', 'borrowing', 'drawing', 'dividend'])
          )
        );
      };

      const buildPeriodReport = (periodFrom: Date, periodTo: Date) => {
        const createStatementRow = (
          label: string,
          amount: number | null,
          rowType: 'detail' | 'summary' | 'section' = 'detail',
        ) =>
          rowType === 'section'
            ? {
                label,
                amount: '',
                rowType,
              }
            : {
                label,
                amount: amount == null ? null : round(amount),
                rowType,
              };

        const formatIncreaseDecreaseLabel = (
          positiveLabel: string,
          negativeLabel: string,
          amount: number,
        ) => (amount >= 0 ? positiveLabel : negativeLabel);

        const formatPurchaseLabel = (ledgerName?: string | null) =>
          `Purchase of ${toTitleCase(ledgerName).replace(/\s+/g, ' ').trim()}`;

        const formatOpeningCashLabel = (ledgerName?: string | null) =>
          `Opening Cash - ${String(ledgerName || '').trim()}`;

        const formatClosingCashLabel = (ledgerName?: string | null) =>
          `Closing Cash - ${String(ledgerName || '').trim()}`;

        const formatFinancingLabel = (ledgerName?: string | null) => {
          const normalized = normalizeText(ledgerName);
          if (normalized.includes('capital')) return 'Capital Contribution by Owner';
          if (normalized.includes('drawing')) return 'Drawings by Owner';
          if (normalized.includes('loan')) return `Loan Movement - ${ledgerName}`;
          return toTitleCase(ledgerName || 'Financing Movement');
        };

        const ledgerBalances = ledgers.map((ledger) => {
          const ledgerTransactions = transactionMap.get(ledger.COAMasterSid) ?? [];

          let openingDebit = 0;
          let openingCredit = 0;
          let currentDebit = 0;
          let currentCredit = 0;

          for (const txn of ledgerTransactions) {
            const voucherDate = new Date(txn.VoucherDate);
            const amount = toNumberValue(txn.LocalAmount);

            if (voucherDate < periodFrom) {
              if (txn.DrCr === 'D') {
                openingDebit += amount;
              } else if (txn.DrCr === 'C') {
                openingCredit += amount;
              }
            } else if (voucherDate >= periodFrom && voucherDate <= periodTo) {
              if (txn.DrCr === 'D') {
                currentDebit += amount;
              } else if (txn.DrCr === 'C') {
                currentCredit += amount;
              }
            }
          }

          const closingDebit = openingDebit + currentDebit;
          const closingCredit = openingCredit + currentCredit;

          return {
            ...ledger,
            OpeningDebit: round(openingDebit),
            OpeningCredit: round(openingCredit),
            CurrentDebit: round(currentDebit),
            CurrentCredit: round(currentCredit),
            ClosingDebit: round(closingDebit),
            ClosingCredit: round(closingCredit),
          };
        });

        const getOpeningBalance = (ledger: any) => {
          const category = normalizeText(ledger.Category);

          if (includesAny(category, ['income', 'liability', 'equity', 'capital'])) {
            return round(ledger.OpeningCredit - ledger.OpeningDebit);
          }

          return round(ledger.OpeningDebit - ledger.OpeningCredit);
        };

        const getClosingBalance = (ledger: any) => {
          const category = normalizeText(ledger.Category);

          if (includesAny(category, ['income', 'liability', 'equity', 'capital'])) {
            return round(ledger.ClosingCredit - ledger.ClosingDebit);
          }

          return round(ledger.ClosingDebit - ledger.ClosingCredit);
        };

        const createBreakupRows = (items: any[]) =>
          items.map((ledger) => {
            const openingBalance = getOpeningBalance(ledger);
            const closingBalance = getClosingBalance(ledger);
            const change = round(closingBalance - openingBalance);

            return {
              COAMasterSid: ledger.COAMasterSid,
              LedgerCode: ledger.LedgerCode,
              LedgerName: ledger.LedgerName,
              Category: ledger.Category,
              GroupName: ledger.GroupName,
              SubGroupName: ledger.SubGroupName,
              LedgerType: ledger.LedgerType,
              OpeningDebit: ledger.OpeningDebit,
              OpeningCredit: ledger.OpeningCredit,
              CurrentDebit: ledger.CurrentDebit,
              CurrentCredit: ledger.CurrentCredit,
              ClosingDebit: ledger.ClosingDebit,
              ClosingCredit: ledger.ClosingCredit,
              OpeningBalance: openingBalance,
              ClosingBalance: closingBalance,
              Change: change,
            };
          });

        const incomeLedgers = ledgerBalances.filter(isIncomeLedger);
        const expenseLedgers = ledgerBalances.filter(isExpenseLedger);
        const receivableLedgers = ledgerBalances.filter(isReceivableLedger);
        const otherCurrentAssetLedgers = ledgerBalances.filter(isOtherCurrentAssetLedger);
        const currentLiabilityLedgers = ledgerBalances.filter(isCurrentLiabilityLedger);
        const cashAndBankLedgers = ledgerBalances.filter(isCashAndBankLedger);
        const depreciationLedgers = ledgerBalances.filter(isDepreciationLedger);
        const fixedAssetLedgers = ledgerBalances.filter(isFixedAssetLedger);
        const financingLedgers = ledgerBalances.filter(isFinancingLedger);

        const incomeTotal = round(
          incomeLedgers.reduce((sum, ledger) => sum + (ledger.CurrentCredit - ledger.CurrentDebit), 0),
        );

        const expenseTotal = round(
          expenseLedgers.reduce((sum, ledger) => sum + (ledger.CurrentDebit - ledger.CurrentCredit), 0),
        );

        const depreciation = round(
          depreciationLedgers.reduce((sum, ledger) => sum + (ledger.CurrentDebit - ledger.CurrentCredit), 0),
        );

        const netProfit = round(incomeTotal - expenseTotal);

        const receivablesBreakup = createBreakupRows(receivableLedgers);
        const otherCurrentAssetsBreakup = createBreakupRows(otherCurrentAssetLedgers);
        const currentLiabilitiesBreakup = createBreakupRows(currentLiabilityLedgers);
        const cashAndCashEquivalentsBreakup = createBreakupRows(cashAndBankLedgers);
        const fixedAssetsBreakup = createBreakupRows(fixedAssetLedgers);
        const financingBreakup = createBreakupRows(financingLedgers);

        const receivablesChange = round(receivablesBreakup.reduce((sum, row) => sum + row.Change, 0));
        const otherCurrentAssetsChange = round(otherCurrentAssetsBreakup.reduce((sum, row) => sum + row.Change, 0));
        const currentLiabilitiesChange = round(currentLiabilitiesBreakup.reduce((sum, row) => sum + row.Change, 0));
        const openingCashAndCashEquivalents = round(cashAndCashEquivalentsBreakup.reduce((sum, row) => sum + row.OpeningBalance, 0));
        const closingCashAndCashEquivalents = round(cashAndCashEquivalentsBreakup.reduce((sum, row) => sum + row.ClosingBalance, 0));
        const fixedAssetChange = round(fixedAssetsBreakup.reduce((sum, row) => sum + row.Change, 0));
        const netCashFromInvestingActivities = round(-fixedAssetChange);
        const financingChange = round(financingBreakup.reduce((sum, row) => sum + row.Change, 0));
        const netCashFromFinancingActivities = round(financingChange);
        const operatingBeforeAdjustment = round(
          netProfit +
            depreciation -
            receivablesChange -
            otherCurrentAssetsChange +
            currentLiabilitiesChange,
        );
        const reconciliationAdjustment = round(
          (closingCashAndCashEquivalents - openingCashAndCashEquivalents) -
            (operatingBeforeAdjustment +
              netCashFromInvestingActivities +
              netCashFromFinancingActivities),
        );
        const netCashFromOperatingActivities = round(
          operatingBeforeAdjustment + reconciliationAdjustment,
        );
        const netIncreaseInCashAndCashEquivalents = round(
          netCashFromOperatingActivities + netCashFromInvestingActivities + netCashFromFinancingActivities,
        );
        const changeInCashAndCashEquivalents = round(
          closingCashAndCashEquivalents - openingCashAndCashEquivalents,
        );

        const workingCapitalRows = [
          createStatementRow(
            '(Increase) / Decrease in Trade Receivables',
            round(-receivablesChange),
          ),
          ...otherCurrentAssetsBreakup
            .filter((row) => row.Change !== 0)
            .map((row) =>
              createStatementRow(
                formatIncreaseDecreaseLabel(
                  `Increase in ${toTitleCase(row.LedgerName)}`,
                  `Decrease in ${toTitleCase(row.LedgerName)}`,
                  row.Change,
                ),
                round(-row.Change),
              ),
            ),
          ...currentLiabilitiesBreakup
            .filter((row) => row.Change !== 0 || row.LedgerName)
            .map((row) =>
              createStatementRow(
                formatIncreaseDecreaseLabel(
                  `Increase / (Decrease) in ${toTitleCase(row.LedgerName)}`,
                  `Decrease / (Increase) in ${toTitleCase(row.LedgerName)}`,
                  row.Change,
                ),
                round(row.Change),
              ),
            ),
        ];

        const workingCapitalAdjustmentTotal = round(
          workingCapitalRows.reduce(
            (sum, row) => sum + Number(row.amount || 0),
            0,
          ) +
            reconciliationAdjustment,
        );

        const investingRows = fixedAssetsBreakup
          .filter((row) => round(row.CurrentDebit - row.CurrentCredit) !== 0)
          .map((row) =>
            createStatementRow(
              formatPurchaseLabel(row.LedgerName),
              round(-(row.CurrentDebit - row.CurrentCredit)),
            ),
          );

        const financingRows = financingBreakup
          .filter((row) => round(row.Change) !== 0)
          .map((row) =>
            createStatementRow(
              formatFinancingLabel(row.LedgerName),
              round(row.Change),
            ),
          );

        const directIncomeSummary = incomeLedgers
          .filter((ledger) => normalizeText(ledger.SubGroupName).includes('direct'))
          .map((ledger) =>
            createStatementRow(
              toTitleCase(ledger.LedgerName),
              round(ledger.CurrentCredit - ledger.CurrentDebit),
            ),
          )
          .filter((row) => row.amount !== 0);

        const expenseSummaryRows = expenseLedgers
          .map((ledger) =>
            createStatementRow(
              toTitleCase(ledger.LedgerName),
              round(ledger.CurrentDebit - ledger.CurrentCredit),
            ),
          )
          .filter((row) => row.amount !== 0);

        const cashReconciliationRows = [
          ...cashAndCashEquivalentsBreakup.map((row) =>
            createStatementRow(formatOpeningCashLabel(row.LedgerName), row.OpeningBalance),
          ),
          createStatementRow(
            'Opening Cash & Cash Equivalents',
            openingCashAndCashEquivalents,
            'summary',
          ),
          createStatementRow(
            netIncreaseInCashAndCashEquivalents >= 0
              ? 'Add: Net Increase in Cash (as above)'
              : 'Add: Net Decrease in Cash (as above)',
            netIncreaseInCashAndCashEquivalents,
          ),
          ...cashAndCashEquivalentsBreakup.map((row) =>
            createStatementRow(formatClosingCashLabel(row.LedgerName), row.ClosingBalance),
          ),
          createStatementRow(
            'Closing Cash & Cash Equivalents',
            closingCashAndCashEquivalents,
            'summary',
          ),
        ];

        return {
          data: {
            operatingActivities: [
              createStatementRow(
                'A.  CASH FLOWS FROM OPERATING ACTIVITIES',
                0,
                'section',
              ),
              createStatementRow('Net Profit / (Loss) for the Period', netProfit),
              createStatementRow(
                'Adjustments for Changes in Working Capital',
                0,
                'section',
              ),
              ...(depreciation !== 0
                ? [
                    createStatementRow(
                      'Depreciation / Non-cash adjustments',
                      depreciation,
                    ),
                  ]
                : []),
              ...workingCapitalRows,
              ...(reconciliationAdjustment !== 0
                ? [
                    createStatementRow(
                      'Prior Period / Timing Adjustments',
                      reconciliationAdjustment,
                    ),
                  ]
                : []),
              createStatementRow(
                'Total Working Capital Adjustments',
                workingCapitalAdjustmentTotal,
                'summary',
              ),
              createStatementRow(
                'NET CASH FROM / (USED IN) OPERATING ACTIVITIES',
                netCashFromOperatingActivities,
                'summary',
              ),
            ],
            investingActivities: [
              createStatementRow(
                'B.  CASH FLOWS FROM INVESTING ACTIVITIES',
                0,
                'section',
              ),
              ...investingRows,
              createStatementRow(
                'NET CASH USED IN INVESTING ACTIVITIES',
                netCashFromInvestingActivities,
                'summary',
              ),
            ],
            financingActivities: [
              createStatementRow(
                'C.  CASH FLOWS FROM FINANCING ACTIVITIES',
                0,
                'section',
              ),
              ...financingRows,
              createStatementRow(
                'NET CASH FROM FINANCING ACTIVITIES',
                netCashFromFinancingActivities,
                'summary',
              ),
            ],
            netChangeInCashAndCashEquivalents: [
              createStatementRow(
                'D.  NET CHANGE IN CASH & CASH EQUIVALENTS',
                0,
                'section',
              ),
              createStatementRow(
                'Net Cash from Operating Activities',
                netCashFromOperatingActivities,
              ),
              createStatementRow(
                'Net Cash used in Investing Activities',
                netCashFromInvestingActivities,
              ),
              createStatementRow(
                'Net Cash from Financing Activities',
                netCashFromFinancingActivities,
              ),
              createStatementRow(
                netIncreaseInCashAndCashEquivalents >= 0
                  ? 'NET INCREASE IN CASH & CASH EQUIVALENTS'
                  : 'NET DECREASE IN CASH & CASH EQUIVALENTS',
                netIncreaseInCashAndCashEquivalents,
                'summary',
              ),
            ],
            cashReconciliation: [
              createStatementRow(
                'E.  CASH & CASH EQUIVALENTS RECONCILIATION',
                0,
                'section',
              ),
              ...cashReconciliationRows,
            ],
            supplementalIncomeExpenseSummary: [
              createStatementRow(
                'F.  SUPPLEMENTAL - CURRENT PERIOD INCOME & EXPENSE SUMMARY',
                0,
                'section',
              ),
              ...directIncomeSummary,
              createStatementRow('Total Income', incomeTotal, 'summary'),
              ...expenseSummaryRows,
              createStatementRow('Total Expenses', expenseTotal, 'summary'),
              // createStatementRow('Net Profit / (Loss)', netProfit, 'summary'),
            ],
            workingCapitalBreakup: {
              receivables: receivablesBreakup,
              otherCurrentAssets: otherCurrentAssetsBreakup,
              currentLiabilities: currentLiabilitiesBreakup,
            },
            cashAndCashEquivalents: cashAndCashEquivalentsBreakup,
            fixedAssetsBreakup,
            financingBreakup,
            profitBreakup: {
              incomeTotal,
              expenseTotal,
              depreciation,
              netProfit,
            },
          },
          summary: {
            netProfit,
            depreciation,
            receivablesChange,
            otherCurrentAssetsChange,
            currentLiabilitiesChange,
            reconciliationAdjustment,
            netCashFromOperatingActivities,
            netCashFromInvestingActivities,
            netCashFromFinancingActivities,
            netIncreaseInCashAndCashEquivalents,
            openingCashAndCashEquivalents,
            closingCashAndCashEquivalents,
            changeInCashAndCashEquivalents,
            isReconciled: round(netIncreaseInCashAndCashEquivalents - changeInCashAndCashEquivalents) === 0,
          },
        };
      };

      const currentReport = buildPeriodReport(currentFromDate, currentToDate);
      const previousReport = buildPeriodReport(previousFromDate, previousToDate);

      const mergeRowsByLabel = (currentRows: any[] = [], previousRows: any[] = []) => {
        const order = [
          ...new Set([
            ...currentRows.map((row) => row.label),
            ...previousRows.map((row) => row.label),
          ]),
        ];

        return order.map((label) => {
          const currentRow = currentRows.find((row) => row.label === label);
          const previousRow = previousRows.find((row) => row.label === label);

          return {
            label,
            values: {
              [yearKeys[0]]: currentRow?.amount ?? 0,
              [yearKeys[1]]: previousRow?.amount ?? 0,
            },
            rowType:
              currentRow?.rowType ||
              previousRow?.rowType ||
              (String(label).toLowerCase().includes('net cash') ? 'summary' : 'detail'),
          };
        });
      };

      const mergeBreakupRows = (currentRows: any[] = [], previousRows: any[] = []) => {
        const getLabel = (row: any) =>
          row?.LedgerName || row?.SubGroupName || row?.GroupName || 'Cash / Bank';

        const order = [
          ...new Set([
            ...currentRows.map((row) => getLabel(row)),
            ...previousRows.map((row) => getLabel(row)),
          ]),
        ];

        return order.map((label) => {
          const currentRow = currentRows.find((row) => getLabel(row) === label);
          const previousRow = previousRows.find((row) => getLabel(row) === label);

          return {
            label,
            values: {
              [yearKeys[0]]: currentRow?.ClosingBalance ?? 0,
              [yearKeys[1]]: previousRow?.ClosingBalance ?? 0,
            },
            rowType: 'detail',
          };
        });
      };

      return {
        params,
        method: 'Indirect',
        source: 'Trial Balance Based',
        reportTitle: 'Cash Flow Statement',
        // currencyLabel: 'Currency: AED | Method: Indirect',
        yearKeys,
        reportSubTitle: formatPeriodLabel(currentFromDate, currentToDate),
        data: {
          operatingActivities: mergeRowsByLabel(
            currentReport.data.operatingActivities,
            previousReport.data.operatingActivities,
          ),
          investingActivities: mergeRowsByLabel(
            currentReport.data.investingActivities,
            previousReport.data.investingActivities,
          ),
          financingActivities: mergeRowsByLabel(
            currentReport.data.financingActivities,
            previousReport.data.financingActivities,
          ),
          netChangeInCashAndCashEquivalents: mergeRowsByLabel(
            currentReport.data.netChangeInCashAndCashEquivalents,
            previousReport.data.netChangeInCashAndCashEquivalents,
          ),
          cashReconciliation: mergeRowsByLabel(
            currentReport.data.cashReconciliation,
            previousReport.data.cashReconciliation,
          ),
          supplementalIncomeExpenseSummary: mergeRowsByLabel(
            currentReport.data.supplementalIncomeExpenseSummary,
            previousReport.data.supplementalIncomeExpenseSummary,
          ),
          cashAndCashEquivalents: mergeBreakupRows(
            currentReport.data.cashAndCashEquivalents,
            previousReport.data.cashAndCashEquivalents,
          ),
        },
        summary: {
          netIncreaseInCashAndCashEquivalents: {
            [yearKeys[0]]: currentReport.summary.netIncreaseInCashAndCashEquivalents,
            [yearKeys[1]]: previousReport.summary.netIncreaseInCashAndCashEquivalents,
          },
          openingCashAndCashEquivalents: {
            [yearKeys[0]]: currentReport.summary.openingCashAndCashEquivalents,
            [yearKeys[1]]: previousReport.summary.openingCashAndCashEquivalents,
          },
          closingCashAndCashEquivalents: {
            [yearKeys[0]]: currentReport.summary.closingCashAndCashEquivalents,
            [yearKeys[1]]: previousReport.summary.closingCashAndCashEquivalents,
          },
        },
        comparisonSummary: {
          current: currentReport.summary,
          previous: previousReport.summary,
        },
      };
    } catch (error) {
      throw error;
    }
  }

  private async generateGSTInward(params: any) {
    try {
      const {
        companyId: CompanyMasterSid,
        FromDate,
        ToDate,
        Branch: branchIdFromBranch,
        branchId: branchIdDirect,
        State,
        state,
        StateMasterSid,
        stateMasterSid,
        city,
        voucherType: voucherTypeLower,
        VoucherType: voucherTypeUpper,
      } = params;

      const branchId = branchIdFromBranch ?? branchIdDirect;
      const voucherType = voucherTypeLower ?? voucherTypeUpper;
      const inwardVoucherCodes = [
        DOC_TYPE_CODE.VENDOR_INVOICE,
        DOC_TYPE_CODE.VENDOR_CREDIT_NOTE,
      ];

      const branches =
        branchId && branchId.length > 0
          ? await this._db.branchMaster.findMany({
              where: {
                CompanyMasterSid,
                BranchMasterSid: { in: branchId },
                status: 'A',
              },
              select: {
                BranchMasterSid: true,
                branchName: true,
              },
            })
          : await this._db.branchMaster.findMany({
              where: { CompanyMasterSid, status: 'A' },
              select: {
                BranchMasterSid: true,
                branchName: true,
              },
            });

      const resolvedBranchIds = branches.map((b) => b.BranchMasterSid);
      const resolvedBranchNames = branches.map((b) => b.branchName);
      const branchesInvolved =
        branchId && branchId.length > 0
          ? resolvedBranchNames.join(', ')
          : 'All Branches';

      const voucherTypeMaster =
        voucherType !== null && voucherType !== undefined && voucherType !== ''
          ? await this._db.voucherTypeMaster.findFirst({
              where: {
                VoucherTypeMasterSid: Number(voucherType),
                CompanyMasterSid,
                status: 'A',
              },
              select: {
                VoucherTypeMasterSid: true,
                DocumentTypeCode: true,
              },
            })
          : null;

      if (voucherType && !voucherTypeMaster) {
        throw new BadRequestException('Invalid voucher type selected');
      }

      if (
        voucherTypeMaster?.DocumentTypeCode &&
        !inwardVoucherCodes.includes(voucherTypeMaster.DocumentTypeCode as any)
      ) {
        throw new BadRequestException('Only inward vouchers are allowed');
      }

      const whereClause: any = {
        CompanyMasterSid,
        BranchMasterSid: { in: resolvedBranchIds },
        VoucherDate: { gte: FromDate, lte: ToDate },
        Status: 'A',
        PostStatus: 'P',
        voucherTypeMaster: {
          DocumentTypeCode: voucherTypeMaster?.DocumentTypeCode
            ? voucherTypeMaster.DocumentTypeCode
            : { in: inwardVoucherCodes },
        },
      };

      const stateFilterValue = State ?? state ?? StateMasterSid ?? stateMasterSid;
      const stateFilter = String(stateFilterValue ?? '').trim();
      const stateFilterSid =
        stateFilter && /^\d+$/.test(stateFilter) ? Number(stateFilter) : null;
      let selectedStateName = stateFilter || 'All States';

      if (stateFilterSid) {
        const selectedState = await this._db.stateMaster.findUnique({
          where: { StateMasterSid: stateFilterSid },
          select: { stateName: true },
        });
        selectedStateName = selectedState?.stateName || stateFilter;
      }

      if (stateFilter) {
        whereClause.customerBranch = stateFilterSid
          ? {
              StateMasterSid: stateFilterSid,
            }
          : {
              stateMaster: {
                stateName: { contains: stateFilter, mode: 'insensitive' },
              },
            };
      }

      if (city && String(city).trim().length > 0) {
        const cityName = String(city).trim();
        whereClause.BranchMaster = {
          ...(whereClause.BranchMaster || {}),
          cityMaster: {
            cityName: { contains: cityName, mode: 'insensitive' },
          },
        };
      }

      const voucherHeaders = await this._db.voucherHeader.findMany({
        where: whereClause,
        include: {
          voucherTypeMaster: {
            select: {
              DocumentTypeCode: true,
              DocumentTypeName: true,
            },
          },
          BranchMaster: {
            select: {
              BranchMasterSid: true,
              branchName: true,
              cityMaster: {
                select: {
                  cityName: true,
                },
              },
              stateMaster: {
                select: {
                  stateName: true,
                  stateGSTCode: true,
                },
              },
            },
          },
          VoucherOthers: {
            where: { Status: 'A' },
            select: {
              IRNNumber: true,
            },
          },
          VoucherTransaction: {
            where: { Status: 'A' },
            select: {
              VoucherTransactionSid: true,
              TaxableAmount: true,
              LocalAmount: true,
              ChargeDescription: true,
              DrCr: true,
              coaMaster: {
                select: {
                  LedgerName: true,
                  LedgerType: true,
                },
              },
            },
          },
          subledgerMaster: {
            select: {
              SubledgerName: true,
              SubledgerMappingSid: true,
            },
          },
          customerBranch: {
            select: {
              CustomerBranchSid: true,
              StateMasterSid: true,
              GSTNo: true,
              stateMaster: {
                select: {
                  stateName: true,
                },
              },
            },
          },
        },
        orderBy: [{ VoucherDate: 'asc' }, { VoucherNumber: 'asc' }],
      });

      const customerIds = Array.from(
        new Set(
          voucherHeaders
            .map((v) => v.subledgerMaster?.SubledgerMappingSid)
            .filter((id): id is number => typeof id === 'number'),
        ),
      );

      const customers =
        customerIds.length > 0
          ? await this._db.customerMaster.findMany({
              where: { CustomerMasterSid: { in: customerIds } },
              include: {
                CustomerBranch: {
                  where: {
                    status: 'A',
                    ...(stateFilter
                      ? stateFilterSid
                        ? { StateMasterSid: stateFilterSid }
                        : {
                            stateMaster: {
                              stateName: { contains: stateFilter, mode: 'insensitive' },
                            },
                          }
                      : {}),
                  },
                  select: {
                    CustomerBranchSid: true,
                    StateMasterSid: true,
                    GSTNo: true,
                    stateMaster:{
                      select:{
                        stateName:true
                      }
                    }
                  },
                  orderBy: { CustomerBranchSid: 'asc' },
                  take: 1,
                },
              },
            })
          : [];

      const customerGstMap = new Map<number, string>(
        customers.map((c) => [c.CustomerMasterSid, c.CustomerBranch?.[0]?.GSTNo || '']),
      );
      const customerBranchMap = new Map<
        number,
        {
          CustomerBranchSid?: number;
          StateMasterSid?: number;
          GSTNo?: string | null;
          stateMaster?: { stateName?: string | null } | null;
        }
      >(
        customers.map((c) => [
          c.CustomerMasterSid,
          c.CustomerBranch?.[0] || {},
        ]),
      );

      const signedAmount = (amount: any, drCr?: string | null) => {
        const value = toNumber(amount);
        return (drCr || '').toUpperCase() === 'C' ? -value : value;
      };

      const detectTaxType = (line: any): 'IGST' | 'CGST' | 'SGST' | 'OTHER' => {
        const text = `${line?.ChargeDescription || ''} ${line?.coaMaster?.LedgerName || ''}`.toUpperCase();
        if (text.includes('IGST')) return 'IGST';
        if (text.includes('CGST')) return 'CGST';
        if (text.includes('SGST')) return 'SGST';
        return 'OTHER';
      };

      const isTaxLine = (line: any) => {
        const taxType = detectTaxType(line);
        if (taxType !== 'OTHER') return true;
        const ledgerType = String(line?.coaMaster?.LedgerType || '').toUpperCase();
        return ledgerType.includes('TAX');
      };

      const tableData = voucherHeaders.map((voucher) => {
        const allLines = voucher.VoucherTransaction || [];
        const taxLines = allLines.filter((line) => isTaxLine(line));
        const nonTaxLines = allLines.filter((line) => !isTaxLine(line));

        const igst = taxLines
          .filter((line) => detectTaxType(line) === 'IGST')
          .reduce((sum, line) => sum + signedAmount(line.LocalAmount, line.DrCr), 0);

        const cgst = taxLines
          .filter((line) => detectTaxType(line) === 'CGST')
          .reduce((sum, line) => sum + signedAmount(line.LocalAmount, line.DrCr), 0);

        const sgst = taxLines
          .filter((line) => detectTaxType(line) === 'SGST')
          .reduce((sum, line) => sum + signedAmount(line.LocalAmount, line.DrCr), 0);

        const totalGST = igst + cgst + sgst;

        const taxableValue = nonTaxLines.reduce(
          (sum, line) => sum + signedAmount(line.TaxableAmount, line.DrCr),
          0,
        );

        const transactionValue = allLines.reduce(
          (sum, line) => sum + signedAmount(line.LocalAmount, line.DrCr),
          0,
        );

        const gstin =
          voucher.customerBranch?.GSTNo ||
          (voucher.subledgerMaster?.SubledgerMappingSid
            ? customerGstMap.get(voucher.subledgerMaster.SubledgerMappingSid)
            : '') || '';

        const fallbackCustomerBranch = voucher.subledgerMaster?.SubledgerMappingSid
          ? customerBranchMap.get(voucher.subledgerMaster.SubledgerMappingSid)
          : undefined;
        const customerBranchSid =
          voucher.customerBranch?.CustomerBranchSid ||
          fallbackCustomerBranch?.CustomerBranchSid ||
          null;
        const stateMasterSid =
          voucher.customerBranch?.StateMasterSid ||
          fallbackCustomerBranch?.StateMasterSid ||
          null;
        const location =
          voucher.customerBranch?.stateMaster?.stateName ||
          fallbackCustomerBranch?.stateMaster?.stateName ||
          '';

        const placeOfSupply = voucher.PlaceOfSupply;
        return {
          TransactionDate: voucher.VoucherDate,
          CustomerBranchSid: customerBranchSid,
          StateMasterSid: stateMasterSid,
          Location: location,
          TransactionNo: voucher.VoucherNumber,
          PartyRefNo: voucher.DocumentNumber || '',
          PartyRefDate: voucher.DocumentDate || null,
          TransactionType: voucher.voucherTypeMaster?.DocumentTypeName || '',
          Organization:
            voucher.PartyName ||
            voucher.subledgerMaster?.SubledgerName ||
            '',
          GSTIN: gstin,
          TxnValue: transactionValue,
          TaxableValue: taxableValue,
          TaxCalculatedOn: taxableValue,
          IGST: igst,
          CGST: cgst,
          SGST: sgst,
          IGSTAmountRCM: 0,
          CGSTAmountRCM: 0,
          SGSTAmountRCM: 0,
          TotalGST: totalGST,
          PlaceOfSupply: placeOfSupply,
          IRNNo: voucher.VoucherOthers?.[0]?.IRNNumber || '',
          VoucherHeaderSid: voucher.VoucherHeaderSid,
          VoucherTypeCode: voucher.voucherTypeMaster?.DocumentTypeCode || '',
        };
      });

      return {
        CompanyMasterSid,
        branchesInvolved,
        branchNames: resolvedBranchNames.join(', '),
        voucherTypeName: voucherTypeMaster?.DocumentTypeCode || 'All Vouchers',
        state: selectedStateName,
        fromDate: FromDate,
        toDate: ToDate,
        count: tableData.length,
        tableData,
        params,
      };
    } catch (error) {
      throw error;
    }
  }
  
  private async generateGSTOutward(params: any) {
    try {
      const {
        companyId: CompanyMasterSid,
        FromDate,
        ToDate,
        Branch: branchIdFromBranch,
        branchId: branchIdDirect,
        State,
        state,
        StateMasterSid,
        stateMasterSid,
        voucherType: voucherTypeLower,
        VoucherType: voucherTypeUpper,
      } = params;

      const branchId = branchIdFromBranch ?? branchIdDirect;
      const voucherType = voucherTypeLower ?? voucherTypeUpper;
      const outwardVoucherCodes = [
        DOC_TYPE_CODE.INVOICE,
        DOC_TYPE_CODE.CREDIT_NOTE,
      ];

      const branches =
        branchId && branchId.length > 0
          ? await this._db.branchMaster.findMany({
              where: {
                CompanyMasterSid,
                BranchMasterSid: { in: branchId },
                status: 'A',
              },
              select: {
                BranchMasterSid: true,
                branchName: true,
              },
            })
          : await this._db.branchMaster.findMany({
              where: { CompanyMasterSid, status: 'A' },
              select: {
                BranchMasterSid: true,
                branchName: true,
              },
            });

      const resolvedBranchIds = branches.map((b) => b.BranchMasterSid);
      const resolvedBranchNames = branches.map((b) => b.branchName);
      const branchesInvolved =
        branchId && branchId.length > 0
          ? resolvedBranchNames.join(', ')
          : 'All Branches';

      const voucherTypeMaster =
        voucherType !== null && voucherType !== undefined && voucherType !== ''
          ? await this._db.voucherTypeMaster.findFirst({
              where: {
                VoucherTypeMasterSid: Number(voucherType),
                CompanyMasterSid,
                status: 'A',
              },
              select: {
                VoucherTypeMasterSid: true,
                DocumentTypeCode: true,
              },
            })
          : null;

      if (voucherType && !voucherTypeMaster) {
        throw new BadRequestException('Invalid voucher type selected');
      }

      if (
        voucherTypeMaster?.DocumentTypeCode &&
        !outwardVoucherCodes.includes(voucherTypeMaster.DocumentTypeCode as any)
      ) {
        throw new BadRequestException('Only outward vouchers are allowed');
      }

      const whereClause: any = {
        CompanyMasterSid,
        BranchMasterSid: { in: resolvedBranchIds },
        VoucherDate: { gte: FromDate, lte: ToDate },
        Status: 'A',
        PostStatus: 'P',
        voucherTypeMaster: {
          DocumentTypeCode: voucherTypeMaster?.DocumentTypeCode
            ? voucherTypeMaster.DocumentTypeCode
            : { in: outwardVoucherCodes },
        },
      };

      const stateFilterValue = State ?? state ?? StateMasterSid ?? stateMasterSid;
      const stateFilter = String(stateFilterValue ?? '').trim();
      const stateFilterSid =
        stateFilter && /^\d+$/.test(stateFilter) ? Number(stateFilter) : null;
      let selectedStateName = stateFilter || 'All States';

      if (stateFilterSid) {
        const selectedState = await this._db.stateMaster.findUnique({
          where: { StateMasterSid: stateFilterSid },
          select: { stateName: true },
        });
        selectedStateName = selectedState?.stateName || stateFilter;
      }

      if (stateFilter) {
        whereClause.customerBranch = stateFilterSid
          ? {
              StateMasterSid: stateFilterSid,
            }
          : {
              stateMaster: {
                stateName: { contains: stateFilter, mode: 'insensitive' },
              },
            };
      }


      const voucherHeaders = await this._db.voucherHeader.findMany({
        where: whereClause,
        include: {
          voucherTypeMaster: {
            select: {
              DocumentTypeCode: true,
              DocumentTypeName: true,
            },
          },
          BranchMaster: {
            select: {
              BranchMasterSid: true,
              branchName: true,
              cityMaster: {
                select: {
                  cityName: true,
                },
              },
              stateMaster: {
                select: {
                  stateName: true,
                  stateGSTCode: true,
                },
              },
            },
          },
          VoucherOthers: {
            where: { Status: 'A' },
            select: {
              IRNNumber: true,
            },
          },
          VoucherTransaction: {
            where: { Status: 'A' },
            select: {
              VoucherTransactionSid: true,
              TaxableAmount: true,
              LocalAmount: true,
              ChargeDescription: true,
              DrCr: true,
              coaMaster: {
                select: {
                  LedgerName: true,
                  LedgerType: true,
                },
              },
            },
          },
          subledgerMaster: {
            select: {
              SubledgerName: true,
              SubledgerMappingSid: true,
            },
          },
          customerBranch: {
            select: {
              CustomerBranchSid: true,
              StateMasterSid: true,
              GSTNo: true,
              stateMaster: {
                select: {
                  stateName: true,
                },
              },
            },
          },
        },
        orderBy: [{ VoucherDate: 'asc' }, { VoucherNumber: 'asc' }],
      });

      const customerIds = Array.from(
        new Set(
          voucherHeaders
            .map((v) => v.subledgerMaster?.SubledgerMappingSid)
            .filter((id): id is number => typeof id === 'number'),
        ),
      );

      const customers =
        customerIds.length > 0
          ? await this._db.customerMaster.findMany({
              where: { CustomerMasterSid: { in: customerIds } },
              include: {
                CustomerBranch: {
                  where: {
                    status: 'A',
                    ...(stateFilter
                      ? stateFilterSid
                        ? { StateMasterSid: stateFilterSid }
                        : {
                            stateMaster: {
                              stateName: {
                                contains: stateFilter,
                                mode: 'insensitive',
                              },
                            },
                          }
                      : {}),
                  },
                  select: {
                    CustomerBranchSid: true,
                    StateMasterSid: true,
                    GSTNo: true,
                    stateMaster: {
                      select: {
                        stateName: true,
                      },
                    },
                  },
                  orderBy: { CustomerBranchSid: 'asc' },
                  take: 1,
                },
              },
            })
          : [];

      const customerGstMap = new Map<number, string>(
        customers.map((c) => [
          c.CustomerMasterSid,
          c.CustomerBranch?.[0]?.GSTNo || '',
        ]),
      );
      const customerBranchMap = new Map<
        number,
        {
          CustomerBranchSid?: number;
          StateMasterSid?: number;
          GSTNo?: string | null;
          stateMaster?: { stateName?: string | null } | null;
        }
      >(
        customers.map((c) => [
          c.CustomerMasterSid,
          c.CustomerBranch?.[0] || {},
        ]),
      );

      const signedAmount = (amount: any, drCr?: string | null) => {
        const value = toNumber(amount);
        return (drCr || '').toUpperCase() === 'C' ? -value : value;
      };

      const detectTaxType = (line: any): 'IGST' | 'CGST' | 'SGST' | 'OTHER' => {
        const text =
          `${line?.ChargeDescription || ''} ${line?.coaMaster?.LedgerName || ''}`.toUpperCase();
        if (text.includes('IGST')) return 'IGST';
        if (text.includes('CGST')) return 'CGST';
        if (text.includes('SGST')) return 'SGST';
        return 'OTHER';
      };

      const isTaxLine = (line: any) => {
        const taxType = detectTaxType(line);
        if (taxType !== 'OTHER') return true;
        const ledgerType = String(line?.coaMaster?.LedgerType || '').toUpperCase();
        return ledgerType.includes('TAX');
      };

      const tableData = voucherHeaders.map((voucher) => {
        const allLines = voucher.VoucherTransaction || [];
        const taxLines = allLines.filter((line) => isTaxLine(line));
        const nonTaxLines = allLines.filter((line) => !isTaxLine(line));

        const igst = taxLines
          .filter((line) => detectTaxType(line) === 'IGST')
          .reduce((sum, line) => sum + signedAmount(line.LocalAmount, line.DrCr), 0);

        const cgst = taxLines
          .filter((line) => detectTaxType(line) === 'CGST')
          .reduce((sum, line) => sum + signedAmount(line.LocalAmount, line.DrCr), 0);

        const sgst = taxLines
          .filter((line) => detectTaxType(line) === 'SGST')
          .reduce((sum, line) => sum + signedAmount(line.LocalAmount, line.DrCr), 0);

        const totalGST = igst + cgst + sgst;

        const taxableValue = nonTaxLines.reduce(
          (sum, line) => sum + signedAmount(line.TaxableAmount, line.DrCr),
          0,
        );

        const transactionValue = allLines.reduce(
          (sum, line) => sum + signedAmount(line.LocalAmount, line.DrCr),
          0,
        );

        const gstin =
          voucher.customerBranch?.GSTNo ||
          (voucher.subledgerMaster?.SubledgerMappingSid
            ? customerGstMap.get(voucher.subledgerMaster.SubledgerMappingSid)
            : '') ||
          '';

        const fallbackCustomerBranch = voucher.subledgerMaster?.SubledgerMappingSid
          ? customerBranchMap.get(voucher.subledgerMaster.SubledgerMappingSid)
          : undefined;
        const customerBranchSid =
          voucher.customerBranch?.CustomerBranchSid ||
          fallbackCustomerBranch?.CustomerBranchSid ||
          null;
        const stateMasterSid =
          voucher.customerBranch?.StateMasterSid ||
          fallbackCustomerBranch?.StateMasterSid ||
          null;
        const location =
          voucher.customerBranch?.stateMaster?.stateName ||
          fallbackCustomerBranch?.stateMaster?.stateName ||
          '';

        return {
          TransactionDate: voucher.VoucherDate,
          CustomerBranchSid: customerBranchSid,
          StateMasterSid: stateMasterSid,
          Location: location,
          TransactionNo: voucher.VoucherNumber,
          PartyRefNo: voucher.DocumentNumber || '',
          PartyRefDate: voucher.DocumentDate || null,
          TransactionType: voucher.voucherTypeMaster?.DocumentTypeName || '',
          Organization:
            voucher.PartyName ||
            voucher.subledgerMaster?.SubledgerName ||
            '',
          GSTIN: gstin,
          TxnValue: transactionValue,
          TaxableValue: taxableValue,
          TaxCalculatedOn: taxableValue,
          IGST: igst,
          CGST: cgst,
          SGST: sgst,
          IGSTAmountRCM: 0,
          CGSTAmountRCM: 0,
          SGSTAmountRCM: 0,
          TotalGST: totalGST,
          PlaceOfSupply: voucher.PlaceOfSupply,
          IRNNo: voucher.VoucherOthers?.[0]?.IRNNumber || '',
          VoucherHeaderSid: voucher.VoucherHeaderSid,
          VoucherTypeCode: voucher.voucherTypeMaster?.DocumentTypeCode || '',
        };
      });

      return {
        CompanyMasterSid,
        branchesInvolved,
        branchNames: resolvedBranchNames.join(', '),
        voucherTypeName: voucherTypeMaster?.DocumentTypeCode || 'All Vouchers',
        state: selectedStateName,
        fromDate: FromDate,
        toDate: ToDate,
        count: tableData.length,
        tableData,
        params,
      };
    } catch (error) {
      throw error;
    }
  }

  private async generateGSTR(params: any) {
    try {
      const {
        companyId: companyIdLower,
        CompanyMasterSid: companyIdUpper,
        FromDate,
        ToDate,
        Branch: branchIdFromBranch,
        branchId: branchIdDirect,
        State,
        state,
        StateMasterSid,
        stateMasterSid,
      } = params;

      const CompanyMasterSid = companyIdLower ?? companyIdUpper;
      const branchId = branchIdFromBranch ?? branchIdDirect;
      const stateFilterValue = State ?? state ?? StateMasterSid ?? stateMasterSid;
      const stateFilter = String(stateFilterValue ?? '').trim();
      const stateFilterSid =
        stateFilter && /^\d+$/.test(stateFilter) ? Number(stateFilter) : null;

      if (!CompanyMasterSid || !FromDate || !ToDate) {
        throw new BadRequestException('Company, from date and to date are required');
      }

      const company = await this._db.companyMaster.findFirst({
        where: {
          CompanyMasterSid,
          status: 'A',
        },
        select: {
          CompanyMasterSid: true,
          companyName: true,
        },
      });

      if (!company) {
        throw new BadRequestException('Invalid company selected');
      }

      const branchWhere: any = {
        CompanyMasterSid,
        status: 'A',
      };

      if (branchId && branchId.length > 0) {
        branchWhere.BranchMasterSid = { in: branchId };
      }

      if (stateFilter) {
        if (stateFilterSid) {
          branchWhere.StateMasterSid = stateFilterSid;
        } else {
          branchWhere.stateMaster = {
            stateName: { contains: stateFilter, mode: 'insensitive' },
          };
        }
      }

      const branches = await this._db.branchMaster.findMany({
        where: branchWhere,
        select: {
          BranchMasterSid: true,
          branchName: true,
          taxRegistrationNo: true,
          StateMasterSid: true,
          stateMaster: {
            select: {
              stateName: true,
              stateGSTCode: true,
            },
          },
        },
        orderBy: { branchName: 'asc' },
      });

      if (!branches.length) {
        throw new BadRequestException('No branches found for the selected criteria');
      }

      const resolvedBranchIds = branches.map((b) => b.BranchMasterSid);
      const resolvedBranchNames = branches.map((b) => b.branchName);
      const selectedStateName =
        branches.length > 0
          ? Array.from(
              new Set(
                branches
                  .map((b) => b.stateMaster?.stateName)
                  .filter((name): name is string => !!name),
              ),
            ).join(', ') || stateFilter || 'All States'
          : stateFilter || 'All States';

      const baseHeaderWhere: any = {
        CompanyMasterSid,
        BranchMasterSid: { in: resolvedBranchIds },
        VoucherDate: {
          gte: FromDate,
          lte: ToDate,
        },
        Status: 'A',
        PostStatus: 'P',
      };

      const outputVoucherCodes = [
        DOC_TYPE_CODE.INVOICE,
        DOC_TYPE_CODE.CREDIT_NOTE,
      ];
      const inputVoucherCodes = [
        DOC_TYPE_CODE.VENDOR_INVOICE,
        DOC_TYPE_CODE.VENDOR_CREDIT_NOTE,
      ];
      const gstVoucherCodes = [...outputVoucherCodes, ...inputVoucherCodes];

      type GstrBucket = {
        taxableValue: number;
        igst: number;
        cgst: number;
        sgst: number;
        cess: number;
      };

      const createBucket = (): GstrBucket => ({
        taxableValue: 0,
        igst: 0,
        cgst: 0,
        sgst: 0,
        cess: 0,
      });

      const buckets = {
        outwardTaxable: createBucket(),
        outwardZeroRated: createBucket(),
        outwardNilExempt: createBucket(),
        inwardReverseCharge: createBucket(),
        outwardNonGst: createBucket(),
        interstateUnregistered: createBucket(),
        interstateComposition: createBucket(),
        interstateUin: createBucket(),
        importGoods: createBucket(),
        importServices: createBucket(),
        inwardReverseChargeItc: createBucket(),
        inwardIsd: createBucket(),
        allOtherItc: createBucket(),
        itcReversedRules: createBucket(),
        itcReversedOthers: createBucket(),
        ineligibleItcRules: createBucket(),
        ineligibleItcOthers: createBucket(),
        inwardExemptInterState: createBucket(),
        inwardExemptIntraState: createBucket(),
        inwardNonGstInterState: createBucket(),
        inwardNonGstIntraState: createBucket(),
      };

      const signedBySide = (
        amount: any,
        drCr?: string | null,
        side: 'Input' | 'Output' = 'Output',
      ) => {
        const value = toNumber(amount);
        const normalizedDrCr = String(drCr || '').toUpperCase();
        if (side === 'Input') {
          return normalizedDrCr === 'C' ? -value : value;
        }
        return normalizedDrCr === 'D' ? -value : value;
      };

      const detectTaxComponent = (
        detail: any,
      ): 'igst' | 'cgst' | 'sgst' | 'cess' | null => {
        const text =
          `${detail?.subledgerMaster?.SubledgerName || ''} ${detail?.ChargeDescription || ''}`.toUpperCase();
        if (text.includes('CESS')) return 'cess';
        if (text.includes('IGST')) return 'igst';
        if (text.includes('CGST')) return 'cgst';
        if (text.includes('SGST')) return 'sgst';
        return null;
      };

      const classifyText = (detail: any) =>
        [
          detail?.InvoiceType,
          detail?.ChargeDescription,
          detail?.VoucherHeader?.InvoiceType,
          detail?.VoucherHeader?.GSTType,
          detail?.VoucherHeader?.GST_VAT,
          detail?.VoucherHeader?.PlaceOfSupply,
        ]
          .filter(Boolean)
          .join(' ')
          .toUpperCase();

      const isZeroRated = (detail: any) => {
        const text = classifyText(detail);
        return text.includes('ZERO') || text.includes('EXPORT') || text.includes('SEZ');
      };

      const isNilExempt = (detail: any) => {
        const text = classifyText(detail);
        return text.includes('NIL') || text.includes('EXEMPT');
      };

      const isNonGst = (detail: any) => {
        const text = classifyText(detail).replace(/[-_\s]/g, '');
        return text.includes('NONGST') || text.includes('NOGST');
      };

      const isReverseCharge = (detail: any) => {
        const text = classifyText(detail).replace(/[-_\s]/g, '');
        return text.includes('RCM') || text.includes('REVERSECHARGE');
      };

      const isImportService = (detail: any) => {
        const text = classifyText(detail);
        return text.includes('IMPORT') && text.includes('SERVICE');
      };

      const isImportGoods = (detail: any) => {
        const text = classifyText(detail);
        return text.includes('IMPORT') && text.includes('GOOD');
      };

      const isInterState = (detail: any) => {
        const branchState = detail?.VoucherHeader?.BranchMaster?.StateMasterSid;
        const partyState = detail?.VoucherHeader?.customerBranch?.StateMasterSid;
        return !!branchState && !!partyState && branchState !== partyState;
      };

      const addTaxDetail = (
        bucket: GstrBucket,
        detail: any,
        side: 'Input' | 'Output',
      ) => {
        const component = detectTaxComponent(detail);
        const taxableValue = signedBySide(detail.TaxableAmount, detail.DrCr, side);
        const taxAmount = signedBySide(detail.LocalAmount, detail.DrCr, side);

        if (component) {
          bucket[component] += taxAmount;
        }

        if (component !== 'sgst' && component !== 'cess') {
          bucket.taxableValue += taxableValue;
        }
      };

      const addTaxableDetail = (
        bucket: GstrBucket,
        detail: any,
        side: 'Input' | 'Output',
      ) => {
        bucket.taxableValue += signedBySide(
          detail.TaxableAmount || detail.LocalAmount,
          detail.DrCr,
          side,
        );
      };

      const taxDetails = await this._db.voucherDetail.findMany({
        where: {
          Status: 'A',
          subledgerMaster: {
            SubledgerType: 'Tax',
          },
          VoucherHeader: {
            ...baseHeaderWhere,
            voucherTypeMaster: {
              DocumentTypeCode: { in: gstVoucherCodes },
            },
          },
        },
        select: {
          VoucherDetailSid: true,
          VoucherHeaderSid: true,
          ChargeDescription: true,
          DrCr: true,
          TaxableAmount: true,
          LocalAmount: true,
          InvoiceType: true,
          subledgerMaster: {
            select: {
              SubledgerName: true,
              SubledgerType: true,
              TaxType: true,
            },
          },
          VoucherHeader: {
            select: {
              GST_VAT: true,
              GSTType: true,
              InvoiceType: true,
              PlaceOfSupply: true,
              voucherTypeMaster: {
                select: {
                  DocumentTypeCode: true,
                },
              },
              BranchMaster: {
                select: {
                  StateMasterSid: true,
                },
              },
              customerBranch: {
                select: {
                  GSTNo: true,
                  StateMasterSid: true,
                },
              },
            },
          },
        },
      });

      for (const detail of taxDetails) {
        const voucherCode = detail.VoucherHeader?.voucherTypeMaster?.DocumentTypeCode;
        const taxType = detail.subledgerMaster?.TaxType;

        if (outputVoucherCodes.includes(voucherCode as any)) {
          if (isReverseCharge(detail)) {
            addTaxDetail(buckets.inwardReverseCharge, detail, 'Output');
          } else if (isZeroRated(detail)) {
            addTaxDetail(buckets.outwardZeroRated, detail, 'Output');
          } else {
            addTaxDetail(buckets.outwardTaxable, detail, 'Output');
          }

          if (isInterState(detail)) {
            const gstNo = detail.VoucherHeader?.customerBranch?.GSTNo || '';
            const text = classifyText(detail);
            if (!gstNo) {
              addTaxDetail(buckets.interstateUnregistered, detail, 'Output');
            } else if (text.includes('COMPOSITION')) {
              addTaxDetail(buckets.interstateComposition, detail, 'Output');
            } else if (text.includes('UIN')) {
              addTaxDetail(buckets.interstateUin, detail, 'Output');
            }
          }
        }

        if (inputVoucherCodes.includes(voucherCode as any) || taxType === 'Input') {
          if (isImportGoods(detail)) {
            addTaxDetail(buckets.importGoods, detail, 'Input');
          } else if (isImportService(detail)) {
            addTaxDetail(buckets.importServices, detail, 'Input');
          } else if (isReverseCharge(detail)) {
            addTaxDetail(buckets.inwardReverseChargeItc, detail, 'Input');
          } else {
            addTaxDetail(buckets.allOtherItc, detail, 'Input');
          }
        }
      }

      const classifiedChargeDetails = await this._db.voucherDetail.findMany({
        where: {
          Status: 'A',
          OR: [{ ChargeMasterSid: { not: null } }, { HSSACMasterSid: { not: null } }],
          NOT: {
            subledgerMaster: {
              SubledgerType: 'Tax',
            },
          },
          VoucherHeader: {
            ...baseHeaderWhere,
            voucherTypeMaster: {
              DocumentTypeCode: { in: gstVoucherCodes },
            },
          },
        },
        select: {
          VoucherDetailSid: true,
          ChargeDescription: true,
          DrCr: true,
          TaxableAmount: true,
          LocalAmount: true,
          InvoiceType: true,
          VoucherHeader: {
            select: {
              GST_VAT: true,
              GSTType: true,
              InvoiceType: true,
              PlaceOfSupply: true,
              voucherTypeMaster: {
                select: {
                  DocumentTypeCode: true,
                },
              },
              BranchMaster: {
                select: {
                  StateMasterSid: true,
                },
              },
              customerBranch: {
                select: {
                  StateMasterSid: true,
                },
              },
            },
          },
        },
      });

      for (const detail of classifiedChargeDetails) {
        const voucherCode = detail.VoucherHeader?.voucherTypeMaster?.DocumentTypeCode;

        if (outputVoucherCodes.includes(voucherCode as any)) {
          if (isNonGst(detail)) {
            addTaxableDetail(buckets.outwardNonGst, detail, 'Output');
          } else if (isNilExempt(detail)) {
            addTaxableDetail(buckets.outwardNilExempt, detail, 'Output');
          } else if (isZeroRated(detail)) {
            addTaxableDetail(buckets.outwardZeroRated, detail, 'Output');
          }
        }

        if (inputVoucherCodes.includes(voucherCode as any)) {
          const interState = isInterState(detail);
          if (isNonGst(detail)) {
            addTaxableDetail(
              interState
                ? buckets.inwardNonGstInterState
                : buckets.inwardNonGstIntraState,
              detail,
              'Input',
            );
          } else if (isNilExempt(detail)) {
            addTaxableDetail(
              interState
                ? buckets.inwardExemptInterState
                : buckets.inwardExemptIntraState,
              detail,
              'Input',
            );
          }
        }
      }

      const normalizeBucket = (bucket: GstrBucket) => ({
        taxableValue: roundAmount(bucket.taxableValue, 2),
        igst: roundAmount(bucket.igst, 2),
        cgst: roundAmount(bucket.cgst, 2),
        sgst: roundAmount(bucket.sgst, 2),
        cess: roundAmount(bucket.cess, 2),
      });

      const makeRow = (
        itemType: string,
        itemDetails: string,
        bucket: GstrBucket,
        source = '',
        tableNo = '',
        placeOfSupply = '',
      ) => {
        const normalized = normalizeBucket(bucket);
        return {
          ItemType: itemType,
          ItemDetails: itemDetails,
          PlaceOfSupply: placeOfSupply,
          TotalTaxableValue: normalized.taxableValue,
          IGST: normalized.igst,
          CGST: normalized.cgst,
          SGST: normalized.sgst,
          CESS: normalized.cess,
          Source: source,
          TableNo: tableNo,
        };
      };

      const tableData = [
        makeRow(
          '3.1a',
          '(a) Outward taxable supplies (other than zero rated; nil rated and exempted)',
          buckets.outwardTaxable,
          'GSTR-1',
          '4A + 5A + 7A + 7B - 9B(data relevant to 4A and 5A)',
        ),
        makeRow(
          '3.1b',
          '(b) Outward taxable supplies (zero rated )',
          buckets.outwardZeroRated,
          'GSTR-1',
          '6A + 6B - 9B(data relevant to 6A and 6B)',
        ),
        makeRow(
          '3.1c',
          '(c) Other outward supplies (Nil rated; exempted)',
          buckets.outwardNilExempt,
          'GSTR-1',
          '8A + 8B + 8C + 8D(excluding Non GST supplies)',
        ),
        makeRow(
          '3.1d',
          '(d) Inward supplies (liable to reverse charge)',
          buckets.inwardReverseCharge,
          'GSTR-2',
          '4A + 4B + 4C - 6C(data relevant to 4A,4B,4C)',
        ),
        makeRow(
          '3.1e',
          '(e) Non-GST outward supplies',
          buckets.outwardNonGst,
          'GSTR-1',
          '8A + 8B + 8C + 8D(only Non GST supplies)',
        ),
        makeRow(
          '3.2a',
          'Supplies made to Unregistered Persons (Inter-State)',
          buckets.interstateUnregistered,
          'GSTR-1',
          '5A + 7B - 9B(data relevant to 5A)',
        ),
        makeRow(
          '3.2b',
          'Supplies made to Composition Taxable Persons (Inter-State)',
          buckets.interstateComposition,
          'GSTR-1',
          '4A + 8A - 9B(data relevant to 4A(only Composition Supplier))',
        ),
        makeRow(
          '3.2c',
          'Supplies made to UIN holders (Inter-State)',
          buckets.interstateUin,
        ),
        makeRow('4.1a', 'Import of goods', buckets.importGoods),
        makeRow(
          '4.2a',
          'Import of services',
          buckets.importServices,
          'GSTR-2',
          '4C - 6C(data relevant to 4C)',
        ),
        makeRow(
          '4.3a',
          'Inward supplies liable to reverse charge (other than 1 & 2 above)',
          buckets.inwardReverseChargeItc,
          'GSTR-2',
          '4A + 4B - 6C(data relevant to 4A and 4B)',
        ),
        makeRow('4.4a', 'Inward supplies from ISD', buckets.inwardIsd),
        makeRow(
          '4.5a',
          'All other ITC',
          buckets.allOtherItc,
          'GSTR-2',
          '3 - 6C(data relevant to 3)',
        ),
        makeRow(
          '4.1b',
          '*ITC Reversed - As per rules 42 & 43 of CGST Rules',
          buckets.itcReversedRules,
        ),
        makeRow('4.2b', '*ITC Reversed - Others', buckets.itcReversedOthers),
        makeRow(
          '4.1d',
          '*Ineligible ITC - As per section 17(5)',
          buckets.ineligibleItcRules,
        ),
        makeRow('4.2d', '*Ineligible ITC - Others', buckets.ineligibleItcOthers),
        makeRow(
          '5.1',
          'Inward supplies from a supplier under composition scheme; Exempt and Nil rated supply - Inter-State',
          buckets.inwardExemptInterState,
          'GSTR-2',
          '7A + 7B(Excluding Non GST supplies)',
        ),
        makeRow(
          '5.2',
          'Inward supplies from a supplier under composition scheme; Exempt and Nil rated supply - Intra-State',
          buckets.inwardExemptIntraState,
          'GSTR-2',
          '7A + 7B(Excluding Non GST supplies)',
        ),
        makeRow(
          '5.3',
          'Non GST inward supply - Inter-State',
          buckets.inwardNonGstInterState,
          'GSTR-2',
          '7A + 7B(Only Non GST supplies)',
        ),
        makeRow(
          '5.4',
          'Non GST inward supply - Intra-State',
          buckets.inwardNonGstIntraState,
          'GSTR-2',
          '7A + 7B(Only Non GST supplies)',
        ),
      ];

      return {
        CompanyMasterSid,
        companyName: company.companyName,
        state: selectedStateName,
        fromDate: FromDate,
        toDate: ToDate,
        branchesInvolved:
          branchId && branchId.length > 0
            ? resolvedBranchNames.join(', ')
            : 'All Branches',
        branchNames: resolvedBranchNames.join(', '),
        gstins: branches
          .map((b) => b.taxRegistrationNo)
          .filter((gstin): gstin is string => !!gstin)
          .join(', '),
        count: tableData.length,
        tableData,
        params,
      };
    } catch (error) {
      throw error;
    }
  }
    
  async getBranchNames(
    companyMasterSid: number,
    branchIds?: number[],
  ): Promise<{ BranchMasterSid: number; branchName: string }[]> {
    try {
      const whereClause: any = {
        CompanyMasterSid: companyMasterSid,
        status: 'A',
      };
      if (branchIds && branchIds.length > 0) {
        whereClause['BranchMasterSid'] = { in: branchIds };
      }
      const branches = await this._db.branchMaster.findMany({
        where: whereClause,
        select: {
          BranchMasterSid: true,
          branchName: true,
        },
      });
      return branches;
    } catch (error) {
      throw error;
    }
  }

  async exportReport(reportName: string, exportParams: any) {
    try {
      // Generate report first
      const reportData = await this.generateReport(
        reportName,
        exportParams.parameters,
      );

      // Format and export based on format
      const format = exportParams.format || 'EXCEL';

      // TODO: Implement actual export logic using report-export service
      return {
        reportName,
        format,
        data: reportData,
        exportedAt: new Date(),
        message: `Export to ${format} will be implemented by report-export service`,
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
        format: emailParams.format || 'PDF',
      });

      // TODO: Implement email service integration
      this.logger.log(`Email report to: ${emailParams.email}`);

      return {
        success: true,
        message: 'Email service integration pending',
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Execute parameter query to get dynamic dropdown options
   * Supports cascading dropdowns via DependsOnParameter field
   */
  async executeParameterQuery(
    parameterId: number,
    context: { companyId?: number; branchId?: number; [key: string]: any },
  ): Promise<Array<{ value: any; label: string }>> {
    try {
      // Fetch the parameter details
      const parameter = await this._db.reportMasterDetail.findFirst({
        where: {
          ReportMasterDetailSid: parameterId,
          Status: 'A',
        },
      });

      if (!parameter) {
        throw new BadRequestException(
          `Parameter with ID ${parameterId} not found`,
        );
      }

      if (!parameter.ParameterQuery) {
        throw new BadRequestException(
          `Parameter ${parameter.ParameterName} does not have a query defined`,
        );
      }

      // If this parameter depends on another, check if parent value is provided
      if (parameter.DependsOnParameter) {
        const parentValue = context[parameter.DependsOnParameter];
        if (
          parentValue === undefined ||
          parentValue === null ||
          parentValue === ''
        ) {
          // Parent not selected, return empty array
          this.logger.log(
            `Parameter ${parameter.ParameterName} depends on ${parameter.DependsOnParameter} which is not provided`,
          );
          return [];
        }
      }

      // Validate the query
      this.validateQuery(parameter.ParameterQuery);

      // Build a parameterized Prisma SQL query from {placeholders}
      const contextValues: Record<string, any> = {};
      if (context.companyId !== undefined && context.companyId !== null) {
        contextValues.companyId = context.companyId;
      }
      if (context.branchId !== undefined && context.branchId !== null) {
        contextValues.branchId = context.branchId;
      }
      for (const [key, value] of Object.entries(context)) {
        if (
          key !== 'companyId' &&
          key !== 'branchId' &&
          value !== undefined &&
          value !== null
        ) {
          contextValues[key] = value;
        }
      }

      const buildParameterizedSql = (
        template: string,
        valuesMap: Record<string, any>,
      ): Prisma.Sql => {
        const tokenRegex = /\{([^}]+)\}/g;
        let lastIndex = 0;
        let match: RegExpExecArray | null;
        let sql = Prisma.sql``;

        while ((match = tokenRegex.exec(template)) !== null) {
          const rawChunk = template.slice(lastIndex, match.index);
          if (rawChunk) {
            sql = Prisma.sql`${sql}${Prisma.raw(rawChunk)}`;
          }

          const key = match[1];
          if (!(key in valuesMap)) {
            sql = Prisma.sql`${sql}${Prisma.raw(match[0])}`;
          } else {
            const value = valuesMap[key];
            if (Array.isArray(value)) {
              sql =
                value.length > 0
                  ? Prisma.sql`${sql}${Prisma.join(value)}`
                  : Prisma.sql`${sql}NULL`;
            } else {
              sql = Prisma.sql`${sql}${value}`;
            }
          }

          lastIndex = tokenRegex.lastIndex;
        }

        const tailChunk = template.slice(lastIndex);
        if (tailChunk) {
          sql = Prisma.sql`${sql}${Prisma.raw(tailChunk)}`;
        }

        return sql;
      };

      const sqlQuery = buildParameterizedSql(
        parameter.ParameterQuery,
        contextValues,
      );

      // Execute the query
      this.logger.log(`Executing parameter query for parameterId: ${parameterId}`);
      const results = await this._db.$queryRaw<Array<{ value: any; label: string }>>(
        sqlQuery,
      );

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
        throw new BadRequestException(
          `Query contains forbidden keyword: ${keyword}`,
        );
      }
    }

    // Additional security: check for multiple statements
    const statements = query.split(';').filter((s) => s.trim().length > 0);
    if (statements.length > 1) {
      throw new BadRequestException('Multiple SQL statements are not allowed');
    }
  }
}

