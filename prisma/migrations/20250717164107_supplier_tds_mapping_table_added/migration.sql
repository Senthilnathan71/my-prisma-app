-- CreateTable
CREATE TABLE "SubledgerMaster" (
    "SubledgerMasterSid" SERIAL NOT NULL,
    "SubledgerName" VARCHAR(1000) NOT NULL,
    "SubledgerType" VARCHAR(20) NOT NULL DEFAULT 'Customer',
    "SubledgerMappingSid" INTEGER,
    "COAMasterSid" INTEGER NOT NULL,
    "CreatedOn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "CreatedBy" VARCHAR(100) NOT NULL,
    "UpdatedOn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "UpdatedBy" VARCHAR(100),
    "deletedAt" TIMESTAMP(3),
    "Remarks" VARCHAR(100),
    "Status" VARCHAR(10) NOT NULL DEFAULT 'A',

    CONSTRAINT "SubledgerMaster_pkey" PRIMARY KEY ("SubledgerMasterSid")
);

-- CreateTable
CREATE TABLE "SupplierTdsMapping" (
    "SupplierTdsMappingSid" SERIAL NOT NULL,
    "CreatedOn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "CreatedBy" VARCHAR(100) NOT NULL,
    "UpdatedOn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "UpdatedBy" VARCHAR(100),
    "deletedAt" TIMESTAMP(3),
    "Status" CHAR(1) NOT NULL DEFAULT 'A',
    "Remarks" VARCHAR(200),
    "CompanyMasterSid" INTEGER NOT NULL,
    "TDSSetHeaderSid" INTEGER NOT NULL,
    "CustomerMasterSid" INTEGER NOT NULL,
    "CustomerBranchSid" INTEGER NOT NULL,
    "CompanyType" VARCHAR(20),
    "TaxExempt" CHAR(1) NOT NULL DEFAULT 'N',
    "TransactionLimit" DECIMAL(8,2) NOT NULL,
    "CertificateNo" VARCHAR(20),
    "CertificatePercentage" DECIMAL(2,2),
    "EffectiveFrom" DATE NOT NULL,
    "EffectiveTo" DATE NOT NULL,

    CONSTRAINT "SupplierTdsMapping_pkey" PRIMARY KEY ("SupplierTdsMappingSid")
);

-- AddForeignKey
ALTER TABLE "SubledgerMaster" ADD CONSTRAINT "SubledgerMaster_COAMasterSid_fkey" FOREIGN KEY ("COAMasterSid") REFERENCES "COAMaster"("COAMasterSid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierTdsMapping" ADD CONSTRAINT "SupplierTdsMapping_CompanyMasterSid_fkey" FOREIGN KEY ("CompanyMasterSid") REFERENCES "CompanyMaster"("CompanyMasterSid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierTdsMapping" ADD CONSTRAINT "SupplierTdsMapping_TDSSetHeaderSid_fkey" FOREIGN KEY ("TDSSetHeaderSid") REFERENCES "TDSSetHeader"("TDSSetHeaderSid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierTdsMapping" ADD CONSTRAINT "SupplierTdsMapping_CustomerMasterSid_fkey" FOREIGN KEY ("CustomerMasterSid") REFERENCES "CustomerMaster"("CustomerMasterSid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierTdsMapping" ADD CONSTRAINT "SupplierTdsMapping_CustomerBranchSid_fkey" FOREIGN KEY ("CustomerBranchSid") REFERENCES "CustomerBranch"("CustomerBranchSid") ON DELETE RESTRICT ON UPDATE CASCADE;
