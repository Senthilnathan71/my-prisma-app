import { Logger, Module } from '@nestjs/common';
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
import { UomService } from './services/uom/uom-master.service';
import { UomMasterController } from './controllers/uom/uom-master.controller';
import { UnitController } from './controllers/unit/unit.controller';
import { UnitService } from './services/unit/unit.service';
import { CityController } from './controllers/city/city.controller';

@Module({
  providers: [
    UserService,
    Logger,
    PrecustomerService,
    PreCustomerMeetingService,
    CityService,
    EnquiryHeaderService,
    QuotationService,
    PortService,
    CountryService,
    StateService,
    SectorService,
    UomService,
    UnitService,
  ],
  controllers: [
    UserController,
    CityController,
    PreCustomerMeetingController,
    PrecustomerController,
    RegionController,
    EnquiryHeaderController,
    QuotationController,
    PortMasterController,
    CountryController,
    StateController,
    SectorController,
    UomMasterController,
    UnitController,
  ],
  exports: [UserService],
})
export class MastersModule {}
