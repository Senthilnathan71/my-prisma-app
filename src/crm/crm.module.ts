import { Logger,Module } from '@nestjs/common';
import { LeadService } from './services/lead/lead.service';
import { LeadController } from './controllers/lead/lead.controller';
import { PreCustomerMeetingService } from './services/PreCustomerMeeting/pre-customer-meeting/pre-customer-meeting.service';
import { PreCustomerMeetingController } from './controllers/PreCustomerMeeting/pre-customer-meeting/pre-customer-meeting.controller';
import { BookingController } from './controllers/booking/booking.controller';
import { BookingService } from './services/booking/booking.service';

@Module({
    providers : [
        Logger,
        LeadService,
        PreCustomerMeetingService,
        BookingService
    ],
    controllers : [
        LeadController,
        PreCustomerMeetingController,
        BookingController
    ]
})
export class CrmModule {}
