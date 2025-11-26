export const MASTER_CONFIG = {
    branch_master: {
        model: 'branchMaster',
        select: { BranchMasterSid: true, branchName: true, branchCode: true },
        companyKey: 'CompanyMasterSid',
        primaryKey: 'BranchMasterSid',
    },
    company_master: {
        model: 'companyMaster',
        select: { CompanyMasterSid: true, companyName: true, companyCode: true },
        companyKey: 'CompanyMasterSid',
        primaryKey: 'CompanyMasterSid',
    },
    customer_master: {
        model: 'customerMaster',
        select: { CustomerMasterSid: true, CustomerName: true, CustomerShortCode: true, PanType : true,CountryMasterSid:true },
        companyKey: 'CompanyMasterSid',
        primaryKey: 'CustomerMasterSid',
    },
    port_master: {
        model: 'portMaster',
        select: { PortMasterSid: true, PortName: true, PortCode: true },
        companyKey: 'CompanyMasterSid',
        primaryKey: 'PortMasterSid',
    },

    vessel_master: {
        model: 'vesselMaster',
        select: { VesselMasterSid: true, VesselName: true, },
        companyKey: 'CompanyMasterSid',
        primaryKey: 'VesselMasterSid',
    },

    department_master : {
        model: 'departmentMaster',
        select: { DepartmentMasterSid: true, departmentName: true, },
        companyKey: 'CompanyMasterSid',
        primaryKey: 'DepartmentMasterSid',
    },
    
    unit_master : {
        model: 'unitMaster',
        select: { UnitMasterSid: true, unitName: true, unitCode : true },
        companyKey: 'CompanyMasterSid',
        primaryKey: 'UnitMasterSid',
    },
    uom_master : {
        model: 'uOMMaster',
        select: { UOMMasterSid: true, UOMName: true, UOMCode : true },
        companyKey: 'CompanyMasterSid',
        primaryKey: 'UOMMasterSid',
    },

    country_master: {
        model: 'countryMaster',
        select: { CountryMasterSid: true, countryName: true },
        companyKey: 'CompanyMasterSid',
        primaryKey: 'CountryMasterSid',
    },
    state_master: {
        model: 'stateMaster',
        select: { StateMasterSid: true, stateName: true },
        companyKey: 'CompanyMasterSid',
        primaryKey: 'StateMasterSid',
    },
    city_master: {
        model: 'cityMaster',
        select: { CityMasterSid: true, cityName: true },
        companyKey: 'CompanyMasterSid',
        primaryKey: 'CityMasterSid'
    },
    zone_master: {
        model: 'zoneMaster',
        select: { ZoneMasterSid: true, ZoneName: true },
        companyKey: 'CompanyMasterSid',
        primaryKey: 'ZoneMasterSid'
    },

    branch_bank : {
        model : 'branchBank',
        select: { BranchBankSid: true, BankName: true },
        companyKey: 'CompanyMasterSid',
        primaryKey: 'BranchBankSid'
    },

    user_master : {
        model : 'userMaster',
        select: { UserMasterSid: true, userName: true },
        companyKey: 'CompanyMasterSid',
        primaryKey: 'UserMasterSid'
    },

    tds_set_header: {
        model: 'tDSSetHeader',
        select: { TDSSetHeaderSid: true, TDSSetName: true },
        companyKey: 'CompanyMasterSid',
        primaryKey: 'TDSSetHeaderSid',
    },

    currency_master: {
        model: 'currencyMaster',
        select: { CurrencyMasterSid: true, currencyName: true ,currencyCode : true},
        companyKey: 'CompanyMasterSid',
        primaryKey: 'CurrencyMasterSid',
    },

    charge_tax_master: {
        model: 'chargeTaxMaster',
        select: { ChargeTaxMasterSid: true, HSNCode: true },
        companyKey: 'CompanyMasterSid',
        primaryKey: 'ChargeTaxMasterSid',
    },

    //  Settings Related Config 

    module_master : {
        model: 'moduleMaster',
        select: { ModuleMasterSid: true, ModuleName: true },
        companyKey: 'CompanyMasterSid',
        primaryKey: 'ModuleMasterSid',
    },

    role_master : {
        model: 'roleMaster',
        select: { RoleMasterSid: true, UserRoleName: true },
        companyKey: 'CompanyMasterSid',
        primaryKey: 'RoleMasterSid',
    },

    menu_master : {
        model: 'menuMaster',
        select: { MenuMasterSid: true, MenuName: true },
        companyKey: 'CompanyMasterSid',
        primaryKey: 'MenuMasterSid',
    },


};
