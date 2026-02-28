import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { DatabaseService } from 'src/database/database.service';
import { AccountsReportsService } from 'src/accounts/services/accounts-reports/accounts-reports.service';
import { BalanceSheetReportQueryDto, ProfitLossReportQueryDto } from 'src/accounts/dto/accounts-reports.dto';

@Injectable()
export class ManagementReportsService {
  constructor(
    private _db: DatabaseService,
    private accountsReportsService: AccountsReportsService,
    private logger: Logger,
  ) {}

  async getAvailableReports(companyId: number): Promise<any[]> {
    try {
      const managementMenu = await this._db.menuMaster.findFirst({
        where: {
          MenuName: 'Management Reports',
          status: 'A',
        },
      });
      if (!managementMenu) {
        return [];
      }

      const allReports = await this._db.reportMaster.findMany({
        where: {
          ReportMenuSid: managementMenu.MenuMasterSid,
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

  async getReportParameters(reportName: string): Promise<any> {
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

  async generateReport(reportName: string, parameters: any): Promise<any> {
    try {
      // Route to specific report generator
      switch (reportName) {
        case 'profit-loss':
          return await this.generateProfitLoss(parameters);
        case 'balance-sheet':
          return await this.generateBalanceSheet(parameters);
        default:
          throw new BadRequestException(`Report ${reportName} not implemented`);
      }
    } catch (error) {
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
        BranchInvolved,
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
            },
          },
          yearMaster: true,
        },
      });

      let totalIncome = 0;
      let totalExpense = 0;

      const groupedMap = new Map<string, any>();
      const data: any[] = [];

      voucherData.forEach((v) => {
        if (!v.coaMaster || !v.yearMaster) return;

        const amount = v.LocalAmount.toNumber();

        const signedAmount =
          v.DrCr === 'C' ? amount : v.DrCr === 'D' ? amount * -1 : 0;

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

      return {
        incomeTotal: Math.abs(totalIncome),
        expenseTotal: Math.abs(totalExpense),
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

  async exportReport(reportName: string, exportParams: any): Promise<any> {
    return this.accountsReportsService.exportReport(reportName, exportParams);
  }

  async emailReport(reportName: string, emailParams: any): Promise<any> {
    return this.accountsReportsService.emailReport(reportName, emailParams);
  }

  async executeParameterQuery(
    parameterId: number,
    context: { companyId?: number; branchId?: number; [key: string]: any },
  ): Promise<Array<{ value: any; label: string }>> {
    return this.accountsReportsService.executeParameterQuery(parameterId, context);
  }
}
