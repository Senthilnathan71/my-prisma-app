import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { DatabaseService } from 'src/database/database.service';
import { Prisma } from '@prisma/client';

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
          return await this.generateAgeingReport(parameters);
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

  // Report generators - To be implemented
  private async generateAgeingReport(params: any) {
    // TODO: Implement ageing report logic
    this.logger.log('generateAgeingReport called with params:', params);
    throw new BadRequestException('Ageing Report generator not yet implemented');
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
