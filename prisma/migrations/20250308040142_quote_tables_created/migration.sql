-- CreateTable
CREATE TABLE "QuoteHeader" (
    "QuoteHeaderSid" SERIAL NOT NULL,
    "QuoteDate" TIMESTAMP(3) NOT NULL,
    "CompanyMasterSid" INTEGER NOT NULL,
    "BranchMasterSid" INTEGER NOT NULL,
    "EnquirySid" INTEGER NOT NULL,
    "DepartmentMasterSid" INTEGER NOT NULL,
    "CustomerMasterSid" INTEGER NOT NULL,
    "CustomerName" VARCHAR(100) NOT NULL,
    "CustomerAddress" VARCHAR(300) NOT NULL,
    "AgentMasterSid" INTEGER NOT NULL,
    "AgentName" VARCHAR(100) NOT NULL,
    "AgentAddress" VARCHAR(300) NOT NULL,
    "SalesmanSid" INTEGER NOT NULL,
    "QuoteSource" VARCHAR(20) NOT NULL,
    "IncoTerms" VARCHAR(10) NOT NULL,
    "Remarks" VARCHAR(100) NOT NULL,
    "EnquiryRemarks" VARCHAR(100) NOT NULL,
    "CarrierPrint" CHAR(1),
    "RoutingSid" INTEGER NOT NULL,
    "ShipperRefNo" VARCHAR(20) NOT NULL,
    "TransportType" VARCHAR(10) NOT NULL,
    "CustomerRef" VARCHAR(20) NOT NULL,
    "QuoteValidFrom" TIMESTAMP(3) NOT NULL,
    "QuoteValidTo" TIMESTAMP(3) NOT NULL,
    "InternalApprovedBy" INTEGER NOT NULL,
    "InternalApprovedOn" TIMESTAMP(3) NOT NULL,
    "CustomerApprovedBy" VARCHAR(20) NOT NULL,
    "CustomerApprovedOn" TIMESTAMP(3) NOT NULL,
    "Email" VARCHAR(200) NOT NULL,
    "createdOn" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedOn" TIMESTAMPTZ(6),
    "deletedAt" TIMESTAMP(3),
    "createdBy" VARCHAR(100) NOT NULL,
    "updatedBy" VARCHAR(100),
    "status" CHAR(1) DEFAULT 'A',
    "LoginSid" INTEGER,

    CONSTRAINT "QuoteHeader_pkey" PRIMARY KEY ("QuoteHeaderSid")
);

-- CreateTable
CREATE TABLE "QuoteRoute" (
    "QuoteRouteSid" SERIAL NOT NULL,
    "QuoteHeaderSid" INTEGER NOT NULL,
    "DepartmentMasterSid" INTEGER NOT NULL,
    "CargoType" VARCHAR(10) NOT NULL,
    "POLFreeDays" DECIMAL(2,0) NOT NULL,
    "PODFreeDays" DECIMAL(2,0) NOT NULL,
    "PORSid" INTEGER NOT NULL,
    "POLSid" INTEGER NOT NULL,
    "PODSid" INTEGER NOT NULL,
    "FDPSid" INTEGER NOT NULL,
    "Remarks" VARCHAR(100) NOT NULL,
    "CompanyMasterSid" INTEGER NOT NULL,
    "BranchMasterSid" INTEGER NOT NULL,
    "CarrierName" VARCHAR(100) NOT NULL,
    "IsHaz" CHAR(1) NOT NULL,
    "ServiceLevel" VARCHAR(10) NOT NULL,
    "TransitDays" DECIMAL(3,0) NOT NULL,
    "createdOn" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedOn" TIMESTAMPTZ(6),
    "deletedAt" TIMESTAMP(3),
    "createdBy" VARCHAR(100) NOT NULL,
    "updatedBy" VARCHAR(100),
    "status" CHAR(1) DEFAULT 'A',
    "LoginSid" INTEGER,

    CONSTRAINT "QuoteRoute_pkey" PRIMARY KEY ("QuoteRouteSid")
);

-- CreateTable
CREATE TABLE "QuoteCarrier" (
    "QuoteCarrierSid" SERIAL NOT NULL,
    "QuoteRouteSid" INTEGER NOT NULL,
    "QuoteHeaderSid" INTEGER NOT NULL,
    "CarrierMasterSid" INTEGER,
    "CarrierName" VARCHAR(100) NOT NULL,
    "CompanyMasterSid" INTEGER NOT NULL,
    "BranchMasterSid" INTEGER NOT NULL,
    "CreatedOn" TIMESTAMP(3) NOT NULL,
    "CreatedBy" VARCHAR(100) NOT NULL,
    "UpdatedOn" TIMESTAMP(3) NOT NULL,
    "UpdatedBy" VARCHAR(100) NOT NULL,
    "ApprovalStatus" CHAR(1) NOT NULL DEFAULT 'A',
    "ApprovedBy" VARCHAR(20) NOT NULL,
    "Remarks" VARCHAR(100) NOT NULL,
    "createdOn" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedOn" TIMESTAMPTZ(6),
    "deletedAt" TIMESTAMP(3),
    "createdBy" VARCHAR(100) NOT NULL,
    "updatedBy" VARCHAR(100),
    "status" CHAR(1) DEFAULT 'A',
    "LoginSid" INTEGER,

    CONSTRAINT "QuoteCarrier_pkey" PRIMARY KEY ("QuoteCarrierSid")
);

