-- CreateTable
CREATE TABLE "EnquiryCargo" (
    "EnquiryCargoSid" SERIAL NOT NULL,
    "CompanyMasterSid" INTEGER NOT NULL,
    "BranchMasterSid" INTEGER NOT NULL,
    "EnquiryHeaderSid" INTEGER NOT NULL,
    "EnquiryRouteSid" INTEGER NOT NULL,
    "CargoType" VARCHAR(10) NOT NULL,
    "WeightUnitSid" INTEGER NOT NULL,
    "GrossWeight" DECIMAL(10,3) NOT NULL,
    "NetWeight" DECIMAL(10,3) NOT NULL,
    "Volume" DECIMAL(10,3) NOT NULL,
    "ChargeableWeight" DECIMAL(10,3) NOT NULL,
    "ContainerType" VARCHAR(10) NOT NULL,
    "Qty" DECIMAL(5,0) NOT NULL,
    "ShipmentTerms" VARCHAR(10) NOT NULL,
    "ProductName" VARCHAR(20) NOT NULL,
    "PackageType" VARCHAR(5) NOT NULL,
    "PackageQty" DECIMAL(5,0) NOT NULL,
    "CargoDescription" VARCHAR(100) NOT NULL,
    "createdOn" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedOn" TIMESTAMPTZ(6) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "createdBy" VARCHAR(100) NOT NULL,
    "updatedBy" VARCHAR(100),
    "status" CHAR(1) NOT NULL,
    "LoginSid" INTEGER,

    CONSTRAINT "EnquiryCargo_pkey" PRIMARY KEY ("EnquiryCargoSid")
);

-- CreateTable
CREATE TABLE "CustomerMaster" (
    "EnquiryCargoSid" SERIAL NOT NULL,
    "CompanyMasterSid" INTEGER NOT NULL,
    "PreCustomerMasterSid" INTEGER NOT NULL,
    "CountryMasterSid" INTEGER NOT NULL,
    "CustomerName" VARCHAR(100) NOT NULL,
    "CustomerShortCode" VARCHAR(50) NOT NULL,
    "CustomerAliasName" VARCHAR(100) NOT NULL,
    "PreCustomerAddress1" VARCHAR(300) NOT NULL,
    "PreCustomerAddress2" VARCHAR(300) NOT NULL,
    "Registered" VARCHAR(20) NOT NULL,
    "CompanyType" VARCHAR(20) NOT NULL,
    "PanVatNo" VARCHAR(20) NOT NULL,
    "PanName" VARCHAR(100) NOT NULL,
    "CINNo" VARCHAR(20) NOT NULL,
    "CashCredit" VARCHAR(6) NOT NULL,
    "GroupName" VARCHAR(20) NOT NULL,
    "Network" VARCHAR(20) NOT NULL,
    "Website" VARCHAR(50) NOT NULL,
    "IsMSME" CHAR(1) NOT NULL,
    "Remarks" VARCHAR(100) NOT NULL,
    "RegistrationNo" VARCHAR(20) NOT NULL,
    "createdOn" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedOn" TIMESTAMPTZ(6) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "createdBy" VARCHAR(100) NOT NULL,
    "updatedBy" VARCHAR(100),
    "status" CHAR(1) NOT NULL,
    "LoginSid" INTEGER,

    CONSTRAINT "CustomerMaster_pkey" PRIMARY KEY ("EnquiryCargoSid")
);

-- AddForeignKey
ALTER TABLE "EnquiryCargo" ADD CONSTRAINT "EnquiryCargo_CompanyMasterSid_fkey" FOREIGN KEY ("CompanyMasterSid") REFERENCES "CompanyMaster"("CompanyMasterSid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnquiryCargo" ADD CONSTRAINT "EnquiryCargo_BranchMasterSid_fkey" FOREIGN KEY ("BranchMasterSid") REFERENCES "BranchMaster"("BranchMasterSid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnquiryCargo" ADD CONSTRAINT "EnquiryCargo_EnquiryHeaderSid_fkey" FOREIGN KEY ("EnquiryHeaderSid") REFERENCES "EnquiryHeader"("EnquiryHeaderSid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnquiryCargo" ADD CONSTRAINT "EnquiryCargo_EnquiryRouteSid_fkey" FOREIGN KEY ("EnquiryRouteSid") REFERENCES "EnquiryRoute"("EnquiryRouteSid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerMaster" ADD CONSTRAINT "CustomerMaster_CompanyMasterSid_fkey" FOREIGN KEY ("CompanyMasterSid") REFERENCES "CompanyMaster"("CompanyMasterSid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerMaster" ADD CONSTRAINT "CustomerMaster_PreCustomerMasterSid_fkey" FOREIGN KEY ("PreCustomerMasterSid") REFERENCES "PreCustomerMaster"("PreCustomerMasterSid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerMaster" ADD CONSTRAINT "CustomerMaster_CountryMasterSid_fkey" FOREIGN KEY ("CountryMasterSid") REFERENCES "CountryMaster"("CountryMasterSid") ON DELETE RESTRICT ON UPDATE CASCADE;
