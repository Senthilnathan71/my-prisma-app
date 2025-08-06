import { Logger,Module } from '@nestjs/common';
import { LeadService } from './services/lead/lead.service';
import { LeadController } from './controllers/lead/lead.controller';
import { PreCustomerMeetingService } from './services/PreCustomerMeeting/pre-customer-meeting/pre-customer-meeting.service';
import { PreCustomerMeetingController } from './controllers/PreCustomerMeeting/pre-customer-meeting/pre-customer-meeting.controller';
import { BookingController } from './controllers/booking/booking.controller';
import { BookingService } from './services/booking/booking.service';
import { EnquiryHeaderService } from './services/enquiry/enquiry-header.service';
import { EnquiryHeaderController } from './controllers/enquiry/enquiry-header.controller';

@Module({
    providers : [
        Logger,
        LeadService,
        EnquiryHeaderService,
        PreCustomerMeetingService,
        BookingService
    ],
    controllers : [
        LeadController,
        EnquiryHeaderController,
        PreCustomerMeetingController,
        BookingController
    ]
})
export class CrmModule {}
