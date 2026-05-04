import { forwardRef, Logger, Module } from '@nestjs/common';
import { NumberSeriesService } from './services/number-series/number-series.service';
import { NumberSeriesController } from './controllers/number-series/number-series.controller';
import { MenuUserConfigService } from './services/menu-user-config/menu-user-config.service';
import { MenuUserConfigController } from './controllers/menu-user-config/menu-user-config.controller';
import { ActivityAllocationService } from './services/activity-allocation/activity-allocation.service';
import { ActivityAllocationController } from './controllers/activity-allocation/activity-allocation.controller';
import { ExceptionCheckScriptController } from './controllers/exception-check-script/exception-check-script.controller';
import { ExceptionCheckScriptService } from './services/exception-check-script/exception-check-script.service';
import { ExceptionCheckScriptExecutorService } from './services/exception-check-script/exception-check-script-executor.service';
import { SchedulerService } from 'src/common/services/scheduler/scheduler.service';
import { ReportExportService } from 'src/common/services/report-export.service';
import { PdfmakeNodeService } from 'src/common/services/report-generators/pdfmake-node.service';
import { EmailService } from 'src/email/email.service';
import { OperationModule } from 'src/operation/operation.module';
import { ReportScheduleController } from './controllers/report-schedule/report-schedule.controller';
import { ReportScheduleService } from './services/report-schedule/report-schedule.service';
import { ReportScheduleExecutorService } from './services/report-schedule/report-schedule-executor.service';
import { AccountsReportsService } from 'src/accounts/services/accounts-reports/accounts-reports.service';
import { GlobalConfigService } from 'src/common/config/master-config.service';
import { VoucherService } from 'src/operation/services/voucher/voucher.service';
import { CompanyConfigService } from 'src/masters/services/company/company-config.service';

@Module({
  imports : [ forwardRef(() => OperationModule) ],
  providers: [
    NumberSeriesService,
    MenuUserConfigService,
    ActivityAllocationService,
    ExceptionCheckScriptService,
    ExceptionCheckScriptExecutorService,
    SchedulerService,
    ReportExportService,
    PdfmakeNodeService,
    EmailService,
    Logger,
    ReportScheduleService,
    ReportScheduleExecutorService,
    AccountsReportsService,
    GlobalConfigService,
    VoucherService,
    CompanyConfigService,
  ],
  controllers: [
    NumberSeriesController,
    MenuUserConfigController,
    ActivityAllocationController,
    ExceptionCheckScriptController,
    ReportScheduleController
  ],
  exports: [NumberSeriesService],
})
export class SettingsModule {}
