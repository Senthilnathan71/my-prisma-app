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
import { MenuService } from './services/menu/menu.service';
import { RoleService } from './services/role/role.service';
import { RoleMenuService } from './services/role-menu/role-menu.service';
import { ModuleService } from './services/module/module.service';
import { MailConfigurationService } from './services/mail-configuration/mail-configuration.service';
import { MenuController } from './controllers/menu/menu.controller';
import { RoleMenuController } from './controllers/role-menu/role-menu.controller';
import { RoleController } from './controllers/role/role.controller';
import { ModuleController } from './controllers/module/module.controller';
import { MailConfigurationController } from './controllers/mail-configuration/mail-configuration.controller';

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
    MenuService,
    RoleService,
    RoleMenuService,
    ModuleService,
    MailConfigurationService,
    ReportScheduleService,
    ExceptionCheckScriptService,
  ],
  controllers: [
    NumberSeriesController,
    MenuUserConfigController,
    ActivityAllocationController,
    ExceptionCheckScriptController,
    ReportScheduleController,
    MenuController,
    RoleMenuController,
    RoleController,
    ModuleController,
    MailConfigurationController
  ],
  exports: [NumberSeriesService,MenuService],
})
export class SettingsModule {}
