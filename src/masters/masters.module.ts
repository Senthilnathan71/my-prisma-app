import { Module } from '@nestjs/common';
// import { SequelizeModule } from '@nestjs/sequelize';
import { CountryMaster } from './models/country-master.model';
import { StateMaster } from './models/state-master.model';
import { CityMaster } from './models/city-master.model';
import { BranchMaster } from './models/branch-master.model';
import { ChargeGroup } from './models/charge-group-master.model';
import { ChargeMaster } from './models/charge-master.model';
import { ChargeTaxMaster } from './models/charge-tax-master.model';
import { CompanyMaster } from './models/company-master.model';
import { CurrencyMaster } from './models/currency-master.model';
import { CustomerBranch } from './models/customer-branch.model';
import { CustomerMaster } from './models/customer-master.model';
import { DepartmentMaster } from './models/department-master.model';
import { PortMaster } from './models/port-master.model';
import { PreCustomerMaster } from './models/pre-customer-master.model';
import { SectorMaster } from './models/sector-master.model';
import { UnitMaster } from './models/unit-master.model';
import { UserMaster } from './models/user-master.model';
import { UserService } from './services/user.service';
import { UserBranch } from './models/user-branch-master.model';
import { UserController } from './controllers/user/user.controller';
import { PrecustomerController } from './controllers/precustomer/precustomer.controller';
import { PrecustomerService } from './services/precustomer/precustomer.service';
import { CityService } from './services/city/city.service';
import { RegionController } from './controllers/region/region.controller';
import { PreCustomerMeetingService } from './services/precustomer/precustomer-meeting.service';
import { PreCustomerMeetingController } from './controllers/precustomer/precustomer-meeting.controller';

@Module({
    imports:[
        // SequelizeModule.forFeature(
        //     [
        //         CountryMaster,
        //         StateMaster,
        //         CityMaster,
        //         BranchMaster,
        //         ChargeGroup,
        //         ChargeMaster,
        //         ChargeTaxMaster,
        //         CompanyMaster,
        //         CurrencyMaster,
        //         CustomerBranch,
        //         CustomerMaster,
        //         DepartmentMaster,
        //         PortMaster,
        //         PreCustomerMaster,
        //         SectorMaster,
        //         UnitMaster,
        //         UserMaster,
        //         UserBranch

        //     ],
        // )
    ],
    providers: [UserService,PrecustomerService,PreCustomerMeetingService,CityService],
    controllers:[UserController,PreCustomerMeetingController, PrecustomerController,RegionController],
    exports:[UserService]
})
export class MastersModule {}
