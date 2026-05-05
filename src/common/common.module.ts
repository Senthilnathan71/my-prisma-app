import { forwardRef, Logger, Module } from '@nestjs/common';
import { RecentScreenController } from './controllers/recent-screen/recent-screen.controller';
import { RecentScreenService } from './services/recent-screen/recent-screen.service';
import { FavouriteScreenController } from './controllers/favourite-screen/favourite-screen.controller';
import { FavouriteScreenService } from './services/favourite-screen/favourite-screen.service';
import { emailLogController } from './controllers/email-log/email-log.controller';
import { EmailLogService } from './services/email-log/email-log.service';
import { LookupsController } from './controllers/lookups/lookups.controller';
import { LookupsService } from './services/lookups/lookups.service';
import { FollowupController } from './controllers/followup/followup.controller';
import { FollowupService } from './services/followup/followup.service';
import { SchedulerService } from './services/scheduler/scheduler.service';
import { AttachDocumentController } from './controllers/attach-document/attach-document.controller';
import { AttachDocumentService } from './services/attach-document/attach-document.service';
import { GlobalConfigService } from './config/master-config.service';
import { DocReferenceController } from './controllers/doc-reference/doc-reference.controller';
import { DocReferenceService } from './services/doc-reference/doc-reference.service';
import { ReportEmailService } from './services/report-email.service';
import { GlobalDocumentSearchController } from './controllers/global-document-search/global-document-search.controller';
import { GlobalDocumentSearchService } from './services/global-document-search/global-document-search.service';
import { SettingsModule } from 'src/settings/settings.module';
import { CompanyConfigService } from 'src/masters/services/company/company-config.service';
import { EmailModule } from 'src/email/email.module';
import { ReportExportService } from 'src/common/services/report-export.service';
import { PdfmakeNodeService } from 'src/common/services/report-generators/pdfmake-node.service';

@Module({
    imports:[
        forwardRef(() => SettingsModule),
        EmailModule,
    ],
    controllers: [
        RecentScreenController,
        FavouriteScreenController,
        emailLogController,
        LookupsController,
        FollowupController,
        AttachDocumentController,
        DocReferenceController,
        GlobalDocumentSearchController,
    ],
    providers: [
        Logger,
        RecentScreenService,
        FavouriteScreenService,
        EmailLogService,
        LookupsService,
        FollowupService,
        SchedulerService,
        AttachDocumentService,
        DocReferenceService,
        ReportEmailService,
        GlobalDocumentSearchService,
        ReportExportService,
        PdfmakeNodeService,
        GlobalConfigService,
        CompanyConfigService,
    ],
    exports: [
        Logger,
        EmailModule,
        ReportEmailService,
        ReportExportService,
        PdfmakeNodeService,
        SchedulerService,
        GlobalConfigService,
        CompanyConfigService,
    ]
})
export class CommonModule { }
