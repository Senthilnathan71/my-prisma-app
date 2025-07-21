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
import { DepartmentController } from './controllers/department/department.controller';
import { ContainerTypeController } from './controllers/container-type/container-type.controller';
import { DepartmentService } from 'src/masters/services/department/department.service';
import { ContainerTypeService } from './services/container-type/container-type.service';
import { VesselController } from './controllers/vessel/vessel.controller';
import { VesselService } from './services/vessel/vessel.service';
import { VoyageController } from './controllers/voyage/voyage.controller';
import { VoyageService } from './services/voyage/voyage.service';
import { CurrencyService } from './services/currency/currency.service';
import { CurrencyController } from './controllers/currency/currency.controller';
import { ZoneService } from './services/zone/zone.service';
import { ZoneController } from './controllers/zone/zone.controller';
import { PackageTypeService } from './services/package-type/package-type.service';
import { PackageTypeController } from './controllers/package-type/package-type.controller';
import { CustomerService } from './services/customer/customer.service';
import { CustomerController } from './controllers/customer/customer.controller';
import { DivisionController } from './controllers/division/division.controller';
import { DivisionService } from './services/division/division.service';
import { CommodityController } from './controllers/commodity/commodity.controller';
import { CommodityService } from './services/commodity/commodity.service';
import { CustomerBranchContactController } from './controllers/customer-branch-contact/customer-branch-contact.controller';
import { CustomerBranchContactService } from './services/customer-branch-contact/customer-branch-contact.service';
import { CustomerBranchEmailController } from './controllers/customer-branch-email/customer-branch-email.controller';
import { CustomerBranchEmailService } from './services/customer-branch-email/customer-branch-email.service';
import { CustomerLoginController } from './controllers/customer-login/customer-login.controller';
import { CustomerLoginService } from './services/customer-login/customer-login.service';
import { CustomerBranchService } from './services/customer-branch/customer-branch.service';
import { CustomerBranchController } from './controllers/customer-branch/customer-branch.controller';
import { BranchController } from './controllers/branch/branch.controller';
import { BranchService } from './services/branch/branch.service';
import { CurrencyExchangeController } from './controllers/currency-exchange/currency-exchange.controller';
import { CurrencyExchangeService } from './services/currency-exchange/currency-exchange.service';
import { CompanyService } from './services/company/company.service';
import { CompanyController } from './controllers/company/company.controller';
import { TariffController } from './controllers/tariff/tariff.controller';
import { TariffService } from './services/tariff/tariff.service';
import { ChargeController } from './controllers/charge/charge.controller';
import { ChargeService } from './services/charge/charge.service';
import { HssacController } from './controllers/hssac/hssac.controller';
import { HssacService } from './services/hssac/hssac.service';
import { BranchBankController } from './controllers/branch-bank/branch-bank.controller';
import { BranchBankService } from './services/branch-bank/branch-bank.service';
import { TariffDetailController } from './controllers/tariff-detail/tariff-detail.controller';
import { TariffDetailService } from './services/tariff-detail/tariff-detail.service';
import { ModuleService } from './services/module/module.service';
import { ModuleController } from './controllers/module/module.controller';
import { RoleService } from './services/role/role.service';
import { RoleController } from './controllers/role/role.controller';
import { ImcoController } from './controllers/imco/imco.controller';
import { ImcoService } from './services/imco/imco.service';
import { BlclauseController } from './controllers/blclause/blclause.controller';
import { BlclauseService } from './services/blclause/blclause.service';
import { ProductController } from './controllers/product/product.controller';
import { ProductService } from './services/product/product.service';
import { TermsAndConditionsService } from './services/terms-and-conditions/terms-and-conditions.service';
import { TermsAndConditionsDetailService } from './services/terms-and-conditions-detail/terms-and-conditions-detail.service';
import { TermsAndConditionsController } from './controllers/terms-and-conditions/terms-and-conditions.controller';
import { TermsAndConditionsDetailController } from './controllers/terms-and-conditions-detail/terms-and-conditions-detail.controller';
import { MenuController } from './controllers/menu/menu.controller';
import { MenuService } from './services/menu/menu.service';
import { ChargeTaxController } from './controllers/charge-tax/charge-tax.controller';
import { ChargeTaxService } from './services/charge-tax/charge-tax.service';
import { ChargeGroupController } from './controllers/charge-group/charge-group.controller';
import { ChargeGroupService } from './services/charge-group/charge-group.service';
import { VoyageDetailController } from './controllers/voyage-detail/voyage-detail.controller';
import { VoyageDetailService } from './services/voyage-detail/voyage-detail.service';
import { FfUserMasterController } from './controllers/ff-user-master/ff-user-master.controller';
import { FfUserMasterService } from './services/ff-user-master/ff-user-master.service';
import { CustomerSalesteamService } from './services/customer-salesteam/customer-salesteam.service';
import { CustomerSalesteamController } from './controllers/customer-salesteam/customer-salesteam.controller';
import { RoleMenuService } from './services/role-menu/role-menu.service';
import { RoleMenuController } from './controllers/role-menu/role-menu.controller';
import { MilestoneController } from './controllers/milestone/milestone.controller';
import { MilestoneService } from './services/milestone/milestone.service';
import { AuthorityController } from './controllers/authority/authority.controller';
import { AuthorityService } from './services/authority/authority.service';
import { AuthorityDetailService } from './services/authority-detail/authority-detail.service';
import { AuthorityDetailController } from './controllers/authority-detail/authority-detail.controller';
import { UserTypeController } from './controllers/user-type/user-type.controller';
import { UserTypeService } from './services/user-type/user-type.service';
import { DocumentTypeController } from './controllers/document-type/document-type.controller';
import { DocumentTypeService } from './services/document-type/document-type.service';

