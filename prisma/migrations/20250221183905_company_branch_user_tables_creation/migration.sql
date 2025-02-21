-- CreateTable
CREATE TABLE "CompanyMaster" (
    "id" SERIAL NOT NULL,
    "companyName" VARCHAR(100) NOT NULL,
    "companyCode" CHAR(10) NOT NULL,
    "createdBy" VARCHAR(100) NOT NULL,
    "createdOn" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedOn" TIMESTAMPTZ NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "updatedBy" VARCHAR(100),
    "loginId" INTEGER,
    "cityMasterId" INTEGER NOT NULL,
    "countryMasterId" INTEGER NOT NULL,
    "stateMasterId" INTEGER NOT NULL,
    "currencyMasterId" INTEGER NOT NULL,
    "addressLine1" VARCHAR(500) NOT NULL,
    "addressLine2" VARCHAR(500),
    "postal_code" VARCHAR(10) NOT NULL,
    "webSite" VARCHAR(100),
    "phoneNumber" VARCHAR(20),
    "email" VARCHAR(100),
    "isHo" CHAR(1) NOT NULL,
    "remarks" VARCHAR(500),
    "companyLogo" BYTEA,
    "reportLogo" BYTEA,
    "status" CHAR(1) NOT NULL,

    CONSTRAINT "CompanyMaster_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BranchMaster" (
    "id" SERIAL NOT NULL,
    "branchName" VARCHAR(100) NOT NULL,
    "branchCode" CHAR(10) NOT NULL,
    "companyMasterId" INTEGER NOT NULL,
    "createdOn" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedOn" TIMESTAMPTZ NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "createdBy" VARCHAR(100) NOT NULL,
    "updatedBy" VARCHAR(100),
    "loginId" INTEGER,
    "cityMasterId" INTEGER NOT NULL,
    "countryMasterId" INTEGER NOT NULL,
    "stateMasterId" INTEGER NOT NULL,
    "currencyMasterId" INTEGER NOT NULL,
    "taxRegistrationNo" VARCHAR(50),
    "CISN" VARCHAR(50),
    "addressLine1" VARCHAR(500) NOT NULL,
    "addressLine2" VARCHAR(500),
    "postalCode" VARCHAR(10) NOT NULL,
    "webSite" VARCHAR(100),
    "phoneNumber" VARCHAR(20),
    "email" VARCHAR(100),
    "timeZone" CHAR(6),
    "remarks" VARCHAR(500),
    "companyLogo" BYTEA,
    "reportLogo" BYTEA,
    "status" CHAR(1) NOT NULL,

    CONSTRAINT "BranchMaster_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserMaster" (
    "id" SERIAL NOT NULL,
    "userCode" CHAR(3) NOT NULL,
    "userName" VARCHAR(100) NOT NULL,
    "userEmail" VARCHAR(50) NOT NULL,
    "userLogin" VARCHAR(50) NOT NULL,
    "userPassword" VARCHAR(20) NOT NULL,
    "countryMasterId" INTEGER NOT NULL,
    "isSalesperson" CHAR(1) NOT NULL,
    "contactNumber" VARCHAR(20),
    "department" VARCHAR(20),
    "designation" VARCHAR(20),
    "createdBy" VARCHAR(100) NOT NULL,
    "createdOn" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedOn" TIMESTAMPTZ NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "updatedBy" VARCHAR(100),
    "loginId" INTEGER,
    "status" CHAR(1) NOT NULL,

    CONSTRAINT "UserMaster_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CurrencyMaster" (
    "id" SERIAL NOT NULL,
    "currencyCode" CHAR(3) NOT NULL,
    "currencyName" VARCHAR(100) NOT NULL,
    "currencyID" CHAR(1) NOT NULL,
    "currencyFirstName" VARCHAR(50) NOT NULL,
    "currencyLastName" VARCHAR(50) NOT NULL,
    "currencyRatio" INTEGER NOT NULL,
    "amountDecimal" INTEGER NOT NULL,
    "exchangeDecimal" INTEGER NOT NULL,
    "countryMasterId" INTEGER NOT NULL,
    "createdBy" VARCHAR(100) NOT NULL,
    "createdOn" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedOn" TIMESTAMPTZ NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "updatedBy" VARCHAR(100) NOT NULL,
    "loginId" INTEGER,
    "status" CHAR(1) NOT NULL,

    CONSTRAINT "CurrencyMaster_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CountryMaster" (
    "id" SERIAL NOT NULL,
    "countryCode" CHAR(2) NOT NULL,
    "countryName" VARCHAR(100) NOT NULL,
    "loginId" INTEGER,
    "createdOn" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedOn" TIMESTAMPTZ NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "createdBy" VARCHAR(100) NOT NULL,
    "updatedBy" VARCHAR(100) NOT NULL,
    "status" CHAR(1) NOT NULL,

    CONSTRAINT "CountryMaster_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StateMaster" (
    "id" SERIAL NOT NULL,
    "stateCode" CHAR(2) NOT NULL,
    "stateName" VARCHAR(100) NOT NULL,
    "stateGSTCode" CHAR(5) NOT NULL,
    "countryMasterId" INTEGER NOT NULL,
    "loginId" INTEGER,
    "createdOn" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedOn" TIMESTAMPTZ NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "createdBy" VARCHAR(100) NOT NULL,
    "updatedBy" VARCHAR(100) NOT NULL,
    "status" CHAR(1) NOT NULL,

    CONSTRAINT "StateMaster_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CityMaster" (
    "id" SERIAL NOT NULL,
    "cityCode" CHAR(2) NOT NULL,
    "cityName" VARCHAR(100) NOT NULL,
    "stateMasterId" INTEGER NOT NULL,
    "countryMasterId" INTEGER NOT NULL,
    "loginId" INTEGER,
    "createdOn" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedOn" TIMESTAMPTZ NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "createdBy" VARCHAR(100) NOT NULL,
    "updatedBy" VARCHAR(100) NOT NULL,
    "status" CHAR(1) NOT NULL,

    CONSTRAINT "CityMaster_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DepartmentMaster" (
    "id" SERIAL NOT NULL,
    "createdOn" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedOn" TIMESTAMPTZ NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "createdBy" VARCHAR(100) NOT NULL,
    "updatedBy" VARCHAR(100) NOT NULL,
    "loginId" INTEGER,
    "Status" CHAR(1) NOT NULL,
    "companyMasterId" INTEGER NOT NULL,
    "departmentName" VARCHAR(20) NOT NULL,
    "departmentCode" VARCHAR(5) NOT NULL,
    "departmentType" VARCHAR(10) NOT NULL,
    "ExportImport" VARCHAR(6) NOT NULL,
    "FCLLCL" VARCHAR(6) NOT NULL,

    CONSTRAINT "DepartmentMaster_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PortMaster" (
    "id" SERIAL NOT NULL,
    "createdOn" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedOn" TIMESTAMPTZ NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "createdBy" VARCHAR(100) NOT NULL,
    "updatedBy" VARCHAR(100) NOT NULL,
    "loginId" INTEGER,
    "status" CHAR(1) NOT NULL,
    "PortCode" VARCHAR(5) NOT NULL,
    "PortName" VARCHAR(50) NOT NULL,
    "countryMasterId" INTEGER NOT NULL,
    "stateMasterId" INTEGER NOT NULL,
    "SectorMasterSid" INTEGER NOT NULL,
    "TimeZone" VARCHAR(10) NOT NULL,
    "EdiPortCode" VARCHAR(10) NOT NULL,
    "ExportRestriction" VARCHAR(100) NOT NULL,
    "ImportRestriction" VARCHAR(100) NOT NULL,
    "PortType" VARCHAR(10) NOT NULL,
    "TerminalCode" VARCHAR(10) NOT NULL,
    "Remarks" VARCHAR(100) NOT NULL,
    "CBMRequire" CHAR(1) NOT NULL,
    "SCMTPortCode" VARCHAR(10) NOT NULL,

    CONSTRAINT "PortMaster_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UnitMaster" (
    "id" SERIAL NOT NULL,
    "unitCode" VARCHAR(4) NOT NULL,
    "unitName" VARCHAR(100) NOT NULL,
    "jobType" VARCHAR(10) NOT NULL,
    "measurementType" VARCHAR(10) NOT NULL,
    "createdOn" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedOn" TIMESTAMPTZ NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "UnitMaster_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChargeMaster" (
    "id" SERIAL NOT NULL,
    "chargeCode" VARCHAR(5) NOT NULL,
    "chargeName" VARCHAR(100) NOT NULL,
    "departmentMasterId" INTEGER NOT NULL,
    "UOM" INTEGER NOT NULL,
    "currencyMasterId" INTEGER NOT NULL,
    "chargeGroupId" INTEGER NOT NULL,
    "companyMasterId" INTEGER NOT NULL,
    "createdOn" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedOn" TIMESTAMPTZ NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "createdBy" VARCHAR(100) NOT NULL,
    "updatedBy" VARCHAR(100) NOT NULL,
    "Remarks" VARCHAR(100) NOT NULL,
    "Status" CHAR(1) NOT NULL,

    CONSTRAINT "ChargeMaster_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChargeTaxMaster" (
    "id" SERIAL NOT NULL,
    "HSNCode" VARCHAR(10) NOT NULL,
    "description" VARCHAR(100) NOT NULL,
    "TaxGroup" VARCHAR(10) NOT NULL,
    "TaxRate" DECIMAL(4,2) NOT NULL,
    "companyMasterId" INTEGER NOT NULL,
    "createdOn" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedOn" TIMESTAMPTZ NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "CreatedBy" VARCHAR(100) NOT NULL,
    "UpdatedBy" VARCHAR(100) NOT NULL,
    "Remarks" VARCHAR(100) NOT NULL,
    "Status" CHAR(1) NOT NULL,

    CONSTRAINT "ChargeTaxMaster_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PreCustomerMaster" (
    "id" SERIAL NOT NULL,
    "companyMasterId" INTEGER NOT NULL,
    "branchMasterId" INTEGER NOT NULL,
    "createdOn" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedOn" TIMESTAMPTZ NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "createdBy" VARCHAR(100) NOT NULL,
    "updatedBy" VARCHAR(100) NOT NULL,
    "status" CHAR(1) NOT NULL,
    "preCustomerAddress1" VARCHAR(300) NOT NULL,
    "preCustomerAddress2" VARCHAR(300) NOT NULL,
    "leadAssignTo" INTEGER NOT NULL,
    "customerType" VARCHAR(10) NOT NULL,
    "cityMasterId" INTEGER NOT NULL,
    "countryMasterId" INTEGER NOT NULL,
    "stateMasterId" INTEGER NOT NULL,
    "contactPerson" VARCHAR(50) NOT NULL,
    "eMail" VARCHAR(100) NOT NULL,
    "phone" VARCHAR(50) NOT NULL,
    "preCustomerType" VARCHAR(10) NOT NULL,
    "leadReferredOn" VARCHAR(20) NOT NULL,
    "leadReferredBy" VARCHAR(20) NOT NULL,
    "panVat" VARCHAR(20) NOT NULL,
    "remarks" VARCHAR(500) NOT NULL,

    CONSTRAINT "PreCustomerMaster_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PreCustomerMeeting" (
    "id" SERIAL NOT NULL,
    "companyMasterId" INTEGER NOT NULL,
    "branchMasterId" INTEGER NOT NULL,
    "createdOn" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedOn" TIMESTAMPTZ NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "createdBy" VARCHAR(100) NOT NULL,
    "updatedBy" VARCHAR(100) NOT NULL,
    "loginId" INTEGER,
    "preCustomerMasterId" INTEGER NOT NULL,
    "meetingDate" TIMESTAMP(3),
    "meetingType" VARCHAR(10) NOT NULL,
    "leadAssignTo" INTEGER NOT NULL,
    "meetingStatus" VARCHAR(10) NOT NULL,
    "customerProfile" VARCHAR(100) NOT NULL,
    "followupDate" TIMESTAMP(3),
    "remarks" VARCHAR(100) NOT NULL,
    "status" VARCHAR(10) NOT NULL,

    CONSTRAINT "PreCustomerMeeting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChargeGroup" (
    "id" SERIAL NOT NULL,
    "createdOn" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedOn" TIMESTAMPTZ NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "createdBy" VARCHAR(100) NOT NULL,
    "updatedBy" VARCHAR(100) NOT NULL,
    "status" CHAR(1) NOT NULL,

    CONSTRAINT "ChargeGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SectorMaster" (
    "id" SERIAL NOT NULL,
    "sectorName" VARCHAR(50) NOT NULL,
    "createdOn" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedOn" TIMESTAMPTZ NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "createdBy" VARCHAR(100) NOT NULL,
    "updatedBy" VARCHAR(100) NOT NULL,
    "loginId" INTEGER,
    "status" CHAR(1) NOT NULL,

    CONSTRAINT "SectorMaster_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "CompanyMaster" ADD CONSTRAINT "CompanyMaster_cityMasterId_fkey" FOREIGN KEY ("cityMasterId") REFERENCES "CityMaster"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyMaster" ADD CONSTRAINT "CompanyMaster_stateMasterId_fkey" FOREIGN KEY ("stateMasterId") REFERENCES "StateMaster"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyMaster" ADD CONSTRAINT "CompanyMaster_countryMasterId_fkey" FOREIGN KEY ("countryMasterId") REFERENCES "CountryMaster"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyMaster" ADD CONSTRAINT "CompanyMaster_currencyMasterId_fkey" FOREIGN KEY ("currencyMasterId") REFERENCES "CurrencyMaster"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BranchMaster" ADD CONSTRAINT "BranchMaster_companyMasterId_fkey" FOREIGN KEY ("companyMasterId") REFERENCES "CompanyMaster"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BranchMaster" ADD CONSTRAINT "BranchMaster_cityMasterId_fkey" FOREIGN KEY ("cityMasterId") REFERENCES "CityMaster"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BranchMaster" ADD CONSTRAINT "BranchMaster_stateMasterId_fkey" FOREIGN KEY ("stateMasterId") REFERENCES "StateMaster"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BranchMaster" ADD CONSTRAINT "BranchMaster_countryMasterId_fkey" FOREIGN KEY ("countryMasterId") REFERENCES "CountryMaster"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BranchMaster" ADD CONSTRAINT "BranchMaster_currencyMasterId_fkey" FOREIGN KEY ("currencyMasterId") REFERENCES "CurrencyMaster"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserMaster" ADD CONSTRAINT "UserMaster_countryMasterId_fkey" FOREIGN KEY ("countryMasterId") REFERENCES "CountryMaster"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CurrencyMaster" ADD CONSTRAINT "CurrencyMaster_countryMasterId_fkey" FOREIGN KEY ("countryMasterId") REFERENCES "CountryMaster"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StateMaster" ADD CONSTRAINT "StateMaster_countryMasterId_fkey" FOREIGN KEY ("countryMasterId") REFERENCES "CountryMaster"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CityMaster" ADD CONSTRAINT "CityMaster_countryMasterId_fkey" FOREIGN KEY ("countryMasterId") REFERENCES "CountryMaster"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CityMaster" ADD CONSTRAINT "CityMaster_stateMasterId_fkey" FOREIGN KEY ("stateMasterId") REFERENCES "StateMaster"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DepartmentMaster" ADD CONSTRAINT "DepartmentMaster_companyMasterId_fkey" FOREIGN KEY ("companyMasterId") REFERENCES "CompanyMaster"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PortMaster" ADD CONSTRAINT "PortMaster_countryMasterId_fkey" FOREIGN KEY ("countryMasterId") REFERENCES "CountryMaster"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PortMaster" ADD CONSTRAINT "PortMaster_stateMasterId_fkey" FOREIGN KEY ("stateMasterId") REFERENCES "StateMaster"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChargeMaster" ADD CONSTRAINT "ChargeMaster_companyMasterId_fkey" FOREIGN KEY ("companyMasterId") REFERENCES "CompanyMaster"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChargeMaster" ADD CONSTRAINT "ChargeMaster_currencyMasterId_fkey" FOREIGN KEY ("currencyMasterId") REFERENCES "CurrencyMaster"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChargeMaster" ADD CONSTRAINT "ChargeMaster_departmentMasterId_fkey" FOREIGN KEY ("departmentMasterId") REFERENCES "DepartmentMaster"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChargeMaster" ADD CONSTRAINT "ChargeMaster_chargeGroupId_fkey" FOREIGN KEY ("chargeGroupId") REFERENCES "ChargeGroup"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChargeTaxMaster" ADD CONSTRAINT "ChargeTaxMaster_companyMasterId_fkey" FOREIGN KEY ("companyMasterId") REFERENCES "CompanyMaster"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PreCustomerMaster" ADD CONSTRAINT "PreCustomerMaster_companyMasterId_fkey" FOREIGN KEY ("companyMasterId") REFERENCES "CompanyMaster"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PreCustomerMaster" ADD CONSTRAINT "PreCustomerMaster_branchMasterId_fkey" FOREIGN KEY ("branchMasterId") REFERENCES "BranchMaster"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PreCustomerMaster" ADD CONSTRAINT "PreCustomerMaster_cityMasterId_fkey" FOREIGN KEY ("cityMasterId") REFERENCES "CityMaster"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PreCustomerMaster" ADD CONSTRAINT "PreCustomerMaster_stateMasterId_fkey" FOREIGN KEY ("stateMasterId") REFERENCES "StateMaster"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PreCustomerMaster" ADD CONSTRAINT "PreCustomerMaster_countryMasterId_fkey" FOREIGN KEY ("countryMasterId") REFERENCES "CountryMaster"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PreCustomerMeeting" ADD CONSTRAINT "PreCustomerMeeting_companyMasterId_fkey" FOREIGN KEY ("companyMasterId") REFERENCES "CompanyMaster"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PreCustomerMeeting" ADD CONSTRAINT "PreCustomerMeeting_branchMasterId_fkey" FOREIGN KEY ("branchMasterId") REFERENCES "BranchMaster"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PreCustomerMeeting" ADD CONSTRAINT "PreCustomerMeeting_preCustomerMasterId_fkey" FOREIGN KEY ("preCustomerMasterId") REFERENCES "PreCustomerMaster"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
