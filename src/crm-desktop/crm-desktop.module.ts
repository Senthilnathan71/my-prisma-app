import { Logger, Module } from "@nestjs/common";
import { LeadController } from "./controllers/lead/lead.controller";
import { LeadService } from "./services/lead/lead.service";
import { PreCustomerMeetingService } from "./services/precustomer/precustomer-meeting.service";
import { EnquiryHeaderService } from "./services/enquiry/enquiry-header.service";
import { QuotationService } from "./services/quotation/quotation.service";
import { PreCustomerMeetingController } from "./controllers/precustomer/precustomer-meeting.controller";
import { EnquiryHeaderController } from "./controllers/enquiry/enquiry-header.controller";
import { QuotationController } from "./controllers/quotation/quotation.controller";
import { SettingsModule } from "src/settings/settings.module";
import { GlobalConfigService } from "src/common/config/master-config.service";
import { EmailService } from "src/email/email.service";
import { MenuUserConfigService } from "src/settings/services/menu-user-config/menu-user-config.service";

@Module({
    imports: [SettingsModule],
    providers:[
        Logger,
        LeadService,
        PreCustomerMeetingService,
        EnquiryHeaderService,
        QuotationService,
        GlobalConfigService,
        EmailService,
        MenuUserConfigService
    ],
    controllers:[
        LeadController,
        PreCustomerMeetingController,
        EnquiryHeaderController,
        QuotationController
    ],
})
export class CrmDesktopModule {}