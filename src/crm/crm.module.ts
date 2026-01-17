import { Logger,Module } from '@nestjs/common';
import { PreCustomerMeetingService } from './services/PreCustomerMeeting/pre-customer-meeting/pre-customer-meeting.service';
import { PreCustomerMeetingController } from './controllers/PreCustomerMeeting/pre-customer-meeting/pre-customer-meeting.controller';
import { BookingController } from './controllers/booking/booking.controller';
import { BookingService } from './services/booking/booking.service';
import { EnquiryHeaderService } from './services/enquiry/enquiry-header.service';
import { EnquiryHeaderController } from './controllers/enquiry/enquiry-header.controller';
import { QuotationController } from './controllers/quotation/quotation.controller';
import { QuotationService } from './services/quotation/quotation.service';
import { PrecustomerController } from './controllers/precustomer/precustomer.controller';
import { PrecustomerService } from './services/precustomer/precustomer.service';
import { ActivityAllocationService } from './services/activity-allocation/activity-allocation.service';
import { ActivityAllocationController } from './controllers/activity-allocation/activity-allocation.controller';
import { SettingsModule } from 'src/settings/settings.module';

@Module({
    imports: [SettingsModule],
    providers : [
        Logger,
        PrecustomerService,
        EnquiryHeaderService,
        PreCustomerMeetingService,
        BookingService,
        QuotationService,
         ActivityAllocationService,
    ],
    controllers : [
        PrecustomerController,
        EnquiryHeaderController,
        PreCustomerMeetingController,
        BookingController,
        QuotationController,
        ActivityAllocationController,
    ],
})
export class CrmModule {}
