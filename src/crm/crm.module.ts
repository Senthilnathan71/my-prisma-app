import { Logger,Module } from '@nestjs/common';
import { LeadService } from './services/lead/lead.service';
import { LeadController } from './controllers/lead/lead.controller';
import { PreCustomerMeetingService } from './services/PreCustomerMeeting/pre-customer-meeting/pre-customer-meeting.service';
import { PreCustomerMeetingController } from './controllers/PreCustomerMeeting/pre-customer-meeting/pre-customer-meeting.controller';

@Module({
    providers : [
        Logger,
        LeadService,
        PreCustomerMeetingService
    ],
    controllers : [
        LeadController,
        PreCustomerMeetingController
    ]
})
export class CrmModule {}
