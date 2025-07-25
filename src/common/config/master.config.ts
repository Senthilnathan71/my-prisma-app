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
        select: { CustomerMasterSid: true, CustomerName: true, CustomerShortCode: true, PanName : true,CountryMasterSid:true },
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

    country_master: {
        model: 'countryMaster',
        select: { CountryMasterSid: true, countryName: true },
        companyKey: 'CompanyMasterSid',
        primaryKey: 'CountryMasterSid',
    },
    state_master: {
        model: 'stateMaster',
        select: { StateMasterSid: true, StateName: true },
        companyKey: 'CompanyMasterSid',
        primaryKey: 'StateMasterSid',
    },
    city_master: {
        model: 'cityMaster',
        select: { CityMasterSid: true, cityName: true },
        companyKey: 'CompanyMasterSid',
        primaryKey: 'CityMasterSid'
    },

    branch_bank : {
        model : 'branchBank',
        select: { BranchBankSid: true, BankName: true },
        companyKey: 'CompanyMasterSid',
        primaryKey: 'BranchBankSid'
    }

};