-- CreateTable
CREATE TABLE "QuoteCharge" (
    "QuoteChargeSid" SERIAL NOT NULL,
    "QuoteRouteSid" INTEGER NOT NULL,
    "QuoteHeaderSid" INTEGER NOT NULL,
    "QuoteCarrierSid" INTEGER NOT NULL,
    "CompanyMasterSid" INTEGER NOT NULL,
    "BranchMasterSid" INTEGER NOT NULL,
    "ChargeUomSid" INTEGER,
    "CustomerMasterSid" INTEGER NOT NULL,
    "CurrencyMasterSid" INTEGER NOT NULL,
    "CostRevenue" VARCHAR(10) NOT NULL,
    "ChargeDisplayName" VARCHAR(50) NOT NULL,
    "ExchangeRate" DECIMAL(6,3) NOT NULL,
    "Rate" DECIMAL(15,3) NOT NULL,
    "Qty" DECIMAL(7,3) NOT NULL,
    "Amount" DECIMAL(15,3) NOT NULL,
    "Remarks" VARCHAR(100) NOT NULL,
    "createdOn" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedOn" TIMESTAMPTZ(6),
    "deletedAt" TIMESTAMP(3),
    "createdBy" VARCHAR(100) NOT NULL,
    "updatedBy" VARCHAR(100),
    "status" CHAR(1) DEFAULT 'A',
    "LoginSid" INTEGER,

    CONSTRAINT "QuoteCharge_pkey" PRIMARY KEY ("QuoteChargeSid")
);

-- CreateTable
CREATE TABLE "RoutingHeader" (
    "RoutingHeaderSid" SERIAL NOT NULL,
    "RoutingOrderNo" VARCHAR(20) NOT NULL,
    "CompanyMasterSid" INTEGER NOT NULL,
    "BranchMasterSid" INTEGER NOT NULL,
    "createdOn" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedOn" TIMESTAMPTZ(6),
    "deletedAt" TIMESTAMP(3),
    "createdBy" VARCHAR(100) NOT NULL,
    "updatedBy" VARCHAR(100),

    CONSTRAINT "RoutingHeader_pkey" PRIMARY KEY ("RoutingHeaderSid")
);

-- CreateTable
CREATE TABLE "EnquiryProduct" (
    "EnquiryProductSid" SERIAL NOT NULL,
    "ProductName" VARCHAR(20) NOT NULL,
    "PackageType" VARCHAR(5) NOT NULL,
    "CargoDescription" VARCHAR(100) NOT NULL,
    "ProductUnit" INTEGER NOT NULL,
    "CompanyMasterSid" INTEGER NOT NULL,
    "BranchMasterSid" INTEGER NOT NULL,
    "EnquiryHeaderSid" INTEGER NOT NULL,
    "EnquiryRouteSid" INTEGER NOT NULL,
    "Remarks" VARCHAR(100) NOT NULL,
    "createdOn" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedOn" TIMESTAMPTZ(6),
    "deletedAt" TIMESTAMP(3),
    "createdBy" VARCHAR(100) NOT NULL,
    "updatedBy" VARCHAR(100),
    "status" CHAR(1) DEFAULT 'A',
    "LoginSid" INTEGER,

    CONSTRAINT "EnquiryProduct_pkey" PRIMARY KEY ("EnquiryProductSid")
);

