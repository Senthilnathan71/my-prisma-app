-- CreateTable
CREATE TABLE "VoucherHeader" (
    "EnquiryHeaderSid" SERIAL NOT NULL,
    "CreatedOn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "CreatedBy" VARCHAR(100) NOT NULL,
    "UpdatedOn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "UpdatedBy" VARCHAR(100),
    "Status" CHAR(1) NOT NULL DEFAULT 'A',
    "CompanyMasterSid" INTEGER NOT NULL,
    "BranchMasterSid" INTEGER NOT NULL,
    "VoucherNumber" VARCHAR(20) NOT NULL,
    "VoucherType" INTEGER NOT NULL,
    "VoucherDate" TIMESTAMP(3) NOT NULL,
    "PostDate" TIMESTAMP(3) NOT NULL,
    "Narration" VARCHAR(300) NOT NULL,
    "PartyMasterSid" INTEGER NOT NULL,
    "PartyName" VARCHAR(100) NOT NULL,
    "PartyAddress" VARCHAR(300),
    "CustomerBranchSid" INTEGER,
    "PlaceOfSupply" VARCHAR(50),
    "State" VARCHAR(50),
    "COAMasterSid" INTEGER NOT NULL,
    "BankCOA" INTEGER,
    "BankPartyName" VARCHAR(100),
    "DocumentTypeMasterSid" INTEGER NOT NULL,
    "GST_VAT" VARCHAR(20),
    "InvoiceType" VARCHAR(10),
    "ReversalVoucher" INTEGER,
    "TaxNumber" INTEGER,
    "GSTType" VARCHAR(10),
    "IRNStatus" VARCHAR(10),
    "IRNNumber" VARCHAR(100),
    "Remarks" VARCHAR(100),
    "DepartmentMasterSid" INTEGER,
    "HouseNumber" VARCHAR(20),
    "MasterNumber" VARCHAR(20),
    "HouseJobSid" INTEGER,
    "MasterJobSid" INTEGER,
    "CurrencyMasterSid" INTEGER,
    "CurrencyCode" CHAR(3),
    "ExchangeRate" DECIMAL(8,5),
    "Amount" DECIMAL(15,3),
    "LocalAmount" DECIMAL(15,3),
    "NetAmount" DECIMAL(15,3),
    "DocumentNumber" VARCHAR(30),
    "DocumentDate" TIMESTAMP(3),
    "SetoffStatus" VARCHAR(15),
    "TaxType" CHAR(3),
    "InstrumentMode" VARCHAR(10),
    "InstrumentNumber" VARCHAR(25),
    "InstrumentDate" TIMESTAMP(3),
    "ClearanceDate" TIMESTAMP(3),
    "CreditNoteReason" VARCHAR(100),

    CONSTRAINT "VoucherHeader_pkey" PRIMARY KEY ("EnquiryHeaderSid")
);

-- CreateTable
CREATE TABLE "VoucherDetail" (
    "VoucherDetailSid" SERIAL NOT NULL,
    "CreatedOn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "CreatedBy" VARCHAR(100) NOT NULL,
    "UpdatedOn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "UpdatedBy" VARCHAR(100),
    "Status" CHAR(1) NOT NULL DEFAULT 'A',
    "CompanyMasterSid" INTEGER NOT NULL,
    "BranchMasterSid" INTEGER NOT NULL,
    "VoucherHeaderSid" INTEGER NOT NULL,
    "Sno" DECIMAL(4,0) NOT NULL,
    "ChargeMasterSid" INTEGER,
    "ChargeDescription" VARCHAR(100),
    "LedgerMasterSid" INTEGER,
    "COAMasterSid" INTEGER,
    "HSSACMasterSid" INTEGER,
    "DepartmentMasterSid" INTEGER,
    "HouseJobSid" INTEGER,
    "MasterJobSid" INTEGER,
    "CostRevenue" VARCHAR(10),
    "CurrencyMasterSid" INTEGER NOT NULL,
    "CurrencyCode" VARCHAR(3) NOT NULL,
    "ExchangeRate" DECIMAL(6,3) NOT NULL,
    "Rate" DECIMAL(15,3) NOT NULL,
    "NumberOfUnit" DECIMAL(7,3),
    "Narration" VARCHAR(200),
    "DrCr" CHAR(1) NOT NULL,
    "TaxableAmount" DECIMAL(15,3) NOT NULL,
    "TaxPercentage1" DECIMAL(5,2),
    "TaxAmount1" DECIMAL(10,3),
    "TaxPercentage2" DECIMAL(5,2),
    "TaxAmount2" DECIMAL(10,3),
    "Amount" DECIMAL(15,3) NOT NULL,
    "LocalAmount" DECIMAL(15,3) NOT NULL,
    "InvoiceType" VARCHAR(10),
    "CostCenter" INTEGER,
    "ProfitCenter" INTEGER,
    "Remarks" VARCHAR(200),

    CONSTRAINT "VoucherDetail_pkey" PRIMARY KEY ("VoucherDetailSid")
);

