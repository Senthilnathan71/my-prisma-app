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
import { PortService } from './services/port/port-master.service';
import { PortMasterController } from './controllers/port/port-master.controller';
import { CountryController } from './controllers/country/country.controller';
import { CountryService } from './services/country/country.service';
import { StateController } from './controllers/state/state.controller';
import { StateService } from './services/state/state.service';
import { SectorController } from './controllers/sector/sector.controller';
import { SectorService } from './services/sector/sector.service';

@Module({
    providers: [UserService, PrecustomerService, PreCustomerMeetingService, CityService, EnquiryHeaderService, QuotationService, PortService, CountryService, StateService, SectorService],
    controllers: [UserController, PreCustomerMeetingController, PrecustomerController, RegionController, EnquiryHeaderController, QuotationController, PortMasterController, CountryController, StateController, SectorController],
    exports: [UserService]
})
export class MastersModule { }
