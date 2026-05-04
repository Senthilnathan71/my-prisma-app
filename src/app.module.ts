import { Logger, Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DatabaseModule } from './database/database.module';
import { MastersModule } from './masters/masters.module';
import { AuthModule } from './auth/auth.module';
import { SalesModule } from './sales/sales.module';
import { ConfigModule } from '@nestjs/config';
import { EmailModule } from './email/email.module';
import { CrmModule } from './crm/crm.module';
import { ShortcutModule } from './shortcut/shortcut.module';
import { CommonModule } from './common/common.module';
import { AccountsModule } from './accounts/accounts.module';
import { OperationModule } from './operation/operation.module';
import { ScheduleModule } from '@nestjs/schedule';
import { SettingsModule } from './settings/settings.module';
import { OcrModule } from './ocr/ocr.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { ReportScheduleModule } from './report-schedule/report-schedule.module';
import { ExceptionCheckScriptModule } from './exception-check-script/exception-check-script.module';
import { CrmDesktopModule } from './crm-desktop/crm-desktop.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    DatabaseModule,
    MastersModule,
    AuthModule,
    SalesModule,
    CrmModule,
    ShortcutModule,
    CommonModule,
    AccountsModule,
    OperationModule,
    SettingsModule,
    OcrModule,
    DashboardModule,
    ReportScheduleModule,
    ExceptionCheckScriptModule,
    CrmDesktopModule,
    ScheduleModule.forRoot(),
  ],
  controllers: [AppController],
  providers: [AppService, Logger],
})
export class AppModule {}
