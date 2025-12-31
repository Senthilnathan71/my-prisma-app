import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { DatabaseService } from 'src/database/database.service';
import { ApprovalStatus, Prisma } from '@prisma/client';
import { AgeingReportQueryDto, BalanceSheetReportQueryDto, LedgerReportQueryDto, OutstandingReportQueryDto, ProfitLossReportQueryDto, StatementLedgerReportQueryDto, TopNCustomerReportQueryDto, TrialBalanceReportQueryDto, UnpostedVoucherListReportQueryDto, VATReportQueryDto } from 'src/accounts/dto/accounts-reports.dto';
import { roundAmount, toNumber } from 'src/common/helper';
import { CustomerOutstandingResponseDto, CustomerOutstandingTransactionDto } from 'src/accounts/dto/outstanding.dto';
import { transcode } from 'buffer';
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
  CreditDays : number;
  CreditLimit : number;
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
        case 'profit-summary-report':
          return await this.generateProfitSummaryReport(parameters);
        case 'matching-list-report':
          return await this.generateMatchingListReport(parameters);
        case 'top-n-customer':
          return await this.generateTopNCustomerReport(parameters);
        case 'ledger-report':
          return await this.generateLedgerReport(parameters);
        case 'unposted-voucher-list':
          return await this.generateUnpostedVoucherList(parameters);
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
        VoucherTransactionSid : v.VoucherTransactionSid,
        LedgerName: coa.LedgerName,
        SubledgerName: v.subledgerMaster?.SubledgerName ?? null,
        SubledgerMasterSid: v.LedgerMasterSid ?? null,
        VoucherDate: v.VoucherDate,
        CurrencyCode: v.CurrencyCode ?? null,
        DrCr : v.DrCr,
        Ageing: ageing,
        OriginalCurrAmount: toNumber(v.Amount),
        OriginalLocalAmount: toNumber(v.LocalAmount),
        OSCurrencyAmount: toNumber(v.Amount) - Math.abs(matchCurr),
        OSLocalAmount: toNumber(v.LocalAmount) - Math.abs(matchLocal),
        OnAccountCreditCurr : v.DrCr === 'C' ?  toNumber(v.Amount) - Math.abs(matchCurr) : 0,
        OnAccountCreditLocal : v.DrCr === 'C' ?  toNumber(v.LocalAmount) - Math.abs(matchLocal) : 0,
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
          totalOnAccountCreditCurr: 0,
          totalOnAccountCreditLocal: 0,
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
          totalOnAccountCreditCurr: 0,
          totalOnAccountCreditLocal: 0,
          CreditDays : 0,
          CreditLimit : 0,
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
        subledger.totalOutstandingCurrency += row.DrCr==='C' ? -row.OSCurrencyAmount : row.OSCurrencyAmount;
        subledger.totalOutstandingLocal += row.DrCr === 'C' ? -row.OSLocalAmount : row.OSLocalAmount;
        subledger.totalOnAccountCreditCurr += row.DrCr === 'C' ? -row.OnAccountCreditCurr : 0;
        subledger.totalOnAccountCreditLocal += row.DrCr === 'C' ? -row.OnAccountCreditLocal : 0;
        // subledger.rows?.push(row);
        subledger.voucherCount += 1;

        // Update currency group totals
        currGroup.totalOutstandingCurrency += row.DrCr === 'C' ? -row.OSCurrencyAmount : row.OSCurrencyAmount;
        currGroup.totalOutstandingLocal += row.DrCr === 'C' ? -row.OSLocalAmount : row.OSLocalAmount;
        currGroup.totalOnAccountCreditCurr += row.DrCr === 'C' ? -row.OnAccountCreditCurr : 0;
        currGroup.totalOnAccountCreditLocal += row.DrCr === 'C' ? -row.OnAccountCreditLocal : 0;
        currGroup.voucherCount += 1;

        // Bucket allocation (use OSCurrencyAmount here by your requirement)
        let placed = false;
        for (let i = 0; i < bucketRanges.length; i++) {
          if (row.Ageing <= bucketRanges[i]) {
            const label = bucketLabels[i];
            subledger.buckets[label] += row.DrCr === 'D' ? row.OSCurrencyAmount : 0;
            currGroup.bucketTotals[label] += row.DrCr === 'D' ? row.OSCurrencyAmount : 0;
            placed = true;
            break;
          }
        }
        if (!placed) {
          const last = bucketLabels[bucketLabels.length - 1];
          subledger.buckets[last] += row.DrCr === 'D' ? row.OSCurrencyAmount : 0;
          currGroup.bucketTotals[last] += row.DrCr === 'D' ? row.OSCurrencyAmount : 0;
        }
      } else {
        // Combined mode: use a single group key
        const combinedKey = 'ALL_CURRENCIES';
        const combinedGroup = getOrCreateCurrencyGroup(combinedKey, null);

        const subledger = getOrCreateSubledger(combinedGroup, subId, row);

        // Update subledger totals (we still record OSCurrencyAmount & OSLocalAmount)
        subledger.totalOutstandingCurrency += row.OSCurrencyAmount ? -row.OSCurrencyAmount : 0;
        subledger.totalOutstandingLocal += row.OSLocalAmount ? -row.OSLocalAmount : 0;
        subledger.totalOnAccountCreditCurr += row.DrCr === 'C' ? -row.OnAccountCreditCurr : 0;
        subledger.totalOnAccountCreditLocal += row.DrCr === 'C' ? -row.OnAccountCreditLocal : 0;
        subledger.voucherCount += 1;

        combinedGroup.totalOutstandingCurrency += row.DrCr === 'C' ? -row.OSCurrencyAmount : row.OSCurrencyAmount;
        combinedGroup.totalOutstandingLocal += row.DrCr === 'C' ? -row.OSLocalAmount : row.OSLocalAmount;
        combinedGroup.totalOnAccountCreditCurr += row.DrCr === 'C' ? -row.OnAccountCreditCurr : 0;
        combinedGroup.totalOnAccountCreditLocal += row.DrCr === 'C' ? -row.OnAccountCreditLocal : 0;
        combinedGroup.voucherCount += 1;

        // Bucket allocation (we still use OSCurrencyAmount for buckets per your previous logic)
        let placed = false;
        for (let i = 0; i < bucketRanges.length; i++) {
          if (row.Ageing <= bucketRanges[i]) {
            const label = bucketLabels[i];
            subledger.buckets[label] += row.DrCr === 'D' ? row.OSCurrencyAmount : 0;
            combinedGroup.bucketTotals[label] += row.DrCr === 'D' ? row.OSCurrencyAmount : 0;
            placed = true;
            break;
          }
        }
        if (!placed) {
          const last = bucketLabels[bucketLabels.length - 1];
          subledger.buckets[last] += row.DrCr === 'D' ? row.OSCurrencyAmount : 0;
          combinedGroup.bucketTotals[last] += row.DrCr === 'D' ? row.OSCurrencyAmount : 0;
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
      totalOnAccountCreditCurr: currGroup.totalOnAccountCreditCurr,
      totalOnAccountCreditLocal: currGroup.totalOnAccountCreditLocal,
      voucherCount: currGroup.voucherCount,
      bucketTotals: currGroup.bucketTotals,
      subledgers: Array.from(currGroup.subledgers.values()).filter(sl => sl.totalOutstandingCurrency !== 0 || sl.totalOutstandingLocal !== 0),
    }));

    // -------------------------------------------
    // 7. Grand Totals
    // -------------------------------------------
    const grandTotalLocal = ageingResult.reduce((a, b) => a + (b.totalOutstandingLocal ?? 0), 0);
    const grandTotalCurrency = ageingResult.reduce((a, b) => a + (b.totalOutstandingCurrency ?? 0), 0);
    const grandTotalOnAccountCreditCurr = ageingResult.reduce((a, b) => a + (b.totalOnAccountCreditCurr ?? 0), 0);
    const grandTotalOnAccountCreditLocal = ageingResult.reduce((a, b) => a + (b.totalOnAccountCreditLocal ?? 0), 0);
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
          SubledgerType : "Customer",
          Status: 'A'
        },
        select : { SubledgerMappingSid : true }
      });

      if(!subledger) {
        throw new BadRequestException('No subledger found.');
      }

      if(!subledger.SubledgerMappingSid) {
        throw new BadRequestException('No mapping found.');
      }

      const customer = await this._db.customerMaster.findUnique({
        where: {
          CustomerMasterSid: subledger.SubledgerMappingSid!
        },
        include : {
          customerCreditRequest : {
            where : {
              ApprovalStatus : ApprovalStatus.Approved,
              Status : 'A'
            }
          }
        }
      });

      if(!customer){
        throw new BadRequestException('No customer found.');
      }

      if(customer.CashCredit === "C" || customer.customerCreditRequest.length === 0){
        return {
          CreditDays : 0,
          CreditLimit : 0
        }
      }

      const allCreditReq = customer.customerCreditRequest || [];
      const reqWithHighestLimit = allCreditReq.reduce((acc, req) => {
        if (req.CreditLimit > acc.CreditLimit) return req;
        return acc;
      });

      return {
        CreditDays : reqWithHighestLimit.CreditDays,
        CreditLimit : reqWithHighestLimit.CreditLimit
      }

    } catch (error) {
      throw error;
    }
  }

  private async generateOutstandingReport(params: OutstandingReportQueryDto) {
    // {"ToDate":"2025-12-06T00:00:00.000Z","Ledger":54,"Subledger":59,"Branch":[50],"companyId":7}
    const {
      ToDate,
      Subledger : ledgerMasterSid,
      Ledger : coaMasterSid,
      Branch: branchId,
      companyId : CompanyMasterSid,
    } = params;
    
    try {
      this.logger.log(
        `Getting customer outstanding: CompanySid=${CompanyMasterSid}, LedgerMasterSid=${ledgerMasterSid}`,
      );

      const branches = branchId && branchId.length > 0
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

      const resolvedBranchIds = branches.map(b => b.BranchMasterSid);
      const resolvedBranchNames = branches.map(b => b.branchName);
  
      // Get customer/subledger information
      const subledger = await this._db.subledgerMaster.findUnique({
        where: { SubledgerMasterSid: ledgerMasterSid },
      });

      const ledger = await this._db.cOAMaster.findUnique({
        where:{COAMasterSid:coaMasterSid}
      })

      const userMaster = await this._db.userMaster.findMany({
        select:{
          UserMasterSid:true,
          userName:true
        }
      })

      // Fetch all active voucher transactions for this customer
      // Exclude reversed vouchers
      const voucherTransactions = await this._db.voucherTransaction.findMany({
        where: {
          CompanyMasterSid: CompanyMasterSid,
          BranchMasterSid: { in: resolvedBranchIds },
          VoucherDate : { lte : ToDate},
          COAMasterSid : coaMasterSid,
          LedgerMasterSid: ledgerMasterSid,
          Status: 'A',
        },
        include: {
          VoucherHeader: true,
          masterJob : true,
          houseJob:true,
          departmentMaster:{
            select:{departmentName:true}
          },
          voucherMatchings: {
            where: {
              Status: 'A',
            },
          },
          voucherTypeMaster: {
            select: { DocumentTypeCode: true }
          }
        },
        orderBy: {
          VoucherDate: 'asc',
        },
      });

      if (voucherTransactions.length === 0) {
        this.logger.log(`No outstanding vouchers found for LedgerMasterSid ${ledgerMasterSid}`);
        return {
          companyMasterSid: CompanyMasterSid,
          BranchMasterSid:branchId,
          branchNames: resolvedBranchNames.join(', '),
          ledgerMasterSid: ledgerMasterSid,
          subledgerName: subledger?.SubledgerName,
          ledgerName : ledger?.LedgerName,
          totalOutstandingCurrency: 0,
          totalOutstandingLocal: 0,
          voucherCount: 0,
          transactions: [],
        };
      }

      // Calculate outstanding for each transaction
      const transactions: any[] = [];
      let totalOutstandingCurrency = 0;
      let totalOutstandingLocal = 0;

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
        const outstandingLocalAmount = roundAmount(originalLocalAmount - matchedLocalAmount, 2);

        // Calculate exchange rate
        const exchangeRate = originalCurrencyAmount !== 0
          ? roundAmount(originalLocalAmount / originalCurrencyAmount, 4)
          : 1.0;

        // Only include if there's outstanding balance
        if (Math.abs(outstandingCurrencyAmount) > 0 || Math.abs(outstandingLocalAmount) > 0) {
          transactions.push({
            voucherTransactionSid: vt.VoucherTransactionSid,
            voucherHeaderSid: vt.VoucherHeaderSid,
            voucherDetailSid: vt.VoucherDetailSid,
            voucherNumber: vt.VoucherNumber,
            voucherDate: vt.VoucherDate,
            voucherTypeMasterSid: vt.VoucherTypeMasterSid,
            ledgerMasterSid: vt.LedgerMasterSid!,
            coaMasterSid: vt.COAMasterSid!,
            MasterJobNumber : vt.masterJob?.MasterJobNumber,
            HouseJobNumber : vt.houseJob?.HBLNo,
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
            chargeDescription: vt.ChargeDescription || "",
            deptname:vt.departmentMaster?.departmentName,
            salesmanSid: userMaster.find(u=>u.UserMasterSid === vt.houseJob?.SalesmanSid)?.userName || '',
            naration:vt.Narration,
          });

          totalOutstandingCurrency += outstandingCurrencyAmount;
          totalOutstandingLocal += outstandingLocalAmount;
        }
      }

      const response = {
        companyMasterSid: CompanyMasterSid,
        branchMasterSid : branchId,
        branchNames: resolvedBranchNames.join(', '),
        ledgerMasterSid: ledgerMasterSid!,
        subledgerName: subledger?.SubledgerName,
        ledgerName : ledger?.LedgerName,
        totalOutstandingCurrency: roundAmount(totalOutstandingCurrency, 2),
        totalOutstandingLocal: roundAmount(totalOutstandingLocal, 2),
        voucherCount: transactions.length,
        transactions: transactions,
        params : params,
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

  private async generateStatementLedgerReport(params: StatementLedgerReportQueryDto) {
     const {
      FromDate,
      ToDate,
      Subledger : ledgerMasterSid,
      Ledger : coaMasterSid,
      Branch: branchId,
      companyId : CompanyMasterSid,
    } = params;
    
    try {
      this.logger.log(
        `Getting customer outstanding: CompanySid=${CompanyMasterSid}, LedgerMasterSid=${ledgerMasterSid}`,
      );

      const branches = branchId && branchId.length > 0
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

      const resolvedBranchIds = branches.map(b => b.BranchMasterSid);
      const resolvedBranchNames = branches.map(b => b.branchName);
  
      // Get customer/subledger information
      const subledger = await this._db.subledgerMaster.findUnique({
        where: { SubledgerMasterSid: ledgerMasterSid },
      });

      const ledger = await this._db.cOAMaster.findUnique({
        where:{COAMasterSid:coaMasterSid}
      })

      const userMaster =  await this._db.userMaster.findMany({
        select:{
          UserMasterSid:true,
          userName:true
        }
      })

      const voucherTransactions = await this._db.voucherTransaction.findMany({
        where: {
          CompanyMasterSid: CompanyMasterSid,
          BranchMasterSid: { in: resolvedBranchIds },
          AND : [
            { VoucherDate : {gte : FromDate}},
            { VoucherDate : { lte : ToDate}}
          ],
          COAMasterSid : coaMasterSid,
          LedgerMasterSid: ledgerMasterSid,
          Status: 'A',
        },
        include: {
          VoucherHeader: true,
          masterJob : true,
          houseJob:true,
          departmentMaster:{
            select:{departmentName:true}
          },
          voucherMatchings: {
            where: {
              Status: 'A',
            },
          },
          voucherTypeMaster: {
            select: { DocumentTypeCode: true }
          }
        },
        orderBy: {
          VoucherDate: 'asc',
        },
      });

      if (voucherTransactions.length === 0) {
        this.logger.log(`No outstanding vouchers found for LedgerMasterSid ${ledgerMasterSid}`);
        return {
          companyMasterSid: CompanyMasterSid,
          branchMasterSid : branchId,
          ledgerMasterSid: ledgerMasterSid,
          COAMasterSid : coaMasterSid,
          subledgerName: subledger?.SubledgerName,
          ledgerName : ledger?.LedgerName,
          totalOutstandingCurrency: 0,
          totalOutstandingLocal: 0,
          voucherCount: 0,
          transactions: [],
        };
      }

      // Calculate outstanding for each transaction
      const transactions: any[] = [];
      let totalOutstandingCurrency = 0;
      let totalOutstandingLocal = 0;

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
        const outstandingLocalAmount = roundAmount(originalLocalAmount - matchedLocalAmount, 2);

        // Calculate exchange rate
        const exchangeRate = originalCurrencyAmount !== 0
          ? roundAmount(originalLocalAmount / originalCurrencyAmount, 4)
          : 1.0;

        // Only include if there's outstanding balance
        if (Math.abs(outstandingCurrencyAmount) > 0 || Math.abs(outstandingLocalAmount) > 0) {
          transactions.push({
            voucherTransactionSid: vt.VoucherTransactionSid,
            voucherHeaderSid: vt.VoucherHeaderSid,
            voucherDetailSid: vt.VoucherDetailSid,
            voucherNumber: vt.VoucherNumber,
            voucherDate: vt.VoucherDate,
            voucherTypeMasterSid: vt.VoucherTypeMasterSid,
            ledgerMasterSid: vt.LedgerMasterSid!,
            coaMasterSid: vt.COAMasterSid!,
            MasterJobNumber : vt.masterJob?.MasterJobNumber,
            HouseJobNumber : vt.houseJob?.HBLNo,
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
            chargeDescription: vt.ChargeDescription || "",
            deptname:
              vt.departmentMaster?.departmentName &&
                !vt.departmentMaster.departmentName.toLowerCase().includes('air')
                ? vt.departmentMaster.departmentName
                : null,
            salesmanSid: userMaster.find(u=>u.UserMasterSid ===vt.houseJob?.SalesmanSid)?.userName || '',
             naration:vt.Narration
          });

          totalOutstandingCurrency += outstandingCurrencyAmount;
          totalOutstandingLocal += outstandingLocalAmount;
        }
      }

      const response = {
        companyMasterSid: CompanyMasterSid,
        branchMasterSid : branchId,
        ledgerMasterSid: ledgerMasterSid!,
        subledgerName: subledger?.SubledgerName,
        ledgerName : ledger?.LedgerName,
        totalOutstandingCurrency: roundAmount(totalOutstandingCurrency, 2),
        totalOutstandingLocal: roundAmount(totalOutstandingLocal, 2),
        voucherCount: transactions.length,
        transactions: transactions,
        branchNames: resolvedBranchNames.join(', '),
        params : params,
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

  // private async generateTrialBalance(params: TrialBalanceReportQueryDto) {
  //   const {
  //     FromDate,
  //     ToDate,
  //     GroupName,
  //     SubGroupName,
  //     SubTotal = true,
  //     Branch,
  //     companyId: CompanyMasterSid,
  //   } = params;

  //   try {
  //     this.logger.log(`Getting customer trial balance: CompanySid=${CompanyMasterSid}`);

  //     // --- 1. Fetch branch names ---
  //     const allBranches = await this._db.branchMaster.findMany({
  //       where: {
  //         BranchMasterSid: { in: Branch },
  //       },
  //       select: {
  //         branchName: true,
  //       },
  //     });

  //     const branchSet = new Set(allBranches.map(b => b.branchName));

  //     // --- 2. Fetch ledger based on Group/SubGroup ---
  //     const ledger = await this._db.cOAMaster.findFirst({
  //       where: {
  //         GroupName,
  //         SubGroupName,
  //       },
  //     });

  //     if (!ledger) {
  //       this.logger.log(`No ledger found for Group=${GroupName} SubGroup=${SubGroupName}`);
  //       return null;
  //     }

  //     const coaMasterSid = ledger.COAMasterSid;

  //     // --- 3. Fetch voucher transactions ---
  //     const voucherTransactions = await this._db.voucherTransaction.findMany({
  //       where: {
  //         CompanyMasterSid,
  //         BranchMasterSid: { in: Branch },
  //         AND: [
  //           { VoucherDate: { lte: ToDate } }, 
  //         ],
  //         COAMasterSid: coaMasterSid,
  //         Status: 'A',
  //       },
  //       include: {
  //         coaMaster: {
  //           select: {
  //             GroupName: true,
  //             SubGroupName: true,
  //             LedgerType: true,
  //             LedgerName: true,
  //             COAMasterSid: true,
  //           },
  //         },
       
  //       },
  //       orderBy: { VoucherDate: 'asc' },
  //     });

  //     if (!voucherTransactions.length) {
  //       this.logger.log(`No voucher transactions found for COAMasterSid ${coaMasterSid}`);
  //       return {
  //         companyMasterSid: CompanyMasterSid,
  //         BranchMasterSid: Branch,
  //         COAMasterSid: coaMasterSid,
  //         subGroupName: ledger.SubGroupName,
  //         groupName: ledger.GroupName,
  //         ledgerName: ledger.LedgerName,
  //         totalOutstandingCurrency: 0,
  //         totalOutstandingLocal: 0,
  //         voucherCount: 0,
  //         transactions: [],
  //       };
  //     }

  //     // --- 4. Build Group → SubGroup → Ledger map ---
  //     const groupMap = new Map<string, Map<string, Map<number, any[]>>>();

  //     for (const vt of voucherTransactions) {
  //       const groupKey = vt.coaMaster?.GroupName!;
  //       const subGroupKey = vt.coaMaster?.SubGroupName!;
  //       const ledgerKey = vt.COAMasterSid!;

  //       if (!groupMap.has(groupKey)) groupMap.set(groupKey, new Map());
  //       const subGroupMap = groupMap.get(groupKey)!;

  //       if (!subGroupMap.has(subGroupKey)) subGroupMap.set(subGroupKey, new Map());
  //       const ledgerMap = subGroupMap.get(subGroupKey)!;

  //       if (!ledgerMap.has(ledgerKey)) ledgerMap.set(ledgerKey, []);
  //       ledgerMap.get(ledgerKey)!.push(vt);
  //     }

  //     // --- 5. Calculate totals for each ledger ---
  //     const result: any[] = [];

  //     for (const [groupName, subGroupMap] of groupMap.entries()) {
  //       for (const [subGroupName, ledgerMap] of subGroupMap.entries()) {
  //         for (const [ledgerId, transactions] of ledgerMap.entries()) {
  //           const openingDrAmt = transactions
  //             .filter(v => v.VoucherDate < FromDate && v.DrCr === "D")
  //             .reduce((s, v) => s + v.LocalAmount, 0);

  //           const openingCrAmt = transactions
  //             .filter(v => v.VoucherDate < FromDate && v.DrCr === "C")
  //             .reduce((s, v) => s + v.LocalAmount, 0);

  //           const currentDrAmt = transactions
  //             .filter(v => v.VoucherDate >= FromDate && v.VoucherDate <= ToDate && v.DrCr === "D")
  //             .reduce((s, v) => s + v.LocalAmount, 0);

  //           const currentCrAmt = transactions
  //             .filter(v => v.VoucherDate >= FromDate && v.VoucherDate <= ToDate && v.DrCr === "C")
  //             .reduce((s, v) => s + v.LocalAmount, 0);

  //           const closingDrAmt = openingDrAmt + currentDrAmt;
  //           const closingCrAmt = openingCrAmt + currentCrAmt;
  //           const netClosingAmt = closingDrAmt - closingCrAmt;

  //           result.push({
  //             groupName,
  //             subGroupName,
  //             ledgerId,
  //             ledgerName: transactions[0].coaMaster.LedgerName,

  //             openingDrAmt,
  //             openingCrAmt,
  //             currentDrAmt,
  //             currentCrAmt,

  //             closingDrAmt,
  //             closingCrAmt,
  //             netClosingAmt,

  //             allTransactions : transactions,
  //           });
  //         }
  //       }
  //     }

  //     // --- 6. Return final structured result ---
  //     return {
  //       companyMasterSid: CompanyMasterSid,
  //       branches: Branch,
  //       groupData: result,
  //     };
  //   } catch (error) {
  //     this.logger.error(
  //       `Error getting customer trial balance for ${CompanyMasterSid}: ${error.message}`,
  //       error.stack,
  //     );
  //     throw error;
  //   }
  // }

  private async generateProfitLoss(params: ProfitLossReportQueryDto) {
    const {
      ToDate,
      FromDate,
      branchId: Branch,
      companyId: CompanyMasterSid,
      COAMasterSid,
    } = params;

    try {
      this.logger.log(
        `Getting customer profit and loss: CompanySid=${CompanyMasterSid}`,
      );

        const branches = Branch && Branch.length > 0
        ? await this._db.branchMaster.findMany({
          where: { BranchMasterSid: { in: Branch } },
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

      const resolvedBranchIds = branches.map(b => b.BranchMasterSid);
      const resolvedBranchNames = branches.map(b => b.branchName);
      const voucherTransactions = await this._db.voucherTransaction.findMany({
        where: {
          CompanyMasterSid,
          BranchMasterSid: { in: resolvedBranchIds },
          VoucherDate: {
            gte: FromDate,
            lte: ToDate,
          },
          Status: 'A',

          ...(COAMasterSid && { coaMasterSid: COAMasterSid }),

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

      for (const vt of voucherTransactions) {
        if (!vt.coaMaster || !vt.yearMaster) continue;

        const { Category, GroupName, SubGroupName, LedgerName } = vt.coaMaster;
        const yearCode = vt.yearMaster.YearCode;

       
        const amount = vt.LocalAmount.toNumber();

        const signedAmount =
          vt.DrCr === 'C' ? amount : vt.DrCr === 'D' ? amount * -1 : 0;

       
        const key = `${Category}|${GroupName}|${SubGroupName}|${LedgerName}`;

        if (!profitLossMap.has(key)) {
          profitLossMap.set(key, {
            Category,
            GroupName,
            SubGroupName,
            LedgerName,
            amounts: {} as Record<number, number>,
          });
        }
        const row = profitLossMap.get(key);
        row.amounts[yearCode] = (row.amounts[yearCode] || 0) + signedAmount;
      }

      const profitLoss = Array.from(profitLossMap.values());

      return {
        CompanyMasterSid,
        branchNames: resolvedBranchNames.join(', '),
        fromDate: FromDate,
        toDate: ToDate,
        params,
        profitLoss,
      };

    } catch (error) {
      this.logger.error(
        `Error getting customer profit and loss for ${CompanyMasterSid}: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  private async generateLedgerReport(params: LedgerReportQueryDto) {
     const {
      FromDate,
      ToDate,
      Subledger : ledgerMasterSid,
      Ledger : coaMasterSid,
      Branch: branchId,
      companyId : CompanyMasterSid,
    } = params;
    
    try {
      this.logger.log(
        `Getting ledger report: CompanySid=${CompanyMasterSid}, LedgerMasterSid=${ledgerMasterSid}`,
      );

      const branches = branchId && branchId.length > 0
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

      const resolvedBranchIds = branches.map(b => b.BranchMasterSid);
      const resolvedBranchNames = branches.map(b => b.branchName);
  
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


      const userMaster =  await this._db.userMaster.findMany({
        select:{
          UserMasterSid:true,
          userName:true
        }
      })

      const voucherTransactions = await this._db.voucherTransaction.findMany({
        where: {
          CompanyMasterSid: CompanyMasterSid,
          BranchMasterSid: { in: resolvedBranchIds },
          AND : [
            { VoucherDate : {gte : FromDate}},
            { VoucherDate : { lte : ToDate}}
          ],
    ...(coaMasterSid && { COAMasterSid: coaMasterSid }),
    ...(ledgerMasterSid && { LedgerMasterSid: ledgerMasterSid }),
          Status: 'A',
        },
        include: {
          VoucherHeader: true,
          masterJob : true,
          houseJob:true,
          departmentMaster:{
            select:{departmentName:true}
          },
          voucherMatchings: {
            where: {
              Status: 'A',
            },
          },
          voucherTypeMaster: {
            select: { DocumentTypeCode: true }
          }
        },
        orderBy: {
          VoucherDate: 'asc',
        },
      });

      if (voucherTransactions.length === 0) {
        this.logger.log(`No Ledger Report found for LedgerMasterSid ${ledgerMasterSid}`);
        return {
          companyMasterSid: CompanyMasterSid,
          branchMasterSid : branchId,
          ledgerMasterSid: ledgerMasterSid || null,
          COAMasterSid : coaMasterSid || null,
          subledgerName: subledger?.SubledgerName,
          ledgerName : ledger?.LedgerName,
          totalOutstandingCurrency: 0,
          totalOutstandingLocal: 0,
          voucherCount: 0,
          transactions: [],
        };
      }

      // Calculate outstanding for each transaction
      const transactions: any[] = [];
      let totalOutstandingCurrency = 0;
      let totalOutstandingLocal = 0;

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
        const outstandingLocalAmount = roundAmount(originalLocalAmount - matchedLocalAmount, 2);

        // Calculate exchange rate
        const exchangeRate = originalCurrencyAmount !== 0
          ? roundAmount(originalLocalAmount / originalCurrencyAmount, 4)
          : 1.0;

        // Only include if there's outstanding balance
        if (Math.abs(outstandingCurrencyAmount) > 0 || Math.abs(outstandingLocalAmount) > 0) {
          transactions.push({
            voucherTransactionSid: vt.VoucherTransactionSid,
            voucherHeaderSid: vt.VoucherHeaderSid,
            voucherDetailSid: vt.VoucherDetailSid,
            voucherNumber: vt.VoucherNumber,
            voucherDate: vt.VoucherDate,
            voucherTypeMasterSid: vt.VoucherTypeMasterSid,
            ledgerMasterSid: vt.LedgerMasterSid!,
            coaMasterSid: vt.COAMasterSid!,
            MasterJobNumber : vt.masterJob?.MasterJobNumber,
            HouseJobNumber : vt.houseJob?.HBLNo,
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
            chargeDescription: vt.ChargeDescription || "",
            deptname:
              vt.departmentMaster?.departmentName &&
                !vt.departmentMaster.departmentName.toLowerCase().includes('air')
                ? vt.departmentMaster.departmentName
                : null,
            salesmanSid: userMaster.find(u=>u.UserMasterSid ===vt.houseJob?.SalesmanSid)?.userName || '',
            naration:vt.Narration
          });

          totalOutstandingCurrency += outstandingCurrencyAmount;
          totalOutstandingLocal += outstandingLocalAmount;
        }
      }

      const response = {
        companyMasterSid: CompanyMasterSid,
        branchMasterSid : branchId,
        ledgerMasterSid: ledgerMasterSid!,
        subledgerName: subledger?.SubledgerName,
        ledgerName : ledger?.LedgerName,
        totalOutstandingCurrency: roundAmount(totalOutstandingCurrency, 2),
        totalOutstandingLocal: roundAmount(totalOutstandingLocal, 2),
        voucherCount: transactions.length,
        transactions: transactions,
        branchNames: resolvedBranchNames.join(', '),
        params : params,
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

  private async generateBalanceSheet(params: BalanceSheetReportQueryDto) {
    const {
      companyId: CompanyMasterSid,
      FromDate,
      ToDate,
      branchId: Branch
    } = params;

    try {
      this.logger.log(
        `Getting Balance Sheet : CompanySid=${CompanyMasterSid}`,
      );

      const branches = Branch && Branch.length > 0
        ? await this._db.branchMaster.findMany({
          where: { BranchMasterSid: { in: Branch } },
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

      const resolvedBranchIds = branches.map(b => b.BranchMasterSid);
      const resolvedBranchNames = branches.map(b => b.branchName);

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
            },
          },
          yearMaster: true
        },
      });

      let totalIncome = 0;
      let totalExpense = 0;

      const groupedMap = new Map<string, any>();
      const data: any[] = [];

      voucherData.forEach(v => {
        if (!v.coaMaster || !v.yearMaster) return;

        const amount = v.LocalAmount.toNumber();

        const signedAmount =
          v.DrCr === 'C' ? amount :
            v.DrCr === 'D' ? amount * -1 :
              0;

        const category = v.coaMaster.Category;
      
        if (category === 'Income') {
          totalIncome += signedAmount;
          return;
        }

        if (category === 'Expense') {
          totalExpense += signedAmount;
          return;
        }

        if (category === 'Asset' || category === 'Liability') {
          const key = [
            category,
            v.coaMaster.GroupName,
            v.coaMaster.SubGroupName,
            v.coaMaster.LedgerName
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

      return {
        incomeTotal: Math.abs(totalIncome),
        expenseTotal: Math.abs(totalExpense),
        data,
        CompanyMasterSid,
        BranchMasterSid: Branch,
        params,
        branchNames: resolvedBranchNames.join(', '),
      };

    } catch (error) {
      this.logger.error(
        `Error generating Balance sheet report: ${error.message}`,
        error.stack
      );
      throw error;
    }
  }

  private async generateVATReceivableReport(params: VATReportQueryDto) {
    const {
      VoucherFromDate : FromDate,
      VoucherToDate : ToDate,
      companyId: CompanyMasterSid,
      coamasterSid
    } = params

    try {
      this.logger.log(
        `Getting VAT Report: CompanySid=${CompanyMasterSid}`,
      );

      // oragnizaton master

      const oragnizatonMaster = await this._db.customerMaster.findMany({
        select: {
          CustomerMasterSid: true,
          CustomerName: true,
          PanType: true,
        }
      })

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
      customerSubledger.forEach(v => {
        if (v.subledgerMaster?.SubledgerName) {
          subledgerMap.set(v.VoucherHeaderSid, v.subledgerMaster.SubledgerName);
        }
      });


      const panTypeMap = new Map<string, string>();

      oragnizatonMaster.forEach(c => {
        if (c.CustomerName) {
          panTypeMap.set(c.CustomerName.trim(), c.PanType || '');
        }
      });

      /* STEP 2: VAT transactions */
      const voucherData = await this._db.voucherTransaction.findMany({
        where: {
          CompanyMasterSid,
         AND : [
            { VoucherDate : {gte : FromDate}},
            { VoucherDate : { lte : ToDate}}
          ],
          Status: 'A',
          COAMasterSid: coamasterSid,
        },
        include: {
          VoucherHeader: {
            select: {
              VoucherNumber: true,
              VoucherDate: true,
              VoucherType: true,
              VoucherTypeMasterSid: true,
              DocumentDate: true,
              DocumentNumber: true
            }
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


      voucherData.forEach(v => {


        const ledgerType = v.coaMaster?.LedgerType;

        const voucherType1 =
          v.VoucherTypeMasterSid === 1
            ? 'Sales' : ''


        const voucherType2 = v.VoucherTypeMasterSid === 2
          ? 'Purchase'
          : 'Journal'
          ;

        const isVendorInvoice =
          v.VoucherHeader?.VoucherTypeMasterSid === 2;

        const documentNo = isVendorInvoice
          ? v.VoucherHeader?.DocumentNumber ?? ''
          : '';

        const documentDate = isVendorInvoice
          ? v.VoucherHeader?.DocumentDate ?? null
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
          documentDate
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

  private async generateUnpostedVoucherList(params: UnpostedVoucherListReportQueryDto) {
    const {
      VoucherFromDate: FromDate,
      VoucherToDate: ToDate,
      companyId: CompanyMasterSid,
      branchId: Branch
    } = params;

    try {
      this.logger.log(
        `Getting Unposted Voucher List : companySid=${CompanyMasterSid}`
      );



      const branches = Branch && Branch.length > 0
        ? await this._db.branchMaster.findMany({
          where: { BranchMasterSid: { in: Branch } },
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

      const resolvedBranchIds = branches.map(b => b.BranchMasterSid);
      const resolvedBranchNames = branches.map(b => b.branchName);


      const voucherData = await this._db.voucherHeader.findMany({
        where: {
          CompanyMasterSid,
          BranchMasterSid: { in: resolvedBranchIds },
          VoucherDate: {
            gte: FromDate,
            lte: ToDate,
          },
          Status: 'A'
        },
        include: {
          voucherTypeMaster: {
            select: {
              DocumentTypeName: true
            }
          }
        },
        orderBy: [
          { voucherTypeMaster : {DocumentTypeName : 'asc'}},
          { VoucherDate: 'asc' }
        ]
      });


      const data = voucherData
        .filter(v => v.PostStatus === 'U')
        
        .map(v => ({
          voucherNo: v.VoucherNumber,
          voucherDate: v.VoucherDate,
          voucherType: v.voucherTypeMaster?.DocumentTypeName,
          createdBy: v.CreatedBy,
          createdOn: v.CreatedOn,
          postStatus: v.PostStatus,
          branch: branches.find(b => b.BranchMasterSid === v.BranchMasterSid)?.branchName || '',
          party: v.PartyName,
        }));

      return {
        tableData: data,
        params,
        CompanyMasterSid,
        branchNames: resolvedBranchNames.join(', ')
      };

    } catch (error) {
      this.logger.error(error);
      throw error;
    }
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

  private async generateTopNCustomerReport(params: TopNCustomerReportQueryDto) {
    const {
      FromDate,
      ToDate,
      companyId: CompanyMasterSid,
      branchId: Branch,
      Dept: deptId,
      TopN: topN,
      Volume,
      GP
    } = params

    try {

      this.logger.log(
        `Getting top N Customer: CompanySid=${CompanyMasterSid}`,
      );

      const branches = Branch && Branch.length > 0
        ? await this._db.branchMaster.findMany({
          where: { BranchMasterSid: { in: Branch } },
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

      const resolvedBranchIds = branches.map(b => b.BranchMasterSid);
      const resolvedBranchNames = branches.map(b => b.branchName);

      const excludedDepartments = ['Air Export', 'Air Import'];
      const departments = deptId && deptId.length > 0
        ? await this._db.departmentMaster.findMany({
          where: {
            DepartmentMasterSid: { in: deptId },
            departmentName: { notIn: excludedDepartments }
          },
          select: { DepartmentMasterSid: true, departmentName: true },
        })
        : await this._db.departmentMaster.findMany({
          where: {
            CompanyMasterSid,
            departmentName: { notIn: excludedDepartments }
          },
          select: { DepartmentMasterSid: true, departmentName: true },
        });

      const resolvedDeptIds = departments.map(d => d.DepartmentMasterSid);
      const resolvedDeptNames = departments.map(d => d.departmentName);

      const customerMaster = await this._db.customerMaster.findMany({
        select: { CustomerMasterSid: true, CustomerName: true }
      })

      const masterJobs = await this._db.masterJob.findMany({
        where: {
          CompanyMasterSid,
          AND: [
            { MBLDate: { gte: FromDate } },
            { MBLDate: { lte: ToDate} }
          ],
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
        return { companyMasterSid: CompanyMasterSid, branchMasterSid: Branch, data: [] };
      }

      let data = await Promise.all(
        masterJobs.map(async job => {
          const relatedCR = await this._db.costRevenueCharges.findMany({
            where: {
              MenuMasterSid: job.MenuMasterSid!,
              TransactionSid: job.MasterJobSid,
              status: 'A'
            },
            select: {
              CostLocalAmount: true,
              RevenueLocalAmount: true,
              RevenueCustomerMasterSid: true,
              CostDrCr: true,
              RevenueDrCr: true
            }
          });

          const customerWiseMap = new Map<
            number,
            { cost: number; revenue: number }
          >();

          const addToCustomerMap = (
            customerSid: number,
            cost: number,
            revenue: number
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

          relatedCR.forEach(cr => {
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
          const houseJobIds = houseJobs.map(h => h.HouseJobSid);

          const houseJobMenu = await this._db.menuMaster.findFirst({
            where: { MenuName: 'House Job' },
            select: { MenuMasterSid: true }
          });

          if (!houseJobMenu) {
            throw new BadRequestException('House Job not found in MenuMaster');
          }

          const allHouseCR = await this._db.costRevenueCharges.findMany({
            where: {
              MenuMasterSid: houseJobMenu.MenuMasterSid,
              TransactionSid: { in: houseJobIds },
              status: 'A'
            },
            select: {
              TransactionSid: true,
              CostLocalAmount: true,
              RevenueLocalAmount: true,
              RevenueCustomerMasterSid: true,
              CostDrCr: true,
              RevenueDrCr: true
            }
          });

          const houseRateMap = new Map<number, any[]>();

          allHouseCR.forEach(cr => {
            const key = cr.TransactionSid!;
            if (!houseRateMap.has(key)) {
              houseRateMap.set(key, []);
            }
            houseRateMap.get(key)!.push(cr);
          });

          let totalHouseCost = 0;
          let totalHouseRevenue = 0;

          const houseJobsData = houseJobs.map(house => {
            const costRevenues = houseRateMap.get(house.HouseJobSid) || [];

            let houseCost = 0;
            let houseRevenue = 0;

            costRevenues.forEach(cr => {
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
              totalRevenue: houseRevenue
            };
          });

          const totalCostWithHouse = totalCost + totalHouseCost;
          const totalRevenueWithHouse = totalRevenue + totalHouseRevenue;
          const GP = totalRevenueWithHouse - totalCostWithHouse;
          const customerSummary = Array.from(customerWiseMap.entries()).map(
            ([customerSid, val]) => ({
              customerSid,
              customerName:
                customerMaster.find(c => c.CustomerMasterSid === customerSid)
                  ?.CustomerName || '',
              totalCost: val.cost,
              totalRevenue: val.revenue,
              GP: val.revenue - val.cost
            })
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
            houseJobs: houseJobsData
          };
        })
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


      data.forEach(job => {
        job.customerSummary.forEach(cust => {
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
              noOfShipment: 0
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

      if (GP) {
        customerData = customerData.sort((a, b) => b.GP - a.GP);
      } else if (Volume) {
        customerData = customerData.sort((a, b) => b.Vol - a.Vol);
      }

      const limit = Number(topN) || customerData.length;
      customerData = customerData.slice(0, limit);

      console.log('After slice:', data.length);
      return {
        companyMasterSid: CompanyMasterSid,
        branchMasterSid: Branch,
        data: customerData,
        branchNames: resolvedBranchNames.join(', '),
        departmentNames: resolvedDeptNames.join(', '),
        params,
        topN
      };
    } catch (error) {
      this.logger.error(
        `Error getting Top N Customer for ${CompanyMasterSid}: ${error.message}`,
        error.stack,
      );
      throw error;
    }
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
   * Supports cascading dropdowns via DependsOnParameter field
   */
  async executeParameterQuery(
    parameterId: number,
    context: { companyId?: number; branchId?: number; [key: string]: any }
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

      // If this parameter depends on another, check if parent value is provided
      if (parameter.DependsOnParameter) {
        const parentValue = context[parameter.DependsOnParameter];
        if (parentValue === undefined || parentValue === null || parentValue === '') {
          // Parent not selected, return empty array
          this.logger.log(`Parameter ${parameter.ParameterName} depends on ${parameter.DependsOnParameter} which is not provided`);
          return [];
        }
      }

      // Validate and sanitize the query
      this.validateQuery(parameter.ParameterQuery);

      // Substitute context variables in the query
      let query = parameter.ParameterQuery;

      // Standard substitutions
      if (context.companyId) {
        query = query.replace(/\{companyId\}/g, context.companyId.toString());
      }
      if (context.branchId) {
        query = query.replace(/\{branchId\}/g, context.branchId.toString());
      }

      // Dynamic parent parameter substitutions (e.g., {Ledger}, {Subledger})
      for (const [key, value] of Object.entries(context)) {
        if (key !== 'companyId' && key !== 'branchId' && value !== undefined && value !== null) {
          const placeholder = new RegExp(`\\{${key}\\}`, 'g');
          query = query.replace(placeholder, this.sanitizeValue(value));
        }
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
   * Sanitize value for SQL query substitution to prevent SQL injection
   */
  private sanitizeValue(value: any): string {
    if (typeof value === 'number') {
      return value.toString();
    }
    if (typeof value === 'string') {
      // Escape single quotes to prevent SQL injection
      return value.replace(/'/g, "''");
    }
    if (Array.isArray(value)) {
      return value.map(v => this.sanitizeValue(v)).join(',');
    }
    return String(value);
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