-- AddForeignKey
ALTER TABLE "QuoteHeader" ADD CONSTRAINT "QuoteHeader_CompanyMasterSid_fkey" FOREIGN KEY ("CompanyMasterSid") REFERENCES "CompanyMaster"("CompanyMasterSid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuoteHeader" ADD CONSTRAINT "QuoteHeader_BranchMasterSid_fkey" FOREIGN KEY ("BranchMasterSid") REFERENCES "BranchMaster"("BranchMasterSid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuoteHeader" ADD CONSTRAINT "QuoteHeader_EnquirySid_fkey" FOREIGN KEY ("EnquirySid") REFERENCES "EnquiryHeader"("EnquiryHeaderSid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuoteHeader" ADD CONSTRAINT "QuoteHeader_DepartmentMasterSid_fkey" FOREIGN KEY ("DepartmentMasterSid") REFERENCES "DepartmentMaster"("DepartmentMasterSid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuoteHeader" ADD CONSTRAINT "QuoteHeader_CustomerMasterSid_fkey" FOREIGN KEY ("CustomerMasterSid") REFERENCES "CustomerMaster"("CustomerMasterSid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuoteRoute" ADD CONSTRAINT "QuoteRoute_DepartmentMasterSid_fkey" FOREIGN KEY ("DepartmentMasterSid") REFERENCES "DepartmentMaster"("DepartmentMasterSid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuoteRoute" ADD CONSTRAINT "QuoteRoute_QuoteHeaderSid_fkey" FOREIGN KEY ("QuoteHeaderSid") REFERENCES "QuoteHeader"("QuoteHeaderSid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuoteRoute" ADD CONSTRAINT "QuoteRoute_CompanyMasterSid_fkey" FOREIGN KEY ("CompanyMasterSid") REFERENCES "CompanyMaster"("CompanyMasterSid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuoteRoute" ADD CONSTRAINT "QuoteRoute_BranchMasterSid_fkey" FOREIGN KEY ("BranchMasterSid") REFERENCES "BranchMaster"("BranchMasterSid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuoteCarrier" ADD CONSTRAINT "QuoteCarrier_QuoteHeaderSid_fkey" FOREIGN KEY ("QuoteHeaderSid") REFERENCES "QuoteHeader"("QuoteHeaderSid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuoteCarrier" ADD CONSTRAINT "QuoteCarrier_QuoteRouteSid_fkey" FOREIGN KEY ("QuoteRouteSid") REFERENCES "QuoteRoute"("QuoteRouteSid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuoteCarrier" ADD CONSTRAINT "QuoteCarrier_CompanyMasterSid_fkey" FOREIGN KEY ("CompanyMasterSid") REFERENCES "CompanyMaster"("CompanyMasterSid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuoteCarrier" ADD CONSTRAINT "QuoteCarrier_BranchMasterSid_fkey" FOREIGN KEY ("BranchMasterSid") REFERENCES "BranchMaster"("BranchMasterSid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuoteCharge" ADD CONSTRAINT "QuoteCharge_QuoteCarrierSid_fkey" FOREIGN KEY ("QuoteCarrierSid") REFERENCES "QuoteCarrier"("QuoteCarrierSid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuoteCharge" ADD CONSTRAINT "QuoteCharge_QuoteHeaderSid_fkey" FOREIGN KEY ("QuoteHeaderSid") REFERENCES "QuoteHeader"("QuoteHeaderSid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuoteCharge" ADD CONSTRAINT "QuoteCharge_QuoteRouteSid_fkey" FOREIGN KEY ("QuoteRouteSid") REFERENCES "QuoteRoute"("QuoteRouteSid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuoteCharge" ADD CONSTRAINT "QuoteCharge_CompanyMasterSid_fkey" FOREIGN KEY ("CompanyMasterSid") REFERENCES "CompanyMaster"("CompanyMasterSid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuoteCharge" ADD CONSTRAINT "QuoteCharge_BranchMasterSid_fkey" FOREIGN KEY ("BranchMasterSid") REFERENCES "BranchMaster"("BranchMasterSid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuoteCharge" ADD CONSTRAINT "QuoteCharge_CurrencyMasterSid_fkey" FOREIGN KEY ("CurrencyMasterSid") REFERENCES "CurrencyMaster"("CurrencyMasterSid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuoteCharge" ADD CONSTRAINT "QuoteCharge_CustomerMasterSid_fkey" FOREIGN KEY ("CustomerMasterSid") REFERENCES "CustomerMaster"("CustomerMasterSid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoutingHeader" ADD CONSTRAINT "RoutingHeader_CompanyMasterSid_fkey" FOREIGN KEY ("CompanyMasterSid") REFERENCES "CompanyMaster"("CompanyMasterSid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoutingHeader" ADD CONSTRAINT "RoutingHeader_BranchMasterSid_fkey" FOREIGN KEY ("BranchMasterSid") REFERENCES "BranchMaster"("BranchMasterSid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnquiryProduct" ADD CONSTRAINT "EnquiryProduct_CompanyMasterSid_fkey" FOREIGN KEY ("CompanyMasterSid") REFERENCES "CompanyMaster"("CompanyMasterSid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnquiryProduct" ADD CONSTRAINT "EnquiryProduct_BranchMasterSid_fkey" FOREIGN KEY ("BranchMasterSid") REFERENCES "BranchMaster"("BranchMasterSid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnquiryProduct" ADD CONSTRAINT "EnquiryProduct_EnquiryHeaderSid_fkey" FOREIGN KEY ("EnquiryHeaderSid") REFERENCES "EnquiryHeader"("EnquiryHeaderSid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnquiryProduct" ADD CONSTRAINT "EnquiryProduct_EnquiryRouteSid_fkey" FOREIGN KEY ("EnquiryRouteSid") REFERENCES "EnquiryRoute"("EnquiryRouteSid") ON DELETE RESTRICT ON UPDATE CASCADE;
