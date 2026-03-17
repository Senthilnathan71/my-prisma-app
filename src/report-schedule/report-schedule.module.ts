import { Logger, Module } from '@nestjs/common';
import { ReportScheduleController } from './report-schedule.controller';
import { ReportScheduleService } from './report-schedule.service';
import { ReportScheduleExecutorService } from './report-schedule-executor.service';
import { SchedulerService } from 'src/common/services/scheduler/scheduler.service';
import { AccountsReportsService } from 'src/accounts/services/accounts-reports/accounts-reports.service';
import { ReportExportService } from 'src/common/services/report-export.service';
import { PdfmakeNodeService } from 'src/common/services/report-generators/pdfmake-node.service';
import { EmailService } from 'src/email/email.service';
import { GlobalConfigService } from 'src/common/config/master-config.service';
import { VoucherService } from 'src/operation/services/voucher/voucher.service';
import { CompanyConfigService } from 'src/masters/services/company/company-config.service';

@Module({
  controllers: [ReportScheduleController],
  providers: [
    Logger,
    ReportScheduleService,
    ReportScheduleExecutorService,
    SchedulerService,
    AccountsReportsService,
    ReportExportService,
    PdfmakeNodeService,
    EmailService,
    GlobalConfigService,
    VoucherService,
    CompanyConfigService,
  ],
})
export class ReportScheduleModule {}