import { AttachDocumentController } from './controllers/attach-document/attach-document.controller';
import { AttachDocumentService } from './services/attach-document/attach-document.service';
import { YearController } from './controllers/year/year.controller';
import { YearService } from './services/year/year.service';
import { IncoService } from './services/inco/inco.service';
import { IncoController } from './controllers/inco/inco.controller';
import { ProfitCenterController } from './controllers/profit-center/profit-center.controller';
import { ProfitCenterService } from './services/profit-center/profit-center.service';
import { CostCenterService } from './services/cost-center/cost-center.service';
import { CostCenterController } from './controllers/cost-center/cost-center.controller';
import { TaxController } from './controllers/tax/tax.controller';
import { TaxService } from './services/tax/tax.service';
import { TdsService } from './services/tds/tds.service';
import { TdsController } from './controllers/tds/tds.controller';
import { TdsDetailController } from './controllers/tds-detail/tds-detail.controller';
import { TdsDetailService } from './services/tds-detail/tds-detail.service';
import { TdsExemptionController } from './controllers/tds-exemption/tds-exemption.controller';
import { TdsExemptionService } from './services/tds-exemption/tds-exemption.service';
import { HawbStockService } from './services/hawb-stock/hawb-stock.service';
import { HawbStockController } from './controllers/hawb-stock/hawb-stock.controller';
import { GlobalConfigService } from 'src/common/config/master-config.service';
import { ChargeTdsService } from './services/charge-tds/charge-tds.service';
import { ChargeTdsController } from './controllers/charge-tds/charge-tds.controller';

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
    DepartmentService,
    ContainerTypeService,
    VesselService,
    VoyageService,
    CurrencyService,
    ZoneService,
    PackageTypeService,
    CustomerService,
    DivisionService,
    CommodityService,
    CustomerBranchContactService,
    CustomerBranchEmailService,
    CustomerLoginService,
    CustomerBranchService,
    BranchService,
    CurrencyExchangeService,
    CompanyService,
    TariffService,
    ChargeService,
    HssacService,
    BranchBankService,
    TariffDetailService,
    ModuleService,
    RoleService,
    ImcoService,
    BlclauseService,
    ProductService,
    TermsAndConditionsService,
    TermsAndConditionsDetailService,
    MenuService,
    ChargeTaxService,
    ChargeGroupService,
    VoyageDetailService,
    FfUserMasterService,
    CustomerSalesteamService,
    RoleMenuService,
    MilestoneService,
    AuthorityService,
    AuthorityDetailService,
    UserTypeService,
    DocumentTypeService,
    HawbStockService,
    AttachDocumentService,
    YearService,
    IncoService,
    ProfitCenterService,
    CostCenterService,
    TaxService,
    TdsService,
    TdsDetailService,
    TdsExemptionService,
    GlobalConfigService,
    ChargeTdsService
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
    DepartmentController,
    ContainerTypeController,
    VesselController,
    VoyageController,
    CurrencyController,
    ZoneController,
    PackageTypeController,
    CustomerController,
    DivisionController,
    CommodityController,
    CustomerBranchContactController,
    CustomerBranchEmailController,
    CustomerLoginController,
    CustomerBranchController,
    BranchController,
    CurrencyExchangeController,
    CompanyController,
    TariffController,
    ChargeController,
    HssacController,
    BranchBankController,
    TariffDetailController,
    ModuleController,
    RoleController,
    ImcoController,
    BlclauseController,
    ProductController,
    TermsAndConditionsController,
    TermsAndConditionsDetailController,
    MenuController,
    ChargeTaxController,
    ChargeGroupController,
    VoyageDetailController,
    FfUserMasterController,
    CustomerSalesteamController,
    RoleMenuController,
    MilestoneController,
    AuthorityController,
    AuthorityDetailController,
    UserTypeController,
    DocumentTypeController,
    HawbStockController,
    AttachDocumentController,
    YearController,
    IncoController,
    ProfitCenterController,
    CostCenterController,
    TaxController,
    TdsController,
    TdsDetailController,
    TdsExemptionController,
    ChargeTdsController
  ],
  exports: [UserService]
})

export class MastersModule { }