-- CreateTable
CREATE TABLE "VoucherOthers" (
    "VoucherOthersSid" SERIAL NOT NULL,
    "CreatedOn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "CreatedBy" VARCHAR(100) NOT NULL,
    "UpdatedOn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "UpdatedBy" VARCHAR(100),
    "Status" CHAR(1) NOT NULL DEFAULT 'A',
    "VoucherHeaderSid" INTEGER NOT NULL,
    "Footer" VARCHAR(300) NOT NULL,

    CONSTRAINT "VoucherOthers_pkey" PRIMARY KEY ("VoucherOthersSid")
);

-- CreateTable
CREATE TABLE "VoucherTDS" (
    "VoucherTDSSid" SERIAL NOT NULL,
    "CreatedOn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "CreatedBy" VARCHAR(100) NOT NULL,
    "UpdatedOn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "UpdatedBy" VARCHAR(100),
    "Status" CHAR(1) NOT NULL DEFAULT 'A',
    "CompanyMasterSid" INTEGER NOT NULL,
    "BranchMasterSid" INTEGER NOT NULL,
    "VoucherHeaderSid" INTEGER NOT NULL,
    "VoucherDetailSid" INTEGER NOT NULL,
    "TDSSetRateSid" INTEGER NOT NULL,
    "ITSectionCode" VARCHAR(100) NOT NULL,
    "TDSRate" INTEGER NOT NULL,
    "TaxableAmount" DECIMAL(15,3) NOT NULL,
    "TDSAmount" DECIMAL(15,3) NOT NULL,
    "Reason" VARCHAR(100),

    CONSTRAINT "VoucherTDS_pkey" PRIMARY KEY ("VoucherTDSSid")
);

-- CreateTable
CREATE TABLE "VoucherTransaction" (
    "VoucherTransactionSid" SERIAL NOT NULL,
    "CreatedOn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "CreatedBy" VARCHAR(100) NOT NULL,
    "UpdatedOn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "UpdatedBy" VARCHAR(100),
    "Status" CHAR(1) NOT NULL DEFAULT 'A',
    "CompanyMasterSid" INTEGER NOT NULL,
    "BranchMasterSid" INTEGER NOT NULL,
    "VoucherHeaderSid" INTEGER NOT NULL,
    "VoucherDetailSid" INTEGER NOT NULL,
    "VoucherNumber" VARCHAR(20) NOT NULL,
    "VoucherType" INTEGER NOT NULL,
    "VoucherDate" TIMESTAMP(3) NOT NULL,
    "PostDate" TIMESTAMP(3) NOT NULL,
    "DocumentTypeMasterSid" INTEGER NOT NULL,
    "GST_VAT" VARCHAR(20) NOT NULL,
    "Sno" DECIMAL(4,0) NOT NULL,
    "ChargeDescription" VARCHAR(100) NOT NULL,
    "LedgerMasterSid" INTEGER NOT NULL,
    "COAMasterSid" INTEGER NOT NULL,
    "DepartmentMasterSid" INTEGER NOT NULL,
    "HouseJobSid" INTEGER NOT NULL,
    "MasterJobSid" INTEGER NOT NULL,
    "CostRevenue" VARCHAR(10) NOT NULL,
    "CurrencyCode" VARCHAR(3) NOT NULL,
    "ExchangeRate" DECIMAL(6,3) NOT NULL,
    "Rate" DECIMAL(15,3) NOT NULL,
    "NumberOfUnit" DECIMAL(7,3) NOT NULL,
    "Narration" VARCHAR(200),
    "DrCr" CHAR(1) NOT NULL,
    "TaxableAmount" DECIMAL(15,3) NOT NULL,
    "Amount" DECIMAL(15,3) NOT NULL,
    "LocalAmount" DECIMAL(15,3) NOT NULL,
    "CostCenter" INTEGER,
    "ProfitCenter" INTEGER,
    "TransType" VARCHAR(5) NOT NULL,

    CONSTRAINT "VoucherTransaction_pkey" PRIMARY KEY ("VoucherTransactionSid")
);

