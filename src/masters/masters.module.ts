import { Module } from '@nestjs/common';
// import { SequelizeModule } from '@nestjs/sequelize';

import { UserService } from './services/user.service';
import { UserController } from './controllers/user/user.controller';
import { PrecustomerController } from './controllers/precustomer/precustomer.controller';
import { PrecustomerService } from './services/precustomer/precustomer.service';
import { CityService } from './services/city/city.service';
import { RegionController } from './controllers/region/region.controller';
import { PreCustomerMeetingService } from './services/precustomer/precustomer-meeting.service';
import { PreCustomerMeetingController } from './controllers/precustomer/precustomer-meeting.controller';
import { EnquiryHeaderController } from './controllers/enquiry/enquiry-header.controller';
import { EnquiryHeaderService } from './services/enquiry/enquiry-header.service';
import { QuotationService } from './services/quotation/quotation.service';
import { QuotationController } from './controllers/quotation/quotation.controller';

@Module({
    providers: [UserService, PrecustomerService, PreCustomerMeetingService, CityService, EnquiryHeaderService, QuotationService],
    controllers: [UserController, PreCustomerMeetingController, PrecustomerController, RegionController, EnquiryHeaderController, QuotationController],
    exports: [UserService]
})
export class MastersModule { }
