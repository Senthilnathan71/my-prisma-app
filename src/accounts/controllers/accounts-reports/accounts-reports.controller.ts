import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Logger,
  Param,
  ParseIntPipe,
  Post,
  Query,
  UnauthorizedException
} from '@nestjs/common';
import { ApiCreatedResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ResponseData } from 'src/common/response-data';
import { AccountsReportsService } from 'src/accounts/services/accounts-reports/accounts-reports.service';

@ApiTags('Accounts Reports')
@Controller('accounts/reports')
export class AccountsReportsController {
  constructor(
    private accountsReportsService: AccountsReportsService,
    private logger: Logger,
  ) { }

  @ApiOperation({ summary: 'Get all available accounts reports for company' })
  @ApiCreatedResponse({ description: 'Fetch available reports', type: ResponseData })
  @HttpCode(HttpStatus.OK)
  @Get()
  async getAvailableReports(@Query('companyId', ParseIntPipe) companyId: number) {
    const resp = new ResponseData();
    try {
      const reports = await this.accountsReportsService.getAvailableReports(companyId);
      this.logger.log(`getAvailableReports for company ${companyId}: ${reports.length} reports found`);
      resp.data = reports;
      resp.message = 'Available reports fetched successfully';
    } catch (error) {
      this.logger.warn(`getAvailableReportsError: ${JSON.stringify(error)}`);
      resp.status = false;
      resp.message = error instanceof BadRequestException || error instanceof UnauthorizedException
        ? error.message
        : 'Internal Server Error';
    }
    return resp;
  }

  @ApiOperation({ summary: 'Get report parameters' })
  @ApiCreatedResponse({ description: 'Fetch report parameters', type: ResponseData })
  @HttpCode(HttpStatus.OK)
  @Get(':reportName/parameters')
  async getReportParameters(@Param('reportName') reportName: string) {
    const resp = new ResponseData();
    try {
      const parameters = await this.accountsReportsService.getReportParameters(reportName);
      this.logger.log(`getReportParameters for ${reportName}`);
      resp.data = parameters;
      resp.message = 'Report parameters fetched successfully';
    } catch (error) {
      this.logger.warn(`getReportParametersError: ${JSON.stringify(error)}`);
      resp.status = false;
      resp.message = error instanceof BadRequestException || error instanceof UnauthorizedException
        ? error.message
        : 'Internal Server Error';
    }
    return resp;
  }

  @ApiOperation({ summary: 'Generate report data' })
  @ApiCreatedResponse({ description: 'Generate report with given parameters', type: ResponseData })
  @HttpCode(HttpStatus.OK)
  @Post(':reportName/generate')
  async generateReport(
    @Param('reportName') reportName: string,
    @Body() parameters: any
  ) {
    const resp = new ResponseData();
    try {
      this.logger.log(`generateReport: ${reportName} with parameters: ${JSON.stringify(parameters)}`);
      const reportData = await this.accountsReportsService.generateReport(reportName, parameters);
      this.logger.debug(`generated reportData: ${JSON.stringify(reportData)}`);
      resp.data = reportData;
      resp.message = `${reportName} generated successfully`;
    } catch (error) {
      this.logger.warn(`generateReportError: ${JSON.stringify(error),error}`);
      resp.status = false;
      resp.message = error instanceof BadRequestException || error instanceof UnauthorizedException
        ? error.message
        : 'Internal Server Error';
    }
    return resp;
  }

  @ApiOperation({ summary: 'Export report' })
  @ApiCreatedResponse({ description: 'Export report to Excel or PDF', type: ResponseData })
  @HttpCode(HttpStatus.OK)
  @Post(':reportName/export')
  async exportReport(
    @Param('reportName') reportName: string,
    @Body() exportParams: any
  ) {
    const resp = new ResponseData();
    try {
      this.logger.log(`exportReport: ${reportName} as ${exportParams.format}`);
      const exportData = await this.accountsReportsService.exportReport(reportName, exportParams);
      resp.data = exportData;
      resp.message = 'Report exported successfully';
    } catch (error) {
      this.logger.warn(`exportReportError: ${JSON.stringify(error)}`);
      resp.status = false;
      resp.message = error instanceof BadRequestException || error instanceof UnauthorizedException
        ? error.message
        : 'Internal Server Error';
    }
    return resp;
  }

  @ApiOperation({ summary: 'Execute parameter query to get dropdown options' })
  @ApiCreatedResponse({ description: 'Execute dynamic query for parameter dropdown', type: ResponseData })
  @HttpCode(HttpStatus.OK)
  @Post('parameters/:parameterId/execute-query')
  async executeParameterQuery(
    @Param('parameterId', ParseIntPipe) parameterId: number,
    @Body() context: { companyId?: number; branchId?: number }
  ) {
    const resp = new ResponseData();
    try {
      this.logger.log(`executeParameterQuery for parameter ${parameterId} with context: ${JSON.stringify(context)}`);
      const options = await this.accountsReportsService.executeParameterQuery(parameterId, context);
      resp.data = options;
      resp.message = 'Parameter options fetched successfully';
    } catch (error) {
      this.logger.warn(`executeParameterQueryError: ${JSON.stringify(error)}`);
      resp.status = false;
      resp.message = error instanceof BadRequestException || error instanceof UnauthorizedException
        ? error.message
        : 'Internal Server Error';
    }
    return resp;
  }

  @ApiOperation({ summary: 'Email report' })
  @ApiCreatedResponse({ description: 'Send report via email', type: ResponseData })
  @HttpCode(HttpStatus.OK)
  @Post(':reportName/email')
  async emailReport(
    @Param('reportName') reportName: string,
    @Body() emailParams: any
  ) {
    const resp = new ResponseData();
    try {
      this.logger.log(`emailReport: ${reportName} to ${emailParams.email}`);
      await this.accountsReportsService.emailReport(reportName, emailParams);
      resp.message = 'Report emailed successfully';
    } catch (error) {
      this.logger.warn(`emailReportError: ${JSON.stringify(error)}`);
      resp.status = false;
      resp.message = error instanceof BadRequestException || error instanceof UnauthorizedException
        ? error.message
        : 'Internal Server Error';
    }
    return resp;
  }
}