-- AddForeignKey
ALTER TABLE "VoucherHeader" ADD CONSTRAINT "VoucherHeader_BranchMasterSid_fkey" FOREIGN KEY ("BranchMasterSid") REFERENCES "BranchMaster"("BranchMasterSid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VoucherHeader" ADD CONSTRAINT "VoucherHeader_CompanyMasterSid_fkey" FOREIGN KEY ("CompanyMasterSid") REFERENCES "CompanyMaster"("CompanyMasterSid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VoucherHeader" ADD CONSTRAINT "VoucherHeader_PartyMasterSid_fkey" FOREIGN KEY ("PartyMasterSid") REFERENCES "SubledgerMaster"("SubledgerMasterSid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VoucherHeader" ADD CONSTRAINT "VoucherHeader_COAMasterSid_fkey" FOREIGN KEY ("COAMasterSid") REFERENCES "COAMaster"("COAMasterSid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VoucherHeader" ADD CONSTRAINT "VoucherHeader_CustomerBranchSid_fkey" FOREIGN KEY ("CustomerBranchSid") REFERENCES "CustomerBranch"("CustomerBranchSid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VoucherHeader" ADD CONSTRAINT "VoucherHeader_DocumentTypeMasterSid_fkey" FOREIGN KEY ("DocumentTypeMasterSid") REFERENCES "DocumentTypeMaster"("DocumentTypeMasterSid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VoucherHeader" ADD CONSTRAINT "VoucherHeader_DepartmentMasterSid_fkey" FOREIGN KEY ("DepartmentMasterSid") REFERENCES "DepartmentMaster"("DepartmentMasterSid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VoucherHeader" ADD CONSTRAINT "VoucherHeader_MasterJobSid_fkey" FOREIGN KEY ("MasterJobSid") REFERENCES "MasterJob"("MasterJobSid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VoucherHeader" ADD CONSTRAINT "VoucherHeader_HouseJobSid_fkey" FOREIGN KEY ("HouseJobSid") REFERENCES "HouseJob"("HouseJobSid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VoucherHeader" ADD CONSTRAINT "VoucherHeader_CurrencyMasterSid_fkey" FOREIGN KEY ("CurrencyMasterSid") REFERENCES "CurrencyMaster"("CurrencyMasterSid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VoucherDetail" ADD CONSTRAINT "VoucherDetail_VoucherHeaderSid_fkey" FOREIGN KEY ("VoucherHeaderSid") REFERENCES "VoucherHeader"("EnquiryHeaderSid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VoucherDetail" ADD CONSTRAINT "VoucherDetail_BranchMasterSid_fkey" FOREIGN KEY ("BranchMasterSid") REFERENCES "BranchMaster"("BranchMasterSid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VoucherDetail" ADD CONSTRAINT "VoucherDetail_CompanyMasterSid_fkey" FOREIGN KEY ("CompanyMasterSid") REFERENCES "CompanyMaster"("CompanyMasterSid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VoucherDetail" ADD CONSTRAINT "VoucherDetail_MasterJobSid_fkey" FOREIGN KEY ("MasterJobSid") REFERENCES "MasterJob"("MasterJobSid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VoucherDetail" ADD CONSTRAINT "VoucherDetail_HouseJobSid_fkey" FOREIGN KEY ("HouseJobSid") REFERENCES "HouseJob"("HouseJobSid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VoucherDetail" ADD CONSTRAINT "VoucherDetail_CurrencyMasterSid_fkey" FOREIGN KEY ("CurrencyMasterSid") REFERENCES "CurrencyMaster"("CurrencyMasterSid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VoucherDetail" ADD CONSTRAINT "VoucherDetail_ChargeMasterSid_fkey" FOREIGN KEY ("ChargeMasterSid") REFERENCES "ChargeMaster"("ChargeMasterSid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VoucherDetail" ADD CONSTRAINT "VoucherDetail_COAMasterSid_fkey" FOREIGN KEY ("COAMasterSid") REFERENCES "COAMaster"("COAMasterSid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VoucherDetail" ADD CONSTRAINT "VoucherDetail_HSSACMasterSid_fkey" FOREIGN KEY ("HSSACMasterSid") REFERENCES "HSSACMaster"("HSSACMasterSid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VoucherDetail" ADD CONSTRAINT "VoucherDetail_LedgerMasterSid_fkey" FOREIGN KEY ("LedgerMasterSid") REFERENCES "SubledgerMaster"("SubledgerMasterSid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VoucherDetail" ADD CONSTRAINT "VoucherDetail_DepartmentMasterSid_fkey" FOREIGN KEY ("DepartmentMasterSid") REFERENCES "DepartmentMaster"("DepartmentMasterSid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VoucherDetail" ADD CONSTRAINT "VoucherDetail_ProfitCenter_fkey" FOREIGN KEY ("ProfitCenter") REFERENCES "ProfitCenterMaster"("ProfitCenterMasterSid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VoucherDetail" ADD CONSTRAINT "VoucherDetail_CostCenter_fkey" FOREIGN KEY ("CostCenter") REFERENCES "CostCenterMaster"("CostCenterMasterSid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VoucherOthers" ADD CONSTRAINT "VoucherOthers_VoucherHeaderSid_fkey" FOREIGN KEY ("VoucherHeaderSid") REFERENCES "VoucherHeader"("EnquiryHeaderSid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VoucherTDS" ADD CONSTRAINT "VoucherTDS_BranchMasterSid_fkey" FOREIGN KEY ("BranchMasterSid") REFERENCES "BranchMaster"("BranchMasterSid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VoucherTDS" ADD CONSTRAINT "VoucherTDS_CompanyMasterSid_fkey" FOREIGN KEY ("CompanyMasterSid") REFERENCES "CompanyMaster"("CompanyMasterSid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VoucherTDS" ADD CONSTRAINT "VoucherTDS_VoucherHeaderSid_fkey" FOREIGN KEY ("VoucherHeaderSid") REFERENCES "VoucherHeader"("EnquiryHeaderSid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VoucherTDS" ADD CONSTRAINT "VoucherTDS_VoucherDetailSid_fkey" FOREIGN KEY ("VoucherDetailSid") REFERENCES "VoucherDetail"("VoucherDetailSid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VoucherTDS" ADD CONSTRAINT "VoucherTDS_TDSSetRateSid_fkey" FOREIGN KEY ("TDSSetRateSid") REFERENCES "TDSSetRate"("TDSSetRateSid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VoucherTransaction" ADD CONSTRAINT "VoucherTransaction_BranchMasterSid_fkey" FOREIGN KEY ("BranchMasterSid") REFERENCES "BranchMaster"("BranchMasterSid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VoucherTransaction" ADD CONSTRAINT "VoucherTransaction_CompanyMasterSid_fkey" FOREIGN KEY ("CompanyMasterSid") REFERENCES "CompanyMaster"("CompanyMasterSid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VoucherTransaction" ADD CONSTRAINT "VoucherTransaction_VoucherHeaderSid_fkey" FOREIGN KEY ("VoucherHeaderSid") REFERENCES "VoucherHeader"("EnquiryHeaderSid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VoucherTransaction" ADD CONSTRAINT "VoucherTransaction_VoucherDetailSid_fkey" FOREIGN KEY ("VoucherDetailSid") REFERENCES "VoucherDetail"("VoucherDetailSid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VoucherTransaction" ADD CONSTRAINT "VoucherTransaction_LedgerMasterSid_fkey" FOREIGN KEY ("LedgerMasterSid") REFERENCES "SubledgerMaster"("SubledgerMasterSid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VoucherTransaction" ADD CONSTRAINT "VoucherTransaction_DocumentTypeMasterSid_fkey" FOREIGN KEY ("DocumentTypeMasterSid") REFERENCES "DocumentTypeMaster"("DocumentTypeMasterSid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VoucherTransaction" ADD CONSTRAINT "VoucherTransaction_DepartmentMasterSid_fkey" FOREIGN KEY ("DepartmentMasterSid") REFERENCES "DepartmentMaster"("DepartmentMasterSid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VoucherTransaction" ADD CONSTRAINT "VoucherTransaction_COAMasterSid_fkey" FOREIGN KEY ("COAMasterSid") REFERENCES "COAMaster"("COAMasterSid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VoucherTransaction" ADD CONSTRAINT "VoucherTransaction_MasterJobSid_fkey" FOREIGN KEY ("MasterJobSid") REFERENCES "MasterJob"("MasterJobSid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VoucherTransaction" ADD CONSTRAINT "VoucherTransaction_HouseJobSid_fkey" FOREIGN KEY ("HouseJobSid") REFERENCES "HouseJob"("HouseJobSid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VoucherTransaction" ADD CONSTRAINT "VoucherTransaction_CostCenter_fkey" FOREIGN KEY ("CostCenter") REFERENCES "CostCenterMaster"("CostCenterMasterSid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VoucherTransaction" ADD CONSTRAINT "VoucherTransaction_ProfitCenter_fkey" FOREIGN KEY ("ProfitCenter") REFERENCES "ProfitCenterMaster"("ProfitCenterMasterSid") ON DELETE SET NULL ON UPDATE CASCADE;
