import { Logger, Module } from '@nestjs/common';
import { ReportScheduleController } from '../settings/controllers/report-schedule/report-schedule.controller';
import { ReportScheduleExecutorService } from '../settings/services/report-schedule/report-schedule-executor.service';
import { SchedulerService } from 'src/common/services/scheduler/scheduler.service';
import { AccountsReportsService } from 'src/accounts/services/accounts-reports/accounts-reports.service';
import { ReportExportService } from 'src/common/services/report-export.service';
import { PdfmakeNodeService } from 'src/common/services/report-generators/pdfmake-node.service';
import { EmailService } from 'src/email/email.service';
import { GlobalConfigService } from 'src/common/config/master-config.service';
import { VoucherService } from 'src/operation/services/voucher/voucher.service';
import { CompanyConfigService } from 'src/masters/services/company/company-config.service';
import { OperationModule } from 'src/operation/operation.module';
import { ReportScheduleService } from 'src/settings/services/report-schedule/report-schedule.service';

@Module({
  imports : [ OperationModule ],
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
