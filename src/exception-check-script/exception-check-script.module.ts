import { Logger, Module } from '@nestjs/common';
import { ExceptionCheckScriptController } from './exception-check-script.controller';
import { ExceptionCheckScriptService } from './exception-check-script.service';
import { ExceptionCheckScriptExecutorService } from './exception-check-script-executor.service';
import { SchedulerService } from 'src/common/services/scheduler/scheduler.service';
import { ReportExportService } from 'src/common/services/report-export.service';
import { PdfmakeNodeService } from 'src/common/services/report-generators/pdfmake-node.service';
import { EmailService } from 'src/email/email.service';

@Module({
  controllers: [ExceptionCheckScriptController],
  providers: [
    Logger,
    ExceptionCheckScriptService,
    ExceptionCheckScriptExecutorService,
    SchedulerService,
    ReportExportService,
    PdfmakeNodeService,
    EmailService,
  ],
})
export class ExceptionCheckScriptModule {}
